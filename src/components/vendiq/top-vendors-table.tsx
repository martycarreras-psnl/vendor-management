import { Link } from 'react-router-dom';
import { CriticalityPill } from '@/components/vendiq/criticality-pill';
import { formatCurrency, formatDate } from '@/lib/vendiq-format';
import type { TopVendorRow } from '@/types/vendiq';

export function TopVendorsTable({ rows, title = 'Top Vendors by Spend' }: { rows: TopVendorRow[]; title?: string }) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-baseline justify-between border-b p-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">Click a row to open Vendor 360</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium">Classification</th>
              <th className="px-4 py-2 font-medium">Status</th>
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
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No vendors match current filters. Try clearing filters; if a vendor is known by a different name, check <em>Vendor Name Alias</em>.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.vendorId} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2 font-medium">
                  <Link to={`/vendors/${r.vendorId}`} className="text-primary underline-offset-2 hover:underline">
                    {r.vendorName}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{r.classification ?? '—'}</td>
                <td className="px-4 py-2">{r.status ?? '—'}</td>
                <td className="px-4 py-2"><CriticalityPill level={r.criticality} /></td>
                <td className="px-4 py-2 tabular-nums">{r.dependencyScore?.toFixed(1) ?? '—'}</td>
                <td className="px-4 py-2">{r.quintileRating ?? '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.annualSpend)}</td>
                <td className="px-4 py-2">{formatDate(r.nextExpirationDate)}</td>
                <td className="px-4 py-2">{formatDate(r.nextNoticeDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
