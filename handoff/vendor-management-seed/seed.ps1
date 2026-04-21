#Requires -Version 7.0
<#
.SYNOPSIS
  Seed Vendor Management sample data into a Dataverse environment using an
  interactive Microsoft Entra ID sign-in.

.DESCRIPTION
  Wrapper around scripts/seed-dataverse-data.mjs. Prompts the operator to sign
  in to Entra ID, acquires a Dataverse access token for the target env,
  verifies identity with WhoAmI, then runs the Node seeder with that token.

  The target environment MUST already have the VendorManagement solution
  imported (tables, columns, option sets, relationships). The signed-in user
  MUST hold a security role with create/write privileges on every rpvms_*
  table (System Administrator is safest for the initial seed).

.PARAMETER EnvUrl
  Target Dataverse env base URL, e.g. https://contoso-test.crm.dynamics.com

.PARAMETER TenantId
  Entra ID tenant GUID. Optional if you are already signed in to the correct
  tenant via Connect-AzAccount.

.PARAMETER SolutionName
  Dataverse solution unique name. Default: VendorManagement

.PARAMETER PlanPath
  Override the dataset plan path. Default: dataset/dataset.plan.json

.PARAMETER Phase
  Optional comma-separated 1-based phase indices (e.g. "1,2,3"). When omitted,
  all phases run.

.PARAMETER DryRun
  Simulate without writing to Dataverse.

.PARAMETER AuthMode
  Interactive (default, opens browser) or DeviceCode (for headless machines).

.EXAMPLE
  pwsh ./seed.ps1 -EnvUrl https://contoso-test.crm.dynamics.com -DryRun

.EXAMPLE
  pwsh ./seed.ps1 -EnvUrl https://contoso-test.crm.dynamics.com -TenantId 11111111-2222-3333-4444-555555555555
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
$HandoffRoot = Split-Path -Parent $PSCommandPath
$Seeder      = Join-Path $HandoffRoot 'scripts/seed-dataverse-data.mjs'
if (-not $PlanPath) { $PlanPath = Join-Path $HandoffRoot 'dataset/dataset.plan.json' }

if (-not (Test-Path $Seeder)) { throw "Seeder not found: $Seeder" }
if (-not (Test-Path $PlanPath)) { throw "Dataset plan not found: $PlanPath" }

# ── Prereq: Node ────────────────────────────────────────────────────────────
try {
  $nodeVersion = (& node --version) 2>$null
  if (-not $nodeVersion) { throw }
  Write-Host "  node:     $nodeVersion"
}
catch {
  throw 'Node.js 20+ is required but was not found on PATH. Install from https://nodejs.org/ and retry.'
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
if ($TenantId)                  { $connectParams.TenantId = $TenantId }
if ($AuthMode -eq 'DeviceCode') { $connectParams.UseDeviceAuthentication = $true }

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
  throw "WhoAmI failed against $EnvUrl. The signed-in user may not have access to this environment, or the URL is wrong. $_"
}

if (-not $DryRun) {
  Write-Host ''
  $confirm = Read-Host "About to seed LIVE data into $EnvUrl. Type 'yes' to proceed"
  if ($confirm -ne 'yes') {
    Write-Host 'Aborted by user.'
    exit 2
  }
}

# ── Token refresh command for the Node seeder (long-seed safety) ────────────
$refreshCmd = "pwsh -NoProfile -NonInteractive -Command `"`$ErrorActionPreference='Stop'; `$t = Get-AzAccessToken -ResourceUrl '$EnvUrl'; if (`$t.Token -is [System.Security.SecureString]) { [Net.NetworkCredential]::new('', `$t.Token).Password } else { `$t.Token }`""

# ── Invoke Node seeder ──────────────────────────────────────────────────────
$nodeArgs = @($Seeder, '--env', $EnvUrl, '--solution', $SolutionName, '--plan', $PlanPath)
if ($Phase)  { $nodeArgs += @('--phase', $Phase) }
if ($DryRun) { $nodeArgs += '--dry' }

Write-Host ''
Write-Host "Invoking: node $($nodeArgs -join ' ')"
Write-Host ''

$env:DATAVERSE_BEARER_TOKEN     = $accessToken
$env:DATAVERSE_BEARER_TOKEN_CMD = $refreshCmd
$env:PP_ENV_TARGET              = $EnvUrl
$env:PP_SOLUTION_NAME           = $SolutionName

try {
  Push-Location $HandoffRoot
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
