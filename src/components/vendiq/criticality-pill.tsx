import { cn } from '@/lib/utils';
import type { CriticalityLevel } from '@/types/vendiq';

export const CRITICALITY_META: Record<CriticalityLevel, { label: string; short: string; bg: string; text: string }> = {
  1: { label: 'Negligible', short: '1 · Negligible', bg: 'bg-crit-1/25', text: 'text-crit-1' },
  2: { label: 'Low',        short: '2 · Low',        bg: 'bg-crit-2/25', text: 'text-crit-2' },
  3: { label: 'Noticeable', short: '3 · Noticeable', bg: 'bg-crit-3/25', text: 'text-crit-3' },
  4: { label: 'Considerable', short: '4 · Considerable', bg: 'bg-crit-4/25', text: 'text-crit-4' },
  5: { label: 'Catastrophic', short: '5 · Catastrophic', bg: 'bg-crit-5/25', text: 'text-crit-5' },
};

export function CriticalityPill({
  level,
  onClick,
  className,
}: {
  level: CriticalityLevel | undefined;
  onClick?: () => void;
  className?: string;
}) {
  if (!level) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground', className)}>
        Unrated
      </span>
    );
  }
  const meta = CRITICALITY_META[level];
  const body = (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', meta.bg, meta.text, className)}>
      <span className="font-bold">{level}</span>
      <span>· {meta.label}</span>
    </span>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring rounded-full">
        {body}
      </button>
    );
  }
  return body;
}
