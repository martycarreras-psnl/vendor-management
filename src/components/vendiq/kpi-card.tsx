import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { cn } from '@/lib/utils';

type Accent = 'primary' | 'signal-red' | 'signal-amber' | 'signal-green';

export function KpiCard({
  label,
  value,
  sublabel,
  accent = 'primary',
  trend,
  trendDirection,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: Accent;
  /** Optional array of numeric values to render as a sparkline. */
  trend?: number[];
  /** Optional direction for color-coding the sparkline (defaults to accent). */
  trendDirection?: 'up' | 'down' | 'flat';
}) {
  const accentBar =
    accent === 'signal-red' ? 'bg-signal-red' :
    accent === 'signal-amber' ? 'bg-signal-amber' :
    accent === 'signal-green' ? 'bg-signal-green' :
    'bg-primary';

  const accentText =
    accent === 'signal-red' ? 'text-signal-red' :
    accent === 'signal-amber' ? 'text-signal-amber' :
    accent === 'signal-green' ? 'text-signal-green' :
    'text-primary';

  const sparkColor =
    trendDirection === 'down' ? 'var(--signal-red)' :
    trendDirection === 'up' ? 'var(--signal-green)' :
    accent === 'signal-red' ? 'var(--signal-red)' :
    accent === 'signal-amber' ? 'var(--signal-amber)' :
    accent === 'signal-green' ? 'var(--signal-green)' :
    'var(--primary)';

  const sparkData = (trend ?? []).map((v, i) => ({ i, v }));

  return (
    <div className="relative overflow-hidden rounded-lg border bg-card p-4 shadow-sm">
      <div className={cn('absolute inset-y-0 left-0 w-1', accentBar)} aria-hidden />
      <div className="flex items-start justify-between gap-4 pl-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={cn('mt-1 text-3xl font-semibold tabular-nums', accentText)}>{value}</div>
          {sublabel && <div className="mt-0.5 text-xs text-muted-foreground">{sublabel}</div>}
        </div>
        {sparkData.length > 1 && (
          <div className="h-12 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
