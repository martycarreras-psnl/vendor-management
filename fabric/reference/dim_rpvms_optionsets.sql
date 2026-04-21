-- ============================================================================
-- reference.dim_rpvms_optionsets
-- Purpose: label → integer value lookup for every Dataverse choice (option set)
--          consumed by Gold views. Regenerate whenever the solution is
--          republished. Canonical source of truth:
--            fabric/dataverse-spec/planning-payload.json  (optionSets[])
--
-- Build pattern (pick one):
--   (a) Notebook: read planning-payload.json, explode optionSets[] to rows,
--       write to Lakehouse table `reference.dim_rpvms_optionsets`.
--   (b) Manual seed: paste the INSERTs below after each schema republish.
--
-- Schema:
--   set_name   NVARCHAR(100)  -- e.g. 'rpvms_status'
--   label      NVARCHAR(200)  -- human label shown in Dataverse
--   value      INT            -- integer stored on the record (412900000+)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reference.dim_rpvms_optionsets (
    set_name NVARCHAR(100) NOT NULL,
    label    NVARCHAR(200) NOT NULL,
    value    INT           NOT NULL,
    CONSTRAINT pk_dim_rpvms_optionsets PRIMARY KEY (set_name, label)
);

-- Example seed (truncate/reload pattern). Replace with a generated payload
-- from planning-payload.json on every republish.
/*
TRUNCATE TABLE reference.dim_rpvms_optionsets;
INSERT INTO reference.dim_rpvms_optionsets (set_name, label, value) VALUES
    ('rpvms_status',          'Active',        412900000),
    ('rpvms_status',          'Under Review',  412900001),
    ('rpvms_status',          'Inactive',      412900002),
    ('rpvms_status',          'Terminated',    412900003),
    ('rpvms_classification',  'Tier 1',        412900000),
    ('rpvms_classification',  'Tier 2',        412900001),
    ('rpvms_classification',  'Tier 3',        412900002),
    ('rpvms_classification',  'Tier 4',        412900003),
    ('rpvms_commercialrole',  'Direct',        412900000),
    ('rpvms_commercialrole',  'Reseller',      412900001),
    ('rpvms_commercialrole',  'VAR',           412900002),
    ('rpvms_activephiaccess', 'Yes',           412900000),
    ('rpvms_activephiaccess', 'No',            412900001),
    ('rpvms_activephiaccess', 'Unknown',       412900002);
-- ... repeat for every set in planning-payload.json → optionSets[]
*/
