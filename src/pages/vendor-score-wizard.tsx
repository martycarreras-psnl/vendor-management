// Placeholder for Phase 3c — VendorScore wizard. Renders a minimal
// scaffold so links from the Reviews queue resolve instead of 404.

import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useVendiq } from '@/services/vendiq/provider-context';
import { useVPReviewContext } from '@/hooks/vendiq/use-vp-review-context';

export default function VendorScoreWizardPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const provider = useVendiq();
  const { effectiveReviewerId, cycleYear } = useVPReviewContext();

  const queueQ = useQuery({
    queryKey: ['vendiq', 'reviews', 'queue', effectiveReviewerId, cycleYear],
    enabled: Boolean(effectiveReviewerId),
    queryFn: () => provider.assignments.listVendorsForReviewer(effectiveReviewerId!, cycleYear),
  });

  const item = queueQ.data?.find((q) => q.assignment.id === assignmentId);

  return (
    <div className="space-y-4">
      <Link to="/reviews" className="text-sm text-primary underline-offset-2 hover:underline">
        ← Back to My Vendors to Review
      </Link>

      <header>
        <h1 className="text-2xl font-semibold">
          {item?.vendor.vendorName ?? 'Vendor review'}
        </h1>
        <p className="text-sm text-muted-foreground">Cycle {cycleYear}</p>
      </header>

      <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-sm text-muted-foreground">
        Wizard UI arrives in Phase 3c. This page currently confirms routing,
        assignment resolution, and context plumbing.
      </div>
    </div>
  );
}
