"use client";

import React, { useId, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList,
  Line, LineChart, Pie, PieChart, XAxis, YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@geiger/ui/chart";
import { ChartCard } from "@/components/internal/shared/chart_card";
import { formatBytes, formatCurrency, formatNumber } from "./constants";
import { buildDonutData, getDonutSelection } from "./analytics_chart_data.mjs";

const CHART_INK = "var(--color-foreground)";
const SERIES_OPACITY = [1, 0.76, 0.56, 0.38, 0.24];
const AXIS = "var(--color-text-tertiary)";
const GRID = "var(--color-border)";

function display(value, format, currency) {
  if (format === "bytes") return formatBytes(value);
  if (format === "currency") return formatCurrency(value, currency);
  return formatNumber(value);
}

function axisValue(value, chart) {
  const amount = Number(value) || 0;
  if (chart.format === "bytes" || chart.format === "currency") return display(amount, chart.format, chart.currency);
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(amount);
}

function dateLabel(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(5) : value;
}

export function chartRows(chart) {
  if (chart.rows) return chart.rows.map((row) => ({ label: row.label, value: row.value }));
  if (chart.series) return chart.categories.map((label, index) => ({
    label,
    ...Object.fromEntries(chart.series.map((series) => [series.name, series.data[index] ?? 0])),
  }));
  return chart.categories.map((label, index) => ({ label, value: chart.values[index] ?? 0 }));
}

export function chartHasValues(chart) {
  return chartRows(chart).some((row) => Object.entries(row).some(([key, value]) => key !== "label" && Number(value) > 0));
}

function chartTable(chart) {
  return {
    columns: [
      { key: "label", header: chart.type === "bar" || chart.type === "donut" ? "Category" : "Date" },
      ...(chart.series || [{ name: chart.name || "Value" }]).map((series) => ({
        key: chart.series ? series.name : "value",
        header: series.name,
        align: "right",
        render: (row) => display(row[chart.series ? series.name : "value"], chart.format, chart.currency),
      })),
    ],
    rows: chartRows(chart),
    getRowKey: (row) => row.label,
  };
}

function TooltipContent({ chart, ...props }) {
  return (
    <ChartTooltipContent
      {...props}
      indicator="line"
      formatter={(value, name, item) => (
        <div className="flex min-w-[110px] flex-1 items-center justify-between gap-3">
          <span className="text-muted-foreground">{item?.payload?.name || name}</span>
          <span className="font-mono font-medium tabular-nums text-foreground">{display(value, chart.format, chart.currency)}</span>
        </div>
      )}
    />
  );
}

function TimelineChart({ chart, gradientId }) {
  const isArea = chart.type === "area";
  const series = chart.series || [{ name: chart.name || "Value", data: chart.values }];
  const data = chart.categories.map((label, index) => ({
    label,
    ...Object.fromEntries(series.map((item, seriesIndex) => [`series${seriesIndex}`, Number(item.data[index]) || 0])),
  }));
  const config = Object.fromEntries(series.map((item, index) => [`series${index}`, { label: item.name, color: CHART_INK }]));
  const Chart = isArea ? AreaChart : LineChart;

  return (
    <ChartContainer config={config} className="h-[280px] w-full min-w-0">
      <Chart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
        {isArea ? <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-series0)" stopOpacity={0.3} /><stop offset="95%" stopColor="var(--color-series0)" stopOpacity={0.02} /></linearGradient></defs> : null}
        <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={28} tickFormatter={dateLabel} tick={{ fill: AXIS, fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={64} tickFormatter={(value) => axisValue(value, chart)} tick={{ fill: AXIS, fontSize: 11 }} />
        <ChartTooltip cursor={false} content={<TooltipContent chart={chart} />} />
        {series.map((item, index) => isArea ? (
          <Area key={item.name} type="monotone" dataKey={`series${index}`} name={item.name} stroke={`var(--color-series${index})`} strokeOpacity={SERIES_OPACITY[index % SERIES_OPACITY.length]} fill={`url(#${gradientId})`} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive animationDuration={850} />
        ) : (
          <Line key={item.name} type="monotone" dataKey={`series${index}`} name={item.name} stroke={`var(--color-series${index})`} strokeOpacity={SERIES_OPACITY[index % SERIES_OPACITY.length]} strokeDasharray={index ? "5 4" : undefined} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive animationDuration={850} />
        ))}
      </Chart>
    </ChartContainer>
  );
}

function RankedChart({ chart }) {
  const data = [...chart.rows].reverse();
  return (
    <ChartContainer config={{ value: { label: chart.title, color: CHART_INK } }} className="h-[280px] w-full min-w-0">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 46, left: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="3 4" />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={106} tickMargin={8} tickFormatter={(value) => value.length > 17 ? `${value.slice(0, 16)}…` : value} tick={{ fill: AXIS, fontSize: 11 }} />
        <ChartTooltip cursor={false} content={<TooltipContent chart={chart} hideLabel />} />
        <Bar dataKey="value" name={chart.title} fill="var(--color-value)" radius={[0, 5, 5, 0]} maxBarSize={22} isAnimationActive animationDuration={750}>
          <LabelList dataKey="value" position="right" className="fill-muted-foreground" fontSize={10} formatter={(value) => axisValue(value, chart)} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function DonutChart({ chart }) {
  const fileMix = chart.variant === "fileMix";
  const [selectedKey, setSelectedKey] = useState(null);
  const data = buildDonutData(chart.rows).map((row) => ({ ...row, fill: CHART_INK }));
  const config = Object.fromEntries(data.map((row) => [row.key, { label: row.name, color: row.fill }]));
  const total = data.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
  const { activeIndex, selected } = getDonutSelection(data, selectedKey);
  return (
    <div className={fileMix ? "flex min-h-[280px] flex-col items-center gap-2" : "flex min-h-[280px] flex-col items-center gap-2 sm:flex-row"}>
      <div className={fileMix ? "relative h-[220px] w-[220px]" : "relative h-[220px] w-full min-w-0 sm:w-[54%]"}>
        <ChartContainer config={config} className={fileMix ? "h-full w-full" : "h-full w-full min-w-0"}>
          <PieChart>
            <ChartTooltip cursor={false} content={<TooltipContent chart={chart} hideLabel nameKey="key" />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              innerRadius={fileMix ? 44 : 64}
              outerRadius={fileMix ? 78 : 86}
              activeIndex={fileMix ? activeIndex : undefined}
              activeShape={fileMix ? { outerRadius: 88 } : undefined}
              onMouseEnter={fileMix ? (_, index) => setSelectedKey(data[index]?.key || selectedKey) : undefined}
              paddingAngle={fileMix ? 0 : 2}
              stroke="var(--surface-subtle)"
              strokeWidth={2}
              isAnimationActive
              animationDuration={850}
            >
              {data.map((row) => <Cell key={row.key} fill={row.fill} fillOpacity={row.opacity} />)}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className={fileMix ? "text-3xl font-bold leading-none text-foreground" : "text-lg font-semibold tabular-nums text-foreground"}>
            {display(fileMix ? selected?.value : total, chart.format, chart.currency)}
          </span>
          <span className={fileMix ? "mt-1 text-xs font-medium text-muted-foreground" : "text-[10px] uppercase tracking-wider text-text-tertiary"}>
            {fileMix ? selected?.name : "Total"}
          </span>
        </div>
      </div>
      {fileMix ? (
        <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3" aria-label={`${chart.title} categories`}>
          {data.map((row) => (
            <button
              key={row.key}
              type="button"
              aria-pressed={row.key === data[activeIndex]?.key}
              onClick={() => setSelectedKey(row.key)}
              className="flex items-center justify-between gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.fill, opacity: row.opacity }} />
                <span className="truncate" title={row.name}>{row.name}</span>
              </span>
              <span className="shrink-0 tabular-nums">{Math.round((row.value / total) * 100)}%</span>
            </button>
          ))}
        </div>
      ) : (
        <ul className="grid w-full min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-1" aria-label={`${chart.title} categories`}>
          {data.map((row) => <li key={row.key} className="flex min-w-0 items-center gap-2 text-xs">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.fill, opacity: row.opacity }} />
            <span className="min-w-0 flex-1 truncate text-text-secondary" title={row.name}>{row.name}</span>
            <span className="shrink-0 font-mono tabular-nums text-foreground">{display(row.value, chart.format, chart.currency)}</span>
          </li>)}
        </ul>
      )}
    </div>
  );
}

export function AnalyticsChart({ chart, chartRef, table }) {
  const id = useId().replace(/:/g, "");
  return (
    <ChartCard title={chart.title} description={chart.description} table={table || chartTable(chart)}>
      {chartHasValues(chart) ? (
        <div ref={chartRef} className="min-w-0">
          {chart.type === "bar" ? <RankedChart chart={chart} /> : chart.type === "donut" ? <DonutChart chart={chart} /> : <TimelineChart chart={chart} gradientId={`analytics-gradient-${id}`} />}
        </div>
      ) : (
        <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-sm text-text-secondary">No data in the selected period.</div>
      )}
    </ChartCard>
  );
}
