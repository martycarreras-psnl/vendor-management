# Vendor Management

A Power Apps Code App built with React, Fluent UI v9, TanStack Query, and TypeScript.

## Tech Stack

- **React 18** + **TypeScript**
- **Fluent UI v9** — Microsoft's design system
- **TanStack Query** — server state & caching
- **Vite** — build tooling
- **Power Platform connectors** via `@microsoft/power-apps` SDK

## Getting Started

## Recommended Method

1. Plan the workflow and conceptual model.
2. Prototype the UX with mock providers.
3. Capture feedback in dataverse/prototype-feedback.md.
4. Update dataverse/planning-payload.json and rerun npm run prototype:seed.
5. Bind real connectors only when the model is stable.

The initial scaffold intentionally does not ask for connection IDs. When you are ready for real data, run:

```bash
node wizard/index.mjs --from 8
```

That later flow can inspect existing environment connections with `pac connection list` and let you choose one when matches exist.

### Prerequisites

- Node.js 18+
- [PAC CLI](https://learn.microsoft.com/power-platform/developer/cli/introduction) (`dotnet tool install -g Microsoft.PowerApps.CLI.Tool`)
- An authenticated PAC profile (`pac auth list` to verify)

### Development

```bash
npm install
npm run dev:local    # Prototype mode with mock providers
npm run prototype:seed  # Regenerate prototype assets after editing dataverse/planning-payload.json
npm run dev          # Connected mode (Vite + pac code run)
```

### Build & Deploy

```bash
npm run build                     # Build to dist/
~/.dotnet/tools/pac code push     # Deploy to Power Platform
```

The app URL after deployment:
`https://apps.powerapps.com/play/e/{environmentId}/app/{appId}`

## Project Structure

```
vendor management/
├── src/
│   ├── components/        # Reusable UI components
│   ├── pages/             # Route-level pages
│   ├── hooks/             # Custom React hooks
│   ├── generated/         # Auto-generated connector SDK (do not edit)
│   ├── services/          # Provider contracts, mock providers, real adapters
│   ├── mockData/          # Prototype data generated from planning payload
│   ├── types/             # Domain contracts used by the UI
│   └── App.tsx            # Root component
├── .github/instructions/  # GitHub Copilot instruction files
├── .power/                # Power Platform metadata
├── power.config.json      # Code App configuration
├── vite.config.ts         # Build configuration
└── package.json
```

## Power Platform

| Property | Value |
|----------|-------|
| Solution | Vendor Management |
| Publisher Prefix | `rpvms` |

### Environments

| Environment | URL |
|-------------|-----|
| Dev  | https://carremacodeapps.crm.dynamics.com  |

### Connectors

Data sources are managed via Power Platform connectors, but real connector binding is a later step after prototype validation.

Preferred path:

```bash
node wizard/index.mjs --from 8
```

Manual fallback:

```bash
# Add a Dataverse table
~/.dotnet/tools/pac code add-data-source -a dataverse -t rpvms_tablename

# Add a non-Dataverse connector once you know the Connection ID
~/.dotnet/tools/pac code add-data-source -a shared_office365users -c <connection_id>
```

> **Never edit files in `src/generated/`** — PAC refreshes them when connector output is regenerated.

## GitHub Copilot Instructions

This project includes `.github/instructions/*.instructions.md` files that guide GitHub Copilot to generate code following the team's standards. They cover scaffolding, connectors, components, deployment, testing, security, and Dataverse schema design.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run unit tests (Vitest) |
| `npm run lint` | Lint with ESLint |
| `npm run setup:auth` | Create PAC auth profiles from 1Password or .env.local |
| `npm run pac -- <args>` | Run pac with 1Password-injected credentials when using op:// references |
| `npm run validate:schema-plan` | Validate the Dataverse planning artifact before provisioning |
| `npm run generate:dataverse-plan` | Generate normalized Dataverse execution plans from the planning artifact |
| `npm run register:dataverse` | Register planned Dataverse tables with pac code add-data-source and refresh generated connector output |
| `npm run sync:foundations` | Pull latest instruction files, wizard, and scripts from the template repo |

## Staying Updated

This project was created from the **PAppsCAFoundations** template. As the template improves (new instruction files, wizard fixes, security updates), you can pull those updates:

```bash
npm run sync:foundations          # Preview + apply updates
npm run sync:foundations -- --dry-run  # Preview only, no changes
```

This syncs foundation files (`.github/instructions/`, `wizard/`, `scripts/`, `docs/`) without touching your project code (`src/`, `package.json`, `power.config.json`). Changes are shown as a diff before applying.

## Foundations Version

This project includes a `.foundations-version.json` file copied from the template so you can track which bundle version of instructions, wizard logic, and helper scripts the project was scaffolded from.
