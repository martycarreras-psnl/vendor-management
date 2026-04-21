// Idempotent Dataverse seed loader.
// Reads dataverse/seed-data/dataset.plan.json and upserts each record by
// natural key (primary-name column). Caches created IDs so that later rows can
// bind their lookup fields via @odata.bind.
//
// Flags:
//   --dry       print planned operations, do not write
//   --plan <p>  override dataset plan path (default: dataverse/seed-data/dataset.plan.json)
//   --phase <n> only run specific phases (comma-separated indices, 1-based)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadState, resolveSecret, createClient } from './lib/dataverse-client.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(__filename), '..');

// ── Args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const DRY = args.includes('--dry');
const PLAN_PATH = argVal('--plan') || path.join(REPO, 'dataverse', 'seed-data', 'dataset.plan.json');
const ENV_OVERRIDE = argVal('--env');
const SOLUTION_OVERRIDE = argVal('--solution');
const PHASES = argVal('--phase')
  ? new Set(argVal('--phase').split(',').map((s) => parseInt(s.trim(), 10)))
  : null;

const dataset = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));

// ── Mapping ────────────────────────────────────────────────────────────────
// Each phase: { name, records, entitySet, primaryName, lookups:{field:entitySet} }
const phases = [
  {
    name: 'Vendors',
    records: dataset.vendors,
    entitySet: 'rpvms_vendors',
    primaryName: 'rpvms_vendorname',
    lookups: {},
  },
  {
    name: 'Suppliers',
    records: dataset.suppliers,
    entitySet: 'rpvms_suppliers',
    primaryName: 'rpvms_suppliername',
    lookups: {},
  },
  {
    name: 'Vendor↔Supplier relationships',
    records: dataset.vendorSuppliers,
    entitySet: 'rpvms_vendorsuppliers',
    primaryName: 'rpvms_vendorsuppliername',
    lookups: { _vendor: { bind: 'rpvms_VendorId', to: 'rpvms_vendors' }, _supplier: { bind: 'rpvms_SupplierId', to: 'rpvms_suppliers' } },
  },
  {
    name: 'Vendor products & services',
    records: dataset.vendorProductServices,
    entitySet: 'rpvms_vendorproductservices',
    primaryName: 'rpvms_vendorproductservicename',
    lookups: { _vendor: { bind: 'rpvms_VendorId', to: 'rpvms_vendors' } },
  },
  {
    name: 'Vendor name aliases',
    records: dataset.vendorNameAliases,
    entitySet: 'rpvms_vendornamealiases',
    primaryName: 'rpvms_vendornamealiasname',
    lookups: { _vendor: { bind: 'rpvms_VendorId', to: 'rpvms_vendors' } },
  },
  {
    name: 'Contracts',
    records: dataset.contracts,
    entitySet: 'rpvms_contracts',
    primaryName: 'rpvms_contractname',
    lookups: { _supplier: { bind: 'rpvms_SupplierId', to: 'rpvms_suppliers' } },
  },
  {
    name: 'Contract parties',
    records: dataset.contractParties,
    entitySet: 'rpvms_contractparties',
    primaryName: 'rpvms_contractpartyname',
    lookups: {
      _contract: { bind: 'rpvms_ContractId', to: 'rpvms_contracts' },
      _vendor: { bind: 'rpvms_VendorId', to: 'rpvms_vendors', optional: true },
      _supplier: { bind: 'rpvms_SupplierId', to: 'rpvms_suppliers', optional: true },
    },
  },
  {
    name: 'GL transactions',
    records: dataset.glTransactions,
    entitySet: 'rpvms_gltransactions',
    primaryName: 'rpvms_gltransactionname',
    lookups: { _supplier: { bind: 'rpvms_SupplierId', to: 'rpvms_suppliers' } },
  },
  {
    name: 'OneTrust assessments',
    records: dataset.oneTrust,
    entitySet: 'rpvms_onetrustassessments',
    primaryName: 'rpvms_onetrustassessmentname',
    lookups: { _vendor: { bind: 'rpvms_VendorId', to: 'rpvms_vendors' } },
  },
  {
    name: 'ServiceNow assessments',
    records: dataset.serviceNow,
    entitySet: 'rpvms_servicenowassessments',
    primaryName: 'rpvms_servicenowassessmentname',
    lookups: { _vendor: { bind: 'rpvms_VendorId', to: 'rpvms_vendors' } },
  },
  {
    name: 'Vendor scores',
    records: dataset.vendorScores,
    entitySet: 'rpvms_vendorscores',
    primaryName: 'rpvms_vendorscorename',
    lookups: { _vendor: { bind: 'rpvms_VendorId', to: 'rpvms_vendors' } },
  },
  {
    name: 'Vendor budgets',
    records: dataset.vendorBudgets,
    entitySet: 'rpvms_vendorbudgets',
    primaryName: 'rpvms_vendorbudgetname',
    lookups: { _vendor: { bind: 'rpvms_VendorId', to: 'rpvms_vendors' } },
  },
  {
    name: 'Vendor rate cards',
    records: dataset.vendorRateCards,
    entitySet: 'rpvms_vendorratecards',
    primaryName: 'rpvms_vendorratecardname',
    lookups: { _vendor: { bind: 'rpvms_VendorId', to: 'rpvms_vendors' } },
  },
];

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  // Propagate CLI overrides into env vars BEFORE loadState, so that running
  // without a .wizard-state.json (e.g. the handoff package) works when the
  // caller supplies --env / --solution.
  if (ENV_OVERRIDE) process.env.PP_ENV_TARGET = ENV_OVERRIDE;
  if (SOLUTION_OVERRIDE) process.env.PP_SOLUTION_NAME = SOLUTION_OVERRIDE;

  const state = loadState();
  if (ENV_OVERRIDE) state.PP_ENV_DEV = ENV_OVERRIDE;
  if (SOLUTION_OVERRIDE) state.SOLUTION_UNIQUE_NAME = SOLUTION_OVERRIDE;
  const authMode = process.env.DATAVERSE_BEARER_TOKEN_CMD
    ? 'bearer (refreshable via DATAVERSE_BEARER_TOKEN_CMD)'
    : process.env.DATAVERSE_BEARER_TOKEN
      ? 'bearer (DATAVERSE_BEARER_TOKEN)'
      : 'service principal (client credentials)';
  console.log(`Seeding Dataverse sample data`);
  console.log(`  env:      ${state.PP_ENV_DEV}`);
  console.log(`  solution: ${state.SOLUTION_UNIQUE_NAME}`);
  console.log(`  plan:     ${PLAN_PATH}`);
  console.log(`  auth:     ${authMode}`);
  console.log(`  mode:     ${DRY ? 'DRY RUN' : 'LIVE'}\n`);

  const client = DRY ? null : createClient(state, resolveSecret(state), { solutionName: state.SOLUTION_UNIQUE_NAME });

  // nk → guid map, grouped by entitySet
  const idCache = {};

  const summary = [];
  for (let idx = 0; idx < phases.length; idx++) {
    if (PHASES && !PHASES.has(idx + 1)) continue;
    const p = phases[idx];
    const phaseNum = idx + 1;
    console.log(`\nPhase ${phaseNum} — ${p.name} (${p.records.length})`);
    let created = 0;
    let skipped = 0;
    let errors = 0;
    idCache[p.entitySet] = idCache[p.entitySet] || {};

    // Pre-fetch existing records for this entity by primaryName so we can skip.
    if (!DRY) {
      const singular = p.entitySet.endsWith('ies')
        ? p.entitySet.slice(0, -3) + 'y'
        : p.entitySet.replace(/s$/, '');
      const pkField = `${singular}id`;
      try {
        let next = `${p.entitySet}?$select=${p.primaryName}&$top=5000`;
        while (next) {
          const r = await client.get(next);
          if (!r || r._notFound) break;
          for (const row of r.value || []) {
            const name = row[p.primaryName];
            const id = row[pkField];
            if (name && id) idCache[p.entitySet][slug(name)] = id;
          }
          next = r['@odata.nextLink']
            ? r['@odata.nextLink'].replace(/^.*\/api\/data\/v9\.2\//, '')
            : null;
        }
      } catch (e) {
        console.log(`  ! pre-fetch failed (${String(e.message || e).slice(0, 80)}) — will discover during upsert`);
      }
    }

    for (const rec of p.records) {
      const primary = rec[p.primaryName];
      // Use the record's own _nk when available (generator-supplied slug) so
      // downstream lookups can resolve to it; fall back to slugified primary.
      const cacheKey = rec._nk || slug(primary);
      if (idCache[p.entitySet][cacheKey]) {
        skipped++;
        continue;
      }

      // Build body (strip internal `_*` fields, resolve lookups).
      const body = {};
      for (const [k, v] of Object.entries(rec)) {
        if (k.startsWith('_')) continue;
        body[k] = v;
      }
      let skipRecord = false;
      for (const [srcKey, spec] of Object.entries(p.lookups || {})) {
        const srcNk = rec[srcKey];
        if (!srcNk) {
          if (spec.optional) continue;
          console.log(`  ! ${primary}: missing required lookup ${srcKey}`);
          skipRecord = true;
          break;
        }
        const targetId = idCache[spec.to]?.[srcNk];
        if (!targetId) {
          if (spec.optional) continue;
          console.log(`  ! ${primary}: unresolved lookup ${srcKey}=${srcNk} (${spec.to})`);
          skipRecord = true;
          break;
        }
        body[`${spec.bind}@odata.bind`] = `/${spec.to}(${targetId})`;
      }
      if (skipRecord) {
        errors++;
        continue;
      }

      if (DRY) {
        // simulate creation so downstream lookups resolve
        idCache[p.entitySet][cacheKey] = `dry-${p.entitySet}-${created}`;
        created++;
        continue;
      }

      try {
        const res = await client.post(p.entitySet, body);
        // PK logical name is the entity's singular logical name + "id", e.g.
        // rpvms_suppliers → rpvms_supplierid. Fall back to scanning.
        const singular = p.entitySet.endsWith('ies')
          ? p.entitySet.slice(0, -3) + 'y'
          : p.entitySet.replace(/s$/, '');
        const pkField = `${singular}id`;
        const id = res?.[pkField]
          || Object.values(res || {}).find((v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
        if (id) idCache[p.entitySet][cacheKey] = id;
        created++;
        if (created % 50 === 0) process.stdout.write(`  … ${created} created\n`);
      } catch (e) {
        errors++;
        console.log(`  ✗ ${primary}: ${String(e.message || e).slice(0, 160)}`);
        if (errors > 5 && created === 0) {
          throw new Error(`Too many failures in phase ${p.name} — aborting.`);
        }
      }
    }
    console.log(`  created=${created} skipped=${skipped} errors=${errors}`);
    summary.push({ phase: p.name, created, skipped, errors });
  }

  console.log('\nSummary');
  console.table(summary);

  if (!DRY) {
    console.log('\nPublishing all customizations…');
    const ok = await client.publishAll();
    console.log(ok ? '✓ published' : '! publish did not confirm — data is still persisted; you can click Publish in the maker UI.');
  }
}

function nk(s) {
  return String(s || '').toLowerCase().trim();
}

// Slugify a display name the same way generate-sample-data.mjs does, so that
// `_nk` values on referencing records align with cache keys built from
// pre-fetched primary-name columns (e.g. "Change Healthcare" → "change-healthcare").
function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

main().catch((e) => {
  console.error(`\nseed-dataverse-data: ${e.message}`);
  process.exit(1);
});
