// Admin assignment page (Phase 3b).
//
// Gated by VITE_ENABLE_VP_ADMIN via useIsVPAdmin. Lets an admin:
//   1. Pick a reviewer (systemuser)
//   2. Multi-select vendors from the vendor list (with search + filters)
//   3. Optionally set a review due date + notes
//   4. Bulk-assign via AssignmentRepository.assignVendors (dedup by
//      reviewer+vendor+cycleYear is handled in the repo)
//
// Also shows the reviewer's current active assignments for the cycle with a
// "Remove" action (soft deactivate).

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useVendiq } from '@/services/vendiq/provider-context';
import { useVPReviewContext, useIsVPAdmin } from '@/hooks/vendiq/use-vp-review-context';
import { usePortfolioDataset } from '@/hooks/vendiq/use-portfolio-dataset';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { CriticalityPill } from '@/components/vendiq/criticality-pill';
import { formatDate, formatCurrency } from '@/lib/vendiq-format';
import { cn } from '@/lib/utils';
import type { Vendor } from '@/types/vendiq';

export default function AdminAssignmentsPage() {
  const isAdmin = useIsVPAdmin();
  const provider = useVendiq();
  const qc = useQueryClient();
  const { cycleYear, reviewers, isLoadingReviewers } = useVPReviewContext();
  const dataset = usePortfolioDataset();

  const [reviewerId, setReviewerId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const currentAssignmentsQ = useQuery({
    queryKey: ['vendiq', 'assignments', 'forReviewer', reviewerId, cycleYear],
    enabled: Boolean(reviewerId),
    queryFn: () => provider.assignments.listForReviewer(reviewerId, cycleYear),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!reviewerId) throw new Error('Select a reviewer first.');
      const vendorIds = Array.from(selected);
      if (vendorIds.length === 0) throw new Error('Select at least one vendor.');
      return provider.assignments.assignVendors({
        reviewerId,
        vendorIds,
        cycleYear,
        reviewDueDate: dueDate || undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: (created) => {
      const skipped = selected.size - created.length;
      toast.success(
        `Assigned ${created.length} vendor${created.length === 1 ? '' : 's'}` +
          (skipped > 0 ? ` (${skipped} already assigned, skipped)` : ''),
      );
      setSelected(new Set());
      setNotes('');
      qc.invalidateQueries({ queryKey: ['vendiq', 'assignments'] });
      qc.invalidateQueries({ queryKey: ['vendiq', 'reviews'] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to assign vendors.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => provider.assignments.deactivate(id),
    onSuccess: () => {
      toast.success('Assignment removed.');
      qc.invalidateQueries({ queryKey: ['vendiq', 'assignments'] });
      qc.invalidateQueries({ queryKey: ['vendiq', 'reviews'] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to remove assignment.'),
  });

  const assignedVendorIds = useMemo(
    () => new Set((currentAssignmentsQ.data ?? []).map((a) => a.vendorId)),
    [currentAssignmentsQ.data],
  );

  const vendorNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of dataset.data?.vendors ?? []) m.set(v.id, v.vendorName);
    return m;
  }, [dataset.data?.vendors]);

  const vendorsFiltered: Vendor[] = useMemo(() => {
    const all = dataset.data?.vendors ?? [];
    const q = search.trim().toLowerCase();
    const base = q ? all.filter((v) => v.vendorName.toLowerCase().includes(q)) : all;
    return [...base].sort((a, b) => a.vendorName.localeCompare(b.vendorName));
  }, [dataset.data?.vendors, search]);

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <h1 className="text-lg font-semibold">Admins only</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_ENABLE_VP_ADMIN=true</code> to enable this page.
        </p>
      </div>
    );
  }

  function toggleAll() {
    if (selected.size === vendorsFiltered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(vendorsFiltered.map((v) => v.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">VP Vendor Assignments</h1>
          <p className="text-sm text-muted-foreground">Cycle {cycleYear}</p>
        </div>
        <Link to="/reviews" className="text-sm text-primary underline-offset-2 hover:underline">
          View review queue →
        </Link>
      </header>

      {/* Reviewer picker + assign controls */}
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Reviewer (VP)</span>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={reviewerId}
              onChange={(e) => {
                setReviewerId(e.target.value);
                setSelected(new Set());
              }}
              disabled={isLoadingReviewers}
            >
              <option value="">Select a reviewer…</option>
              {(reviewers ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                  {r.jobTitle ? ` — ${r.jobTitle}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Review due date (optional)</span>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium">Notes (optional)</span>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context for the reviewer…"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selected.size} selected · {vendorsFiltered.length} visible · {dataset.data?.vendors.length ?? 0} total
          </div>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={!reviewerId || selected.size === 0 || assignMutation.isPending}
          >
            {assignMutation.isPending
              ? 'Assigning…'
              : `Assign ${selected.size || ''} vendor${selected.size === 1 ? '' : 's'}`}
          </Button>
        </div>
      </section>

      {/* Reviewer current assignments */}
      {reviewerId && (
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">
            Current assignments for this reviewer ({currentAssignmentsQ.data?.length ?? 0})
          </h2>
          {currentAssignmentsQ.isLoading ? (
            <div className="mt-3 text-sm text-muted-foreground">Loading…</div>
          ) : (currentAssignmentsQ.data ?? []).length === 0 ? (
            <div className="mt-3 text-sm text-muted-foreground">None yet for cycle {cycleYear}.</div>
          ) : (
            <ul className="mt-3 divide-y">
              {(currentAssignmentsQ.data ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-medium">{a.vendorName ?? vendorNameById.get(a.vendorId) ?? 'Unknown vendor'}</span>
                    {a.reviewDueDate && (
                      <span className="ml-2 text-xs text-muted-foreground">due {formatDate(a.reviewDueDate)}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deactivateMutation.mutate(a.id)}
                    disabled={deactivateMutation.isPending}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Vendor selector */}
      <section className="rounded-lg border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b p-3">
          <Input
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {selected.size === vendorsFiltered.length && vendorsFiltered.length > 0
              ? 'Clear all'
              : 'Select all visible'}
          </Button>
        </div>
        {dataset.isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading vendors…</div>
        ) : (
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Classification</th>
                  <th className="px-3 py-2 text-left">Criticality</th>
                  <th className="px-3 py-2 text-right">Annual Spend</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {vendorsFiltered.map((v) => {
                  const isSelected = selected.has(v.id);
                  const already = assignedVendorIds.has(v.id);
                  const crit = dataset.data?.criticalityByVendor.get(v.id);
                  const budget = dataset.data?.budgetsByVendor.get(v.id);
                  return (
                    <tr
                      key={v.id}
                      className={cn(
                        'border-t hover:bg-muted/30',
                        isSelected && 'bg-primary/5',
                        already && 'opacity-70',
                      )}
                    >
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(v.id)}
                          aria-label={`Select ${v.vendorName}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{v.vendorName}</span>
                          {already && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                              assigned
                            </span>
                          )}
                        </div>
                        {v.primaryOffering && (
                          <div className="text-xs text-muted-foreground">{v.primaryOffering}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">{v.classification ?? '—'}</td>
                      <td className="px-3 py-2">
                        {crit ? <CriticalityPill level={crit} /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {budget?.supplierSpend !== undefined ? formatCurrency(budget.supplierSpend) : '—'}
                      </td>
                      <td className="px-3 py-2">{v.status ?? '—'}</td>
                    </tr>
                  );
                })}
                {vendorsFiltered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No vendors match “{search}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
