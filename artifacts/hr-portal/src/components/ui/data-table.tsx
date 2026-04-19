import { useState, useMemo, useCallback, useEffect } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Download, Printer, Columns3, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  defaultHidden?: boolean;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  exportValue?: (row: T) => string;
};

export type DataTableBulkAction = {
  label: string;
  value: string;
  variant?: "default" | "destructive";
};

type SortDir = "asc" | "desc" | null;

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => number;
  isLoading?: boolean;
  skeletonRows?: number;
  emptyState?: React.ReactNode;
  bulkActions?: DataTableBulkAction[];
  /**
   * Bulk action handler. The third argument carries selection metadata so callers can
   * distinguish a partial selection from "every matching result selected" — the latter
   * lets the caller hit a server-side filter endpoint instead of pushing a large id list.
   * `allSelected` is true when the user opted into select-all-results mode OR when every
   * loaded row is selected; `totalRows` is the backend total when known, otherwise the
   * loaded row count.
   */
  onBulkAction?: (
    ids: number[],
    action: string,
    meta: { allSelected: boolean; totalRows: number },
  ) => void | Promise<void>;
  exportFilename?: string;
  /**
   * Total count of rows matching the active server-side filters. When provided and the user
   * has selected every loaded row, the bulk action bar shows the backend total instead of
   * the client-loaded count, and offers to expand selection to all matching results
   * (select-all-results mode). This is the foundation for pagination-aware bulk actions:
   * the count comes from the server, so it stays correct across page navigation if the
   * caller ever paginates the rows prop.
   */
  totalMatchingResults?: number;
  /**
   * A token that changes whenever the active filter/search changes. When this changes,
   * the select-all-results mode is cleared so the banner doesn't bleed across filter changes.
   */
  filterToken?: string;
  /**
   * Stable identifier for this table (e.g. "applications", "employees"). When provided,
   * the user's column visibility choices are persisted to localStorage under
   * `dt-columns-${tableId}` and restored on next mount.
   */
  tableId?: string;
  "data-testid"?: string;
  rowProps?: (row: T) => React.HTMLAttributes<HTMLTableRowElement>;
};

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function buildCSV<T>(cols: DataTableColumn<T>[], rows: T[]): string {
  const exportCols = cols.filter((c) => c.exportValue);
  if (exportCols.length === 0) return "";
  const headers = exportCols.map((c) => escapeCSV(c.label)).join(",");
  const dataRows = rows.map((row) =>
    exportCols.map((c) => escapeCSV(c.exportValue!(row))).join(",")
  );
  return [headers, ...dataRows].join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  isLoading = false,
  skeletonRows = 5,
  emptyState,
  bulkActions = [],
  onBulkAction,
  exportFilename = "export",
  totalMatchingResults,
  filterToken,
  tableId,
  "data-testid": testId,
  rowProps,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  // Tracks the "select all matching results" mode — distinct from selecting every loaded row.
  // In this mode bulk actions apply to every server-matching record (resolved by the caller),
  // not just the loaded subset. Cleared when filters change or selection is cleared.
  const [selectAllResults, setSelectAllResults] = useState(false);
  const [pageSize, setPageSize] = useState<number>(25);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setSelectAllResults(false);
    setSelectedIds(new Set());
    setPageIndex(0);
  }, [filterToken]);

  const defaultHiddenKeys = useMemo(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)),
    [columns]
  );
  const storageKey = tableId ? `dt-columns-${tableId}` : null;
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => {
    if (!storageKey || typeof window === "undefined") return defaultHiddenKeys;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return defaultHiddenKeys;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter to keys that still exist on the table to avoid stale entries surviving
        // a column rename/removal.
        const validKeys = new Set(columns.map((c) => c.key));
        return new Set((parsed as unknown[]).filter((k): k is string => typeof k === "string" && validKeys.has(k)));
      }
    } catch {
      // Corrupt entry — fall back to defaults.
    }
    return defaultHiddenKeys;
  });

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    // When the user's choice matches the table's defaults, remove the saved entry
    // entirely rather than writing the defaults. This keeps "Reset to defaults"
    // truly clearing storage, and lets future changes to defaultHidden flow through
    // for users who haven't explicitly customized anything.
    const matchesDefaults =
      hiddenKeys.size === defaultHiddenKeys.size &&
      Array.from(hiddenKeys).every((k) => defaultHiddenKeys.has(k));
    try {
      if (matchesDefaults) {
        window.localStorage.removeItem(storageKey);
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify(Array.from(hiddenKeys)));
      }
    } catch {
      // Storage may be unavailable (private mode, quota) — silently ignore.
    }
  }, [hiddenKeys, storageKey, defaultHiddenKeys]);

  function resetColumnsToDefaults() {
    setHiddenKeys(new Set(defaultHiddenKeys));
  }

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenKeys.has(c.key)),
    [columns, hiddenKeys]
  );

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir, columns]);

  const totalRows = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  useEffect(() => {
    if (pageIndex !== safePageIndex) setPageIndex(safePageIndex);
  }, [pageIndex, safePageIndex]);
  const pageStart = totalRows === 0 ? 0 : safePageIndex * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, totalRows);
  const showPagination = totalRows > pageSize;
  const pageRows = useMemo(
    () => (showPagination ? sorted.slice(pageStart, pageEnd) : sorted),
    [sorted, pageStart, pageEnd, showPagination]
  );

  const rowIds = useMemo(() => sorted.map(getRowId), [sorted, getRowId]);
  // In select-all-results mode every loaded row is conceptually part of the selection,
  // even after the user navigates to another page (where selectedIds wouldn't include
  // those rows yet). Treating the whole loaded subset as selected keeps the checkboxes
  // and bulk bar consistent with the user's intent across page changes.
  const allSelected = selectAllResults || (rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id)));
  const someSelected = selectAllResults || rowIds.some((id) => selectedIds.has(id));
  const selectedCount = selectAllResults
    ? rowIds.length
    : rowIds.filter((id) => selectedIds.has(id)).length;

  function toggleAll() {
    // Toggling the header checkbox while in select-all-results mode collapses out of
    // that mode entirely (clears the broad selection); otherwise toggle the page subset.
    if (selectAllResults) {
      setSelectAllResults(false);
      setSelectedIds(new Set());
      return;
    }
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        rowIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        rowIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function toggleRow(id: number) {
    // Per-row interaction in select-all-results mode collapses back to an explicit
    // subset selection (every loaded row minus the one being toggled off).
    if (selectAllResults) {
      setSelectAllResults(false);
      setSelectedIds(new Set(rowIds.filter((rid) => rid !== id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortKey(null);
      setSortDir(null);
    }
  }

  const handleBulkAction = useCallback(
    async (action: string) => {
      const ids = rowIds.filter((id) => selectedIds.has(id));
      if (!onBulkAction) return;
      setBulkLoading(true);
      try {
        // In select-all-results mode the user explicitly opted into "every matching record"
        // so report allSelected=true with the backend total (when known). Otherwise we only
        // report allSelected when every loaded row is in the selection set.
        await onBulkAction(ids, action, {
          allSelected: selectAllResults || (rowIds.length > 0 && ids.length === rowIds.length),
          totalRows: selectAllResults && totalMatchingResults != null ? totalMatchingResults : rowIds.length,
        });
        setSelectedIds(new Set());
        setSelectAllResults(false);
      } finally {
        setBulkLoading(false);
      }
    },
    [rowIds, selectedIds, onBulkAction, selectAllResults, totalMatchingResults]
  );

  function handleExportSelected() {
    const selectedRows = sorted.filter((row) => selectedIds.has(getRowId(row)));
    const csv = buildCSV(visibleColumns, selectedRows);
    if (csv) downloadCSV(csv, `${exportFilename}-selected`);
  }

  function handleExportAll() {
    const csv = buildCSV(visibleColumns, sorted);
    if (csv) downloadCSV(csv, exportFilename);
  }

  function handlePrint() {
    window.print();
  }

  function SortIcon({ colKey }: { colKey: string }) {
    if (sortKey !== colKey) return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    if (sortDir === "asc") return <ChevronUp className="h-3.5 w-3.5 ml-1 text-primary" />;
    return <ChevronDown className="h-3.5 w-3.5 ml-1 text-primary" />;
  }

  return (
    <div className="space-y-2">
      {/* Toolbar — hidden on print */}
      <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
        {/* Bulk action bar — always shown when rows are selected */}
        {(selectedCount > 0 || selectAllResults) && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 bg-muted/60 rounded-md border border-border flex-wrap"
            data-testid="bulk-action-bar"
          >
            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
            {/* When in select-all-results mode the banner intentionally stays visible even
                when the current page has zero selected rows (e.g. user navigated to another
                page in a paginated view). The backend total drives the label so it remains
                accurate independently of which page is currently loaded. */}
            <span className="text-sm font-medium" data-testid="bulk-selected-label">
              {selectAllResults && totalMatchingResults != null
                ? `All ${totalMatchingResults} matching results selected`
                : `${selectedCount} selected`}
            </span>
            {/* Offer to expand selection from "all on page" to "all matching results" when
                the backend total is larger than the loaded subset. With no pagination today
                the totals match and this prompt stays hidden, but the wiring is ready for
                when the rows prop becomes a single page. */}
            {!selectAllResults && allSelected && totalMatchingResults != null && totalMatchingResults > rowIds.length && (
              <Button
                size="sm"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => setSelectAllResults(true)}
                data-testid="button-select-all-results"
              >
                Select all {totalMatchingResults} matching results
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkLoading}
                  className="h-7 text-xs gap-1"
                  data-testid="button-bulk-action"
                >
                  {bulkLoading ? "Working…" : "Actions"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={handleExportSelected} data-testid="bulk-action-export_selected">
                  <Download className="h-3.5 w-3.5 mr-2" /> Export Selected
                </DropdownMenuItem>
                {bulkActions.length > 0 && <DropdownMenuSeparator />}
                {bulkActions.map((action) => (
                  <DropdownMenuItem
                    key={action.value}
                    onSelect={() => handleBulkAction(action.value)}
                    className={action.variant === "destructive" ? "text-destructive" : ""}
                    data-testid={`bulk-action-${action.value}`}
                  >
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setSelectedIds(new Set()); setSelectAllResults(false); }}
              className="h-7 text-xs text-muted-foreground"
            >
              Clear
            </Button>
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                <Columns3 className="h-3.5 w-3.5" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {columns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={!hiddenKeys.has(col.key)}
                  onCheckedChange={(checked) => {
                    setHiddenKeys((prev) => {
                      const next = new Set(prev);
                      if (checked) next.delete(col.key);
                      else next.add(col.key);
                      return next;
                    });
                  }}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              {hiddenKeys.size > 0 && (
                <DropdownMenuItem onSelect={() => setHiddenKeys(new Set())}>
                  Show all
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={resetColumnsToDefaults}
                data-testid="button-reset-columns"
              >
                Reset to defaults
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export */}
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handleExportAll}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>

          {/* Print */}
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto" data-testid={testId}>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-[#f5f5f5]">
                {/* Checkbox column — always present, hidden on print */}
                <th className="py-3 px-4 w-10 print:hidden">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                    data-testid="checkbox-select-all"
                  />
                </th>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap ${
                      col.sortable ? "cursor-pointer select-none hover:text-foreground" : ""
                    }`}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center">
                      {col.label}
                      {col.sortable && <SortIcon colKey={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 1}
                    className="text-center py-12 text-muted-foreground"
                  >
                    {emptyState ?? "No results found"}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, idx) => {
                  const id = getRowId(row);
                  const extra = rowProps?.(row) ?? {};
                  return (
                    <tr
                      key={id}
                      {...extra}
                      className={`border-b border-border last:border-0 transition-colors ${
                        selectedIds.has(id)
                          ? "bg-[#ebebeb]"
                          : idx % 2 === 1
                          ? "bg-[#fafafa] hover:bg-[#f5f5f5]"
                          : "bg-white hover:bg-[#f5f5f5]"
                      } ${extra.className ?? ""}`}
                    >
                      {/* Per-row checkbox — always present, hidden on print */}
                      <td
                        className="py-3 px-4 print:hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedIds.has(id)}
                          onCheckedChange={() => toggleRow(id)}
                          aria-label={`Select row ${id}`}
                        />
                      </td>
                      {visibleColumns.map((col) => (
                        <td key={col.key} className="py-3 px-4 align-middle">
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination footer — hidden on print, only shown when total exceeds page size */}
      {showPagination && (
        <div
          className="flex items-center justify-between gap-2 flex-wrap pt-1 print:hidden"
          data-testid="pagination-controls"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span data-testid="pagination-range">
              Showing {pageStart + 1}–{pageEnd} of {totalRows}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Rows per page</span>
              <select
                className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPageIndex(0);
                }}
                data-testid="select-page-size"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <span className="text-xs text-muted-foreground" data-testid="pagination-page-label">
              Page {safePageIndex + 1} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              disabled={safePageIndex === 0}
              aria-label="Previous page"
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => setPageIndex((i) => Math.min(totalPages - 1, i + 1))}
              disabled={safePageIndex >= totalPages - 1}
              aria-label="Next page"
              data-testid="button-next-page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
