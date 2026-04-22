// Domain model types for the VendIQ Vendor Management app.
// These are UI-facing shapes, adapted from the generated Dataverse models
// in src/generated/** by the repository adapters in src/services/vendiq/**.

export type VendorClassification =
  | 'Clinical'
  | 'ProfessionalServices'
  | 'ITInfrastructure'
  | 'Security'
  | 'Telecom'
  | 'Staffing'
  | 'Other';

export type VendorStatus =
  | 'Active'
  | 'Inactive'
  | 'Onboarding'
  | 'Offboarded'
  | 'UnderReview';

export type CommercialRole =
  | 'Vendor'
  | 'Reseller'
  | 'VAR'
  | 'Distributor'
  | 'Hybrid';

export type YesNoNA = 'Yes' | 'No' | 'N_A' | 'Unknown';

/** 1 → Negligible, 5 → Catastrophic. */
export type CriticalityLevel = 1 | 2 | 3 | 4 | 5;

export type QuintileRating = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5';

export type ContractStatus =
  | 'Active'
  | 'Expired'
  | 'Terminated'
  | 'Pending'
  | 'UnderReview'
  | 'Unknown';

export type ContractType =
  | 'MasterServicesAgreement'
  | 'StatementofWork'
  | 'OrderForm'
  | 'LicenseAgreement'
  | 'NDA'
  | 'Amendment'
  | 'BAA'
  | 'Other';

export type PaymentStatus =
  | 'Paid'
  | 'Unpaid'
  | 'Partial'
  | 'Pending'
  | 'Voided';

export type GLTransactionStatus =
  | 'Posted'
  | 'Unposted'
  | 'InProcess'
  | 'Reversed';

export type RelationshipType = 'Direct' | 'VAR_Reseller' | 'Subcontractor';

export type TINType = 'EIN' | 'SSN' | 'ITIN' | 'Foreign' | 'Unknown';

export type SystemAccessLevel =
  | 'None'
  | 'Read'
  | 'Read_Write'
  | 'Admin'
  | 'Unknown';

export type ServiceNowAssessmentType = 'Criticality' | 'Performance';

export type RateCardExperienceLevel =
  | 'Junior'
  | 'Mid'
  | 'Senior'
  | 'Expert'
  | 'Unknown';

export type RateCardLocationType =
  | 'Onshore'
  | 'Offshore'
  | 'Nearshore'
  | 'Hybrid'
  | 'Remote';

// ---------- Entities ----------

export interface Vendor {
  id: string;
  vendorName: string;
  categoryL1?: string;
  categoryL2?: string;
  commercialRole?: CommercialRole;
  classification?: VendorClassification;
  primaryOffering?: string;
  status?: VendorStatus;
  activePhiAccess?: YesNoNA;
  isVar?: boolean;
  ownerName?: string;
  createdOn?: string;
  modifiedOn?: string;
  /** Derived display name for the active/inactive state. */
  stateName?: string;
}

export interface Supplier {
  id: string;
  supplierName: string;
  supplierCategory?: string;
  taxId?: string;
  tinType?: TINType;
  isReseller?: boolean;
}

export interface VendorSupplier {
  id: string;
  vendorId: string;
  supplierId: string;
  vendorName?: string;
  supplierName?: string;
  relationshipType: RelationshipType;
  productsServicesCovered?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface Contract {
  id: string;
  documentId: string;
  contractName: string;
  matterId?: string;
  matterShortName?: string;
  matterFullName?: string;
  contractingEntityName?: string;
  practiceName?: string;
  contractType?: ContractType;
  subContractType?: string;
  contractStatus?: ContractStatus;
  dateSigned?: string;
  effectiveDate?: string;
  expirationDate?: string;
  noticeDate?: string;
  autoRenew?: YesNoNA;
  autoRenewalDetails?: string;
  amended?: YesNoNA;
  terminationWithoutCause?: YesNoNA;
  terminationNoticeDetail?: string;
  otherSignificantTerms?: string;
  supplierId?: string;
  supplierName?: string;
}

export interface ContractParty {
  id: string;
  contractId: string;
  contractName?: string;
  partyName: string;
  partySlot: 'Other1' | 'Other2' | 'Other3';
  partyTargetType: 'Vendor' | 'Supplier';
  vendorId?: string;
  vendorName?: string;
  supplierId?: string;
  supplierName?: string;
}

export interface GLTransaction {
  id: string;
  workdayId: string;
  journalLine: string;
  fiscalYear: string;
  supplierId?: string;
  supplierName?: string;
  supplierNameRaw?: string;
  accountingDate?: string;
  postedDate?: string;
  fiscalPeriodEndDate?: string;
  journalNumber?: string;
  journalSource?: string;
  status?: GLTransactionStatus;
  paymentStatus?: PaymentStatus;
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string;
  ledgerAccount?: string;
  accountName?: string;
  debitAmount?: number;
  creditAmount?: number;
  netAmount?: number;
  unpaidAmount?: number;
  currency?: string;
  company?: string;
  costCenter?: string;
  localPracticeName?: string;
  divisionName?: string;
  spendCategory?: string;
  lineMemo?: string;
  headerMemo?: string;
}

export interface VendorScore {
  id: string;
  vendorId: string;
  vendorName?: string;
  scoreYear: string;
  criticalityScore?: number;
  dependencyScore?: number;
  spendScore?: number;
  valueScore?: number;
  alignmentScore?: number;
  weightedScore?: number;
  wtScoreCritDepOnly?: number;
  topSpendCostCenter?: string;
  comment?: string;
  status?: VendorStatus;
}

export interface VendorBudget {
  id: string;
  vendorId: string;
  vendorName?: string;
  budgetYear: string;
  supplierSpend?: number;
  pctOfTotalSpend?: number;
  rating?: string;
  quintileRating?: QuintileRating;
  description?: string;
}

export interface VendorRateCard {
  id: string;
  vendorId: string;
  vendorName?: string;
  rateCardYear?: string;
  positionCategory?: string;
  normalizedPosition?: string;
  originalPosition?: string;
  experienceLevel?: RateCardExperienceLevel;
  experienceYears?: number;
  locationType?: RateCardLocationType;
  minRate?: number;
  avgRate?: number;
  maxRate?: number;
  notes?: string;
  demoNotes?: string;
}

export interface VendorProductService {
  id: string;
  vendorId: string;
  vendorName?: string;
  productServiceName: string;
  category?: string;
}

export interface VendorNameAlias {
  id: string;
  vendorId: string;
  vendorName?: string;
  aliasName: string;
  sourceSystem?: string;
  reviewedBy?: string;
  reviewedOn?: string;
}

export interface OneTrustAssessment {
  id: string;
  assessmentName: string;
  vendorId: string;
  vendorName?: string;
  type?: string;
  productService?: string;
  classification?: VendorClassification;
  criticality?: CriticalityLevel;
  ephi?: YesNoNA;
  systemAccess?: SystemAccessLevel;
  integrations?: string;
}

export interface ServiceNowAssessment {
  id: string;
  assessmentName: string;
  snNumber?: string;
  vendorId: string;
  vendorName?: string;
  assessmentType: ServiceNowAssessmentType;
  criticalityLevel?: CriticalityLevel;
  isBudgeted?: YesNoNA;
  budgetedCostCenter?: string;
  impactedCostCenter?: string;
  costCenterCode?: string;
  costCenterName?: string;
  relatedLocalPractice?: string;
  relatedRpDepartment?: string;
  itSponsor?: string;
  productServiceType?: string;
  requestScope?: string;
  vendorRepName?: string;
  vendorRepTitle?: string;
  vendorRepEmail?: string;
  vendorMailingAddress?: string;
  vendorNameRaw?: string;
  perfOverallReliability?: string;
  perfSupportSatisfaction?: string;
  perfContractChangeReq?: string;
  perfIssueHandling?: string;
  createdOn?: string;
  modifiedOn?: string;
}

// ---------- Cross-cutting ----------

export interface PortfolioFilters {
  searchText?: string;
  classifications?: VendorClassification[];
  statuses?: VendorStatus[];
  phiAccess?: YesNoNA[];
  criticalityLevels?: CriticalityLevel[];
  dependencyMin?: number;
  dependencyMax?: number;
  ratings?: QuintileRating[];
  /** Restrict to vendors with at least one active contract. */
  hasActiveContract?: boolean;
  /** Restrict to vendors with a contract expiring in N days. */
  expiringWithinDays?: 30 | 60 | 90;
  fiscalYear?: string;
}

export interface ConnectivityStatus {
  state: 'connected' | 'reconnecting' | 'offline' | 'checking';
  lastCheckedAt?: string;
  latencyMs?: number;
  error?: string;
  connectionIdSuffix?: string;
  environmentId?: string;
}

export interface AdjustCriticalityInput {
  vendorId: string;
  level: CriticalityLevel;
  comment: string;
}

export interface KpiTotals {
  activeVendors: number;
  annualSpendYtd: number;
  expiring90dCount: number;
  criticalAtRiskCount: number;
  fiscalYear: string;
}

export interface ExpirationBucket {
  label: '0-30' | '31-60' | '61-90';
  upperDays: 30 | 60 | 90;
  contracts: ContractWithVendor[];
}

export interface ContractWithVendor extends Contract {
  vendorId?: string;
  vendorName?: string;
  vendorCriticality?: CriticalityLevel;
  annualSpend?: number;
}

export interface TopVendorRow {
  vendorId: string;
  vendorName: string;
  classification?: VendorClassification;
  status?: VendorStatus;
  criticality?: CriticalityLevel;
  dependencyScore?: number;
  quintileRating?: QuintileRating;
  annualSpend?: number;
  nextExpirationDate?: string;
  nextNoticeDate?: string;
}

export interface PromptSuggestion {
  id: string;
  promptText: string;
  category?: string;
  sortOrder?: number;
  isActive?: boolean;
  createdOn?: string;
  modifiedOn?: string;
}
