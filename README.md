# Vendor Management ("VendIQ")

A Power Apps **Code App** that delivers an enterprise vendor, supplier, contract, and risk management experience on Microsoft Dataverse — built with React 18, TypeScript, Fluent UI v9 + Tailwind, TanStack Query, and the `@microsoft/power-apps` SDK, with an embedded Microsoft Copilot Studio agent for natural-language querying.

---

## What the app does

VendIQ is organized around several functional surfaces, all rendered inside a Power Apps iframe and authenticated by the Power Platform host (Entra ID).

| Surface | Route | Purpose |
|---|---|---|
| **Vendor Portfolio** (landing) | `/` | Four-KPI strip, 30/60/90-day Expiration Radar, Window Breakdown donut, Top Vendors by spend |
| **Vendor Lookup / Vendor 360** | `/vendors`, `/vendors/:id` | Filterable vendor directory plus per-vendor 360° view (contracts, spend, suppliers, risk scores, aliases) |
| **Supplier Lookup / Supplier 360** | `/suppliers`, `/suppliers/:id` | Supplier directory and per-supplier 360° view with vendor relationships, rate cards, product/service catalog |
| **Contract Expiration / Details** | `/contracts`, `/contracts/:id` | Expiring-contract radar with drill-down, parties, lifecycle dates, notice windows |
| **Risk Dashboard** | `/risk` | OneTrust + ServiceNow assessment aggregates cross-referenced with criticality and dependency scores |
| **Chat (Copilot Studio)** | `/chat` | Embedded natural-language agent bound to the vendor schema via the Microsoft Copilot Studio connector |
| **Prompt Suggestions** | `/prompt-suggestions` | Curated prompt library backed by the `rpvms_promptsuggestion` table |
| **Settings** | `/settings` | Theme, connectivity status, current user + roles |

Cross-cutting UI: criticality pills (levels 1–5), connectivity pill, filter rail / sidebar / bar, adjust-criticality dialog, reusable KPI card, TanStack-Table data grid, and Recharts-based radar / donut / treemap visualizations.

---

## Architecture

### Three-layer separation

- **Components** (`src/components/`) — Presentational only. A `vendiq/` folder of domain components and a `ui/` folder of Radix + Tailwind primitives (shadcn-style) living alongside Fluent UI v9.
- **Hooks** (`src/hooks/vendiq/`) — Orchestration: `use-portfolio-dataset`, `use-portfolio-filters`, `use-current-user-roles`, `use-connectivity`. Hooks call the provider via context and return TanStack Query state.
- **Services / Providers** (`src/services/vendiq/`) — Contracts (`contracts.ts`), a mock provider for offline/prototype work, a Dataverse adapter that wraps the generated services, and a Copilot Studio provider. The active provider is selected by `VITE_USE_MOCK` and injected through `VendiqProvider` / `useVendiq()`.
- **Generated SDK** (`src/generated/`) — Produced by `pac code add-data-source`. **Never edited by hand.** Wrapped by the adapters above.

### Data layer

Dataverse solution **`VendorManagement`**, publisher prefix **`rpvms_`**, choice value base **`412900000`**. 13 tables are deployed, registered as Code App data sources, and surfaced through the generated services:

```
rpvms_vendor              rpvms_vendorscore          rpvms_onetrustassessment
rpvms_supplier            rpvms_vendorbudget         rpvms_servicenowassessment
rpvms_vendorsupplier      rpvms_vendorratecard       rpvms_promptsuggestion
rpvms_contract            rpvms_vendorproductservice rpvms_vpvendorassignment
rpvms_contractparty       rpvms_vendornamealias      rpvms_gltransaction
```

Plus **`systemuser`** for owner resolution and two non-Dataverse connectors: **Office 365 Users** and **Microsoft Copilot Studio**. The canonical schema spec lives in [`dataverse/planning-payload.json`](dataverse/planning-payload.json).

### Connector references (`power.config.json`)

| Kind | Identifier |
|---|---|
| Dataverse database reference | `default.cds` — 13 `rpvms_*` tables + `systemuser` |
| Connection reference | `shared_office365users` — Office 365 Users |
| Connection reference | `shared_microsoftcopilotstudio` — Microsoft Copilot Studio |

### Routing

Hash router (`createHashRouter`) so refreshes survive inside the Power Apps iframe, which does not serve SPA fallback for non-root paths.

---

## Getting started

### Prerequisites

- Node.js 18+
- [PAC CLI](https://learn.microsoft.com/power-platform/developer/cli/introduction) (`dotnet tool install -g Microsoft.PowerApps.CLI.Tool`)
- An authenticated PAC profile bound to the target environment (`pac auth list`)

### Install + run

```bash
npm install
npm run dev:local    # Prototype mode — mock provider, no Power Platform connection
npm run dev          # Connected mode — Vite + `pac code run` in parallel
```

### Build + deploy

```bash
npm run build                          # typecheck + vite build → dist/
npm run deploy                         # guarded `pac code push` (SPN profile, dev target)
# or manually:
~/.dotnet/tools/pac code push
```

After deployment the app is available at:

```
https://apps.powerapps.com/play/e/{environmentId}/app/{appId}
```

---

## Project layout

```
vendor-management/
├── src/
│   ├── components/
│   │   ├── vendiq/              # Domain components (radar, donut, KPIs, filters, grid, pills)
│   │   └── ui/                  # Radix + Tailwind primitives
│   ├── pages/                   # Route-level pages (portfolio, vendor-360, chat, …)
│   ├── hooks/vendiq/            # Dataset + filter + connectivity orchestration
│   ├── services/
│   │   └── vendiq/              # Provider contracts, mock, Dataverse, Copilot adapters
│   ├── generated/               # pac-generated SDK (read-only)
│   ├── mockData/                # Prototype fixtures
│   ├── types/                   # Domain model types
│   ├── router.tsx               # Hash router
│   └── App.tsx
├── dataverse/
│   ├── planning-payload.json    # Canonical schema + option set spec
│   ├── provision-*.plan.json    # Generated execution plans
│   ├── register-datasources.plan.json
│   └── seed-data/               # Seed fixtures for dev environment
├── fabric/                      # Handoff package for the Fabric ingestion team
│   ├── dataverse-spec/
│   ├── gold/                    # Reference Gold SQL views
│   ├── reference/               # Option-set lookup patterns
│   └── samples/
├── handoff/vendor-management-seed/  # Portable seed bundle for other environments
├── scripts/                     # Schema provisioning, auth, seeding, fabric mapping
├── solution/                    # Exported solution artifacts
├── .github/instructions/        # Copilot instruction files
├── power.config.json            # Code App manifest (connections + database refs)
├── vite.config.ts
└── package.json
```

---

## Schema + data lifecycle

The canonical source of truth is [`dataverse/planning-payload.json`](dataverse/planning-payload.json). Scripts in [`scripts/`](scripts/) translate it into execution plans, provision Dataverse, and register the data sources with the Code App.

| Script | Purpose |
|---|---|
| `npm run validate:schema-plan` | Validate the planning payload before any write |
| `npm run generate:dataverse-plan` | Emit `provision-tables`, `provision-relationships`, and `register-datasources` plan files |
| `npm run schema:provision` | Create/update tables, columns, option sets, relationships in Dataverse |
| `npm run schema:provision:dry` | Same, dry-run |
| `npm run register:dataverse` | `pac code add-data-source` for each planned table and regenerate `src/generated/` |
| `npm run schema:import` | Rebuild the planning payload from `VendorDataModel_Dataverse_Spec.xlsx` |
| `npm run prototype:seed` | Regenerate `src/mockData/` from the planning payload for offline UX work |
| `npm run fabric:map` | Produce the Fabric source→target mapping workbook in `fabric/mapping/` |

Seed + operational utilities:

- `scripts/generate-sample-data.mjs` — synthetic vendor/supplier/contract fixtures
- `scripts/seed-dataverse-data.mjs` / `.ps1` — bulk upsert into a target environment
- `scripts/enable-table-auditing.mjs` — switch on Dataverse auditing per table
- `scripts/export-solution.mjs` — export managed/unmanaged solution artifacts
- `scripts/discover-copilot-connection.mjs` — resolve the Copilot Studio connection ID for a target environment

---

## Fabric handoff

[`fabric/README.md`](fabric/README.md) is the entry point for the Microsoft Fabric engineering team. It contains the target schema, 13 Gold SQL view conventions, option-set lookup pattern, and the source→target column mapping workbook. Dataverse is already provisioned and seeded; the Fabric pipeline is expected to upsert into `rpvms_*` via Dataflow Gen2.

---

## Power Platform

| Property | Value |
|---|---|
| Solution | **VendorManagement** |
| Publisher prefix | `rpvms_` |
| Choice value base | `412900000` |
| App display name | Vendor Management |
| App ID | `81f55faf-3c2c-4b62-aaeb-62991b2dc5f0` |
| Region | `prod` |

### Environments

| Environment | URL |
|---|---|
| Dev | https://carremacodeapps.crm.dynamics.com |

---

## Scripts reference

| Command | Description |
|---|---|
| `npm run dev` | Vite + `pac code run` (connected) |
| `npm run dev:local` | Vite with mock provider (`VITE_USE_MOCK=true`) |
| `npm run build` | `tsc --noEmit` + `vite build` to `dist/` |
| `npm run preview` | Preview the production bundle |
| `npm run deploy` | Guarded `pac code push` to the dev environment |
| `npm run lint` | ESLint, zero-warning gate |
| `npm run test` / `test:watch` / `test:smoke` | Vitest |
| `npm run test:e2e` | Playwright |
| `npm run format` | Prettier across `src/` |
| `npm run setup:auth` | Create PAC auth profiles from 1Password or `.env.local` |
| `npm run pac -- <args>` | Run `pac` with 1Password-injected credentials |
| `npm run validate:schema-plan` | Validate the Dataverse planning artifact |
| `npm run generate:dataverse-plan` | Generate normalized execution plans |
| `npm run schema:provision` / `:dry` | Provision Dataverse tables, columns, relationships, option sets |
| `npm run register:dataverse` | Register Dataverse tables as Code App data sources |
| `npm run schema:import` | Rebuild planning payload from the Excel spec |
| `npm run solution:export` / `:unmanaged` | Export the solution |
| `npm run fabric:map` | Produce the Fabric source→target mapping |
| `npm run prototype:seed` | Regenerate mock data from the planning payload |
| `npm run sync:foundations` | Pull latest instruction files, wizard, and scripts from the template |

---

## Testing

- **Unit / component** — Vitest + Testing Library (`src/**/*.test.ts[x]`, `src/App.test.tsx` smoke test)
- **End-to-end** — Playwright (`tests/e2e/`, configured in `playwright.config.ts`)

---

## Copilot + instruction set

`.github/instructions/*.instructions.md` are loaded by GitHub Copilot to keep generated code aligned with the Code App rules: solution-first schema, three-layer architecture, adapters over generated services, hash routing, port 3000, relative build base, no raw GUIDs in UI. See also [`AGENTS.md`](AGENTS.md) for the non-negotiable agent guardrails.

---

## Staying updated

This project was scaffolded from the **PAppsCAFoundations** template. Pull foundation updates without touching project code:

```bash
npm run sync:foundations -- --dry-run   # preview
npm run sync:foundations                # apply
```

The `.foundations-version.json` file records the template bundle version the project currently tracks.
