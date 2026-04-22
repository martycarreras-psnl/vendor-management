// Pure scoring-suggestions util.
//
// Given a vendor + signals from OneTrust, ServiceNow, GL, Contracts, and the
// prior-year score, return a `ScoreSuggestion` with rationale + sources for
// the wizard's Criticality / Dependency / Spend dimensions.
//
// No I/O. Caller is responsible for fetching inputs.

import type {
  CriticalityLevel,
  GLTransaction,
  Contract,
  OneTrustAssessment,
  ScoreDimensionSuggestion,
  ScoreSuggestion,
  ServiceNowAssessment,
  Vendor,
  VendorScore,
  VendorSupplier,
} from '@/types/vendiq';

export interface ScoringSuggestionsInput {
  vendor: Vendor;
  oneTrust: OneTrustAssessment[];
  serviceNow: ServiceNowAssessment[];
  /** GL rows (any window) used to compute rolling-12-month total when caller has not pre-summed. */
  glTransactions?: GLTransaction[];
  /** Pre-computed annual spend total (preferred over `glTransactions` if provided). */
  annualSpendTotal?: number;
  /** Annual spend totals for every vendor in the same Category L1, used for quintile bucketing. */
  categoryAnnualSpendTotals?: number[];
  contracts: Contract[];
  vendorSuppliers?: VendorSupplier[];
  priorScore?: VendorScore | null;
}

const EMPTY_SUGGESTION: ScoreDimensionSuggestion = {
  value: undefined,
  confidence: 0,
  rationale: 'No signal available.',
  sources: [],
};

/**
 * Suggest 1\u20135 values for Criticality, Dependency, and Spend.
 *
 * - Criticality: max of OneTrust criticality, ServiceNow criticalityLevel, prior-year CriticalityScore.
 * - Dependency: blends active-contract count + top-contract spend concentration + alternative-supplier coverage.
 * - Spend: quintile of annual spend within the vendor's Category L1 peer set.
 */
export function suggestScores(input: ScoringSuggestionsInput): ScoreSuggestion {
  return {
    criticality: suggestCriticality(input),
    dependency: suggestDependency(input),
    spend: suggestSpend(input),
  };
}

function suggestCriticality(input: ScoringSuggestionsInput): ScoreDimensionSuggestion {
  const sources: ScoreDimensionSuggestion['sources'] = [];
  const candidates: Array<{ value: CriticalityLevel; label: string; system: 'OneTrust' | 'ServiceNow' | 'PriorYear'; id?: string }> = [];

  for (const ot of input.oneTrust) {
    if (ot.criticality) {
      candidates.push({ value: ot.criticality, label: `OneTrust: ${ot.assessmentName}`, system: 'OneTrust', id: ot.id });
    }
  }
  for (const sn of input.serviceNow) {
    if (sn.criticalityLevel) {
      candidates.push({
        value: sn.criticalityLevel,
        label: `ServiceNow: ${sn.snNumber ?? sn.assessmentName}`,
        system: 'ServiceNow',
        id: sn.id,
      });
    }
  }
  if (input.priorScore?.criticalityScore != null) {
    const prior = clampLevel(input.priorScore.criticalityScore);
    if (prior) {
      candidates.push({
        value: prior,
        label: `Prior year (${input.priorScore.scoreYear}) criticality`,
        system: 'PriorYear',
        id: input.priorScore.id,
      });
    }
  }

  if (candidates.length === 0) return { ...EMPTY_SUGGESTION, rationale: 'No OneTrust, ServiceNow, or prior-year criticality signal.' };

  const max = candidates.reduce((acc, c) => (c.value > acc.value ? c : acc));
  for (const c of candidates) {
    sources.push({ system: c.system, label: c.label, id: c.id });
  }
  // Confidence: 0.6 base + 0.1 per corroborating source above 1, capped at 0.95.
  const confidence = Math.min(0.95, 0.6 + 0.1 * (candidates.length - 1));
  return {
    value: max.value,
    confidence,
    rationale: `Highest of ${candidates.length} signal(s): ${max.label} \u2192 level ${max.value}.`,
    sources,
  };
}

function suggestDependency(input: ScoringSuggestionsInput): ScoreDimensionSuggestion {
  const activeContracts = input.contracts.filter((c) => c.contractStatus === 'Active');
  const sources: ScoreDimensionSuggestion['sources'] = [];
  if (activeContracts.length === 0 && (input.vendorSuppliers?.length ?? 0) === 0 && input.priorScore?.dependencyScore == null) {
    return { ...EMPTY_SUGGESTION, rationale: 'No active contracts, supplier coverage, or prior-year dependency signal.' };
  }

  for (const c of activeContracts.slice(0, 5)) {
    sources.push({ system: 'Contract', label: `Active: ${c.contractName}`, id: c.id });
  }

  // Alternative-supplier coverage: more suppliers = lower dependency.
  const supplierCount = input.vendorSuppliers?.length ?? 0;

  // Heuristic level mapping. Tuneable; documented for autodoc.
  // - 5 active contracts AND \u22641 alt supplier \u2192 5
  // - 3\u20134 active contracts OR no alt supplier \u2192 4
  // - 1\u20132 active contracts AND \u22652 alt suppliers \u2192 3
  // - 1 active contract AND \u22653 alt suppliers \u2192 2
  // - 0 active contracts \u2192 1
  let value: CriticalityLevel;
  if (activeContracts.length >= 5 && supplierCount <= 1) value = 5;
  else if (activeContracts.length >= 3 || supplierCount === 0) value = 4;
  else if (activeContracts.length >= 1 && supplierCount >= 3) value = 2;
  else if (activeContracts.length >= 1) value = 3;
  else value = 1;

  if (input.priorScore?.dependencyScore != null) {
    sources.push({
      system: 'PriorYear',
      label: `Prior year dependency: ${input.priorScore.dependencyScore}`,
      id: input.priorScore.id,
    });
  }

  const confidence = activeContracts.length > 0 ? 0.7 : 0.4;
  return {
    value,
    confidence,
    rationale: `${activeContracts.length} active contract(s); ${supplierCount} supplier relationship(s).`,
    sources,
  };
}

function suggestSpend(input: ScoringSuggestionsInput): ScoreDimensionSuggestion {
  const annual = input.annualSpendTotal ?? sumNet(input.glTransactions);
  if (!annual || annual <= 0) {
    return { ...EMPTY_SUGGESTION, rationale: 'No GL spend in the rolling 12-month window.' };
  }
  const peerSet = (input.categoryAnnualSpendTotals ?? []).filter((n) => Number.isFinite(n) && n > 0);
  if (peerSet.length < 5) {
    // Not enough peers for a meaningful quintile. Fall back to absolute thresholds.
    const value = absoluteSpendBand(annual);
    return {
      value,
      confidence: 0.4,
      rationale: `Annual spend ${formatUsd(annual)}. Insufficient Category L1 peers for quintile bucketing; absolute band used.`,
      sources: [{ system: 'GL', label: `Annual spend ${formatUsd(annual)}` }],
    };
  }
  const sorted = [...peerSet].sort((a, b) => a - b);
  const rank = sorted.filter((n) => n <= annual).length;
  const quintile = Math.min(5, Math.max(1, Math.ceil((rank / sorted.length) * 5)));
  return {
    value: quintile as CriticalityLevel,
    confidence: 0.8,
    rationale: `Annual spend ${formatUsd(annual)} ranks #${rank} of ${sorted.length} in Category L1 \u2192 Q${quintile}.`,
    sources: [{ system: 'GL', label: `Annual spend ${formatUsd(annual)}` }],
  };
}

function sumNet(rows: GLTransaction[] | undefined): number {
  if (!rows?.length) return 0;
  return rows.reduce((acc, r) => acc + (r.netAmount ?? 0), 0);
}

function clampLevel(n: number): CriticalityLevel | undefined {
  const r = Math.round(n);
  if (r < 1 || r > 5) return undefined;
  return r as CriticalityLevel;
}

function absoluteSpendBand(annual: number): CriticalityLevel {
  if (annual >= 5_000_000) return 5;
  if (annual >= 1_000_000) return 4;
  if (annual >= 250_000) return 3;
  if (annual >= 50_000) return 2;
  return 1;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
