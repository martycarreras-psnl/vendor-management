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
}

export interface VendorSupplierRepository {
  list(options?: ListOptions): Promise<VendorSupplier[]>;
  listByVendor(vendorId: string): Promise<VendorSupplier[]>;
}

export interface ContractRepository {
  list(options?: ListOptions): Promise<Contract[]>;
  listBySupplier(supplierId: string): Promise<Contract[]>;
  getById(id: string): Promise<Contract | null>;
}

export interface ContractPartyRepository {
  list(options?: ListOptions): Promise<ContractParty[]>;
  listByVendor(vendorId: string): Promise<ContractParty[]>;
  listByContract(contractId: string): Promise<ContractParty[]>;
}

export interface GLTransactionRepository {
  list(options?: ListOptions): Promise<GLTransaction[]>;
  listBySupplier(supplierId: string, options?: ListOptions): Promise<GLTransaction[]>;
  listByFiscalYear(year: string, options?: ListOptions): Promise<GLTransaction[]>;
}

export interface VendorScoreRepository {
  list(options?: ListOptions): Promise<VendorScore[]>;
  listByVendor(vendorId: string): Promise<VendorScore[]>;
  latestByVendor(vendorId: string): Promise<VendorScore | null>;
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
  connectivity: ConnectivityRepository;
  /** Convenience: derive current criticality for a vendor from the latest SN assessment. */
  getVendorCriticality(vendorId: string): Promise<CriticalityLevel | undefined>;
}
