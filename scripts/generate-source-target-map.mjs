// Generate docs/fabric-source-to-target-map.xlsx from planning-payload.json.
// Single-source-of-truth for the Fabric → Dataverse ingestion build: the
// Columns sheet lists every target rpvms_* column with its Source System,
// Bronze/Silver/Gold provenance, DQ rule, and option-set linkage.
//
// Regenerate with:  node scripts/generate-source-target-map.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(__filename), '..');
const PLAN = JSON.parse(
  fs.readFileSync(path.join(REPO, 'dataverse', 'planning-payload.json'), 'utf8'),
);
const OUT = path.join(REPO, 'docs', 'fabric-source-to-target-map.xlsx');

// ── Wave assignment (drives execution order) ────────────────────────────────
const WAVES = {
  rpvms_vendor: 1,
  rpvms_supplier: 1,
  rpvms_vendornamealias: 1,
  rpvms_vendorsupplier: 2,
  rpvms_vendorproductservice: 2,
  rpvms_contract: 3,
  rpvms_contractparty: 3,
  rpvms_gltransaction: 4,
  rpvms_onetrustassessment: 4,
  rpvms_servicenowassessment: 4,
  rpvms_vendorscore: 4,
  rpvms_vendorbudget: 4,
  rpvms_vendorratecard: 4,
};

// ── Per-table defaults applied to all columns on that table ─────────────────
const TABLE_DEFAULTS = {
  rpvms_vendor:                { src: 'Internal Vendor Master', bronze: 'bronze.vendor_master',       silver: 'silver.dim_vendor',             gold: 'gold.gold_rpvms_vendor',             reject: 'reject_vendor_schema' },
  rpvms_supplier:              { src: 'Workday',                bronze: 'bronze.workday_suppliers',   silver: 'silver.dim_supplier',           gold: 'gold.gold_rpvms_supplier',           reject: 'reject_supplier_schema' },
  rpvms_vendornamealias:       { src: 'Curated',                bronze: 'bronze.vendor_aliases',      silver: 'silver.dim_vendor_alias',       gold: 'gold.gold_rpvms_namealias',          reject: 'reject_namealias_schema' },
  rpvms_vendorsupplier:        { src: 'Reseller-VAR.xlsx',      bronze: 'bronze.reseller_var',        silver: 'silver.dim_var_relationship',   gold: 'gold.gold_rpvms_vendorsupplier',     reject: 'reject_vendorsupplier_schema' },
  rpvms_vendorproductservice:  { src: 'OneTrust + VAR xlsx',    bronze: 'bronze.onetrust_export',     silver: 'silver.dim_vendor_product',      gold: 'gold.gold_rpvms_vps',                reject: 'reject_vps_schema' },
  rpvms_contract:              { src: 'CSC Legal Register',     bronze: 'bronze.csc_legal_register',  silver: 'silver.dim_contract',           gold: 'gold.gold_rpvms_contract',           reject: 'reject_contract_schema' },
  rpvms_contractparty:         { src: 'CSC Legal Register',     bronze: 'bronze.csc_legal_register',  silver: 'silver.dim_contract_party',     gold: 'gold.gold_rpvms_contractparty',      reject: 'reject_contractparty_schema' },
  rpvms_gltransaction:         { src: 'Workday',                bronze: 'bronze.workday_gl',          silver: 'silver.fact_gl_resolved',       gold: 'gold.gold_rpvms_gl',                 reject: 'reject_gl_schema' },
  rpvms_onetrustassessment:    { src: 'OneTrust',               bronze: 'bronze.onetrust_export',     silver: 'silver.dim_onetrust',           gold: 'gold.gold_rpvms_onetrust',           reject: 'reject_onetrust_schema' },
  rpvms_servicenowassessment:  { src: 'ServiceNow',             bronze: 'bronze.servicenow_export',   silver: 'silver.dim_servicenow',         gold: 'gold.gold_rpvms_servicenow',         reject: 'reject_servicenow_schema' },
  rpvms_vendorscore:           { src: 'Internal Scoring Model', bronze: 'bronze.vendor_scores',       silver: 'silver.fact_vendor_score',      gold: 'gold.gold_rpvms_vendorscore',        reject: 'reject_vendorscore_schema' },
  rpvms_vendorbudget:          { src: 'FP&A',                   bronze: 'bronze.vendor_budget',       silver: 'silver.fact_vendor_budget',     gold: 'gold.gold_rpvms_vendorbudget',       reject: 'reject_vendorbudget_schema' },
  rpvms_vendorratecard:        { src: 'Staffing PMO',           bronze: 'bronze.vendor_ratecards',    silver: 'silver.dim_vendor_ratecard',    gold: 'gold.gold_rpvms_vendorratecard',     reject: 'reject_vendorratecard_schema' },
};

// ── Curated per-column overrides.  Key = "table.column".  Anything not listed
//    falls through to the table default + type-based defaults below. ─────────
const OVERRIDES = {
  // ── rpvms_vendor ──────────────────────────────────────────────────────────
  'rpvms_vendor.rpvms_vendorname':      { srcCol: 'vendor_name_raw',       transform: 'trim + upper + alias-resolve',    dq: '2<=LEN<=200; unique',                 nullPolicy: 'Reject row',    reject: 'reject_vendor_unresolved' },
  'rpvms_vendor.rpvms_categoryl1':      { srcCol: 'category_l1',           transform: 'passthrough',                     dq: 'LEN<=100',                            nullPolicy: 'Allow' },
  'rpvms_vendor.rpvms_categoryl2':      { srcCol: 'category_l2',           transform: 'passthrough',                     dq: 'LEN<=100',                            nullPolicy: 'Allow' },
  'rpvms_vendor.rpvms_commercialrole':  { srcCol: 'commercial_role',       transform: 'normalize to enum',               dq: "IN ('Direct','Reseller','VAR')",       nullPolicy: "Default 'Direct'" },
  'rpvms_vendor.rpvms_primaryoffering': { srcCol: 'primary_offering',      transform: 'passthrough',                     dq: 'LEN<=200',                            nullPolicy: 'Allow' },
  'rpvms_vendor.rpvms_classification':  { srcCol: 'classification',        transform: 'normalize to enum',               dq: "IN ('Tier 1'..'Tier 4')",              nullPolicy: "Default 'Tier 3'" },
  'rpvms_vendor.rpvms_isvar':           { srcCol: 'is_var',                transform: 'derived from VAR xlsx join',      dq: 'BIT',                                  nullPolicy: 'Default false' },
  'rpvms_vendor.rpvms_status':          { srcCol: 'status',                transform: 'normalize to enum',               dq: "IN ('Active','Under Review','Inactive','Terminated')", nullPolicy: "Default 'Active'" },
  'rpvms_vendor.rpvms_activephiaccess': { src: 'OneTrust', srcCol: 'active_phi_access', transform: 'normalize',           dq: "IN ('Yes','No','Unknown')",            nullPolicy: "Default 'Unknown'" },

  // ── rpvms_supplier ────────────────────────────────────────────────────────
  'rpvms_supplier.rpvms_suppliername':     { srcCol: 'supplier_name',       transform: 'trim + upper',                    dq: '2<=LEN<=200; unique',                 nullPolicy: 'Reject row' },
  'rpvms_supplier.rpvms_supplierid':       { srcCol: 'workday_supplier_id', transform: 'passthrough', dq: 'LEN<=50',                                                nullPolicy: 'Allow',
                                              notes: 'NOTE: column collides with Dataverse auto-PK rpvms_supplierid; currently dropped from schema — retained in Silver for lineage only' },
  'rpvms_supplier.rpvms_suppliercategory': { srcCol: 'supplier_category',   transform: 'passthrough',                     dq: 'LEN<=100',                            nullPolicy: 'Allow' },
  'rpvms_supplier.rpvms_tintype':          { srcCol: 'tin_type',            transform: 'normalize',                       dq: "IN ('EIN','SSN','Foreign')",           nullPolicy: 'Allow' },
  'rpvms_supplier.rpvms_taxid':            { srcCol: 'tax_id',              transform: 'digit-normalize + mask in non-secure views', dq: 'regex ^\\d{2}-?\\d{7}$',   nullPolicy: 'Allow', notes: 'PII: masked outside secure Gold workspace' },
  'rpvms_supplier.rpvms_isreseller':       { srcCol: 'is_reseller',         transform: 'derived from VAR xlsx + category', dq: 'BIT',                                 nullPolicy: 'Default false' },

  // ── rpvms_vendornamealias ────────────────────────────────────────────────
  'rpvms_vendornamealias.rpvms_vendornamealiasname': { srcCol: 'alias_variant',  transform: 'trim + upper',  dq: '1<=LEN<=200', nullPolicy: 'Reject row' },
  'rpvms_vendornamealias.rpvms_vendorid':            { srcCol: 'canonical_vendor_name', transform: 'alias-resolve + DV lookup', dq: 'must resolve', nullPolicy: 'Reject row', reject: 'reject_alias_unresolved_vendor' },
  'rpvms_vendornamealias.rpvms_sourcesystem':        { srcCol: 'source_system',  transform: 'passthrough',   dq: "IN ('Workday','OneTrust','ServiceNow','CSC','Manual')", nullPolicy: 'Reject row' },
  'rpvms_vendornamealias.rpvms_reviewedby':          { srcCol: 'reviewed_by',    transform: 'email address', dq: 'email format', nullPolicy: 'Allow' },
  'rpvms_vendornamealias.rpvms_reviewedon':          { srcCol: 'reviewed_on',    transform: 'UTC ISO-8601',  dq: 'datetime',     nullPolicy: 'Allow' },

  // ── rpvms_vendorsupplier ─────────────────────────────────────────────────
  'rpvms_vendorsupplier.rpvms_vendorsuppliername':     { srcCol: "'{vendor}' + ' ↔ ' + '{supplier}'", transform: 'compose',           dq: 'unique',                       nullPolicy: 'Reject row' },
  'rpvms_vendorsupplier.rpvms_vendorid':               { srcCol: 'vendor_canonical_name', transform: 'alias-resolve + DV lookup',    dq: 'must resolve',                 nullPolicy: 'Reject row', reject: 'reject_vs_unresolved_vendor' },
  'rpvms_vendorsupplier.rpvms_supplierid':             { srcCol: 'supplier_name',         transform: 'exact match on supplier name', dq: 'must resolve',                 nullPolicy: 'Reject row', reject: 'reject_vs_unresolved_supplier' },
  'rpvms_vendorsupplier.rpvms_relationshiptype':       { srcCol: 'relationship_type',     transform: 'normalize',                    dq: "IN ('Direct','VAR-Reseller','Subcontractor')", nullPolicy: "Default 'Direct'" },
  'rpvms_vendorsupplier.rpvms_productsservicescovered':{ srcCol: 'products_services',     transform: 'concat distinct',              dq: 'LEN<=2000',                    nullPolicy: 'Allow' },
  'rpvms_vendorsupplier.rpvms_effectivefrom':          { srcCol: 'effective_from',        transform: 'date parse',                   dq: 'datetime',                     nullPolicy: 'Default earliest GL date' },
  'rpvms_vendorsupplier.rpvms_effectiveto':            { srcCol: 'effective_to',          transform: 'date parse',                   dq: 'datetime; >= effectivefrom',   nullPolicy: 'Allow null (open-ended)' },

  // ── rpvms_vendorproductservice ────────────────────────────────────────────
  'rpvms_vendorproductservice.rpvms_vendorproductservicename': { srcCol: "'{vendor}' + ' - ' + '{product}'", transform: 'compose', dq: 'unique', nullPolicy: 'Reject row' },
  'rpvms_vendorproductservice.rpvms_vendorid':                 { srcCol: 'vendor_canonical_name',            transform: 'alias-resolve + DV lookup', dq: 'must resolve', nullPolicy: 'Reject row', reject: 'reject_vps_unresolved_vendor' },
  'rpvms_vendorproductservice.rpvms_category':                 { srcCol: 'product_category',                 transform: 'passthrough', dq: 'LEN<=100', nullPolicy: 'Allow' },

  // ── rpvms_contract ────────────────────────────────────────────────────────
  'rpvms_contract.rpvms_contractname':           { srcCol: 'contract_title',      transform: 'trim',          dq: '1<=LEN<=200', nullPolicy: 'Reject row' },
  'rpvms_contract.rpvms_supplierid':             { srcCol: 'counterparty_name',   transform: 'alias-resolve + DV lookup', dq: 'must resolve', nullPolicy: 'Reject row', reject: 'reject_contract_unresolved_supplier' },
  'rpvms_contract.rpvms_documentid':             { srcCol: 'document_id',         transform: 'cast int',      dq: '>0; unique across CSC', nullPolicy: 'Reject row', notes: 'Alternate key candidate' },
  'rpvms_contract.rpvms_matterid':               { srcCol: 'matter_id',           transform: 'cast int',      dq: '>0', nullPolicy: 'Allow' },
  'rpvms_contract.rpvms_matterfullname':         { srcCol: 'matter_full_name',    transform: 'trim',          dq: 'LEN<=500', nullPolicy: 'Allow' },
  'rpvms_contract.rpvms_mattershortname':        { srcCol: 'matter_short_name',   transform: 'trim',          dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_contract.rpvms_contractingentityname':  { srcCol: 'rp_entity',           transform: 'trim',          dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_contract.rpvms_practicename':           { srcCol: 'practice_name',       transform: 'trim',          dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_contract.rpvms_contracttype':           { srcCol: 'contract_type',       transform: 'normalize',     dq: 'IN option set', nullPolicy: 'Allow' },
  'rpvms_contract.rpvms_subcontracttype':        { srcCol: 'subcontract_type',    transform: 'passthrough',   dq: 'LEN<=100', nullPolicy: 'Allow' },
  'rpvms_contract.rpvms_contractstatus':         { srcCol: 'status',              transform: 'normalize',     dq: "IN ('Executed','Pending','Terminated','Expired')", nullPolicy: "Default 'Executed'" },
  'rpvms_contract.rpvms_effectivedate':          { srcCol: 'effective_date',      transform: 'date parse',    dq: 'datetime', nullPolicy: 'Allow' },
  'rpvms_contract.rpvms_expirationdate':         { srcCol: 'expiration_date',     transform: 'date parse',    dq: 'datetime; >= effectivedate', nullPolicy: 'Allow null (evergreen)' },
  'rpvms_contract.rpvms_noticedate':             { srcCol: 'notice_date',         transform: 'date parse',    dq: 'datetime', nullPolicy: 'Allow' },
  'rpvms_contract.rpvms_datesigned':             { srcCol: 'date_signed',         transform: 'date parse',    dq: 'datetime', nullPolicy: 'Allow' },
  'rpvms_contract.rpvms_autorenew':              { srcCol: 'auto_renew',          transform: 'normalize',     dq: "IN ('Yes','No','Unknown')", nullPolicy: "Default 'Unknown'" },
  'rpvms_contract.rpvms_autorenewaldetails':     { srcCol: 'auto_renewal_detail', transform: 'passthrough',   dq: 'LEN<=4000', nullPolicy: 'Allow' },
  'rpvms_contract.rpvms_amended':                { srcCol: 'amended',             transform: 'normalize',     dq: "IN ('Yes','No','Unknown')", nullPolicy: "Default 'No'" },
  'rpvms_contract.rpvms_terminationwithoutcause':{ srcCol: 'termination_wo_cause',transform: 'normalize',     dq: "IN ('Yes','No','Unknown')", nullPolicy: "Default 'Unknown'" },
  'rpvms_contract.rpvms_terminationnoticedetail':{ srcCol: 'termination_detail',  transform: 'passthrough',   dq: 'LEN<=4000', nullPolicy: 'Allow' },
  'rpvms_contract.rpvms_othersignificantterms':  { srcCol: 'other_terms',         transform: 'passthrough',   dq: 'LEN<=4000', nullPolicy: 'Allow' },

  // ── rpvms_contractparty ──────────────────────────────────────────────────
  'rpvms_contractparty.rpvms_contractpartyname': { srcCol: "'{contract_title}' + '#' + '{party_slot}'", transform: 'compose', dq: 'unique', nullPolicy: 'Reject row' },
  'rpvms_contractparty.rpvms_contractid':        { srcCol: 'document_id',       transform: 'DV lookup on Contract document id', dq: 'must resolve', nullPolicy: 'Reject row' },
  'rpvms_contractparty.rpvms_vendorid':          { srcCol: 'party_name_if_vendor',   transform: 'alias-resolve + DV lookup (optional)', dq: 'optional', nullPolicy: 'Allow null' },
  'rpvms_contractparty.rpvms_supplierid':        { srcCol: 'party_name_if_supplier', transform: 'supplier name + DV lookup (optional)', dq: 'optional', nullPolicy: 'Allow null' },
  'rpvms_contractparty.rpvms_partyname':         { srcCol: 'party_name',        transform: 'trim',        dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_contractparty.rpvms_partyslot':         { srcCol: 'party_slot',        transform: 'normalize',   dq: "IN ('CP1','CP2','CP3')", nullPolicy: 'Reject row' },
  'rpvms_contractparty.rpvms_partytargettype':   { srcCol: 'party_target_type', transform: 'normalize',   dq: "IN ('RP Entity','Vendor','Supplier','Other')", nullPolicy: 'Reject row' },

  // ── rpvms_gltransaction ──────────────────────────────────────────────────
  'rpvms_gltransaction.rpvms_gltransactionname':      { srcCol: "'{journal_number}' + '-' + '{journal_line}' + '-' + '{fy}'", transform: 'compose',    dq: 'unique', nullPolicy: 'Reject row', notes: 'Alt key = workdayid + journalline + fiscalyear' },
  'rpvms_gltransaction.rpvms_supplierid':             { srcCol: 'supplier_name_raw', transform: 'alias-resolve + DV lookup', dq: 'must resolve (else reject_vendor_unresolved)', nullPolicy: 'Reject row', reject: 'reject_vendor_unresolved' },
  'rpvms_gltransaction.rpvms_workdayid':              { srcCol: 'workday_id',        transform: 'passthrough',  dq: 'LEN<=50', nullPolicy: 'Reject row' },
  'rpvms_gltransaction.rpvms_journalline':            { srcCol: 'journal_line',      transform: 'passthrough',  dq: 'LEN<=50', nullPolicy: 'Reject row' },
  'rpvms_gltransaction.rpvms_fiscalyear':             { srcCol: 'fiscal_year',       transform: 'cast int',     dq: '2020<=fy<=current+1', nullPolicy: 'Reject row' },
  'rpvms_gltransaction.rpvms_suppliernameraw':        { srcCol: 'supplier_name_raw', transform: 'passthrough (retain for audit)', dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_accountingdate':         { srcCol: 'accounting_date',   transform: 'date parse',   dq: 'datetime', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_posteddate':             { srcCol: 'posted_date',       transform: 'date parse',   dq: 'datetime', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_fiscalperiodenddate':    { srcCol: 'fiscal_period_end', transform: 'date parse',   dq: 'datetime', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_journalnumber':          { srcCol: 'journal_number',    transform: 'passthrough',  dq: 'LEN<=50', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_journalsource':          { srcCol: 'journal_source',    transform: 'passthrough',  dq: 'LEN<=50', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_status':                 { srcCol: 'gl_status',         transform: 'normalize',    dq: "IN ('Posted','Pending','Reversed')", nullPolicy: "Default 'Posted'" },
  'rpvms_gltransaction.rpvms_paymentstatus':          { srcCol: 'payment_status',    transform: 'normalize',    dq: "IN ('Paid','Unpaid','Partial')", nullPolicy: "Default 'Unpaid'" },
  'rpvms_gltransaction.rpvms_supplierinvoicenumber':  { srcCol: 'supplier_inv_num',  transform: 'passthrough',  dq: 'LEN<=100', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_supplierinvoicedate':    { srcCol: 'supplier_inv_date', transform: 'date parse',   dq: 'datetime', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_ledgeraccount':          { srcCol: 'ledger_account',    transform: 'passthrough',  dq: 'LEN<=50', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_accountname':            { srcCol: 'account_name',      transform: 'passthrough',  dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_debitamount':            { srcCol: 'debit_amount',      transform: 'cast decimal', dq: '>=0', nullPolicy: 'Default 0' },
  'rpvms_gltransaction.rpvms_creditamount':           { srcCol: 'credit_amount',     transform: 'cast decimal', dq: '>=0', nullPolicy: 'Default 0' },
  'rpvms_gltransaction.rpvms_netamount':              { srcCol: 'net_amount',        transform: 'debit - credit',dq: 'decimal', nullPolicy: 'Default 0' },
  'rpvms_gltransaction.rpvms_unpaidamount':           { srcCol: 'unpaid_amount',     transform: 'cast decimal', dq: '>=0', nullPolicy: 'Default 0' },
  'rpvms_gltransaction.rpvms_currency':               { srcCol: 'currency_code',     transform: 'ISO-4217',     dq: "regex ^[A-Z]{3}$", nullPolicy: "Default 'USD'" },
  'rpvms_gltransaction.rpvms_company':                { srcCol: 'company',           transform: 'passthrough',  dq: 'LEN<=100', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_costcenter':             { srcCol: 'cost_center',       transform: 'passthrough',  dq: 'LEN<=50', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_localpracticename':      { srcCol: 'local_practice',    transform: 'passthrough',  dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_divisionname':           { srcCol: 'division',          transform: 'passthrough',  dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_spendcategory':          { srcCol: 'spend_category',    transform: 'passthrough',  dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_linememo':               { srcCol: 'line_memo',         transform: 'passthrough',  dq: 'LEN<=4000', nullPolicy: 'Allow' },
  'rpvms_gltransaction.rpvms_headermemo':             { srcCol: 'header_memo',       transform: 'passthrough',  dq: 'LEN<=4000', nullPolicy: 'Allow' },

  // ── rpvms_onetrustassessment ────────────────────────────────────────────
  'rpvms_onetrustassessment.rpvms_onetrustassessmentname': { srcCol: "'OT-' + '{vendor_canonical_name}'", transform: 'compose', dq: 'unique 1:1 with Vendor', nullPolicy: 'Reject row' },
  'rpvms_onetrustassessment.rpvms_vendorid':               { srcCol: 'vendor_name',   transform: 'alias-resolve + DV lookup', dq: 'must resolve',              nullPolicy: 'Reject row', reject: 'reject_onetrust_unresolved_vendor' },
  'rpvms_onetrustassessment.rpvms_type':                   { srcCol: 'type',          transform: 'passthrough',  dq: 'LEN<=100', nullPolicy: 'Allow' },
  'rpvms_onetrustassessment.rpvms_productservice':         { srcCol: 'product_service', transform: 'passthrough', dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_onetrustassessment.rpvms_classification':         { srcCol: 'classification',transform: 'normalize',    dq: 'IN option set', nullPolicy: 'Allow' },
  'rpvms_onetrustassessment.rpvms_criticality':            { srcCol: 'criticality',   transform: 'normalize',    dq: 'IN rpvms_criticalitylevel', nullPolicy: 'Allow' },
  'rpvms_onetrustassessment.rpvms_ephi':                   { srcCol: 'ephi',          transform: 'normalize',    dq: "IN ('Yes','No','Unknown')", nullPolicy: "Default 'Unknown'" },
  'rpvms_onetrustassessment.rpvms_integrations':           { srcCol: 'integrations',  transform: 'passthrough',  dq: 'LEN<=500', nullPolicy: 'Allow' },
  'rpvms_onetrustassessment.rpvms_systemaccess':           { srcCol: 'system_access', transform: 'normalize',    dq: 'IN rpvms_systemaccess',      nullPolicy: 'Allow' },

  // ── rpvms_servicenowassessment ──────────────────────────────────────────
  'rpvms_servicenowassessment.rpvms_servicenowassessmentname': { srcCol: 'sn_number1',    transform: 'passthrough',  dq: 'unique', nullPolicy: 'Reject row' },
  'rpvms_servicenowassessment.rpvms_vendorid':                 { srcCol: 'vendor_name',   transform: 'alias-resolve + DV lookup', dq: 'must resolve', nullPolicy: 'Reject row', reject: 'reject_snow_unresolved_vendor' },
  'rpvms_servicenowassessment.rpvms_snnumber1':                { srcCol: 'sn_number1',    transform: 'passthrough',  dq: '^SN-\\d+$', nullPolicy: 'Reject row' },
  'rpvms_servicenowassessment.rpvms_assessmenttype':           { srcCol: 'assessment_type', transform: 'normalize',  dq: 'IN rpvms_assessmenttype', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_vendornameraw':            { srcCol: 'vendor_name',   transform: 'passthrough (audit)', dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_criticalitylevel':         { srcCol: 'criticality',   transform: 'normalize',    dq: 'IN rpvms_criticalitylevel', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_itsponsor':                { srcCol: 'it_sponsor',    transform: 'passthrough',  dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_vendorrepname':            { srcCol: 'vendor_rep_name',  transform: 'passthrough', dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_vendorrepemail':           { srcCol: 'vendor_rep_email', transform: 'email',    dq: 'email format',            nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_vendorreptitle':           { srcCol: 'vendor_rep_title', transform: 'passthrough', dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_vendormailingaddress':     { srcCol: 'mailing_address',  transform: 'passthrough', dq: 'LEN<=1000', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_isbudgeted':               { srcCol: 'is_budgeted',   transform: 'normalize',    dq: "IN ('Yes','No','Unknown')", nullPolicy: "Default 'Unknown'" },
  'rpvms_servicenowassessment.rpvms_budgetedcostcenter':       { srcCol: 'budgeted_cc',   transform: 'passthrough',  dq: 'LEN<=50', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_impactedcostcenter':       { srcCol: 'impacted_cc',   transform: 'passthrough',  dq: 'LEN<=50', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_productservicetype':       { srcCol: 'product_service_type', transform: 'passthrough', dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_requestscope':             { srcCol: 'request_scope', transform: 'passthrough',  dq: 'LEN<=500', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_relatedlocalpractice':     { srcCol: 'related_local_practice', transform: 'passthrough', dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_relatedrpdepartment':      { srcCol: 'related_rp_department',  transform: 'passthrough', dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_costcentername':           { srcCol: 'cost_center_name', transform: 'passthrough', dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_costcentercode':           { srcCol: 'cost_center_code', transform: 'cast int',  dq: '>0', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_perfoverallreliability':   { srcCol: 'perf_reliability', transform: 'passthrough', dq: 'LEN<=100', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_perfissuehandling':        { srcCol: 'perf_issue_handling', transform: 'passthrough', dq: 'LEN<=100', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_perfsupportsatisfaction':  { srcCol: 'perf_support_sat',   transform: 'passthrough', dq: 'LEN<=100', nullPolicy: 'Allow' },
  'rpvms_servicenowassessment.rpvms_perfcontractchangereq':    { srcCol: 'perf_contract_change', transform: 'passthrough', dq: 'LEN<=100', nullPolicy: 'Allow' },

  // ── rpvms_vendorscore ───────────────────────────────────────────────────
  'rpvms_vendorscore.rpvms_vendorscorename':   { srcCol: "'{vendor}' + ' FY' + '{fy}'", transform: 'compose', dq: 'unique per (vendor, fy)', nullPolicy: 'Reject row' },
  'rpvms_vendorscore.rpvms_vendorid':          { srcCol: 'vendor_name',       transform: 'alias-resolve + DV lookup', dq: 'must resolve', nullPolicy: 'Reject row', reject: 'reject_score_unresolved_vendor' },
  'rpvms_vendorscore.rpvms_scoreyear':         { srcCol: 'fy',                transform: 'cast int',    dq: '2020<=fy<=current+1', nullPolicy: 'Reject row' },
  'rpvms_vendorscore.rpvms_criticalityscore':  { srcCol: 'score_criticality', transform: 'cast int',    dq: '1<=v<=5', nullPolicy: 'Allow' },
  'rpvms_vendorscore.rpvms_dependencyscore':   { srcCol: 'score_dependency',  transform: 'cast int',    dq: '1<=v<=5', nullPolicy: 'Allow' },
  'rpvms_vendorscore.rpvms_spendscore':        { srcCol: 'score_spend',       transform: 'cast int',    dq: '1<=v<=5', nullPolicy: 'Allow' },
  'rpvms_vendorscore.rpvms_valuescore':        { srcCol: 'score_value',       transform: 'cast int',    dq: '1<=v<=5', nullPolicy: 'Allow' },
  'rpvms_vendorscore.rpvms_alignmentscore':    { srcCol: 'score_alignment',   transform: 'cast int',    dq: '1<=v<=5', nullPolicy: 'Allow' },
  'rpvms_vendorscore.rpvms_weightedscore':     { srcCol: '(computed)',        transform: '0.3*crit + 0.25*dep + 0.2*spend + 0.15*val + 0.1*align', dq: 'decimal 0-5', nullPolicy: 'Compute from components' },
  'rpvms_vendorscore.rpvms_wtscorecritdeponly':{ srcCol: '(computed)',        transform: '0.5*crit + 0.5*dep', dq: 'decimal 0-5', nullPolicy: 'Compute' },
  'rpvms_vendorscore.rpvms_topspendcostcenter':{ srcCol: 'top_spend_cc',      transform: 'cast int',    dq: '>0', nullPolicy: 'Allow' },
  'rpvms_vendorscore.rpvms_status':            { srcCol: 'vendor_status',     transform: 'normalize',   dq: 'IN rpvms_vendorstatus', nullPolicy: "Default 'Active'" },
  'rpvms_vendorscore.rpvms_comment':           { srcCol: 'comment',           transform: 'passthrough', dq: 'LEN<=4000', nullPolicy: 'Allow' },

  // ── rpvms_vendorbudget ──────────────────────────────────────────────────
  'rpvms_vendorbudget.rpvms_vendorbudgetname': { srcCol: "'{vendor}' + ' FY' + '{fy}'", transform: 'compose', dq: 'unique per (vendor, fy)', nullPolicy: 'Reject row' },
  'rpvms_vendorbudget.rpvms_vendorid':         { srcCol: 'vendor_name',  transform: 'alias-resolve + DV lookup', dq: 'must resolve', nullPolicy: 'Reject row', reject: 'reject_budget_unresolved_vendor' },
  'rpvms_vendorbudget.rpvms_budgetyear':       { srcCol: 'fy',           transform: 'cast int',    dq: '2020<=fy<=current+1', nullPolicy: 'Reject row' },
  'rpvms_vendorbudget.rpvms_rating':           { srcCol: 'rating',       transform: 'cast int',    dq: '1<=v<=5', nullPolicy: 'Allow' },
  'rpvms_vendorbudget.rpvms_description':      { srcCol: 'description',  transform: 'passthrough', dq: 'LEN<=4000', nullPolicy: 'Allow' },
  'rpvms_vendorbudget.rpvms_supplierspend':    { srcCol: 'actual_spend', transform: 'sum of GL for (vendor, fy) ± 10%', dq: '>=0', nullPolicy: 'Compute from GL' },
  'rpvms_vendorbudget.rpvms_pctoftotalspend':  { srcCol: '(computed)',   transform: 'spend / total_fy_spend', dq: '0<=pct<=1', nullPolicy: 'Compute' },
  'rpvms_vendorbudget.rpvms_quintilerating':   { srcCol: '(computed)',   transform: 'NTILE(5) OVER (ORDER BY spend DESC)', dq: 'IN rpvms_quintilerating', nullPolicy: 'Compute' },

  // ── rpvms_vendorratecard ────────────────────────────────────────────────
  'rpvms_vendorratecard.rpvms_vendorratecardname': { srcCol: "'{vendor}' + ' - ' + '{position}' + ' FY' + '{fy}'", transform: 'compose', dq: 'unique per (vendor, position, fy)', nullPolicy: 'Reject row' },
  'rpvms_vendorratecard.rpvms_vendorid':           { srcCol: 'vendor_name',       transform: 'alias-resolve + DV lookup', dq: 'must resolve', nullPolicy: 'Reject row', reject: 'reject_ratecard_unresolved_vendor' },
  'rpvms_vendorratecard.rpvms_ratecardyear':       { srcCol: 'fy',                transform: 'cast int',    dq: '2020<=fy<=current+1', nullPolicy: 'Reject row' },
  'rpvms_vendorratecard.rpvms_originalposition':   { srcCol: 'position_raw',      transform: 'passthrough', dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_vendorratecard.rpvms_normalizedposition': { srcCol: 'position_normalized', transform: 'canonical role taxonomy', dq: 'LEN<=200', nullPolicy: 'Allow' },
  'rpvms_vendorratecard.rpvms_positioncategory':   { srcCol: 'position_category', transform: 'passthrough', dq: 'LEN<=100', nullPolicy: 'Allow' },
  'rpvms_vendorratecard.rpvms_locationtype':       { srcCol: 'location_type',     transform: 'normalize',   dq: 'IN rpvms_locationtype', nullPolicy: "Default 'Onshore'" },
  'rpvms_vendorratecard.rpvms_experiencelevel':    { srcCol: 'experience_level',  transform: 'normalize',   dq: 'IN rpvms_experiencelevel', nullPolicy: 'Allow' },
  'rpvms_vendorratecard.rpvms_experienceyears':    { srcCol: 'experience_years',  transform: 'passthrough', dq: 'LEN<=50', nullPolicy: 'Allow' },
  'rpvms_vendorratecard.rpvms_minrate':            { srcCol: 'min_rate',          transform: 'cast decimal',dq: '>=0', nullPolicy: 'Allow' },
  'rpvms_vendorratecard.rpvms_maxrate':            { srcCol: 'max_rate',          transform: 'cast decimal',dq: '>=min_rate', nullPolicy: 'Allow' },
  'rpvms_vendorratecard.rpvms_avgrate':            { srcCol: 'avg_rate',          transform: '(min+max)/2 if null', dq: '>=0', nullPolicy: 'Compute' },
  'rpvms_vendorratecard.rpvms_notes':              { srcCol: 'notes',             transform: 'passthrough', dq: 'LEN<=4000', nullPolicy: 'Allow' },
  'rpvms_vendorratecard.rpvms_demonotes':          { srcCol: 'demo_notes',        transform: 'passthrough', dq: 'LEN<=4000', nullPolicy: 'Allow' },
};

// ── Build option-set index ──────────────────────────────────────────────────
const OPTSET_BY_NAME = Object.fromEntries(PLAN.optionSets.map((o) => [o.name, o]));

// ── Relationship index: referencingEntity → [{column, target}] ──────────────
const RELS_BY_TABLE = {};
for (const r of PLAN.relationships) {
  (RELS_BY_TABLE[r.referencingEntity] ||= []).push(r);
}

// ── Enumerate target rows ───────────────────────────────────────────────────
const tableRows = [];
const columnRows = [];
const lookupRows = [];
const optsetRows = [];

for (const t of PLAN.tables) {
  const tl = t.logicalSingularName;
  const wave = WAVES[tl] ?? 99;
  const def = TABLE_DEFAULTS[tl] || {};
  const rels = RELS_BY_TABLE[tl] || [];

  const pkSchemaName = t.primaryName.schemaName;
  const pkLogicalName = pkSchemaName.toLowerCase();

  tableRows.push({
    Wave: wave,
    'Target Table': t.logicalPluralName,
    'Display Name': t.displayName,
    'Primary Name': pkLogicalName,
    'Upsert Key': pkLogicalName,
    'Gold View': def.gold || '',
    Refresh: tl === 'rpvms_gltransaction' ? 'Incremental on posteddate' : 'Full nightly',
    'Source System': def.src || '',
    'Bronze Table': def.bronze || '',
    'Silver Table': def.silver || '',
    Notes: t.description || '',
  });

  // Primary-name column — synthesized (planning-payload stores it as a
  // table-level property, not in columns[]).
  const pkKey = `${tl}.${pkLogicalName}`;
  const pkOv = OVERRIDES[pkKey] || {};
  columnRows.push({
    Wave: wave,
    'Target Table': t.logicalPluralName,
    'Target Column (Logical)': pkLogicalName,
    'Target Column (Schema)': pkSchemaName,
    'Target Type': `String(${t.primaryName.maxLength || 200}) (Primary Name)`,
    'Target Required': 'SystemRequired',
    'Is Primary Name': 'Y',
    'Is Upsert Key': 'Y',
    'Is Lookup': 'N',
    'Lookup Target': '',
    'Source System': pkOv.src || def.src || '',
    'Bronze Table': def.bronze || '',
    'Source Column': pkOv.srcCol || '',
    'Silver Transform': pkOv.transform || '',
    'Gold View': def.gold || '',
    'Gold Column': pkLogicalName,
    'Option Set': '',
    'Option-Set Resolution': '',
    'Null Policy': pkOv.nullPolicy || 'Reject row',
    'DQ Rule': pkOv.dq || `1<=LEN<=${t.primaryName.maxLength || 200}`,
    'Reject Destination': pkOv.reject || def.reject || '',
    Notes: pkOv.notes || t.primaryName.description || '',
  });

  for (const c of t.columns) {
    const key = `${tl}.${c.logicalName}`;
    const ov = OVERRIDES[key] || {};
    const os = c.globalOptionSetName;
    columnRows.push({
      Wave: wave,
      'Target Table': t.logicalPluralName,
      'Target Column (Logical)': c.logicalName,
      'Target Column (Schema)': c.schemaName,
      'Target Type': formatType(c),
      'Target Required': c.requiredLevel || 'None',
      'Is Primary Name': 'N',
      'Is Upsert Key': 'N',
      'Is Lookup': 'N',
      'Lookup Target': '',
      'Source System': ov.src || def.src || '',
      'Bronze Table': def.bronze || '',
      'Source Column': ov.srcCol || '',
      'Silver Transform': ov.transform || '',
      'Gold View': def.gold || '',
      'Gold Column': c.logicalName,
      'Option Set': os || '',
      'Option-Set Resolution': os ? 'dim_rpvms_optionsets lookup' : '',
      'Null Policy': ov.nullPolicy || (c.requiredLevel === 'ApplicationRequired' ? 'Reject row' : 'Allow'),
      'DQ Rule': ov.dq || dqDefault(c),
      'Reject Destination': ov.reject || def.reject || '',
      Notes: ov.notes || (c.description || '').slice(0, 200),
    });
  }

  // Lookup columns — one row per relationship terminating at this table.
  for (const r of rels) {
    const key = `${tl}.${r.lookupLogicalName}`;
    const ov = OVERRIDES[key] || {};
    columnRows.push({
      Wave: wave,
      'Target Table': t.logicalPluralName,
      'Target Column (Logical)': r.lookupLogicalName,
      'Target Column (Schema)': r.lookupSchemaName,
      'Target Type': `Lookup → ${r.referencedEntity}`,
      'Target Required': r.requiredLevel || 'None',
      'Is Primary Name': 'N',
      'Is Upsert Key': 'N',
      'Is Lookup': 'Y',
      'Lookup Target': r.referencedEntity,
      'Source System': ov.src || def.src || '',
      'Bronze Table': def.bronze || '',
      'Source Column': ov.srcCol || '',
      'Silver Transform': ov.transform || 'alias-resolve + DV lookup',
      'Gold View': def.gold || '',
      'Gold Column': r.lookupLogicalName,
      'Option Set': '',
      'Option-Set Resolution': '',
      'Null Policy': ov.nullPolicy || (r.requiredLevel === 'ApplicationRequired' ? 'Reject row' : 'Allow null'),
      'DQ Rule': ov.dq || 'must resolve to target',
      'Reject Destination': ov.reject || def.reject || '',
      Notes: ov.notes || `FK to ${r.referencedEntity} via ${r.schemaName}`,
    });

    lookupRows.push({
      'Source Column (Gold)': ov.srcCol || '(curate)',
      'Target Table': t.logicalPluralName,
      'Target Lookup Column': r.lookupSchemaName,
      'Lookup Bind Path': `/${PLAN.tables.find((x) => x.logicalSingularName === r.referencedEntity)?.entitySetName}(<GUID>)`,
      '@odata.bind Key': `${r.lookupSchemaName}@odata.bind`,
      'Required Level': r.requiredLevel || 'None',
    });
  }
}

// ── Option sets sheet ──────────────────────────────────────────────────────
for (const os of PLAN.optionSets) {
  for (const opt of os.options) {
    optsetRows.push({
      'Set Name': os.name,
      'Display Name': os.displayName,
      Label: opt.label,
      Value: opt.value,
      Description: opt.description || '',
    });
  }
}

// ── Waves sheet ─────────────────────────────────────────────────────────────
const waveRows = [
  { Wave: 0, Name: 'Prerequisites',     Tables: '— (SPN, Fabric Connections, dim_rpvms_optionsets)', 'Runs In Parallel': '—',  'Depends On': '—' },
  { Wave: 1, Name: 'Anchors',           Tables: 'rpvms_vendors, rpvms_suppliers, rpvms_vendornamealiases', 'Runs In Parallel': 'Yes', 'Depends On': 'Wave 0' },
  { Wave: 2, Name: 'Bridges & Catalog', Tables: 'rpvms_vendorsuppliers, rpvms_vendorproductservices',      'Runs In Parallel': 'Yes', 'Depends On': 'Wave 1' },
  { Wave: 3, Name: 'Contracts Subgraph',Tables: 'rpvms_contracts → rpvms_contractparties',                 'Runs In Parallel': 'Serial within wave', 'Depends On': 'Wave 1' },
  { Wave: 4, Name: 'Facts & Assessments', Tables: 'rpvms_gltransactions, rpvms_onetrustassessments, rpvms_servicenowassessments, rpvms_vendorscores, rpvms_vendorbudgets, rpvms_vendorratecards', 'Runs In Parallel': 'Yes', 'Depends On': 'Waves 1,2,3' },
  { Wave: 5, Name: 'Publish',           Tables: 'Web API PublishAllXml',                                    'Runs In Parallel': 'No', 'Depends On': 'Wave 4' },
];

// ── Legend sheet ────────────────────────────────────────────────────────────
const legendRows = [
  { Key: 'Purpose',         Value: 'Canonical source→target mapping for the Fabric → Dataverse ingestion build.' },
  { Key: 'Generated From',  Value: 'dataverse/planning-payload.json + scripts/generate-source-target-map.mjs' },
  { Key: 'Generated At',    Value: new Date().toISOString() },
  { Key: 'Target Solution', Value: 'VendorManagement (publisher prefix rpvms_)' },
  { Key: 'Target Env',      Value: 'https://carremacodeapps.crm.dynamics.com' },
  { Key: 'Regenerate',      Value: 'node scripts/generate-source-target-map.mjs' },
  { Key: '—', Value: '—' },
  { Key: 'Wave 1',          Value: 'Anchors — no incoming FKs' },
  { Key: 'Wave 2',          Value: 'Bridges + catalog — FKs into Wave 1' },
  { Key: 'Wave 3',          Value: 'Contracts subgraph' },
  { Key: 'Wave 4',          Value: 'Facts & assessments — FKs into Wave 1, optionally 3' },
  { Key: 'Reject *',        Value: 'Lakehouse table capturing rows that fail DQ; surfaced in Power BI observability' },
  { Key: 'dim_rpvms_optionsets', Value: 'Reference table mapping option-set labels to 412900xxx integers' },
];

// ── Write workbook ──────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();
addSheet(wb, 'Legend',     legendRows,  [14, 80]);
addSheet(wb, 'Waves',      waveRows,    [6, 20, 60, 24, 20]);
addSheet(wb, 'Tables',     tableRows,   [6, 32, 24, 32, 32, 36, 30, 26, 34, 34, 50]);
addSheet(wb, 'Columns',    columnRows); // autosize-ish
addSheet(wb, 'Lookups',    lookupRows,  [28, 32, 26, 40, 34, 18]);
addSheet(wb, 'OptionSets', optsetRows,  [28, 28, 30, 14, 60]);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync(OUT, buf);
console.log(`\n✓ wrote ${OUT}`);
console.log(`  Legend:     ${legendRows.length} rows`);
console.log(`  Waves:      ${waveRows.length} rows`);
console.log(`  Tables:     ${tableRows.length} rows`);
console.log(`  Columns:    ${columnRows.length} rows`);
console.log(`  Lookups:    ${lookupRows.length} rows`);
console.log(`  OptionSets: ${optsetRows.length} rows`);

// ── Helpers ────────────────────────────────────────────────────────────────
function addSheet(wb, name, rows, widths) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (widths) ws['!cols'] = widths.map((w) => ({ wch: w }));
  else if (rows.length > 0) {
    const keys = Object.keys(rows[0]);
    ws['!cols'] = keys.map((k) => ({
      wch: Math.max(k.length + 2, Math.min(60, Math.max(...rows.map((r) => String(r[k] ?? '').length)) + 2)),
    }));
  }
  XLSX.utils.book_append_sheet(wb, ws, name);
}

function formatType(c) {
  if (c.type === 'String')  return `String(${c.maxLength || '?'})`;
  if (c.type === 'Memo')    return `Memo(${c.maxLength || 4000})`;
  if (c.type === 'Money')   return 'Money';
  if (c.type === 'Decimal') return `Decimal(${c.precision ?? 2})`;
  if (c.type === 'Integer') return 'Integer';
  if (c.type === 'Boolean') return 'Boolean';
  if (c.type === 'DateTime')return 'DateTime';
  if (c.type === 'Picklist')return `Choice (${c.globalOptionSetName || '?'})`;
  return c.type;
}

function dqDefault(c) {
  if (c.type === 'String')   return `LEN<=${c.maxLength || 100}`;
  if (c.type === 'Memo')     return `LEN<=${c.maxLength || 4000}`;
  if (c.type === 'Integer')  return 'integer';
  if (c.type === 'Money' || c.type === 'Decimal') return '>=0';
  if (c.type === 'Boolean')  return 'BIT';
  if (c.type === 'DateTime') return 'datetime';
  if (c.type === 'Picklist') return `IN option set`;
  return '';
}
