// Dataverse-backed implementation of VendIqDataProvider.
// All interactions with src/generated/** are isolated here.

import { Rpvms_vendorsService } from '@/generated/services/Rpvms_vendorsService';
import { Rpvms_suppliersService } from '@/generated/services/Rpvms_suppliersService';
import { Rpvms_vendorsuppliersService } from '@/generated/services/Rpvms_vendorsuppliersService';
import { Rpvms_contractsService } from '@/generated/services/Rpvms_contractsService';
import { Rpvms_contractpartiesService } from '@/generated/services/Rpvms_contractpartiesService';
import { Rpvms_gltransactionsService } from '@/generated/services/Rpvms_gltransactionsService';
import { Rpvms_vendorscoresService } from '@/generated/services/Rpvms_vendorscoresService';
import { Rpvms_vendorbudgetsService } from '@/generated/services/Rpvms_vendorbudgetsService';
import { Rpvms_vendorratecardsService } from '@/generated/services/Rpvms_vendorratecardsService';
import { Rpvms_vendorproductservicesService } from '@/generated/services/Rpvms_vendorproductservicesService';
import { Rpvms_vendornamealiasesService } from '@/generated/services/Rpvms_vendornamealiasesService';
import { Rpvms_onetrustassessmentsService } from '@/generated/services/Rpvms_onetrustassessmentsService';
import { Rpvms_servicenowassessmentsService } from '@/generated/services/Rpvms_servicenowassessmentsService';
import { Rpvms_promptsuggestionsService } from '@/generated/services/Rpvms_promptsuggestionsService';
import { Rpvms_vpvendorassignmentsService } from '@/generated/services/Rpvms_vpvendorassignmentsService';
import { SystemusersService } from '@/generated/services/SystemusersService';
import { Office365UsersService } from '@/generated/services/Office365UsersService';

import type { Rpvms_vendors } from '@/generated/models/Rpvms_vendorsModel';
import type { Rpvms_suppliers } from '@/generated/models/Rpvms_suppliersModel';
import type { Rpvms_vendorsuppliers } from '@/generated/models/Rpvms_vendorsuppliersModel';
import type { Rpvms_contracts } from '@/generated/models/Rpvms_contractsModel';
import type { Rpvms_contractparties } from '@/generated/models/Rpvms_contractpartiesModel';
import type { Rpvms_gltransactions } from '@/generated/models/Rpvms_gltransactionsModel';
import type { Rpvms_vendorscores } from '@/generated/models/Rpvms_vendorscoresModel';
import type { Rpvms_vendorbudgets } from '@/generated/models/Rpvms_vendorbudgetsModel';
import type { Rpvms_vendorratecards } from '@/generated/models/Rpvms_vendorratecardsModel';
import type { Rpvms_vendorproductservices } from '@/generated/models/Rpvms_vendorproductservicesModel';
import type { Rpvms_vendornamealiases } from '@/generated/models/Rpvms_vendornamealiasesModel';
import type { Rpvms_onetrustassessments } from '@/generated/models/Rpvms_onetrustassessmentsModel';
import type { Rpvms_servicenowassessments } from '@/generated/models/Rpvms_servicenowassessmentsModel';
import type { Rpvms_promptsuggestions } from '@/generated/models/Rpvms_promptsuggestionsModel';
import type { Rpvms_vpvendorassignments, Rpvms_vpvendorassignmentsrpvms_isactive } from '@/generated/models/Rpvms_vpvendorassignmentsModel';
import type { Systemusers } from '@/generated/models/SystemusersModel';

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
  ReviewQueueItem,
  ScoreStatus,
} from '@/types/vendiq';

import type {
  ListOptions,
  VendIqDataProvider,
  VendorScoreCreateInput,
  VendorScorePatch,
  AssignmentStatusCounts,
} from '@/services/vendiq/contracts';
import {
  parseDecimal,
  readCommercialRole,
  readContractStatus,
  readContractType,
  readGLStatus,
  readIsReseller,
  readIsVar,
  readOTClassification,
  readOTCriticality,
  readOTEphi,
  readOTSystemAccess,
  readPaymentStatus,
  readQuintileRating,
  readRateCardExperience,
  readRateCardLocation,
  readRelationshipType,
  readSNAssessmentType,
  readSNBudgeted,
  readSNCriticality,
  readTinType,
  readVendorClassification,
  readVendorPhi,
  readVendorStatus,
  readYesNoNA,
  writeContractStatus,
  writeContractType,
  writeCommercialRole,
  writeIsReseller,
  writeIsVar,
  writeSNCriticality,
  writeTinType,
  writeVendorClassification,
  writeVendorPhi,
  writeVendorStatus,
  writeYesNoNA,
  readScoreStatus,
  writeScoreStatus,
  readAssignmentIsActive,
} from '@/services/vendiq/option-sets';

// ---- Mapping helpers ----

function mapVendor(r: Rpvms_vendors): Vendor {
  return {
    id: r.rpvms_vendorid,
    vendorName: r.rpvms_vendorname,
    categoryL1: r.rpvms_categoryl1,
    categoryL2: r.rpvms_categoryl2,
    commercialRole: readCommercialRole(r.rpvms_commercialrole),
    classification: readVendorClassification(r.rpvms_classification),
    primaryOffering: r.rpvms_primaryoffering,
    status: readVendorStatus(r.rpvms_status),
    activePhiAccess: readVendorPhi(r.rpvms_activephiaccess),
    isVar: readIsVar(r.rpvms_isvar),
    ownerName: r.owneridname,
    createdOn: r.createdon,
    modifiedOn: r.modifiedon,
    stateName: r.statecodename,
  };
}

function mapSupplier(r: Rpvms_suppliers): Supplier {
  return {
    id: r.rpvms_supplierid,
    supplierName: r.rpvms_suppliername,
    supplierCategory: r.rpvms_suppliercategory,
    taxId: r.rpvms_taxid,
    tinType: readTinType(r.rpvms_tintype),
    isReseller: readIsReseller(r.rpvms_isreseller as string | undefined),
  };
}

function mapVendorSupplier(r: Rpvms_vendorsuppliers): VendorSupplier {
  return {
    id: r.rpvms_vendorsupplierid,
    vendorId: r._rpvms_vendorid_value ?? '',
    supplierId: r._rpvms_supplierid_value ?? '',
    vendorName: r.rpvms_vendoridname,
    supplierName: r.rpvms_supplieridname,
    relationshipType: readRelationshipType(r.rpvms_relationshiptype),
    productsServicesCovered: r.rpvms_productsservicescovered,
    effectiveFrom: r.rpvms_effectivefrom,
    effectiveTo: r.rpvms_effectiveto,
  };
}

function mapContract(r: Rpvms_contracts): Contract {
  return {
    id: r.rpvms_contractid,
    documentId: r.rpvms_documentid,
    contractName: r.rpvms_contractname,
    matterId: r.rpvms_matterid,
    matterShortName: r.rpvms_mattershortname,
    matterFullName: r.rpvms_matterfullname,
    contractingEntityName: r.rpvms_contractingentityname,
    practiceName: r.rpvms_practicename,
    contractType: readContractType(r.rpvms_contracttype),
    subContractType: r.rpvms_subcontracttype,
    contractStatus: readContractStatus(r.rpvms_contractstatus),
    dateSigned: r.rpvms_datesigned,
    effectiveDate: r.rpvms_effectivedate,
    expirationDate: r.rpvms_expirationdate,
    noticeDate: r.rpvms_noticedate,
    autoRenew: readYesNoNA(r.rpvms_autorenew as string | undefined),
    autoRenewalDetails: r.rpvms_autorenewaldetails,
    amended: readYesNoNA(r.rpvms_amended as string | undefined),
    terminationWithoutCause: readYesNoNA(r.rpvms_terminationwithoutcause as string | undefined),
    terminationNoticeDetail: r.rpvms_terminationnoticedetail,
    otherSignificantTerms: r.rpvms_othersignificantterms,
    supplierId: r._rpvms_supplierid_value,
    supplierName: r.rpvms_supplieridname,
  };
}

function mapContractParty(r: Rpvms_contractparties): ContractParty {
  return {
    id: r.rpvms_contractpartyid,
    contractId: r._rpvms_contractid_value ?? '',
    contractName: r.rpvms_contractidname,
    partyName: r.rpvms_partyname,
    partySlot: (r.rpvms_partyslotname as 'Other1' | 'Other2' | 'Other3') ?? 'Other1',
    partyTargetType: (r.rpvms_partytargettypename as 'Vendor' | 'Supplier') ?? 'Vendor',
    vendorId: r._rpvms_vendorid_value,
    vendorName: r.rpvms_vendoridname,
    supplierId: r._rpvms_supplierid_value,
    supplierName: r.rpvms_supplieridname,
  };
}

function mapGL(r: Rpvms_gltransactions): GLTransaction {
  return {
    id: r.rpvms_gltransactionid,
    workdayId: r.rpvms_workdayid,
    journalLine: r.rpvms_journalline,
    fiscalYear: r.rpvms_fiscalyear,
    supplierId: r._rpvms_supplierid_value,
    supplierName: r.rpvms_supplieridname,
    supplierNameRaw: r.rpvms_suppliernameraw,
    accountingDate: r.rpvms_accountingdate,
    postedDate: r.rpvms_posteddate,
    fiscalPeriodEndDate: r.rpvms_fiscalperiodenddate,
    journalNumber: r.rpvms_journalnumber,
    journalSource: r.rpvms_journalsource,
    status: readGLStatus(r.rpvms_status),
    paymentStatus: readPaymentStatus(r.rpvms_paymentstatus),
    supplierInvoiceNumber: r.rpvms_supplierinvoicenumber,
    supplierInvoiceDate: r.rpvms_supplierinvoicedate,
    ledgerAccount: r.rpvms_ledgeraccount,
    accountName: r.rpvms_accountname,
    debitAmount: parseDecimal(r.rpvms_debitamount as string | undefined),
    creditAmount: parseDecimal(r.rpvms_creditamount as string | undefined),
    netAmount: parseDecimal(r.rpvms_netamount as string | undefined),
    unpaidAmount: parseDecimal(r.rpvms_unpaidamount as string | undefined),
    currency: r.rpvms_currency,
    company: r.rpvms_company,
    costCenter: r.rpvms_costcenter,
    localPracticeName: r.rpvms_localpracticename,
    divisionName: r.rpvms_divisionname,
    spendCategory: r.rpvms_spendcategory,
    lineMemo: r.rpvms_linememo,
    headerMemo: r.rpvms_headermemo,
  };
}

function mapVendorScore(r: Rpvms_vendorscores): VendorScore {
  return {
    id: r.rpvms_vendorscoreid,
    vendorId: r._rpvms_vendorid_value ?? '',
    vendorName: r.rpvms_vendoridname,
    scoreYear: r.rpvms_scoreyear == null ? '' : String(r.rpvms_scoreyear),
    criticalityScore: parseDecimal(r.rpvms_criticalityscore as string | undefined),
    dependencyScore: parseDecimal(r.rpvms_dependencyscore as string | undefined),
    spendScore: parseDecimal(r.rpvms_spendscore as string | undefined),
    valueScore: parseDecimal(r.rpvms_valuescore as string | undefined),
    alignmentScore: parseDecimal(r.rpvms_alignmentscore as string | undefined),
    weightedScore: parseDecimal(r.rpvms_weightedscore as string | undefined),
    wtScoreCritDepOnly: parseDecimal(r.rpvms_wtscorecritdeponly as string | undefined),
    topSpendCostCenter: r.rpvms_topspendcostcenter == null ? undefined : String(r.rpvms_topspendcostcenter),
    comment: r.rpvms_comment,
    status: readVendorStatus(r.rpvms_status),
    reviewStatus: readScoreStatus(r.rpvms_reviewstatus),
    modifiedOn: r.modifiedon,
    modifiedByName: r.modifiedbyname,
  };
}

function mapSystemuser(r: Systemusers): Reviewer {
  return {
    id: r.systemuserid,
    fullName:
      r.fullname ??
      (`${r.firstname ?? ''} ${r.lastname ?? ''}`.trim() || r.internalemailaddress || r.systemuserid),
    email: r.internalemailaddress,
    jobTitle: r.jobtitle,
    isDisabled: r.isdisabled === 1 || (r.isdisabled as unknown) === true,
  };
}

function mapVPVendorAssignment(r: Rpvms_vpvendorassignments): VPVendorAssignment {
  return {
    id: r.rpvms_vpvendorassignmentid,
    assignmentName: r.rpvms_assignmentname,
    reviewerId: r._rpvms_reviewer_value ?? '',
    reviewerName: r.rpvms_reviewername,
    vendorId: r._rpvms_vendorid_value ?? '',
    vendorName: r.rpvms_vendoridname,
    cycleYear: r.rpvms_cycleyear == null ? 0 : Number(r.rpvms_cycleyear),
    reviewDueDate: r.rpvms_reviewduedate,
    isActive: readAssignmentIsActive(r.rpvms_isactive) ?? false,
    assignedById: r._rpvms_assignedby_value,
    assignedByName: r.rpvms_assignedbyname,
    notes: r.rpvms_notes,
  };
}

function mapVendorBudget(r: Rpvms_vendorbudgets): VendorBudget {
  return {
    id: r.rpvms_vendorbudgetid,
    vendorId: r._rpvms_vendorid_value ?? '',
    vendorName: r.rpvms_vendoridname,
    budgetYear: r.rpvms_budgetyear == null ? '' : String(r.rpvms_budgetyear),
    supplierSpend: parseDecimal(r.rpvms_supplierspend as string | undefined),
    pctOfTotalSpend: parseDecimal(r.rpvms_pctoftotalspend as string | undefined),
    rating: r.rpvms_rating,
    quintileRating: readQuintileRating(r.rpvms_quintilerating),
    description: r.rpvms_description,
  };
}

function mapVendorRateCard(r: Rpvms_vendorratecards): VendorRateCard {
  return {
    id: r.rpvms_vendorratecardid,
    vendorId: r._rpvms_vendorid_value ?? '',
    vendorName: r.rpvms_vendoridname,
    rateCardYear: r.rpvms_ratecardyear,
    positionCategory: r.rpvms_positioncategory,
    normalizedPosition: r.rpvms_normalizedposition,
    originalPosition: r.rpvms_originalposition,
    experienceLevel: readRateCardExperience(r.rpvms_experiencelevel),
    experienceYears: parseDecimal(r.rpvms_experienceyears as string | undefined),
    locationType: readRateCardLocation(r.rpvms_locationtype),
    minRate: parseDecimal(r.rpvms_minrate as string | undefined),
    avgRate: parseDecimal(r.rpvms_avgrate as string | undefined),
    maxRate: parseDecimal(r.rpvms_maxrate as string | undefined),
    notes: r.rpvms_notes,
    demoNotes: r.rpvms_demonotes,
  };
}

function mapVendorProductService(r: Rpvms_vendorproductservices): VendorProductService {
  return {
    id: r.rpvms_vendorproductserviceid,
    vendorId: r._rpvms_vendorid_value ?? '',
    vendorName: r.rpvms_vendoridname,
    productServiceName: r.rpvms_vendorproductservicename,
    category: r.rpvms_category,
  };
}

function mapVendorNameAlias(r: Rpvms_vendornamealiases): VendorNameAlias {
  return {
    id: r.rpvms_vendornamealiasid,
    vendorId: r._rpvms_vendorid_value ?? '',
    vendorName: r.rpvms_vendoridname,
    aliasName: r.rpvms_vendornamealiasname,
    sourceSystem: r.rpvms_sourcesystem,
    reviewedBy: r.rpvms_reviewedby,
    reviewedOn: r.rpvms_reviewedon,
  };
}

function mapOT(r: Rpvms_onetrustassessments): OneTrustAssessment {
  return {
    id: r.rpvms_onetrustassessmentid,
    assessmentName: r.rpvms_onetrustassessmentname,
    vendorId: r._rpvms_vendorid_value ?? '',
    vendorName: r.rpvms_vendoridname,
    type: r.rpvms_type,
    productService: r.rpvms_productservice,
    classification: readOTClassification(r.rpvms_classification),
    criticality: readOTCriticality(r.rpvms_criticality),
    ephi: readOTEphi(r.rpvms_ephi),
    systemAccess: readOTSystemAccess(r.rpvms_systemaccess),
    integrations: r.rpvms_integrations,
  };
}

function mapSN(r: Rpvms_servicenowassessments): ServiceNowAssessment {
  return {
    id: r.rpvms_servicenowassessmentid,
    assessmentName: r.rpvms_servicenowassessmentname,
    snNumber: r.rpvms_snnumber1,
    vendorId: r._rpvms_vendorid_value ?? '',
    vendorName: r.rpvms_vendoridname,
    assessmentType: readSNAssessmentType(r.rpvms_assessmenttype),
    criticalityLevel: readSNCriticality(r.rpvms_criticalitylevel),
    isBudgeted: readSNBudgeted(r.rpvms_isbudgeted),
    budgetedCostCenter: r.rpvms_budgetedcostcenter,
    impactedCostCenter: r.rpvms_impactedcostcenter,
    costCenterCode: r.rpvms_costcentercode,
    costCenterName: r.rpvms_costcentername,
    relatedLocalPractice: r.rpvms_relatedlocalpractice,
    relatedRpDepartment: r.rpvms_relatedrpdepartment,
    itSponsor: r.rpvms_itsponsor,
    productServiceType: r.rpvms_productservicetype,
    requestScope: r.rpvms_requestscope,
    vendorRepName: r.rpvms_vendorrepname,
    vendorRepTitle: r.rpvms_vendorreptitle,
    vendorRepEmail: r.rpvms_vendorrepemail,
    vendorMailingAddress: r.rpvms_vendormailingaddress,
    vendorNameRaw: r.rpvms_vendornameraw,
    perfOverallReliability: r.rpvms_perfoverallreliability,
    perfSupportSatisfaction: r.rpvms_perfsupportsatisfaction,
    perfContractChangeReq: r.rpvms_perfcontractchangereq,
    perfIssueHandling: r.rpvms_perfissuehandling,
    createdOn: r.createdon,
    modifiedOn: r.modifiedon,
  };
}

function mapPromptSuggestion(r: Rpvms_promptsuggestions): PromptSuggestion {
  return {
    id: r.rpvms_promptsuggestionid,
    promptText: r.rpvms_prompttext,
    category: r.rpvms_category,
    sortOrder: r.rpvms_sortorder != null ? Number(r.rpvms_sortorder) : undefined,
    isActive: r.rpvms_isactive === 1 || (r.rpvms_isactive as unknown) === true,
    createdOn: r.createdon,
    modifiedOn: r.modifiedon,
  };
}

// Dataverse @odata.bind format: "/rpvms_vendors(<guid>)".
function vendorBind(id: string): string {
  return `/rpvms_vendors(${id})`;
}

function systemuserBind(id: string): string {
  return `/systemusers(${id})`;
}

// Basic OData $filter escaping for user-supplied strings.
export function escapeOData(value: string): string {
  return value.replace(/'/g, "''");
}

function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.error) {
    throw new Error(typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
  }
  return result.data as T;
}

function toIGetAllOptions(options?: ListOptions) {
  return {
    top: options?.top,
    filter: options?.filter,
    orderBy: options?.orderBy,
    select: options?.select,
  };
}

// ---- Provider ----

export function createVendiqDataverseProvider(): VendIqDataProvider {
  const vendors = {
    async list(options?: ListOptions): Promise<Vendor[]> {
      const res = unwrap(await Rpvms_vendorsService.getAll(toIGetAllOptions(options))) || [];
      return res.map(mapVendor);
    },
    async getById(id: string): Promise<Vendor | null> {
      try {
        const res = unwrap(await Rpvms_vendorsService.get(id));
        return res ? mapVendor(res) : null;
      } catch {
        return null;
      }
    },
    async update(id: string, input: Partial<Vendor>): Promise<Vendor> {
      const payload: Record<string, unknown> = {};
      if (input.vendorName !== undefined) payload.rpvms_vendorname = input.vendorName;
      if (input.classification !== undefined) payload.rpvms_classification = writeVendorClassification(input.classification);
      if (input.status !== undefined) payload.rpvms_status = writeVendorStatus(input.status);
      if (input.primaryOffering !== undefined) payload.rpvms_primaryoffering = input.primaryOffering;
      if (input.categoryL1 !== undefined) payload.rpvms_categoryl1 = input.categoryL1;
      if (input.categoryL2 !== undefined) payload.rpvms_categoryl2 = input.categoryL2;
      if (input.commercialRole !== undefined) payload.rpvms_commercialrole = writeCommercialRole(input.commercialRole);
      if (input.activePhiAccess !== undefined) payload.rpvms_activephiaccess = writeVendorPhi(input.activePhiAccess);
      if (input.isVar !== undefined) payload.rpvms_isvar = writeIsVar(input.isVar);
      const res = unwrap(await Rpvms_vendorsService.update(id, payload));
      return mapVendor(res);
    },
  };

  const suppliers = {
    async list(options?: ListOptions): Promise<Supplier[]> {
      const res = unwrap(await Rpvms_suppliersService.getAll(toIGetAllOptions(options))) || [];
      return res.map(mapSupplier);
    },
    async getById(id: string): Promise<Supplier | null> {
      try {
        const res = unwrap(await Rpvms_suppliersService.get(id));
        return res ? mapSupplier(res) : null;
      } catch {
        return null;
      }
    },
    async update(id: string, input: Partial<Supplier>): Promise<Supplier> {
      const payload: Record<string, unknown> = {};
      if (input.supplierName !== undefined) payload.rpvms_suppliername = input.supplierName;
      if (input.supplierCategory !== undefined) payload.rpvms_suppliercategory = input.supplierCategory;
      if (input.taxId !== undefined) payload.rpvms_taxid = input.taxId;
      if (input.tinType !== undefined) payload.rpvms_tintype = writeTinType(input.tinType);
      if (input.isReseller !== undefined) payload.rpvms_isreseller = writeIsReseller(input.isReseller);
      const res = unwrap(await Rpvms_suppliersService.update(id, payload as never));
      return mapSupplier(res);
    },
  };

  const vendorSuppliers = {
    async list(options?: ListOptions): Promise<VendorSupplier[]> {
      const res = unwrap(await Rpvms_vendorsuppliersService.getAll(toIGetAllOptions(options))) || [];
      return res.map(mapVendorSupplier);
    },
    async listByVendor(vendorId: string): Promise<VendorSupplier[]> {
      const res = unwrap(
        await Rpvms_vendorsuppliersService.getAll({ filter: `_rpvms_vendorid_value eq ${vendorId}` }),
      ) || [];
      return res.map(mapVendorSupplier);
    },
    async listBySupplier(supplierId: string): Promise<VendorSupplier[]> {
      const res = unwrap(
        await Rpvms_vendorsuppliersService.getAll({ filter: `_rpvms_supplierid_value eq ${supplierId}` }),
      ) || [];
      return res.map(mapVendorSupplier);
    },
  };

  const contracts = {
    async list(options?: ListOptions): Promise<Contract[]> {
      const res = unwrap(await Rpvms_contractsService.getAll(toIGetAllOptions(options))) || [];
      return res.map(mapContract);
    },
    async listBySupplier(supplierId: string): Promise<Contract[]> {
      const res = unwrap(
        await Rpvms_contractsService.getAll({ filter: `_rpvms_supplierid_value eq ${supplierId}` }),
      ) || [];
      return res.map(mapContract);
    },
    async getById(id: string): Promise<Contract | null> {
      try {
        const res = unwrap(await Rpvms_contractsService.get(id));
        return res ? mapContract(res) : null;
      } catch {
        return null;
      }
    },
    async update(id: string, input: Partial<Contract>): Promise<Contract> {
      const payload: Record<string, unknown> = {};
      if (input.contractName !== undefined) payload.rpvms_contractname = input.contractName;
      if (input.documentId !== undefined) payload.rpvms_documentid = input.documentId;
      if (input.matterId !== undefined) payload.rpvms_matterid = input.matterId;
      if (input.matterShortName !== undefined) payload.rpvms_mattershortname = input.matterShortName;
      if (input.matterFullName !== undefined) payload.rpvms_matterfullname = input.matterFullName;
      if (input.contractingEntityName !== undefined) payload.rpvms_contractingentityname = input.contractingEntityName;
      if (input.practiceName !== undefined) payload.rpvms_practicename = input.practiceName;
      if (input.contractType !== undefined) payload.rpvms_contracttype = writeContractType(input.contractType);
      if (input.subContractType !== undefined) payload.rpvms_subcontracttype = input.subContractType;
      if (input.contractStatus !== undefined) payload.rpvms_contractstatus = writeContractStatus(input.contractStatus);
      if (input.dateSigned !== undefined) payload.rpvms_datesigned = input.dateSigned;
      if (input.effectiveDate !== undefined) payload.rpvms_effectivedate = input.effectiveDate;
      if (input.expirationDate !== undefined) payload.rpvms_expirationdate = input.expirationDate;
      if (input.noticeDate !== undefined) payload.rpvms_noticedate = input.noticeDate;
      if (input.autoRenew !== undefined) payload.rpvms_autorenew = writeYesNoNA(input.autoRenew);
      if (input.autoRenewalDetails !== undefined) payload.rpvms_autorenewaldetails = input.autoRenewalDetails;
      if (input.amended !== undefined) payload.rpvms_amended = writeYesNoNA(input.amended);
      if (input.terminationWithoutCause !== undefined) payload.rpvms_terminationwithoutcause = writeYesNoNA(input.terminationWithoutCause);
      if (input.terminationNoticeDetail !== undefined) payload.rpvms_terminationnoticedetail = input.terminationNoticeDetail;
      if (input.otherSignificantTerms !== undefined) payload.rpvms_othersignificantterms = input.otherSignificantTerms;
      const res = unwrap(await Rpvms_contractsService.update(id, payload as never));
      return mapContract(res);
    },
  };

  const contractParties = {
    async list(options?: ListOptions): Promise<ContractParty[]> {
      const res = unwrap(await Rpvms_contractpartiesService.getAll(toIGetAllOptions(options))) || [];
      return res.map(mapContractParty);
    },
    async listByVendor(vendorId: string): Promise<ContractParty[]> {
      const res = unwrap(
        await Rpvms_contractpartiesService.getAll({ filter: `_rpvms_vendorid_value eq ${vendorId}` }),
      ) || [];
      return res.map(mapContractParty);
    },
    async listBySupplier(supplierId: string): Promise<ContractParty[]> {
      const res = unwrap(
        await Rpvms_contractpartiesService.getAll({ filter: `_rpvms_supplierid_value eq ${supplierId}` }),
      ) || [];
      return res.map(mapContractParty);
    },
    async listByContract(contractId: string): Promise<ContractParty[]> {
      const res = unwrap(
        await Rpvms_contractpartiesService.getAll({ filter: `_rpvms_contractid_value eq ${contractId}` }),
      ) || [];
      return res.map(mapContractParty);
    },
  };

  const glTransactions = {
    async list(options?: ListOptions): Promise<GLTransaction[]> {
      const res = unwrap(await Rpvms_gltransactionsService.getAll(toIGetAllOptions(options))) || [];
      return res.map(mapGL);
    },
    async listBySupplier(supplierId: string, options?: ListOptions): Promise<GLTransaction[]> {
      const res = unwrap(
        await Rpvms_gltransactionsService.getAll({
          ...toIGetAllOptions(options),
          filter: `_rpvms_supplierid_value eq ${supplierId}`,
        }),
      ) || [];
      return res.map(mapGL);
    },
    async listByFiscalYear(year: string, options?: ListOptions): Promise<GLTransaction[]> {
      const res = unwrap(
        await Rpvms_gltransactionsService.getAll({
          ...toIGetAllOptions(options),
          filter: `rpvms_fiscalyear eq '${escapeOData(year)}'`,
        }),
      ) || [];
      return res.map(mapGL);
    },
  };

  const vendorScores = {
    async list(options?: ListOptions): Promise<VendorScore[]> {
      const res = unwrap(await Rpvms_vendorscoresService.getAll(toIGetAllOptions(options))) || [];
      return res.map(mapVendorScore);
    },
    async listByVendor(vendorId: string): Promise<VendorScore[]> {
      const res = unwrap(
        await Rpvms_vendorscoresService.getAll({
          filter: `_rpvms_vendorid_value eq ${vendorId}`,
          orderBy: ['rpvms_scoreyear desc'],
        }),
      ) || [];
      return res.map(mapVendorScore);
    },
    async latestByVendor(vendorId: string): Promise<VendorScore | null> {
      const res = unwrap(
        await Rpvms_vendorscoresService.getAll({
          filter: `_rpvms_vendorid_value eq ${vendorId}`,
          orderBy: ['rpvms_scoreyear desc'],
          top: 1,
        }),
      ) || [];
      return res[0] ? mapVendorScore(res[0]) : null;
    },
    async getByVendorAndYear(vendorId: string, scoreYear: string | number): Promise<VendorScore | null> {
      const yr = typeof scoreYear === 'string' ? Number(scoreYear) : scoreYear;
      const res = unwrap(
        await Rpvms_vendorscoresService.getAll({
          filter: `_rpvms_vendorid_value eq ${vendorId} and rpvms_scoreyear eq ${yr}`,
          top: 1,
        }),
      ) || [];
      return res[0] ? mapVendorScore(res[0]) : null;
    },
    async create(input: VendorScoreCreateInput): Promise<VendorScore> {
      const yr = typeof input.scoreYear === 'string' ? Number(input.scoreYear) : input.scoreYear;
      const payload: Record<string, unknown> = {
        rpvms_vendorscorename: `Score ${yr}`,
        rpvms_scoreyear: String(yr),
        'rpvms_VendorId@odata.bind': vendorBind(input.vendorId),
      };
      if (input.criticalityScore !== undefined) payload.rpvms_criticalityscore = String(input.criticalityScore);
      if (input.dependencyScore !== undefined) payload.rpvms_dependencyscore = String(input.dependencyScore);
      if (input.spendScore !== undefined) payload.rpvms_spendscore = String(input.spendScore);
      if (input.valueScore !== undefined) payload.rpvms_valuescore = String(input.valueScore);
      if (input.alignmentScore !== undefined) payload.rpvms_alignmentscore = String(input.alignmentScore);
      if (input.topSpendCostCenter !== undefined) payload.rpvms_topspendcostcenter = input.topSpendCostCenter;
      if (input.comment !== undefined) payload.rpvms_comment = input.comment;
      if (input.reviewStatus !== undefined) payload.rpvms_reviewstatus = writeScoreStatus(input.reviewStatus);
      const res = unwrap(await Rpvms_vendorscoresService.create(payload as never));
      return mapVendorScore(res);
    },
    async update(id: string, patch: VendorScorePatch): Promise<VendorScore> {
      const payload: Record<string, unknown> = {};
      if (patch.criticalityScore !== undefined) payload.rpvms_criticalityscore = String(patch.criticalityScore);
      if (patch.dependencyScore !== undefined) payload.rpvms_dependencyscore = String(patch.dependencyScore);
      if (patch.spendScore !== undefined) payload.rpvms_spendscore = String(patch.spendScore);
      if (patch.valueScore !== undefined) payload.rpvms_valuescore = String(patch.valueScore);
      if (patch.alignmentScore !== undefined) payload.rpvms_alignmentscore = String(patch.alignmentScore);
      if (patch.topSpendCostCenter !== undefined) payload.rpvms_topspendcostcenter = patch.topSpendCostCenter;
      if (patch.comment !== undefined) payload.rpvms_comment = patch.comment;
      if (patch.reviewStatus !== undefined) payload.rpvms_reviewstatus = writeScoreStatus(patch.reviewStatus);
      const res = unwrap(await Rpvms_vendorscoresService.update(id, payload as never));
      return mapVendorScore(res);
    },
    async setStatus(id: string, status: ScoreStatus, note?: string): Promise<VendorScore> {
      const payload: Record<string, unknown> = {
        rpvms_reviewstatus: writeScoreStatus(status),
      };
      if (note !== undefined && note.length > 0) {
        // Append the note to the existing comment with a timestamp prefix.
        const existing = unwrap(await Rpvms_vendorscoresService.get(id));
        const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
        const prev = existing?.rpvms_comment ? `${existing.rpvms_comment}\n` : '';
        payload.rpvms_comment = `${prev}[${stamp} \u2192 ${status}] ${note}`;
      }
      const res = unwrap(await Rpvms_vendorscoresService.update(id, payload as never));
      return mapVendorScore(res);
    },
  };

  const vendorBudgets = {
    async list(options?: ListOptions): Promise<VendorBudget[]> {
      const res = unwrap(await Rpvms_vendorbudgetsService.getAll(toIGetAllOptions(options))) || [];
      return res.map(mapVendorBudget);
    },
    async listByVendor(vendorId: string): Promise<VendorBudget[]> {
      const res = unwrap(
        await Rpvms_vendorbudgetsService.getAll({
          filter: `_rpvms_vendorid_value eq ${vendorId}`,
          orderBy: ['rpvms_budgetyear desc'],
        }),
      ) || [];
      return res.map(mapVendorBudget);
    },
    async listByYear(year: string): Promise<VendorBudget[]> {
      const res = unwrap(
        await Rpvms_vendorbudgetsService.getAll({
          filter: `rpvms_budgetyear eq ${Number(year)}`,
        }),
      ) || [];
      return res.map(mapVendorBudget);
    },
  };

  const vendorRateCards = {
    async listByVendor(vendorId: string): Promise<VendorRateCard[]> {
      const res = unwrap(
        await Rpvms_vendorratecardsService.getAll({ filter: `_rpvms_vendorid_value eq ${vendorId}` }),
      ) || [];
      return res.map(mapVendorRateCard);
    },
  };

  const vendorProductServices = {
    async listByVendor(vendorId: string): Promise<VendorProductService[]> {
      const res = unwrap(
        await Rpvms_vendorproductservicesService.getAll({ filter: `_rpvms_vendorid_value eq ${vendorId}` }),
      ) || [];
      return res.map(mapVendorProductService);
    },
  };

  const vendorNameAliases = {
    async list(options?: ListOptions): Promise<VendorNameAlias[]> {
      const res = unwrap(await Rpvms_vendornamealiasesService.getAll(toIGetAllOptions(options))) || [];
      return res.map(mapVendorNameAlias);
    },
    async listByVendor(vendorId: string): Promise<VendorNameAlias[]> {
      const res = unwrap(
        await Rpvms_vendornamealiasesService.getAll({ filter: `_rpvms_vendorid_value eq ${vendorId}` }),
      ) || [];
      return res.map(mapVendorNameAlias);
    },
  };

  const oneTrustAssessments = {
    async listByVendor(vendorId: string): Promise<OneTrustAssessment[]> {
      const res = unwrap(
        await Rpvms_onetrustassessmentsService.getAll({ filter: `_rpvms_vendorid_value eq ${vendorId}` }),
      ) || [];
      return res.map(mapOT);
    },
    async create(input: Partial<OneTrustAssessment> & { vendorId: string; assessmentName: string }): Promise<OneTrustAssessment> {
      const payload: Record<string, unknown> = {
        rpvms_onetrustassessmentname: input.assessmentName,
        'rpvms_VendorId@odata.bind': vendorBind(input.vendorId),
      };
      if (input.type !== undefined) payload.rpvms_type = input.type;
      if (input.productService !== undefined) payload.rpvms_productservice = input.productService;
      const res = unwrap(await Rpvms_onetrustassessmentsService.create(payload as never));
      return mapOT(res);
    },
    async update(id: string, input: Partial<OneTrustAssessment>): Promise<OneTrustAssessment> {
      const payload: Record<string, unknown> = {};
      if (input.type !== undefined) payload.rpvms_type = input.type;
      if (input.productService !== undefined) payload.rpvms_productservice = input.productService;
      if (input.integrations !== undefined) payload.rpvms_integrations = input.integrations;
      const res = unwrap(await Rpvms_onetrustassessmentsService.update(id, payload as never));
      return mapOT(res);
    },
  };

  const serviceNowAssessments = {
    async list(options?: ListOptions): Promise<ServiceNowAssessment[]> {
      const res = unwrap(await Rpvms_servicenowassessmentsService.getAll(toIGetAllOptions(options))) || [];
      return res.map(mapSN);
    },
    async listByVendor(vendorId: string): Promise<ServiceNowAssessment[]> {
      const res = unwrap(
        await Rpvms_servicenowassessmentsService.getAll({
          filter: `_rpvms_vendorid_value eq ${vendorId}`,
          orderBy: ['modifiedon desc'],
        }),
      ) || [];
      return res.map(mapSN);
    },
    async latestCriticalityByVendor(vendorId: string): Promise<ServiceNowAssessment | null> {
      // rpvms_assessmenttype 412900000 = Criticality.
      const res = unwrap(
        await Rpvms_servicenowassessmentsService.getAll({
          filter: `_rpvms_vendorid_value eq ${vendorId} and rpvms_assessmenttype eq 412900000`,
          orderBy: ['modifiedon desc'],
          top: 1,
        }),
      ) || [];
      return res[0] ? mapSN(res[0]) : null;
    },
    async create(input: Partial<ServiceNowAssessment> & { vendorId: string; assessmentName: string }): Promise<ServiceNowAssessment> {
      const payload: Record<string, unknown> = {
        rpvms_servicenowassessmentname: input.assessmentName,
        'rpvms_VendorId@odata.bind': vendorBind(input.vendorId),
        // Default to Criticality assessment when creating from Adjust Criticality.
        rpvms_assessmenttype: '412900000',
      };
      if (input.criticalityLevel !== undefined) payload.rpvms_criticalitylevel = writeSNCriticality(input.criticalityLevel);
      if (input.snNumber !== undefined) payload.rpvms_snnumber1 = input.snNumber;
      if (input.requestScope !== undefined) payload.rpvms_requestscope = input.requestScope;
      const res = unwrap(await Rpvms_servicenowassessmentsService.create(payload as never));
      return mapSN(res);
    },
    async update(id: string, input: Partial<ServiceNowAssessment>): Promise<ServiceNowAssessment> {
      const payload: Record<string, unknown> = {};
      if (input.criticalityLevel !== undefined) payload.rpvms_criticalitylevel = writeSNCriticality(input.criticalityLevel);
      if (input.requestScope !== undefined) payload.rpvms_requestscope = input.requestScope;
      if (input.itSponsor !== undefined) payload.rpvms_itsponsor = input.itSponsor;
      const res = unwrap(await Rpvms_servicenowassessmentsService.update(id, payload as never));
      return mapSN(res);
    },
    async adjustCriticality(input: AdjustCriticalityInput): Promise<ServiceNowAssessment> {
      const latest = await serviceNowAssessments.latestCriticalityByVendor(input.vendorId);
      if (latest) {
        const updated = await serviceNowAssessments.update(latest.id, {
          criticalityLevel: input.level,
          requestScope: input.comment,
        });
        return updated;
      }
      const created = await serviceNowAssessments.create({
        vendorId: input.vendorId,
        assessmentName: `Criticality Adjustment ${new Date().toISOString().slice(0, 10)}`,
        assessmentType: 'Criticality',
        criticalityLevel: input.level,
        requestScope: input.comment,
      });
      return created;
    },
  };

  const promptSuggestions = {
    async list(options?: ListOptions): Promise<PromptSuggestion[]> {
      const res = unwrap(await Rpvms_promptsuggestionsService.getAll(toIGetAllOptions(options))) || [];
      return res.map(mapPromptSuggestion);
    },
    async listActive(): Promise<PromptSuggestion[]> {
      const res = unwrap(
        await Rpvms_promptsuggestionsService.getAll({
          filter: 'rpvms_isactive eq true',
          orderBy: ['rpvms_sortorder asc'],
        }),
      ) || [];
      return res.map(mapPromptSuggestion);
    },
    async getById(id: string): Promise<PromptSuggestion | null> {
      try {
        const res = unwrap(await Rpvms_promptsuggestionsService.get(id));
        return res ? mapPromptSuggestion(res) : null;
      } catch {
        return null;
      }
    },
    async create(input: { promptText: string; category?: string; sortOrder?: number; isActive?: boolean }): Promise<PromptSuggestion> {
      const payload: Record<string, unknown> = {
        rpvms_prompttext: input.promptText,
      };
      if (input.category !== undefined) payload.rpvms_category = input.category;
      if (input.sortOrder !== undefined) payload.rpvms_sortorder = input.sortOrder;
      if (input.isActive !== undefined) payload.rpvms_isactive = input.isActive;
      const res = unwrap(await Rpvms_promptsuggestionsService.create(payload as never));
      return mapPromptSuggestion(res);
    },
    async update(id: string, input: Partial<PromptSuggestion>): Promise<PromptSuggestion> {
      const payload: Record<string, unknown> = {};
      if (input.promptText !== undefined) payload.rpvms_prompttext = input.promptText;
      if (input.category !== undefined) payload.rpvms_category = input.category;
      if (input.sortOrder !== undefined) payload.rpvms_sortorder = input.sortOrder;
      if (input.isActive !== undefined) payload.rpvms_isactive = input.isActive;
      const res = unwrap(await Rpvms_promptsuggestionsService.update(id, payload as never));
      return mapPromptSuggestion(res);
    },
    async remove(id: string): Promise<void> {
      await Rpvms_promptsuggestionsService.delete(id);
    },
  };

  const reviewers = {
    async getCurrent(): Promise<Reviewer | null> {
      // Resolve via Office 365 MyProfile_V2 \u2192 lookup systemuser by internalemailaddress.
      try {
        const profile = unwrap(await Office365UsersService.MyProfile_V2('mail,userPrincipalName'));
        const email = profile?.mail || profile?.userPrincipalName;
        if (!email) return null;
        const res = unwrap(
          await SystemusersService.getAll({
            filter: `internalemailaddress eq '${escapeOData(email)}'`,
            top: 1,
          }),
        ) || [];
        return res[0] ? mapSystemuser(res[0]) : null;
      } catch {
        return null;
      }
    },
    async list(): Promise<Reviewer[]> {
      // All enabled, non-system systemusers. Admins need the full list here so
      // they can bootstrap assignments for reviewers who have never been
      // assigned before. (`isdisabled eq false` + `accessmode eq 0` filters out
      // disabled accounts and application/non-interactive users.)
      const res =
        unwrap(
          await SystemusersService.getAll({
            filter: 'isdisabled eq false and accessmode eq 0',
            select: ['systemuserid', 'firstname', 'lastname', 'internalemailaddress', 'title', 'isdisabled'],
            top: 500,
          }),
        ) || [];
      const out = res.map(mapSystemuser);
      out.sort((a, b) => a.fullName.localeCompare(b.fullName));
      return out;
    },
    async getById(id: string): Promise<Reviewer | null> {
      try {
        const res = unwrap(await SystemusersService.get(id));
        return res ? mapSystemuser(res) : null;
      } catch {
        return null;
      }
    },
  };

  const assignments = {
    async list(options?: ListOptions): Promise<VPVendorAssignment[]> {
      const res = unwrap(await Rpvms_vpvendorassignmentsService.getAll(toIGetAllOptions(options))) || [];
      return res.map(mapVPVendorAssignment);
    },
    async listForReviewer(reviewerId: string, cycleYear: number): Promise<VPVendorAssignment[]> {
      const res = unwrap(
        await Rpvms_vpvendorassignmentsService.getAll({
          filter: `_rpvms_reviewer_value eq ${reviewerId} and rpvms_cycleyear eq ${cycleYear} and rpvms_isactive eq true`,
          orderBy: ['rpvms_reviewduedate asc'],
        }),
      ) || [];
      return res.map(mapVPVendorAssignment);
    },
    async listForVendor(vendorId: string, cycleYear: number): Promise<VPVendorAssignment[]> {
      const res = unwrap(
        await Rpvms_vpvendorassignmentsService.getAll({
          filter: `_rpvms_vendorid_value eq ${vendorId} and rpvms_cycleyear eq ${cycleYear} and rpvms_isactive eq true`,
        }),
      ) || [];
      return res.map(mapVPVendorAssignment);
    },
    async listVendorsForReviewer(reviewerId: string, cycleYear: number): Promise<ReviewQueueItem[]> {
      const rows = await assignments.listForReviewer(reviewerId, cycleYear);
      if (rows.length === 0) return [];
      const vendorIds = Array.from(new Set(rows.map((r) => r.vendorId).filter(Boolean)));

      // Batch-load vendors + current-year + prior-year scores.
      const [vendorRes, currentScoreRes, priorScoreRes] = await Promise.all([
        Rpvms_vendorsService.getAll({
          filter: vendorIds.map((id) => `rpvms_vendorid eq ${id}`).join(' or '),
        }),
        Rpvms_vendorscoresService.getAll({
          filter: `(${vendorIds.map((id) => `_rpvms_vendorid_value eq ${id}`).join(' or ')}) and rpvms_scoreyear eq ${cycleYear}`,
        }),
        Rpvms_vendorscoresService.getAll({
          filter: `(${vendorIds.map((id) => `_rpvms_vendorid_value eq ${id}`).join(' or ')}) and rpvms_scoreyear eq ${cycleYear - 1}`,
        }),
      ]);
      const vendors = (unwrap(vendorRes) || []).map(mapVendor);
      const currentScores = (unwrap(currentScoreRes) || []).map(mapVendorScore);
      const priorScores = (unwrap(priorScoreRes) || []).map(mapVendorScore);

      const vendorById = new Map(vendors.map((v) => [v.id, v]));
      const currentByVendor = new Map(currentScores.map((s) => [s.vendorId, s]));
      const priorByVendor = new Map(priorScores.map((s) => [s.vendorId, s]));

      return rows.map((assignment) => ({
        assignment,
        vendor: vendorById.get(assignment.vendorId) ?? ({ id: assignment.vendorId, vendorName: assignment.vendorName ?? '' } as Vendor),
        currentScore: currentByVendor.get(assignment.vendorId) ?? null,
        priorScore: priorByVendor.get(assignment.vendorId) ?? null,
      }));
    },
    async countsByStatus(reviewerId: string, cycleYear: number): Promise<AssignmentStatusCounts> {
      const items = await assignments.listVendorsForReviewer(reviewerId, cycleYear);
      const now = Date.now();
      const counts: AssignmentStatusCounts = {
        notStarted: 0,
        draft: 0,
        approved: 0,
        rejected: 0,
        overdue: 0,
        total: items.length,
      };
      for (const it of items) {
        const status = it.currentScore?.reviewStatus ?? 'NotStarted';
        if (status === 'NotStarted') counts.notStarted++;
        else if (status === 'Draft') counts.draft++;
        else if (status === 'Approved') counts.approved++;
        else if (status === 'Rejected') counts.rejected++;
        const due = it.assignment.reviewDueDate ? Date.parse(it.assignment.reviewDueDate) : NaN;
        if (!Number.isNaN(due) && due < now && status !== 'Approved' && status !== 'Rejected') {
          counts.overdue++;
        }
      }
      return counts;
    },
    async assignVendors(input: {
      reviewerId: string;
      vendorIds: string[];
      cycleYear: number;
      reviewDueDate?: string;
      assignedById?: string;
      notes?: string;
    }): Promise<VPVendorAssignment[]> {
      // Filter out vendors already actively assigned to this reviewer/cycle.
      const existing = unwrap(
        await Rpvms_vpvendorassignmentsService.getAll({
          filter: `_rpvms_reviewer_value eq ${input.reviewerId} and rpvms_cycleyear eq ${input.cycleYear} and rpvms_isactive eq true`,
          select: ['_rpvms_vendorid_value'],
        }),
      ) || [];
      const existingVendorIds = new Set(existing.map((e) => e._rpvms_vendorid_value).filter((v): v is string => !!v));
      const todo = input.vendorIds.filter((id) => !existingVendorIds.has(id));

      const created: VPVendorAssignment[] = [];
      for (const vendorId of todo) {
        const payload: Record<string, unknown> = {
          rpvms_assignmentname: `Cycle ${input.cycleYear}`,
          rpvms_cycleyear: String(input.cycleYear),
          'rpvms_Reviewer@odata.bind': systemuserBind(input.reviewerId),
          'rpvms_VendorId@odata.bind': vendorBind(vendorId),
          rpvms_isactive: true as unknown as Rpvms_vpvendorassignmentsrpvms_isactive,
        };
        if (input.reviewDueDate) payload.rpvms_reviewduedate = input.reviewDueDate;
        if (input.assignedById) payload['rpvms_AssignedBy@odata.bind'] = systemuserBind(input.assignedById);
        if (input.notes) payload.rpvms_notes = input.notes;
        const res = unwrap(await Rpvms_vpvendorassignmentsService.create(payload as never));
        created.push(mapVPVendorAssignment(res));
      }
      return created;
    },
    async deactivate(id: string): Promise<void> {
      await Rpvms_vpvendorassignmentsService.update(id, { rpvms_isactive: false as unknown as Rpvms_vpvendorassignmentsrpvms_isactive } as never);
    },
    async remove(id: string): Promise<void> {
      await Rpvms_vpvendorassignmentsService.delete(id);
    },
  };

  const connectivity = {
    async probe(): Promise<ConnectivityStatus> {
      const startedAt = performance.now();
      try {
        await Rpvms_vendorsService.getAll({ top: 1, select: ['rpvms_vendorid'] });
        return {
          state: 'connected',
          lastCheckedAt: new Date().toISOString(),
          latencyMs: Math.round(performance.now() - startedAt),
          environmentId: import.meta.env.VITE_DV_ENV_ID,
          connectionIdSuffix: (import.meta.env.VITE_DV_CONNECTION_ID ?? '').slice(-6),
        };
      } catch (err) {
        return {
          state: 'offline',
          lastCheckedAt: new Date().toISOString(),
          latencyMs: Math.round(performance.now() - startedAt),
          error: err instanceof Error ? err.message : String(err),
          environmentId: import.meta.env.VITE_DV_ENV_ID,
          connectionIdSuffix: (import.meta.env.VITE_DV_CONNECTION_ID ?? '').slice(-6),
        };
      }
    },
  };

  const provider: VendIqDataProvider = {
    vendors,
    suppliers,
    vendorSuppliers,
    contracts,
    contractParties,
    glTransactions,
    vendorScores,
    vendorBudgets,
    vendorRateCards,
    vendorProductServices,
    vendorNameAliases,
    oneTrustAssessments,
    serviceNowAssessments,
    promptSuggestions,
    reviewers,
    assignments,
    connectivity,
    async getVendorCriticality(vendorId: string): Promise<CriticalityLevel | undefined> {
      const latest = await serviceNowAssessments.latestCriticalityByVendor(vendorId);
      return latest?.criticalityLevel;
    },
  };

  return provider;
}
