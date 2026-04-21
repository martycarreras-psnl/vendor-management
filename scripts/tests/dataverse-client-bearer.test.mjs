// Verifies that the Dataverse client honors DATAVERSE_BEARER_TOKEN + PP_ENV_TARGET
// without requiring .wizard-state.json or a client secret (the path used by
// scripts/seed-dataverse-data.ps1).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadState,
  resolveSecret,
  createClient,
  resetToken,
} from '../lib/dataverse-client.mjs';

test('loadState returns a state object (from file or synthesized) under bearer mode', () => {
  const prev = { ...process.env };
  try {
    delete process.env.DATAVERSE_BEARER_TOKEN_CMD;
    process.env.DATAVERSE_BEARER_TOKEN = 'FAKE';
    process.env.PP_ENV_TARGET = 'https://scratch.crm.dynamics.com';
    process.env.PP_SOLUTION_NAME = 'VendorManagement';
    // loadState either reads .wizard-state.json (when present in the repo) or
    // synthesizes a minimal state from PP_ENV_TARGET. Either way the call must
    // succeed without a client secret so the wrapper flow keeps working.
    const state = loadState();
    assert.ok(state && typeof state.PP_ENV_DEV === 'string' && state.PP_ENV_DEV.startsWith('https://'));
  } finally {
    process.env = prev;
  }
});

test('resolveSecret returns null in bearer passthrough mode', () => {
  const prev = { ...process.env };
  try {
    process.env.DATAVERSE_BEARER_TOKEN = 'FAKE';
    delete process.env.PP_CLIENT_SECRET_VALUE;
    assert.equal(resolveSecret({}), null);
  } finally {
    process.env = prev;
  }
});

test('createClient issues bearer-authorized requests against the override env', async () => {
  const prev = { ...process.env };
  const origFetch = globalThis.fetch;
  let captured = null;
  try {
    process.env.DATAVERSE_BEARER_TOKEN = 'bearer-xyz';
    delete process.env.DATAVERSE_BEARER_TOKEN_CMD;
    resetToken();

    globalThis.fetch = async (url, init) => {
      captured = { url: String(url), init };
      return new Response(JSON.stringify({ value: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = createClient({}, null, {
      solutionName: 'VendorManagement',
      envUrl: 'https://override.crm.dynamics.com/',
    });
    const res = await client.get('WhoAmI');
    assert.deepEqual(res, { value: [] });
    assert.ok(captured, 'fetch must have been called');
    assert.equal(captured.url, 'https://override.crm.dynamics.com/api/data/v9.2/WhoAmI');
    assert.equal(captured.init.headers.Authorization, 'Bearer bearer-xyz');
    assert.equal(captured.init.headers['MSCRM.SolutionUniqueName'], 'VendorManagement');
  } finally {
    globalThis.fetch = origFetch;
    process.env = prev;
    resetToken();
  }
});

test('createClient throws when no env URL is available', () => {
  const prev = { ...process.env };
  try {
    delete process.env.PP_ENV_TARGET;
    assert.throws(
      () => createClient({}, null, { solutionName: 'X' }),
      /No Dataverse env URL/,
    );
  } finally {
    process.env = prev;
  }
});
