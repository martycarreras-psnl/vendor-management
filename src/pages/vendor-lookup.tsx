import { Link } from 'react-router-dom';
import { usePortfolioDataset, computeTopVendors } from '@/hooks/vendiq/use-portfolio-dataset';
import { usePortfolioFilters } from '@/hooks/vendiq/use-portfolio-filters';
import { FilterSidebar } from '@/components/vendiq/filter-sidebar';
import { DataGrid, type ColumnDef } from '@/components/vendiq/data-grid';
import { CriticalityPill } from '@/components/vendiq/criticality-pill';
import { formatCurrency, daysUntil } from '@/lib/vendiq-format';
import { cn } from '@/lib/utils';
import type { TopVendorRow, VendorSupplier } from '@/types/vendiq';

function ExpiringBadge({ dateIso }: { dateIso?: string }) {
  const d = daysUntil(dateIso);
  if (d === undefined || d < 0) return <span className="text-muted-foreground">—</span>;
  const label = d <= 30 ? '<30d' : d <= 60 ? '<60d' : d <= 90 ? '<90d' : `${d}d`;
  const tone =
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

interface VendorRow extends TopVendorRow {
  primaryOffering?: string;
  phi?: string;
  supplierLabel: string;
}

export default function VendorLookupPage() {
  const dataset = usePortfolioDataset();
  const { filters, setFilters, clear } = usePortfolioFilters();

  if (dataset.isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading vendors…</div>;
  }
  if (dataset.isError || !dataset.data) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Failed to load vendors.</div>;
  }

  const rawRows = computeTopVendors(filters, dataset.data, 500);
  const rows: VendorRow[] = rawRows.map((r) => {
    const vendor = dataset.data!.vendors.find((v) => v.id === r.vendorId);
    const supplierLinks: VendorSupplier[] = dataset.data!.suppliersByVendor.get(r.vendorId) ?? [];
    return {
      ...r,
      primaryOffering: vendor?.primaryOffering,
      phi: vendor?.activePhiAccess ?? undefined,
      supplierLabel: supplierLinks.length > 0
        ? supplierLinks.map((s) => s.supplierName ?? s.supplierId).join(', ')
        : '',
    };
  });

  const columns: ColumnDef<VendorRow>[] = [
    {
      key: 'vendor',
      header: 'Vendor',
      accessor: (r) => r.vendorName,
      render: (r) => (
        <div>
          <Link to={`/vendors/${r.vendorId}`} className="font-medium text-primary underline-offset-2 hover:underline">{r.vendorName}</Link>
          {r.primaryOffering && <div className="text-xs text-muted-foreground">{r.primaryOffering}</div>}
        </div>
      ),
    },
    { key: 'supplier', header: 'Supplier', accessor: (r) => r.supplierLabel },
    { key: 'classification', header: 'Classification', accessor: (r) => r.classification ?? '' },
    { key: 'phi', header: 'PHI', accessor: (r) => r.phi ?? '' },
    {
      key: 'criticality',
      header: 'Criticality',
      accessor: (r) => r.criticality ?? 0,
      render: (r) => <CriticalityPill level={r.criticality} />,
    },
    {
      key: 'expiring',
      header: 'Expiring',
      accessor: (r) => r.nextExpirationDate ?? '',
      render: (r) => <ExpiringBadge dateIso={r.nextExpirationDate} />,
    },
    {
      key: 'annualSpend',
      header: 'Annual Spend',
      accessor: (r) => r.annualSpend ?? 0,
      render: (r) => <span className="font-medium">{formatCurrency(r.annualSpend)}</span>,
      align: 'right',
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Vendor Lookup</h1>
        <p className="text-sm text-muted-foreground">Search and filter across {dataset.data.vendors.length} vendors</p>
      </header>

      <div className="flex gap-6">
        <FilterSidebar filters={filters} onChange={setFilters} onClear={clear} />
        <div className="min-w-0 flex-1 rounded-lg border bg-card shadow-sm">
          <DataGrid
            columns={columns}
            data={rows}
            keyFn={(r) => r.vendorId}
            emptyMessage="No matches. If a vendor appears under a different name in source systems, check Vendor Name Alias."
            pageSize={50}
            defaultSort={{ key: 'annualSpend', dir: 'desc' }}
          />
        </div>
      </div>
    </div>
  );
}
