// Contract Details page — fully editable inline form.
// Navigated to from Vendor 360 contracts tab, Contract Expiration bucket cards,
// Portfolio treemap / donut, and Top Vendors table expiration links.

import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVendiq } from '@/services/vendiq/provider-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataverseFieldLabel, useDataverseFieldRequired } from '@/components/ui/dataverse-field-label';
import { toDataverseFieldName } from '@/lib/dataverse-field-name';
import { findEmptyRequiredKeys } from '@/lib/required-fields-validator';
import { FormValidationProvider, useFieldInvalid } from '@/lib/form-validation-context';
import { useDataverseRequiredFields } from '@/hooks/vendiq/use-dataverse-required-fields';
import { DataGrid } from '@/components/vendiq/data-grid';
import { formatDate, daysUntil } from '@/lib/vendiq-format';
import { cn } from '@/lib/utils';
import type {
  Contract,
  ContractType,
  ContractStatus,
  YesNoNA,
} from '@/types/vendiq';

const CONTRACT_TYPES: ContractType[] = [
  'MasterServicesAgreement',
  'StatementofWork',
  'OrderForm',
  'LicenseAgreement',
  'NDA',
  'Amendment',
  'BAA',
  'Other',
];

const CONTRACT_STATUSES: ContractStatus[] = [
  'Active',
  'Expired',
  'Terminated',
  'Pending',
  'UnderReview',
  'Unknown',
];

const YES_NO_NA: YesNoNA[] = ['Yes', 'No', 'N_A', 'Unknown'];

function useContractDetails(contractId: string) {
  const provider = useVendiq();
  return useQuery({
    queryKey: ['vendiq', 'contract', contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const [contract, parties] = await Promise.all([
        provider.contracts.getById(contractId),
        provider.contractParties.listByContract(contractId),
      ]);
      return { contract, parties };
    },
  });
}

export default function ContractDetailsPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const queryClient = useQueryClient();
  const provider = useVendiq();
  const query = useContractDetails(contractId ?? '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Contract>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<ReadonlySet<string>>(new Set());

  const requiredFieldsQuery = useDataverseRequiredFields(CONTRACT_TABLE);

  const mutation = useMutation({
    mutationFn: async (updates: Partial<Contract>) => {
      return provider.contracts.update(contractId!, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendiq', 'contract', contractId] });
      queryClient.invalidateQueries({ queryKey: ['vendiq'] });
      setEditing(false);
      setDraft({});
      setSaveError(null);
      setInvalidFields(new Set());
    },
    onError: (err: Error) => {
      setSaveError(err.message);
    },
  });

  const startEditing = useCallback(() => {
    if (!query.data?.contract) return;
    setDraft({ ...query.data.contract });
    setEditing(true);
    setSaveError(null);
    setInvalidFields(new Set());
  }, [query.data]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setDraft({});
    setSaveError(null);
    setInvalidFields(new Set());
  }, []);

  const handleSave = useCallback(() => {
    if (!contractId || !query.data?.contract) return;
    const invalid = findEmptyRequiredKeys<Contract>(draft, requiredFieldsQuery.data);
    if (invalid.size > 0) {
      setInvalidFields(invalid);
      setSaveError('Fill the highlighted required fields before saving.');
      return;
    }
    // Diff only changed fields
    const original = query.data.contract;
    const changes: Partial<Contract> = {};
    for (const key of Object.keys(draft) as (keyof Contract)[]) {
      if (key === 'id') continue;
      if (draft[key] !== original[key]) {
        (changes as Record<string, unknown>)[key] = draft[key];
      }
    }
    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }
    setInvalidFields(new Set());
    mutation.mutate(changes);
  }, [contractId, draft, query.data, mutation, requiredFieldsQuery.data]);

  const updateDraft = useCallback((field: keyof Contract, value: unknown) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setInvalidFields((prev) => {
      if (!prev.has(field as string)) return prev;
      const next = new Set(prev);
      next.delete(field as string);
      return next;
    });
  }, []);

  // Hoisted here so hooks run unconditionally (Rules of Hooks).
  const contractNameRequired = useDataverseFieldRequired(CONTRACT_TABLE, 'rpvms_contractname');
  const contractNameInvalid = useFieldInvalid('contractName');

  if (!contractId) {
    return <div className="text-sm text-muted-foreground">Missing contract id.</div>;
  }
  if (query.isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading contract…</div>;
  }
  if (query.isError || !query.data?.contract) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Contract not found or failed to load.{' '}
        <Link to="/contracts" className="underline">Back to Contracts</Link>
      </div>
    );
  }

  const contract = query.data.contract;
  const parties = query.data.parties;
  const source = editing ? draft : contract;

  const expirationDays = daysUntil(source.expirationDate);
  const noticeDays = daysUntil(source.noticeDate);

  return (
    <FormValidationProvider invalidFields={invalidFields}>
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="text-xs text-muted-foreground">
        <Link to="/contracts" className="hover:underline">Contracts</Link>
        <span className="mx-1">/</span>
        <span>{contract.contractName}</span>
      </nav>

      {/* Header */}
      <header className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {editing ? (
              <Input
                className="text-2xl font-semibold"
                value={draft.contractName ?? ''}
                aria-required={contractNameRequired || undefined}
                aria-invalid={contractNameInvalid || undefined}
                onChange={(e) => updateDraft('contractName', e.target.value)}
              />
            ) : (
              <h1 className="text-2xl font-semibold">{contract.contractName}</h1>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {source.contractType && (
                <span className="rounded-full border px-2 py-0.5">{formatContractType(source.contractType)}</span>
              )}
              <StatusBadge status={source.contractStatus} />
              {source.documentId && <span className="truncate">Doc ID: {source.documentId}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <Button size="sm" onClick={startEditing}>Edit</Button>
            )}
            {editing && (
              <>
                <Button size="sm" variant="outline" onClick={cancelEditing} disabled={mutation.isPending}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
                  {mutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <QuickStat label="Expiration" value={formatDate(source.expirationDate)} tone={expirationTone(expirationDays)} />
          <QuickStat label="Notice Date" value={formatDate(source.noticeDate)} tone={noticeTone(noticeDays)} />
          <QuickStat label="Auto-Renew" value={source.autoRenew ?? '—'} />
          <QuickStat label="Supplier" value={source.supplierName ?? '—'} />
        </div>
      </header>

      {saveError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Save failed: {saveError}
        </div>
      )}

      {/* Form sections */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Core Details */}
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Core Details</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Document ID" value={source.documentId} field="documentId" editing={editing} onUpdate={updateDraft} />
            <SelectField
              label="Contract Type"
              value={source.contractType}
              field="contractType"
              options={CONTRACT_TYPES}
              displayFn={formatContractType}
              editing={editing}
              onUpdate={updateDraft}
            />
            <SelectField
              label="Status"
              value={source.contractStatus}
              field="contractStatus"
              options={CONTRACT_STATUSES}
              editing={editing}
              onUpdate={updateDraft}
            />
            <Field label="Sub-Contract Type" value={source.subContractType} field="subContractType" editing={editing} onUpdate={updateDraft} />
            <Field label="Contracting Entity" value={source.contractingEntityName} field="contractingEntityName" editing={editing} onUpdate={updateDraft} />
            <Field label="Practice Name" value={source.practiceName} field="practiceName" editing={editing} onUpdate={updateDraft} />
          </div>
        </section>

        {/* Matter Details */}
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Matter</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Matter ID" value={source.matterId} field="matterId" editing={editing} onUpdate={updateDraft} />
            <Field label="Matter Short Name" value={source.matterShortName} field="matterShortName" editing={editing} onUpdate={updateDraft} />
            <Field label="Matter Full Name" value={source.matterFullName} field="matterFullName" editing={editing} onUpdate={updateDraft} className="md:col-span-2" />
          </div>
        </section>

        {/* Dates */}
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Key Dates</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <DateField label="Date Signed" value={source.dateSigned} field="dateSigned" editing={editing} onUpdate={updateDraft} />
            <DateField label="Effective Date" value={source.effectiveDate} field="effectiveDate" editing={editing} onUpdate={updateDraft} />
            <DateField label="Expiration Date" value={source.expirationDate} field="expirationDate" editing={editing} onUpdate={updateDraft} />
            <DateField label="Notice Date" value={source.noticeDate} field="noticeDate" editing={editing} onUpdate={updateDraft} />
          </div>
        </section>

        {/* Terms */}
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Terms &amp; Conditions</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="Auto-Renew" value={source.autoRenew} field="autoRenew" options={YES_NO_NA} editing={editing} onUpdate={updateDraft} />
            <Field label="Auto-Renewal Details" value={source.autoRenewalDetails} field="autoRenewalDetails" editing={editing} onUpdate={updateDraft} />
            <SelectField label="Amended" value={source.amended} field="amended" options={YES_NO_NA} editing={editing} onUpdate={updateDraft} />
            <SelectField label="Termination Without Cause" value={source.terminationWithoutCause} field="terminationWithoutCause" options={YES_NO_NA} editing={editing} onUpdate={updateDraft} />
            <Field label="Termination Notice Detail" value={source.terminationNoticeDetail} field="terminationNoticeDetail" editing={editing} onUpdate={updateDraft} className="md:col-span-2" />
            <Field label="Other Significant Terms" value={source.otherSignificantTerms} field="otherSignificantTerms" editing={editing} onUpdate={updateDraft} multiline className="md:col-span-2" />
          </div>
        </section>
      </div>

      {/* Linked Parties */}
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Contract Parties ({parties.length})
        </h3>
        {parties.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contract parties linked.</p>
        ) : (
          <DataGrid
            columns={[
              { key: 'partyName', header: 'Party Name', accessor: (p) => p.partyName },
              { key: 'slot', header: 'Slot', accessor: (p) => p.partySlot },
              { key: 'type', header: 'Type', accessor: (p) => p.partyTargetType },
              {
                key: 'vendor', header: 'Vendor', accessor: (p) => p.vendorName ?? '',
                render: (p) => p.vendorId
                  ? <Link to={`/vendors/${p.vendorId}`} className="text-primary hover:underline">{p.vendorName || '(unknown vendor)'}</Link>
                  : <span>—</span>,
              },
              { key: 'supplier', header: 'Supplier', accessor: (p) => p.supplierName ?? '' },
            ]}
            data={parties}
            keyFn={(p) => p.id}
          />
        )}
      </section>
    </div>
    </FormValidationProvider>
  );
}

// ---- Sub-components ----

function QuickStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 text-lg font-semibold tabular-nums', tone)}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status?: ContractStatus }) {
  if (!status) return null;
  const tone =
    status === 'Active' ? 'border-signal-green/40 bg-signal-green/10 text-signal-green' :
    status === 'Expired' ? 'border-signal-red/40 bg-signal-red/10 text-signal-red' :
    status === 'Terminated' ? 'border-signal-red/40 bg-signal-red/10 text-signal-red' :
    status === 'Pending' ? 'border-signal-amber/40 bg-signal-amber/10 text-signal-amber' :
    status === 'UnderReview' ? 'border-signal-yellow/40 bg-signal-yellow/10 text-signal-yellow' :
    'border-muted bg-muted/10';
  return <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', tone)}>{status}</span>;
}

// All editable helpers below are bound to the `rpvms_contracts` table. Each
// domain key is auto-mapped to its Dataverse logical column name via
// `toDataverseFieldName`. Label text, asterisk, and aria-required come from
// live Dataverse metadata.
const CONTRACT_TABLE = 'rpvms_contracts';

function Field({
  label,
  value,
  field,
  editing,
  onUpdate,
  multiline,
  className,
}: {
  label: string;
  value?: string;
  field: keyof Contract;
  editing: boolean;
  onUpdate: (field: keyof Contract, value: unknown) => void;
  multiline?: boolean;
  className?: string;
}) {
  const logical = toDataverseFieldName(field as string);
  const required = useDataverseFieldRequired(CONTRACT_TABLE, logical);
  const invalid = useFieldInvalid(field as string);
  return (
    <div className={className}>
      <DataverseFieldLabel
        tableLogicalName={CONTRACT_TABLE}
        fieldLogicalName={logical}
        fallback={label}
        className="text-xs text-muted-foreground"
      />
      {editing ? (
        multiline ? (
          <textarea
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            rows={3}
            value={(value as string) ?? ''}
            aria-required={required || undefined}
            aria-invalid={invalid || undefined}
            onChange={(e) => onUpdate(field, e.target.value || undefined)}
          />
        ) : (
          <Input
            className="mt-1"
            value={(value as string) ?? ''}
            aria-required={required || undefined}
            aria-invalid={invalid || undefined}
            onChange={(e) => onUpdate(field, e.target.value || undefined)}
          />
        )
      ) : (
        <div className="mt-1 text-sm">{(value as string) || '—'}</div>
      )}
    </div>
  );
}

function DateField({
  label,
  value,
  field,
  editing,
  onUpdate,
}: {
  label: string;
  value?: string;
  field: keyof Contract;
  editing: boolean;
  onUpdate: (field: keyof Contract, value: unknown) => void;
}) {
  const logical = toDataverseFieldName(field as string);
  const required = useDataverseFieldRequired(CONTRACT_TABLE, logical);
  const invalid = useFieldInvalid(field as string);
  // Normalize ISO date to YYYY-MM-DD for the input type=date
  const inputValue = value ? value.slice(0, 10) : '';
  return (
    <div>
      <DataverseFieldLabel
        tableLogicalName={CONTRACT_TABLE}
        fieldLogicalName={logical}
        fallback={label}
        className="text-xs text-muted-foreground"
      />
      {editing ? (
        <Input
          className="mt-1"
          type="date"
          value={inputValue}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          onChange={(e) => onUpdate(field, e.target.value ? `${e.target.value}T00:00:00Z` : undefined)}
        />
      ) : (
        <div className="mt-1 text-sm">{formatDate(value)}</div>
      )}
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  field,
  options,
  editing,
  onUpdate,
  displayFn,
}: {
  label: string;
  value?: T;
  field: keyof Contract;
  options: T[];
  editing: boolean;
  onUpdate: (field: keyof Contract, value: unknown) => void;
  displayFn?: (v: T) => string;
}) {
  const display = displayFn ?? ((v: T) => v);
  const logical = toDataverseFieldName(field as string);
  const required = useDataverseFieldRequired(CONTRACT_TABLE, logical);
  const invalid = useFieldInvalid(field as string);
  return (
    <div>
      <DataverseFieldLabel
        tableLogicalName={CONTRACT_TABLE}
        fieldLogicalName={logical}
        fallback={label}
        className="text-xs text-muted-foreground"
      />
      {editing ? (
        <select
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={value ?? ''}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          onChange={(e) => onUpdate(field, (e.target.value || undefined) as T | undefined)}
        >
          <option value="">—</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{display(opt)}</option>
          ))}
        </select>
      ) : (
        <div className="mt-1 text-sm">{value ? display(value) : '—'}</div>
      )}
    </div>
  );
}

function formatContractType(t: ContractType | string): string {
  const MAP: Record<string, string> = {
    MasterServicesAgreement: 'MSA',
    StatementofWork: 'SOW',
    OrderForm: 'Order Form',
    LicenseAgreement: 'License',
    NDA: 'NDA',
    Amendment: 'Amendment',
    BAA: 'BAA',
    Other: 'Other',
  };
  return MAP[t] ?? t;
}

function expirationTone(days: number | undefined): string | undefined {
  if (days === undefined) return undefined;
  if (days < 0) return 'text-signal-red';
  if (days <= 30) return 'text-signal-red';
  if (days <= 60) return 'text-signal-amber';
  if (days <= 90) return 'text-signal-yellow';
  return undefined;
}

function noticeTone(days: number | undefined): string | undefined {
  if (days === undefined) return undefined;
  if (days < 0) return 'text-signal-red';
  if (days <= 14) return 'text-signal-red';
  if (days <= 30) return 'text-signal-amber';
  return undefined;
}
