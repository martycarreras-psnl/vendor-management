import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { KpiCard } from '@/components/vendiq/kpi-card';
import { ExpirationRadar } from '@/components/vendiq/expiration-radar';
import { WindowBreakdownDonut } from '@/components/vendiq/window-breakdown-donut';
import { TopVendorsTable } from '@/components/vendiq/top-vendors-table';
import {
  usePortfolioDataset,
  computeKpis,
  computeTopVendors,
  computeExpirationBuckets,
} from '@/hooks/vendiq/use-portfolio-dataset';
import { formatCompactNumber, formatCurrency } from '@/lib/vendiq-format';
import type { ContractStatus } from '@/types/vendiq';

// Deterministic PRNG so sparklines are stable across renders without real history.
function seedSeries(seed: number, n = 10, base = 100, jitter = 0.12): number[] {
  let x = Math.sin(seed) * 10000;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    x = (Math.sin(x * 1.1 + i) * 10000) % 1;
    const frac = Math.abs(x);
    out.push(base * (1 - jitter / 2 + frac * jitter));
  }
  return out;
}

export default function PortfolioPage() {
  const navigate = useNavigate();
  const dataset = usePortfolioDataset();

  // Dashboard shows the unfiltered aggregate view; filtering happens on Vendor 360 / Contracts pages.
  const emptyFilters = useMemo(() => ({}), []);

  if (dataset.isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading portfolio data…</div>;
  }
  if (dataset.isError || !dataset.data) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load portfolio. Check the connectivity pill in the header and try again.
        {dataset.error instanceof Error ? <div className="mt-1 text-xs opacity-80">{dataset.error.message}</div> : null}
      </div>
    );
  }

  const ctx = dataset.data;
  const kpis = computeKpis(emptyFilters, ctx);
  const topVendors = computeTopVendors(emptyFilters, ctx, 10);
  const buckets = computeExpirationBuckets(emptyFilters, ctx);

  // Build a contractId -> approximate annual spend map for treemap sizing.
  // For contracts linked via ContractParty we look up the vendor's budget;
  // for contracts linked only by supplier we sum budgets across linked vendors.
  const vendorSpendByContract = useMemo(() => {
    const map = new Map<string, number>();
    const spendByVendor = (vid: string) => ctx.budgetsByVendor.get(vid)?.supplierSpend ?? 0;
    // Pre-index vendor -> contracts we already have
    const vendorContractIndex = ctx.contractsByVendor;
    for (const [vid, contracts] of vendorContractIndex) {
      const spend = spendByVendor(vid);
      for (const c of contracts) {
        map.set(c.id, (map.get(c.id) ?? 0) + spend);
      }
    }
    return map;
  }, [ctx]);

  // Donut: breakdown of contracts in 0-90d window by contractStatus.
  const windowContracts = [...buckets['0-30'], ...buckets['31-60'], ...buckets['61-90']];
  const statusCounts = windowContracts.reduce<Partial<Record<ContractStatus, number>>>((acc, c) => {
    const s = (c.contractStatus ?? 'Unknown') as ContractStatus;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  // Sparklines: deterministic series based on value magnitude (real time-series TBD).
  const activeTrend = seedSeries(kpis.activeVendors || 1, 10, kpis.activeVendors || 1);
  const spendTrend = seedSeries((kpis.annualSpendYtd || 1) / 1e6, 10, kpis.annualSpendYtd || 1);
  const expiringTrend = seedSeries(kpis.expiring90dCount || 1, 10, kpis.expiring90dCount || 1);
  const riskTrend = seedSeries(kpis.criticalAtRiskCount || 1, 10, kpis.criticalAtRiskCount || 1);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Vendor Portfolio</h1>
        <p className="text-sm text-muted-foreground">
          FY{ctx.fiscalYear} · {ctx.vendors.length} vendors tracked · {ctx.contracts.length} contracts on file
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active Vendors"
          value={formatCompactNumber(kpis.activeVendors)}
          sublabel="Status = Active"
          accent="primary"
          trend={activeTrend}
        />
        <KpiCard
          label={`Annual Spend (FY${ctx.fiscalYear} YTD)`}
          value={formatCurrency(kpis.annualSpendYtd)}
          sublabel={`FY ${kpis.fiscalYear} budgets`}
          accent="signal-green"
          trend={spendTrend}
          trendDirection="up"
        />
        <KpiCard
          label="Contracts Expiring · 90 days"
          value={formatCompactNumber(kpis.expiring90dCount)}
          sublabel={`${buckets['0-30'].length} critical`}
          accent="signal-amber"
          trend={expiringTrend}
        />
        <KpiCard
          label="Critical Vendors at Risk"
          value={formatCompactNumber(kpis.criticalAtRiskCount)}
          sublabel="Contract ≤90d × Criticality ≥4"
          accent="signal-red"
          trend={riskTrend}
          trendDirection="down"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ExpirationRadar
            buckets={buckets}
            onBucketClick={(b) => navigate(`/contracts?bucket=${b}`)}
            vendorSpendByContract={vendorSpendByContract}
          />
        </div>
        <WindowBreakdownDonut counts={statusCounts} total={windowContracts.length} />
      </section>

      <section>
        <TopVendorsTable rows={topVendors} />
      </section>
    </div>
  );
}
