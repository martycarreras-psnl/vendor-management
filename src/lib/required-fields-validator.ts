import { toDataverseFieldName } from './dataverse-field-name';

/**
 * Returns the subset of domain-model keys in `draft` whose corresponding
 * Dataverse logical name is in `requiredLogicalNames` AND whose value is
 * empty (undefined, null, or a whitespace-only string).
 *
 * Use the returned set to drive `aria-invalid` highlighting on inputs and
 * to block the mutation from firing when required fields are missing.
 */
export function findEmptyRequiredKeys<T>(
  draft: Partial<T>,
  requiredLogicalNames: ReadonlySet<string> | undefined,
  fieldLogicalNameOverrides?: Partial<Record<keyof T, string>>,
): Set<keyof T & string> {
  const invalid = new Set<keyof T & string>();
  if (!requiredLogicalNames || requiredLogicalNames.size === 0) return invalid;

  for (const key of Object.keys(draft) as (keyof T & string)[]) {
    const override = fieldLogicalNameOverrides?.[key];
    const logical = override ?? toDataverseFieldName(key);
    if (!logical || !requiredLogicalNames.has(logical)) continue;

    const value = (draft as Record<string, unknown>)[key];
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '');
    if (isEmpty) invalid.add(key);
  }

  return invalid;
}
