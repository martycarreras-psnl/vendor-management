// Reusable DataGrid with per-column sorting, inline filtering, and optional pagination.
// Every table across the app should use this component for consistent UX.

import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';

// ---- Public API ----

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

  // Filter state: key → lowercase search string
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Page state
  const [page, setPage] = useState(0);

  const hasActiveFilters = Object.values(colFilters).some((v) => v.length > 0);

  // ---- Derived data ----

  const filtered = useMemo(() => {
    if (!hasActiveFilters) return data;
    return data.filter((row) =>
      columns.every((col) => {
        const q = colFilters[col.key];
        if (!q) return true;
        const raw = col.accessor(row);
        if (raw === null || raw === undefined) return false;
        return String(raw).toLowerCase().includes(q);
      }),
    );
  }, [data, colFilters, columns, hasActiveFilters]);

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
  const setFilter = useCallback((key: string, value: string) => {
    setColFilters((prev) => ({ ...prev, [key]: value.toLowerCase() }));
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
                {columns.map((col) => (
                  <th key={col.key} className={cn('px-4 py-1.5', col.align === 'right' && 'text-right')}>
                    {col.filterable !== false ? (
                      <input
                        type="text"
                        placeholder="Filter…"
                        value={colFilters[col.key] ?? ''}
                        onChange={(e) => setFilter(col.key, e.target.value)}
                        className="w-full min-w-[60px] rounded border bg-background px-2 py-1 text-xs font-normal normal-case tracking-normal outline-none focus:ring-1 focus:ring-primary"
                      />
                    ) : (
                      <span />
                    )}
                  </th>
                ))}
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
