import { cn } from '@/lib/utils';

export function KpiCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: 'primary' | 'signal-red' | 'signal-amber' | 'signal-green';
}) {
  const accentCls =
    accent === 'signal-red' ? 'text-signal-red' :
    accent === 'signal-amber' ? 'text-signal-amber' :
    accent === 'signal-green' ? 'text-signal-green' :
    'text-primary';
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-3xl font-semibold tabular-nums', accentCls)}>{value}</div>
      {sublabel && <div className="mt-0.5 text-xs text-muted-foreground">{sublabel}</div>}
    </div>
  );
}
