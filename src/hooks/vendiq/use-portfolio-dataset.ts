// Portfolio data hook: fetches all data needed by the dashboard + lookup pages.
// Uses a single React Query key to share cached reads across the Portfolio,
// Contract Expiration, and Vendor Lookup pages.

import { useQuery } from '@tanstack/react-query';
import { useVendiq } from '@/services/vendiq/provider-context';
import type {
  Vendor,
  Contract,
  VendorBudget,
  VendorScore,
  PortfolioFilters,
  TopVendorRow,
  KpiTotals,
  ContractWithVendor,
  CriticalityLevel,
  QuintileRating,
} from '@/types/vendiq';
import { daysUntil, expirationBucket, fiscalYearOf } from '@/lib/vendiq-format';

export interface PortfolioDataset {
  vendors: Vendor[];
  contracts: Contract[];
  budgetsByVendor: Map<string, VendorBudget>; // current fiscal year budget per vendor
  budgetsByVendorAllYears: Map<string, VendorBudget[]>;
  criticalityByVendor: Map<string, CriticalityLevel>;
  dependencyByVendor: Map<string, number | undefined>;
  scoresLatestByVendor: Map<string, VendorScore>;
  contractsByVendor: Map<string, Contract[]>;
  supplierToVendors: Map<string, string[]>;
  fiscalYear: string;
}

export function usePortfolioDataset() {
  const provider = useVendiq();
  const fiscalYear = fiscalYearOf();

  return useQuery<PortfolioDataset>({
    queryKey: ['vendiq', 'portfolio', fiscalYear],
    queryFn: async () => {
      // Fetch the primary collections in parallel. We preload ContractParty,
      // VendorSupplier, and ServiceNowAssessment so the dashboard KPIs and
      // TopVendors rows can join accurately without N+1 calls.
      const [vendors, contracts, budgets, scores, vendorSuppliers, contractParties, snAssessments] = await Promise.all([
        provider.vendors.list({ top: 5000 }),
        provider.contracts.list({ top: 5000 }),
        provider.vendorBudgets.list({ top: 5000 }),
        provider.vendorScores.list({ top: 5000 }),
        provider.vendorSuppliers.list({ top: 5000 }),
        provider.contractParties.list({ top: 5000 }),
        provider.serviceNowAssessments.list({ top: 5000 }),
      ]);

      const budgetsByVendorAllYears = new Map<string, VendorBudget[]>();
      for (const b of budgets) {
        if (!b.vendorId) continue;
        const arr = budgetsByVendorAllYears.get(b.vendorId) ?? [];
        arr.push(b);
        budgetsByVendorAllYears.set(b.vendorId, arr);
      }

      const budgetsByVendor = new Map<string, VendorBudget>();
      for (const [vid, arr] of budgetsByVendorAllYears) {
        // Sort desc by budgetYear and pick the fiscalYear match if any, else latest.
        const sorted = [...arr].sort((a, b) => (b.budgetYear || '').localeCompare(a.budgetYear || ''));
        const thisYear = sorted.find((b) => b.budgetYear === fiscalYear);
        budgetsByVendor.set(vid, thisYear ?? sorted[0]);
      }

      const scoresLatestByVendor = new Map<string, VendorScore>();
      for (const s of scores) {
        if (!s.vendorId) continue;
        const existing = scoresLatestByVendor.get(s.vendorId);
        if (!existing || (s.scoreYear || '').localeCompare(existing.scoreYear || '') > 0) {
          scoresLatestByVendor.set(s.vendorId, s);
        }
      }

      // Criticality: authoritative source is the latest SN criticality assessment
      // (rpvms_assessmenttype = Criticality). Fall back to VendorScore.criticalityScore
      // (rounded 1-5) only when SN has nothing for that vendor.
      const snLatestCritByVendor = new Map<string, { modifiedOn: string | undefined; level: CriticalityLevel }>();
      for (const sn of snAssessments) {
        if (!sn.vendorId || !sn.criticalityLevel) continue;
        if (sn.assessmentType && sn.assessmentType !== 'Criticality') continue;
        const existing = snLatestCritByVendor.get(sn.vendorId);
        if (!existing || (sn.modifiedOn ?? '').localeCompare(existing.modifiedOn ?? '') > 0) {
          snLatestCritByVendor.set(sn.vendorId, { modifiedOn: sn.modifiedOn, level: sn.criticalityLevel });
        }
      }
      const criticalityByVendor = new Map<string, CriticalityLevel>();
      for (const [vid, v] of snLatestCritByVendor) criticalityByVendor.set(vid, v.level);
      for (const [vid, score] of scoresLatestByVendor) {
        if (criticalityByVendor.has(vid)) continue;
        const cs = score.criticalityScore;
        if (cs === undefined) continue;
        const rounded = Math.max(1, Math.min(5, Math.round(cs))) as CriticalityLevel;
        criticalityByVendor.set(vid, rounded);
      }

      const dependencyByVendor = new Map<string, number | undefined>();
      for (const [vid, score] of scoresLatestByVendor) {
        dependencyByVendor.set(vid, score.dependencyScore);
      }

      // Supplier -> Vendors index via the VendorSupplier bridge.
      const supplierToVendors = new Map<string, string[]>();
      for (const vs of vendorSuppliers) {
        if (!vs.supplierId || !vs.vendorId) continue;
        const arr = supplierToVendors.get(vs.supplierId) ?? [];
        arr.push(vs.vendorId);
        supplierToVendors.set(vs.supplierId, arr);
      }

      // Vendor -> Contracts index via ContractParty (authoritative), with fallback
      // through supplier linkage for contracts that have no ContractParty row.
      const contractById = new Map(contracts.map((c) => [c.id, c]));
      const contractsByVendor = new Map<string, Contract[]>();
      const pushVendorContract = (vid: string, c: Contract) => {
        const arr = contractsByVendor.get(vid) ?? [];
        if (!arr.find((x) => x.id === c.id)) arr.push(c);
        contractsByVendor.set(vid, arr);
      };
      for (const cp of contractParties) {
        if (!cp.vendorId || !cp.contractId) continue;
        const c = contractById.get(cp.contractId);
        if (c) pushVendorContract(cp.vendorId, c);
      }
      for (const c of contracts) {
        if (!c.supplierId) continue;
        const vids = supplierToVendors.get(c.supplierId) ?? [];
        for (const vid of vids) pushVendorContract(vid, c);
      }

      return {
        vendors,
        contracts,
        budgetsByVendor,
        budgetsByVendorAllYears,
        criticalityByVendor,
        dependencyByVendor,
        scoresLatestByVendor,
        contractsByVendor,
        supplierToVendors,
        fiscalYear,
      } satisfies PortfolioDataset;
    },
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
  });
}

// ---- Filter matching ----

export function matchesFilters(
  vendor: Vendor,
  filters: PortfolioFilters,
  ctx: PortfolioDataset,
): boolean {
  if (filters.searchText) {
    const q = filters.searchText.trim().toLowerCase();
    if (q && !vendor.vendorName.toLowerCase().includes(q)) return false;
  }
  if (filters.classifications && filters.classifications.length > 0) {
    if (!vendor.classification || !filters.classifications.includes(vendor.classification)) return false;
  }
  if (filters.statuses && filters.statuses.length > 0) {
    if (!vendor.status || !filters.statuses.includes(vendor.status)) return false;
  }
  if (filters.phiAccess && filters.phiAccess.length > 0) {
    if (!vendor.activePhiAccess || !filters.phiAccess.includes(vendor.activePhiAccess)) return false;
  }
  if (filters.criticalityLevels && filters.criticalityLevels.length > 0) {
    const crit = ctx.criticalityByVendor.get(vendor.id);
    if (!crit || !filters.criticalityLevels.includes(crit)) return false;
  }
  if (filters.dependencyMin !== undefined || filters.dependencyMax !== undefined) {
    const dep = ctx.dependencyByVendor.get(vendor.id);
    if (dep === undefined) return false;
    if (filters.dependencyMin !== undefined && dep < filters.dependencyMin) return false;
    if (filters.dependencyMax !== undefined && dep > filters.dependencyMax) return false;
  }
  if (filters.ratings && filters.ratings.length > 0) {
    const b = ctx.budgetsByVendor.get(vendor.id);
    if (!b?.quintileRating || !filters.ratings.includes(b.quintileRating)) return false;
  }
  return true;
}

// ---- Aggregations ----

export function computeKpis(filters: PortfolioFilters, ctx: PortfolioDataset): KpiTotals {
  const filteredVendors = ctx.vendors.filter((v) => matchesFilters(v, filters, ctx));
  const vendorIds = new Set(filteredVendors.map((v) => v.id));

  const activeVendors = filteredVendors.filter((v) => v.status === 'Active').length;

  // Annual spend: sum current-year budgets for filtered vendors.
  let annualSpendYtd = 0;
  for (const vid of vendorIds) {
    const b = ctx.budgetsByVendor.get(vid);
    if (b?.supplierSpend) annualSpendYtd += b.supplierSpend;
  }

  // Contracts expiring in 90 days whose supplier links to a filtered vendor.
  // (Contract linkage via ContractParty is not loaded in the dashboard dataset for v1;
  // we approximate by keeping all contracts expiring ≤90d and filtering later where possible.)
  let expiring90d = 0;
  let criticalAtRisk = 0;
  for (const c of ctx.contracts) {
    const days = daysUntil(c.expirationDate);
    if (days === undefined) continue;
    if (days < 0 || days > 90) continue;
    expiring90d += 1;
  }
  // Critical-at-risk: any filtered vendor with criticality >= 4 that has at least
  // one expiring contract in the 0-90d window (via ContractParty or supplier bridge).
  for (const vid of vendorIds) {
    const crit = ctx.criticalityByVendor.get(vid) ?? 0;
    if (crit < 4) continue;
    const vendorContracts = ctx.contractsByVendor.get(vid) ?? [];
    const hasExpiring = vendorContracts.some((c) => {
      const d = daysUntil(c.expirationDate);
      return d !== undefined && d >= 0 && d <= 90;
    });
    if (hasExpiring) criticalAtRisk += 1;
  }

  return {
    activeVendors,
    annualSpendYtd,
    expiring90dCount: expiring90d,
    criticalAtRiskCount: criticalAtRisk,
    fiscalYear: ctx.fiscalYear,
  };
}

// Because ContractParty and VendorSupplier are now preloaded in the portfolio
// snapshot, these helpers consult the authoritative indexes directly.

export function computeTopVendors(
  filters: PortfolioFilters,
  ctx: PortfolioDataset,
  limit = 20,
): TopVendorRow[] {
  const filtered = ctx.vendors.filter((v) => matchesFilters(v, filters, ctx));
  const rows: TopVendorRow[] = filtered.map((v) => {
    const b = ctx.budgetsByVendor.get(v.id);
    const supplierContracts = findContractsByVendor(v.id, ctx);
    const nextExpiration = minFutureDate(supplierContracts.map((c) => c.expirationDate));
    const nextNotice = minFutureDate(supplierContracts.map((c) => c.noticeDate));
    return {
      vendorId: v.id,
      vendorName: v.vendorName,
      classification: v.classification,
      status: v.status,
      criticality: ctx.criticalityByVendor.get(v.id),
      dependencyScore: ctx.dependencyByVendor.get(v.id),
      quintileRating: b?.quintileRating as QuintileRating | undefined,
      annualSpend: b?.supplierSpend,
      nextExpirationDate: nextExpiration,
      nextNoticeDate: nextNotice,
    };
  });
  return rows
    .sort((a, b) => (b.annualSpend ?? 0) - (a.annualSpend ?? 0))
    .slice(0, limit);
}

/**
 * Authoritative vendor → contracts mapping via the preloaded ContractParty /
 * VendorSupplier indexes built in the dataset queryFn.
 */
function findContractsByVendor(vendorId: string, ctx: PortfolioDataset): Contract[] {
  return ctx.contractsByVendor.get(vendorId) ?? [];
}

function minFutureDate(dates: (string | undefined)[]): string | undefined {
  const now = new Date().getTime();
  let best: { d: Date; iso: string } | undefined;
  for (const iso of dates) {
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    if (d.getTime() < now) continue;
    if (!best || d < best.d) best = { d, iso };
  }
  return best?.iso;
}

export function computeExpirationBuckets(
  filters: PortfolioFilters,
  ctx: PortfolioDataset,
): { '0-30': ContractWithVendor[]; '31-60': ContractWithVendor[]; '61-90': ContractWithVendor[] } {
  const buckets: Record<'0-30' | '31-60' | '61-90', ContractWithVendor[]> = {
    '0-30': [],
    '31-60': [],
    '61-90': [],
  };
  // Apply a text-name filter to the contract itself for now (vendor-link not preloaded).
  const searchNeedle = filters.searchText?.trim().toLowerCase();
  for (const c of ctx.contracts) {
    const days = daysUntil(c.expirationDate);
    const b = expirationBucket(days);
    if (!b) continue;
    if (searchNeedle) {
      const hay = `${c.contractName ?? ''} ${c.supplierName ?? ''} ${c.contractingEntityName ?? ''}`.toLowerCase();
      if (!hay.includes(searchNeedle)) continue;
    }
    buckets[b].push({ ...c, vendorName: c.supplierName, annualSpend: undefined });
  }
  // Sort each bucket ascending by days-to-expiration.
  for (const k of Object.keys(buckets) as Array<keyof typeof buckets>) {
    buckets[k].sort((a, b) => (daysUntil(a.expirationDate) ?? 9999) - (daysUntil(b.expirationDate) ?? 9999));
  }
  return buckets;
}
