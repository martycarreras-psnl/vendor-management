-- ============================================================================
-- TEMPLATE — Gold view for a single Dataverse table
-- Copy this file to  gold_<logical_table_name>.sql  (e.g. gold_rpvms_supplier.sql)
-- and fill in the TODOs. Keep one view per target table; no cross-table joins
-- beyond what is needed to materialize lookup foreign keys.
--
-- Conventions (must match for Dataflow Gen2 auto-mapping):
--   • Output column names = Dataverse logical names exactly (e.g. rpvms_name).
--   • Lookup columns output the *primary name* of the parent record (string);
--     Dataflow Gen2 resolves it to a GUID at write time using the parent's
--     alternate key. Column name pattern: <lookup_logical_name>@odata.bind is
--     handled in the dataflow — here we just emit the parent name string.
--   • Option-set columns output the INTEGER value (resolved via
--     reference.dim_rpvms_optionsets). Never emit the label.
--   • Money → DECIMAL(38,4). Dates → DATE or DATETIME2. Yes/No → BIT.
--   • Always include the three observability columns (_src_system, _src_hash,
--     _ingest_ts). Drop them in the Dataflow Gen2 mapping before the sink.
-- ============================================================================
CREATE OR ALTER VIEW gold.gold_<TARGET_TABLE_LOGICAL_NAME> AS
WITH src AS (
    SELECT
        -- TODO: project columns from silver.<source_table>, apply WHERE is_current = 1
        *
    FROM silver.<source_table>
    WHERE is_current = 1
),
opt AS (
    SELECT set_name, label, value FROM reference.dim_rpvms_optionsets
)
SELECT
    -- Business key (alternate key — MUST be unique, non-null)
    CAST(s.<business_key_col> AS NVARCHAR(<n>)) AS <rpvms_primary_name>,

    -- Scalar attributes
    -- CAST(s.<col> AS <type>) AS <rpvms_col>,

    -- Lookups — emit the parent's primary-name string
    -- CAST(p.<parent_primary_name> AS NVARCHAR(<n>)) AS <rpvms_lookup_col>,

    -- Option sets — resolve label → int via reference table
    -- (SELECT value FROM opt WHERE set_name = '<rpvms_setname>' AND label = s.<label_col>)
    --     AS <rpvms_choice_col>,

    -- Observability (dropped in Dataflow Gen2 mapping)
    s.source_system AS _src_system,
    s.source_row_hash AS _src_hash,
    s.ingest_ts     AS _ingest_ts
FROM src s
-- LEFT JOIN silver.<parent_table> p ON p.<parent_bk> = s.<fk_col> AND p.is_current = 1
WHERE s.<business_key_col> IS NOT NULL;
GO
