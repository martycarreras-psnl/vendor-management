// VP review context: resolves the current signed-in reviewer, the active
// review cycle year, and (for admins) a selected-reviewer override so an
// admin can inspect another VP's queue without signing in as them.
//
// Admin gate: until Dataverse role-based admin is wired, we use the env flag
// `VITE_ENABLE_VP_ADMIN` ('true' | '1') to unlock admin-only UI.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVendiq } from '@/services/vendiq/provider-context';
import type { Reviewer } from '@/types/vendiq';

const OVERRIDE_KEY = 'vendiq.vpReview.selectedReviewerId';

export function useVPReviewCycleYear(): number {
  // Cycle year = current calendar year. Keep as a function so callers can
  // memoize easily and tests can stub Date.now if needed.
  return useMemo(() => new Date().getFullYear(), []);
}

export function useIsVPAdmin(): boolean {
  const flag = import.meta.env.VITE_ENABLE_VP_ADMIN;
  return flag === true || flag === 'true' || flag === '1';
}

export interface VPReviewContext {
  currentReviewer: Reviewer | null | undefined;
  isLoadingCurrent: boolean;
  isAdmin: boolean;
  cycleYear: number;
  /** Reviewer id to query the queue for: admin override if set, else current. */
  effectiveReviewerId: string | undefined;
  effectiveReviewer: Reviewer | null | undefined;
  selectedReviewerId: string | null;
  setSelectedReviewerId: (id: string | null) => void;
  reviewers: Reviewer[] | undefined;
  isLoadingReviewers: boolean;
}

export function useVPReviewContext(): VPReviewContext {
  const provider = useVendiq();
  const cycleYear = useVPReviewCycleYear();
  const isAdmin = useIsVPAdmin();

  const currentQ = useQuery({
    queryKey: ['vendiq', 'vpReview', 'currentReviewer'],
    queryFn: () => provider.reviewers.getCurrent(),
    staleTime: 5 * 60_000,
  });

  const reviewersQ = useQuery({
    queryKey: ['vendiq', 'vpReview', 'reviewers'],
    queryFn: () => provider.reviewers.list(),
    enabled: isAdmin,
    staleTime: 5 * 60_000,
  });

  const [selectedReviewerId, setSelectedReviewerIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(OVERRIDE_KEY);
  });

  // Admin override only applies when admin flag is on. If the flag flips off,
  // clear the override so non-admin sessions don't accidentally query someone
  // else's queue.
  useEffect(() => {
    if (!isAdmin && selectedReviewerId) {
      setSelectedReviewerIdState(null);
      if (typeof window !== 'undefined') window.localStorage.removeItem(OVERRIDE_KEY);
    }
  }, [isAdmin, selectedReviewerId]);

  const setSelectedReviewerId = useCallback((id: string | null) => {
    setSelectedReviewerIdState(id);
    if (typeof window !== 'undefined') {
      if (id) window.localStorage.setItem(OVERRIDE_KEY, id);
      else window.localStorage.removeItem(OVERRIDE_KEY);
    }
  }, []);

  const effectiveReviewerId =
    (isAdmin && selectedReviewerId) || currentQ.data?.id || undefined;

  const effectiveReviewer: Reviewer | null | undefined = useMemo(() => {
    if (!effectiveReviewerId) return currentQ.data ?? null;
    if (currentQ.data?.id === effectiveReviewerId) return currentQ.data;
    return reviewersQ.data?.find((r) => r.id === effectiveReviewerId) ?? null;
  }, [effectiveReviewerId, currentQ.data, reviewersQ.data]);

  return {
    currentReviewer: currentQ.data,
    isLoadingCurrent: currentQ.isLoading,
    isAdmin,
    cycleYear,
    effectiveReviewerId,
    effectiveReviewer,
    selectedReviewerId,
    setSelectedReviewerId,
    reviewers: reviewersQ.data,
    isLoadingReviewers: reviewersQ.isLoading,
  };
}
