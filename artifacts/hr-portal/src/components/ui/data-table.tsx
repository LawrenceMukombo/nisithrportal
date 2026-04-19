import { useState, useMemo, useCallback } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Download, Printer, Columns3, CheckSquare } from "lucide-react";
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
  onBulkAction?: (ids: number[], action: string) => void | Promise<void>;
  exportFilename?: string;
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
  "data-testid": testId,
  rowProps,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const defaultHiddenKeys = useMemo(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)),
    [columns]
  );
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(defaultHiddenKeys);

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

  const rowIds = useMemo(() => sorted.map(getRowId), [sorted, getRowId]);
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id));
  const someSelected = rowIds.some((id) => selectedIds.has(id));
  const selectedCount = rowIds.filter((id) => selectedIds.has(id)).length;

  function toggleAll() {
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
        await onBulkAction(ids, action);
        setSelectedIds(new Set());
      } finally {
        setBulkLoading(false);
      }
    },
    [rowIds, selectedIds, onBulkAction]
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
        {selectedCount > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 bg-muted/60 rounded-md border border-border"
            data-testid="bulk-action-bar"
          >
            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium">{selectedCount} selected</span>
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
              onClick={() => setSelectedIds(new Set())}
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
              {hiddenKeys.size > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setHiddenKeys(new Set())}>
                    Show all
                  </DropdownMenuItem>
                </>
              )}
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
                sorted.map((row, idx) => {
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
    </div>
  );
}
