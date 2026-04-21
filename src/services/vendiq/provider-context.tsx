// Factory + React context for the VendIQ data provider.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { VendIqDataProvider } from '@/services/vendiq/contracts';
import { createVendiqDataverseProvider } from '@/services/vendiq/dataverse-provider';
import { createVendiqMockProvider } from '@/services/vendiq/mock-provider';

export function createVendiqProvider(): VendIqDataProvider {
  return import.meta.env.VITE_USE_MOCK === 'true'
    ? createVendiqMockProvider()
    : createVendiqDataverseProvider();
}

const VendiqProviderContext = createContext<VendIqDataProvider | null>(null);

export function VendiqProvider({
  children,
  provider,
}: {
  children: ReactNode;
  provider?: VendIqDataProvider;
}) {
  const value = useMemo(() => provider ?? createVendiqProvider(), [provider]);
  return <VendiqProviderContext.Provider value={value}>{children}</VendiqProviderContext.Provider>;
}

export function useVendiq(): VendIqDataProvider {
  const ctx = useContext(VendiqProviderContext);
  if (!ctx) {
    throw new Error('useVendiq must be used inside a <VendiqProvider/>.');
  }
  return ctx;
}
