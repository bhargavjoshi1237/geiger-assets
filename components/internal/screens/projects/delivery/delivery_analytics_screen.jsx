"use client";

import React, { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SectionCard,
  StatsBar,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { FilterDropdown, useModuleRows } from "@/components/internal/shared/module_kit";
import { cn } from "@/lib/utils";

import {
  formatBytes,
  formatDate,
  formatPercent,
} from "./constants";
import { listDeliveryDaily, listDeliveryEvents } from "@/lib/supabase/delivery";
import { listAssets } from "@/lib/supabase/assets";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
];

function dayKey(value) {
  return String(value || "").slice(0, 10);
}

function lastDays(n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function BarRow({ label, value, display, max, tone = "bg-primary" }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-xs text-text-secondary">{label}</span>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-active">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${width}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">{display}</span>
    </div>
  );
}

export function DeliveryAnalyticsScreen({ projectId }) {
  const [daily] = useModuleRows(listDeliveryDaily, projectId);
  const [events] = useModuleRows(listDeliveryEvents, projectId);
  const [assets] = useModuleRows(listAssets, projectId);
  const [range, setRange] = useState("14");

  const loading = daily === null || events === null || assets === null;
  const days = useMemo(() => lastDays(Number(range) || 14), [range]);
  const daySet = useMemo(() => new Set(days), [days]);

  const totals = useMemo(
    () => (daily ?? []).filter((d) => !d.assetId && daySet.has(dayKey(d.day))),
    [daily, daySet],
  );
  const slices = useMemo(
    () => (daily ?? []).filter((d) => d.assetId && daySet.has(dayKey(d.day))),
    [daily, daySet],
  );

  const assetName = useMemo(() => {
    const map = new Map((assets ?? []).map((a) => [a.id, a.name]));
    return (id) => map.get(id) || "Unknown asset";
  }, [assets]);

  const stats = useMemo(() => {
    const requests = totals.reduce((s, d) => s + d.requests, 0);
    const bytes = totals.reduce((s, d) => s + d.bytes, 0);
    const hits = totals.reduce((s, d) => s + d.hits, 0);
    const served = hits + totals.reduce((s, d) => s + d.misses, 0);
    const enabled = (assets ?? []).filter((a) => a.cdnEnabled).length;
    return {
      requests,
      bytes,
      ratio: served ? hits / served : 0,
      enabled,
      total: (assets ?? []).length,
    };
  }, [totals, assets]);

  const series = useMemo(() => {
    const byDay = new Map(totals.map((d) => [dayKey(d.day), d]));
    return days.map((day) => {
      const d = byDay.get(day);
      return { day, bytes: d?.bytes || 0, requests: d?.requests || 0, hits: d?.hits || 0, misses: d?.misses || 0 };
    });
  }, [totals, days]);

  const topAssets = useMemo(() => {
    const map = new Map();
    for (const d of slices) {
      const entry = map.get(d.assetId) || { requests: 0, bytes: 0 };
      entry.requests += d.requests;
      entry.bytes += d.bytes;
      map.set(d.assetId, entry);
    }
    return [...map.entries()]
      .map(([assetId, v]) => ({ assetId, name: assetName(assetId), ...v }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 8);
  }, [slices, assetName]);

  const geo = useMemo(() => {
    const map = new Map();
    for (const d of totals) {
      for (const [country, count] of Object.entries(d.countries || {})) {
        map.set(country, (map.get(country) || 0) + Number(count) || 0);
      }
    }
    return [...map.entries()]
      .map(([country, requests]) => ({ country, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 8);
  }, [totals]);

  /** Transform mix needs event-level detail — daily rows carry no transform. */
  const transforms = useMemo(() => {
    const formats = new Map();
    const fits = new Map();
    for (const e of events ?? []) {
      const t = e.transform || {};
      if (t.format) formats.set(t.format, (formats.get(t.format) || 0) + 1);
      if (t.fit) fits.set(t.fit, (fits.get(t.fit) || 0) + 1);
    }
    const top = (map) =>
      [...map.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    return { formats: top(formats), fits: top(fits) };
  }, [events]);

  const maxBytes = Math.max(1, ...series.map((s) => s.bytes));
  const maxRequests = Math.max(1, ...topAssets.map((a) => a.requests));
  const maxGeo = Math.max(1, ...geo.map((g) => g.requests));
  const maxFormat = Math.max(1, ...transforms.formats.map((f) => f.count));

  const statItems = [
    { label: "Delivery requests", value: stats.requests.toLocaleString("en-US"), footer: `Last ${range} days` },
    { label: "Bandwidth", value: formatBytes(stats.bytes), footer: `Last ${range} days` },
    { label: "Cache-hit ratio", value: formatPercent(stats.ratio), footer: "Hits / served" },
    { label: "CDN coverage", value: `${stats.enabled}/${stats.total}`, footer: "CDN-enabled assets" },
  ];

  const topColumns = [
    {
      key: "asset",
      header: "Asset",
      render: (a) => (
        <div className="min-w-0">
          <p className="max-w-[240px] truncate text-sm font-medium text-foreground">{a.name}</p>
          <p className="font-mono text-[11px] tabular-nums text-text-tertiary">{formatBytes(a.bytes)}</p>
        </div>
      ),
    },
    {
      key: "requests",
      header: "Requests",
      align: "right",
      className: "text-right tabular-nums text-foreground",
      render: (a) => a.requests.toLocaleString("en-US"),
    },
  ];

  const hasDaily = (daily ?? []).length > 0;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Delivery Analytics"
        description="How assets perform after distribution — requests, bandwidth, hits, geography, and transforms."
      />

      <StatsBar stats={statItems} />

      <Toolbar>
        <FilterDropdown value={range} onValueChange={setRange} options={RANGE_OPTIONS} height="h-9" />
        <p className="text-xs text-text-tertiary">Aggregated from the daily rollup.</p>
      </Toolbar>

      {loading ? (
        <LoadingArea panel size={56} label="Loading analytics…" />
      ) : !hasDaily ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={BarChart3}
            title="No delivery data yet"
            description="Serves are logged to delivery events and rolled up daily — analytics appear once files flow through the CDN."
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Bandwidth over time" description={`Bytes served per day · last ${range} days`}>
              <div className="space-y-2">
                {series.map((s) => (
                  <BarRow
                    key={s.day}
                    label={formatDate(s.day)}
                    value={s.bytes}
                    display={formatBytes(s.bytes)}
                    max={maxBytes}
                    tone="bg-blue-400"
                  />
                ))}
              </div>
            </SectionCard>
            <SectionCard title="Cache-hit ratio" description="Hits vs misses per day — higher is cheaper.">
              <div className="space-y-2">
                {series.map((s) => {
                  const total = s.hits + s.misses;
                  const ratio = total ? s.hits / total : 0;
                  return (
                    <BarRow
                      key={s.day}
                      label={formatDate(s.day)}
                      value={ratio}
                      display={total ? formatPercent(ratio) : "—"}
                      max={1}
                      tone="bg-emerald-400"
                    />
                  );
                })}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Top delivered assets" description="By requests in range.">
              {topAssets.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-text-tertiary">
                  Per-asset slices land here once serves carry an asset id.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {topAssets.map((a) => (
                      <BarRow key={a.assetId} label={a.name} value={a.requests} display={a.requests.toLocaleString("en-US")} max={maxRequests} />
                    ))}
                  </div>
                  <DataTable columns={topColumns} data={topAssets} getRowKey={(a) => a.assetId} />
                </div>
              )}
            </SectionCard>
            <SectionCard title="Geographic delivery" description="Request countries from the daily rollup.">
              {geo.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-text-tertiary">
                  No country data yet — serves without a country header aggregate here once present.
                </p>
              ) : (
                <div className="space-y-2">
                  {geo.map((g) => (
                    <BarRow key={g.country} label={g.country} value={g.requests} display={g.requests.toLocaleString("en-US")} max={maxGeo} tone="bg-violet-400" />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Transformation usage" description="Formats negotiated at delivery time (event detail).">
              {transforms.formats.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-text-tertiary">
                  No transformed serves logged yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {transforms.formats.map((f) => (
                    <BarRow key={f.label} label={f.label} value={f.count} display={String(f.count)} max={maxFormat} tone="bg-amber-400" />
                  ))}
                  {transforms.fits.map((f) => (
                    <BarRow key={`fit-${f.label}`} label={`fit: ${f.label}`} value={f.count} display={String(f.count)} max={maxFormat} tone="bg-sky-400" />
                  ))}
                </div>
              )}
            </SectionCard>
            <SectionCard title="CDN coverage" description="CDN-enabled assets vs the whole library.">
              <div className="flex items-center gap-3">
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-active">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${stats.total ? Math.round((stats.enabled / stats.total) * 100) : 0}%` }}
                  />
                </div>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground">
                  {stats.enabled}/{stats.total}
                </span>
              </div>
              <p className="mt-3 text-xs text-text-secondary">
                Toggle assets onto the CDN from CDN Delivery — coverage grows as more masters are edge-served.
              </p>
            </SectionCard>
          </div>
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default DeliveryAnalyticsScreen;
