import { useNavigate } from 'react-router-dom';
import { KpiCard } from '@/components/vendiq/kpi-card';
import { FilterBar } from '@/components/vendiq/filter-bar';
import { ExpirationRadar } from '@/components/vendiq/expiration-radar';
import { TopVendorsTable } from '@/components/vendiq/top-vendors-table';
import { usePortfolioDataset, computeKpis, computeTopVendors, computeExpirationBuckets } from '@/hooks/vendiq/use-portfolio-dataset';
import { usePortfolioFilters } from '@/hooks/vendiq/use-portfolio-filters';
import { formatCompactNumber, formatCurrency } from '@/lib/vendiq-format';

export default function PortfolioPage() {
  const navigate = useNavigate();
  const dataset = usePortfolioDataset();
  const { filters, setFilters, clear } = usePortfolioFilters();

  if (dataset.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">Loading portfolio data…</div>
    );
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
  const kpis = computeKpis(filters, ctx);
  const topVendors = computeTopVendors(filters, ctx, 20);
  const buckets = computeExpirationBuckets(filters, ctx);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Vendor Portfolio</h1>
        <p className="text-sm text-muted-foreground">Fiscal year {ctx.fiscalYear} · {ctx.vendors.length} vendors tracked · {ctx.contracts.length} contracts on file</p>
      </header>

      <FilterBar filters={filters} onChange={setFilters} onClear={clear} />

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active vendors" value={formatCompactNumber(kpis.activeVendors)} sublabel="Status = Active" />
        <KpiCard label="Annual spend (YTD)" value={formatCurrency(kpis.annualSpendYtd)} sublabel={`FY ${kpis.fiscalYear} budgets`} accent="primary" />
        <KpiCard label="Contracts expiring 90d" value={formatCompactNumber(kpis.expiring90dCount)} sublabel="Across all suppliers" accent="signal-amber" />
        <KpiCard label="Critical vendors at risk" value={formatCompactNumber(kpis.criticalAtRiskCount)} sublabel="Criticality ≥4 · expiring ≤90d" accent="signal-red" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ExpirationRadar
            buckets={buckets}
            onBucketClick={(b) => navigate(`/contracts?bucket=${b}`)}
          />
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold">90-day action list</h3>
            <p className="text-xs text-muted-foreground">Most imminent contract expirations</p>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {[...buckets['0-30'], ...buckets['31-60'], ...buckets['61-90']].slice(0, 8).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-medium" title={c.contractName}>{c.contractName}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.supplierName ?? 'No supplier linked'}</div>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <div className="font-semibold tabular-nums">{c.expirationDate ? new Date(c.expirationDate).toLocaleDateString() : '—'}</div>
                  <div className="text-muted-foreground">{c.contractType ?? ''}</div>
                </div>
              </li>
            ))}
            {buckets['0-30'].length + buckets['31-60'].length + buckets['61-90'].length === 0 && (
              <li className="text-sm text-muted-foreground">No contracts expiring in 90 days.</li>
            )}
          </ul>
        </div>
      </section>

      <section>
        <TopVendorsTable rows={topVendors} />
      </section>
    </div>
  );
}
