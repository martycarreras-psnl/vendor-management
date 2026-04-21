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

import type { ListOptions, VendIqDataProvider } from '@/services/vendiq/contracts';
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
  writeSNCriticality,
  writeVendorClassification,
  writeVendorStatus,
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
    topSpendCostCenter: r.rpvms_topspendcostcenter,
    comment: r.rpvms_comment,
    status: readVendorStatus(r.rpvms_status),
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

// Dataverse @odata.bind format: "/rpvms_vendors(<guid>)".
function vendorBind(id: string): string {
  return `/rpvms_vendors(${id})`;
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
    connectivity,
    async getVendorCriticality(vendorId: string): Promise<CriticalityLevel | undefined> {
      const latest = await serviceNowAssessments.latestCriticalityByVendor(vendorId);
      return latest?.criticalityLevel;
    },
  };

  return provider;
}
