import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import type { ContractWithVendor } from '@/types/vendiq';
import { formatCurrency } from '@/lib/vendiq-format';

type Bucket = '0-30' | '31-60' | '61-90';

const BUCKET_META: Record<Bucket, { label: string; color: string; text: string }> = {
  '0-30':  { label: '0–30 days',  color: 'bg-signal-red',    text: 'text-white' },
  '31-60': { label: '31–60 days', color: 'bg-signal-amber',  text: 'text-white' },
  '61-90': { label: '61–90 days', color: 'bg-signal-yellow', text: 'text-slate-900' },
};

export function ExpirationRadar({
  buckets,
  onBucketClick,
  vendorSpendByContract,
}: {
  buckets: { '0-30': ContractWithVendor[]; '31-60': ContractWithVendor[]; '61-90': ContractWithVendor[] };
  onBucketClick?: (bucket: Bucket) => void;
  /** Optional map from contractId → annual spend for sizing blocks. */
  vendorSpendByContract?: Map<string, number>;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold">Expiration Radar · next 90 days</h3>
          <p className="text-xs text-muted-foreground">Blocks sized by annual spend. Click a bucket to drill in.</p>
        </div>
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <LegendDot color="bg-signal-red" label="0–30d" />
          <LegendDot color="bg-signal-amber" label="31–60d" />
          <LegendDot color="bg-signal-yellow" label="61–90d" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {(Object.keys(BUCKET_META) as Bucket[]).map((bucket) => (
          <BucketRow
            key={bucket}
            bucket={bucket}
            contracts={buckets[bucket]}
            onClick={() => onBucketClick?.(bucket)}
            vendorSpendByContract={vendorSpendByContract}
          />
        ))}
      </div>
    </div>
  );
}

function BucketRow({
  bucket,
  contracts,
  onClick,
  vendorSpendByContract,
}: {
  bucket: Bucket;
  contracts: ContractWithVendor[];
  onClick: () => void;
  vendorSpendByContract?: Map<string, number>;
}) {
  const meta = BUCKET_META[bucket];

  // Sort contracts by annual spend desc so biggest blocks come first.
  const sorted = [...contracts].sort((a, b) => {
    const av = vendorSpendByContract?.get(a.id) ?? a.annualSpend ?? 0;
    const bv = vendorSpendByContract?.get(b.id) ?? b.annualSpend ?? 0;
    return bv - av;
  });

  // Show up to 8 labeled blocks; remainder is a "more" tile.
  const MAX_LABELED = 8;
  const labeled = sorted.slice(0, MAX_LABELED);
  const remaining = sorted.length - labeled.length;

  // Compute flex weights from spend; fall back to equal weight if unknown.
  const weights = labeled.map((c) => {
    const v = vendorSpendByContract?.get(c.id) ?? c.annualSpend ?? 0;
    return Math.max(v, 1);
  });
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  const minFlex = 0.7;

  return (
    <div className="flex items-stretch gap-3">
      <button
        type="button"
        onClick={onClick}
        className="flex w-28 shrink-0 flex-col justify-center rounded-md text-left text-xs hover:bg-muted"
      >
        <div className="font-semibold">{meta.label}</div>
        <div className="text-muted-foreground">{contracts.length} contract{contracts.length === 1 ? '' : 's'}</div>
      </button>
      <div className="flex min-h-[56px] flex-1 gap-1 overflow-hidden rounded-md">
        {labeled.length === 0 ? (
          <div className="flex w-full items-center justify-center rounded-md border bg-muted/30 px-3 text-xs text-muted-foreground">
            No contracts in this window
          </div>
        ) : (
          <>
            {labeled.map((c, i) => {
              const flex = Math.max(minFlex, (weights[i] / total) * labeled.length);
              const spend = vendorSpendByContract?.get(c.id) ?? c.annualSpend;
              return (
                <Link
                  key={c.id}
                  to={`/contracts/${c.id}`}
                  style={{ flex: `${flex} 1 0`, minWidth: 40 }}
                  className={cn(
                    'group relative flex flex-col justify-center overflow-hidden rounded-md px-2 py-1 text-left transition-opacity hover:opacity-90',
                    meta.color,
                    meta.text,
                  )}
                  title={`${c.vendorName ?? c.supplierName ?? c.contractName}${spend ? ` · ${formatCurrency(spend)}` : ''}`}
                >
                  <div className="truncate text-[11px] font-semibold leading-tight">
                    {c.vendorName ?? c.supplierName ?? c.contractName}
                  </div>
                  {spend !== undefined && (
                    <div className="truncate text-[10px] opacity-85">{formatCurrency(spend)}</div>
                  )}
                </Link>
              );
            })}
            {remaining > 0 && (
              <button
                type="button"
                onClick={onClick}
                className={cn(
                  'flex items-center justify-center rounded-md px-3 text-[11px] font-medium opacity-60 hover:opacity-80',
                  meta.color,
                  meta.text,
                )}
              >
                +{remaining}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('inline-block h-2 w-2 rounded-full', color)} aria-hidden />
      {label}
    </span>
  );
}
