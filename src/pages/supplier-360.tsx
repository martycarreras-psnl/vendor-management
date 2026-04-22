// Supplier 360 page — mirrors the Vendor 360 pattern but pivots on the Supplier entity.
// Tabs: Overview (editable), Vendors, Contracts, GL Transactions.

import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVendiq } from '@/services/vendiq/provider-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataGrid, type ColumnDef } from '@/components/vendiq/data-grid';
import { formatCurrency, formatDate } from '@/lib/vendiq-format';
import { cn } from '@/lib/utils';
import type {
  Supplier,
  VendorSupplier,
  Contract,
  ContractParty,
  GLTransaction,
  TINType,
} from '@/types/vendiq';

// ---- Data bundle ----

const TIN_TYPES: TINType[] = ['EIN', 'SSN', 'ITIN', 'Foreign', 'Unknown'];

interface SupplierBundle {
  supplier: Supplier | null;
  vendorSuppliers: VendorSupplier[];
  contracts: Contract[];
  contractParties: ContractParty[];
  glTransactions: GLTransaction[];
}

function useSupplier360(supplierId: string) {
  const provider = useVendiq();
  return useQuery<SupplierBundle>({
    queryKey: ['vendiq', 'supplier360', supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const [supplier, vendorSuppliers, contracts, contractParties, glTransactions, vendors] = await Promise.all([
        provider.suppliers.getById(supplierId),
        provider.vendorSuppliers.listBySupplier(supplierId),
        provider.contracts.listBySupplier(supplierId),
        provider.contractParties.listBySupplier(supplierId),
        provider.glTransactions.listBySupplier(supplierId),
        provider.vendors.list({ top: 5000 }),
      ]);

      // Enrich vendor names so we never display raw GUIDs
      const vendorNameById = new Map(vendors.map((v) => [v.id, v.vendorName]));
      for (const vs of vendorSuppliers) {
        if (!vs.vendorName) {
          vs.vendorName = vendorNameById.get(vs.vendorId);
        }
      }

      return { supplier, vendorSuppliers, contracts, contractParties, glTransactions };
    },
  });
}

// ---- Tab definitions ----

interface TabDef {
  key: string;
  label: string;
  icon: string;
  count?: (b: SupplierBundle) => number;
}

const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview', icon: '◉' },
  { key: 'vendors', label: 'Vendors', icon: '🏢', count: (b) => b.vendorSuppliers.length },
  { key: 'contracts', label: 'Contracts', icon: '📄', count: (b) => b.contracts.length },
  { key: 'gl', label: 'GL Transactions', icon: '💰', count: (b) => b.glTransactions.length },
];

// ---- Page ----

export default function Supplier360Page() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const [activeTab, setActiveTab] = useState('overview');

  const query = useSupplier360(supplierId ?? '');

  if (!supplierId) {
    return <div className="text-sm text-muted-foreground">Missing supplier id.</div>;
  }
  if (query.isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading supplier…</div>;
  }
  if (query.isError || !query.data?.supplier) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Supplier not found or failed to load.{' '}
        <Link to="/suppliers" className="underline">Back to Supplier Lookup</Link>
      </div>
    );
  }

  const bundle = query.data;
  const supplier = bundle.supplier!;

  const totalGLSpend = bundle.glTransactions.reduce((acc, gl) => acc + (gl.netAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="text-xs text-muted-foreground">
        <Link to="/suppliers" className="hover:underline">Supplier Lookup</Link>
        <span className="mx-1">/</span>
        <span>{supplier.supplierName}</span>
      </nav>

      {/* Header card */}
      <header className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm',
              avatarColor(supplier.supplierName),
            )}>
              {(supplier.supplierName || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{supplier.supplierName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {supplier.supplierCategory && (
                  <span className="rounded-full border px-2 py-0.5">{supplier.supplierCategory}</span>
                )}
                {supplier.tinType && (
                  <span className="rounded-full border px-2 py-0.5">{supplier.tinType}</span>
                )}
                {supplier.isReseller && (
                  <span className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-primary">
                    Reseller
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4">
          <StatRow label="Vendor links" value={String(bundle.vendorSuppliers.length)} />
          <StatRow label="Contracts" value={String(bundle.contracts.length)} />
          <StatRow label="GL Transactions" value={String(bundle.glTransactions.length)} />
          <StatRow label="GL Net Total" value={formatCurrency(totalGLSpend)} />
        </div>
      </header>

      {/* Underline tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-0 overflow-x-auto" aria-label="Supplier sections">
          {TABS.map((tab) => {
            const count = tab.count?.(bundle);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'group relative flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
                )}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span>{tab.label}</span>
                {count !== undefined && count > 0 && (
                  <span className={cn(
                    'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                    isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="min-h-[300px]">
        {activeTab === 'overview' && <OverviewTab bundle={bundle} supplierId={supplierId} />}
        {activeTab === 'vendors' && <VendorsTab bundle={bundle} />}
        {activeTab === 'contracts' && <ContractsTab bundle={bundle} />}
        {activeTab === 'gl' && <GLTab bundle={bundle} />}
      </div>
    </div>
  );
}

// ---- Helpers ----

const AVATAR_PALETTE = [
  'bg-[color:var(--primary)]',
  'bg-teal-600',
  'bg-[color:var(--crit-3)]',
  'bg-[color:var(--crit-4)]',
  'bg-[color:var(--crit-5)]',
  'bg-[color:var(--signal-green)]',
];

function avatarColor(name: string): string {
  if (!name) return AVATAR_PALETTE[0];
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length];
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SectionCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-5 shadow-sm', className)}>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed bg-muted/20 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ---- OVERVIEW TAB (editable) ----

function OverviewTab({ bundle, supplierId }: { bundle: SupplierBundle; supplierId: string }) {
  const provider = useVendiq();
  const queryClient = useQueryClient();
  const supplier = bundle.supplier!;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Supplier>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (updates: Partial<Supplier>) => provider.suppliers.update(supplierId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendiq'] });
      setEditing(false);
      setDraft({});
      setSaveError(null);
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const startEditing = useCallback(() => {
    setDraft({ ...supplier });
    setEditing(true);
    setSaveError(null);
  }, [supplier]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setDraft({});
    setSaveError(null);
  }, []);

  const handleSave = useCallback(() => {
    const changes: Partial<Supplier> = {};
    for (const key of Object.keys(draft) as (keyof Supplier)[]) {
      if (key === 'id') continue;
      if (draft[key] !== supplier[key]) {
        (changes as Record<string, unknown>)[key] = draft[key];
      }
    }
    if (Object.keys(changes).length === 0) { setEditing(false); return; }
    mutation.mutate(changes);
  }, [draft, supplier, mutation]);

  const update = useCallback((field: keyof Supplier, value: unknown) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const source = editing ? draft : supplier;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Supplier Details</h2>
        <div className="flex items-center gap-2">
          {!editing && <Button size="sm" onClick={startEditing}>Edit</Button>}
          {editing && (
            <>
              <Button size="sm" variant="outline" onClick={cancelEditing} disabled={mutation.isPending}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      {saveError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Save failed: {saveError}
        </div>
      )}

      <SectionCard title="Identity & Tax">
        <div className="grid gap-3 md:grid-cols-2">
          <SField label="Supplier Name" value={source.supplierName} field="supplierName" editing={editing} onUpdate={update} />
          <SField label="Category" value={source.supplierCategory} field="supplierCategory" editing={editing} onUpdate={update} />
          <SField label="Tax ID" value={source.taxId} field="taxId" editing={editing} onUpdate={update} />
          <SSelect label="TIN Type" value={source.tinType} field="tinType" options={TIN_TYPES} editing={editing} onUpdate={update} />
          <SBool label="Is Reseller" value={source.isReseller} field="isReseller" editing={editing} onUpdate={update} />
        </div>
      </SectionCard>
    </div>
  );
}

// ---- Editable field components ----

function SField({ label, value, field, editing, onUpdate }: {
  label: string; value?: string; field: keyof Supplier; editing: boolean;
  onUpdate: (f: keyof Supplier, v: unknown) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing ? (
        <Input className="mt-1" value={(value as string) ?? ''} onChange={(e) => onUpdate(field, e.target.value || undefined)} />
      ) : (
        <div className="mt-1 text-sm font-medium">{(value as string) || '—'}</div>
      )}
    </div>
  );
}

function SSelect<T extends string>({ label, value, field, options, editing, onUpdate }: {
  label: string; value?: T; field: keyof Supplier; options: T[]; editing: boolean;
  onUpdate: (f: keyof Supplier, v: unknown) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing ? (
        <select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" value={value ?? ''} onChange={(e) => onUpdate(field, (e.target.value || undefined) as T | undefined)}>
          <option value="">—</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <div className="mt-1 text-sm font-medium">{value ?? '—'}</div>
      )}
    </div>
  );
}

function SBool({ label, value, field, editing, onUpdate }: {
  label: string; value?: boolean; field: keyof Supplier; editing: boolean;
  onUpdate: (f: keyof Supplier, v: unknown) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing ? (
        <select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" value={value === undefined ? '' : value ? 'true' : 'false'} onChange={(e) => onUpdate(field, e.target.value === '' ? undefined : e.target.value === 'true')}>
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : (
        <div className="mt-1 text-sm font-medium">{value === undefined ? '—' : value ? 'Yes' : 'No'}</div>
      )}
    </div>
  );
}

// ---- VENDORS TAB ----

function VendorsTab({ bundle }: { bundle: SupplierBundle }) {
  if (bundle.vendorSuppliers.length === 0) return <EmptyState message="No vendor linkage on file." />;
  const cols: ColumnDef<VendorSupplier>[] = [
    {
      key: 'vendor', header: 'Vendor', accessor: (vs) => vs.vendorName ?? '',
      render: (vs) => <Link to={`/vendors/${vs.vendorId}`} className="font-medium text-primary hover:underline">{vs.vendorName || '(unknown vendor)'}</Link>,
    },
    { key: 'relationship', header: 'Relationship', accessor: (vs) => vs.relationshipType, render: (vs) => <span className="rounded-full border px-2 py-0.5 text-xs">{vs.relationshipType}</span> },
    { key: 'products', header: 'Products / Services', accessor: (vs) => vs.productsServicesCovered ?? '' },
    { key: 'from', header: 'Effective From', accessor: (vs) => vs.effectiveFrom ?? '', render: (vs) => <span className="tabular-nums">{formatDate(vs.effectiveFrom)}</span> },
    { key: 'to', header: 'Effective To', accessor: (vs) => vs.effectiveTo ?? '', render: (vs) => <span className="tabular-nums">{formatDate(vs.effectiveTo)}</span> },
  ];
  return (
    <SectionCard title={`Vendors · ${bundle.vendorSuppliers.length}`}>
      <div className="-mx-5 px-0">
        <DataGrid columns={cols} data={bundle.vendorSuppliers} keyFn={(vs) => vs.id} />
      </div>
    </SectionCard>
  );
}

// ---- CONTRACTS TAB ----

function ContractsTab({ bundle }: { bundle: SupplierBundle }) {
  if (bundle.contracts.length === 0) return <EmptyState message="No contracts linked to this supplier." />;
  const cols: ColumnDef<Contract>[] = [
    { key: 'contract', header: 'Contract', accessor: (c) => c.contractName, render: (c) => <Link to={`/contracts/${c.id}`} className="font-medium text-primary hover:underline">{c.contractName}</Link> },
    { key: 'type', header: 'Type', accessor: (c) => c.contractType ?? '' },
    { key: 'status', header: 'Status', accessor: (c) => c.contractStatus ?? '' },
    { key: 'effective', header: 'Effective', accessor: (c) => c.effectiveDate ?? '', render: (c) => <span className="tabular-nums">{formatDate(c.effectiveDate)}</span> },
    { key: 'expiration', header: 'Expiration', accessor: (c) => c.expirationDate ?? '', render: (c) => <span className="tabular-nums">{formatDate(c.expirationDate)}</span> },
    { key: 'autoRenew', header: 'Auto-Renew', accessor: (c) => c.autoRenew ?? '' },
  ];
  return (
    <SectionCard title={`Contracts · ${bundle.contracts.length}`}>
      <div className="-mx-5 px-0">
        <DataGrid columns={cols} data={bundle.contracts} keyFn={(c) => c.id} defaultSort={{ key: 'expiration', dir: 'asc' }} />
      </div>
    </SectionCard>
  );
}

// ---- GL TRANSACTIONS TAB ----

function GLTab({ bundle }: { bundle: SupplierBundle }) {
  if (bundle.glTransactions.length === 0) return <EmptyState message="No GL transactions on file." />;

  const totalNet = bundle.glTransactions.reduce((acc, gl) => acc + (gl.netAmount ?? 0), 0);

  const cols: ColumnDef<GLTransaction>[] = [
    { key: 'fiscalYear', header: 'Fiscal Year', accessor: (gl) => gl.fiscalYear ?? '' },
    { key: 'accountingDate', header: 'Accounting Date', accessor: (gl) => gl.accountingDate ?? '', render: (gl) => <span className="tabular-nums">{formatDate(gl.accountingDate)}</span> },
    { key: 'ledgerAccount', header: 'Ledger Account', accessor: (gl) => gl.ledgerAccount ?? '' },
    { key: 'status', header: 'Status', accessor: (gl) => gl.status ?? '' },
    { key: 'debit', header: 'Debit', accessor: (gl) => gl.debitAmount ?? 0, render: (gl) => <span>{formatCurrency(gl.debitAmount)}</span>, align: 'right' },
    { key: 'credit', header: 'Credit', accessor: (gl) => gl.creditAmount ?? 0, render: (gl) => <span>{formatCurrency(gl.creditAmount)}</span>, align: 'right' },
    { key: 'net', header: 'Net', accessor: (gl) => gl.netAmount ?? 0, render: (gl) => <span className="font-medium">{formatCurrency(gl.netAmount)}</span>, align: 'right' },
  ];

  return (
    <SectionCard title={`GL Transactions · ${bundle.glTransactions.length}`}>
      <div className="mb-3 text-sm text-muted-foreground">
        Total net amount: <span className="font-semibold text-foreground">{formatCurrency(totalNet)}</span>
      </div>
      <div className="-mx-5 px-0">
        <DataGrid columns={cols} data={bundle.glTransactions} keyFn={(gl) => gl.id} pageSize={50} defaultSort={{ key: 'accountingDate', dir: 'desc' }} />
      </div>
    </SectionCard>
  );
}
