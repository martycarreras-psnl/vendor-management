// Status badge for VendorScore review lifecycle.

import { cn } from '@/lib/utils';
import type { ScoreStatus } from '@/types/vendiq';

const META: Record<ScoreStatus, { label: string; cls: string }> = {
  NotStarted: { label: 'Not started', cls: 'bg-muted text-muted-foreground' },
  Draft: { label: 'Draft', cls: 'bg-signal-yellow/30 text-slate-900' },
  Approved: { label: 'Approved', cls: 'bg-emerald-600 text-white' },
  Rejected: { label: 'Rejected', cls: 'bg-signal-red text-white' },
};

export function ScoreStatusBadge({
  status,
  className,
}: {
  status: ScoreStatus | undefined | null;
  className?: string;
}) {
  const s: ScoreStatus = status ?? 'NotStarted';
  const meta = META[s];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        meta.cls,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
