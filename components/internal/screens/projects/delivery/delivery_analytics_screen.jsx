"use client";

import React, { useMemo, useRef, useState } from "react";
import { BarChart3 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, LoadingArea, ScreenHeader, StatsBar } from "@/components/internal/shared/screen_kit";
import { useModuleRows } from "@/components/internal/shared/module_kit";
import { AnalyticsChart, chartHasValues, chartRows } from "../analytics/analytics_chart";
import { ChartGrid, ExportButton, RangeToolbar } from "../analytics/analytics_kit";
import { dayKey, formatBytes, formatNumber, formatPercent, lastDays } from "../analytics/constants";
import { listDeliveryDaily, listDeliveryEvents } from "@/lib/supabase/delivery";
import { listAssets } from "@/lib/supabase/assets";

const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
const group = (rows, label, amount = () => 1) => {
  const counts = new Map();
  for (const row of rows) {
    const name = label(row);
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + (Number(amount(row)) || 0));
  }
  return [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 7);
};

export function DeliveryAnalyticsScreen({ projectId }) {
  const [daily, , dailyLoading] = useModuleRows(listDeliveryDaily, projectId);
  const [events, , eventsLoading] = useModuleRows(listDeliveryEvents, projectId);
  const [assets, , assetsLoading] = useModuleRows(listAssets, projectId);
  const [range, setRange] = useState("30");
  const chartRef = useRef(null);
  const loading = dailyLoading || eventsLoading || assetsLoading;

  const model = useMemo(() => {
    const days = lastDays(Number(range));
    const start = days[0];
    const totals = daily.filter((row) => !row.assetId && dayKey(row.day) >= start);
    const slices = daily.filter((row) => row.assetId && dayKey(row.day) >= start);
    const recentEvents = events.filter((row) => dayKey(row.occurredAt) >= start);
    const byDay = new Map(totals.map((row) => [dayKey(row.day), row]));
    const names = new Map(assets.map((asset) => [asset.id, asset.name]));
    const dailySeries = days.map((day) => byDay.get(day) || {});
    const hits = sum(totals, "hits");
    const misses = sum(totals, "misses");
    const enabled = assets.filter((asset) => asset.cdnEnabled).length;
    const geo = new Map();
    for (const row of totals) {
      for (const [country, count] of Object.entries(row.countries || {})) {
        geo.set(country, (geo.get(country) || 0) + (Number(count) || 0));
      }
    }
    const charts = [
      {
        type: "area", title: "Bandwidth over time", description: "Bytes served each day",
        categories: days, name: "Bandwidth", values: dailySeries.map((row) => Number(row.bytes) || 0), format: "bytes",
      },
      {
        type: "line", title: "Cache performance", description: "Cache hits and misses each day",
        categories: days, series: [
          { name: "Hits", data: dailySeries.map((row) => Number(row.hits) || 0) },
          { name: "Misses", data: dailySeries.map((row) => Number(row.misses) || 0) },
        ],
      },
      {
        type: "bar", title: "Top delivered assets", description: "Requests by asset in the selected period",
        rows: group(slices, (row) => names.get(row.assetId) || "Unknown asset", (row) => row.requests),
      },
      {
        type: "bar", title: "Geographic delivery", description: "Requests by country from the daily rollup",
        rows: [...geo].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 7),
      },
      {
        type: "donut", title: "Transform formats", description: "Formats in recent delivery events",
        rows: group(recentEvents.filter((event) => event.transform?.format), (event) => event.transform.format),
      },
      {
        type: "donut", title: "CDN coverage", description: "Enabled assets across the current library",
        rows: [{ label: "Enabled", value: enabled }, { label: "Not enabled", value: assets.length - enabled }],
      },
    ];
    return {
      hasData: totals.length > 0 || slices.length > 0,
      charts,
      stats: [
        { label: "Delivery requests", value: formatNumber(sum(totals, "requests")), footer: "Selected period" },
        { label: "Bandwidth", value: formatBytes(sum(totals, "bytes")), footer: "Selected period" },
        { label: "Cache hit ratio", value: formatPercent(hits / (hits + misses || 1)), footer: "Hits / served" },
        { label: "CDN coverage", value: `${enabled}/${assets.length}`, footer: "Enabled assets" },
      ],
    };
  }, [assets, daily, events, range]);

  const exportRows = useMemo(() => model.charts.flatMap((chart) => chartRows(chart).map((row) => ({ chart: chart.title, ...row }))), [model]);
  const exportChartIndex = model.charts.findIndex(chartHasValues);

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Delivery Analytics" description="Requests, bandwidth, cache performance, geography, and transforms after distribution." />
      <StatsBar stats={model.stats} />
      <RangeToolbar range={range} onRange={setRange}>
        <span className="hidden text-xs text-text-tertiary sm:inline">Daily delivery rollup</span>
        <ExportButton rows={model.hasData ? exportRows : []} filename="delivery-analytics" chartRef={chartRef} />
      </RangeToolbar>
      {loading ? (
        <LoadingArea panel size={56} label="Loading analytics…" />
      ) : !model.hasData ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={BarChart3} title="No delivery data yet" description="Delivery charts appear after files are served through the CDN." />
        </div>
      ) : (
        <ChartGrid>
          {model.charts.map((chart, index) => <AnalyticsChart key={chart.title} chart={chart} chartRef={index === exportChartIndex ? chartRef : undefined} />)}
        </ChartGrid>
      )}
    </MainScreenWrapper>
  );
}

export default DeliveryAnalyticsScreen;
