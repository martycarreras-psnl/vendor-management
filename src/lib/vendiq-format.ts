// Shared date helpers for VendIQ pages.

/** Number of whole days between today and `iso` (positive = future). Undefined if invalid. */
export function daysUntil(iso: string | undefined | null, now: Date = new Date()): number | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((startOfDay(d) - startOfDay(now)) / MS_PER_DAY);
}

/** Classify days-from-now into an expiration bucket (0-30/31-60/61-90) or undefined. */
export function expirationBucket(
  days: number | undefined,
): '0-30' | '31-60' | '61-90' | undefined {
  if (days === undefined) return undefined;
  if (days < 0) return undefined;
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return undefined;
}

/** Compute the US fiscal year label for a given date, assuming calendar-year fiscal years. */
export function fiscalYearOf(date: Date = new Date()): string {
  return String(date.getFullYear());
}

export function formatCurrency(n: number | undefined, currency = 'USD'): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2,
  }).format(n);
}

export function formatCompactNumber(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
