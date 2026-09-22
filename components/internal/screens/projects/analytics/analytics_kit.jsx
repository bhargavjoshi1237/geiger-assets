"use client";

// Screen-level primitives shared by all eight analytics screens: the range
// toolbar, the period-over-period badge, the CSV/PNG export menu, and the
// two-column chart grid.

import React from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { ActionMenu } from "@geiger/ui/action-menu";

import { FilterDropdown } from "@/components/internal/shared/module_kit";
import { Toolbar } from "@/components/internal/shared/screen_kit";
import { RANGE_OPTIONS } from "./constants";

/**
 * Toolbar with the RANGE_OPTIONS filter on the left and caller controls
 * (search / extra filters / export) on the right.
 */
export function RangeToolbar({ range, onRange, children }) {
  return (
    <Toolbar>
      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          value={range}
          onValueChange={onRange}
          options={RANGE_OPTIONS}
          height="h-9"
        />
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </Toolbar>
  );
}

/**
 * Period-over-period change badge. Renders emerald-400 up / red-400 down;
 * null when previous is 0 (no basis for a ratio).
 */
export function DeltaBadge({ current, previous }) {
  const prev = Number(previous || 0);
  if (!prev) return null;
  const ratio = (Number(current || 0) - prev) / prev;
  if (!Number.isFinite(ratio) || ratio === 0) return null;
  const up = ratio > 0;
  return (
    <span
      className={
        up
          ? "text-xs font-medium text-emerald-400"
          : "text-xs font-medium text-red-400"
      }
    >
      {up ? "+" : ""}
      {(ratio * 100).toFixed(1)}%
    </span>
  );
}

function toCsv(rows) {
  const list = rows || [];
  if (list.length === 0) return "";
  const headers = [...new Set(list.flatMap((row) => Object.keys(row || {})))];
  const escape = (value) => {
    if (value === null || value === undefined) return "";
    const str =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(",")];
  for (const row of list) lines.push(headers.map((h) => escape(row?.[h])).join(","));
  return lines.join("\n");
}

/**
 * Export menu: CSV serialises rows client-side (Blob + object URL); PNG reads
 * the live chart instance via chartRef. Toasts on success; the screen owns
 * every other toast.
 */
export function ExportButton({ rows, filename = "export", chartRef }) {
  const exportCsv = () => {
    const csv = toCsv(rows);
    if (!csv) {
      toast.error("Nothing to export yet.");
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV exported.");
  };

  const exportPng = () => {
    const chart = chartRef?.current;
    if (!chart || typeof chart.getDataURL !== "function") {
      toast.error("Chart isn't ready yet — try again in a moment.");
      return;
    }
    try {
      const surface =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--surface-subtle")
          .trim() || "#1a1a1a";
      const url = chart.getDataURL({ pixelRatio: 2, backgroundColor: surface });
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PNG exported.");
    } catch (e) {
      console.error("[analytics.export.png]", e);
      toast.error("Couldn't export the PNG.");
    }
  };

  return (
    <ActionMenu
      label="Export"
      icon={Download}
      items={[
        { icon: Download, label: "Export CSV", onSelect: exportCsv },
        { icon: Download, label: "Export PNG", onSelect: exportPng },
      ]}
    />
  );
}

export function ChartGrid({ children, className }) {
  return <div className={className || "grid gap-4 lg:grid-cols-2"}>{children}</div>;
}
