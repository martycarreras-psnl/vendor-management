-- ============================================================================
-- Gold view: gold.gold_rpvms_vendor
-- Target Dataverse table: rpvms_vendors  (primary name: rpvms_vendorname)
-- Consumer:        Dataflow Gen2  df_rpvms_vendor   (Wave 1, anchor — no FKs)
-- Refresh cadence: Full snapshot, nightly
-- Dialect:         Fabric Warehouse (T-SQL); also valid on Lakehouse SQL endpoint
-- ----------------------------------------------------------------------------
-- Upstream dependencies (Silver):
--   silver.dim_vendor            — current-state vendor master (SCD2 collapsed, is_current = 1)
--   silver.dim_vendor_alias      — curated alias → canonical name registry
--   reference.dim_rpvms_optionsets  — label→value map generated from
--                                    dataverse/planning-payload.json
--
-- Downstream dependency (Reject paths):
--   gold.reject_vendor_unresolved  — rows whose vendor_name_raw could not be
--                                    resolved to a canonical name; produced by
--                                    a separate Silver job and NEVER written to
--                                    Dataverse directly.
-- ============================================================================
CREATE OR ALTER VIEW gold.gold_rpvms_vendor AS
WITH
-- 1) Current-state vendor master.
--    Silver is responsible for deduping by normalized name and for the SCD2
--    collapse (is_current = 1). Gold only consumes the current snapshot.
src AS (
    SELECT
        v.vendor_name_raw,
        v.category_l1,
        v.category_l2,
        v.commercial_role,          -- 'Direct' | 'Reseller' | 'VAR'
        v.primary_offering,
        v.classification,           -- 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4'
        v.is_var,                   -- bit
        v.status,                   -- 'Active' | 'Under Review' | 'Inactive' | 'Terminated'
        v.active_phi_access,        -- 'Yes' | 'No' | 'Unknown'
        v.source_system,
        v.source_row_hash,
        v.ingest_ts
    FROM silver.dim_vendor v
    WHERE v.is_current = 1
),
-- 2) Alias resolution. Collapse any raw variant to its canonical vendor name
--    using the curated alias registry. Unresolved rows are handled by a
--    separate Silver reject job (see header) and are filtered out below.
resolved AS (
    SELECT
        COALESCE(
            a.canonical_vendor_name,
            LTRIM(RTRIM(UPPER(s.vendor_name_raw)))
        ) AS vendor_name_canonical,
        s.*
    FROM src s
    LEFT JOIN silver.dim_vendor_alias a
        ON a.alias_normalized = LTRIM(RTRIM(UPPER(s.vendor_name_raw)))
       AND a.confidence >= 0.95
       AND a.status = 'Approved'
),
-- 3) Option-set reference table. One row per (set_name, label, value).
--    Regenerated from dataverse/planning-payload.json whenever the solution
--    is republished (add to release runbook).
opt AS (
    SELECT set_name, label, value FROM reference.dim_rpvms_optionsets
)
SELECT
    -- Primary name — Dataflow Gen2 Upsert key.
    CAST(r.vendor_name_canonical AS NVARCHAR(200))      AS rpvms_vendorname,

    -- Descriptive string columns.
    CAST(r.category_l1       AS NVARCHAR(100))          AS rpvms_categoryl1,
    CAST(r.category_l2       AS NVARCHAR(100))          AS rpvms_categoryl2,
    CAST(r.primary_offering  AS NVARCHAR(200))          AS rpvms_primaryoffering,
    CAST(r.is_var            AS BIT)                    AS rpvms_isvar,

    -- Option-set integer resolutions (412900xxx range). Null signals drift —
    -- driven to reject_vendor_optionset by the dataflow's failure branch.
    (SELECT value FROM opt WHERE set_name = 'rpvms_commercialrole'  AND label = r.commercial_role)
                                                        AS rpvms_commercialrole,
    (SELECT value FROM opt WHERE set_name = 'rpvms_classification'  AND label = r.classification)
                                                        AS rpvms_classification,
    (SELECT value FROM opt WHERE set_name = 'rpvms_status'          AND label = r.status)
                                                        AS rpvms_status,
    (SELECT value FROM opt WHERE set_name = 'rpvms_activephiaccess' AND label = r.active_phi_access)
                                                        AS rpvms_activephiaccess,

    -- Observability columns. Retained for Fabric-side traceability; the
    -- Dataflow Gen2 mapping drops these three before writing to Dataverse.
    r.source_system                                     AS _src_system,
    r.source_row_hash                                   AS _src_hash,
    r.ingest_ts                                         AS _ingest_ts
FROM resolved r
WHERE r.vendor_name_canonical IS NOT NULL
  AND LEN(r.vendor_name_canonical) BETWEEN 2 AND 200;
GO
