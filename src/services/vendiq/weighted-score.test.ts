import { describe, expect, it } from 'vitest';
import {
  computeScoresFor,
  computeWeightedScore,
  computeWtScoreCritDepOnly,
  WEIGHTED_SCORE_FORMULA_TEXT,
  WEIGHTED_SCORE_WEIGHTS,
} from './weighted-score';

describe('weighted-score', () => {
  it('uses the LOCKED weights', () => {
    expect(WEIGHTED_SCORE_WEIGHTS).toEqual({
      criticality: 0.3,
      dependency: 0.3,
      spend: 0.2,
      value: 0.1,
      alignment: 0.1,
    });
  });

  it('formula text mentions every weight', () => {
    expect(WEIGHTED_SCORE_FORMULA_TEXT).toMatch(/0\.30/);
    expect(WEIGHTED_SCORE_FORMULA_TEXT).toMatch(/0\.20/);
    expect(WEIGHTED_SCORE_FORMULA_TEXT).toMatch(/0\.10/);
    expect(WEIGHTED_SCORE_FORMULA_TEXT).toMatch(/0\.50/);
  });

  it('returns undefined when any of the 5 dimensions is missing', () => {
    expect(computeWeightedScore({ criticality: 5, dependency: 5, spend: 5, value: 5 })).toBeUndefined();
    expect(computeWeightedScore({ criticality: 5, dependency: 5, spend: 5, alignment: 5 })).toBeUndefined();
    expect(computeWeightedScore({})).toBeUndefined();
  });

  it('computes the weighted score per the LOCKED formula', () => {
    // 0.30*5 + 0.30*4 + 0.20*3 + 0.10*2 + 0.10*1 = 1.5 + 1.2 + 0.6 + 0.2 + 0.1 = 3.6
    const w = computeWeightedScore({ criticality: 5, dependency: 4, spend: 3, value: 2, alignment: 1 });
    expect(w).toBeCloseTo(3.6, 5);
  });

  it('computes Crit + Dep only fallback', () => {
    expect(computeWtScoreCritDepOnly({ criticality: 4, dependency: 2 })).toBeCloseTo(3.0, 5);
    expect(computeWtScoreCritDepOnly({ criticality: 4 })).toBeUndefined();
  });

  it('computeScoresFor returns both scores', () => {
    const r = computeScoresFor({
      criticalityScore: 5,
      dependencyScore: 4,
      spendScore: 3,
      valueScore: 2,
      alignmentScore: 1,
    });
    expect(r.weighted).toBeCloseTo(3.6, 5);
    expect(r.critDepOnly).toBeCloseTo(4.5, 5);
  });
});
