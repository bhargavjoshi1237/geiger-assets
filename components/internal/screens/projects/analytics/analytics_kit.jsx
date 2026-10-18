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
          ? "text-xs font-medium text-emerald-600 dark:text-emerald-400"
          : "text-xs font-medium text-red-600 dark:text-red-400"
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

  const exportPng = async () => {
    const host = chartRef?.current;
    const svg = host?.querySelector?.("svg.recharts-surface");
    if (!svg) {
      toast.error("Chart isn't ready yet — try again in a moment.");
      return;
    }
    try {
      const bounds = svg.getBoundingClientRect();
      const width = Math.ceil(bounds.width);
      const height = Math.ceil(bounds.height);
      if (!width || !height) throw new Error("Chart has no visible size");
      const clone = svg.cloneNode(true);
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));
      const originalNodes = [svg, ...svg.querySelectorAll("*")];
      const clonedNodes = [clone, ...clone.querySelectorAll("*")];
      originalNodes.forEach((node, index) => {
        const computed = getComputedStyle(node);
        const target = clonedNodes[index];
        for (const property of ["fill", "stroke", "color", "fontFamily", "fontSize", "fontWeight", "opacity", "stopColor"]) {
          const value = computed[property];
          if (value && !value.startsWith("url(")) target.style[property] = value;
        }
      });
      const svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
      const image = new Image();
      image.src = svgUrl;
      await image.decode();
      URL.revokeObjectURL(svgUrl);
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      const surface =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--surface-subtle")
          .trim() || "#1a1a1a";
      context.fillStyle = surface;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/png");
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
