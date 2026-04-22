// Mock provider: each method throws NotImplemented. User opted for real-Dataverse only;
// the seam exists so fixtures can be layered later.

import type { VendIqDataProvider } from '@/services/vendiq/contracts';
import type { ConnectivityStatus } from '@/types/vendiq';

function notImpl(surface: string): never {
  throw new Error(`[VendIQ mock] ${surface} is not implemented. Set VITE_USE_MOCK=false and run against Dataverse.`);
}

export function createVendiqMockProvider(): VendIqDataProvider {
  const stub = new Proxy(
    {},
    {
      get(_target, prop: string) {
        return () => notImpl(String(prop));
      },
    },
  );
  return {
    vendors: stub as VendIqDataProvider['vendors'],
    suppliers: stub as VendIqDataProvider['suppliers'],
    vendorSuppliers: stub as VendIqDataProvider['vendorSuppliers'],
    contracts: stub as VendIqDataProvider['contracts'],
    contractParties: stub as VendIqDataProvider['contractParties'],
    glTransactions: stub as VendIqDataProvider['glTransactions'],
    vendorScores: stub as VendIqDataProvider['vendorScores'],
    vendorBudgets: stub as VendIqDataProvider['vendorBudgets'],
    vendorRateCards: stub as VendIqDataProvider['vendorRateCards'],
    vendorProductServices: stub as VendIqDataProvider['vendorProductServices'],
    vendorNameAliases: stub as VendIqDataProvider['vendorNameAliases'],
    oneTrustAssessments: stub as VendIqDataProvider['oneTrustAssessments'],
    serviceNowAssessments: stub as VendIqDataProvider['serviceNowAssessments'],
    promptSuggestions: stub as VendIqDataProvider['promptSuggestions'],
    reviewers: stub as VendIqDataProvider['reviewers'],
    assignments: stub as VendIqDataProvider['assignments'],
    connectivity: {
      async probe(): Promise<ConnectivityStatus> {
        return {
          state: 'offline',
          lastCheckedAt: new Date().toISOString(),
          error: 'Mock mode: Dataverse not connected.',
        };
      },
    },
    async getVendorCriticality() {
      return undefined;
    },
  };
}
