// VP review queue: "My Vendors to Review" for the effective reviewer and
// active cycle year. Admins (VITE_ENABLE_VP_ADMIN) can impersonate another
// reviewer via the reviewer switcher above the grid.

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardEdit } from 'lucide-react';
import { useVendiq } from '@/services/vendiq/provider-context';
import { useVPReviewContext } from '@/hooks/vendiq/use-vp-review-context';
import { DataGrid, type ColumnDef } from '@/components/vendiq/data-grid';
import { CriticalityPill } from '@/components/vendiq/criticality-pill';
import { ScoreStatusBadge } from '@/components/vendiq/score-status-badge';
import { WeightedScoreInfo } from '@/components/vendiq/weighted-score-info';
import { computeScoresFor } from '@/services/vendiq/weighted-score';
import { formatDate, daysUntil } from '@/lib/vendiq-format';
import { cn } from '@/lib/utils';
import type { ReviewQueueItem, ScoreStatus } from '@/types/vendiq';

interface Row {
  assignmentId: string;
  vendorId: string;
  vendorName: string;
  criticality?: number;
  dueDateIso?: string;
  daysLeft?: number;
  status: ScoreStatus;
  currentWeighted?: number;
  priorWeighted?: number;
  delta?: number;
}

function DueBadge({ iso }: { iso?: string }) {
  const d = daysUntil(iso);
  if (!iso) return <span className="text-muted-foreground">—</span>;
  if (d === undefined) return <span className="text-muted-foreground">—</span>;
  const overdue = d < 0;
  const soon = d >= 0 && d <= 7;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        overdue
          ? 'bg-signal-red text-white'
          : soon
            ? 'bg-signal-amber text-white'
            : 'bg-muted text-foreground',
      )}
    >
      {overdue ? `Overdue ${Math.abs(d)}d` : `${d}d`}
    </span>
  );
}

export default function ReviewsPage() {
  const provider = useVendiq();
  const {
    effectiveReviewerId,
    effectiveReviewer,
    cycleYear,
    isAdmin,
    reviewers,
    selectedReviewerId,
    setSelectedReviewerId,
    isLoadingCurrent,
  } = useVPReviewContext();

  const queueQ = useQuery({
    queryKey: ['vendiq', 'reviews', 'queue', effectiveReviewerId, cycleYear],
    enabled: Boolean(effectiveReviewerId),
    queryFn: () => provider.assignments.listVendorsForReviewer(effectiveReviewerId!, cycleYear),
  });

  const countsQ = useQuery({
    queryKey: ['vendiq', 'reviews', 'counts', effectiveReviewerId, cycleYear],
    enabled: Boolean(effectiveReviewerId),
    queryFn: () => provider.assignments.countsByStatus(effectiveReviewerId!, cycleYear),
  });

  if (isLoadingCurrent) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading reviewer…</div>;
  }

  if (!effectiveReviewerId) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <h1 className="text-lg font-semibold">No reviewer resolved</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We couldn't identify the signed-in user in Dataverse. Ask an admin to confirm your systemuser record exists.
        </p>
      </div>
    );
  }

  const rows: Row[] = (queueQ.data ?? []).map((item: ReviewQueueItem) => {
    const { weighted: curW } = computeScoresFor(item.currentScore ?? {});
    const { weighted: priorW } = computeScoresFor(item.priorScore ?? {});
    const delta = curW !== undefined && priorW !== undefined ? curW - priorW : undefined;
    const status: ScoreStatus = item.currentScore?.reviewStatus ?? 'NotStarted';
    return {
      assignmentId: item.assignment.id,
      vendorId: item.vendor.id,
      vendorName: item.vendor.vendorName,
      criticality: item.currentScore?.criticalityScore
        ? Math.max(1, Math.min(5, Math.round(item.currentScore.criticalityScore)))
        : undefined,
      dueDateIso: item.assignment.reviewDueDate,
      daysLeft: daysUntil(item.assignment.reviewDueDate),
      status,
      currentWeighted: curW,
      priorWeighted: priorW,
      delta,
    };
  });

  const counts = countsQ.data;

  const columns: ColumnDef<Row>[] = [
    {
      key: 'vendor',
      header: 'Vendor',
      accessor: (r) => r.vendorName,
      render: (r) => <span className="font-medium">{r.vendorName}</span>,
    },
    {
      key: 'criticality',
      header: 'Criticality',
      accessor: (r) => r.criticality ?? 0,
      render: (r) =>
        r.criticality ? (
          <CriticalityPill level={r.criticality as 1 | 2 | 3 | 4 | 5} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (r) => r.status,
      render: (r) => <ScoreStatusBadge status={r.status} />,
    },
    {
      key: 'due',
      header: 'Due',
      accessor: (r) => r.dueDateIso ?? '',
      render: (r) => (
        <div className="flex flex-col">
          <DueBadge iso={r.dueDateIso} />
          {r.dueDateIso && (
            <span className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(r.dueDateIso)}</span>
          )}
        </div>
      ),
    },
    {
      key: 'current',
      header: 'Current wtd',
      accessor: (r) => r.currentWeighted ?? -1,
      render: (r) =>
        r.currentWeighted !== undefined ? (
          <span className="font-medium tabular-nums">{r.currentWeighted.toFixed(2)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      align: 'right',
    },
    {
      key: 'prior',
      header: 'Prior wtd',
      accessor: (r) => r.priorWeighted ?? -1,
      render: (r) =>
        r.priorWeighted !== undefined ? (
          <span className="tabular-nums text-muted-foreground">{r.priorWeighted.toFixed(2)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      align: 'right',
    },
    {
      key: 'delta',
      header: 'Δ',
      accessor: (r) => r.delta ?? 0,
      render: (r) => {
        if (r.delta === undefined) return <span className="text-muted-foreground">—</span>;
        const up = r.delta > 0;
        const down = r.delta < 0;
        return (
          <span
            className={cn(
              'tabular-nums font-medium',
              up && 'text-signal-red',
              down && 'text-emerald-600',
            )}
          >
            {up ? '+' : ''}
            {r.delta.toFixed(2)}
          </span>
        );
      },
      align: 'right',
    },
    {
      key: 'action',
      header: '',
      accessor: () => '',
      render: (r) => {
        const label =
          r.status === 'NotStarted'
            ? 'Start review'
            : r.status === 'Approved'
              ? 'View review'
              : 'Continue review';
        return (
          <Link
            to={`/reviews/${r.assignmentId}/score`}
            title={label}
            aria-label={`${label} for ${r.vendorName}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ClipboardEdit className="h-4 w-4" />
          </Link>
        );
      },
      align: 'right',
    },
  ];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Vendors to Review</h1>
          <p className="text-sm text-muted-foreground">
            {effectiveReviewer?.fullName ? `${effectiveReviewer.fullName} · ` : ''}Cycle {cycleYear}
          </p>
        </div>
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">View as:</span>
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={selectedReviewerId ?? ''}
              onChange={(e) => setSelectedReviewerId(e.target.value || null)}
            >
              <option value="">(me)</option>
              {(reviewers ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiTile label="Total" value={counts?.total} />
        <KpiTile label="Not started" value={counts?.notStarted} />
        <KpiTile label="Draft" value={counts?.draft} />
        <KpiTile label="Approved" value={counts?.approved} />
        <KpiTile label="Overdue" value={counts?.overdue} tone="red" />
      </section>

      <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        <span>Weighted score formula</span>
        <WeightedScoreInfo />
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        {queueQ.isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading queue…</div>
        ) : queueQ.isError ? (
          <div className="p-8 text-center text-destructive">Failed to load review queue.</div>
        ) : (
          <DataGrid
            columns={columns}
            data={rows}
            keyFn={(r) => r.assignmentId}
            emptyMessage="You have no vendors assigned for this cycle yet."
            pageSize={50}
            defaultSort={{ key: 'due', dir: 'asc' }}
          />
        )}
      </div>
    </div>
  );
}

function KpiTile({ label, value, tone }: { label: string; value?: number; tone?: 'red' }) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          tone === 'red' && (value ?? 0) > 0 && 'text-signal-red',
        )}
      >
        {value ?? '—'}
      </div>
    </div>
  );
}
