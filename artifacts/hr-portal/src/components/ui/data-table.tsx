import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuCheckboxItem,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronUp, ChevronsUpDown, Download, Printer, SlidersHorizontal, CheckSquare, ListChecks } from "lucide-react";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  defaultHidden?: boolean;
  renderCell: (row: T) => React.ReactNode;
  csvValue?: (row: T) => string | number;
};

export type BulkAction = {
  label: string;
  value: string;
  variant?: "default" | "destructive";
};

type SortDir = "asc" | "desc" | null;

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => number | string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  bulkActions?: BulkAction[];
  onBulkAction?: (ids: (number | string)[], action: string) => void;
  onSelectionChange?: (ids: (number | string)[]) => void;
  isBulkLoading?: boolean;
  caption?: string;
  "data-testid"?: string;
}

function downloadCSV<T>(
  columns: DataTableColumn<T>[],
  data: T[],
  visibleKeys: Set<string>,
  filename = "export.csv"
) {
  const visibleCols = columns.filter((c) => visibleKeys.has(c.key));
  const header = visibleCols.map((c) => `"${c.label}"`).join(",");
  const rows = data.map((row) =>
    visibleCols
      .map((c) => {
        const val = c.csvValue ? c.csvValue(row) : "";
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  const csv = [header, ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  emptyMessage = "No results.",
  onRowClick,
  bulkActions,
  onBulkAction,
  onSelectionChange,
  isBulkLoading,
  "data-testid": testId,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(
    new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key))
  );

  const visibleCols = columns.filter((c) => !hiddenKeys.has(c.key));

  function handleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir(null);
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.csvValue) return data;
    return [...data].sort((a, b) => {
      const av = String(col.csvValue!(a) ?? "").toLowerCase();
      const bv = String(col.csvValue!(b) ?? "").toLowerCase();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const allIds = sorted.map((r) => getRowId(r));
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id));
  const selectedCount = allIds.filter((id) => selectedIds.has(id)).length;

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(allIds.filter((id) => selectedIds.has(id)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, sorted]);

  function toggleAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function toggleRow(id: number | string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(allIds));
  }

  function handleBulk(action: string) {
    const ids = allIds.filter((id) => selectedIds.has(id));
    onBulkAction?.(ids, action);
    setSelectedIds(new Set());
  }

  function handlePrint() {
    window.print();
  }

  function handleExport() {
    const visibleKeys = new Set(visibleCols.map((c) => c.key));
    downloadCSV(columns, sorted, visibleKeys, "export.csv");
  }

  const SortIcon = ({ col }: { col: DataTableColumn<T> }) => {
    if (!col.sortable) return null;
    if (sortKey !== col.key) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />;
    if (sortDir === "asc") return <ChevronUp className="h-3 w-3 ml-1 text-primary" />;
    return <ChevronDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const hasBulk = (bulkActions?.length ?? 0) > 0;

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {hasBulk && selectedCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/20" data-testid="bulk-action-bar">
              <CheckSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{selectedCount} selected</span>
              {!allSelected && allIds.length > selectedCount && (
                <Button
                  size="sm" variant="ghost"
                  onClick={selectAllVisible}
                  className="text-xs text-primary h-7 px-2 gap-1"
                  data-testid="button-select-all-matching"
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  Select all {allIds.length}
                </Button>
              )}
              {allSelected && allIds.length > 1 && (
                <span className="text-xs text-muted-foreground">All {allIds.length} selected</span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={isBulkLoading} className="gap-1 h-7 text-xs">
                    {isBulkLoading ? "Updating…" : "Bulk Action"} <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {bulkActions?.map((a) => (
                    <DropdownMenuItem key={a.value} onSelect={() => handleBulk(a.value)}>
                      {a.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-xs h-7">
                Clear
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto print:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" data-testid="button-columns">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" onClick={handleExport} className="gap-1 h-8 text-xs" data-testid="button-export-csv">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1 h-8 text-xs" data-testid="button-print">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm" data-testid={testId}>
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }} className="border-b border-border">
              {hasBulk && (
                <th className="py-3 px-4 w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                    data-testid="checkbox-select-all"
                  />
                </th>
              )}
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  className={`text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap ${col.sortable ? "cursor-pointer select-none hover:text-foreground" : ""}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  data-testid={`th-${col.key}`}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    <SortIcon col={col} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleCols.length + (hasBulk ? 1 : 0)}
                  className="text-center py-12 text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => {
                const id = getRowId(row);
                const isSelected = selectedIds.has(id);
                return (
                  <tr
                    key={id}
                    className={`border-b border-border last:border-0 transition-colors ${onRowClick ? "cursor-pointer" : ""} ${isSelected ? "bg-primary/5" : i % 2 === 1 ? "bg-[#fafafa]" : "bg-white"} hover:bg-muted/30`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    data-testid={`row-${id}`}
                  >
                    {hasBulk && (
                      <td
                        className="py-3 px-4 w-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(id)}
                          aria-label={`Select row ${id}`}
                        />
                      </td>
                    )}
                    {visibleCols.map((col) => (
                      <td key={col.key} className="py-3 px-4">
                        {col.renderCell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Print stylesheet injected inline */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          nav, aside, header, [data-sidebar], [data-slot="sidebar"] { display: none !important; }
          body > *:not([data-print-target]) aside,
          body > *:not([data-print-target]) nav { display: none !important; }
        }
      `}</style>
    </div>
  );
}
