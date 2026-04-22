// Vendor 360 page with polished tab experience and editable overview.
// All vendor custom fields are displayed and inline-editable on the Overview tab.

import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVendiq } from '@/services/vendiq/provider-context';
import { CriticalityPill } from '@/components/vendiq/criticality-pill';
import { AdjustCriticalityDialog } from '@/components/vendiq/adjust-criticality-dialog';
import { DataGrid, type ColumnDef } from '@/components/vendiq/data-grid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate } from '@/lib/vendiq-format';
import { useCurrentUserRoles } from '@/hooks/vendiq/use-current-user-roles';
import { cn } from '@/lib/utils';
import type {
  Vendor,
  Contract,
  ContractParty,
  VendorSupplier,
  VendorScore,
  VendorBudget,
  VendorRateCard,
  VendorProductService,
  VendorNameAlias,
  OneTrustAssessment,
  ServiceNowAssessment,
  CriticalityLevel,
  VendorClassification,
  VendorStatus,
  CommercialRole,
  YesNoNA,
} from '@/types/vendiq';

const VENDOR_CLASSIFICATIONS: VendorClassification[] = [
  'Clinical', 'ProfessionalServices', 'ITInfrastructure', 'Security', 'Telecom', 'Staffing', 'Other',
];
const VENDOR_STATUSES: VendorStatus[] = ['Active', 'Inactive', 'Onboarding', 'Offboarded', 'UnderReview'];
const COMMERCIAL_ROLES: CommercialRole[] = ['Vendor', 'Reseller', 'VAR', 'Distributor', 'Hybrid'];
const YES_NO_NA: YesNoNA[] = ['Yes', 'No', 'N_A', 'Unknown'];

interface VendorBundle {
  vendor: Vendor | null;
  contracts: Contract[];
  parties: ContractParty[];
  vendorSuppliers: VendorSupplier[];
  scores: VendorScore[];
  budgets: VendorBudget[];
  rateCards: VendorRateCard[];
  productServices: VendorProductService[];
  nameAliases: VendorNameAlias[];
  oneTrustAssessments: OneTrustAssessment[];
  snAssessments: ServiceNowAssessment[];
  currentCriticality: CriticalityLevel | undefined;
}

function useVendor360(vendorId: string) {
  const provider = useVendiq();
  return useQuery<VendorBundle>({
    queryKey: ['vendiq', 'vendor360', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const [
        vendor,
        parties,
        vendorSuppliers,
        scores,
        budgets,
        rateCards,
        productServices,
        nameAliases,
        oneTrust,
        sn,
        currentCriticality,
        suppliers,
      ] = await Promise.all([
        provider.vendors.getById(vendorId),
        provider.contractParties.listByVendor(vendorId),
        provider.vendorSuppliers.listByVendor(vendorId),
        provider.vendorScores.listByVendor(vendorId),
        provider.vendorBudgets.listByVendor(vendorId),
        provider.vendorRateCards.listByVendor(vendorId),
        provider.vendorProductServices.listByVendor(vendorId),
        provider.vendorNameAliases.listByVendor(vendorId),
        provider.oneTrustAssessments.listByVendor(vendorId),
        provider.serviceNowAssessments.listByVendor(vendorId),
        provider.getVendorCriticality(vendorId),
        provider.suppliers.list({ top: 5000 }),
      ]);

      // Enrich supplier names so we never display blanks
      const supplierNameById = new Map(suppliers.map((s) => [s.id, s.supplierName]));
      for (const vs of vendorSuppliers) {
        if (!vs.supplierName) {
          vs.supplierName = supplierNameById.get(vs.supplierId);
        }
      }

      // Load contracts: the Vendor ↔ Contract linkage is via ContractParty; for any
      // contract-party row pointing at a contract we haven't loaded, fetch it.
      const contractIds = Array.from(new Set(parties.map((p) => p.contractId).filter(Boolean)));
      const contracts: Contract[] = [];
      for (const cid of contractIds) {
        const c = await provider.contracts.getById(cid);
        if (c) contracts.push(c);
      }

      return {
        vendor,
        contracts,
        parties,
        vendorSuppliers,
        scores,
        budgets,
        rateCards,
        productServices,
        nameAliases,
        oneTrustAssessments: oneTrust,
        snAssessments: sn,
        currentCriticality,
      };
    },
  });
}

// ---- Tab definitions ----
interface TabDef {
  key: string;
  label: string;
  icon: string;
  count?: (b: VendorBundle) => number;
}
const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview', icon: '◉' },
  { key: 'contracts', label: 'Contracts', icon: '📄', count: (b) => b.contracts.length },
  { key: 'suppliers', label: 'Suppliers', icon: '🔗', count: (b) => b.vendorSuppliers.length },
  { key: 'risk', label: 'Risk & Compliance', icon: '🛡', count: (b) => b.oneTrustAssessments.length + b.snAssessments.length },
  { key: 'products', label: 'Products & Services', icon: '📦', count: (b) => b.productServices.length },
  { key: 'rates', label: 'Rate Cards', icon: '💲', count: (b) => b.rateCards.length },
  { key: 'scores', label: 'Scores', icon: '📊', count: (b) => b.scores.length },
  { key: 'aliases', label: 'Aliases', icon: '🏷', count: (b) => b.nameAliases.length },
];

export default function Vendor360Page() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const { canAdjustCriticality } = useCurrentUserRoles();

  const query = useVendor360(vendorId ?? '');

  if (!vendorId) {
    return <div className="text-sm text-muted-foreground">Missing vendor id.</div>;
  }
  if (query.isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading vendor…</div>;
  }
  if (query.isError || !query.data?.vendor) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Vendor not found or failed to load. <Link to="/vendors" className="underline">Back to Vendor Lookup</Link>
      </div>
    );
  }

  const bundle = query.data;
  const vendor = bundle.vendor!;
  const totalSpend = bundle.budgets.reduce((acc, b) => acc + (b.supplierSpend ?? 0), 0);

  return (
    <div className="space-y-4">
      <nav className="text-xs text-muted-foreground">
        <Link to="/vendors" className="hover:underline">Vendor Lookup</Link>
        <span className="mx-1">/</span>
        <span>{vendor.vendorName}</span>
      </nav>

      <header className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm',
              avatarColor(vendor.vendorName),
            )}>
              {(vendor.vendorName || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{vendor.vendorName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {vendor.classification && <span className="rounded-full border px-2 py-0.5">{formatClassification(vendor.classification)}</span>}
                {vendor.status && <StatusBadge status={vendor.status} />}
                {vendor.activePhiAccess === 'Yes' && <span className="rounded-full border border-signal-red/30 bg-signal-red/5 px-2 py-0.5 text-signal-red">PHI Access</span>}
                {vendor.isVar && <span className="rounded-full border px-2 py-0.5">VAR</span>}
                {vendor.commercialRole && <span className="rounded-full border px-2 py-0.5">{vendor.commercialRole}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CriticalityPill
              level={bundle.currentCriticality}
              onClick={canAdjustCriticality ? () => setAdjustOpen(true) : undefined}
            />
            {canAdjustCriticality && (
              <Button size="sm" onClick={() => setAdjustOpen(true)}>Adjust criticality</Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4">
          <StatRow label="Total spend (all years)" value={formatCurrency(totalSpend)} />
          <StatRow label="Contracts" value={String(bundle.contracts.length)} />
          <StatRow label="Supplier links" value={String(bundle.vendorSuppliers.length)} />
          <StatRow label="Aliases" value={String(bundle.nameAliases.length)} />
        </div>
      </header>

      {/* Underline tabs with count badges */}
      <div className="border-b">
        <nav className="-mb-px flex gap-0 overflow-x-auto" aria-label="Vendor sections">
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

      <div className="min-h-[300px]">
        {activeTab === 'overview' && <OverviewTab bundle={bundle} vendorId={vendorId} />}
        {activeTab === 'contracts' && <ContractsTab bundle={bundle} />}
        {activeTab === 'suppliers' && <SuppliersTab bundle={bundle} />}
        {activeTab === 'risk' && <RiskTab bundle={bundle} />}
        {activeTab === 'products' && <ProductsTab bundle={bundle} />}
        {activeTab === 'rates' && <RateCardsTab bundle={bundle} />}
        {activeTab === 'scores' && <ScoresTab bundle={bundle} />}
        {activeTab === 'aliases' && <AliasesTab bundle={bundle} />}
      </div>

      <AdjustCriticalityDialog
        open={adjustOpen && canAdjustCriticality}
        onOpenChange={setAdjustOpen}
        vendorId={vendor.id}
        vendorName={vendor.vendorName}
        currentLevel={bundle.currentCriticality}
      />
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

function formatClassification(c: VendorClassification): string {
  const MAP: Record<string, string> = {
    ProfessionalServices: 'Professional Services',
    ITInfrastructure: 'IT Infrastructure',
  };
  return MAP[c] ?? c;
}

function StatusBadge({ status }: { status: VendorStatus }) {
  const tone =
    status === 'Active' ? 'border-signal-green/40 bg-signal-green/10 text-signal-green' :
    status === 'Inactive' || status === 'Offboarded' ? 'border-signal-red/40 bg-signal-red/10 text-signal-red' :
    status === 'Onboarding' ? 'border-signal-amber/40 bg-signal-amber/10 text-signal-amber' :
    status === 'UnderReview' ? 'border-signal-yellow/40 bg-signal-yellow/10 text-signal-yellow' :
    'border-muted bg-muted/10';
  return <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', tone)}>{status}</span>;
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

// ---- OVERVIEW TAB — fully editable ----
function OverviewTab({ bundle, vendorId }: { bundle: VendorBundle; vendorId: string }) {
  const provider = useVendiq();
  const queryClient = useQueryClient();
  const vendor = bundle.vendor!;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Vendor>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (updates: Partial<Vendor>) => provider.vendors.update(vendorId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendiq'] });
      setEditing(false);
      setDraft({});
      setSaveError(null);
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const startEditing = useCallback(() => {
    setDraft({ ...vendor });
    setEditing(true);
    setSaveError(null);
  }, [vendor]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setDraft({});
    setSaveError(null);
  }, []);

  const handleSave = useCallback(() => {
    const changes: Partial<Vendor> = {};
    for (const key of Object.keys(draft) as (keyof Vendor)[]) {
      if (key === 'id') continue;
      if (draft[key] !== vendor[key]) {
        (changes as Record<string, unknown>)[key] = draft[key];
      }
    }
    if (Object.keys(changes).length === 0) { setEditing(false); return; }
    mutation.mutate(changes);
  }, [draft, vendor, mutation]);

  const update = useCallback((field: keyof Vendor, value: unknown) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const source = editing ? draft : vendor;

  const latest = [...bundle.scores].sort((a, b) => (b.scoreYear || '').localeCompare(a.scoreYear || ''))[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Vendor Details</h2>
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

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Identity">
          <div className="grid gap-3 md:grid-cols-2">
            <VField label="Vendor Name" value={source.vendorName} field="vendorName" editing={editing} onUpdate={update} />
            <VField label="Primary Offering" value={source.primaryOffering} field="primaryOffering" editing={editing} onUpdate={update} />
            <VField label="Category L1" value={source.categoryL1} field="categoryL1" editing={editing} onUpdate={update} />
            <VField label="Category L2" value={source.categoryL2} field="categoryL2" editing={editing} onUpdate={update} />
            <VSelect label="Classification" value={source.classification} field="classification" options={VENDOR_CLASSIFICATIONS} displayFn={formatClassification} editing={editing} onUpdate={update} />
            <VSelect label="Commercial Role" value={source.commercialRole} field="commercialRole" options={COMMERCIAL_ROLES} editing={editing} onUpdate={update} />
          </div>
        </SectionCard>

        <SectionCard title="Status & Compliance">
          <div className="grid gap-3 md:grid-cols-2">
            <VSelect label="Status" value={source.status} field="status" options={VENDOR_STATUSES} editing={editing} onUpdate={update} />
            <VSelect label="Active PHI Access" value={source.activePhiAccess} field="activePhiAccess" options={YES_NO_NA} editing={editing} onUpdate={update} />
            <VBool label="Is VAR" value={source.isVar} field="isVar" editing={editing} onUpdate={update} />
            <VReadOnly label="Owner" value={vendor.ownerName} />
            <VReadOnly label="Created" value={formatDate(vendor.createdOn)} />
            <VReadOnly label="Modified" value={formatDate(vendor.modifiedOn)} />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title={`Latest Vendor Score${latest ? ` · FY ${latest.scoreYear}` : ''}`}>
          {latest ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <ScoreLine label="Criticality" value={latest.criticalityScore} />
              <ScoreLine label="Dependency" value={latest.dependencyScore} />
              <ScoreLine label="Spend" value={latest.spendScore} />
              <ScoreLine label="Value" value={latest.valueScore} />
              <ScoreLine label="Alignment" value={latest.alignmentScore} />
              <ScoreLine label="Weighted" value={latest.weightedScore} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No vendor scores on file.</p>
          )}
        </SectionCard>

        <SectionCard title="Budget Trend">
          {bundle.budgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No budgets on file.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...bundle.budgets]
                .sort((a, b) => (b.budgetYear || '').localeCompare(a.budgetYear || ''))
                .map((b) => (
                  <li key={b.id} className="flex items-baseline justify-between border-b py-1.5 last:border-0">
                    <span className="font-medium">FY {b.budgetYear}</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(b.supplierSpend)}</span>
                    <span className="text-xs text-muted-foreground">{b.quintileRating ?? '—'}</span>
                  </li>
                ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function ScoreLine({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="flex items-baseline justify-between border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value !== undefined ? value.toFixed(2) : '—'}</span>
    </div>
  );
}

// ---- Editable field components ----
function VField({ label, value, field, editing, onUpdate, className }: {
  label: string; value?: string; field: keyof Vendor; editing: boolean;
  onUpdate: (f: keyof Vendor, v: unknown) => void; className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing ? (
        <Input className="mt-1" value={(value as string) ?? ''} onChange={(e) => onUpdate(field, e.target.value || undefined)} />
      ) : (
        <div className="mt-1 text-sm font-medium">{(value as string) || '—'}</div>
      )}
    </div>
  );
}

function VSelect<T extends string>({ label, value, field, options, editing, onUpdate, displayFn }: {
  label: string; value?: T; field: keyof Vendor; options: T[]; editing: boolean;
  onUpdate: (f: keyof Vendor, v: unknown) => void; displayFn?: (v: T) => string;
}) {
  const display = displayFn ?? ((v: T) => v);
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing ? (
        <select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" value={value ?? ''} onChange={(e) => onUpdate(field, (e.target.value || undefined) as T | undefined)}>
          <option value="">—</option>
          {options.map((o) => <option key={o} value={o}>{display(o)}</option>)}
        </select>
      ) : (
        <div className="mt-1 text-sm font-medium">{value ? display(value) : '—'}</div>
      )}
    </div>
  );
}

function VBool({ label, value, field, editing, onUpdate }: {
  label: string; value?: boolean; field: keyof Vendor; editing: boolean;
  onUpdate: (f: keyof Vendor, v: unknown) => void;
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

function VReadOnly({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1 text-sm">{value || '—'}</div>
    </div>
  );
}

function ContractsTab({ bundle }: { bundle: VendorBundle }) {
  if (bundle.contracts.length === 0) return <EmptyState message="No contracts linked to this vendor via ContractParty." />;
  const cols: ColumnDef<Contract>[] = [
    { key: 'contract', header: 'Contract', accessor: (c) => c.contractName, render: (c) => <Link to={`/contracts/${c.id}`} className="font-medium text-primary hover:underline">{c.contractName}</Link> },
    { key: 'type', header: 'Type', accessor: (c) => c.contractType ?? '' },
    { key: 'status', header: 'Status', accessor: (c) => c.contractStatus ?? '' },
    { key: 'effective', header: 'Effective', accessor: (c) => c.effectiveDate ?? '', render: (c) => <span className="tabular-nums">{formatDate(c.effectiveDate)}</span> },
    { key: 'expiration', header: 'Expiration', accessor: (c) => c.expirationDate ?? '', render: (c) => <span className="tabular-nums">{formatDate(c.expirationDate)}</span> },
    { key: 'notice', header: 'Notice', accessor: (c) => c.noticeDate ?? '', render: (c) => <span className="tabular-nums">{formatDate(c.noticeDate)}</span> },
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

function SuppliersTab({ bundle }: { bundle: VendorBundle }) {
  if (bundle.vendorSuppliers.length === 0) return <EmptyState message="No supplier linkage on file." />;
  const cols: ColumnDef<VendorSupplier>[] = [
    { key: 'supplier', header: 'Supplier', accessor: (vs) => vs.supplierName ?? '' },
    { key: 'relationship', header: 'Relationship', accessor: (vs) => vs.relationshipType, render: (vs) => <span className="rounded-full border px-2 py-0.5 text-xs">{vs.relationshipType}</span> },
    { key: 'products', header: 'Products / Services', accessor: (vs) => vs.productsServicesCovered ?? '' },
    { key: 'from', header: 'Effective From', accessor: (vs) => vs.effectiveFrom ?? '', render: (vs) => <span className="tabular-nums">{formatDate(vs.effectiveFrom)}</span> },
    { key: 'to', header: 'Effective To', accessor: (vs) => vs.effectiveTo ?? '', render: (vs) => <span className="tabular-nums">{formatDate(vs.effectiveTo)}</span> },
  ];
  return (
    <SectionCard title={`Suppliers · ${bundle.vendorSuppliers.length}`}>
      <div className="-mx-5 px-0">
        <DataGrid columns={cols} data={bundle.vendorSuppliers} keyFn={(vs) => vs.id} />
      </div>
    </SectionCard>
  );
}

function RiskTab({ bundle }: { bundle: VendorBundle }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard title={`OneTrust Assessments · ${bundle.oneTrustAssessments.length}`}>
        {bundle.oneTrustAssessments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No OneTrust assessments on file.</p>
        ) : (
          <ul className="space-y-3">
            {bundle.oneTrustAssessments.map((a) => (
              <li key={a.id} className="rounded-lg border p-4 transition-shadow hover:shadow-sm">
                <div className="font-medium">{a.assessmentName}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">Criticality: <CriticalityPill level={a.criticality} /></span>
                  <span>ePHI: {a.ephi ?? '—'}</span>
                  <span>System access: {a.systemAccess ?? '—'}</span>
                  <span>Classification: {a.classification ?? '—'}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard title={`ServiceNow Assessments · ${bundle.snAssessments.length}`}>
        {bundle.snAssessments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ServiceNow assessments on file.</p>
        ) : (
          <ul className="space-y-3">
            {bundle.snAssessments.map((a) => (
              <li key={a.id} className="rounded-lg border p-4 transition-shadow hover:shadow-sm">
                <div className="flex items-baseline justify-between">
                  <div className="font-medium">{a.assessmentName}</div>
                  <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{a.assessmentType}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">Criticality: <CriticalityPill level={a.criticalityLevel} /></span>
                  <span>Budgeted: {a.isBudgeted ?? '—'}</span>
                  <span>Updated: {formatDate(a.modifiedOn)}</span>
                  <span>SN #: {a.snNumber ?? '—'}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function ProductsTab({ bundle }: { bundle: VendorBundle }) {
  if (bundle.productServices.length === 0) return <EmptyState message="No products or services on file." />;
  return (
    <SectionCard title={`Products & Services · ${bundle.productServices.length}`}>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {bundle.productServices.map((p) => (
          <div key={p.id} className="rounded-lg border p-4 transition-shadow hover:shadow-sm">
            <div className="font-medium">{p.productServiceName}</div>
            {p.category && <div className="mt-1 text-xs text-muted-foreground">{p.category}</div>}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function RateCardsTab({ bundle }: { bundle: VendorBundle }) {
  if (bundle.rateCards.length === 0) return <EmptyState message="No rate cards on file." />;
  const cols: ColumnDef<VendorRateCard>[] = [
    { key: 'year', header: 'Year', accessor: (rc) => rc.rateCardYear ?? '' },
    { key: 'position', header: 'Position', accessor: (rc) => rc.normalizedPosition ?? rc.originalPosition ?? '' },
    { key: 'level', header: 'Level', accessor: (rc) => rc.experienceLevel ?? '' },
    { key: 'location', header: 'Location', accessor: (rc) => rc.locationType ?? '' },
    { key: 'min', header: 'Min', accessor: (rc) => rc.minRate ?? 0, render: (rc) => <span>{formatCurrency(rc.minRate)}</span>, align: 'right' },
    { key: 'avg', header: 'Avg', accessor: (rc) => rc.avgRate ?? 0, render: (rc) => <span>{formatCurrency(rc.avgRate)}</span>, align: 'right' },
    { key: 'max', header: 'Max', accessor: (rc) => rc.maxRate ?? 0, render: (rc) => <span>{formatCurrency(rc.maxRate)}</span>, align: 'right' },
  ];
  return (
    <SectionCard title={`Rate Cards · ${bundle.rateCards.length}`}>
      <div className="-mx-5 px-0">
        <DataGrid columns={cols} data={bundle.rateCards} keyFn={(rc) => rc.id} pageSize={50} />
      </div>
    </SectionCard>
  );
}

function ScoresTab({ bundle }: { bundle: VendorBundle }) {
  if (bundle.scores.length === 0) return <EmptyState message="No scores on file." />;
  const cols: ColumnDef<VendorScore>[] = [
    { key: 'year', header: 'Year', accessor: (s) => s.scoreYear, render: (s) => <span className="font-medium">FY {s.scoreYear}</span> },
    { key: 'criticality', header: 'Criticality', accessor: (s) => s.criticalityScore ?? 0, render: (s) => <span>{s.criticalityScore?.toFixed(2) ?? '—'}</span>, align: 'right' },
    { key: 'dependency', header: 'Dependency', accessor: (s) => s.dependencyScore ?? 0, render: (s) => <span>{s.dependencyScore?.toFixed(2) ?? '—'}</span>, align: 'right' },
    { key: 'spend', header: 'Spend', accessor: (s) => s.spendScore ?? 0, render: (s) => <span>{s.spendScore?.toFixed(2) ?? '—'}</span>, align: 'right' },
    { key: 'value', header: 'Value', accessor: (s) => s.valueScore ?? 0, render: (s) => <span>{s.valueScore?.toFixed(2) ?? '—'}</span>, align: 'right' },
    { key: 'alignment', header: 'Alignment', accessor: (s) => s.alignmentScore ?? 0, render: (s) => <span>{s.alignmentScore?.toFixed(2) ?? '—'}</span>, align: 'right' },
    { key: 'weighted', header: 'Weighted', accessor: (s) => s.weightedScore ?? 0, render: (s) => <span>{s.weightedScore?.toFixed(2) ?? '—'}</span>, align: 'right' },
  ];
  return (
    <SectionCard title={`Vendor Scores · ${bundle.scores.length}`}>
      <div className="-mx-5 px-0">
        <DataGrid columns={cols} data={bundle.scores} keyFn={(s) => s.id} defaultSort={{ key: 'year', dir: 'desc' }} />
      </div>
    </SectionCard>
  );
}

function AliasesTab({ bundle }: { bundle: VendorBundle }) {
  if (bundle.nameAliases.length === 0) return <EmptyState message="No aliases on file." />;
  return (
    <SectionCard title={`Vendor Aliases · ${bundle.nameAliases.length}`}>
      <div className="grid gap-3 md:grid-cols-2">
        {bundle.nameAliases.map((a) => (
          <div key={a.id} className="rounded-lg border p-4 transition-shadow hover:shadow-sm">
            <div className="font-medium">{a.aliasName}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Source: {a.sourceSystem ?? '—'} · Reviewed by {a.reviewedBy ?? '—'} · {formatDate(a.reviewedOn)}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
