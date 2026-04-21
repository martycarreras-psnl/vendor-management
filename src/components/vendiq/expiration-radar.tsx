import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import type { ContractWithVendor } from '@/types/vendiq';

export function ExpirationRadar({
  buckets,
  onBucketClick,
}: {
  buckets: { '0-30': ContractWithVendor[]; '31-60': ContractWithVendor[]; '61-90': ContractWithVendor[] };
  onBucketClick?: (bucket: '0-30' | '31-60' | '61-90') => void;
}) {
  const data = [
    { bucket: '0-30',  count: buckets['0-30'].length,  fill: 'var(--signal-red)' },
    { bucket: '31-60', count: buckets['31-60'].length, fill: 'var(--signal-amber)' },
    { bucket: '61-90', count: buckets['61-90'].length, fill: 'var(--signal-yellow)' },
  ];

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold">Expiration Radar</h3>
          <p className="text-xs text-muted-foreground">Contracts by days-to-expiration window</p>
        </div>
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <LegendDot color="var(--signal-red)" label="≤30" />
          <LegendDot color="var(--signal-amber)" label="31–60" />
          <LegendDot color="var(--signal-yellow)" label="61–90" />
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="bucket" width={60} />
            <Tooltip
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value} contracts`, 'Count']}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} onClick={(d) => onBucketClick?.(d.bucket as '0-30' | '31-60' | '61-90')} cursor="pointer">
              {data.map((d) => (
                <Cell key={d.bucket} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {(['0-30', '31-60', '61-90'] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onBucketClick?.(b)}
            className={cn(
              'rounded-md border px-3 py-2 text-left text-xs transition-colors hover:bg-muted',
            )}
          >
            <div className="font-semibold">{b} days</div>
            <div className="text-muted-foreground">{buckets[b].length} contract{buckets[b].length === 1 ? '' : 's'}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}
