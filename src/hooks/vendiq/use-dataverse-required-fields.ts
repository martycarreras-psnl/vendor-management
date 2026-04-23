import { useQuery } from '@tanstack/react-query';
import { useVendiq } from '@/services/vendiq/provider-context';

/**
 * Returns the set of logical column names that Dataverse has marked as
 * Business-Required (`ApplicationRequired`) or `SystemRequired` for the
 * given table. Used by form-save validators to block writes when required
 * fields are empty.
 *
 * Cached for 30 minutes (same as individual field metadata lookups).
 */
export function useDataverseRequiredFields(tableLogicalName: string | undefined) {
  const provider = useVendiq();
  return useQuery({
    queryKey: ['vendiq', 'requiredFields', tableLogicalName],
    enabled: !!tableLogicalName,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: () => provider.fieldMetadata.listRequired(tableLogicalName!),
  });
}
