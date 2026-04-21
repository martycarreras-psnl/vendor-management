import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-transparent text-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

export function FilterBar({
  filters,
  onChange,
  onClear,
}: {
  filters: PortfolioFilters;
  onChange: (patch: Partial<PortfolioFilters>) => void;
  onClear: () => void;
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
    <div className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <FilterGroup label="Classification">
          {CLASSIFICATIONS.map((c) => (
            <ToggleChip
              key={c}
              active={(filters.classifications ?? []).includes(c)}
              onClick={() => onChange({ classifications: toggle(filters.classifications, c) })}
            >
              {c}
            </ToggleChip>
          ))}
        </FilterGroup>
        <FilterGroup label="Status">
          {STATUSES.map((s) => (
            <ToggleChip
              key={s}
              active={(filters.statuses ?? []).includes(s)}
              onClick={() => onChange({ statuses: toggle(filters.statuses, s) })}
            >
              {s}
            </ToggleChip>
          ))}
        </FilterGroup>
        <FilterGroup label="Criticality">
          {CRIT_LEVELS.map((lvl) => (
            <ToggleChip
              key={lvl}
              active={(filters.criticalityLevels ?? []).includes(lvl)}
              onClick={() => onChange({ criticalityLevels: toggle(filters.criticalityLevels, lvl) })}
            >
              {lvl}
            </ToggleChip>
          ))}
        </FilterGroup>
        <FilterGroup label="Rating">
          {RATINGS.map((r) => (
            <ToggleChip
              key={r}
              active={(filters.ratings ?? []).includes(r)}
              onClick={() => onChange({ ratings: toggle(filters.ratings, r) })}
            >
              {r}
            </ToggleChip>
          ))}
        </FilterGroup>
        <FilterGroup label="Expiring">
          {([30, 60, 90] as const).map((d) => (
            <ToggleChip
              key={d}
              active={filters.expiringWithinDays === d}
              onClick={() => onChange({ expiringWithinDays: filters.expiringWithinDays === d ? undefined : d })}
            >
              ≤{d}d
            </ToggleChip>
          ))}
        </FilterGroup>
      </div>
      <div className="mt-2 flex items-center justify-end">
        {hasAny && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}
