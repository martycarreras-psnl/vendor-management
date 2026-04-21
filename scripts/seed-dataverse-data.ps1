#Requires -Version 7.0
<#
.SYNOPSIS
  Seed the Vendor Management Dataverse sample data into a target environment
  using an interactive Microsoft Entra ID sign-in.

.DESCRIPTION
  Thin PowerShell wrapper around scripts/seed-dataverse-data.mjs. The wrapper
  prompts the operator to sign in to Entra ID (interactive browser or device
  code), acquires a Dataverse-scoped access token for the target environment,
  verifies the identity via the WhoAmI endpoint, then hands control to the
  existing Node seeder with that token + env/solution overrides.

  The target environment must already have the solution (tables, columns,
  option sets, relationships) imported. The signed-in user must hold a
  security role granting create/write privileges on every rpvms_* table
  (System Administrator or equivalent).

.PARAMETER EnvUrl
  Base URL of the target Dataverse environment, e.g.
  https://contoso-test.crm.dynamics.com

.PARAMETER TenantId
  Entra ID tenant ID to sign in against. Optional when the user is already
  signed in via Az.Accounts against the desired tenant.

.PARAMETER SolutionName
  Dataverse solution unique name that owns the target tables. Defaults to
  VendorManagement.

.PARAMETER PlanPath
  Path to the dataset plan JSON. Defaults to
  dataverse/seed-data/dataset.plan.json relative to the repo root.

.PARAMETER Phase
  Optional comma-separated 1-based phase indices to run (e.g. "1,2"). When
  omitted, all phases execute.

.PARAMETER DryRun
  Simulate the run without writing to Dataverse.

.PARAMETER AuthMode
  Interactive (browser) or DeviceCode. Defaults to Interactive.

.EXAMPLE
  pwsh ./scripts/seed-dataverse-data.ps1 -EnvUrl https://contoso-test.crm.dynamics.com -DryRun

.EXAMPLE
  pwsh ./scripts/seed-dataverse-data.ps1 `
      -EnvUrl https://contoso-test.crm.dynamics.com `
      -TenantId 11111111-2222-3333-4444-555555555555 `
      -AuthMode DeviceCode
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$EnvUrl,

  [string]$TenantId,

  [string]$SolutionName = 'VendorManagement',

  [string]$PlanPath,

  [string]$Phase,

  [switch]$DryRun,

  [ValidateSet('Interactive', 'DeviceCode')]
  [string]$AuthMode = 'Interactive'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ── Paths ────────────────────────────────────────────────────────────────────
$ScriptDir = Split-Path -Parent $PSCommandPath
$RepoRoot  = Resolve-Path (Join-Path $ScriptDir '..') | Select-Object -ExpandProperty Path
$Seeder    = Join-Path $ScriptDir 'seed-dataverse-data.mjs'
if (-not $PlanPath) { $PlanPath = Join-Path $RepoRoot 'dataverse/seed-data/dataset.plan.json' }

if (-not (Test-Path $Seeder)) { throw "Seeder not found: $Seeder" }
if (-not (Test-Path $PlanPath)) { throw "Dataset plan not found: $PlanPath" }

# ── Prereq: Node ────────────────────────────────────────────────────────────
try {
  $nodeVersion = (& node --version) 2>$null
  if (-not $nodeVersion) { throw }
  Write-Host "  node:     $nodeVersion"
}
catch {
  throw 'Node.js is required but was not found on PATH. Install Node 20+ and retry.'
}

# ── Prereq: Az.Accounts ─────────────────────────────────────────────────────
if (-not (Get-Module -ListAvailable -Name Az.Accounts)) {
  throw @'
The Az.Accounts PowerShell module is required for interactive sign-in.
Install it with:
    Install-Module Az.Accounts -Scope CurrentUser -Repository PSGallery
and rerun this script.
'@
}
Import-Module Az.Accounts -ErrorAction Stop

# ── Normalize env URL ───────────────────────────────────────────────────────
$EnvUrl = $EnvUrl.TrimEnd('/')
if ($EnvUrl -notmatch '^https://[^/]+\.(crm|crm\d+)\.dynamics\.com$') {
  Write-Warning "EnvUrl '$EnvUrl' does not match the typical Dataverse host pattern; proceeding anyway."
}

Write-Host ''
Write-Host "Target environment : $EnvUrl"
Write-Host "Solution           : $SolutionName"
Write-Host "Dataset plan       : $PlanPath"
Write-Host "Mode               : $([bool]$DryRun ? 'DRY RUN' : 'LIVE')"
Write-Host "Auth mode          : $AuthMode"
Write-Host ''

# ── Interactive sign-in ─────────────────────────────────────────────────────
$connectParams = @{}
if ($TenantId)                    { $connectParams.TenantId = $TenantId }
if ($AuthMode -eq 'DeviceCode')   { $connectParams.UseDeviceAuthentication = $true }

$context = Get-AzContext -ErrorAction SilentlyContinue
$needsConnect = -not $context -or ($TenantId -and $context.Tenant.Id -ne $TenantId)
if ($needsConnect) {
  Write-Host 'Signing in to Microsoft Entra ID…'
  Connect-AzAccount @connectParams | Out-Null
  $context = Get-AzContext
}
else {
  Write-Host "Reusing existing Az context for $($context.Account.Id) (tenant $($context.Tenant.Id))."
}

# ── Acquire Dataverse-scoped token ──────────────────────────────────────────
function Get-DataverseToken {
  param([Parameter(Mandatory)][string]$Resource)
  # PS 7 / Az 11+: Get-AzAccessToken returns -AsSecureString by default.
  $t = Get-AzAccessToken -ResourceUrl $Resource -ErrorAction Stop
  if ($t.Token -is [System.Security.SecureString]) {
    return [Net.NetworkCredential]::new('', $t.Token).Password
  }
  return [string]$t.Token
}

try {
  $accessToken = Get-DataverseToken -Resource $EnvUrl
}
catch {
  throw "Failed to acquire Dataverse access token for $EnvUrl. $_"
}

# Decode JWT audience to catch silly mismatches early.
function Read-JwtClaims {
  param([string]$Jwt)
  $parts = $Jwt.Split('.')
  if ($parts.Length -lt 2) { return $null }
  $p = $parts[1].Replace('-', '+').Replace('_', '/')
  switch ($p.Length % 4) { 2 { $p += '==' } 3 { $p += '=' } }
  try { return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p)) | ConvertFrom-Json } catch { return $null }
}
$claims = Read-JwtClaims -Jwt $accessToken
if ($claims) {
  $aud = $claims.aud
  $upn = if ($claims.PSObject.Properties['upn']) { $claims.upn } elseif ($claims.PSObject.Properties['preferred_username']) { $claims.preferred_username } else { $claims.unique_name }
  Write-Host "Signed in as       : $upn"
  Write-Host "Token audience     : $aud"
  if ($aud -and ($aud -notlike "$EnvUrl*") -and ($aud -notlike "$EnvUrl/")) {
    Write-Warning "Token audience '$aud' does not match '$EnvUrl'. Continuing but this usually indicates a tenant/env mismatch."
  }
}

# ── Sanity: WhoAmI ──────────────────────────────────────────────────────────
Write-Host ''
Write-Host 'Verifying connection via WhoAmI…'
try {
  $who = Invoke-RestMethod -Method Get `
    -Uri "$EnvUrl/api/data/v9.2/WhoAmI" `
    -Headers @{
      Authorization      = "Bearer $accessToken"
      Accept             = 'application/json'
      'OData-MaxVersion' = '4.0'
      'OData-Version'    = '4.0'
    }
  Write-Host "  UserId         : $($who.UserId)"
  Write-Host "  BusinessUnitId : $($who.BusinessUnitId)"
  Write-Host "  OrganizationId : $($who.OrganizationId)"
}
catch {
  throw "WhoAmI failed against $EnvUrl. The signed-in user may not have access to this environment. $_"
}

if (-not $DryRun) {
  Write-Host ''
  $confirm = Read-Host "About to seed LIVE data into $EnvUrl. Type 'yes' to proceed"
  if ($confirm -ne 'yes') {
    Write-Host 'Aborted by user.'
    exit 2
  }
}

# ── Build token-refresh command for the Node seeder ─────────────────────────
# The seeder honors DATAVERSE_BEARER_TOKEN_CMD and will re-invoke it every ~30
# minutes so long seeds survive token expiration. The command re-uses the same
# Az context; it runs in a fresh pwsh subprocess with -NoProfile for speed.
$refreshCmd = "pwsh -NoProfile -NonInteractive -Command `"`$ErrorActionPreference='Stop'; `$t = Get-AzAccessToken -ResourceUrl '$EnvUrl'; if (`$t.Token -is [System.Security.SecureString]) { [Net.NetworkCredential]::new('', `$t.Token).Password } else { `$t.Token }`""

# ── Invoke Node seeder ──────────────────────────────────────────────────────
$nodeArgs = @($Seeder, '--env', $EnvUrl, '--solution', $SolutionName, '--plan', $PlanPath)
if ($Phase)   { $nodeArgs += @('--phase', $Phase) }
if ($DryRun)  { $nodeArgs += '--dry' }

Write-Host ''
Write-Host "Invoking: node $($nodeArgs -join ' ')"
Write-Host ''

# Scope env vars to this process only — no persistence.
$env:DATAVERSE_BEARER_TOKEN     = $accessToken
$env:DATAVERSE_BEARER_TOKEN_CMD = $refreshCmd
$env:PP_ENV_TARGET              = $EnvUrl
$env:PP_SOLUTION_NAME           = $SolutionName

try {
  Push-Location $RepoRoot
  & node @nodeArgs
  $code = $LASTEXITCODE
}
finally {
  Pop-Location
  Remove-Item Env:\DATAVERSE_BEARER_TOKEN     -ErrorAction SilentlyContinue
  Remove-Item Env:\DATAVERSE_BEARER_TOKEN_CMD -ErrorAction SilentlyContinue
  Remove-Item Env:\PP_ENV_TARGET              -ErrorAction SilentlyContinue
  Remove-Item Env:\PP_SOLUTION_NAME           -ErrorAction SilentlyContinue
}

if ($code -ne 0) {
  throw "Node seeder exited with code $code."
}

Write-Host ''
Write-Host "Done. Verify the results in the maker portal → $EnvUrl."
