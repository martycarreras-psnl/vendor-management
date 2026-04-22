import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useVendiq } from '@/services/vendiq/provider-context';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
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

export default function SupplierLookupPage() {
  const dataset = useSupplierDataset();
  const [filters, setFilters] = useState<Filters>({
    query: '',
    resellersOnly: false,
    nonResellersOnly: false,
    tinTypes: new Set(),
  });

  const rows = useMemo(() => {
    const suppliers = dataset.data?.suppliers ?? [];
    const q = filters.query.trim().toLowerCase();
    return suppliers
      .filter((s) => !q || s.supplierName?.toLowerCase().includes(q) || s.taxId?.toLowerCase().includes(q))
      .filter((s) => !filters.resellersOnly || s.isReseller === true)
      .filter((s) => !filters.nonResellersOnly || s.isReseller !== true)
      .filter((s) => filters.tinTypes.size === 0 || (s.tinType && filters.tinTypes.has(s.tinType)))
      .sort((a, b) => (a.supplierName ?? '').localeCompare(b.supplierName ?? ''));
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Supplier</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Tax ID</th>
                  <th className="px-4 py-2 font-medium">TIN Type</th>
                  <th className="px-4 py-2 font-medium">Reseller</th>
                  <th className="px-4 py-2 text-right font-medium"># Vendors</th>
                  <th className="px-4 py-2 text-right font-medium"># Contracts</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No suppliers match the current filters.
                    </td>
                  </tr>
                )}
                {rows.map((s) => {
                  const links = dataset.data!.linksBySupplier.get(s.id) ?? [];
                  const contracts = dataset.data!.contractsBySupplier.get(s.id) ?? [];
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2 font-medium">
                        <Link to={`/suppliers/${s.id}`} className="text-primary underline-offset-2 hover:underline">
                          {s.supplierName || '(unnamed)'}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{s.supplierCategory ?? '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{s.taxId ?? '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground">{s.tinType ?? '—'}</td>
                      <td className="px-4 py-2">
                        {s.isReseller === true ? (
                          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', 'bg-primary/10 text-primary')}>
                            Reseller
                          </span>
                        ) : s.isReseller === false ? (
                          <span className="text-muted-foreground">No</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{links.length}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{contracts.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
