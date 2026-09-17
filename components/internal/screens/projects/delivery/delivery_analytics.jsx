"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, Gauge, Globe, Trophy } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Badge } from "@geiger/ui/badge";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SectionCard,
  StatsBar,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import { listAssets } from "@/lib/supabase/assets";
import { getDailySeries, getProjectUsage } from "@/lib/media/usage";
import { listDeliveryEvents } from "@/lib/supabase/delivery";
import {
  SERIES_RANGE_OPTIONS,
  formatBytes,
  formatCount,
  formatDate,
} from "./constants";

// Delivery Analytics — what happened after distribution.
//
// KPIs come from what lib/media/usage.js actually returns: the per-project
// rollup (lifetime served bytes and events plus current stored totals) and the
// daily series bucketed from the delivery log. Top assets and transformation
// usage are aggregations over recent delivery events in this screen.
//
// Two cards stay visibly unmeasured rather than estimated: cache-hit ratio
// (the log records bytes served, not edge hits vs origin fetches, and CDN
// hops bypass metering entirely) and geography (events carry no region).

function Bar({ value, max, label }) {
  const height = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1" title={label}>
      <div className="flex h-36 w-full items-end rounded-md bg-surface-card px-0.5 py-1">
        <div
          className="w-full rounded-sm bg-primary/80 transition-all"
          style={{ height: `${height}%` }}
        />
      </div>
    </div>
  );
}

export function DeliveryAnalyticsScreen({ projectId }) {
  const [usage, setUsage] = useState(null);
  const [series, setSeries] = useState([]);
  const [events, setEvents] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [range, setRange] = useState("30");
  const [metric, setMetric] = useState("deliveries");

  useEffect(() => {
    let alive = true;
    Promise.all([
      getProjectUsage(projectId),
      getDailySeries(projectId, { days: 30 }),
      listDeliveryEvents(projectId, { limit: 1000 }),
      listAssets(projectId),
    ]).then(([usageRow, daily, eventRows, assetRows]) => {
      if (!alive) return;
      setUsage(usageRow);
      setSeries(daily ?? []);
      setEvents(eventRows ?? []);
      setAssets(assetRows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    getDailySeries(projectId, { days: Number(range) }).then((daily) => {
      if (!alive) return;
      setSeries(daily ?? []);
      setSeriesLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId, range, loading]);

  const changeRange = (value) => {
    setSeriesLoading(true);
    setRange(value);
  };

  const assetById = useMemo(() => {
    const map = new Map();
    for (const asset of assets) map.set(asset.id, asset);
    return map;
  }, [assets]);

  const stats = useMemo(() => {
    const servedEvents = usage?.servedEventsTotal ?? 0;
    const servedBytes = usage?.servedBytesTotal ?? 0;
    const avg = servedEvents > 0 ? Math.round(servedBytes / servedEvents) : 0;
    return [
      { label: "Requests", value: formatCount(servedEvents), footer: "lifetime deliveries" },
      { label: "Bandwidth", value: formatBytes(servedBytes), footer: "lifetime bytes served" },
      { label: "Avg response", value: formatBytes(avg), footer: "bytes per request" },
      {
        label: "Stored",
        value: formatBytes(usage?.storedBytes ?? 0),
        footer: `${formatCount(usage?.storedObjects ?? 0)} objects live`,
      },
    ];
  }, [usage]);

  const seriesMax = useMemo(
    () =>
      series.reduce(
        (max, point) => Math.max(max, metric === "bytes" ? point.bytesServed : point.deliveries),
        0,
      ),
    [series, metric],
  );

  const topAssets = useMemo(() => {
    const byAsset = new Map();
    for (const event of events) {
      const key = event.assetId || "deleted";
      const entry = byAsset.get(key) || { assetId: event.assetId, requests: 0, bytes: 0 };
      entry.requests += 1;
      entry.bytes += event.bytesServed;
      byAsset.set(key, entry);
    }
    return [...byAsset.values()]
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10);
  }, [events]);

  const variantUsage = useMemo(() => {
    const byVariant = new Map();
    for (const event of events) {
      const key = event.variant || "original";
      const entry = byVariant.get(key) || { variant: key, requests: 0, bytes: 0 };
      entry.requests += 1;
      entry.bytes += event.bytesServed;
      byVariant.set(key, entry);
    }
    const rows = [...byVariant.values()].sort((a, b) => b.bytes - a.bytes);
    const max = rows.reduce((m, row) => Math.max(m, row.bytes), 0);
    return { rows, max };
  }, [events]);

  const hasTraffic = (usage?.servedEventsTotal ?? 0) > 0 || events.length > 0;

  const topColumns = [
    {
      key: "asset",
      header: "Asset",
      render: (row) => {
        const asset = row.assetId ? assetById.get(row.assetId) : null;
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="max-w-[260px] truncate font-medium text-foreground">
              {asset?.name || (row.assetId ? `Asset ${String(row.assetId).slice(0, 8)}` : "Deleted asset")}
            </span>
            <span className="truncate text-xs text-text-secondary">
              {[asset?.type, asset?.format].filter(Boolean).join(" · ") || "—"}
            </span>
          </div>
        );
      },
    },
    {
      key: "requests",
      header: "Requests",
      align: "right",
      className: "text-right tabular-nums text-xs",
      render: (row) => formatCount(row.requests),
    },
    {
      key: "bytes",
      header: "Bandwidth",
      align: "right",
      className: "text-right tabular-nums text-xs",
      render: (row) => formatBytes(row.bytes),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Delivery Analytics"
        description="Measure how assets perform after distribution."
        actions={
          <FilterDropdown
            value={range}
            onValueChange={changeRange}
            options={SERIES_RANGE_OPTIONS}
            height="h-9"
          />
        }
      />

      <StatsBar stats={stats} />

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading delivery analytics" />
        </div>
      ) : !hasTraffic ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={BarChart3}
            title="No deliveries recorded yet"
            description="Requests, bandwidth, and top assets appear here once the delivery routes start metering."
          />
        </div>
      ) : (
        <div className="space-y-6">
          <SectionCard
            title={`Daily ${metric === "bytes" ? "bandwidth" : "requests"}`}
            description={`Last ${range} days, bucketed in UTC with zero-filled gaps.`}
            action={
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-card p-1">
                {[
                  { value: "deliveries", label: "Requests" },
                  { value: "bytes", label: "Bandwidth" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMetric(option.value)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      metric === option.value
                        ? "bg-surface-active text-foreground"
                        : "text-text-secondary hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            }
          >
            {seriesLoading ? (
              <div className="flex items-center justify-center py-12">
                <LogoLoading size={40} aria-label="Loading daily series" />
              </div>
            ) : series.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-secondary">
                No daily buckets in this window.
              </p>
            ) : (
              <div>
                <div className="flex items-stretch gap-1">
                  {series.map((point) => (
                    <Bar
                      key={point.date}
                      value={metric === "bytes" ? point.bytesServed : point.deliveries}
                      max={seriesMax}
                      label={`${formatDate(point.date)} — ${metric === "bytes" ? formatBytes(point.bytesServed) : `${formatCount(point.deliveries)} requests`}`}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-text-tertiary">
                  <span>{formatDate(series[0]?.date)}</span>
                  <span>{formatDate(series[series.length - 1]?.date)}</span>
                </div>
              </div>
            )}
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Top delivered assets"
              description="Ranked by bytes across recent delivery events."
            >
              <DataTable
                columns={topColumns}
                data={topAssets}
                getRowKey={(row) => row.assetId || "deleted"}
                empty={
                  <EmptyState
                    icon={Trophy}
                    title="No per-asset detail"
                    description="Recent delivery events carry no asset rows yet."
                  />
                }
              />
            </SectionCard>

            <SectionCard
              title="Transformation usage"
              description="Which variants and encodings actually get served."
            >
              {variantUsage.rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">
                  No variant detail in recent events.
                </p>
              ) : (
                <div className="space-y-3">
                  {variantUsage.rows.map((row) => (
                    <div key={row.variant} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex items-center gap-2">
                          <Badge variant="neutral">{row.variant || "original"}</Badge>
                          <span className="text-text-secondary">
                            {formatCount(row.requests)} requests
                          </span>
                        </span>
                        <span className="tabular-nums text-text-secondary">
                          {formatBytes(row.bytes)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-card">
                        <div
                          className="h-full rounded-full bg-primary/80"
                          style={{
                            width: `${variantUsage.max > 0 ? Math.max(2, Math.round((row.bytes / variantUsage.max) * 100)) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Cache-hit ratio"
              description="Why this card stays empty."
            >
              <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-card px-3 py-2.5 text-sm text-text-secondary">
                <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                <span>
                  The delivery log records bytes served, not edge hits versus origin
                  fetches — and CDN redirects bypass metering by design. Hit ratio needs
                  an instrumented edge or provider logs; it is not estimated here.
                </span>
              </div>
            </SectionCard>

            <SectionCard
              title="Geographic breakdown"
              description="Why this card stays empty."
            >
              <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-card px-3 py-2.5 text-sm text-text-secondary">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                <span>
                  Delivery events carry no region — geography is not collected on the
                  hot path. Per-region volume lives in the CDN provider logs once an
                  origin is named.
                </span>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      <Toolbar>
        <span className="text-xs text-text-tertiary">
          Lifetime totals come from the project rollup; per-day and per-asset detail expires with the delivery log retention window.
        </span>
      </Toolbar>
    </MainScreenWrapper>
  );
}

export default DeliveryAnalyticsScreen;
