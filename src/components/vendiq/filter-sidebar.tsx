// Amazon-style vertical filter sidebar for the Vendor Lookup page.

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type {
  PortfolioFilters,
  VendorClassification,
  VendorStatus,
  CriticalityLevel,
  QuintileRating,
} from '@/types/vendiq';

const CLASSIFICATIONS: { value: VendorClassification; label: string }[] = [
  { value: 'Clinical', label: 'Clinical' },
  { value: 'ProfessionalServices', label: 'Professional Services' },
  { value: 'ITInfrastructure', label: 'IT Infrastructure' },
  { value: 'Security', label: 'Security' },
  { value: 'Telecom', label: 'Telecom' },
  { value: 'Staffing', label: 'Staffing' },
  { value: 'Other', label: 'Other' },
];
const STATUSES: VendorStatus[] = ['Active', 'Inactive', 'Onboarding', 'Offboarded', 'UnderReview'];
const RATINGS: QuintileRating[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];
const CRIT_LEVELS: { value: CriticalityLevel; label: string }[] = [
  { value: 1, label: '1 — Negligible' },
  { value: 2, label: '2 — Low' },
  { value: 3, label: '3 — Moderate' },
  { value: 4, label: '4 — High' },
  { value: 5, label: '5 — Catastrophic' },
];

export function FilterSidebar({
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
    <aside className="w-56 shrink-0 space-y-5">
      {hasAny && (
        <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={onClear}>
          ✕ Clear all filters
        </Button>
      )}

      <FilterSection title="Classification">
        {CLASSIFICATIONS.map((c) => (
          <CheckItem
            key={c.value}
            checked={(filters.classifications ?? []).includes(c.value)}
            onChange={() => onChange({ classifications: toggle(filters.classifications, c.value) })}
            label={c.label}
          />
        ))}
      </FilterSection>

      <FilterSection title="Status">
        {STATUSES.map((s) => (
          <CheckItem
            key={s}
            checked={(filters.statuses ?? []).includes(s)}
            onChange={() => onChange({ statuses: toggle(filters.statuses, s) })}
            label={s}
          />
        ))}
      </FilterSection>

      <FilterSection title="Criticality Level">
        {CRIT_LEVELS.map((c) => (
          <CheckItem
            key={c.value}
            checked={(filters.criticalityLevels ?? []).includes(c.value)}
            onChange={() => onChange({ criticalityLevels: toggle(filters.criticalityLevels, c.value) })}
            label={c.label}
          />
        ))}
      </FilterSection>

      <FilterSection title="Rating">
        {RATINGS.map((r) => (
          <CheckItem
            key={r}
            checked={(filters.ratings ?? []).includes(r)}
            onChange={() => onChange({ ratings: toggle(filters.ratings, r) })}
            label={r}
          />
        ))}
      </FilterSection>

      <FilterSection title="Expiring Within">
        {([30, 60, 90] as const).map((d) => (
          <RadioItem
            key={d}
            checked={filters.expiringWithinDays === d}
            onChange={() => onChange({ expiringWithinDays: filters.expiringWithinDays === d ? undefined : d })}
            label={`≤ ${d} days`}
          />
        ))}
      </FilterSection>
    </aside>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CheckItem({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className={cn(
      'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted/60',
      checked && 'font-medium text-primary',
    )}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded border-border accent-primary"
      />
      <span>{label}</span>
    </label>
  );
}

function RadioItem({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className={cn(
      'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted/60',
      checked && 'font-medium text-primary',
    )}>
      <input
        type="radio"
        name="expiringWithin"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 accent-primary"
      />
      <span>{label}</span>
    </label>
  );
}
