import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CriticalityLevel } from '@/types/vendiq';

export const CRITICALITY_META: Record<
  CriticalityLevel,
  { label: string; short: string; bg: string; text: string; description: string }
> = {
  1: {
    label: 'Negligible',
    short: '1 · Negligible',
    bg: 'bg-crit-1/25',
    text: 'text-crit-1',
    description:
      'Negligible impact. Disruption causes minor inconvenience absorbed by existing processes. No patient care, financial, or regulatory consequences.',
  },
  2: {
    label: 'Low',
    short: '2 · Low',
    bg: 'bg-crit-2/25',
    text: 'text-crit-2',
    description:
      'Low impact. Short, localized disruption is manageable with internal workarounds. Limited financial exposure and no material effect on patient care or compliance.',
  },
  3: {
    label: 'Noticeable',
    short: '3 · Noticeable',
    bg: 'bg-crit-3/25',
    text: 'text-crit-3',
    description:
      'Noticeable impact. Disruption degrades service levels across a department or region. Moderate financial, operational, or reputational consequences requiring active mitigation.',
  },
  4: {
    label: 'Considerable',
    short: '4 · Considerable',
    bg: 'bg-crit-4/25',
    text: 'text-crit-4',
    description:
      'Considerable impact. Outage directly affects patient care, clinical operations, or multiple sites. Significant financial, regulatory, or reputational risk requiring executive attention.',
  },
  5: {
    label: 'Catastrophic',
    short: '5 · Catastrophic',
    bg: 'bg-crit-5/25',
    text: 'text-crit-5',
    description:
      'Catastrophic impact. Loss of this vendor halts mission-critical services, jeopardizes patient safety, or triggers material regulatory/financial exposure. Enterprise-wide business continuity concern.',
  },
};

export function CriticalityPill({
  level,
  onClick,
  className,
  showTooltip = true,
}: {
  level: CriticalityLevel | undefined;
  onClick?: () => void;
  className?: string;
  showTooltip?: boolean;
}) {
  if (!level) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground', className)}>
        Unrated
      </span>
    );
  }
  const meta = CRITICALITY_META[level];
  const pill = (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', meta.bg, meta.text, className)}>
      <span className="font-bold">{level}</span>
      <span>· {meta.label}</span>
    </span>
  );

  const interactive = onClick ? (
    <button type="button" onClick={onClick} className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring rounded-full">
      {pill}
    </button>
  ) : (
    pill
  );

  if (!showTooltip) return interactive;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{interactive}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left">
        <div className="font-semibold">{meta.short}</div>
        <div className="mt-1 text-[11px] leading-relaxed opacity-90">{meta.description}</div>
      </TooltipContent>
    </Tooltip>
  );
}
