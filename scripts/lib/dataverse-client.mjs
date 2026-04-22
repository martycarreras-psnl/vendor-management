// Shared Dataverse Web API client for provisioning + seeding scripts.
// Extracts OAuth client-credentials token flow, retry/backoff, and JSON fetch.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

export function loadState() {
  const p = path.join(REPO_ROOT, '.wizard-state.json');
  // When an external caller (e.g. the PowerShell wrapper) supplies a bearer
  // token + target env URL, .wizard-state.json is not required. Return a
  // minimal synthesized state so downstream callers can proceed.
  if (!fs.existsSync(p)) {
    if (process.env.DATAVERSE_BEARER_TOKEN || process.env.DATAVERSE_BEARER_TOKEN_CMD) {
      const env = process.env.PP_ENV_TARGET || '';
      if (!env) throw new Error('PP_ENV_TARGET env var required when .wizard-state.json is absent');
      return { PP_ENV_DEV: env, SOLUTION_UNIQUE_NAME: process.env.PP_SOLUTION_NAME || '' };
    }
    throw new Error('.wizard-state.json not found at repo root');
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function resolveSecret(state) {
  // Bearer-token passthrough mode: no client secret needed.
  if (process.env.DATAVERSE_BEARER_TOKEN || process.env.DATAVERSE_BEARER_TOKEN_CMD) return null;
  if (process.env.PP_CLIENT_SECRET_VALUE) return process.env.PP_CLIENT_SECRET_VALUE.trim();
  const vault = state.OP_VAULT;
  const item = state.OP_ITEM;
  if (!vault || !item) throw new Error('No OP_VAULT/OP_ITEM in .wizard-state.json and PP_CLIENT_SECRET_VALUE not set');
  const res = spawnSync('op', ['read', `op://${vault}/${item}/client-secret`], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`1Password read failed: ${res.stderr || res.stdout}`);
  return res.stdout.trim();
}

let _token = null;
let _tokenExpiry = 0;
let _bearerCmdCachedAt = 0;

function runBearerCmd(cmd) {
  // Execute via the user's shell so pipelines / quoting work as written.
  const res = spawnSync(cmd, { shell: true, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`DATAVERSE_BEARER_TOKEN_CMD failed: ${(res.stderr || res.stdout || '').trim().slice(0, 300)}`);
  }
  const tok = (res.stdout || '').trim();
  if (!tok) throw new Error('DATAVERSE_BEARER_TOKEN_CMD produced empty output');
  return tok;
}

async function getToken(state, secret) {
  const now = Date.now();
  // Bearer-token passthrough (PowerShell wrapper et al.).
  if (process.env.DATAVERSE_BEARER_TOKEN_CMD) {
    // Refresh the cached token every ~30 minutes; cheap to call.
    if (!_token || now - _bearerCmdCachedAt > 30 * 60 * 1000) {
      _token = runBearerCmd(process.env.DATAVERSE_BEARER_TOKEN_CMD);
      _bearerCmdCachedAt = now;
    }
    return _token;
  }
  if (process.env.DATAVERSE_BEARER_TOKEN) {
    _token = process.env.DATAVERSE_BEARER_TOKEN.trim();
    return _token;
  }
  if (_token && now < _tokenExpiry - 60_000) return _token;
  const res = await fetch(`https://login.microsoftonline.com/${state.PP_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: state.PP_APP_ID,
      client_secret: secret,
      grant_type: 'client_credentials',
      scope: `${state.PP_ENV_DEV}/.default`,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Auth failed: ${JSON.stringify(json)}`);
  _token = json.access_token;
  _tokenExpiry = now + json.expires_in * 1000;
  return _token;
}

export function resetToken() {
  _token = null;
  _tokenExpiry = 0;
  _bearerCmdCachedAt = 0;
}

export function createClient(state, secret, { solutionName, envUrl: envUrlOverride } = {}) {
  // Precedence: explicit override > PP_ENV_TARGET env var > state.PP_ENV_DEV.
  const rawEnv = envUrlOverride || process.env.PP_ENV_TARGET || state.PP_ENV_DEV;
  if (!rawEnv) throw new Error('No Dataverse env URL (pass envUrl, set PP_ENV_TARGET, or populate state.PP_ENV_DEV)');
  const envUrl = rawEnv.replace(/\/$/, '');
  async function request(method, url, body = null, { expectJson = true, solution = solutionName, timeoutMs = 120000 } = {}) {
    const maxAttempts = 5;
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const token = await getToken(state, secret);
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
        if (solution) headers['MSCRM.SolutionUniqueName'] = solution;
        const res = await fetch(`${envUrl}/api/data/v9.2/${url}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.status === 404) return { _notFound: true };
        if (res.status === 429 || res.status >= 500) {
          const text = await res.text().catch(() => '');
          throw new Error(`transient ${res.status}: ${text.slice(0, 200)}`);
        }
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Dataverse ${method} ${url} failed (${res.status}): ${text.slice(0, 400)}`);
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
          msg.includes('UND_ERR') ||
          msg.includes('AbortError') ||
          msg.includes('HeadersTimeoutError');
        if (!transient || attempt === maxAttempts) throw err;
        const backoff = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
        console.log(`  ! transient (${msg.slice(0, 70)}) — retry ${attempt}/${maxAttempts - 1} in ${backoff}ms`);
        resetToken();
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    throw lastErr;
  }
  return {
    get: (url, opts) => request('GET', url, null, opts),
    post: (url, body, opts) => request('POST', url, body, opts),
    patch: (url, body, opts) => request('PATCH', url, body, opts),
    put: (url, body, opts) => request('PUT', url, body, opts),
    del: (url, opts) => request('DELETE', url, null, { ...opts, expectJson: false }),
    publishAll: async () => {
      for (let a = 1; a <= 6; a++) {
        try {
          await request('POST', 'PublishAllXml', {}, { expectJson: false, timeoutMs: 900000 });
          return true;
        } catch (e) {
          console.log(`  publish attempt ${a} failed: ${String(e.message || e).slice(0, 90)}`);
          if (a < 6) await new Promise((r) => setTimeout(r, Math.min(30000 * a, 120000)));
        }
      }
      return false;
    },
  };
}
