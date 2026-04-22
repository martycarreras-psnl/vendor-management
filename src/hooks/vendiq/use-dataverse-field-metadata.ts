import { useQuery } from '@tanstack/react-query';
import { useVendiq } from '@/services/vendiq/provider-context';

export function useDataverseFieldMetadata(tableLogicalName: string, fieldLogicalName: string) {
  const provider = useVendiq();

  return useQuery({
    queryKey: ['vendiq', 'fieldMetadata', tableLogicalName, fieldLogicalName],
    enabled: !!tableLogicalName && !!fieldLogicalName,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: () => provider.fieldMetadata.getField(tableLogicalName, fieldLogicalName),
  });
}