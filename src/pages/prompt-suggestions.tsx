// Prompt Suggestions management page — CRUD for chat prompt suggestions stored in Dataverse.

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVendiq } from '@/services/vendiq/provider-context';
import { DataGrid, type ColumnDef } from '@/components/vendiq/data-grid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataverseFieldLabel } from '@/components/ui/dataverse-field-label';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PromptSuggestion } from '@/types/vendiq';
import { useDataverseFieldMetadata } from '@/hooks/vendiq/use-dataverse-field-metadata';

function usePromptSuggestions() {
  const provider = useVendiq();
  return useQuery<PromptSuggestion[]>({
    queryKey: ['vendiq', 'promptSuggestions'],
    queryFn: () => provider.promptSuggestions.list({ top: 5000 }),
  });
}

interface FormState {
  promptText: string;
  category: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = { promptText: '', category: '', sortOrder: '0', isActive: true };

export default function PromptSuggestionsPage() {
  const provider = useVendiq();
  const queryClient = useQueryClient();
  const query = usePromptSuggestions();
  const promptTextMetadata = useDataverseFieldMetadata('rpvms_promptsuggestions', 'rpvms_prompttext');
  const promptTextRequired = promptTextMetadata.data?.isRequired ?? true;
  const promptTextLabel = promptTextMetadata.data?.displayName ?? 'Prompt Text';

  const [editingId, setEditingId] = useState<string | null>(null); // null = creating new, undefined = idle
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const promptText = (form.promptText ?? '').trim();
      if (promptTextRequired && promptText.length === 0) {
        throw new Error(`${promptTextLabel} is required.`);
      }

      const input = {
        promptText,
        category: (form.category ?? '').trim() || undefined,
        sortOrder: parseInt(form.sortOrder, 10) || 0,
        isActive: form.isActive,
      };
      if (editingId) {
        return provider.promptSuggestions.update(editingId, input);
      }
      return provider.promptSuggestions.create(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendiq', 'promptSuggestions'] });
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => provider.promptSuggestions.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendiq', 'promptSuggestions'] }),
  });

  const startCreate = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }, []);

  const startEdit = useCallback((ps: PromptSuggestion) => {
    setEditingId(ps.id);
    setForm({
      promptText: ps.promptText ?? '',
      category: ps.category ?? '',
      sortOrder: String(ps.sortOrder ?? 0),
      isActive: ps.isActive ?? true,
    });
    setFormError(null);
    setShowForm(true);
  }, []);

  const cancelForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }, []);

  const columns: ColumnDef<PromptSuggestion>[] = [
    { key: 'promptText', header: 'Prompt Text', accessor: (r) => r.promptText },
    { key: 'category', header: 'Category', accessor: (r) => r.category ?? '' },
    { key: 'sortOrder', header: 'Order', accessor: (r) => r.sortOrder ?? 0, align: 'right' },
    {
      key: 'isActive', header: 'Active', accessor: (r) => r.isActive ? 'Yes' : 'No',
      render: (r) => (
        <span className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
          r.isActive ? 'bg-signal-green/10 text-signal-green' : 'bg-muted text-muted-foreground',
        )}>
          {r.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions', header: '', accessor: () => '', sortable: false, filterable: false,
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); startEdit(r); }}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete "${(r.promptText ?? '').slice(0, 60)}"?`)) {
                deleteMutation.mutate(r.id);
              }
            }}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  if (query.isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading prompt suggestions…</div>;
  }
  if (query.isError || !query.data) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Failed to load prompt suggestions.</div>;
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prompt Suggestions</h1>
          <p className="text-sm text-muted-foreground">
            Manage the suggestion prompts shown in the vendIQ chat interface · {query.data.length} total
          </p>
        </div>
        <Button size="sm" onClick={startCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Prompt
        </Button>
      </header>

      {/* Inline form */}
      {showForm && (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold">
            {editingId ? 'Edit Prompt Suggestion' : 'New Prompt Suggestion'}
          </h3>
          {formError && (
            <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <DataverseFieldLabel
                tableLogicalName="rpvms_promptsuggestions"
                fieldLogicalName="rpvms_prompttext"
                fallback="Prompt Text"
                className="text-xs text-muted-foreground"
              />
              <Input
                className="mt-1"
                value={form.promptText}
                aria-required={promptTextRequired || undefined}
                aria-invalid={formError?.includes(promptTextLabel) ? true : undefined}
                onChange={(e) => setForm((f) => ({ ...f, promptText: e.target.value }))}
                placeholder="e.g. Which contracts are expiring in the next 90 days?"
              />
            </div>
            <div>
              <DataverseFieldLabel
                tableLogicalName="rpvms_promptsuggestions"
                fieldLogicalName="rpvms_category"
                fallback="Category"
                className="text-xs text-muted-foreground"
              />
              <Input
                className="mt-1"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Contracts, Risk, Spend"
              />
            </div>
            <div>
              <DataverseFieldLabel
                tableLogicalName="rpvms_promptsuggestions"
                fieldLogicalName="rpvms_sortorder"
                fallback="Sort Order"
                className="text-xs text-muted-foreground"
              />
              <Input
                className="mt-1"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </div>
            <div>
              <DataverseFieldLabel
                tableLogicalName="rpvms_promptsuggestions"
                fieldLogicalName="rpvms_isactive"
                fallback="Active"
                className="text-xs text-muted-foreground"
              />
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.isActive ? 'true' : 'false'}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === 'true' }))}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
              <Check className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving…' : editingId ? 'Save Changes' : 'Create'}
            </Button>
            <Button size="sm" variant="outline" onClick={cancelForm} disabled={saveMutation.isPending} className="gap-2">
              <X className="h-4 w-4" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="rounded-lg border bg-card shadow-sm">
        <DataGrid
          columns={columns}
          data={query.data}
          keyFn={(r) => r.id}
          defaultSort={{ key: 'sortOrder', dir: 'asc' }}
          emptyMessage="No prompt suggestions yet. Click 'Add Prompt' to create one."
        />
      </div>
    </div>
  );
}
