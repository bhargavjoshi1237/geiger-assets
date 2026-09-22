"use client";

// Shared Apache ECharts kit for the Analytics domain. One wrapper, one theme
// hook, and one option builder per chart shape so all eight analytics screens
// look like a single system.
//
// Consumers must load the chart component through next/dynamic with
// { ssr: false } so echarts never reaches the server bundle:
//   const ChartCard = dynamic(
//     () => import("@/components/internal/shared/chart_kit").then((m) => m.ChartCard),
//     { ssr: false, loading: () => <LoadingArea size={40} /> },
//   );

import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  HeatmapChart,
  LineChart,
  PieChart,
  ScatterChart,
} from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useTheme } from "next-themes";

import { Button } from "@geiger/ui/button";
import { SectionCard } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  HeatmapChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

// Theme ---------------------------------------------------------------------

const FALLBACK_THEME = {
  palette: ["#2563eb", "#059669", "#b45309", "#7c3aed", "#dc2626", "#0891b2"],
  foreground: "#e7e7e7",
  textSecondary: "#737373",
  textTertiary: "#525252",
  border: "#333333",
  surface: "#1a1a1a",
};

function readThemeTokens() {
  if (typeof document === "undefined") return FALLBACK_THEME;
  const computed = getComputedStyle(document.documentElement);
  const get = (name, fallback) =>
    (computed.getPropertyValue(name) || "").trim() || fallback;
  const palette = [1, 2, 3, 4, 5, 6].map((i) =>
    get(`--chart-a${i}`, FALLBACK_THEME.palette[i - 1]),
  );
  return {
    palette,
    foreground: get("--foreground", FALLBACK_THEME.foreground),
    textSecondary: get("--text-secondary", FALLBACK_THEME.textSecondary),
    textTertiary: get("--text-tertiary", FALLBACK_THEME.textTertiary),
    border: get("--border", FALLBACK_THEME.border),
    // Card surface, so stacked-segment gaps and tooltips sit on the panel.
    surface: get("--surface-subtle", FALLBACK_THEME.surface),
  };
}

/**
 * Live suite tokens for charts: the --chart-a1..a6 ramp plus foreground,
 * secondary/tertiary text, border and surface. Recomputes when the
 * next-themes resolved theme flips so charts follow light/dark.
 */
export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const [theme, setTheme] = useState(FALLBACK_THEME);
  useEffect(() => {
    setTheme(readThemeTokens());
  }, [resolvedTheme]);
  return theme;
}

/** Fixed-order series colour: index into the ramp, never by rank, never cycled. */
export function seriesColor(theme, index) {
  if (index < theme.palette.length) return theme.palette[index];
  // A 7th series folds into Other painted with the tertiary text token.
  return theme.textTertiary;
}

// Wrapper -------------------------------------------------------------------

/**
 * Thin echarts wrapper. Owns init/disposal, resize, and theme re-init;
 * pushes new options with setOption(option, notMerge).
 *
 * chartRef (optional) receives the chart instance so callers can export PNG
 * via chartRef.current.getDataURL({ pixelRatio: 2, backgroundColor }).
 */
export function EChart({
  option,
  height = 260,
  className,
  onEvents,
  notMerge = true,
  chartRef,
}) {
  const hostRef = useRef(null);
  const chartRefInner = useRef(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const chart = echarts.init(host, null, { renderer: "canvas" });
    chartRefInner.current = chart;
    if (chartRef) chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRefInner.current = null;
      if (chartRef) chartRef.current = null;
    };
  }, [resolvedTheme, chartRef]);

  useEffect(() => {
    if (chartRefInner.current && option) {
      chartRefInner.current.setOption(option, notMerge);
    }
  }, [option, notMerge, resolvedTheme]);

  useEffect(() => {
    const chart = chartRefInner.current;
    if (!chart || !onEvents) return undefined;
    const offs = Object.entries(onEvents).map(([event, handler]) => {
      chart.on(event, handler);
      return () => chart.off(event, handler);
    });
    return () => {
      offs.forEach((off) => off());
    };
  }, [onEvents]);

  return <div ref={hostRef} className={className} style={{ height }} />;
}

// Shared option grammar -----------------------------------------------------

function axisTooltip(theme) {
  return {
    trigger: "axis",
    axisPointer: { type: "cross" },
    backgroundColor: theme.surface,
    borderColor: theme.border,
    textStyle: { color: theme.foreground, fontSize: 12 },
  };
}

function itemTooltip(theme) {
  return {
    trigger: "item",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    textStyle: { color: theme.foreground, fontSize: 12 },
  };
}

function categoryAxis(theme, data) {
  return {
    type: "category",
    data,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: theme.textTertiary, fontSize: 11 },
  };
}

function valueAxis(theme) {
  return {
    type: "value",
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: theme.textTertiary, fontSize: 11 },
    splitLine: { lineStyle: { color: theme.border, type: "dashed" } },
  };
}

function grid() {
  return { left: 8, right: 12, top: 32, bottom: 0, containLabel: true };
}

/** Legend whenever there are >= 2 series; omitted for a single series. */
function legendFor(theme, names) {
  if (!names || names.length < 2) return undefined;
  return {
    icon: "roundRect",
    textStyle: { color: theme.textSecondary, fontSize: 11 },
  };
}

// Builders ------------------------------------------------------------------
// Each takes (theme, data, opts) and returns a plain ECharts option.

/** Change over time, 1–6 series. data: { categories, series: [{ name, data }] }. */
export function lineOption(theme, data = {}, opts = {}) {
  const series = (data.series || []).slice(0, 6);
  return {
    color: series.map((_, i) => seriesColor(theme, i)),
    tooltip: axisTooltip(theme),
    legend: legendFor(theme, series.map((s) => s.name)),
    grid: grid(),
    xAxis: categoryAxis(theme, data.categories || []),
    yAxis: valueAxis(theme),
    series: series.map((s, i) => ({
      name: s.name,
      type: "line",
      data: s.data || [],
      lineStyle: { width: 2, color: seriesColor(theme, i) },
      itemStyle: { color: seriesColor(theme, i) },
      symbolSize: 8,
      showSymbol: false,
      smooth: false,
      emphasis: { focus: "series" },
      ...(opts.markLine ? { markLine: opts.markLine } : {}),
    })),
  };
}

/** A single cumulative measure over time. data: { categories, name, data }. */
export function areaOption(theme, data = {}, opts = {}) {
  const color = opts.color || seriesColor(theme, opts.colorIndex || 0);
  return {
    color: [color],
    tooltip: axisTooltip(theme),
    grid: grid(),
    xAxis: categoryAxis(theme, data.categories || []),
    yAxis: valueAxis(theme),
    series: [
      {
        name: data.name || "",
        type: "line",
        data: data.data || [],
        lineStyle: { width: 2 },
        symbolSize: 8,
        showSymbol: false,
        smooth: false,
        areaStyle: { opacity: 0.18 },
        emphasis: { focus: "series" },
      },
    ],
  };
}

/** Composition over time. data: { categories, series: [{ name, data }] }. */
export function stackedBarOption(theme, data = {}) {
  const series = (data.series || []).slice(0, 6);
  return {
    color: series.map((_, i) => seriesColor(theme, i)),
    tooltip: axisTooltip(theme),
    legend: legendFor(theme, series.map((s) => s.name)),
    grid: grid(),
    xAxis: categoryAxis(theme, data.categories || []),
    yAxis: valueAxis(theme),
    series: series.map((s, i) => ({
      name: s.name,
      type: "bar",
      stack: "total",
      data: s.data || [],
      barCategoryGap: "35%",
      itemStyle: {
        color: seriesColor(theme, i),
        borderColor: theme.surface,
        borderWidth: 2,
        borderRadius: [4, 4, 0, 0],
      },
      emphasis: { focus: "series" },
    })),
  };
}

/**
 * Ranked magnitude (top assets, top queries). data: { categories, data, name }.
 * Single series — no legend; the card title names it.
 */
export function horizontalBarOption(theme, data = {}, opts = {}) {
  const color = opts.color || seriesColor(theme, opts.colorIndex || 0);
  return {
    color: [color],
    tooltip: itemTooltip(theme),
    grid: { left: 8, right: 36, top: 8, bottom: 0, containLabel: true },
    xAxis: valueAxis(theme),
    yAxis: {
      type: "category",
      data: data.categories || [],
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: theme.textTertiary, fontSize: 11 },
    },
    series: [
      {
        name: data.name || "",
        type: "bar",
        data: data.data || [],
        barCategoryGap: "35%",
        itemStyle: { borderRadius: [0, 4, 4, 0] },
      },
    ],
  };
}

/** Part-to-whole, <= 6 slices. data: { data: [{ name, value }] }. */
export function donutOption(theme, data = {}) {
  const slices = (data.data || []).slice(0, 6);
  return {
    color: slices.map((_, i) => seriesColor(theme, i)),
    tooltip: itemTooltip(theme),
    legend: legendFor(theme, slices.map((s) => s.name)),
    series: [
      {
        type: "pie",
        radius: ["55%", "75%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: theme.surface, borderWidth: 2 },
        label: { color: theme.textSecondary, fontSize: 11 },
        labelLine: { lineStyle: { color: theme.border } },
        data: slices,
      },
    ],
  };
}

/**
 * Two-dimensional density (day x hour).
 * data: { x: [...], y: [...], data: [[xIndex, yIndex, value], ...] }.
 */
export function heatmapOption(theme, data = {}) {
  const values = (data.data || []).map((d) => d[2]);
  return {
    tooltip: itemTooltip(theme),
    grid: { left: 8, right: 12, top: 32, bottom: 0, containLabel: true },
    xAxis: categoryAxis(theme, data.x || []),
    yAxis: {
      type: "category",
      data: data.y || [],
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: theme.textTertiary, fontSize: 11 },
    },
    visualMap: {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 1,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      textStyle: { color: theme.textTertiary, fontSize: 11 },
      inRange: { color: [theme.border, seriesColor(theme, 0)] },
    },
    series: [
      {
        type: "heatmap",
        data: data.data || [],
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: theme.border } },
      },
    ],
  };
}

/** Inline trend inside a stat tile — no axes, no legend. data: { data }. */
export function sparklineOption(theme, data = {}, opts = {}) {
  const color = opts.color || seriesColor(theme, opts.colorIndex || 0);
  return {
    color: [color],
    grid: { left: 0, right: 0, top: 2, bottom: 2 },
    xAxis: { type: "category", data: (data.data || []).map((_, i) => i), show: false },
    yAxis: { type: "value", show: false },
    series: [
      {
        type: "line",
        data: data.data || [],
        lineStyle: { width: 2 },
        symbolSize: 8,
        showSymbol: false,
        smooth: false,
      },
    ],
  };
}

// ChartCard -----------------------------------------------------------------

/**
 * SectionCard with a built-in chart/table toggle. The table view is the
 * accessibility escape hatch and renders the same rows the chart shows.
 *
 * table: { columns: [{ key, header, align? }], rows: [...], getRowKey? }.
 * When table is omitted the card renders the chart with no toggle.
 */
export function ChartCard({
  title,
  description,
  action,
  height = 260,
  table,
  children,
  className,
  contentClassName,
}) {
  const [view, setView] = useState("chart");
  const showToggle = Boolean(table);

  const toggle = showToggle ? (
    <div
      role="group"
      aria-label={`${title || "Chart"} view`}
      className="flex items-center gap-1 rounded-lg border border-border bg-surface-card p-0.5"
    >
      {["chart", "table"].map((v) => (
        <Button
          key={v}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={view === v}
          onClick={() => setView(v)}
          className={cn(
            "h-7 px-2.5 text-xs capitalize",
            view === v
              ? "bg-surface-active text-foreground"
              : "text-text-secondary hover:text-foreground",
          )}
        >
          {v}
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
      action={
        action || toggle ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {action}
            {toggle}
          </div>
        ) : undefined
      }
    >
      {view === "chart" || !showToggle ? (
        children
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-text-tertiary">
          No data in range.
        </p>
      ) : (
        <div className="max-h-[320px] overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">
              {title ? `${title} data table` : "Chart data table"}
            </caption>
            <thead className="sticky top-0 bg-surface-card">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "border-b border-border px-3 py-2 font-medium text-text-secondary",
                      col.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={table.getRowKey ? table.getRowKey(row, i) : i}
                  className="border-b border-border last:border-0"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-3 py-2 tabular-nums text-foreground",
                        col.align === "right" ? "text-right" : "text-left",
                      )}
                    >
                      {typeof col.render === "function"
                        ? col.render(row)
                        : String(row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
