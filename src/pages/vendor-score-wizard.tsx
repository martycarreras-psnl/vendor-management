// Phase 3c — VendorScore wizard.
//
// Reviews and scores a single vendor for the active cycle year.
// Flow: loads/creates the cycle's VendorScore, lets the reviewer enter
// Criticality → Dependency → Spend → Value → Alignment (incremental
// disclosure), shows a live weighted score with the locked-formula tooltip,
// surfaces a criticality suggestion from OneTrust/ServiceNow/prior-year, and
// offers Save Draft / Submit for Approval / Reject actions.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useVendiq } from '@/services/vendiq/provider-context';
import { useVPReviewContext } from '@/hooks/vendiq/use-vp-review-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { WeightedScoreInfo } from '@/components/vendiq/weighted-score-info';
import { ScoreStatusBadge } from '@/components/vendiq/score-status-badge';
import { CriticalityPill } from '@/components/vendiq/criticality-pill';
import { computeScoresFor } from '@/services/vendiq/weighted-score';
import { suggestScores } from '@/services/vendiq/scoring-suggestions';
import { cn } from '@/lib/utils';
import type {
  CriticalityLevel,
  ScoreDimensionSuggestion,
  ScoreStatus,
  VendorScore,
} from '@/types/vendiq';

type DimKey = 'criticality' | 'dependency' | 'spend' | 'value' | 'alignment';

const DIMENSIONS: Array<{ key: DimKey; label: string; help: string }> = [
  { key: 'criticality', label: 'Criticality', help: 'Business impact if the vendor is lost.' },
  { key: 'dependency', label: 'Dependency', help: 'How reliant the enterprise is on this vendor.' },
  { key: 'spend', label: 'Spend', help: 'Annual spend relative to peers.' },
  { key: 'value', label: 'Value', help: 'Quality and ROI delivered.' },
  { key: 'alignment', label: 'Alignment', help: 'Strategic fit with the enterprise roadmap.' },
];

export default function VendorScoreWizardPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const provider = useVendiq();
  const qc = useQueryClient();
  const { effectiveReviewerId, cycleYear } = useVPReviewContext();

  // Load the queue to resolve the assignment → vendor.
  const queueQ = useQuery({
    queryKey: ['vendiq', 'reviews', 'queue', effectiveReviewerId, cycleYear],
    enabled: Boolean(effectiveReviewerId),
    queryFn: () => provider.assignments.listVendorsForReviewer(effectiveReviewerId!, cycleYear),
  });

  const item = queueQ.data?.find((q) => q.assignment.id === assignmentId);
  const vendor = item?.vendor;
  const vendorId = vendor?.id;

  // Fetch signals for the suggestion panel (criticality / dependency / spend).
  const signalsQ = useQuery({
    queryKey: ['vendiq', 'wizard', 'signals', vendorId, cycleYear],
    enabled: Boolean(vendorId),
    queryFn: async () => {
      const [oneTrust, serviceNow, contractParties, vendorSuppliers, scores] = await Promise.all([
        provider.oneTrustAssessments.listByVendor(vendorId!),
        provider.serviceNowAssessments.listByVendor(vendorId!),
        provider.contractParties.listByVendor(vendorId!),
        provider.vendorSuppliers.listByVendor(vendorId!),
        provider.vendorScores.listByVendor(vendorId!),
      ]);
      const contractRecs = await Promise.all(
        contractParties
          .map((p) => p.contractId)
          .filter((id): id is string => Boolean(id))
          .map((id) => provider.contracts.getById(id)),
      );
      const priorScore =
        scores
          .filter((s) => Number(s.scoreYear) < cycleYear)
          .sort((a, b) => Number(b.scoreYear) - Number(a.scoreYear))[0] ?? null;
      return {
        oneTrust,
        serviceNow,
        contracts: contractRecs.filter((c): c is NonNullable<typeof c> => Boolean(c)),
        vendorSuppliers,
        priorScore,
      };
    },
  });

  const suggestions = useMemo(() => {
    if (!vendor || !signalsQ.data) return null;
    return suggestScores({
      vendor,
      oneTrust: signalsQ.data.oneTrust,
      serviceNow: signalsQ.data.serviceNow,
      contracts: signalsQ.data.contracts,
      vendorSuppliers: signalsQ.data.vendorSuppliers,
      priorScore: signalsQ.data.priorScore,
    });
  }, [vendor, signalsQ.data]);

  const initial = item?.currentScore;
  const [dims, setDims] = useState<Record<DimKey, number | undefined>>({
    criticality: undefined,
    dependency: undefined,
    spend: undefined,
    value: undefined,
    alignment: undefined,
  });
  const [comment, setComment] = useState('');
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!item || seeded) return;
    setDims({
      criticality: initial?.criticalityScore,
      dependency: initial?.dependencyScore,
      spend: initial?.spendScore,
      value: initial?.valueScore,
      alignment: initial?.alignmentScore,
    });
    setComment(initial?.comment ?? '');
    setSeeded(true);
  }, [item, initial, seeded]);

  const { weighted, critDepOnly } = computeScoresFor({
    criticalityScore: dims.criticality,
    dependencyScore: dims.dependency,
    spendScore: dims.spend,
    valueScore: dims.value,
    alignmentScore: dims.alignment,
  });

  const status: ScoreStatus = initial?.reviewStatus ?? 'NotStarted';
  const [unlockEdit, setUnlockEdit] = useState(false);
  const isLocked = status === 'Approved' && !unlockEdit;

  const upsertMutation = useMutation({
    mutationFn: async (target: ScoreStatus): Promise<VendorScore> => {
      if (!vendorId) throw new Error('No vendor');
      const patch = {
        criticalityScore: dims.criticality,
        dependencyScore: dims.dependency,
        spendScore: dims.spend,
        valueScore: dims.value,
        alignmentScore: dims.alignment,
        comment: comment || undefined,
        reviewStatus: target,
      };
      if (initial?.id) {
        const updated = await provider.vendorScores.update(initial.id, patch);
        if (target !== updated.reviewStatus) {
          return provider.vendorScores.setStatus(updated.id, target);
        }
        return updated;
      }
      return provider.vendorScores.create({
        vendorId,
        scoreYear: cycleYear,
        ...patch,
      });
    },
    onSuccess: (_rec, target) => {
      toast.success(
        target === 'Approved'
          ? 'Submitted for approval.'
          : target === 'Rejected'
            ? 'Marked as rejected.'
            : 'Draft saved.',
      );
      qc.invalidateQueries({ queryKey: ['vendiq', 'reviews'] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save score.'),
  });

  if (queueQ.isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading review…</div>;
  }

  if (!item || !vendor) {
    return (
      <div className="space-y-4">
        <Link to="/reviews" className="text-sm text-primary underline-offset-2 hover:underline">
          ← Back to My Vendors to Review
        </Link>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <h1 className="text-lg font-semibold">Assignment not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This assignment may have been removed or reassigned to another reviewer.
          </p>
        </div>
      </div>
    );
  }

  const unlocked: Record<DimKey, boolean> = {
    criticality: true,
    dependency: dims.criticality !== undefined,
    spend: dims.criticality !== undefined && dims.dependency !== undefined,
    value:
      dims.criticality !== undefined &&
      dims.dependency !== undefined &&
      dims.spend !== undefined,
    alignment:
      dims.criticality !== undefined &&
      dims.dependency !== undefined &&
      dims.spend !== undefined &&
      dims.value !== undefined,
  };

  const allSet = DIMENSIONS.every((d) => dims[d.key] !== undefined);

  const suggestionFor = (dim: DimKey): ScoreDimensionSuggestion | undefined => {
    if (!suggestions) return undefined;
    if (dim === 'criticality') return suggestions.criticality;
    if (dim === 'dependency') return suggestions.dependency;
    if (dim === 'spend') return suggestions.spend;
    return undefined;
  };

  return (
    <div className="space-y-4">
      <Link to="/reviews" className="text-sm text-primary underline-offset-2 hover:underline">
        ← Back to My Vendors to Review
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{vendor.vendorName}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Cycle {cycleYear}</span>
            <span>·</span>
            <ScoreStatusBadge status={status} />
          </div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-2 shadow-sm">
          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            Weighted score <WeightedScoreInfo />
          </div>
          <div className="text-right text-2xl font-semibold tabular-nums">
            {weighted !== undefined
              ? weighted.toFixed(2)
              : critDepOnly !== undefined
                ? `${critDepOnly.toFixed(2)}*`
                : '—'}
          </div>
          {weighted === undefined && critDepOnly !== undefined && (
            <div className="text-right text-[11px] text-muted-foreground">* Crit + Dep only</div>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {DIMENSIONS.map((d, idx) => {
            const sug = suggestionFor(d.key);
            return (
              <DimensionCard
                key={d.key}
                idx={idx + 1}
                label={d.label}
                help={d.help}
                value={dims[d.key]}
                unlocked={unlocked[d.key] && !isLocked}
                onChange={(v) => setDims((prev) => ({ ...prev, [d.key]: v }))}
                suggestion={sug}
                onAcceptSuggestion={() =>
                  sug?.value !== undefined &&
                  setDims((prev) => ({ ...prev, [d.key]: sug.value }))
                }
              />
            );
          })}

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <label className="text-sm font-medium">Reviewer comment</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isLocked}
              placeholder="Context for this year's scores, exceptions, follow-ups…"
              className="mt-2 min-h-[96px]"
            />
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Actions</h2>
            <div className="mt-3 flex flex-col gap-2">
              <Button
                onClick={() => upsertMutation.mutate('Draft')}
                disabled={isLocked || upsertMutation.isPending}
                variant="outline"
              >
                Save as draft
              </Button>
              <Button
                onClick={() => {
                  upsertMutation.mutate('Approved', {
                    onSuccess: () => setUnlockEdit(false),
                  });
                }}
                disabled={!allSet || isLocked || upsertMutation.isPending}
              >
                {status === 'Approved' && unlockEdit ? 'Save & re-submit' : 'Submit for approval'}
              </Button>
              <Button
                onClick={() => upsertMutation.mutate('Rejected')}
                disabled={isLocked || upsertMutation.isPending}
                variant="ghost"
                className="text-signal-red hover:text-signal-red"
              >
                Reject
              </Button>
              {status === 'Approved' && !unlockEdit && (
                <Button variant="outline" onClick={() => setUnlockEdit(true)}>
                  Edit submitted review
                </Button>
              )}
              {status === 'Approved' && unlockEdit && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setUnlockEdit(false);
                    // Reset to original values.
                    setDims({
                      criticality: initial?.criticalityScore,
                      dependency: initial?.dependencyScore,
                      spend: initial?.spendScore,
                      value: initial?.valueScore,
                      alignment: initial?.alignmentScore,
                    });
                    setComment(initial?.comment ?? '');
                  }}
                >
                  Cancel edit
                </Button>
              )}
            </div>
            {!allSet && !isLocked && (
              <p className="mt-3 text-xs text-muted-foreground">
                Set all 5 dimensions to enable Submit for approval.
              </p>
            )}
            {status === 'Approved' && !unlockEdit && (
              <p className="mt-3 text-xs text-muted-foreground">
                This review is approved. Click "Edit submitted review" to make changes.
              </p>
            )}
            {status === 'Approved' && unlockEdit && (
              <p className="mt-3 text-xs text-signal-amber">
                Editing an approved review. Save &amp; re-submit to persist changes.
              </p>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Prior year</h2>
            {item.priorScore ? (
              <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Year</dt>
                <dd className="text-right tabular-nums">{item.priorScore.scoreYear}</dd>
                <dt className="text-muted-foreground">Criticality</dt>
                <dd className="text-right tabular-nums">{item.priorScore.criticalityScore ?? '—'}</dd>
                <dt className="text-muted-foreground">Dependency</dt>
                <dd className="text-right tabular-nums">{item.priorScore.dependencyScore ?? '—'}</dd>
                <dt className="text-muted-foreground">Spend</dt>
                <dd className="text-right tabular-nums">{item.priorScore.spendScore ?? '—'}</dd>
                <dt className="text-muted-foreground">Value</dt>
                <dd className="text-right tabular-nums">{item.priorScore.valueScore ?? '—'}</dd>
                <dt className="text-muted-foreground">Alignment</dt>
                <dd className="text-right tabular-nums">{item.priorScore.alignmentScore ?? '—'}</dd>
                <dt className="text-muted-foreground">Weighted</dt>
                <dd className="text-right font-medium tabular-nums">
                  {computeScoresFor(item.priorScore).weighted?.toFixed(2) ?? '—'}
                </dd>
              </dl>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No prior-year score on file.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function DimensionCard({
  idx,
  label,
  help,
  value,
  unlocked,
  onChange,
  suggestion,
  onAcceptSuggestion,
}: {
  idx: number;
  label: string;
  help: string;
  value: number | undefined;
  unlocked: boolean;
  onChange: (v: number | undefined) => void;
  suggestion?: ScoreDimensionSuggestion;
  onAcceptSuggestion?: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 shadow-sm transition-opacity',
        !unlocked && 'pointer-events-none opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">Step {idx}</div>
          <div className="text-base font-semibold">{label}</div>
          <div className="text-xs text-muted-foreground">{help}</div>
        </div>
        {value ? <CriticalityPill level={value as CriticalityLevel} /> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={cn(
              'h-9 min-w-12 rounded-md border px-3 text-sm font-semibold tabular-nums transition-colors',
              value === n
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted',
            )}
          >
            {n}
          </button>
        ))}
        {value !== undefined && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="h-9 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {suggestion && suggestion.value !== undefined && (
        <div className="mt-3 rounded-md border border-dashed bg-muted/30 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-semibold">Suggested: {suggestion.value}</span>
              <span className="ml-2 text-muted-foreground">
                (confidence {(suggestion.confidence * 100).toFixed(0)}%)
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onAcceptSuggestion}
              disabled={value === suggestion.value}
            >
              {value === suggestion.value ? 'Applied' : 'Use'}
            </Button>
          </div>
          <div className="mt-1 text-muted-foreground">{suggestion.rationale}</div>
          {suggestion.sources.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-[11px] text-muted-foreground">
              {suggestion.sources.slice(0, 3).map((s, i) => (
                <li key={i}>
                  <span className="font-medium">{s.system}:</span> {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
