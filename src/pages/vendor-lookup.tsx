import { Link } from 'react-router-dom';
import { usePortfolioDataset, computeTopVendors } from '@/hooks/vendiq/use-portfolio-dataset';
import { usePortfolioFilters } from '@/hooks/vendiq/use-portfolio-filters';
import { FilterBar } from '@/components/vendiq/filter-bar';
import { CriticalityPill } from '@/components/vendiq/criticality-pill';
import { formatCurrency } from '@/lib/vendiq-format';

export default function VendorLookupPage() {
  const dataset = usePortfolioDataset();
  const { filters, setFilters, clear } = usePortfolioFilters();

  if (dataset.isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading vendors…</div>;
  }
  if (dataset.isError || !dataset.data) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Failed to load vendors.</div>;
  }

  // Use computeTopVendors with a larger limit for a full searchable list.
  const rows = computeTopVendors(filters, dataset.data, 500);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Vendor Lookup</h1>
        <p className="text-sm text-muted-foreground">Search and filter across {dataset.data.vendors.length} vendors</p>
      </header>

      <FilterBar filters={filters} onChange={setFilters} onClear={clear} />

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 font-medium">Vendor</th>
                <th className="px-4 py-2 font-medium">Classification</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">PHI</th>
                <th className="px-4 py-2 font-medium">Criticality</th>
                <th className="px-4 py-2 font-medium">Rating</th>
                <th className="px-4 py-2 text-right font-medium">Annual Spend</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No matches. If a vendor appears under a different name in source systems, check <em>Vendor Name Alias</em>.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const vendor = dataset.data!.vendors.find((v) => v.id === r.vendorId);
                return (
                  <tr key={r.vendorId} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2 font-medium">
                      <Link to={`/vendors/${r.vendorId}`} className="text-primary underline-offset-2 hover:underline">{r.vendorName}</Link>
                      {vendor?.primaryOffering && (
                        <div className="text-xs text-muted-foreground">{vendor.primaryOffering}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{r.classification ?? '—'}</td>
                    <td className="px-4 py-2">{r.status ?? '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{vendor?.activePhiAccess ?? '—'}</td>
                    <td className="px-4 py-2"><CriticalityPill level={r.criticality} /></td>
                    <td className="px-4 py-2">{r.quintileRating ?? '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.annualSpend)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
