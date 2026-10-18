"use client";

import React, { useState } from "react";
import { Button } from "@geiger/ui/button";
import { SectionCard } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";

/** Shared chart/table card. The table exposes the same values as the visual chart. */
export function ChartCard({ title, description, action, table, children, className, contentClassName, onViewChange }) {
  const [view, setView] = useState("chart");
  const toggle = table ? (
    <div role="group" aria-label={`${title || "Chart"} view`} className="flex items-center gap-1 rounded-lg border border-border bg-surface-card p-0.5">
      {["chart", "table"].map((value) => (
        <Button
          key={value}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={view === value}
          onClick={() => { setView(value); onViewChange?.(value); }}
          className={cn("h-7 px-2.5 text-xs capitalize", view === value ? "bg-surface-active text-foreground" : "text-text-secondary hover:text-foreground")}
        >
          {value}
        </Button>
      ))}
    </div>
  ) : null;
  const columns = table?.columns || [];
  const rows = table?.rows || [];
  return (
    <SectionCard
      title={title}
      description={description}
      className={className}
      contentClassName={contentClassName}
      action={action || toggle ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}{toggle}</div> : undefined}
    >
      {view === "chart" || !table ? children : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-text-tertiary">No data in range.</p>
      ) : (
        <div key="data-table" className="max-h-[320px] overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">{title ? `${title} data table` : "Chart data table"}</caption>
            <thead className="sticky top-0 bg-surface-card"><tr>
              {columns.map((column) => <th key={column.key} scope="col" className={cn("border-b border-border px-3 py-2 font-medium text-text-secondary", column.align === "right" ? "text-right" : "text-left")}>{column.header}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((row, index) => <tr key={table.getRowKey ? table.getRowKey(row, index) : index} className="border-b border-border last:border-0">
                {columns.map((column) => <td key={column.key} className={cn("px-3 py-2 tabular-nums text-foreground", column.align === "right" ? "text-right" : "text-left")}>{typeof column.render === "function" ? column.render(row) : String(row[column.key] ?? "—")}</td>)}
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
