// URL-synced portfolio filters (?q=, ?cls=, ?status=, ?crit=, ?bucket=, ?rating=)

import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
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

function parseCsvEnum<T extends string>(raw: string | null, valid: T[]): T[] | undefined {
  if (!raw) return undefined;
  const parts = raw.split(',').map((x) => x.trim()).filter(Boolean) as T[];
  const filtered = parts.filter((p) => valid.includes(p));
  return filtered.length > 0 ? filtered : undefined;
}

function parseCsvCritLevels(raw: string | null): CriticalityLevel[] | undefined {
  if (!raw) return undefined;
  const nums = raw.split(',').map((x) => Number(x.trim())).filter((n) => [1, 2, 3, 4, 5].includes(n));
  return nums.length > 0 ? (nums as CriticalityLevel[]) : undefined;
}

export function usePortfolioFilters(): {
  filters: PortfolioFilters;
  setFilters: (patch: Partial<PortfolioFilters>) => void;
  clear: () => void;
} {
  const [params, setParams] = useSearchParams();

  const filters: PortfolioFilters = useMemo(() => {
    const bucket = params.get('bucket');
    const expiringWithinDays =
      bucket === '0-30' ? 30 : bucket === '31-60' ? 60 : bucket === '61-90' ? 90 : undefined;
    return {
      searchText: params.get('q') ?? undefined,
      classifications: parseCsvEnum(params.get('cls'), CLASSIFICATIONS),
      statuses: parseCsvEnum(params.get('status'), STATUSES),
      criticalityLevels: parseCsvCritLevels(params.get('crit')),
      ratings: parseCsvEnum(params.get('rating'), RATINGS),
      expiringWithinDays,
    };
  }, [params]);

  const setFilters = useCallback(
    (patch: Partial<PortfolioFilters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const setOrDel = (key: string, value: string | undefined) => {
            if (value && value.length > 0) next.set(key, value);
            else next.delete(key);
          };
          if ('searchText' in patch) setOrDel('q', patch.searchText);
          if ('classifications' in patch) setOrDel('cls', (patch.classifications ?? []).join(','));
          if ('statuses' in patch) setOrDel('status', (patch.statuses ?? []).join(','));
          if ('criticalityLevels' in patch) setOrDel('crit', (patch.criticalityLevels ?? []).join(','));
          if ('ratings' in patch) setOrDel('rating', (patch.ratings ?? []).join(','));
          if ('expiringWithinDays' in patch) {
            const v = patch.expiringWithinDays;
            setOrDel('bucket', v === 30 ? '0-30' : v === 60 ? '31-60' : v === 90 ? '61-90' : undefined);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  return { filters, setFilters, clear };
}
