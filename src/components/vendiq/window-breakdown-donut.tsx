import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { ContractStatus } from '@/types/vendiq';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<ContractStatus, string> = {
  Active: 'var(--signal-green)',
  UnderReview: 'var(--signal-amber)',
  Pending: 'var(--signal-yellow)',
  Expired: 'var(--signal-red)',
  Terminated: 'var(--signal-red)',
  Unknown: 'var(--muted-foreground)',
};

const STATUS_LABELS: Record<ContractStatus, string> = {
  Active: 'Active',
  UnderReview: 'Under Review',
  Pending: 'Pending',
  Expired: 'Expired/Termed',
  Terminated: 'Expired/Termed',
  Unknown: 'Unknown',
};

export function WindowBreakdownDonut({
  counts,
  total,
  title = '90-day window breakdown',
}: {
  counts: Partial<Record<ContractStatus, number>>;
  total: number;
  title?: string;
}) {
  // Collapse Terminated into Expired/Termed visually.
  const merged: Array<{ key: string; label: string; color: string; value: number }> = [];
  const seen = new Set<string>();
  (Object.keys(STATUS_LABELS) as ContractStatus[]).forEach((s) => {
    const label = STATUS_LABELS[s];
    if (seen.has(label)) return;
    seen.add(label);
    const value =
      (counts[s] ?? 0) +
      (s === 'Expired' ? (counts.Terminated ?? 0) : 0);
    if (value > 0 || s === 'Active' || s === 'UnderReview' || s === 'Pending' || s === 'Expired') {
      merged.push({ key: s, label, color: STATUS_COLORS[s], value });
    }
  });

  const data = merged.filter((m) => m.value > 0);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 flex items-center gap-4">
        <div className="relative h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.length ? data : [{ key: 'empty', label: '—', color: 'var(--muted)', value: 1 }]}
                dataKey="value"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {(data.length ? data : [{ color: 'var(--muted)' }]).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-semibold tabular-nums">{total}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">contracts</div>
          </div>
        </div>
        <ul className="flex-1 space-y-1.5 text-xs">
          {merged.map((m) => (
            <li key={m.label} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <span
                  className={cn('inline-block h-2.5 w-2.5 rounded-sm')}
                  style={{ background: m.color }}
                  aria-hidden
                />
                <span>{m.label}</span>
              </span>
              <span className="tabular-nums font-medium">{m.value}</span>
            </li>
          ))}
          {merged.length === 0 && (
            <li className="text-muted-foreground">No contracts in window.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
