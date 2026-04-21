import { useQuery } from '@tanstack/react-query';
import { useVendiq } from '@/services/vendiq/provider-context';
import type { ConnectivityStatus } from '@/types/vendiq';

export function useConnectivity(): {
  status: ConnectivityStatus;
  isLoading: boolean;
  refetch: () => void;
} {
  const provider = useVendiq();
  const query = useQuery({
    queryKey: ['vendiq', 'connectivity'],
    queryFn: () => provider.connectivity.probe(),
    refetchOnWindowFocus: true,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const status: ConnectivityStatus = query.data ?? {
    state: 'checking',
  };

  return {
    status,
    isLoading: query.isLoading,
    refetch: () => void query.refetch(),
  };
}
