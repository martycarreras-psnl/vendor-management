import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const state = JSON.parse(fs.readFileSync('.wizard-state.json', 'utf8'));
const op = spawnSync('op', ['read', `op://${state.OP_VAULT}/${state.OP_ITEM}/client-secret`], { encoding: 'utf8' });
if (op.status !== 0) { console.error(op.stderr); process.exit(1); }
const secret = op.stdout.trim();
const tokenRes = await fetch(`https://login.microsoftonline.com/${state.PP_TENANT_ID}/oauth2/v2.0/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: state.PP_APP_ID,
    client_secret: secret,
    grant_type: 'client_credentials',
    scope: `${state.PP_ENV_DEV}/.default`,
  }),
});
const tokenJson = await tokenRes.json();
if (!tokenJson.access_token) { console.error('token error:', tokenJson); process.exit(1); }
const { access_token } = tokenJson;
console.log('token acquired; publishing…');
for (let attempt = 1; attempt <= 6; attempt++) {
  try {
    const res = await fetch(`${state.PP_ENV_DEV}/api/data/v9.2/PublishAllXml`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      },
      body: '{}',
      signal: AbortSignal.timeout(900000),
    });
    console.log(`attempt ${attempt} status:`, res.status, res.statusText);
    if (res.ok || res.status === 204) { console.log('✅ publish succeeded'); process.exit(0); }
    const txt = (await res.text()).slice(0, 400);
    console.log(txt);
    if (res.status < 500 && res.status !== 429) process.exit(1);
  } catch (e) {
    console.log(`attempt ${attempt} error:`, String(e.message || e).slice(0, 120));
  }
  const backoff = Math.min(30000 * attempt, 120000);
  console.log(`waiting ${backoff}ms before retry…`);
  await new Promise((r) => setTimeout(r, backoff));
}
console.error('publish did not succeed after retries; artifacts still exist in Dataverse — you can click "Publish all customizations" in the maker UI.');
process.exit(1);
