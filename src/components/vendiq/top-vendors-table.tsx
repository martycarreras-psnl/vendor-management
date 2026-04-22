import { Link } from 'react-router-dom';
import { CriticalityPill } from '@/components/vendiq/criticality-pill';
import { formatCurrency, formatDate, daysUntil } from '@/lib/vendiq-format';
import { cn } from '@/lib/utils';
import type { TopVendorRow, QuintileRating } from '@/types/vendiq';

// Map Q1 (top quintile) → A, Q5 (bottom) → E, like a report-card grade.
const RATING_GRADE: Record<QuintileRating, { letter: string; bg: string }> = {
  Q1: { letter: 'A', bg: 'bg-signal-green' },
  Q2: { letter: 'B', bg: 'bg-[color:var(--crit-2)]' },
  Q3: { letter: 'C', bg: 'bg-signal-yellow' },
  Q4: { letter: 'D', bg: 'bg-signal-amber' },
  Q5: { letter: 'E', bg: 'bg-signal-red' },
};

// Deterministic color pick for the avatar circle based on first letter.
const AVATAR_PALETTE = [
  'bg-[color:var(--primary)]',
  'bg-[color:var(--accent-teal,theme(colors.teal.600))]',
  'bg-[color:var(--crit-3)]',
  'bg-[color:var(--crit-4)]',
  'bg-[color:var(--crit-5)]',
  'bg-[color:var(--signal-green)]',
];
function avatarColor(name: string): string {
  if (!name) return AVATAR_PALETTE[0];
  const code = name.charCodeAt(0) || 0;
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length];
}

function DaysPill({ dateIso }: { dateIso?: string }) {
  const d = daysUntil(dateIso);
  if (d === undefined) return <span className="text-muted-foreground">—</span>;
  const label = `${d}d`;
  const tone =
    d < 0 ? 'bg-signal-red text-white' :
    d <= 30 ? 'bg-signal-red text-white' :
    d <= 60 ? 'bg-signal-amber text-white' :
    d <= 90 ? 'bg-signal-yellow text-slate-900' :
    'bg-muted text-foreground';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', tone)}>
      {label}
    </span>
  );
}

function DependencyBar({ score }: { score?: number }) {
  if (score === undefined) return <span className="text-muted-foreground">—</span>;
  const clamped = Math.max(0, Math.min(5, score));
  const pct = (clamped / 5) * 100;
  const tone =
    clamped >= 4 ? 'bg-signal-red' :
    clamped >= 3 ? 'bg-signal-amber' :
    clamped >= 2 ? 'bg-signal-yellow' :
    'bg-signal-green';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">{clamped.toFixed(0)}/5</span>
    </div>
  );
}

function RatingBadge({ rating }: { rating?: QuintileRating }) {
  if (!rating) return <span className="text-muted-foreground">—</span>;
  const meta = RATING_GRADE[rating];
  return (
    <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white', meta.bg)}>
      {meta.letter}
    </span>
  );
}

export function TopVendorsTable({ rows, title = 'Top Vendors by Annual Spend' }: { rows: TopVendorRow[]; title?: string }) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-baseline justify-between border-b p-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">Sorted descending · click any row for Vendor 360</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium">Classification</th>
              <th className="px-4 py-2 font-medium">Criticality</th>
              <th className="px-4 py-2 font-medium">Dependency</th>
              <th className="px-4 py-2 font-medium">Rating</th>
              <th className="px-4 py-2 text-right font-medium">Annual Spend</th>
              <th className="px-4 py-2 font-medium">Next Expiration</th>
              <th className="px-4 py-2 font-medium">Notice Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No vendors found. Check filters on the Vendors page; aliases may differ.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const initial = (r.vendorName || '?').charAt(0).toUpperCase();
              return (
                <tr key={r.vendorId} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <Link to={`/vendors/${r.vendorId}`} className="flex items-center gap-2 font-medium hover:underline">
                      <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white', avatarColor(r.vendorName))}>
                        {initial}
                      </span>
                      <span>{r.vendorName}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{r.classification ?? '—'}</td>
                  <td className="px-4 py-2"><CriticalityPill level={r.criticality} /></td>
                  <td className="px-4 py-2"><DependencyBar score={r.dependencyScore} /></td>
                  <td className="px-4 py-2"><RatingBadge rating={r.quintileRating} /></td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{formatCurrency(r.annualSpend)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-muted-foreground">{formatDate(r.nextExpirationDate)}</span>
                      <DaysPill dateIso={r.nextExpirationDate} />
                    </div>
                  </td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{formatDate(r.nextNoticeDate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
