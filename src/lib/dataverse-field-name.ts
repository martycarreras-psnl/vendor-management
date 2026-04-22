// Convention-based mapping from camelCase domain keys to Dataverse logical names.
// Every custom column in this solution uses the publisher prefix `rpvms_` and
// the column logical name is the domain key lowercased. Any field that breaks
// this convention (e.g. out-of-the-box Dataverse attributes) should be passed
// explicitly via `fieldLogicalName` on form helpers.

export const DATAVERSE_PREFIX = 'rpvms_';

/**
 * Convert a camelCase domain model key to the Dataverse logical column name.
 *
 * Examples:
 *   toDataverseFieldName('vendorName')       -> 'rpvms_vendorname'
 *   toDataverseFieldName('primaryOffering')  -> 'rpvms_primaryoffering'
 *   toDataverseFieldName('categoryL1')       -> 'rpvms_categoryl1'
 *   toDataverseFieldName('rpvms_something')  -> 'rpvms_something' (passthrough)
 *
 * Pass an explicit logical name string to bypass the convention.
 */
export function toDataverseFieldName(key: string | undefined | null): string | undefined {
  if (!key) return undefined;
  if (key.startsWith(DATAVERSE_PREFIX)) return key.toLowerCase();
  return `${DATAVERSE_PREFIX}${key.toLowerCase()}`;
}
