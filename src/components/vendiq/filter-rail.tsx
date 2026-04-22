import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CRITICALITY_META } from '@/components/vendiq/criticality-pill';
import type {
  PortfolioFilters,
  VendorClassification,
  VendorStatus,
  CriticalityLevel,
  QuintileRating,
} from '@/types/vendiq';

const CLASSIFICATIONS: VendorClassification[] = [
  'Clinical',
  'ProfessionalServices',
  'ITInfrastructure',
  'Security',
  'Telecom',
  'Staffing',
  'Other',
];
const STATUSES: VendorStatus[] = [
  'Active',
  'Inactive',
  'Onboarding',
  'Offboarded',
  'UnderReview',
];
const RATINGS: QuintileRating[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];
const CRIT_LEVELS: CriticalityLevel[] = [1, 2, 3, 4, 5];

function Checkbox({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
        'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border',
          active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent',
        )}
      >
        {active && (
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

function Section({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group border-b last:border-b-0 py-3 first:pt-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <span>{label}</span>
        <svg
          viewBox="0 0 16 16"
          className="h-3 w-3 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="mt-2 flex flex-col gap-0.5">{children}</div>
    </details>
  );
}

export function FilterRail({
  filters,
  onChange,
  onClear,
  className,
}: {
  filters: PortfolioFilters;
  onChange: (patch: Partial<PortfolioFilters>) => void;
  onClear: () => void;
  className?: string;
}) {
  function toggle<T>(arr: T[] | undefined, val: T): T[] {
    const set = new Set(arr ?? []);
    if (set.has(val)) set.delete(val); else set.add(val);
    return Array.from(set);
  }

  const hasAny =
    (filters.classifications?.length ?? 0) > 0 ||
    (filters.statuses?.length ?? 0) > 0 ||
    (filters.criticalityLevels?.length ?? 0) > 0 ||
    (filters.ratings?.length ?? 0) > 0 ||
    filters.expiringWithinDays !== undefined ||
    (filters.searchText ?? '').length > 0;

  return (
    <aside className={cn('rounded-lg border bg-card p-4 shadow-sm', className)}>
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-sm font-semibold">Filters</h2>
        {hasAny && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-7 px-2 text-xs">
            Clear
          </Button>
        )}
      </div>

      <div className="pb-3">
        <Input
          type="search"
          placeholder="Search vendors…"
          value={filters.searchText ?? ''}
          onChange={(e) => onChange({ searchText: e.target.value })}
          className="h-8 text-xs"
        />
      </div>

      <Section label="Classification">
        {CLASSIFICATIONS.map((c) => (
          <Checkbox
            key={c}
            active={(filters.classifications ?? []).includes(c)}
            onClick={() => onChange({ classifications: toggle(filters.classifications, c) })}
          >
            {c}
          </Checkbox>
        ))}
      </Section>

      <Section label="Status">
        {STATUSES.map((s) => (
          <Checkbox
            key={s}
            active={(filters.statuses ?? []).includes(s)}
            onClick={() => onChange({ statuses: toggle(filters.statuses, s) })}
          >
            {s}
          </Checkbox>
        ))}
      </Section>

      <Section label="Criticality">
        {CRIT_LEVELS.map((lvl) => {
          const meta = CRITICALITY_META[lvl];
          return (
            <Checkbox
              key={lvl}
              active={(filters.criticalityLevels ?? []).includes(lvl)}
              onClick={() => onChange({ criticalityLevels: toggle(filters.criticalityLevels, lvl) })}
              title={meta.description}
            >
              <span className="tabular-nums font-medium">{lvl}</span>
              <span className="text-muted-foreground"> · {meta.label}</span>
            </Checkbox>
          );
        })}
      </Section>

      <Section label="Rating" defaultOpen={false}>
        {RATINGS.map((r) => (
          <Checkbox
            key={r}
            active={(filters.ratings ?? []).includes(r)}
            onClick={() => onChange({ ratings: toggle(filters.ratings, r) })}
          >
            {r}
          </Checkbox>
        ))}
      </Section>

      <Section label="Expiring Within">
        {([30, 60, 90] as const).map((d) => (
          <Checkbox
            key={d}
            active={filters.expiringWithinDays === d}
            onClick={() => onChange({ expiringWithinDays: filters.expiringWithinDays === d ? undefined : d })}
          >
            ≤ {d} days
          </Checkbox>
        ))}
      </Section>
    </aside>
  );
}
