#!/usr/bin/env node
// Idempotent Dataverse schema provisioner driven by dataverse/planning-payload.json.
//
// Phases (golden sequence):
//   1. Global option sets (create missing; add missing values to existing sets)
//   2. Tables + primary name attribute (create missing; never modify)
//   3. Non-lookup columns (create missing; never modify)
//   4. One-to-many relationships / lookups (create missing; never modify)
//   5. PublishAllXml
//   6. pac code add-data-source registrations (delegated)
//
// Usage:
//   node scripts/provision-dataverse-schema.mjs [--dry-run] [--plan <path>]
//
// Env / state:
//   Reads PP_TENANT_ID, PP_APP_ID, PP_ENV_DEV, SOLUTION_UNIQUE_NAME, PUBLISHER_PREFIX
//   from .wizard-state.json. Client secret via 1Password (OP_VAULT / OP_ITEM) or
//   env var PP_CLIENT_SECRET_VALUE.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEFAULT_PLAN = 'dataverse/planning-payload.json';
const STATE_FILE = '.wizard-state.json';

// ── CLI ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const planArgIdx = args.indexOf('--plan');
const PLAN_PATH = planArgIdx >= 0 ? args[planArgIdx + 1] : DEFAULT_PLAN;

// ── State / auth ───────────────────────────────────────────────────────────
function loadState() {
  const raw = fs.readFileSync(STATE_FILE, 'utf8');
  return JSON.parse(raw);
}

function resolveSecret(state) {
  if (process.env.PP_CLIENT_SECRET_VALUE) return process.env.PP_CLIENT_SECRET_VALUE.trim();

  const vault = state.OP_VAULT;
  const item = state.OP_ITEM;
  if (!vault || !item) throw new Error('No OP_VAULT/OP_ITEM in .wizard-state.json and PP_CLIENT_SECRET_VALUE not set');

  const res = spawnSync('op', ['read', `op://${vault}/${item}/client-secret`], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`1Password read failed: ${res.stderr?.trim() || res.status}`);
  return res.stdout.trim();
}

let _token = null;
let _tokenExpiry = 0;
async function getToken(state, secret) {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const envUrl = state.PP_ENV_DEV.replace(/\/$/, '');
  const body = new URLSearchParams({
    client_id: state.PP_APP_ID,
    client_secret: secret,
    scope: `${envUrl}/.default`,
    grant_type: 'client_credentials',
  });
  const res = await fetch(`https://login.microsoftonline.com/${state.PP_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token request failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  _token = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _token;
}

async function dv(method, url, body, { solutionName, expectJson = true } = {}) {
  if (DRY_RUN) {
    // In dry-run, don't hit the network at all. GETs return 404 so the caller
    // treats everything as "needs to be created" — i.e. we print the full plan.
    if (method !== 'GET') console.log(`  [dry-run] ${method} ${url}`);
    return { _notFound: true };
  }
  const { state } = _ctx;
  const envUrl = state.PP_ENV_DEV.replace(/\/$/, '');

  const maxAttempts = 5;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const token = await getToken(state, _ctx.secret);
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      };
      if (body) {
        headers['Content-Type'] = 'application/json';
        headers.Prefer = 'return=representation';
      }
      if (solutionName) headers['MSCRM.SolutionUniqueName'] = solutionName;

      const res = await fetch(`${envUrl}/api/data/v9.2/${url}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(url === 'PublishAllXml' ? 600000 : 120000),
      });
      if (res.status === 404) return { _notFound: true };
      if (res.status === 429 || res.status >= 500) {
        const text = await res.text().catch(() => '');
        throw new Error(`transient ${res.status}: ${text.slice(0, 200)}`);
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Dataverse ${method} ${url} failed (${res.status}): ${text}`);
      }
      if (!expectJson || res.status === 204) return null;
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const transient =
        msg.includes('fetch failed') ||
        msg.includes('transient') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('UND_ERR');
      if (!transient || attempt === maxAttempts) throw err;
      const backoff = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
      console.log(`  ! transient error (${msg.slice(0, 80)}) — retry ${attempt}/${maxAttempts - 1} in ${backoff}ms`);
      // Force token refresh in case it expired during a long-running call
      _token = null;
      _tokenExpiry = 0;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

// ── Label helpers ──────────────────────────────────────────────────────────
function label(s) {
  return { LocalizedLabels: [{ Label: String(s ?? ''), LanguageCode: 1033 }] };
}
function reqLevel(level) {
  return { Value: level || 'None' };
}

// ── Metadata builders ──────────────────────────────────────────────────────
function buildOptionSetBody(os) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
    Name: os.name,
    DisplayName: label(os.displayName || os.name),
    Description: label(os.description || ''),
    OptionSetType: 'Picklist',
    IsGlobal: true,
    IsCustomOptionSet: true,
    Options: os.options.map((o) => ({
      Value: o.value,
      Label: label(o.label),
      Description: label(o.description || ''),
    })),
  };
}

function buildAttribute(column, { isPrimaryName = false, globalOptionSetMetadataId = null } = {}) {
  const common = {
    SchemaName: column.schemaName,
    DisplayName: label(column.displayName),
    Description: label(column.description || ''),
    RequiredLevel: reqLevel(isPrimaryName ? 'ApplicationRequired' : column.requiredLevel),
  };

  switch (column.type) {
    case 'String':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
        ...common,
        MaxLength: column.maxLength ?? 100,
        FormatName: { Value: column.format || 'Text' },
        ...(isPrimaryName ? { IsPrimaryName: true } : {}),
      };
    case 'Memo':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
        ...common,
        MaxLength: column.maxLength ?? 2000,
        Format: 'TextArea',
      };
    case 'Integer':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
        ...common,
        Format: 'None',
      };
    case 'Decimal':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata',
        ...common,
        Precision: column.precision ?? 2,
      };
    case 'Money':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.MoneyAttributeMetadata',
        ...common,
        PrecisionSource: 2,
      };
    case 'Boolean':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
        ...common,
        DefaultValue: false,
        OptionSet: {
          '@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata',
          TrueOption: { Value: 1, Label: label('Yes') },
          FalseOption: { Value: 0, Label: label('No') },
        },
      };
    case 'DateTime':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
        ...common,
        Format: column.format === 'DateOnly' ? 'DateOnly' : 'DateAndTime',
        DateTimeBehavior: { Value: column.format === 'DateOnly' ? 'DateOnly' : 'UserLocal' },
      };
    case 'Picklist':
      if (!globalOptionSetMetadataId) {
        throw new Error(`Picklist ${column.schemaName} requires globalOptionSetMetadataId`);
      }
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
        ...common,
        'GlobalOptionSet@odata.bind': `/GlobalOptionSetDefinitions(${globalOptionSetMetadataId})`,
      };
    default:
      throw new Error(`Unsupported column type "${column.type}" for ${column.schemaName}`);
  }
}

function buildEntityBody(table) {
  const primary = table.primaryName;
  const primaryAttr = buildAttribute(
    {
      schemaName: primary.schemaName,
      displayName: primary.displayName,
      description: primary.description,
      requiredLevel: 'ApplicationRequired',
      type: 'String',
      format: 'Text',
      maxLength: primary.maxLength || 200,
    },
    { isPrimaryName: true },
  );
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
    SchemaName: table.schemaName,
    DisplayName: label(table.displayName),
    DisplayCollectionName: label(table.displayCollectionName),
    Description: label(table.description || ''),
    OwnershipType: table.ownership || 'UserOwned',
    HasActivities: table.hasActivities ?? false,
    HasNotes: table.hasNotes ?? true,
    IsActivity: false,
    Attributes: [primaryAttr],
  };
}

function buildRelationshipBody(rel, tablesByLogical) {
  const referenced = tablesByLogical.get(rel.referencedEntity);
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
    SchemaName: rel.schemaName,
    ReferencedEntity: rel.referencedEntity,
    ReferencingEntity: rel.referencingEntity,
    ReferencedAttribute: `${rel.referencedEntity}id`,
    CascadeConfiguration: {
      Assign: 'NoCascade',
      Delete: 'RemoveLink',
      Merge: 'NoCascade',
      Reparent: 'NoCascade',
      Share: 'NoCascade',
      Unshare: 'NoCascade',
    },
    AssociatedMenuConfiguration: {
      Behavior: 'UseCollectionName',
      Group: 'Details',
      Label: label(referenced?.displayCollectionName || rel.referencedEntity),
      Order: 10000,
    },
    Lookup: {
      '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
      SchemaName: rel.lookupSchemaName,
      DisplayName: label(rel.lookupDisplayName || rel.referencedEntity),
      Description: label(rel.lookupDescription || ''),
      RequiredLevel: reqLevel(rel.requiredLevel || 'None'),
    },
  };
}

// ── Phase runners ──────────────────────────────────────────────────────────
const _optionSetMetadataIds = new Map();

async function ensureOptionSet(os, solutionName) {
  const found = await dv('GET', `GlobalOptionSetDefinitions(Name='${os.name}')?$select=Name,MetadataId`);
  if (!found || found._notFound) {
    console.log(`  + create option set ${os.name} (${os.options.length} values)`);
    const created = await dv('POST', 'GlobalOptionSetDefinitions', buildOptionSetBody(os), { solutionName });
    if (created?.MetadataId) _optionSetMetadataIds.set(os.name, created.MetadataId);
    return { action: 'created' };
  }
  _optionSetMetadataIds.set(os.name, found.MetadataId);
  // Additive: load full set and add missing values
  const full = await dv('GET', `GlobalOptionSetDefinitions(${found.MetadataId})`);
  const existingValues = new Set((full?.Options || []).map((o) => o.Value));
  const missing = os.options.filter((o) => !existingValues.has(o.value));
  if (missing.length === 0) {
    console.log(`  = skip option set ${os.name} (exists, all values present)`);
    return { action: 'skipped' };
  }
  for (const opt of missing) {
    console.log(`  + add value ${opt.value} "${opt.label}" to ${os.name}`);
    await dv('POST', 'InsertOptionValue', {
      OptionSetName: os.name,
      Value: opt.value,
      Label: label(opt.label),
      Description: label(opt.description || ''),
      SolutionUniqueName: solutionName,
    }, { solutionName });
  }
  return { action: 'patched', added: missing.length };
}

async function ensureTable(table, solutionName) {
  const found = await dv('GET', `EntityDefinitions(LogicalName='${table.logicalSingularName}')?$select=LogicalName`);
  if (!found || found._notFound) {
    console.log(`  + create table ${table.logicalSingularName} (primary: ${table.primaryName.schemaName})`);
    await dv('POST', 'EntityDefinitions', buildEntityBody(table), { solutionName });
    return { action: 'created' };
  }
  console.log(`  = skip table ${table.logicalSingularName} (exists)`);
  return { action: 'skipped' };
}

async function ensureColumn(table, column, solutionName) {
  const found = await dv(
    'GET',
    `EntityDefinitions(LogicalName='${table.logicalSingularName}')/Attributes(LogicalName='${column.logicalName}')?$select=LogicalName`,
  );
  if (!found || found._notFound) {
    console.log(`  + create column ${table.logicalSingularName}.${column.logicalName} (${column.type})`);
    let metadataId = null;
    if (column.type === 'Picklist') {
      metadataId = _optionSetMetadataIds.get(column.globalOptionSetName);
      if (!metadataId && !DRY_RUN) {
        // Resolve on demand if not cached (e.g. on a re-run)
        const os = await dv('GET', `GlobalOptionSetDefinitions(Name='${column.globalOptionSetName}')?$select=MetadataId`);
        if (os && !os._notFound) {
          metadataId = os.MetadataId;
          _optionSetMetadataIds.set(column.globalOptionSetName, metadataId);
        } else {
          throw new Error(`Picklist ${column.schemaName}: option set ${column.globalOptionSetName} not found`);
        }
      }
    }
    await dv(
      'POST',
      `EntityDefinitions(LogicalName='${table.logicalSingularName}')/Attributes`,
      buildAttribute(column, { globalOptionSetMetadataId: metadataId }),
      { solutionName },
    );
    return { action: 'created' };
  }
  return { action: 'skipped' };
}

async function ensureRelationship(rel, tablesByLogical, solutionName) {
  const found = await dv('GET', `RelationshipDefinitions(SchemaName='${rel.schemaName}')?$select=SchemaName`);
  if (!found || found._notFound) {
    console.log(`  + create relationship ${rel.schemaName} (${rel.referencingEntity} → ${rel.referencedEntity})`);
    await dv('POST', 'RelationshipDefinitions', buildRelationshipBody(rel, tablesByLogical), { solutionName });
    return { action: 'created' };
  }
  console.log(`  = skip relationship ${rel.schemaName} (exists)`);
  return { action: 'skipped' };
}

async function publishAll({ skipIfNoChanges = false, changeCount = 0 } = {}) {
  if (skipIfNoChanges && changeCount === 0) {
    console.log('  (no changes in this phase — skipping publish)');
    return;
  }
  console.log('  publishing all customizations…');
  try {
    await dv('POST', 'PublishAllXml', {}, { expectJson: false });
  } catch (e) {
    console.log(`  ! publish failed (${String(e.message || e).slice(0, 120)}) — continuing; artifacts will still be created.`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
const _ctx = { state: null, secret: null };

async function main() {
  _ctx.state = loadState();
  const solutionName = _ctx.state.SOLUTION_UNIQUE_NAME;
  if (!solutionName) throw new Error('SOLUTION_UNIQUE_NAME not in .wizard-state.json');
  console.log(`Provisioning Dataverse schema`);
  console.log(`  env:      ${_ctx.state.PP_ENV_DEV}`);
  console.log(`  solution: ${solutionName}`);
  console.log(`  plan:     ${PLAN_PATH}`);
  console.log(`  mode:     ${DRY_RUN ? 'DRY RUN (no mutations)' : 'LIVE'}\n`);

  if (!DRY_RUN) _ctx.secret = resolveSecret(_ctx.state);
  else _ctx.secret = 'dry-run-placeholder';

  const plan = JSON.parse(fs.readFileSync(path.resolve(PLAN_PATH), 'utf8'));
  const tablesByLogical = new Map(plan.tables.map((t) => [t.logicalSingularName, t]));
  const summary = { optionSets: { created: 0, patched: 0, skipped: 0 }, tables: { created: 0, skipped: 0 }, columns: { created: 0, skipped: 0 }, relationships: { created: 0, skipped: 0 } };

  console.log('Phase 1 — Global option sets');
  for (const os of plan.optionSets || []) {
    const r = await ensureOptionSet(os, solutionName);
    summary.optionSets[r.action === 'patched' ? 'patched' : r.action]++;
  }
  if (!DRY_RUN) await publishAll({ skipIfNoChanges: true, changeCount: summary.optionSets.created + summary.optionSets.patched });

  console.log('\nPhase 2 — Tables');
  for (const table of plan.tables) {
    const r = await ensureTable(table, solutionName);
    summary.tables[r.action]++;
  }
  if (!DRY_RUN) await publishAll({ skipIfNoChanges: true, changeCount: summary.tables.created });

  console.log('\nPhase 3 — Columns');
  for (const table of plan.tables) {
    for (const column of table.columns) {
      const r = await ensureColumn(table, column, solutionName);
      summary.columns[r.action]++;
    }
  }
  if (!DRY_RUN) await publishAll({ skipIfNoChanges: true, changeCount: summary.columns.created });

  console.log('\nPhase 4 — Relationships / lookups');
  for (const rel of plan.relationships) {
    const r = await ensureRelationship(rel, tablesByLogical, solutionName);
    summary.relationships[r.action]++;
  }
  if (!DRY_RUN) await publishAll({ skipIfNoChanges: true, changeCount: summary.relationships.created });

  console.log('\nSummary');
  console.log(JSON.stringify(summary, null, 2));

  if (!DRY_RUN) {
    console.log('\nNext: register Dataverse tables with pac code add-data-source:');
    console.log('  node scripts/register-dataverse-data-sources.mjs dataverse/register-datasources.plan.json');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`\nprovision-dataverse-schema: ${e.message}`);
    process.exit(1);
  });
}
