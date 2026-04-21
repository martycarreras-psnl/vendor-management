import { Link } from 'react-router-dom';
import { usePortfolioDataset, computeExpirationBuckets } from '@/hooks/vendiq/use-portfolio-dataset';
import { usePortfolioFilters } from '@/hooks/vendiq/use-portfolio-filters';
import { FilterBar } from '@/components/vendiq/filter-bar';
import { cn } from '@/lib/utils';
import { daysUntil, formatDate } from '@/lib/vendiq-format';
import type { ContractWithVendor } from '@/types/vendiq';

const BUCKET_LABELS: Record<'0-30' | '31-60' | '61-90', { title: string; tone: string }> = {
  '0-30': { title: '0–30 days', tone: 'border-signal-red/40 bg-signal-red/5' },
  '31-60': { title: '31–60 days', tone: 'border-signal-amber/40 bg-signal-amber/5' },
  '61-90': { title: '61–90 days', tone: 'border-signal-yellow/40 bg-signal-yellow/5' },
};

export default function ContractExpirationPage() {
  const dataset = usePortfolioDataset();
  const { filters, setFilters, clear } = usePortfolioFilters();

  if (dataset.isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading contracts…</div>;
  }
  if (dataset.isError || !dataset.data) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Failed to load contracts.</div>;
  }

  const buckets = computeExpirationBuckets(filters, dataset.data);
  const actionRail = actionRequiredWithin14Days(buckets);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Contract Expiration</h1>
        <p className="text-sm text-muted-foreground">30 / 60 / 90-day action horizon · {dataset.data.contracts.length} contracts on file</p>
      </header>

      <FilterBar filters={filters} onChange={setFilters} onClear={clear} />

      {actionRail.length > 0 && (
        <section className="rounded-lg border border-signal-red/40 bg-signal-red/5 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-signal-red">Action Required · Notice date within 14 days</h3>
            <span className="text-xs text-muted-foreground">{actionRail.length} contract{actionRail.length === 1 ? '' : 's'}</span>
          </div>
          <ul className="grid gap-2 md:grid-cols-2">
            {actionRail.map((c) => (
              <li key={c.id} className="rounded-md border bg-card p-3 text-sm">
                <div className="font-medium">{c.contractName}</div>
                <div className="text-xs text-muted-foreground">
                  Notice {formatDate(c.noticeDate)} · Expires {formatDate(c.expirationDate)} · {c.supplierName ?? 'No supplier'}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        {(['0-30', '31-60', '61-90'] as const).map((k) => (
          <BucketColumn key={k} bucketKey={k} items={buckets[k]} />
        ))}
      </section>
    </div>
  );
}

function actionRequiredWithin14Days(
  buckets: { '0-30': ContractWithVendor[]; '31-60': ContractWithVendor[]; '61-90': ContractWithVendor[] },
): ContractWithVendor[] {
  const all = [...buckets['0-30'], ...buckets['31-60'], ...buckets['61-90']];
  return all.filter((c) => {
    const d = daysUntil(c.noticeDate);
    return d !== undefined && d >= 0 && d <= 14;
  });
}

function BucketColumn({
  bucketKey,
  items,
}: {
  bucketKey: '0-30' | '31-60' | '61-90';
  items: ContractWithVendor[];
}) {
  const meta = BUCKET_LABELS[bucketKey];
  return (
    <div className={cn('rounded-lg border p-3', meta.tone)}>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{meta.title}</h3>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className="rounded-md border bg-card p-3 text-sm shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0 truncate font-medium" title={c.contractName}>{c.contractName}</div>
              <div className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatDate(c.expirationDate)}</div>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">{c.supplierName ?? '—'}</span>
              {c.contractType && <span className="shrink-0 rounded-full border px-2 py-0.5">{c.contractType}</span>}
            </div>
            {c.noticeDate && (
              <div className="mt-1 text-xs">
                <span className="text-muted-foreground">Notice:</span> <span className="font-medium">{formatDate(c.noticeDate)}</span>
              </div>
            )}
            {c.supplierId && (
              <Link to={`/vendors?q=${encodeURIComponent(c.supplierName ?? '')}`} className="mt-2 block text-xs text-primary hover:underline">
                Find linked vendor →
              </Link>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-muted-foreground">No contracts in this window.</li>}
      </ul>
    </div>
  );
}
