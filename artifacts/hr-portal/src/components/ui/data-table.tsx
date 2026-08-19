import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, ChevronsLeft,
  ChevronsRight, Download, Printer, Columns3, CheckSquare, Search, SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  defaultHidden?: boolean;
  /** Columns are resizable by default. Set false for utility/action columns. */
  resizable?: boolean;
  minWidth?: number;
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
type ExportFormat = "csv" | "tsv" | "json";

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => number;
  isLoading?: boolean;
  skeletonRows?: number;
  emptyState?: React.ReactNode;
  bulkActions?: DataTableBulkAction[];
  onBulkAction?: (ids: number[], action: string, meta: { allSelected: boolean; totalRows: number }) => void | Promise<void>;
  bulkProgress?: { done: number; total: number } | null;
  exportFilename?: string;
  totalMatchingResults?: number;
  filterToken?: string;
  /** Persist the user's column visibility and widths. Defaults to exportFilename. */
  tableId?: string;
  /** Enables the standard global search bar. Defaults to true. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Optional more precise search text for rows that do not expose export values. */
  getSearchText?: (row: T) => string;
  "data-testid"?: string;
  rowProps?: (row: T) => React.HTMLAttributes<HTMLTableRowElement>;
};

function escapeDelimited(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes("\n")) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function exportColumns<T>(columns: DataTableColumn<T>[]) {
  return columns.filter((column) => column.exportValue);
}

function buildDelimited<T>(columns: DataTableColumn<T>[], rows: T[], delimiter: string): string {
  const cols = exportColumns(columns);
  if (!cols.length) return "";
  return [
    cols.map((column) => escapeDelimited(column.label, delimiter)).join(delimiter),
    ...rows.map((row) => cols.map((column) => escapeDelimited(column.exportValue!(row), delimiter)).join(delimiter)),
  ].join("\n");
}

function buildJson<T>(columns: DataTableColumn<T>[], rows: T[]): string {
  const cols = exportColumns(columns);
  return JSON.stringify(rows.map((row) => Object.fromEntries(cols.map((column) => [column.label, column.exportValue!(row)]))), null, 2);
}

function downloadFile(contents: string, filename: string, format: ExportFormat) {
  const type = format === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8";
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function PageJumpInput({ currentPage, totalPages, onJump }: { currentPage: number; totalPages: number; onJump: (page: number) => void }) {
  const [value, setValue] = useState(String(currentPage));
  useEffect(() => setValue(String(currentPage)), [currentPage]);
  function commit() {
    const parsed = Number.parseInt(value, 10);
    const page = Number.isFinite(parsed) ? Math.min(Math.max(1, parsed), totalPages) : currentPage;
    if (page !== currentPage) onJump(page);
    setValue(String(page));
  }
  return <Input type="number" min={1} max={totalPages} value={value} onChange={(event) => setValue(event.target.value)} onBlur={commit}
    onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); if (event.key === "Escape") setValue(String(currentPage)); (event.target as HTMLInputElement).blur(); } }}
    aria-label="Jump to page" data-testid="input-page-jump" className="h-7 w-14 px-1.5 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />;
}

/**
 * The portal-wide table standard. New list pages should use this component instead of a
 * hand-built `<table>` so sorting, column preferences, filters, exports, pagination and
 * selection remain consistent for every role.
 */
export function DataTable<T>({
  columns, rows, getRowId, isLoading = false, skeletonRows = 5, emptyState, bulkActions = [], onBulkAction,
  bulkProgress = null, exportFilename = "export", totalMatchingResults, filterToken, tableId,
  searchable = true, searchPlaceholder = "Search this table…", getSearchText, "data-testid": testId, rowProps,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectAllResults, setSelectAllResults] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [advancedColumn, setAdvancedColumn] = useState("all");
  const [advancedSearch, setAdvancedSearch] = useState("");
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const defaultHiddenKeys = useMemo(() => new Set(columns.filter((column) => column.defaultHidden).map((column) => column.key)), [columns]);
  const resolvedTableId = tableId ?? exportFilename;
  const visibilityStorageKey = `dt-columns-${resolvedTableId}`;
  const widthsStorageKey = `dt-widths-${resolvedTableId}`;
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return defaultHiddenKeys;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(visibilityStorageKey) ?? "null");
      const validKeys = new Set(columns.map((column) => column.key));
      if (Array.isArray(parsed)) return new Set(parsed.filter((key): key is string => typeof key === "string" && validKeys.has(key)));
    } catch { /* storage is optional */ }
    return defaultHiddenKeys;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(widthsStorageKey) ?? "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const validKeys = new Set(columns.map((column) => column.key));
        setColumnWidths(Object.fromEntries(Object.entries(parsed).filter(([key, value]) => validKeys.has(key) && typeof value === "number" && value >= 60)));
      }
    } catch { /* storage is optional */ }
  // Preferences intentionally load once per table identity, not on each column render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widthsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(widthsStorageKey, JSON.stringify(columnWidths)); } catch { /* storage is optional */ }
  }, [columnWidths, widthsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const matchesDefaults = hiddenKeys.size === defaultHiddenKeys.size && [...hiddenKeys].every((key) => defaultHiddenKeys.has(key));
    try {
      if (matchesDefaults) window.localStorage.removeItem(visibilityStorageKey);
      else window.localStorage.setItem(visibilityStorageKey, JSON.stringify([...hiddenKeys]));
    } catch { /* storage is optional */ }
  }, [hiddenKeys, visibilityStorageKey, defaultHiddenKeys]);

  useEffect(() => { setSelectAllResults(false); setSelectedIds(new Set()); setPageIndex(0); }, [filterToken]);
  useEffect(() => { setPageIndex(0); }, [search, advancedColumn, advancedSearch, pageSize]);

  const visibleColumns = useMemo(() => columns.filter((column) => !hiddenKeys.has(column.key)), [columns, hiddenKeys]);
  const valueForColumn = useCallback((row: T, key: string) => {
    const column = columns.find((candidate) => candidate.key === key);
    return column?.exportValue ? column.exportValue(row) : "";
  }, [columns]);
  const searchableText = useCallback((row: T) => {
    if (getSearchText) return getSearchText(row).toLocaleLowerCase();
    const exported = columns.map((column) => column.exportValue?.(row) ?? "").join(" ");
    return (exported || JSON.stringify(row)).toLocaleLowerCase();
  }, [columns, getSearchText]);
  const filtered = useMemo(() => {
    const globalTerm = search.trim().toLocaleLowerCase();
    const advancedTerm = advancedSearch.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      if (globalTerm && !searchableText(row).includes(globalTerm)) return false;
      if (!advancedTerm) return true;
      const text = advancedColumn === "all" ? searchableText(row) : valueForColumn(row, advancedColumn).toLocaleLowerCase();
      return text.includes(advancedTerm);
    });
  }, [rows, search, advancedSearch, advancedColumn, searchableText, valueForColumn]);
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const column = columns.find((candidate) => candidate.key === sortKey);
    if (!column?.sortValue) return filtered;
    return [...filtered].sort((a, b) => {
      const av = column.sortValue!(a); const bv = column.sortValue!(b);
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * (sortDir === "asc" ? 1 : -1);
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalRows = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  useEffect(() => { if (pageIndex !== safePageIndex) setPageIndex(safePageIndex); }, [pageIndex, safePageIndex]);
  const pageStart = totalRows ? safePageIndex * pageSize : 0;
  const pageEnd = Math.min(pageStart + pageSize, totalRows);
  const showPagination = totalRows > pageSize;
  const pageRows = useMemo(() => showPagination ? sorted.slice(pageStart, pageEnd) : sorted, [sorted, showPagination, pageStart, pageEnd]);
  const rowIds = useMemo(() => sorted.map(getRowId), [sorted, getRowId]);
  const allSelected = selectAllResults || (rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id)));
  const someSelected = selectAllResults || rowIds.some((id) => selectedIds.has(id));
  const selectedCount = selectAllResults ? rowIds.length : rowIds.filter((id) => selectedIds.has(id)).length;

  function toggleAll() {
    if (selectAllResults) { setSelectAllResults(false); setSelectedIds(new Set()); return; }
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (allSelected) rowIds.forEach((id) => next.delete(id)); else rowIds.forEach((id) => next.add(id));
      return next;
    });
  }
  function toggleRow(id: number) {
    if (selectAllResults) { setSelectAllResults(false); setSelectedIds(new Set(rowIds.filter((rowId) => rowId !== id))); return; }
    setSelectedIds((previous) => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function handleSort(key: string) {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortKey(null); setSortDir(null); }
  }
  function resetColumns() { setHiddenKeys(new Set(defaultHiddenKeys)); setColumnWidths({}); }
  function resetFilters() { setSearch(""); setAdvancedColumn("all"); setAdvancedSearch(""); }
  function startResize(event: React.PointerEvent<HTMLSpanElement>, column: DataTableColumn<T>) {
    event.preventDefault(); event.stopPropagation();
    const header = event.currentTarget.closest("th");
    const initialWidth = columnWidths[column.key] ?? header?.getBoundingClientRect().width ?? 160;
    const startX = event.clientX;
    const onMove = (moveEvent: PointerEvent) => setColumnWidths((previous) => ({ ...previous, [column.key]: Math.max(column.minWidth ?? 90, Math.round(initialWidth + moveEvent.clientX - startX)) }));
    const onEnd = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onEnd); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onEnd);
  }
  const exportRows = (format: ExportFormat, selected = false) => {
    const data = selected ? sorted.filter((row) => selectedIds.has(getRowId(row))) : sorted;
    const contents = format === "json" ? buildJson(visibleColumns, data) : buildDelimited(visibleColumns, data, format === "csv" ? "," : "\t");
    if (contents) downloadFile(contents, selected ? `${exportFilename}-selected` : exportFilename, format);
  };
  const handleBulkAction = useCallback(async (action: string) => {
    if (!onBulkAction) return;
    const ids = rowIds.filter((id) => selectedIds.has(id));
    setBulkLoading(true);
    try {
      await onBulkAction(ids, action, { allSelected: selectAllResults || (rowIds.length > 0 && ids.length === rowIds.length), totalRows: selectAllResults && totalMatchingResults != null ? totalMatchingResults : rowIds.length });
      setSelectedIds(new Set()); setSelectAllResults(false);
    } finally { setBulkLoading(false); }
  }, [onBulkAction, rowIds, selectedIds, selectAllResults, totalMatchingResults]);
  const SortIcon = ({ columnKey }: { columnKey: string }) => sortKey !== columnKey ? <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-40" /> : sortDir === "asc" ? <ChevronUp className="ml-1 h-3.5 w-3.5 text-primary" /> : <ChevronDown className="ml-1 h-3.5 w-3.5 text-primary" />;

  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
      {searchable && <div className="relative min-w-[220px] flex-1 max-w-md"><Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} className="h-8 pl-8 text-xs" data-testid="input-table-search" /></div>}
      {(selectedCount > 0 || selectAllResults) && <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/60 rounded-md border border-border flex-wrap" data-testid="bulk-action-bar">
        <CheckSquare className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium" data-testid="bulk-selected-label">{selectAllResults && totalMatchingResults != null ? `All ${totalMatchingResults} matching results selected` : `${selectedCount} selected`}</span>
        {!selectAllResults && allSelected && totalMatchingResults != null && totalMatchingResults > rowIds.length && <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => setSelectAllResults(true)}>Select all {totalMatchingResults} matching results</Button>}
        {bulkLoading && bulkProgress && bulkProgress.total > 0 && <span className="text-xs text-muted-foreground">Updated {bulkProgress.done} / {bulkProgress.total}</span>}
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={bulkLoading} className="h-7 text-xs">{bulkLoading ? "Working…" : "Actions"}</Button></DropdownMenuTrigger><DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => exportRows("csv", true)}><Download className="mr-2 h-3.5 w-3.5" />Export selected CSV</DropdownMenuItem>
          {bulkActions.length > 0 && <DropdownMenuSeparator />}
          {bulkActions.map((action) => <DropdownMenuItem key={action.value} onSelect={() => handleBulkAction(action.value)} className={action.variant === "destructive" ? "text-destructive" : ""}>{action.label}</DropdownMenuItem>)}
        </DropdownMenuContent></DropdownMenu>
        <Button size="sm" variant="ghost" onClick={() => { setSelectedIds(new Set()); setSelectAllResults(false); }} className="h-7 text-xs text-muted-foreground">Clear</Button>
      </div>}
      <div className="flex items-center gap-1.5 ml-auto flex-wrap">
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" />Filters</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-72 p-3" onCloseAutoFocus={(event) => event.preventDefault()}>
          <p className="mb-2 text-xs font-medium">Advanced search</p><select value={advancedColumn} onChange={(event) => setAdvancedColumn(event.target.value)} className="mb-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="all">All searchable fields</option>{columns.filter((column) => column.exportValue).map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select>
          <Input value={advancedSearch} onChange={(event) => setAdvancedSearch(event.target.value)} placeholder="Contains…" className="h-8 text-xs" /><Button size="sm" variant="ghost" onClick={resetFilters} className="mt-2 h-7 px-0 text-xs"><RotateCcw className="mr-1 h-3.5 w-3.5" />Clear filters</Button>
        </DropdownMenuContent></DropdownMenu>
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"><Columns3 className="h-3.5 w-3.5" />Columns</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48">{columns.map((column) => <DropdownMenuCheckboxItem key={column.key} checked={!hiddenKeys.has(column.key)} onCheckedChange={(checked) => setHiddenKeys((previous) => { const next = new Set(previous); checked ? next.delete(column.key) : next.add(column.key); return next; })}>{column.label}</DropdownMenuCheckboxItem>)}<DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setHiddenKeys(new Set())}>Show all</DropdownMenuItem><DropdownMenuItem onSelect={resetColumns} data-testid="button-reset-columns">Reset columns & widths</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"><Download className="h-3.5 w-3.5" />Export</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => exportRows("csv")}>CSV spreadsheet</DropdownMenuItem><DropdownMenuItem onSelect={() => exportRows("tsv")}>TSV spreadsheet</DropdownMenuItem><DropdownMenuItem onSelect={() => exportRows("json")}>JSON data</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" />Print</Button>
      </div>
    </div>
    <div className="rounded-md border overflow-x-auto" data-testid={testId}><table className="w-full text-sm table-fixed"><thead><tr className="border-b border-border bg-[#f5f5f5]"><th className="py-3 px-4 w-10 print:hidden"><Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={toggleAll} aria-label="Select all" data-testid="checkbox-select-all" /></th>{visibleColumns.map((column) => <th key={column.key} style={columnWidths[column.key] ? { width: columnWidths[column.key] } : undefined} className={`relative text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap ${column.sortable ? "cursor-pointer select-none hover:text-foreground" : ""}`} onClick={column.sortable ? () => handleSort(column.key) : undefined}><span className="inline-flex max-w-full items-center truncate">{column.label}{column.sortable && <SortIcon columnKey={column.key} />}</span>{column.resizable !== false && <span role="separator" aria-orientation="vertical" aria-label={`Resize ${column.label} column`} onPointerDown={(event) => startResize(event, column)} className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none hover:bg-primary/20" />}</th>)}</tr></thead><tbody>{totalRows === 0 ? <tr><td colSpan={visibleColumns.length + 1} className="text-center py-12 text-muted-foreground">{emptyState ?? "No results found"}</td></tr> : pageRows.map((row, index) => { const id = getRowId(row); const extra = rowProps?.(row) ?? {}; return <tr key={id} {...extra} className={`border-b border-border last:border-0 transition-colors ${selectedIds.has(id) ? "bg-[#ebebeb]" : index % 2 ? "bg-[#fafafa] hover:bg-[#f5f5f5]" : "bg-white hover:bg-[#f5f5f5]"} ${extra.className ?? ""}`}><td className="py-3 px-4 print:hidden" onClick={(event) => event.stopPropagation()}><Checkbox checked={selectedIds.has(id)} onCheckedChange={() => toggleRow(id)} aria-label={`Select row ${id}`} /></td>{visibleColumns.map((column) => <td key={column.key} style={columnWidths[column.key] ? { width: columnWidths[column.key] } : undefined} className="py-3 px-4 align-middle overflow-hidden">{column.render(row)}</td>)}</tr>; })}</tbody></table>{isLoading && <div className="p-4 space-y-3">{Array.from({ length: skeletonRows }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>}</div>
    {showPagination && <div className="flex items-center justify-between gap-2 flex-wrap pt-1 print:hidden" data-testid="pagination-controls"><span className="text-xs text-muted-foreground" data-testid="pagination-range">Showing {pageStart + 1}–{pageEnd} of {totalRows}</span><div className="flex items-center gap-2"><label className="flex items-center gap-1.5 text-xs text-muted-foreground">Rows per page<select className="h-7 rounded-md border border-input bg-background px-1.5 text-xs" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} data-testid="select-page-size"><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label><Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setPageIndex(0)} disabled={safePageIndex === 0} aria-label="First page"><ChevronsLeft className="h-3.5 w-3.5" /></Button><Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setPageIndex((index) => Math.max(0, index - 1))} disabled={safePageIndex === 0} aria-label="Previous page"><ChevronLeft className="h-3.5 w-3.5" /></Button><span className="text-xs text-muted-foreground inline-flex items-center gap-1">Page <PageJumpInput currentPage={safePageIndex + 1} totalPages={totalPages} onJump={(page) => setPageIndex(page - 1)} /> of {totalPages}</span><Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setPageIndex((index) => Math.min(totalPages - 1, index + 1))} disabled={safePageIndex >= totalPages - 1} aria-label="Next page"><ChevronRight className="h-3.5 w-3.5" /></Button><Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setPageIndex(totalPages - 1)} disabled={safePageIndex >= totalPages - 1} aria-label="Last page"><ChevronsRight className="h-3.5 w-3.5" /></Button></div></div>}
  </div>;
}
