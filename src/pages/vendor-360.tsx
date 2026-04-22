// Vendor 360 page with tabs. Reads are per-vendor fan-out via the provider.
// Writes in v1 are limited to Adjust Criticality (Criticality pill click).
// Other edit surfaces surface "Coming in next iteration" placeholders so the
// shape of the information architecture is visible without unfinished forms.

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useVendiq } from '@/services/vendiq/provider-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CriticalityPill } from '@/components/vendiq/criticality-pill';
import { AdjustCriticalityDialog } from '@/components/vendiq/adjust-criticality-dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/vendiq-format';
import { useCurrentUserRoles } from '@/hooks/vendiq/use-current-user-roles';
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
} from '@/types/vendiq';

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
      ]);

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

export default function Vendor360Page() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [adjustOpen, setAdjustOpen] = useState(false);
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

      <header className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{vendor.vendorName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {vendor.classification && <span className="rounded-full border px-2 py-0.5">{vendor.classification}</span>}
              {vendor.status && <span className="rounded-full border px-2 py-0.5">{vendor.status}</span>}
              {vendor.activePhiAccess && <span className="rounded-full border px-2 py-0.5">PHI: {vendor.activePhiAccess}</span>}
              {vendor.isVar && <span className="rounded-full border px-2 py-0.5">VAR</span>}
              {vendor.primaryOffering && <span className="truncate">{vendor.primaryOffering}</span>}
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
            {!canAdjustCriticality && (
              <span
                className="text-xs text-muted-foreground"
                title="Adjust Criticality is gated. Set VITE_ENABLE_CRITICALITY_EDIT=true to enable (or wait for role-based gating)."
              >
                Read-only
              </span>
            )}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatRow label="Total spend (all years)" value={formatCurrency(totalSpend)} />
          <StatRow label="Contracts" value={String(bundle.contracts.length)} />
          <StatRow label="Supplier links" value={String(bundle.vendorSuppliers.length)} />
          <StatRow label="Aliases" value={String(bundle.nameAliases.length)} />
        </dl>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="products">Products / Services</TabsTrigger>
          <TabsTrigger value="rates">Rate Cards</TabsTrigger>
          <TabsTrigger value="scores">Scores</TabsTrigger>
          <TabsTrigger value="aliases">Aliases</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab bundle={bundle} />
        </TabsContent>
        <TabsContent value="contracts">
          <ContractsTab bundle={bundle} />
        </TabsContent>
        <TabsContent value="suppliers">
          <SuppliersTab bundle={bundle} />
        </TabsContent>
        <TabsContent value="risk">
          <RiskTab bundle={bundle} />
        </TabsContent>
        <TabsContent value="products">
          <ProductsTab bundle={bundle} />
        </TabsContent>
        <TabsContent value="rates">
          <RateCardsTab bundle={bundle} />
        </TabsContent>
        <TabsContent value="scores">
          <ScoresTab bundle={bundle} />
        </TabsContent>
        <TabsContent value="aliases">
          <AliasesTab bundle={bundle} />
        </TabsContent>
      </Tabs>

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

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function OverviewTab({ bundle }: { bundle: VendorBundle }) {
  const latest = [...bundle.scores].sort((a, b) => (b.scoreYear || '').localeCompare(a.scoreYear || ''))[0];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Latest vendor score{latest ? ` · FY ${latest.scoreYear}` : ''}</h3>
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
      </div>
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Budget trend</h3>
        {bundle.budgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No budgets on file.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {[...bundle.budgets]
              .sort((a, b) => (b.budgetYear || '').localeCompare(a.budgetYear || ''))
              .map((b) => (
                <li key={b.id} className="flex items-baseline justify-between border-b py-1 last:border-0">
                  <span>FY {b.budgetYear}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(b.supplierSpend)}</span>
                  <span className="text-xs text-muted-foreground">{b.quintileRating ?? '—'}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ScoreLine({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="flex items-baseline justify-between border-b py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value !== undefined ? value.toFixed(2) : '—'}</span>
    </div>
  );
}

function ContractsTab({ bundle }: { bundle: VendorBundle }) {
  if (bundle.contracts.length === 0) {
    return <p className="text-sm text-muted-foreground">No contracts linked to this vendor via ContractParty.</p>;
  }
  const sorted = [...bundle.contracts].sort((a, b) => (a.expirationDate || '').localeCompare(b.expirationDate || ''));
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2 font-medium">Contract</th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Effective</th>
            <th className="px-4 py-2 font-medium">Expiration</th>
            <th className="px-4 py-2 font-medium">Notice</th>
            <th className="px-4 py-2 font-medium">Auto-Renew</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40 cursor-pointer">
              <td className="px-4 py-2 font-medium">
                <Link to={`/contracts/${c.id}`} className="text-primary hover:underline">{c.contractName}</Link>
              </td>
              <td className="px-4 py-2 text-muted-foreground">{c.contractType ?? '—'}</td>
              <td className="px-4 py-2">{c.contractStatus ?? '—'}</td>
              <td className="px-4 py-2">{formatDate(c.effectiveDate)}</td>
              <td className="px-4 py-2">{formatDate(c.expirationDate)}</td>
              <td className="px-4 py-2">{formatDate(c.noticeDate)}</td>
              <td className="px-4 py-2">{c.autoRenew ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SuppliersTab({ bundle }: { bundle: VendorBundle }) {
  if (bundle.vendorSuppliers.length === 0) return <p className="text-sm text-muted-foreground">No supplier linkage on file.</p>;
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2 font-medium">Supplier</th>
            <th className="px-4 py-2 font-medium">Relationship</th>
            <th className="px-4 py-2 font-medium">Products / Services</th>
            <th className="px-4 py-2 font-medium">Effective From</th>
            <th className="px-4 py-2 font-medium">Effective To</th>
          </tr>
        </thead>
        <tbody>
          {bundle.vendorSuppliers.map((vs) => (
            <tr key={vs.id} className="border-b last:border-0">
              <td className="px-4 py-2 font-medium">{vs.supplierName ?? vs.supplierId}</td>
              <td className="px-4 py-2">{vs.relationshipType}</td>
              <td className="px-4 py-2 text-muted-foreground">{vs.productsServicesCovered ?? '—'}</td>
              <td className="px-4 py-2">{formatDate(vs.effectiveFrom)}</td>
              <td className="px-4 py-2">{formatDate(vs.effectiveTo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskTab({ bundle }: { bundle: VendorBundle }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">OneTrust assessments</h3>
        {bundle.oneTrustAssessments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No OneTrust assessments on file.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {bundle.oneTrustAssessments.map((a) => (
              <li key={a.id} className="rounded-md border p-3">
                <div className="font-medium">{a.assessmentName}</div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Criticality: <CriticalityPill level={a.criticality} /></span>
                  <span>ePHI: {a.ephi ?? '—'}</span>
                  <span>System access: {a.systemAccess ?? '—'}</span>
                  <span>Classification: {a.classification ?? '—'}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">ServiceNow assessments</h3>
        {bundle.snAssessments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No ServiceNow assessments on file.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {bundle.snAssessments.map((a) => (
              <li key={a.id} className="rounded-md border p-3">
                <div className="flex items-baseline justify-between">
                  <div className="font-medium">{a.assessmentName}</div>
                  <div className="text-xs text-muted-foreground">{a.assessmentType}</div>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Criticality: <CriticalityPill level={a.criticalityLevel} /></span>
                  <span>Budgeted: {a.isBudgeted ?? '—'}</span>
                  <span>Updated: {formatDate(a.modifiedOn)}</span>
                  <span>SN #: {a.snNumber ?? '—'}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProductsTab({ bundle }: { bundle: VendorBundle }) {
  if (bundle.productServices.length === 0) return <p className="text-sm text-muted-foreground">No products or services on file.</p>;
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {bundle.productServices.map((p) => (
        <li key={p.id} className="rounded-md border bg-card p-3">
          <div className="font-medium">{p.productServiceName}</div>
          {p.category && <div className="text-xs text-muted-foreground">{p.category}</div>}
        </li>
      ))}
    </ul>
  );
}

function RateCardsTab({ bundle }: { bundle: VendorBundle }) {
  if (bundle.rateCards.length === 0) return <p className="text-sm text-muted-foreground">No rate cards on file.</p>;
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2 font-medium">Year</th>
            <th className="px-4 py-2 font-medium">Position</th>
            <th className="px-4 py-2 font-medium">Level</th>
            <th className="px-4 py-2 font-medium">Location</th>
            <th className="px-4 py-2 text-right font-medium">Min</th>
            <th className="px-4 py-2 text-right font-medium">Avg</th>
            <th className="px-4 py-2 text-right font-medium">Max</th>
          </tr>
        </thead>
        <tbody>
          {bundle.rateCards.map((rc) => (
            <tr key={rc.id} className="border-b last:border-0">
              <td className="px-4 py-2">{rc.rateCardYear ?? '—'}</td>
              <td className="px-4 py-2">{rc.normalizedPosition ?? rc.originalPosition ?? '—'}</td>
              <td className="px-4 py-2">{rc.experienceLevel ?? '—'}</td>
              <td className="px-4 py-2">{rc.locationType ?? '—'}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(rc.minRate)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(rc.avgRate)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(rc.maxRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoresTab({ bundle }: { bundle: VendorBundle }) {
  if (bundle.scores.length === 0) return <p className="text-sm text-muted-foreground">No scores on file.</p>;
  const sorted = [...bundle.scores].sort((a, b) => (b.scoreYear || '').localeCompare(a.scoreYear || ''));
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2 font-medium">Year</th>
            <th className="px-4 py-2 text-right font-medium">Criticality</th>
            <th className="px-4 py-2 text-right font-medium">Dependency</th>
            <th className="px-4 py-2 text-right font-medium">Spend</th>
            <th className="px-4 py-2 text-right font-medium">Value</th>
            <th className="px-4 py-2 text-right font-medium">Alignment</th>
            <th className="px-4 py-2 text-right font-medium">Weighted</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.id} className="border-b last:border-0">
              <td className="px-4 py-2 font-medium">FY {s.scoreYear}</td>
              <td className="px-4 py-2 text-right tabular-nums">{s.criticalityScore?.toFixed(2) ?? '—'}</td>
              <td className="px-4 py-2 text-right tabular-nums">{s.dependencyScore?.toFixed(2) ?? '—'}</td>
              <td className="px-4 py-2 text-right tabular-nums">{s.spendScore?.toFixed(2) ?? '—'}</td>
              <td className="px-4 py-2 text-right tabular-nums">{s.valueScore?.toFixed(2) ?? '—'}</td>
              <td className="px-4 py-2 text-right tabular-nums">{s.alignmentScore?.toFixed(2) ?? '—'}</td>
              <td className="px-4 py-2 text-right tabular-nums">{s.weightedScore?.toFixed(2) ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AliasesTab({ bundle }: { bundle: VendorBundle }) {
  if (bundle.nameAliases.length === 0) return <p className="text-sm text-muted-foreground">No aliases on file.</p>;
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {bundle.nameAliases.map((a) => (
        <li key={a.id} className="rounded-md border bg-card p-3">
          <div className="font-medium">{a.aliasName}</div>
          <div className="text-xs text-muted-foreground">
            Source: {a.sourceSystem ?? '—'} · Reviewed by {a.reviewedBy ?? '—'} · {formatDate(a.reviewedOn)}
          </div>
        </li>
      ))}
    </ul>
  );
}
