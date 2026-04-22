// Pure utility for VendorScore weighted score calculations.
//
// The formula and weights are LOCKED per the VP review plan. The JSDoc on the
// exported helpers below is intentionally verbose so the formula surfaces in
// TypeDoc / autodoc output, in IDE hover tooltips, AND in the
// `<WeightedScoreInfo />` component (which reads `WEIGHTED_SCORE_FORMULA_TEXT`).
//
// No I/O. No React. Safe to import from anywhere.

import type { VendorScore } from '@/types/vendiq';

/**
 * Weighted-score weights used across VendIQ.
 *
 * Five-dimension formula:
 *   Weighted = 0.30 * Criticality
 *            + 0.30 * Dependency
 *            + 0.20 * Spend
 *            + 0.10 * Value
 *            + 0.10 * Alignment
 *
 * Critical/Dependency-only fallback (used when Spend/Value/Alignment are not yet captured):
 *   WtScoreCritDepOnly = 0.50 * Criticality + 0.50 * Dependency
 */
export const WEIGHTED_SCORE_WEIGHTS = {
  criticality: 0.3,
  dependency: 0.3,
  spend: 0.2,
  value: 0.1,
  alignment: 0.1,
} as const;

/** Weights for the Criticality + Dependency only fallback. */
export const WEIGHTED_SCORE_CRIT_DEP_WEIGHTS = {
  criticality: 0.5,
  dependency: 0.5,
} as const;

/**
 * Plain-English formula text. Surfaced in the `<WeightedScoreInfo />` info-icon
 * tooltip so VPs see the exact math behind the column they're looking at.
 */
export const WEIGHTED_SCORE_FORMULA_TEXT =
  'Weighted = 0.30 \u00b7 Criticality + 0.30 \u00b7 Dependency + 0.20 \u00b7 Spend + 0.10 \u00b7 Value + 0.10 \u00b7 Alignment. ' +
  'Crit + Dep only fallback = 0.50 \u00b7 Criticality + 0.50 \u00b7 Dependency.';

/** Inputs accepted by `computeWeightedScore`. All dimensions are optional (1\u20135). */
export interface WeightedScoreInputs {
  criticality?: number;
  dependency?: number;
  spend?: number;
  value?: number;
  alignment?: number;
}

/**
 * Compute the full 5-dimension weighted score.
 *
 * Returns `undefined` when ANY of the 5 dimensions is missing (per the plan:
 * "missing dims \u2192 null, not zero" \u2014 we never silently substitute 0).
 *
 * Formula:
 *   `0.30 * Crit + 0.30 * Dep + 0.20 * Spend + 0.10 * Value + 0.10 * Alignment`
 */
export function computeWeightedScore(input: WeightedScoreInputs): number | undefined {
  const { criticality, dependency, spend, value, alignment } = input;
  if (
    criticality == null ||
    dependency == null ||
    spend == null ||
    value == null ||
    alignment == null
  ) {
    return undefined;
  }
  const w = WEIGHTED_SCORE_WEIGHTS;
  return (
    w.criticality * criticality +
    w.dependency * dependency +
    w.spend * spend +
    w.value * value +
    w.alignment * alignment
  );
}

/**
 * Compute the Criticality + Dependency only fallback score.
 *
 * Returns `undefined` when either dimension is missing.
 *
 * Formula: `0.50 * Crit + 0.50 * Dep`
 */
export function computeWtScoreCritDepOnly(input: Pick<WeightedScoreInputs, 'criticality' | 'dependency'>): number | undefined {
  const { criticality, dependency } = input;
  if (criticality == null || dependency == null) return undefined;
  const w = WEIGHTED_SCORE_CRIT_DEP_WEIGHTS;
  return w.criticality * criticality + w.dependency * dependency;
}

/** Convenience: compute both scores from a `VendorScore`-shaped record. */
export function computeScoresFor(score: Partial<VendorScore>): {
  weighted: number | undefined;
  critDepOnly: number | undefined;
} {
  const inputs: WeightedScoreInputs = {
    criticality: score.criticalityScore,
    dependency: score.dependencyScore,
    spend: score.spendScore,
    value: score.valueScore,
    alignment: score.alignmentScore,
  };
  return {
    weighted: computeWeightedScore(inputs),
    critDepOnly: computeWtScoreCritDepOnly(inputs),
  };
}
