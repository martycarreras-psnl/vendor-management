#!/usr/bin/env node
// Convert the Vendor Data Model xlsx spec into a schema planning payload
// (dataverse/planning-payload.json) that validates and can be handed to
// scripts/generate-dataverse-plan.mjs.
//
// Rules:
//   - All schemaName / logicalName tokens are normalized to the rpvms_ prefix.
//   - Global option set names (gos_Foo in the workbook) become rpvms_<lower>.
//   - UniqueId columns are skipped; Dataverse creates <logicalname>id as the PK.
//   - The table's primary-name column is emitted as table.primaryName
//     and NOT duplicated inside columns[].
//   - Lookup columns are promoted into relationships[].
//     The lookup attribute is auto-created by Dataverse when the M:1 relationship
//     is created, so we do not emit it in columns[].
//
// Usage:
//   node scripts/import-schema-from-xlsx.mjs <workbook.xlsx> <output.json>

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as XLSX from 'xlsx';

const PREFIX = 'rpvms';
const DEFAULT_WORKBOOK = 'dataverse/VendorDataModel_Dataverse_Spec.xlsx';
const DEFAULT_OUTPUT = 'dataverse/planning-payload.json';
const WIZARD_STATE = '.wizard-state.json';

function readChoiceValueBase() {
  try {
    const state = JSON.parse(fs.readFileSync(WIZARD_STATE, 'utf8'));
    const prefix = String(state.CHOICE_VALUE_PREFIX || '').trim();
    if (/^\d{4,6}$/.test(prefix)) return Number(prefix) * 10000;
  } catch { /* ignore */ }
  return 100000000;
}

const CHOICE_VALUE_BASE = readChoiceValueBase();

function die(msg) {
  console.error(`schema-import: ${msg}`);
  process.exit(1);
}

function toLowerId(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function singular(tableName) {
  return `${PREFIX}_${toLowerId(tableName)}`;
}

// Irregular plurals in this workbook
const PLURAL_OVERRIDES = {
  VendorNameAlias: 'vendornamealiases',
  ContractParty: 'contractparties',
  VendorProductService: 'vendorproductservices',
};

function plural(tableName) {
  if (PLURAL_OVERRIDES[tableName]) return `${PREFIX}_${PLURAL_OVERRIDES[tableName]}`;
  const base = toLowerId(tableName);
  if (base.endsWith('s')) return `${PREFIX}_${base}es`;
  if (base.endsWith('y')) return `${PREFIX}_${base.slice(0, -1)}ies`;
  return `${PREFIX}_${base}s`;
}

function mixedSchemaName(name) {
  // Preserve PascalCase from workbook after prefix.
  const token = String(name || '').trim().replace(/[^A-Za-z0-9]/g, '');
  if (!token) die(`empty schema name`);
  return `${PREFIX}_${token[0].toUpperCase()}${token.slice(1)}`;
}

function optionSetName(raw) {
  // "gos_CommercialRole" -> "rpvms_commercialrole"
  const cleaned = String(raw || '').replace(/^\*?\s*/, '').trim();
  const noPrefix = cleaned.replace(/^gos_/i, '');
  return `${PREFIX}_${toLowerId(noPrefix)}`;
}

// ── Workbook loading ───────────────────────────────────────────────────────
function loadSheet(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) die(`missing sheet "${name}"`);
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
}

// ── Column type mapping ────────────────────────────────────────────────────
function columnTypeFor(row, columnContext) {
  const t = String(row['Data Type'] || '').trim();
  const maxLen = row['Max Length'] ? Number(row['Max Length']) : undefined;
  const required = String(row['Required'] || '').trim().toLowerCase() === 'yes';
  const requiredLevel = required ? 'ApplicationRequired' : 'None';
  const base = { displayName: row['Display Name'], requiredLevel };
  if (row['Notes']) base.description = row['Notes'];

  switch (t) {
    case 'Text':
      return { ...base, type: 'String', format: 'Text', maxLength: maxLen ?? 100 };
    case 'Memo':
      return { ...base, type: 'Memo', maxLength: maxLen ?? 2000 };
    case 'WholeNumber':
      return { ...base, type: 'Integer' };
    case 'Decimal':
      return { ...base, type: 'Decimal', precision: 4 };
    case 'Currency':
      return { ...base, type: 'Money' };
    case 'Boolean':
      return { ...base, type: 'Boolean' };
    case 'DateOnly':
      return { ...base, type: 'DateTime', format: 'DateOnly' };
    case 'DateTime':
      return { ...base, type: 'DateTime', format: 'DateAndTime' };
    case 'Choice':
      if (!row['Choice / Option Set']) die(`${columnContext}: Choice missing option set`);
      return {
        ...base,
        type: 'Picklist',
        globalOptionSetName: optionSetName(row['Choice / Option Set']),
      };
    case 'Lookup':
      return { ...base, type: 'Lookup', lookupTarget: row['Lookup Target'] };
    case 'UniqueId':
      return { ...base, type: 'UniqueId' };
    default:
      die(`${columnContext}: unsupported Data Type "${t}"`);
  }
}

// ── Main transform ─────────────────────────────────────────────────────────
function buildPlan(workbookPath) {
  const buf = fs.readFileSync(workbookPath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const tablesRows = loadSheet(wb, 'Tables');
  const columnRows = loadSheet(wb, 'Columns');
  const optionSetRows = loadSheet(wb, 'GlobalOptionSets');

  // Map table definitions ---------------------------------------------------
  const tables = tablesRows.map((t) => {
    const logical = t['Logical Name'];
    const display = t['Display Name'];
    const primaryNameCol = t['Primary Name Column'];
    if (!logical || !display || !primaryNameCol) die(`Tables row missing data: ${JSON.stringify(t)}`);

    return {
      _sourceLogical: logical,
      _primaryNameSource: primaryNameCol,
      schemaName: mixedSchemaName(logical),
      displayName: display,
      displayCollectionName: t['Display Name'].endsWith('s')
        ? t['Display Name']
        : `${t['Display Name']}s`,
      logicalSingularName: singular(logical),
      logicalPluralName: plural(logical),
      entitySetName: plural(logical),
      tableLogicalName: plural(logical),
      description: t['Purpose'] || '',
      ownership: 'UserOwned',
      ownershipType: 'UserOwned',
      isActivity: false,
      hasActivities: false,
      hasNotes: true,
      columns: [],
    };
  });

  const tableBySourceLogical = new Map(tables.map((t) => [t._sourceLogical, t]));

  // Walk columns sheet ------------------------------------------------------
  const relationships = [];
  const columnsDropped = { uniqueId: 0, primaryName: 0, lookup: 0 };

  for (const c of columnRows) {
    const owningSource = c['Table'];
    const table = tableBySourceLogical.get(owningSource);
    if (!table) die(`Columns row refers to unknown table "${owningSource}"`);

    const srcLogical = c['Logical Name'];
    const ctx = `${owningSource}.${srcLogical}`;
    const mapped = columnTypeFor(c, ctx);

    // 1. UniqueId → skip; that's the system PK marker.
    if (mapped.type === 'UniqueId') {
      columnsDropped.uniqueId++;
      continue;
    }

    // 2. Primary name column → lift to table.primaryName.
    if (srcLogical === table._primaryNameSource) {
      if (mapped.type !== 'String') {
        die(`${ctx}: primary name column must be Text; got ${mapped.type}`);
      }
      table.primaryName = {
        schemaName: `${table.schemaName}Name`,
        displayName: mapped.displayName,
        description: mapped.description || 'Primary name for the record',
        maxLength: mapped.maxLength ?? 200,
      };
      columnsDropped.primaryName++;
      continue;
    }

    // 3. Lookup → promote to relationship; do not emit in columns[].
    if (mapped.type === 'Lookup') {
      const targetTable = tableBySourceLogical.get(mapped.lookupTarget);
      if (!targetTable) die(`${ctx}: lookup target "${mapped.lookupTarget}" is not in Tables sheet`);
      const lookupSchema = `${PREFIX}_${srcLogical}`.replace(/ID$/i, 'Id');
      relationships.push({
        type: 'ManyToOne',
        schemaName: `${table.schemaName}_${mapped.lookupTarget}`,
        fromTable: table.logicalSingularName,
        toTable: targetTable.logicalSingularName,
        referencingEntity: table.logicalSingularName,
        referencedEntity: targetTable.logicalSingularName,
        lookupSchemaName: lookupSchema,
        lookupLogicalName: lookupSchema.toLowerCase(),
        lookupDisplayName: mapped.displayName,
        lookupDescription: mapped.description,
        requiredLevel: mapped.requiredLevel,
        cascadeConfiguration: 'Referential',
      });
      columnsDropped.lookup++;
      continue;
    }

    // 4. Regular column.
    const schemaName = `${PREFIX}_${srcLogical}`;
    const logicalName = schemaName.toLowerCase();
    const column = {
      schemaName,
      logicalName,
      ...mapped,
    };
    delete column.lookupTarget;
    table.columns.push(column);
  }

  // Strip source-only helper fields from tables
  for (const t of tables) {
    delete t._sourceLogical;
    delete t._primaryNameSource;
    if (!t.primaryName) {
      die(`table ${t.schemaName}: primary name column row not found in Columns sheet`);
    }
  }

  // Walk option sets --------------------------------------------------------
  const optionSets = parseOptionSets(optionSetRows);

  return { tables, relationships, optionSets, columnsDropped };
}

function parseOptionSets(rows) {
  const map = new Map();
  for (const row of rows) {
    const rawName = row['Option Set'];
    if (!rawName) continue;
    const isHeader = String(rawName).trim().startsWith('*');
    const name = optionSetName(rawName);
    if (isHeader) {
      map.set(name, {
        name,
        displayName: row['Display Name'] || name,
        description: row['Notes / Used By'] || '',
        options: [],
      });
    } else {
      const os = map.get(name);
      if (!os) continue; // a value row without a header — skip silently
      if (row['Value'] == null || row['Label'] == null) continue;
      os.options.push({
        value: CHOICE_VALUE_BASE + (Number(row['Value']) - 1), // 1-based source → publisher-prefixed base
        label: String(row['Label']).trim(),
        description: row['Notes / Used By'] || '',
      });
    }
  }
  return [...map.values()];
}

// ── Emit ───────────────────────────────────────────────────────────────────
function writePayload(plan, outputPath) {
  const payload = {
    domains: [
      { name: 'Vendor Management', description: 'Vendor / Supplier / Contract / GL / Risk schema' },
    ],
    tables: plan.tables,
    relationships: plan.relationships,
    optionSets: plan.optionSets,
    provisioningPlansJson: [
      { path: 'dataverse/provision-tables.plan.json', purpose: 'Create tables, columns, and option sets' },
      { path: 'dataverse/provision-relationships.plan.json', purpose: 'Create M:1 lookup relationships' },
      { path: 'dataverse/register-datasources.plan.json', purpose: 'Register tables with pac code add-data-source' },
    ],
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function main() {
  const workbookPath = path.resolve(process.argv[2] || DEFAULT_WORKBOOK);
  const outputPath = path.resolve(process.argv[3] || DEFAULT_OUTPUT);
  if (!fs.existsSync(workbookPath)) die(`workbook not found: ${workbookPath}`);

  const plan = buildPlan(workbookPath);
  writePayload(plan, outputPath);

  const optionCount = plan.optionSets.reduce((n, os) => n + os.options.length, 0);
  const columnCount = plan.tables.reduce((n, t) => n + t.columns.length, 0);

  console.log(`schema-import: wrote ${path.relative(process.cwd(), outputPath)}`);
  console.log(`  tables:        ${plan.tables.length}`);
  console.log(`  columns:       ${columnCount}`);
  console.log(`  relationships: ${plan.relationships.length}`);
  console.log(`  option sets:   ${plan.optionSets.length} (${optionCount} values)`);
  console.log(`  choice base:   ${CHOICE_VALUE_BASE}`);
  console.log(`  dropped from columns[]: ${JSON.stringify(plan.columnsDropped)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
