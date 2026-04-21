# Vendor Management — Dataverse Sample Data Seeder

This package seeds the Vendor Management sample dataset into a Dataverse environment using your Microsoft Entra ID identity. You sign in interactively in PowerShell; no client secrets are needed.

---

## What this does

Creates (idempotently) **13 phases** of sample records — vendors, suppliers, vendor↔supplier relationships, vendor products & services, vendor name aliases, contracts, contract parties, GL transactions, OneTrust assessments, ServiceNow assessments, vendor scores, vendor budgets, and vendor rate cards — and publishes customizations when finished.

- Re-running the script is **safe**: records that already exist (matched by primary name) are skipped.
- You can re-run a **subset of phases** with `-Phase "1,2"`.
- You can **dry-run** first with `-DryRun` to see what would be created without writing anything.

---

## Prerequisites on the machine that will run this

1. **PowerShell 7 or later** — check with `$PSVersionTable.PSVersion`. Download: https://aka.ms/powershell
2. **Node.js 20 or later** — check with `node --version`. Download: https://nodejs.org/
3. **`Az.Accounts` PowerShell module** — install once:
   ```powershell
   Install-Module Az.Accounts -Scope CurrentUser -Repository PSGallery
   ```

No other dependencies. No `npm install`. The Node seeder uses only Node built-ins.

---

## Prerequisites in the target Dataverse environment

Before running the script, confirm with whoever owns the environment that:

1. **The `VendorManagement` solution is already imported.** All `rpvms_*` tables, columns, option sets, and relationships must exist. This script seeds data; it does **not** provision schema.
2. **You (the person running the script) have a security role** in that environment with **create** and **write** privileges on every `rpvms_*` table. The simplest choice is **System Administrator** for the initial seed.
3. You know the environment's base URL. It looks like `https://<something>.crm.dynamics.com` (region-specific hosts like `crm3`, `crm4` etc. are also valid). Get it from the Power Platform Admin Center → Environments → your environment → "Environment URL".
4. You know the **Tenant ID** (Entra ID directory GUID). Get it from https://entra.microsoft.com → Overview, or ask your admin.

---

## Files in this package

```
vendor-management-seed/
├── README.md                           ← this file
├── seed.ps1                            ← entry point you run
├── scripts/
│   ├── seed-dataverse-data.mjs         ← Node seeder (do not edit)
│   └── lib/
│       └── dataverse-client.mjs        ← Dataverse Web API client
└── dataset/
    └── dataset.plan.json               ← the sample data (~750 KB)
```

You do not need to open or edit any of these files. You only run `seed.ps1`.

---

## How to run

Open PowerShell 7 and `cd` into the `vendor-management-seed` folder.

### Step 1 — Dry run (no data is written)

```powershell
pwsh ./seed.ps1 `
    -EnvUrl    https://<your-env>.crm.dynamics.com `
    -TenantId  <your-tenant-guid> `
    -DryRun
```

The script will:
1. Check Node and `Az.Accounts` are available.
2. Pop up a browser (or show a device-code prompt) for Entra ID sign-in.
3. Acquire a Dataverse token, decode it, print your `upn` and token `aud`.
4. Call `/WhoAmI` against the env and print your `UserId` + `OrganizationId`.
5. Simulate all 11 phases and show a summary table.

If any of those steps fail, **stop** and follow the troubleshooting section below. Do not proceed to the live run.

### Step 2 — Live run

Same command, without `-DryRun`:

```powershell
pwsh ./seed.ps1 `
    -EnvUrl    https://<your-env>.crm.dynamics.com `
    -TenantId  <your-tenant-guid>
```

The script will:
1. Repeat the sign-in + WhoAmI checks.
2. Prompt you to type `yes` to confirm you really want to write to this env.
3. Run all phases, creating records and resolving lookup bindings as it goes.
4. Print a final summary and call `PublishAllXml` to publish customizations.

A full seed typically completes in 5–15 minutes depending on network latency.

### Optional: run only specific phases

Phases are 1-based, in the order they appear in the summary:

| # | Phase |
|---|---|
| 1 | Vendors |
| 2 | Suppliers |
| 3 | Vendor↔Supplier relationships |
| 4 | Vendor products & services |
| 5 | Vendor name aliases |
| 6 | Contracts |
| 7 | Contract parties |
| 8 | GL transactions |
| 9 | OneTrust assessments |
| 10 | ServiceNow assessments |
| 11 | Vendor scores |
| 12 | Vendor budgets |
| 13 | Vendor rate cards |

Example — run only vendors and suppliers:
```powershell
pwsh ./seed.ps1 -EnvUrl https://<env>.crm.dynamics.com -Phase "1,2"
```

> **Important:** phases 3+ depend on 1–2 (or earlier phases) for their lookups. Always run from phase 1 the first time.

### Optional: device-code sign-in

If the machine has no browser (remote server, SSH session, etc.):

```powershell
pwsh ./seed.ps1 -EnvUrl https://<env>.crm.dynamics.com -AuthMode DeviceCode
```

PowerShell will print a URL + one-time code; open them on any other device to sign in.

---

## What success looks like

At the end of a live run you should see output similar to:

```
Summary
┌─────────┬──────────────────────────────────┬─────────┬─────────┬────────┐
│ (index) │              phase               │ created │ skipped │ errors │
├─────────┼──────────────────────────────────┼─────────┼─────────┼────────┤
│    0    │            'Vendors'             │   32    │    0    │   0    │
│    1    │           'Suppliers'            │   15    │    0    │   0    │
│   …     │              …                   │   …     │   …     │   …    │
└─────────┴──────────────────────────────────┴─────────┴─────────┴────────┘

Publishing all customizations…
✓ published

Done. Verify the results in the maker portal → https://<env>.crm.dynamics.com.
```

Then go to https://make.powerapps.com, pick the target env, open the VendorManagement solution, and confirm the tables contain the expected records. Spot-check one contract record to confirm its **Vendor** and **Supplier** lookups are populated correctly.

### Re-running on a populated env

The second run's summary should show `skipped` equal to the previous run's `created` counts and `created = 0`. That proves idempotency. If instead you see new records being created on a re-run, stop and investigate — the primary name field on some record may be diverging.

---

## Troubleshooting

### "Node.js 20+ is required but was not found on PATH"
Install Node 20+ from https://nodejs.org/ and open a new PowerShell window.

### "The Az.Accounts PowerShell module is required"
```powershell
Install-Module Az.Accounts -Scope CurrentUser -Repository PSGallery
```
If you hit a repository-trust prompt, answer `Y`.

### Sign-in succeeds but WhoAmI returns 401 or 403
You signed in to the wrong tenant, or your account has no privileges in that env. Fixes:
1. Close the window and re-run with the correct `-TenantId`.
2. Ask an environment admin to assign you **System Administrator** (or an equivalent custom role with create/write on `rpvms_*` tables) in the target env.
3. Confirm you can open the env in the maker portal at https://make.powerapps.com and see the `VendorManagement` solution.

### "Token audience 'xxx' does not match 'https://...'"
You signed in to a different tenant than the env lives in. Sign out and back in with the right tenant:
```powershell
Disconnect-AzAccount
pwsh ./seed.ps1 -EnvUrl https://<env>.crm.dynamics.com -TenantId <correct-tenant-guid>
```

### A phase shows errors like `unresolved lookup _vendor=...`
This usually means you ran a later phase before its dependency. Re-run without `-Phase` (or include every earlier phase). Records that were already created will be skipped.

### A phase shows HTTP 403 errors during create
Your security role lacks **Create** on that specific table. Ask the env admin to widen your role, then re-run — created records will be skipped and the failed ones will be retried.

### The run aborted mid-seed
Just re-run the same command. The seeder pre-fetches existing records by primary name and skips them, so you can safely resume.

### `Get-AzAccessToken` throws about `SecureString`
You are on an older `Az.Accounts` version. Update it:
```powershell
Update-Module Az.Accounts
```

---

## Security notes

- The script never writes your access token to disk.
- The token lives only in environment variables scoped to the running process and is scrubbed in a `finally` block when the script exits (even on error).
- No client secret or application credential is embedded in this package.
- The `dataset.plan.json` file contains **synthetic test data only** — fictional vendor/supplier names, randomly generated IDs, etc. It is safe to share.

---

## Questions / issues

Contact the sender of this package. Please include:
- The full PowerShell console output (redact any UPNs/tenant IDs if you wish).
- The env URL you targeted.
- Whether you ran a dry run or live run, and which phases.
