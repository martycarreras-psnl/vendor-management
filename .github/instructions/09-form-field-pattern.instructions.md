---
applyTo: "src/**"
---

# Editable Field Labels — Required Pattern

Every editable field in this app that binds to a Dataverse column **must** use the shared metadata-backed label primitive. This is how the app stays consistent with Dataverse's `RequiredLevel` without per-field hardcoding.

## Primitives

- **Label component:** [src/components/ui/dataverse-field-label.tsx](../../src/components/ui/dataverse-field-label.tsx)
  - `<DataverseFieldLabel tableLogicalName="..." fieldLogicalName="..." fallback="..." />`
  - Falls back to a `required` prop for client-only fields.
- **Field-name convention:** [src/lib/dataverse-field-name.ts](../../src/lib/dataverse-field-name.ts)
  - `toDataverseFieldName('vendorName')` → `'rpvms_vendorname'`
- **Required hook:** `useDataverseFieldRequired(table, field)` from the same label module.
- **Metadata provider:** [src/services/vendiq/dataverse-provider.ts](../../src/services/vendiq/dataverse-provider.ts) (`fieldMetadataServiceRegistry`).

## Rules (non-negotiable)

1. **Never** render a plain `<Label>`, `<label>`, or hardcoded `*` asterisk for a Dataverse-bound field.
2. Use `DataverseFieldLabel` and pass both `tableLogicalName` and `fieldLogicalName`. Prefer `toDataverseFieldName(domainKey)` for the field name so you do not hardcode the `rpvms_` prefix.
3. Set `aria-required={required || undefined}` on the input/select/textarea using `useDataverseFieldRequired`.
4. For Business-Required Dataverse fields, add a **client-side guard in the mutation** that throws `"<Display Name> is required."` when the value is empty. The Web API does not enforce `ApplicationRequired` — the app must. See [src/pages/prompt-suggestions.tsx](../../src/pages/prompt-suggestions.tsx) `saveMutation` for the canonical pattern.
5. Also guard the submit button: `disabled={(required && !(value ?? '').trim()) || mutation.isPending}`.
6. For client-only fields not bound to Dataverse (e.g. dialog comments written into a computed record), use `<DataverseFieldLabel required>...</DataverseFieldLabel>` — still route through the primitive so the indicator stays consistent.
7. When adding a new Dataverse table, register its `getMetadata` call in `fieldMetadataServiceRegistry`. Without that entry, metadata lookups for that table return `null` and the asterisk will not appear.

## Canonical Examples

- Table-bound helpers that auto-map domain keys to logical names:
  - `VField` / `VSelect` / `VBool` / `VReadOnly` in [src/pages/vendor-360.tsx](../../src/pages/vendor-360.tsx)
  - `Field` / `DateField` / `SelectField` in [src/pages/contract-details.tsx](../../src/pages/contract-details.tsx)
  - `SField` / `SSelect` / `SBool` in [src/pages/supplier-360.tsx](../../src/pages/supplier-360.tsx)
- Inline form with save + button guards: [src/pages/prompt-suggestions.tsx](../../src/pages/prompt-suggestions.tsx)
- Client-only required field: [src/components/vendiq/adjust-criticality-dialog.tsx](../../src/components/vendiq/adjust-criticality-dialog.tsx)

## What This Means For New Work

- When you add a new editable field, **default to** `DataverseFieldLabel` + `aria-required` + save-mutation guard. Do not ask.
- When you build a new form helper (e.g. a `Vendor360` sibling table form), model it after the existing helpers: take `table: string`, use `toDataverseFieldName(field)`, call `useDataverseFieldRequired`, render `DataverseFieldLabel`.
- When you add a new Dataverse table, register it in `fieldMetadataServiceRegistry` in the same PR.
