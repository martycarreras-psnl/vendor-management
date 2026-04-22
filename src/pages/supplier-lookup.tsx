import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useVendiq } from '@/services/vendiq/provider-context';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { DataGrid, type ColumnDef } from '@/components/vendiq/data-grid';
import { cn } from '@/lib/utils';
import type { Supplier, VendorSupplier, Contract } from '@/types/vendiq';

interface SupplierDataset {
  suppliers: Supplier[];
  linksBySupplier: Map<string, VendorSupplier[]>;
  contractsBySupplier: Map<string, Contract[]>;
}

function useSupplierDataset() {
  const provider = useVendiq();
  return useQuery<SupplierDataset>({
    queryKey: ['vendiq', 'supplier-lookup'],
    queryFn: async () => {
      const [suppliers, links, allContracts] = await Promise.all([
        provider.suppliers.list(),
        provider.vendorSuppliers.list(),
        provider.contracts.list(),
      ]);
      const linksBySupplier = new Map<string, VendorSupplier[]>();
      for (const l of links) {
        if (!l.supplierId) continue;
        const arr = linksBySupplier.get(l.supplierId) ?? [];
        arr.push(l);
        linksBySupplier.set(l.supplierId, arr);
      }
      const contractsBySupplier = new Map<string, Contract[]>();
      for (const c of allContracts) {
        if (!c.supplierId) continue;
        const arr = contractsBySupplier.get(c.supplierId) ?? [];
        arr.push(c);
        contractsBySupplier.set(c.supplierId, arr);
      }
      return { suppliers, linksBySupplier, contractsBySupplier };
    },
  });
}

interface Filters {
  query: string;
  resellersOnly: boolean;
  nonResellersOnly: boolean;
  tinTypes: Set<string>;
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b px-1 py-3 last:border-0">
      <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function CheckItem({ checked, onChange, label, count }: { checked: boolean; onChange: (v: boolean) => void; label: string; count?: number }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
    </label>
  );
}

const TIN_TYPES = ['EIN', 'SSN', 'ITIN', 'Foreign', 'Unknown'];

interface SupplierRow {
  id: string;
  supplierName: string;
  supplierCategory?: string;
  taxId?: string;
  tinType?: string;
  isReseller?: boolean;
  vendorCount: number;
  contractCount: number;
}

export default function SupplierLookupPage() {
  const dataset = useSupplierDataset();
  const [filters, setFilters] = useState<Filters>({
    query: '',
    resellersOnly: false,
    nonResellersOnly: false,
    tinTypes: new Set(),
  });

  const rows = useMemo<SupplierRow[]>(() => {
    const suppliers = dataset.data?.suppliers ?? [];
    const q = filters.query.trim().toLowerCase();
    return suppliers
      .filter((s) => !q || s.supplierName?.toLowerCase().includes(q) || s.taxId?.toLowerCase().includes(q))
      .filter((s) => !filters.resellersOnly || s.isReseller === true)
      .filter((s) => !filters.nonResellersOnly || s.isReseller !== true)
      .filter((s) => filters.tinTypes.size === 0 || (s.tinType && filters.tinTypes.has(s.tinType)))
      .map((s) => ({
        id: s.id,
        supplierName: s.supplierName,
        supplierCategory: s.supplierCategory,
        taxId: s.taxId,
        tinType: s.tinType,
        isReseller: s.isReseller,
        vendorCount: (dataset.data!.linksBySupplier.get(s.id) ?? []).length,
        contractCount: (dataset.data!.contractsBySupplier.get(s.id) ?? []).length,
      }));
  }, [dataset.data, filters]);

  const resellerCount = useMemo(
    () => (dataset.data?.suppliers ?? []).filter((s) => s.isReseller === true).length,
    [dataset.data],
  );

  function toggleTin(t: string) {
    setFilters((f) => {
      const next = new Set(f.tinTypes);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return { ...f, tinTypes: next };
    });
  }

  function clearAll() {
    setFilters({ query: '', resellersOnly: false, nonResellersOnly: false, tinTypes: new Set() });
  }

  if (dataset.isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading suppliers…</div>;
  }
  if (dataset.isError || !dataset.data) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Failed to load suppliers.</div>;
  }

  const totalSuppliers = dataset.data.suppliers.length;
  const filtersActive =
    filters.query.length > 0 || filters.resellersOnly || filters.nonResellersOnly || filters.tinTypes.size > 0;

  const columns: ColumnDef<SupplierRow>[] = [
    {
      key: 'supplier', header: 'Supplier', accessor: (r) => r.supplierName,
      render: (r) => (
        <Link to={`/suppliers/${r.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
          {r.supplierName || '(unnamed)'}
        </Link>
      ),
    },
    { key: 'category', header: 'Category', accessor: (r) => r.supplierCategory ?? '' },
    { key: 'taxId', header: 'Tax ID', accessor: (r) => r.taxId ?? '', render: (r) => <span className="font-mono text-xs">{r.taxId ?? '—'}</span> },
    { key: 'tinType', header: 'TIN Type', accessor: (r) => r.tinType ?? '' },
    {
      key: 'reseller', header: 'Reseller',
      accessor: (r) => r.isReseller === true ? 'Yes' : r.isReseller === false ? 'No' : '',
      render: (r) =>
        r.isReseller === true ? (
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', 'bg-primary/10 text-primary')}>Reseller</span>
        ) : r.isReseller === false ? (
          <span className="text-muted-foreground">No</span>
        ) : null,
    },
    { key: 'vendors', header: '# Vendors', accessor: (r) => r.vendorCount, align: 'right' },
    { key: 'contracts', header: '# Contracts', accessor: (r) => r.contractCount, align: 'right' },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Supplier Lookup</h1>
        <p className="text-sm text-muted-foreground">
          Search and filter across {totalSuppliers} suppliers ({resellerCount} resellers)
        </p>
      </header>

      <div className="flex gap-6">
        <aside className="w-60 shrink-0 rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-3 py-3">
            <div className="text-sm font-semibold">Filters</div>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={!filtersActive} className="h-7 px-2 text-xs">
              Clear
            </Button>
          </div>
          <SidebarSection title="Search">
            <div className="px-2">
              <Input
                placeholder="Name or Tax ID…"
                value={filters.query}
                onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          </SidebarSection>
          <SidebarSection title="Reseller">
            <CheckItem
              checked={filters.resellersOnly}
              onChange={(v) => setFilters((f) => ({ ...f, resellersOnly: v, nonResellersOnly: v ? false : f.nonResellersOnly }))}
              label="Resellers only"
              count={resellerCount}
            />
            <CheckItem
              checked={filters.nonResellersOnly}
              onChange={(v) => setFilters((f) => ({ ...f, nonResellersOnly: v, resellersOnly: v ? false : f.resellersOnly }))}
              label="Non-resellers only"
              count={totalSuppliers - resellerCount}
            />
          </SidebarSection>
          <SidebarSection title="TIN Type">
            {TIN_TYPES.map((t) => (
              <CheckItem
                key={t}
                checked={filters.tinTypes.has(t)}
                onChange={() => toggleTin(t)}
                label={t}
              />
            ))}
          </SidebarSection>
        </aside>

        <div className="min-w-0 flex-1 rounded-lg border bg-card shadow-sm">
          <DataGrid
            columns={columns}
            data={rows}
            keyFn={(r) => r.id}
            pageSize={50}
            defaultSort={{ key: 'supplier', dir: 'asc' }}
            emptyMessage="No suppliers match the current filters."
          />
        </div>
      </div>
    </div>
  );
}
