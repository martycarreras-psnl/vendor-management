# Vendor Management — Fabric → Dataverse Handoff Package

**Audience:** Microsoft Fabric engineer building the ingestion pipeline that lands source data into the Dataverse-backed `rpvms_*` tables that power this Power Apps Code App.

**Goal for Fabric side:** Stand up a Fabric Lakehouse + Warehouse that produces 13 Gold SQL views matching the Dataverse schema shape exactly, then write them to Dataverse via Dataflow Gen2 (upsert on alternate keys).

**What is already done (Dataverse side):**
- Solution `VendorManagement`, publisher prefix `rpvms_`, choice value base `412900000` are deployed in the target environment.
- All 13 tables + 14 relationships + all option sets are live. Canonical spec is in [`dataverse-spec/planning-payload.json`](dataverse-spec/planning-payload.json).
- Sample data has already been seeded for the app team to build against — Fabric load will upsert/replace it.

---

## What's in this folder

| Path | Purpose |
|---|---|
| `README.md` | This file — start here |
| `mapping/fabric-source-to-target-map.xlsx` | **Primary deliverable driver.** One row per target Dataverse column with source system, source column, transform, key flags |
| `dataverse-spec/planning-payload.json` | Canonical target schema — 13 tables, columns, types, lengths, option sets, relationships. Machine-readable |
| `dataverse-spec/VendorDataModel_Dataverse_Spec.xlsx` | Human-readable version of the same spec |
| `gold/gold_rpvms_vendor.sql` | **Reference implementation** of one Gold view — fully commented. Use as the template for the other 12 |
| `gold/_TEMPLATE_gold_view.sql` | Empty template with conventions |
| `reference/dim_rpvms_optionsets.sql` | Pattern for the label→value option-set lookup table that every Gold view joins to |
| `samples/Reseller - VAR.xlsx` | Business-provided VAR/Reseller definitions (one known source) |
| `samples/var-relationships.csv` | Flattened form of the above, useful for Silver layer |

---

## Target architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│ Source systems  │ ──▶ │  Bronze (raw)    │ ──▶ │  Silver          │ ──▶ │  Gold             │
│ Workday, AP,    │     │  Lakehouse files │     │  Conformed,      │     │  1 view per       │
│ OneTrust, SNow, │     │  as-landed       │     │  typed, SCD2     │     │  Dataverse table  │
│ VAR spreadsheet │     │                  │     │  is_current flag │     │  (shape matches   │
└─────────────────┘     └──────────────────┘     └──────────────────┘     │   rpvms_* exactly)│
                                                                          └─────────┬─────────┘
                                                                                    │
                                                                                    ▼
                                                                         ┌───────────────────┐
                                                                         │ Dataflow Gen2     │
                                                                         │ "Upsert if key    │
                                                                         │  exists else      │
                                                                         │  insert" on       │
                                                                         │  alternate key    │
                                                                         └─────────┬─────────┘
                                                                                   │
                                                                                   ▼
                                                                         ┌───────────────────┐
                                                                         │ Dataverse         │
                                                                         │ rpvms_* tables    │
                                                                         └───────────────────┘
```

---

## The 13 target tables (load order)

Load in waves so that lookup parents exist before children are written.

**Wave 1 (anchors — no FKs to other rpvms_ tables):**
1. `rpvms_vendor` — primary name `rpvms_vendorname`
2. `rpvms_supplier` — primary name `rpvms_suppliername`

**Wave 2 (first-level children):**
3. `rpvms_vendorsupplier` — links vendor ↔ supplier
4. `rpvms_vendornamealias` — alias → canonical vendor
5. `rpvms_contract` — parent for contract parties
6. `rpvms_vendorbudget`
7. `rpvms_vendorratecard`
8. `rpvms_vendorproductservice`
9. `rpvms_onetrustassessment`
10. `rpvms_servicenowassessment`
11. `rpvms_vendorscore`

**Wave 3 (transactional / depends on Wave 2):**
12. `rpvms_contractparty`
13. `rpvms_gltransaction`

Use the full column lists in `mapping/fabric-source-to-target-map.xlsx` and `dataverse-spec/planning-payload.json`.

---

## Rules the Gold views MUST follow

These exist so that Dataflow Gen2 can auto-map columns and upsert cleanly.

1. **Output column names = Dataverse logical names, exactly.** Example: `rpvms_vendorname`, not `VendorName`.
2. **Alternate key columns are never null and never duplicated.** Dataflow Gen2 uses them for upsert matching.
3. **Option-set columns output the integer value, not the label.** Join to `reference.dim_rpvms_optionsets` (see `reference/dim_rpvms_optionsets.sql`).
4. **Lookup columns output the parent record's primary name string** (e.g. a contract row's `rpvms_vendor` column emits the vendor's `rpvms_vendorname` value). Dataflow Gen2 resolves the GUID via `@odata.bind` at write time.
5. **Types:** Money → `DECIMAL(38,4)`; Dates → `DATE` or `DATETIME2`; Yes/No → `BIT`; strings → `NVARCHAR(<declared length>)` from the spec.
6. **Every view ends with three observability columns** — `_src_system`, `_src_hash`, `_ingest_ts` — which are dropped in the Dataflow Gen2 mapping before the Dataverse sink. They stay in Gold for trace/debug.
7. **Only current rows.** Silver is expected to carry `is_current = 1` flags; Gold always filters to them.
8. **Unresolved records go to reject tables, never to Dataverse.** E.g. a transaction whose `vendor_name_raw` cannot be resolved to a canonical vendor is routed to `gold.reject_gltransaction_unresolved` and investigated, not silently dropped and not written.

---

## Recommended step-by-step for the Fabric engineer

1. **Read** `dataverse-spec/planning-payload.json` (machine) or `VendorDataModel_Dataverse_Spec.xlsx` (human) to understand the target shape end-to-end.
2. **Open** `mapping/fabric-source-to-target-map.xlsx`. Each tab is one target table. For every row, confirm the `Source System` / `Source Column` / `Transform` — any blanks or "TBD" need to be resolved with the business before you build that field. Escalate gaps back to the project owner.
3. **Stand up the Lakehouse + Warehouse** in the target Fabric workspace. Create schemas `bronze`, `silver`, `gold`, `reference`, `reject`.
4. **Land Bronze** — one file-backed table per source feed. No transforms. Capture source file hash + ingest timestamp.
5. **Build Silver** — typed, deduped, SCD2-collapsed with `is_current` bit. One Silver table per logical domain entity (vendor, supplier, contract, transaction, assessment, etc.).
6. **Build the option-set reference table** per `reference/dim_rpvms_optionsets.sql`. This is regenerated each time the Dataverse solution is republished.
7. **Author 13 Gold views.** Use `gold/gold_rpvms_vendor.sql` as the worked example and `gold/_TEMPLATE_gold_view.sql` as the starting point. One view per target table. No cross-target joins beyond lookup-key materialization.
8. **Create 13 Dataflow Gen2 flows** (one per target table). Source = the Gold view; Sink = Dataverse table with "Upsert" + the appropriate alternate key. Orchestrate them in wave order (see above) with a Fabric Data Pipeline.
9. **Run and reconcile.** For each table, compare `COUNT(*)` in Gold vs `COUNT(*)` in Dataverse, plus a hash-based row checksum for a sample. Investigate any deltas via the `reject_*` tables and the `_src_hash` column.
10. **Hand back** connection strings, refresh schedule, and a monitoring dashboard that surfaces per-wave load success + reject counts.

---

## Non-negotiables / gotchas

- **Do not modify the Dataverse schema.** If a column you need is missing, escalate — the schema is owned by the app team and managed via `scripts/provision-dataverse-schema.mjs` in this repo. Changes flow Dataverse → Fabric, never the other way.
- **Alternate keys already exist** in Dataverse for every Wave 1/2/3 table. Use them; do not try to match on GUIDs.
- **Do not write labels to option-set columns.** The Dataverse API will reject the row or silently store nothing.
- **Publisher prefix is `rpvms_`** and choice base is `412900000`. Every logical name in Dataverse starts with `rpvms_` (e.g. `rpvms_vendor`, `rpvms_contract`).
- **Connection auth:** the Dataflow Gen2 → Dataverse connection should use an App Registration with Dataverse `System Customizer` + write access to the `VendorManagement` solution's tables. Do NOT reuse the app team's developer credentials.

---

## Questions to bring back to the project owner before starting

1. Which Fabric workspace / capacity should the artifacts live in?
2. What's the refresh cadence target? (assumed: nightly full + hourly incremental for GL transactions)
3. Which App Registration should Dataflow Gen2 authenticate as for the Dataverse sink?
4. Are there source systems besides Workday (AP + GL), OneTrust, ServiceNow, and the VAR spreadsheet that feed this model? Any additions will need new rows in `fabric-source-to-target-map.xlsx`.
5. SLA on reject-queue investigation?

---

*Package generated from the `vendor-management` Power Apps Code App repo, `fabric/` folder. The Dataverse schema in `dataverse-spec/` is authoritative.*
