// Deterministic sample-data generator for the Vendor Management solution.
// Reads seed inputs + planning-payload schema → writes dataverse/seed-data/dataset.plan.json.
// All records keyed by a stable natural key (`_nk`) so the loader can upsert idempotently.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(__filename), '..');
const SEED_DIR = path.join(REPO, 'dataverse', 'seed-data');
const PLAN_PATH = path.join(REPO, 'dataverse', 'planning-payload.json');
const OUT_PATH = path.join(SEED_DIR, 'dataset.plan.json');

// ── Deterministic RNG (mulberry32) ─────────────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Load inputs ────────────────────────────────────────────────────────────
const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
const vendorsSeed = JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'vendors.seed.json'), 'utf8'));
const suppliersSeed = JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'suppliers.seed.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'generator-config.json'), 'utf8'));
const csvLines = fs
  .readFileSync(path.join(SEED_DIR, 'var-relationships.csv'), 'utf8')
  .trim()
  .split(/\r?\n/);

// Build option-set label→value map from the plan for easy picking.
const OS = Object.fromEntries(
  plan.optionSets.map((o) => [
    o.name,
    Object.fromEntries(o.options.map((v) => [v.label, v.value])),
  ]),
);
function opt(setName, label) {
  const m = OS[setName];
  if (!m) throw new Error(`Unknown option set ${setName}`);
  if (!(label in m)) throw new Error(`Label "${label}" not in ${setName} (have: ${Object.keys(m).join(', ')})`);
  return m[label];
}

const rng = mulberry32(config.rng_seed);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const jitter = (mid, pct) => mid * (1 + (rng() - 0.5) * 2 * pct);
const weightedPick = (mix) => {
  const entries = Object.entries(mix);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
};
const pad = (n, w = 4) => String(n).padStart(w, '0');
const isoDate = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};
const dateInFY = (year, rngFn = rng) => {
  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(d.getUTCDate() + Math.floor(rngFn() * 364));
  return d;
};

// Natural-key stable identifier for each logical record
// (loader uses this to check existence and cache ids).
function nk(parts) {
  return parts
    .map((p) => String(p).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .join('::');
}

// Parse VAR CSV (handles quoted commas).
function parseCsv(lines) {
  const rows = [];
  const header = lines[0].split(',').map((s) => s.trim().replace(/"/g, ''));
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const cells = [];
    let cur = '';
    let q = false;
    for (const c of raw) {
      if (c === '"') q = !q;
      else if (c === ',' && !q) {
        cells.push(cur);
        cur = '';
      } else cur += c;
    }
    cells.push(cur);
    rows.push(Object.fromEntries(header.map((h, i) => [h, (cells[i] || '').trim()])));
  }
  return rows;
}
const varCsv = parseCsv(csvLines);

// Map CSV vendor-name → reseller supplier-name (normalizing a few spellings).
const resellerNameMap = {
  Herjavec: 'Herjavec Group',
  Logicalis: 'Logicalis',
  'Mission Critical': 'Mission Critical Systems',
};
const csvVendorToReseller = new Map();
const csvVendorToProducts = new Map();
for (const r of varCsv) {
  const v = normalizeVendorName(r['Vendor Name']);
  csvVendorToReseller.set(v, resellerNameMap[r['VAR/Reseller']] || r['VAR/Reseller']);
  csvVendorToProducts.set(v, r['Product & Service Names']);
}
function normalizeVendorName(n) {
  // CSV uses "Crowdstrike"/"vmWare"/"Pure"/etc — map to seed-file canonical names.
  const m = {
    Crowdstrike: 'CrowdStrike',
    vmWare: 'VMware',
    Pure: 'Pure Storage',
    Spectrum: 'Spectrum Enterprise',
    'US CLOUD': 'US Cloud',
    Extreme: 'Extreme Networks',
    Netapp: 'NetApp',
    Solarwinds: 'SolarWinds',
    'Cyderes/Google Chronicle': 'Cyderes Google Chronicle',
  };
  return m[n] || n;
}

// ── Vendors ────────────────────────────────────────────────────────────────
const vendors = vendorsSeed.vendors.map((v, i) => ({
  _nk: nk([v.name]),
  _id: `VEN-${pad(100 + i, 4)}`,
  rpvms_vendorname: v.name,
  rpvms_categoryl1: v.categoryL1,
  rpvms_categoryl2: v.categoryL2,
  rpvms_commercialrole: opt('rpvms_commercialrole', v.commercialRole),
  rpvms_primaryoffering: v.primaryOffering,
  rpvms_classification: opt('rpvms_classification', v.classification),
  rpvms_isvar: v.isVar,
  rpvms_status: opt('rpvms_vendorstatus', v.status),
  rpvms_activephiaccess: opt('rpvms_yesnona', v.ephi),
}));

// ── Suppliers ──────────────────────────────────────────────────────────────
// Start with the 3 reseller shells, then auto-generate 1 direct-pay shell per
// vendor that invoices directly (isVar=false). Some resellers ALSO invoice for
// certain vendors (via the VAR CSV) so we do not need per-vendor shells for
// those. Direct-pay shells have name = vendor name.
const suppliers = suppliersSeed.suppliers.map((s, i) => ({
  _nk: nk([s.name]),
  _id: `SUP-${pad(100 + i, 4)}`,
  rpvms_suppliername: s.name,
  rpvms_suppliercategory: s.suppliercategory,
  rpvms_tintype: opt('rpvms_tintype', s.tintype),
  rpvms_taxid: s.taxid,
  rpvms_isreseller: s.isreseller,
}));

// Build a vendor → supplier resolution map (used by VendorSupplier + GL + Contract).
const vendorToSupplierName = new Map(); // vendor name → primary invoicing supplier name
for (const v of vendors) {
  if (v.rpvms_isvar) {
    const reseller = csvVendorToReseller.get(v.rpvms_vendorname);
    if (reseller) {
      vendorToSupplierName.set(v.rpvms_vendorname, reseller);
      continue;
    }
  }
  // direct-pay shell: same name as the vendor (create supplier if not there).
  if (!suppliers.find((s) => s._nk === nk([v.rpvms_vendorname]))) {
    suppliers.push({
      _nk: nk([v.rpvms_vendorname]),
      _id: `SUP-${pad(200 + suppliers.length, 4)}`,
      rpvms_suppliername: v.rpvms_vendorname,
      rpvms_suppliercategory: v.rpvms_categoryl1,
      rpvms_tintype: opt('rpvms_tintype', 'EIN'),
      rpvms_taxid: `${between(20, 88)}-${between(1000000, 9999999)}`,
      rpvms_isreseller: false,
    });
  }
  vendorToSupplierName.set(v.rpvms_vendorname, v.rpvms_vendorname);
}

// ── VendorSupplier ─────────────────────────────────────────────────────────
const vendorSuppliers = [];
for (const v of vendors) {
  const supplierName = vendorToSupplierName.get(v.rpvms_vendorname);
  const products = csvVendorToProducts.get(v.rpvms_vendorname) || v.rpvms_primaryoffering;
  const effFrom = `${2022 + Math.floor(rng() * 3)}-${pad(between(1, 12), 2)}-01`;
  const effTo = `${config.currentFiscalYear + 1}-${pad(between(1, 12), 2)}-${pad(between(1, 28), 2)}`;
  vendorSuppliers.push({
    _nk: nk([v.rpvms_vendorname, supplierName]),
    _vendor: v._nk,
    _supplier: nk([supplierName]),
    rpvms_vendorsuppliername: `${v.rpvms_vendorname} ↔ ${supplierName}`,
    rpvms_relationshiptype: opt(
      'rpvms_relationshiptype',
      v.rpvms_isvar ? 'VAR/Reseller' : 'Direct',
    ),
    rpvms_productsservicescovered: products,
    rpvms_effectivefrom: effFrom,
    rpvms_effectiveto: effTo,
  });
}

// ── VendorProductService ───────────────────────────────────────────────────
const productLines = {
  Proofpoint: ['Email Threat Protection', 'Targeted Attack Protection'],
  CrowdStrike: ['Falcon Insight EDR', 'Falcon Identity Protection', 'Falcon Cloud'],
  Okta: ['Workforce Identity', 'Customer Identity'],
  'Nuance Communications': ['PowerScribe One', 'DAX Copilot', 'Dragon Medical'],
  'Change Healthcare': ['Claims Clearinghouse', 'Eligibility Verification'],
  Intelerad: ['InteleOne', 'InteleViewer'],
  Aidoc: ['aiOS Platform', 'ICH Module', 'PE Module'],
  'Rad AI': ['Omni Reporting', 'Impressions'],
  Microsoft: ['Azure Consumption', 'M365 E5 Licensing', 'Azure OpenAI'],
  'R1 RCM': ['End-to-End RCM', 'Patient Access Services'],
};
const vendorProductServices = [];
for (const v of vendors) {
  const lines = productLines[v.rpvms_vendorname] || [v.rpvms_primaryoffering];
  const count = Math.min(
    lines.length,
    between(config.productsPerVendorRange[0], config.productsPerVendorRange[1]),
  );
  for (let i = 0; i < count; i++) {
    const line = lines[i % lines.length];
    vendorProductServices.push({
      _nk: nk([v.rpvms_vendorname, line]),
      _vendor: v._nk,
      rpvms_vendorproductservicename: line,
      rpvms_category: v.rpvms_categoryl2,
    });
  }
}

// ── VendorNameAlias ────────────────────────────────────────────────────────
const aliasCandidates = {
  CrowdStrike: ['Crowdstrike Inc', 'CROWDSTRIKE, INC.', 'Crowd Strike'],
  VMware: ['VMware LLC', 'VMWARE, INC.'],
  NetApp: ['Net App Inc', 'NETAPP INC'],
  'Pure Storage': ['PureStorage', 'Pure Storage Inc'],
  Microsoft: ['MSFT', 'Microsoft Corp', 'Microsoft Corporation'],
  'Cyderes Google Chronicle': ['Cyderes', 'Google Chronicle', 'Chronicle Security'],
  'Nuance Communications': ['Nuance Comm', 'NUANCE COMMUNICATIONS, INC.'],
  'Change Healthcare': ['ChangeHealthcare', 'Change Healthcare Inc'],
  'Spectrum Enterprise': ['Charter Spectrum', 'Spectrum Business'],
  'Rad AI': ['RadAI', 'Rad AI Inc'],
};
const vendorNameAliases = [];
for (const v of vendors) {
  const aliases = aliasCandidates[v.rpvms_vendorname];
  if (!aliases) continue;
  const count = between(config.aliasesPerVendorRange[0], Math.min(config.aliasesPerVendorRange[1], aliases.length));
  for (let i = 0; i < count; i++) {
    const a = aliases[i];
    vendorNameAliases.push({
      _nk: nk([v.rpvms_vendorname, a]),
      _vendor: v._nk,
      rpvms_vendornamealiasname: a,
      rpvms_sourcesystem: pick(['Workday', 'ServiceNow', 'Legal CLM']),
      rpvms_reviewedby: 'procurement.ops@example-rp.com',
      rpvms_reviewedon: isoDate(daysAgo(between(15, 365))),
    });
  }
}

// ── Contracts + ContractParties ────────────────────────────────────────────
const contracts = [];
const contractParties = [];
let documentIdSeq = 10000;
let matterIdSeq = 20000;
for (const v of vendors) {
  const n = between(config.contractsPerVendorRange[0], config.contractsPerVendorRange[1]);
  for (let i = 0; i < n; i++) {
    const type = pick([
      'Master Services Agreement',
      'Statement of Work',
      'Order Form',
      'License Agreement',
      'BAA',
      'Amendment',
    ]);
    const eff = dateInFY(2023 + Math.floor(rng() * 3));
    const exp = new Date(eff);
    exp.setUTCFullYear(exp.getUTCFullYear() + between(1, 3));
    const status = exp < new Date() ? 'Expired' : rng() < 0.08 ? 'Under Review' : 'Active';
    const contractNumber = `CN-${pad(documentIdSeq, 6)}`;
    const supplierName = vendorToSupplierName.get(v.rpvms_vendorname);
    const rpEntity = pick(config.rpEntities);
    const contract = {
      _nk: nk([contractNumber]),
      _vendor: v._nk,
      _supplier: nk([supplierName]),
      rpvms_contractname: contractNumber,
      rpvms_documentid: documentIdSeq++,
      rpvms_matterid: matterIdSeq++,
      rpvms_matterfullname: `${v.rpvms_vendorname} — ${type}${i > 0 ? ` #${i + 1}` : ''}`,
      rpvms_mattershortname: `${v.rpvms_vendorname.slice(0, 18)} ${type.slice(0, 3).toUpperCase()}`,
      rpvms_contractingentityname: rpEntity,
      rpvms_practicename: pick(config.rpLocalPractices),
      rpvms_contracttype: opt('rpvms_contracttype', type),
      rpvms_subcontracttype: type === 'Statement of Work' ? pick(['Time & Materials', 'Fixed Fee']) : '',
      rpvms_contractstatus: opt('rpvms_contractstatus', status),
      rpvms_effectivedate: isoDate(eff),
      rpvms_expirationdate: isoDate(exp),
      rpvms_noticedate: isoDate(new Date(exp.getTime() - 90 * 24 * 3600 * 1000)),
      rpvms_datesigned: isoDate(new Date(eff.getTime() - 14 * 24 * 3600 * 1000)),
      rpvms_autorenew: opt('rpvms_yesnona', rng() < 0.4 ? 'Yes' : 'No'),
      rpvms_autorenewaldetails: rng() < 0.4 ? 'Auto-renews annually unless cancelled 90 days prior.' : '',
      rpvms_amended: opt('rpvms_yesnona', rng() < 0.15 ? 'Yes' : 'No'),
      rpvms_terminationwithoutcause: opt('rpvms_yesnona', rng() < 0.3 ? 'Yes' : 'No'),
      rpvms_terminationnoticedetail: '',
      rpvms_othersignificantterms: rng() < 0.2 ? 'Contains MFN clause and audit rights.' : '',
    };
    contracts.push(contract);

    // Parties: CP1 RP entity, CP2 vendor, CP3 reseller supplier (if VAR).
    contractParties.push({
      _nk: nk([contractNumber, 'CP1']),
      _contract: contract._nk,
      _vendor: null,
      _supplier: null,
      rpvms_contractpartyname: rpEntity,
      rpvms_partyname: rpEntity,
      rpvms_partyslot: opt('rpvms_partyslot', 'Other1'),
      rpvms_partytargettype: opt('rpvms_partytargettype', 'Vendor'),
    });
    contractParties.push({
      _nk: nk([contractNumber, 'CP2']),
      _contract: contract._nk,
      _vendor: v._nk,
      _supplier: null,
      rpvms_contractpartyname: v.rpvms_vendorname,
      rpvms_partyname: v.rpvms_vendorname,
      rpvms_partyslot: opt('rpvms_partyslot', 'Other2'),
      rpvms_partytargettype: opt('rpvms_partytargettype', 'Vendor'),
    });
    if (v.rpvms_isvar) {
      contractParties.push({
        _nk: nk([contractNumber, 'CP3']),
        _contract: contract._nk,
        _vendor: null,
        _supplier: nk([supplierName]),
        rpvms_contractpartyname: supplierName,
        rpvms_partyname: supplierName,
        rpvms_partyslot: opt('rpvms_partyslot', 'Other3'),
        rpvms_partytargettype: opt('rpvms_partytargettype', 'Supplier'),
      });
    }
  }
}

// ── GL Transactions ────────────────────────────────────────────────────────
const glTransactions = [];
let journalSeq = 900000;
const costCenters = [
  { code: 4101, name: 'Clinical Operations' },
  { code: 4210, name: 'Imaging AI Platform' },
  { code: 5001, name: 'IT Infrastructure' },
  { code: 5002, name: 'Information Security' },
  { code: 5100, name: 'RCM Operations' },
  { code: 6001, name: 'Corporate Services' },
];
const ledgerAccounts = [
  { code: '62100', name: 'Software & Subscriptions' },
  { code: '62200', name: 'Professional Services' },
  { code: '62300', name: 'Hardware & Equipment' },
  { code: '62400', name: 'Telecom & Network' },
  { code: '62500', name: 'Clinical Technology' },
];
function misspell(name) {
  if (name.length < 4) return name;
  const i = between(1, name.length - 2);
  const swap = name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2);
  return rng() < 0.5 ? swap.toUpperCase() : swap;
}
for (const v of vendors) {
  const supplierName = vendorToSupplierName.get(v.rpvms_vendorname);
  const count = between(config.glRowsPerVendorRange[0], config.glRowsPerVendorRange[1]);
  for (let i = 0; i < count; i++) {
    const year = rng() < 0.6 ? config.currentFiscalYear : config.priorFiscalYears[0];
    const acct = dateInFY(year);
    const posted = new Date(acct.getTime() + between(1, 12) * 24 * 3600 * 1000);
    const fpe = new Date(Date.UTC(year, acct.getUTCMonth() + 1, 0));
    const ledger = pick(ledgerAccounts);
    const cc = pick(costCenters);
    const debit = +Math.abs(jitter(
      v.rpvms_categoryl1 === 'IT Infrastructure' ? 18000 : 8500,
      0.9,
    )).toFixed(2);
    const credit = 0;
    const net = debit;
    const paymentStatus = weightedPick(config.glPaymentStatusMix);
    const unpaid = paymentStatus === 'Paid' ? 0 : paymentStatus === 'Partial' ? +(net * 0.4).toFixed(2) : net;
    const journalNumber = `JE${pad(journalSeq++, 7)}`;
    const journalLine = String(between(1, 40));
    const supplierRaw = rng() < config.misspellRate ? misspell(supplierName) : supplierName;
    glTransactions.push({
      _nk: nk([journalNumber, journalLine, year]),
      _supplier: nk([supplierName]),
      rpvms_gltransactionname: `${journalNumber}-${journalLine}`,
      rpvms_workdayid: `WD${pad(journalSeq * 3 + i, 9)}`,
      rpvms_journalline: journalLine,
      rpvms_fiscalyear: year,
      rpvms_suppliernameraw: supplierRaw,
      rpvms_accountingdate: isoDate(acct),
      rpvms_posteddate: isoDate(posted),
      rpvms_fiscalperiodenddate: isoDate(fpe),
      rpvms_journalnumber: journalNumber,
      rpvms_journalsource: pick(['AP', 'GL', 'Expenses', 'Intercompany']),
      rpvms_status: opt('rpvms_glstatus', weightedPick(config.glStatusMix)),
      rpvms_paymentstatus: opt('rpvms_paymentstatus', paymentStatus),
      rpvms_supplierinvoicenumber: `INV-${pad(between(1000, 999999), 6)}`,
      rpvms_supplierinvoicedate: isoDate(new Date(acct.getTime() - between(1, 30) * 24 * 3600 * 1000)),
      rpvms_ledgeraccount: ledger.code,
      rpvms_accountname: ledger.name,
      rpvms_debitamount: debit,
      rpvms_creditamount: credit,
      rpvms_netamount: net,
      rpvms_unpaidamount: unpaid,
      rpvms_currency: 'USD',
      rpvms_company: pick(config.rpEntities),
      rpvms_costcenter: String(cc.code),
      rpvms_localpracticename: pick(config.rpLocalPractices),
      rpvms_divisionname: pick(config.rpDivisions),
      rpvms_spendcategory: v.rpvms_categoryl2,
      rpvms_linememo: `${v.rpvms_vendorname} ${ledger.name.toLowerCase()} — ${cc.name}`,
      rpvms_headermemo: `FY${year} ${ledger.name}`,
    });
  }
}

// Aggregate GL per vendor/year for budget reconciliation.
const glByVendorYear = {};
for (const gl of glTransactions) {
  const v = [...vendorToSupplierName.entries()].find(([, s]) => nk([s]) === gl._supplier)?.[0];
  if (!v) continue;
  const key = `${v}::${gl.rpvms_fiscalyear}`;
  glByVendorYear[key] = (glByVendorYear[key] || 0) + gl.rpvms_netamount;
}

// ── OneTrust Assessments ───────────────────────────────────────────────────
const oneTrust = [];
for (const v of vendors) {
  const needs = ['Clinical', 'Security'].includes(
    plan.optionSets.find((o) => o.name === 'rpvms_classification').options.find((x) => x.value === v.rpvms_classification)?.label,
  ) || v.rpvms_activephiaccess === opt('rpvms_yesnona', 'Yes');
  if (!needs) continue;
  const critLabel = pick(['2 - Low', '3 - Noticeable', '4 - Considerable', '5 - Catastrophic']);
  oneTrust.push({
    _nk: nk([v.rpvms_vendorname, 'onetrust']),
    _vendor: v._nk,
    rpvms_onetrustassessmentname: `OT-${v.rpvms_vendorname.slice(0, 12)}`,
    rpvms_type: 'Third-Party Risk Assessment',
    rpvms_productservice: v.rpvms_primaryoffering,
    rpvms_classification: v.rpvms_classification,
    rpvms_criticality: opt('rpvms_criticalitylevel', critLabel),
    rpvms_ephi: v.rpvms_activephiaccess,
    rpvms_integrations: pick(['Epic', 'Workday', 'Entra ID / Okta', 'ServiceNow', 'Azure AD', 'None']),
    rpvms_systemaccess: opt('rpvms_systemaccess', pick(['None', 'Read', 'Read/Write', 'Admin'])),
  });
}

// ── ServiceNow Assessments ─────────────────────────────────────────────────
const serviceNow = [];
let snSeq = 100000;
for (const v of vendors) {
  const include = ['Clinical', 'Security', 'IT Infrastructure'].includes(
    plan.optionSets.find((o) => o.name === 'rpvms_classification').options.find((x) => x.value === v.rpvms_classification)?.label,
  );
  if (!include) continue;
  const critLabel = pick(['3 - Noticeable', '4 - Considerable', '5 - Catastrophic']);
  const cc = pick(costCenters);
  serviceNow.push({
    _nk: nk([v.rpvms_vendorname, 'servicenow']),
    _vendor: v._nk,
    rpvms_servicenowassessmentname: `SN-${pad(snSeq, 6)}`,
    rpvms_snnumber1: `RITM${pad(snSeq++, 7)}`,
    rpvms_assessmenttype: opt('rpvms_assessmenttype', pick(['Criticality', 'Performance'])),
    rpvms_vendornameraw: rng() < config.misspellRate ? misspell(v.rpvms_vendorname) : v.rpvms_vendorname,
    rpvms_criticalitylevel: opt('rpvms_criticalitylevel', critLabel),
    rpvms_itsponsor: pick(['Jane Park', 'Derek Hollis', 'Marcus Obi', 'Priya Rangan', 'Chris Yoon']),
    rpvms_vendorrepname: `${pick(['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan'])} ${pick(['Lee', 'Patel', 'Garcia', 'Nguyen', 'Smith'])}`,
    rpvms_vendorrepemail: `vendorrep@${v.rpvms_vendorname.toLowerCase().replace(/[^a-z]/g, '')}-example.com`,
    rpvms_vendorreptitle: pick(['Account Exec', 'Customer Success Mgr', 'Engagement Director']),
    rpvms_vendormailingaddress: `${between(100, 9000)} Market St, Suite ${between(100, 999)}, ${pick(['El Segundo CA', 'Austin TX', 'Denver CO', 'Chicago IL'])}`,
    rpvms_isbudgeted: opt('rpvms_yesnona', rng() < 0.7 ? 'Yes' : 'No'),
    rpvms_budgetedcostcenter: String(cc.code),
    rpvms_impactedcostcenter: String(pick(costCenters).code),
    rpvms_productservicetype: v.rpvms_categoryl2,
    rpvms_requestscope: pick(['New subscription', 'Renewal', 'Expansion', 'Replacement']),
    rpvms_relatedlocalpractice: pick(config.rpLocalPractices),
    rpvms_relatedrpdepartment: pick(['Clinical IT', 'InfoSec', 'Infrastructure', 'RCM', 'Corporate']),
    rpvms_costcentername: cc.name,
    rpvms_costcentercode: cc.code,
    rpvms_perfoverallreliability: pick(['Meets expectations', 'Exceeds expectations', 'Below expectations']),
    rpvms_perfissuehandling: pick(['Responsive', 'Adequate', 'Needs improvement']),
    rpvms_perfsupportsatisfaction: pick(['High', 'Medium', 'Low']),
    rpvms_perfcontractchangereq: pick(['Smooth', 'Delayed', 'Escalated']),
  });
}

// ── VendorScore (2 years) ──────────────────────────────────────────────────
const vendorScores = [];
for (const v of vendors) {
  for (const y of config.scoreYears) {
    const crit = between(2, 5);
    const dep = between(2, 5);
    const spend = between(1, 5);
    const val = between(2, 5);
    const align = between(2, 5);
    const weighted = +((crit * 0.3 + dep * 0.25 + spend * 0.2 + val * 0.15 + align * 0.1)).toFixed(2);
    const wtCritDep = +((crit * 0.55 + dep * 0.45)).toFixed(2);
    const topCc = pick(costCenters).code;
    vendorScores.push({
      _nk: nk([v.rpvms_vendorname, 'score', y]),
      _vendor: v._nk,
      rpvms_vendorscorename: `${v.rpvms_vendorname} FY${y}`,
      rpvms_scoreyear: y,
      rpvms_criticalityscore: crit,
      rpvms_dependencyscore: dep,
      rpvms_spendscore: spend,
      rpvms_valuescore: val,
      rpvms_alignmentscore: align,
      rpvms_weightedscore: weighted,
      rpvms_wtscorecritdeponly: wtCritDep,
      rpvms_topspendcostcenter: topCc,
      rpvms_status: v.rpvms_status,
      rpvms_comment: weighted >= 4 ? 'High-criticality / strategic' : weighted <= 2.5 ? 'Low priority — review consolidation' : 'Standard operational vendor',
    });
  }
}

// ── VendorBudget (current year) ────────────────────────────────────────────
const vendorBudgets = [];
for (const v of vendors) {
  // Budgets only for vendors with > $10k in FY spend, to simulate "tracked" budgets.
  const spendKey = `${v.rpvms_vendorname}::${config.currentFiscalYear}`;
  const actual = glByVendorYear[spendKey] || 0;
  if (actual < 10000 && rng() < 0.5) continue;
  const budgetAmount = +(actual * (1 + (rng() * 0.2 - 0.05))).toFixed(2);
  vendorBudgets.push({
    _nk: nk([v.rpvms_vendorname, 'budget', config.currentFiscalYear]),
    _vendor: v._nk,
    rpvms_vendorbudgetname: `${v.rpvms_vendorname} FY${config.currentFiscalYear}`,
    rpvms_budgetyear: config.currentFiscalYear,
    rpvms_rating: between(1, 5),
    rpvms_description: pick(config.budgetDescriptions),
    rpvms_supplierspend: budgetAmount,
    rpvms_pctoftotalspend: +(rng() * 6).toFixed(2),
    rpvms_quintilerating: opt('rpvms_quintilerating', pick(['Q1 - Top 20%', 'Q2 - 20-40%', 'Q3 - 40-60%', 'Q4 - 60-80%', 'Q5 - Bottom 20%'])),
  });
}

// ── VendorRateCard ─────────────────────────────────────────────────────────
const vendorRateCards = [];
for (const vName of config.rateCardVendors) {
  const v = vendors.find((x) => x.rpvms_vendorname === vName);
  if (!v) continue;
  for (const p of config.rateCardPositions) {
    const jitterPct = rng() * 0.15;
    const mn = +(p.minRate * (1 + jitterPct)).toFixed(2);
    const mx = +(p.maxRate * (1 + jitterPct)).toFixed(2);
    const avg = +((mn + mx) / 2).toFixed(2);
    vendorRateCards.push({
      _nk: nk([vName, p.normalized, config.rateCardYear]),
      _vendor: v._nk,
      rpvms_vendorratecardname: `${vName} — ${p.normalized} FY${config.rateCardYear}`,
      rpvms_ratecardyear: config.rateCardYear,
      rpvms_originalposition: p.original,
      rpvms_normalizedposition: p.normalized,
      rpvms_positioncategory: p.category,
      rpvms_locationtype: opt('rpvms_locationtype', pick(['Onshore', 'Nearshore', 'Offshore', 'Hybrid', 'Remote'])),
      rpvms_experiencelevel: opt('rpvms_experiencelevel', pick(['Mid', 'Senior', 'Expert'])),
      rpvms_experienceyears: pick(['3-5', '5-8', '8-12', '12+']),
      rpvms_minrate: mn,
      rpvms_maxrate: mx,
      rpvms_avgrate: avg,
      rpvms_notes: 'Rates in USD / hour, exclusive of travel and pass-through.',
      rpvms_demonotes: 'Demo-seed record for UX iteration.',
    });
  }
}

// ── Write ──────────────────────────────────────────────────────────────────
const output = {
  _generatedAt: new Date().toISOString(),
  _config: config,
  vendors,
  suppliers,
  vendorSuppliers,
  vendorProductServices,
  vendorNameAliases,
  contracts,
  contractParties,
  glTransactions,
  oneTrust,
  serviceNow,
  vendorScores,
  vendorBudgets,
  vendorRateCards,
};

fs.mkdirSync(SEED_DIR, { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

console.log(`✓ Wrote ${OUT_PATH}`);
console.log(`  vendors             ${vendors.length}`);
console.log(`  suppliers           ${suppliers.length}`);
console.log(`  vendor↔supplier     ${vendorSuppliers.length}`);
console.log(`  products/services   ${vendorProductServices.length}`);
console.log(`  name aliases        ${vendorNameAliases.length}`);
console.log(`  contracts           ${contracts.length}`);
console.log(`  contract parties    ${contractParties.length}`);
console.log(`  GL transactions     ${glTransactions.length}`);
console.log(`  onetrust            ${oneTrust.length}`);
console.log(`  servicenow          ${serviceNow.length}`);
console.log(`  vendor scores       ${vendorScores.length}`);
console.log(`  vendor budgets      ${vendorBudgets.length}`);
console.log(`  rate cards          ${vendorRateCards.length}`);
