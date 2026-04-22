// Reusable DataGrid with per-column sorting, inline filtering, and optional pagination.
// Every table across the app should use this component for consistent UX.

import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown, X, Download } from 'lucide-react';

// ---- Public API ----

/** Filter input type rendered in the filter row. Auto-detected when omitted. */
export type FilterType = 'text' | 'select' | 'date' | 'number' | 'boolean';

export interface ColumnDef<T> {
  /** Unique key for this column. */
  key: string;
  /** Header label shown in the table head. */
  header: string;
  /** Extract raw value for sorting + filtering. Falls back to string coercion. */
  accessor: (row: T) => string | number | boolean | null | undefined;
  /** Custom cell renderer. If omitted, accessor value is stringified. */
  render?: (row: T) => ReactNode;
  /** Right-align column (numbers, currency). */
  align?: 'left' | 'right';
  /** Disable filtering for this column. Default true. */
  filterable?: boolean;
  /** Disable sorting for this column. Default true. */
  sortable?: boolean;
  /**
   * Filter input type. When omitted, auto-detected from data:
   * - accessor returns boolean → 'boolean'
   * - accessor returns number → 'number'
   * - values look like ISO dates (YYYY-MM-...) → 'date'
   * - ≤20 distinct non-empty values → 'select'
   * - otherwise → 'text'
   */
  filterType?: FilterType;
  /** Explicit options for 'select' filter (overrides auto-detection). */
  filterOptions?: string[];
}

/** Internal filter value shape per column — supports range and exact values. */
interface ColFilterValue {
  text?: string;       // text substring
  exact?: string;      // select exact match
  bool?: string;       // 'true' | 'false' | ''
  dateFrom?: string;   // YYYY-MM-DD
  dateTo?: string;     // YYYY-MM-DD
  numMin?: string;     // number min
  numMax?: string;     // number max
}

export interface DataGridProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** Unique key extractor per row. */
  keyFn: (row: T) => string;
  /** Enable pagination. 0 or undefined = show all rows. */
  pageSize?: number;
  /** Initial sort column + direction. */
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  /** Message when data is empty (after filtering). */
  emptyMessage?: string;
  /** Row-level click handler. */
  onRowClick?: (row: T) => void;
  /** Extra class on wrapper div. */
  className?: string;
}

// ---- Component ----

export function DataGrid<T>({
  columns,
  data,
  keyFn,
  pageSize,
  defaultSort,
  emptyMessage = 'No data found.',
  onRowClick,
  className,
}: DataGridProps<T>) {
  // Sort state
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key ?? null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSort?.dir ?? 'asc');

  // Filter state: key → structured filter value
  const [colFilters, setColFilters] = useState<Record<string, ColFilterValue>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Page state
  const [page, setPage] = useState(0);

  const hasActiveFilters = Object.values(colFilters).some((v) => isFilterActive(v));

  // Auto-detect filter types from data
  const resolvedFilterTypes = useMemo(() => {
    const map = new Map<string, { type: FilterType; options?: string[] }>();
    for (const col of columns) {
      if (col.filterable === false) continue;
      if (col.filterType) {
        map.set(col.key, { type: col.filterType, options: col.filterOptions });
        continue;
      }
      // Sample data to infer type
      const sample = data.slice(0, 100);
      const values = sample.map((r) => col.accessor(r)).filter((v) => v !== null && v !== undefined);
      if (values.length === 0) { map.set(col.key, { type: 'text' }); continue; }

      // Boolean?
      if (values.every((v) => typeof v === 'boolean')) {
        map.set(col.key, { type: 'boolean' }); continue;
      }
      // Number?
      if (values.every((v) => typeof v === 'number')) {
        map.set(col.key, { type: 'number' }); continue;
      }
      // Date? (ISO string starting with YYYY-MM)
      const ISO_DATE = /^\d{4}-\d{2}/;
      if (values.every((v) => typeof v === 'string' && ISO_DATE.test(v))) {
        map.set(col.key, { type: 'date' }); continue;
      }
      // Select? (≤20 distinct non-empty string values)
      if (col.filterOptions) {
        map.set(col.key, { type: 'select', options: col.filterOptions }); continue;
      }
      const distinct = new Set(data.map((r) => col.accessor(r)).filter((v) => v !== null && v !== undefined && v !== '').map((v) => String(v)));
      if (distinct.size > 0 && distinct.size <= 20) {
        map.set(col.key, { type: 'select', options: [...distinct].sort() }); continue;
      }
      map.set(col.key, { type: 'text' });
    }
    return map;
  }, [columns, data]);

  // ---- Derived data ----

  const filtered = useMemo(() => {
    if (!hasActiveFilters) return data;
    return data.filter((row) =>
      columns.every((col) => {
        const fv = colFilters[col.key];
        if (!fv || !isFilterActive(fv)) return true;
        const raw = col.accessor(row);
        const ft = resolvedFilterTypes.get(col.key)?.type ?? 'text';

        switch (ft) {
          case 'boolean': {
            if (!fv.bool) return true;
            const boolVal = raw === true || raw === 'true' || raw === 'Yes';
            return fv.bool === 'true' ? boolVal : !boolVal;
          }
          case 'select': {
            if (!fv.exact) return true;
            return String(raw ?? '') === fv.exact;
          }
          case 'date': {
            const s = String(raw ?? '').slice(0, 10);
            if (!s) return !fv.dateFrom && !fv.dateTo;
            if (fv.dateFrom && s < fv.dateFrom) return false;
            if (fv.dateTo && s > fv.dateTo) return false;
            return true;
          }
          case 'number': {
            if (raw === null || raw === undefined) return !fv.numMin && !fv.numMax;
            const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
            if (Number.isNaN(n)) return false;
            if (fv.numMin && n < parseFloat(fv.numMin)) return false;
            if (fv.numMax && n > parseFloat(fv.numMax)) return false;
            return true;
          }
          default: { // text
            if (!fv.text) return true;
            if (raw === null || raw === undefined) return false;
            return String(raw).toLowerCase().includes(fv.text);
          }
        }
      }),
    );
  }, [data, colFilters, columns, hasActiveFilters, resolvedFilterTypes]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const va = col.accessor(a);
      const vb = col.accessor(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const effectivePageSize = pageSize && pageSize > 0 ? pageSize : sorted.length;
  const totalPages = Math.max(1, Math.ceil(sorted.length / effectivePageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(safePage * effectivePageSize, (safePage + 1) * effectivePageSize);
  const rangeStart = sorted.length === 0 ? 0 : safePage * effectivePageSize + 1;
  const rangeEnd = Math.min((safePage + 1) * effectivePageSize, sorted.length);

  // Reset page when filters change
  const setFilter = useCallback((key: string, patch: Partial<ColFilterValue>) => {
    setColFilters((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setPage(0);
  }, []);

  const clearAllFilters = useCallback(() => {
    setColFilters({});
    setPage(0);
  }, []);

  const toggleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const exportCsv = useCallback(() => {
    const header = columns.map((c) => escapeCsvField(c.header)).join(',');
    const rows = sorted.map((row) =>
      columns.map((c) => {
        const raw = c.accessor(row);
        return escapeCsvField(raw === null || raw === undefined ? '' : String(raw));
      }).join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [sorted, columns]);

  return (
    <div className={cn('overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {sorted.length} record{sorted.length !== 1 ? 's' : ''}
          {hasActiveFilters && ` (filtered from ${data.length})`}
        </span>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'rounded-md px-2 py-1 text-xs transition-colors',
              showFilters ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/60',
            )}
          >
            {showFilters ? 'Hide filters' : 'Show filters'}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60"
            title="Export all filtered rows as CSV"
          >
            <Download className="h-3 w-3" /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {/* Header row */}
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const canSort = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-2 font-medium',
                      col.align === 'right' && 'text-right',
                      canSort && 'cursor-pointer select-none transition-colors hover:text-foreground',
                    )}
                    onClick={canSort ? () => toggleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {canSort && (
                        <span className="inline-flex flex-col">
                          {isSorted ? (
                            sortDir === 'asc' ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
            {/* Filter row */}
            {showFilters && (
              <tr className="border-b bg-muted/20">
                {columns.map((col) => {
                  if (col.filterable === false) return <th key={col.key} className="px-4 py-1.5"><span /></th>;
                  const meta = resolvedFilterTypes.get(col.key);
                  const ft = meta?.type ?? 'text';
                  const fv = colFilters[col.key] ?? {};
                  const base = 'w-full min-w-[60px] rounded border bg-background px-2 py-1 text-xs font-normal normal-case tracking-normal outline-none focus:ring-1 focus:ring-primary';
                  return (
                    <th key={col.key} className={cn('px-4 py-1.5', col.align === 'right' && 'text-right')}>
                      {ft === 'boolean' && (
                        <select className={base} value={fv.bool ?? ''} onChange={(e) => setFilter(col.key, { bool: e.target.value })}>
                          <option value="">All</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      )}
                      {ft === 'select' && (
                        <select className={base} value={fv.exact ?? ''} onChange={(e) => setFilter(col.key, { exact: e.target.value })}>
                          <option value="">All</option>
                          {(meta?.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                      {ft === 'date' && (
                        <div className="flex gap-1">
                          <input type="date" className={cn(base, 'min-w-[100px]')} value={fv.dateFrom ?? ''} onChange={(e) => setFilter(col.key, { dateFrom: e.target.value })} title="From" />
                          <input type="date" className={cn(base, 'min-w-[100px]')} value={fv.dateTo ?? ''} onChange={(e) => setFilter(col.key, { dateTo: e.target.value })} title="To" />
                        </div>
                      )}
                      {ft === 'number' && (
                        <div className="flex gap-1">
                          <input type="number" className={cn(base, 'min-w-[50px]')} placeholder="Min" value={fv.numMin ?? ''} onChange={(e) => setFilter(col.key, { numMin: e.target.value })} />
                          <input type="number" className={cn(base, 'min-w-[50px]')} placeholder="Max" value={fv.numMax ?? ''} onChange={(e) => setFilter(col.key, { numMax: e.target.value })} />
                        </div>
                      )}
                      {ft === 'text' && (
                        <input type="text" placeholder="Filter…" className={base} value={fv.text ?? ''} onChange={(e) => setFilter(col.key, { text: e.target.value.toLowerCase() })} />
                      )}
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {pageRows.map((row) => (
              <tr
                key={keyFn(row)}
                className={cn(
                  'border-b last:border-0 transition-colors hover:bg-muted/40',
                  onRowClick && 'cursor-pointer',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('px-4 py-2', col.align === 'right' && 'text-right tabular-nums')}
                  >
                    {col.render ? col.render(row) : formatCell(col.accessor(row))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageSize && pageSize > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {rangeStart}–{rangeEnd} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <PagBtn disabled={safePage === 0} onClick={() => setPage(0)}>First</PagBtn>
            <PagBtn disabled={safePage === 0} onClick={() => setPage((p) => p - 1)}>Prev</PagBtn>
            <span className="px-2 text-xs tabular-nums text-muted-foreground">
              {safePage + 1} / {totalPages}
            </span>
            <PagBtn disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</PagBtn>
            <PagBtn disabled={safePage >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>Last</PagBtn>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Internals ----

function PagBtn({ children, disabled, onClick }: { children: ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
        disabled
          ? 'cursor-not-allowed border-muted text-muted-foreground/40'
          : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function formatCell(value: string | number | boolean | null | undefined): ReactNode {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function isFilterActive(fv: ColFilterValue): boolean {
  return !!(fv.text || fv.exact || fv.bool || fv.dateFrom || fv.dateTo || fv.numMin || fv.numMax);
}
