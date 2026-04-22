// Option-set normalization helpers.
// The generated Dataverse models expose option sets as numeric string keys
// (e.g. "412900000") mapped to enum strings. Our domain types use the
// enum string values directly so UI code doesn't have to know about the
// Dataverse integer values.

import type {
  Rpvms_contractsrpvms_contractstatus,
  Rpvms_contractsrpvms_contracttype,
} from '@/generated/models/Rpvms_contractsModel';
import type {
  Rpvms_gltransactionsrpvms_paymentstatus,
  Rpvms_gltransactionsrpvms_status,
} from '@/generated/models/Rpvms_gltransactionsModel';
import type {
  Rpvms_onetrustassessmentsrpvms_classification,
  Rpvms_onetrustassessmentsrpvms_criticality,
  Rpvms_onetrustassessmentsrpvms_ephi,
  Rpvms_onetrustassessmentsrpvms_systemaccess,
} from '@/generated/models/Rpvms_onetrustassessmentsModel';
import type {
  Rpvms_servicenowassessmentsrpvms_assessmenttype,
  Rpvms_servicenowassessmentsrpvms_criticalitylevel,
  Rpvms_servicenowassessmentsrpvms_isbudgeted,
} from '@/generated/models/Rpvms_servicenowassessmentsModel';
import type { Rpvms_suppliersrpvms_tintype, Rpvms_suppliersrpvms_isreseller } from '@/generated/models/Rpvms_suppliersModel';
import type { Rpvms_vendorbudgetsrpvms_quintilerating } from '@/generated/models/Rpvms_vendorbudgetsModel';
import type { Rpvms_vendorratecardsrpvms_experiencelevel, Rpvms_vendorratecardsrpvms_locationtype } from '@/generated/models/Rpvms_vendorratecardsModel';
import type {
  Rpvms_vendorsrpvms_classification,
  Rpvms_vendorsrpvms_commercialrole,
  Rpvms_vendorsrpvms_status,
  Rpvms_vendorsrpvms_activephiaccess,
  Rpvms_vendorsrpvms_isvar,
} from '@/generated/models/Rpvms_vendorsModel';
import type { Rpvms_vendorsuppliersrpvms_relationshiptype } from '@/generated/models/Rpvms_vendorsuppliersModel';

import {
  Rpvms_vendorsrpvms_classification as VendorClassificationMap,
  Rpvms_vendorsrpvms_commercialrole as VendorCommercialRoleMap,
  Rpvms_vendorsrpvms_status as VendorStatusMap,
  Rpvms_vendorsrpvms_activephiaccess as VendorPhiMap,
  Rpvms_vendorsrpvms_isvar as VendorIsVarMap,
} from '@/generated/models/Rpvms_vendorsModel';
import {
  Rpvms_suppliersrpvms_tintype as SupplierTinTypeMap,
  Rpvms_suppliersrpvms_isreseller as SupplierIsResellerMap,
} from '@/generated/models/Rpvms_suppliersModel';
import {
  Rpvms_contractsrpvms_contractstatus as ContractStatusMap,
  Rpvms_contractsrpvms_contracttype as ContractTypeMap,
  Rpvms_contractsrpvms_autorenew as ContractAutoRenewMap,
  Rpvms_contractsrpvms_amended as ContractAmendedMap,
  Rpvms_contractsrpvms_terminationwithoutcause as ContractTwoMap,
} from '@/generated/models/Rpvms_contractsModel';
import {
  Rpvms_gltransactionsrpvms_paymentstatus as GLPaymentStatusMap,
  Rpvms_gltransactionsrpvms_status as GLStatusMap,
} from '@/generated/models/Rpvms_gltransactionsModel';
import {
  Rpvms_onetrustassessmentsrpvms_classification as OTClassificationMap,
  Rpvms_onetrustassessmentsrpvms_criticality as OTCriticalityMap,
  Rpvms_onetrustassessmentsrpvms_ephi as OTEphiMap,
  Rpvms_onetrustassessmentsrpvms_systemaccess as OTSystemAccessMap,
} from '@/generated/models/Rpvms_onetrustassessmentsModel';
import {
  Rpvms_servicenowassessmentsrpvms_assessmenttype as SNAssessmentTypeMap,
  Rpvms_servicenowassessmentsrpvms_criticalitylevel as SNCriticalityMap,
  Rpvms_servicenowassessmentsrpvms_isbudgeted as SNBudgetedMap,
} from '@/generated/models/Rpvms_servicenowassessmentsModel';
import { Rpvms_vendorbudgetsrpvms_quintilerating as QuintileRatingMap } from '@/generated/models/Rpvms_vendorbudgetsModel';
import {
  Rpvms_vendorratecardsrpvms_experiencelevel as RateCardExpMap,
  Rpvms_vendorratecardsrpvms_locationtype as RateCardLocationMap,
} from '@/generated/models/Rpvms_vendorratecardsModel';
import { Rpvms_vendorsuppliersrpvms_relationshiptype as VendorSupplierRelMap } from '@/generated/models/Rpvms_vendorsuppliersModel';

import type {
  VendorClassification,
  VendorStatus,
  CommercialRole,
  YesNoNA,
  ContractStatus,
  ContractType,
  PaymentStatus,
  GLTransactionStatus,
  RelationshipType,
  TINType,
  SystemAccessLevel,
  ServiceNowAssessmentType,
  QuintileRating,
  RateCardExperienceLevel,
  RateCardLocationType,
  CriticalityLevel,
} from '@/types/vendiq';

/** Resolve a generated option-set key (e.g. "412900000") to the enum string value. */
function lookup<T extends Record<string, string>>(map: T, key: string | undefined | null): T[keyof T] | undefined {
  if (key === undefined || key === null || key === '') return undefined;
  const entry = (map as Record<string, string | undefined>)[String(key)];
  return entry as T[keyof T] | undefined;
}

/** Reverse lookup: enum string → integer key. Used when writing records. */
function reverseLookup<T extends Record<string, string>>(map: T, value: string | undefined | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  for (const k of Object.keys(map)) {
    if ((map as Record<string, string>)[k] === value) return k;
  }
  return undefined;
}

// ---- Vendor ----
export function readVendorClassification(v: Rpvms_vendorsrpvms_classification | undefined): VendorClassification | undefined {
  return lookup(VendorClassificationMap, v as string | undefined) as VendorClassification | undefined;
}
export function writeVendorClassification(v: VendorClassification | undefined): Rpvms_vendorsrpvms_classification | undefined {
  return reverseLookup(VendorClassificationMap, v) as Rpvms_vendorsrpvms_classification | undefined;
}
export function readVendorStatus(v: Rpvms_vendorsrpvms_status | undefined): VendorStatus | undefined {
  return lookup(VendorStatusMap, v as string | undefined) as VendorStatus | undefined;
}
export function writeVendorStatus(v: VendorStatus | undefined): Rpvms_vendorsrpvms_status | undefined {
  return reverseLookup(VendorStatusMap, v) as Rpvms_vendorsrpvms_status | undefined;
}
export function readCommercialRole(v: Rpvms_vendorsrpvms_commercialrole | undefined): CommercialRole | undefined {
  return lookup(VendorCommercialRoleMap, v as string | undefined) as CommercialRole | undefined;
}
export function writeCommercialRole(v: CommercialRole | undefined): Rpvms_vendorsrpvms_commercialrole | undefined {
  return reverseLookup(VendorCommercialRoleMap, v) as Rpvms_vendorsrpvms_commercialrole | undefined;
}
export function readVendorPhi(v: Rpvms_vendorsrpvms_activephiaccess | undefined): YesNoNA | undefined {
  return lookup(VendorPhiMap, v as string | undefined) as YesNoNA | undefined;
}
export function writeVendorPhi(v: YesNoNA | undefined): Rpvms_vendorsrpvms_activephiaccess | undefined {
  return reverseLookup(VendorPhiMap, v) as Rpvms_vendorsrpvms_activephiaccess | undefined;
}
export function readIsVar(v: Rpvms_vendorsrpvms_isvar | undefined): boolean | undefined {
  const s = lookup(VendorIsVarMap, v as string | undefined);
  if (!s) return undefined;
  return s === 'Yes';
}
export function writeIsVar(v: boolean | undefined): Rpvms_vendorsrpvms_isvar | undefined {
  if (v === undefined) return undefined;
  return reverseLookup(VendorIsVarMap, v ? 'Yes' : 'No') as Rpvms_vendorsrpvms_isvar | undefined;
}

// ---- Supplier ----
export function readTinType(v: Rpvms_suppliersrpvms_tintype | undefined): TINType | undefined {
  return lookup(SupplierTinTypeMap, v as string | undefined) as TINType | undefined;
}
export function writeTinType(v: TINType | undefined): Rpvms_suppliersrpvms_tintype | undefined {
  return reverseLookup(SupplierTinTypeMap, v) as Rpvms_suppliersrpvms_tintype | undefined;
}
export function readIsReseller(v: string | undefined): boolean | undefined {
  const s = lookup(SupplierIsResellerMap, v);
  if (!s) return undefined;
  return s === 'Yes';
}
export function writeIsReseller(v: boolean | undefined): Rpvms_suppliersrpvms_isreseller | undefined {
  if (v === undefined) return undefined;
  return reverseLookup(SupplierIsResellerMap, v ? 'Yes' : 'No') as Rpvms_suppliersrpvms_isreseller | undefined;
}

// ---- Contract ----
export function readContractStatus(v: Rpvms_contractsrpvms_contractstatus | undefined): ContractStatus | undefined {
  return lookup(ContractStatusMap, v as string | undefined) as ContractStatus | undefined;
}
export function writeContractStatus(v: ContractStatus | undefined): Rpvms_contractsrpvms_contractstatus | undefined {
  return reverseLookup(ContractStatusMap, v) as Rpvms_contractsrpvms_contractstatus | undefined;
}
export function readContractType(v: Rpvms_contractsrpvms_contracttype | undefined): ContractType | undefined {
  return lookup(ContractTypeMap, v as string | undefined) as ContractType | undefined;
}
export function writeContractType(v: ContractType | undefined): Rpvms_contractsrpvms_contracttype | undefined {
  return reverseLookup(ContractTypeMap, v) as Rpvms_contractsrpvms_contracttype | undefined;
}
export function readYesNoNA(v: string | undefined): YesNoNA | undefined {
  // All Yes/No/N_A fields share the same value space; pick any one of the maps.
  return lookup(ContractAutoRenewMap, v) as YesNoNA | undefined
    ?? lookup(ContractAmendedMap, v) as YesNoNA | undefined
    ?? lookup(ContractTwoMap, v) as YesNoNA | undefined;
}
export function writeYesNoNA(v: YesNoNA | undefined): string | undefined {
  return reverseLookup(ContractAutoRenewMap, v);
}

// ---- GL ----
export function readGLStatus(v: Rpvms_gltransactionsrpvms_status | undefined): GLTransactionStatus | undefined {
  return lookup(GLStatusMap, v as string | undefined) as GLTransactionStatus | undefined;
}
export function readPaymentStatus(v: Rpvms_gltransactionsrpvms_paymentstatus | undefined): PaymentStatus | undefined {
  return lookup(GLPaymentStatusMap, v as string | undefined) as PaymentStatus | undefined;
}

// ---- Assessments ----
export function readOTClassification(v: Rpvms_onetrustassessmentsrpvms_classification | undefined): VendorClassification | undefined {
  return lookup(OTClassificationMap, v as string | undefined) as VendorClassification | undefined;
}
export function readOTCriticality(v: Rpvms_onetrustassessmentsrpvms_criticality | undefined): CriticalityLevel | undefined {
  return levelStringToNumber(lookup(OTCriticalityMap, v as string | undefined));
}
export function readOTEphi(v: Rpvms_onetrustassessmentsrpvms_ephi | undefined): YesNoNA | undefined {
  return lookup(OTEphiMap, v as string | undefined) as YesNoNA | undefined;
}
export function readOTSystemAccess(v: Rpvms_onetrustassessmentsrpvms_systemaccess | undefined): SystemAccessLevel | undefined {
  return lookup(OTSystemAccessMap, v as string | undefined) as SystemAccessLevel | undefined;
}
export function readSNAssessmentType(v: Rpvms_servicenowassessmentsrpvms_assessmenttype): ServiceNowAssessmentType {
  return lookup(SNAssessmentTypeMap, String(v)) as ServiceNowAssessmentType;
}
export function readSNCriticality(v: Rpvms_servicenowassessmentsrpvms_criticalitylevel | undefined): CriticalityLevel | undefined {
  return levelStringToNumber(lookup(SNCriticalityMap, v as string | undefined));
}
export function writeSNCriticality(level: CriticalityLevel | undefined): Rpvms_servicenowassessmentsrpvms_criticalitylevel | undefined {
  if (!level) return undefined;
  const str = levelNumberToString(level);
  return reverseLookup(SNCriticalityMap, str) as Rpvms_servicenowassessmentsrpvms_criticalitylevel | undefined;
}
export function readSNBudgeted(v: Rpvms_servicenowassessmentsrpvms_isbudgeted | undefined): YesNoNA | undefined {
  return lookup(SNBudgetedMap, v as string | undefined) as YesNoNA | undefined;
}

function levelStringToNumber(v: string | undefined): CriticalityLevel | undefined {
  switch (v) {
    case '_1_Negligible':
      return 1;
    case '_2_Low':
      return 2;
    case '_3_Noticeable':
      return 3;
    case '_4_Considerable':
      return 4;
    case '_5_Catastrophic':
      return 5;
    default:
      return undefined;
  }
}

function levelNumberToString(level: CriticalityLevel): string {
  return (['_1_Negligible', '_2_Low', '_3_Noticeable', '_4_Considerable', '_5_Catastrophic'] as const)[level - 1];
}

// ---- Budget / RateCard / VendorSupplier ----
export function readQuintileRating(v: Rpvms_vendorbudgetsrpvms_quintilerating | undefined): QuintileRating | undefined {
  const s = lookup(QuintileRatingMap, v as string | undefined);
  if (!s) return undefined;
  if (s.startsWith('Q1')) return 'Q1';
  if (s.startsWith('Q2')) return 'Q2';
  if (s.startsWith('Q3')) return 'Q3';
  if (s.startsWith('Q4')) return 'Q4';
  if (s.startsWith('Q5')) return 'Q5';
  return undefined;
}
export function readRateCardExperience(v: Rpvms_vendorratecardsrpvms_experiencelevel | undefined): RateCardExperienceLevel | undefined {
  return lookup(RateCardExpMap, v as string | undefined) as RateCardExperienceLevel | undefined;
}
export function readRateCardLocation(v: Rpvms_vendorratecardsrpvms_locationtype | undefined): RateCardLocationType | undefined {
  return lookup(RateCardLocationMap, v as string | undefined) as RateCardLocationType | undefined;
}
export function readRelationshipType(v: Rpvms_vendorsuppliersrpvms_relationshiptype): RelationshipType {
  return lookup(VendorSupplierRelMap, String(v)) as RelationshipType;
}

/** Safely parse a Dataverse decimal-as-string field to a number. */
export function parseDecimal(v: string | undefined | null): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
