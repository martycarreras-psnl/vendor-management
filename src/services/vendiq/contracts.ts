// Repository contracts for the VendIQ domain.
// The app interacts only with these interfaces; adapters in vendiq-provider.ts
// translate between these and the generated Dataverse services.

import type {
  Vendor,
  Supplier,
  VendorSupplier,
  Contract,
  ContractParty,
  GLTransaction,
  VendorScore,
  VendorBudget,
  VendorRateCard,
  VendorProductService,
  VendorNameAlias,
  OneTrustAssessment,
  ServiceNowAssessment,
  ConnectivityStatus,
  AdjustCriticalityInput,
  CriticalityLevel,
  PromptSuggestion,
  Reviewer,
  VPVendorAssignment,
  ScoreStatus,
} from '@/types/vendiq';

export interface ListOptions {
  top?: number;
  /** OData $filter expression. Callers should prefer using helper builders. */
  filter?: string;
  orderBy?: string[];
  select?: string[];
}

export interface VendorRepository {
  list(options?: ListOptions): Promise<Vendor[]>;
  getById(id: string): Promise<Vendor | null>;
  update(id: string, input: Partial<Vendor>): Promise<Vendor>;
}

export interface SupplierRepository {
  list(options?: ListOptions): Promise<Supplier[]>;
  getById(id: string): Promise<Supplier | null>;
  update(id: string, input: Partial<Supplier>): Promise<Supplier>;
}

export interface VendorSupplierRepository {
  list(options?: ListOptions): Promise<VendorSupplier[]>;
  listByVendor(vendorId: string): Promise<VendorSupplier[]>;
  listBySupplier(supplierId: string): Promise<VendorSupplier[]>;
}

export interface ContractRepository {
  list(options?: ListOptions): Promise<Contract[]>;
  listBySupplier(supplierId: string): Promise<Contract[]>;
  getById(id: string): Promise<Contract | null>;
  update(id: string, input: Partial<Contract>): Promise<Contract>;
}

export interface ContractPartyRepository {
  list(options?: ListOptions): Promise<ContractParty[]>;
  listByVendor(vendorId: string): Promise<ContractParty[]>;
  listBySupplier(supplierId: string): Promise<ContractParty[]>;
  listByContract(contractId: string): Promise<ContractParty[]>;
}

export interface GLTransactionRepository {
  list(options?: ListOptions): Promise<GLTransaction[]>;
  listBySupplier(supplierId: string, options?: ListOptions): Promise<GLTransaction[]>;
  listByFiscalYear(year: string, options?: ListOptions): Promise<GLTransaction[]>;
}

export interface VendorScoreCreateInput {
  vendorId: string;
  scoreYear: string | number;
  criticalityScore?: number;
  dependencyScore?: number;
  spendScore?: number;
  valueScore?: number;
  alignmentScore?: number;
  topSpendCostCenter?: string;
  comment?: string;
  reviewStatus?: ScoreStatus;
}

export type VendorScorePatch = Partial<Omit<VendorScoreCreateInput, 'vendorId' | 'scoreYear'>>;

export interface VendorScoreRepository {
  list(options?: ListOptions): Promise<VendorScore[]>;
  listByVendor(vendorId: string): Promise<VendorScore[]>;
  latestByVendor(vendorId: string): Promise<VendorScore | null>;
  /** Fetch a specific (vendor, year) score, or null when none exists yet. */
  getByVendorAndYear(vendorId: string, scoreYear: string | number): Promise<VendorScore | null>;
  create(input: VendorScoreCreateInput): Promise<VendorScore>;
  update(id: string, patch: VendorScorePatch): Promise<VendorScore>;
  /** Set review status (lifecycle transition). Optional `note` is appended to `comment`. */
  setStatus(id: string, status: ScoreStatus, note?: string): Promise<VendorScore>;
}

export interface ReviewerRepository {
  /** Resolve the signed-in user via WhoAmI → systemuser. */
  getCurrent(): Promise<Reviewer | null>;
  /** All systemusers that have at least one active assignment row (for admin switcher). */
  list(): Promise<Reviewer[]>;
  getById(id: string): Promise<Reviewer | null>;
}

export interface AssignmentRepository {
  list(options?: ListOptions): Promise<VPVendorAssignment[]>;
  /** Active assignments for a reviewer in a given cycle year. */
  listForReviewer(reviewerId: string, cycleYear: number): Promise<VPVendorAssignment[]>;
  /** Active assignments for a vendor in a given cycle year (used by admin to see current owners). */
  listForVendor(vendorId: string, cycleYear: number): Promise<VPVendorAssignment[]>;
  /** Bulk create assignments. Skips duplicates by (Reviewer, Vendor, CycleYear). */
  assignVendors(input: {
    reviewerId: string;
    vendorIds: string[];
    cycleYear: number;
    reviewDueDate?: string;
    assignedById?: string;
    notes?: string;
  }): Promise<VPVendorAssignment[]>;
  /** Soft-deactivate an assignment (sets isActive=false). */
  deactivate(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface VendorBudgetRepository {
  list(options?: ListOptions): Promise<VendorBudget[]>;
  listByVendor(vendorId: string): Promise<VendorBudget[]>;
  listByYear(year: string): Promise<VendorBudget[]>;
}

export interface VendorRateCardRepository {
  listByVendor(vendorId: string): Promise<VendorRateCard[]>;
}

export interface VendorProductServiceRepository {
  listByVendor(vendorId: string): Promise<VendorProductService[]>;
}

export interface VendorNameAliasRepository {
  list(options?: ListOptions): Promise<VendorNameAlias[]>;
  listByVendor(vendorId: string): Promise<VendorNameAlias[]>;
}

export interface OneTrustAssessmentRepository {
  listByVendor(vendorId: string): Promise<OneTrustAssessment[]>;
  create(input: Partial<OneTrustAssessment> & { vendorId: string; assessmentName: string }): Promise<OneTrustAssessment>;
  update(id: string, input: Partial<OneTrustAssessment>): Promise<OneTrustAssessment>;
}

export interface ServiceNowAssessmentRepository {
  list(options?: ListOptions): Promise<ServiceNowAssessment[]>;
  listByVendor(vendorId: string): Promise<ServiceNowAssessment[]>;
  latestCriticalityByVendor(vendorId: string): Promise<ServiceNowAssessment | null>;
  create(input: Partial<ServiceNowAssessment> & { vendorId: string; assessmentName: string }): Promise<ServiceNowAssessment>;
  update(id: string, input: Partial<ServiceNowAssessment>): Promise<ServiceNowAssessment>;
  /** Adjust criticality: updates the latest criticality assessment, or creates one. */
  adjustCriticality(input: AdjustCriticalityInput): Promise<ServiceNowAssessment>;
}

export interface ConnectivityRepository {
  probe(): Promise<ConnectivityStatus>;
}

export interface VendIqDataProvider {
  vendors: VendorRepository;
  suppliers: SupplierRepository;
  vendorSuppliers: VendorSupplierRepository;
  contracts: ContractRepository;
  contractParties: ContractPartyRepository;
  glTransactions: GLTransactionRepository;
  vendorScores: VendorScoreRepository;
  vendorBudgets: VendorBudgetRepository;
  vendorRateCards: VendorRateCardRepository;
  vendorProductServices: VendorProductServiceRepository;
  vendorNameAliases: VendorNameAliasRepository;
  oneTrustAssessments: OneTrustAssessmentRepository;
  serviceNowAssessments: ServiceNowAssessmentRepository;
  promptSuggestions: PromptSuggestionRepository;
  reviewers: ReviewerRepository;
  assignments: AssignmentRepository;
  connectivity: ConnectivityRepository;
  /** Convenience: derive current criticality for a vendor from the latest SN assessment. */
  getVendorCriticality(vendorId: string): Promise<CriticalityLevel | undefined>;
}

export interface PromptSuggestionRepository {
  list(options?: ListOptions): Promise<PromptSuggestion[]>;
  listActive(): Promise<PromptSuggestion[]>;
  getById(id: string): Promise<PromptSuggestion | null>;
  create(input: { promptText: string; category?: string; sortOrder?: number; isActive?: boolean }): Promise<PromptSuggestion>;
  update(id: string, input: Partial<PromptSuggestion>): Promise<PromptSuggestion>;
  remove(id: string): Promise<void>;
}
