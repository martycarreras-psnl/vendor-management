#!/usr/bin/env node
// Enable Dataverse table auditing on rpvms_vendor and rpvms_vendorscore.
// Idempotent: only patches tables whose IsAuditEnabled.Value is currently false.
//
// Usage:  node scripts/enable-table-auditing.mjs
// Env:    OP_BIN (1Password CLI) optional; uses same wizard state as other scripts.

import { loadState, resolveSecret, createClient } from './lib/dataverse-client.mjs';

const TABLES = ['rpvms_vendor', 'rpvms_vendorscore'];

const state = loadState();
const secret = resolveSecret(state);
const solutionName = state.SOLUTION_UNIQUE_NAME || process.env.PP_SOLUTION_NAME;
const dv = createClient(state, secret, { solutionName });

for (const logicalName of TABLES) {
  const full = await dv.get(`EntityDefinitions(LogicalName='${logicalName}')`);
  if (full?._notFound) {
    console.error(`  ! table not found: ${logicalName}`);
    process.exitCode = 1;
    continue;
  }
  if (full?.IsAuditEnabled?.Value === true) {
    console.log(`  = skip ${logicalName} (auditing already enabled)`);
    continue;
  }
  console.log(`  + enabling auditing on ${logicalName}`);
  // EntityMetadata update requires full-body PUT (PATCH is not supported; single-property PUT
  // rejects BooleanManagedProperty as non-ODataResource). Round-trip: GET full metadata,
  // mutate IsAuditEnabled, PUT back with MSCRM.MergeLabels.
  const body = {
    ...full,
    '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
    IsAuditEnabled: { ...full.IsAuditEnabled, Value: true },
  };
  // Strip nav properties that PUT rejects (attributes/relationships live under sub-paths)
  delete body.Attributes;
  delete body.OneToManyRelationships;
  delete body.ManyToOneRelationships;
  delete body.ManyToManyRelationships;
  delete body.Keys;
  delete body.Privileges;
  delete body.Settings;
  await dv.put(`EntityDefinitions(LogicalName='${logicalName}')`, body, {
    expectJson: false,
    solution: solutionName,
  });
}

console.log('  publishing all customizations…');
await dv.publishAll();
console.log('Done.');
