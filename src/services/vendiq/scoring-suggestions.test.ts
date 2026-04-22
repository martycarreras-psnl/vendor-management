import { describe, expect, it } from 'vitest';
import { suggestScores } from './scoring-suggestions';
import type { Contract, OneTrustAssessment, ServiceNowAssessment, Vendor, VendorScore, VendorSupplier } from '@/types/vendiq';

const vendor: Vendor = { id: 'v1', vendorName: 'Acme', categoryL1: 'IT' };

function ot(criticality: 1 | 2 | 3 | 4 | 5, name = 'OT-A'): OneTrustAssessment {
  return { id: `ot-${name}`, assessmentName: name, vendorId: 'v1', criticality };
}
function sn(level: 1 | 2 | 3 | 4 | 5): ServiceNowAssessment {
  return { id: 'sn-1', assessmentName: 'SN', vendorId: 'v1', assessmentType: 'Criticality', criticalityLevel: level };
}
function contract(status: Contract['contractStatus'], name = 'C'): Contract {
  return { id: `c-${name}`, documentId: name, contractName: name, contractStatus: status };
}

describe('suggestScores - criticality', () => {
  it('returns empty when no signal', () => {
    const r = suggestScores({ vendor, oneTrust: [], serviceNow: [], contracts: [] });
    expect(r.criticality.value).toBeUndefined();
    expect(r.criticality.confidence).toBe(0);
  });

  it('takes the maximum across OneTrust, ServiceNow, prior-year', () => {
    const priorScore: VendorScore = { id: 'p', vendorId: 'v1', scoreYear: '2024', criticalityScore: 2 };
    const r = suggestScores({
      vendor,
      oneTrust: [ot(3, 'OT-A')],
      serviceNow: [sn(5)],
      contracts: [],
      priorScore,
    });
    expect(r.criticality.value).toBe(5);
    expect(r.criticality.sources.length).toBe(3);
  });
});

describe('suggestScores - dependency', () => {
  it('5 with 5+ active contracts and \u22641 supplier', () => {
    const r = suggestScores({
      vendor,
      oneTrust: [],
      serviceNow: [],
      contracts: Array.from({ length: 5 }, (_, i) => contract('Active', `C${i}`)),
      vendorSuppliers: [],
    });
    expect(r.dependency.value).toBe(5);
  });

  it('2 with 1 active contract and 3+ alt suppliers', () => {
    const suppliers: VendorSupplier[] = Array.from({ length: 3 }, (_, i) => ({
      id: `vs-${i}`,
      vendorId: 'v1',
      supplierId: `s-${i}`,
      relationshipType: 'Direct',
    }));
    const r = suggestScores({
      vendor,
      oneTrust: [],
      serviceNow: [],
      contracts: [contract('Active')],
      vendorSuppliers: suppliers,
    });
    expect(r.dependency.value).toBe(2);
  });

  it('1 with 0 active contracts and prior-year fallback only', () => {
    const r = suggestScores({
      vendor,
      oneTrust: [],
      serviceNow: [],
      contracts: [],
      vendorSuppliers: [{ id: 's', vendorId: 'v1', supplierId: 's1', relationshipType: 'Direct' }],
      priorScore: { id: 'p', vendorId: 'v1', scoreYear: '2024', dependencyScore: 3 },
    });
    expect(r.dependency.value).toBe(1);
  });
});

describe('suggestScores - spend', () => {
  it('returns empty when no spend', () => {
    const r = suggestScores({ vendor, oneTrust: [], serviceNow: [], contracts: [] });
    expect(r.spend.value).toBeUndefined();
  });

  it('quintiles against peer set', () => {
    // Peers: 100, 200, 300, 400, 500. Vendor at 450 \u2192 rank=4 of 5 \u2192 ceil(4/5*5)=4
    const r = suggestScores({
      vendor,
      oneTrust: [],
      serviceNow: [],
      contracts: [],
      annualSpendTotal: 450,
      categoryAnnualSpendTotals: [100, 200, 300, 400, 500],
    });
    expect(r.spend.value).toBe(4);
  });

  it('falls back to absolute band when peer set is too small', () => {
    const r = suggestScores({
      vendor,
      oneTrust: [],
      serviceNow: [],
      contracts: [],
      annualSpendTotal: 2_000_000,
      categoryAnnualSpendTotals: [],
    });
    expect(r.spend.value).toBe(4);
  });
});
