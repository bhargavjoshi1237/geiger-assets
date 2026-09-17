"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, LogoLoading } from "@geiger/ui";

import { Badge } from "@geiger/ui/badge";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import { listAssets } from "@/lib/supabase/assets";
import { listDeliveryEvents } from "@/lib/supabase/delivery";
import { getDailySeries } from "@/lib/media/usage";
import { listAssetEvents } from "@/lib/supabase/analytics";
import {
  ASSET_EVENT_KIND_FILTER_OPTIONS,
  CHART_SERIES,
  RANGE_OPTIONS,
  bucketByDay,
  formatBytes,
  formatCount,
  formatDate,
  inRange,
  rangeDays,
} from "./constants";

// Asset Analytics — how individual assets are found and used.
//
// Counts come from what the backend actually records: the asset_events log
// (views, downloads, shares, embeds written by the app) for engagement, and
// the delivery log (delivery_events via lib/media/usage.js) for served bytes
// and variant mix. Anything with no rows renders an empty state — engagement
// is never estimated.

function hostOf(event) {
  const meta = event?.metadata;
  const host = event?.host || meta?.host || meta?.referrer || event?.referrer || "";
  return String(host).trim();
}

export function AssetAnalyticsScreen({ projectId }) {
  const [events, setEvents] = useState([]);
  const [deliveryEvents, setDeliveryEvents] = useState([]);
  const [series, setSeries] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [range, setRange] = useState("30");
  const [kindFilter, setKindFilter] = useState("all");
  const [search, setSearch] = useState("");

  const handleRangeChange = (value) => {
    setSeriesLoading(true);
    setRange(value);
  };

  useEffect(() => {
    let alive = true;
    Promise.all([
      listAssetEvents(projectId),
      listDeliveryEvents(projectId, { limit: 1000 }),
      getDailySeries(projectId, { days: 30 }),
      listAssets(projectId),
    ]).then(([eventRows, deliveryRows, daily, assetRows]) => {
      if (!alive) return;
      setEvents(eventRows ?? []);
      setDeliveryEvents(deliveryRows ?? []);
      setSeries(daily ?? []);
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
    getDailySeries(projectId, { days: rangeDays(range) }).then((daily) => {
      if (!alive) return;
      setSeries(daily ?? []);
      setSeriesLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId, range, loading]);

  const assetById = useMemo(() => {
    const map = new Map();
    for (const asset of assets) map.set(asset.id, asset);
    return map;
  }, [assets]);

  const rangeEvents = useMemo(
    () => events.filter((event) => inRange(event.createdAt, range)),
    [events, range],
  );

  const stats = useMemo(() => {
    const count = (kind) => rangeEvents.filter((event) => event.kind === kind).length;
    const window = `in the last ${rangeDays(range)} days`;
    return [
      { label: "Views", value: formatCount(count("view")), footer: window },
      { label: "Downloads", value: formatCount(count("download")), footer: window },
      { label: "Shares", value: formatCount(count("share")), footer: window },
      { label: "Embeds", value: formatCount(count("embed")), footer: window },
    ];
  }, [rangeEvents, range]);

  const trend = useMemo(() => {
    const days = rangeDays(range);
    const views = bucketByDay(
      rangeEvents.filter((event) => event.kind === "view"),
      days,
      () => 1,
    );
    const downloads = bucketByDay(
      rangeEvents.filter((event) => event.kind === "download"),
      days,
      () => 1,
    );
    return views.map((bucket, i) => ({
      date: bucket.date,
      views: bucket.value,
      downloads: downloads[i]?.value ?? 0,
    }));
  }, [rangeEvents, range]);

  const rangeBandwidth = useMemo(
    () => series.reduce((sum, point) => sum + (Number(point.bytesServed) || 0), 0),
    [series],
  );

  const topAssets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const byAsset = new Map();
    for (const event of rangeEvents) {
      if (kindFilter !== "all" && event.kind !== kindFilter) continue;
      const key = event.assetId || "deleted";
      const entry = byAsset.get(key) || {
        assetId: event.assetId,
        views: 0,
        downloads: 0,
        shares: 0,
        embeds: 0,
      };
      if (event.kind === "view") entry.views += 1;
      else if (event.kind === "download") entry.downloads += 1;
      else if (event.kind === "share") entry.shares += 1;
      else if (event.kind === "embed") entry.embeds += 1;
      byAsset.set(key, entry);
    }
    return [...byAsset.values()]
      .map((entry) => ({
        ...entry,
        total: entry.views + entry.downloads + entry.shares + entry.embeds,
        name: entry.assetId ? assetById.get(entry.assetId)?.name || "" : "",
      }))
      .filter((entry) => {
        if (!needle) return true;
        const asset = entry.assetId ? assetById.get(entry.assetId) : null;
        return `${asset?.name || ""} ${asset?.type || ""}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [rangeEvents, kindFilter, search, assetById]);

  const locations = useMemo(() => {
    const byHost = new Map();
    for (const event of rangeEvents) {
      const host = hostOf(event);
      if (!host) continue;
      const entry = byHost.get(host) || { host, events: 0 };
      entry.events += 1;
      byHost.set(host, entry);
    }
    return [...byHost.values()].sort((a, b) => b.events - a.events).slice(0, 10);
  }, [rangeEvents]);

  const variantUsage = useMemo(() => {
    const byVariant = new Map();
    for (const event of deliveryEvents) {
      const key = event.variant || "original";
      const entry = byVariant.get(key) || { variant: key, requests: 0, bytes: 0 };
      entry.requests += 1;
      entry.bytes += event.bytesServed;
      byVariant.set(key, entry);
    }
    const rows = [...byVariant.values()].sort((a, b) => b.bytes - a.bytes).slice(0, 8);
    const max = rows.reduce((m, row) => Math.max(m, row.bytes), 0);
    return { rows, max };
  }, [deliveryEvents]);

  const filtersActive = kindFilter !== "all" || search.trim() !== "";
  const hasEngagement = events.length > 0 || deliveryEvents.length > 0;

  const clearFilters = () => {
    setKindFilter("all");
    setSearch("");
  };

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
      key: "views",
      header: "Views",
      align: "right",
      className: "text-right tabular-nums text-xs",
      render: (row) => formatCount(row.views),
    },
    {
      key: "downloads",
      header: "Downloads",
      align: "right",
      className: "text-right tabular-nums text-xs",
      render: (row) => formatCount(row.downloads),
    },
    {
      key: "shares",
      header: "Shares",
      align: "right",
      className: "hidden text-right tabular-nums text-xs md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (row) => formatCount(row.shares),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      className: "text-right tabular-nums text-xs font-medium text-foreground",
      render: (row) => formatCount(row.total),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Asset Analytics"
        description="Understand how individual assets are found and used."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={range} onValueChange={handleRangeChange} options={RANGE_OPTIONS} height="h-9" />
          <FilterDropdown
            value={kindFilter}
            onValueChange={setKindFilter}
            options={ASSET_EVENT_KIND_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search assets…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading asset analytics" />
        </div>
      ) : !hasEngagement ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={BarChart3}
            title="No asset engagement recorded yet"
            description="Views, downloads, shares, and embeds appear here once the app starts recording asset events."
          />
        </div>
      ) : (
        <div className="space-y-6">
          <SectionCard
            title="Performance over time"
            description={`Views and downloads per day for the last ${rangeDays(range)} days, zero-filled. ${formatBytes(rangeBandwidth)} served in window.`}
          >
            {seriesLoading ? (
              <div className="flex items-center justify-center py-12">
                <LogoLoading size={40} aria-label="Loading performance trend" />
              </div>
            ) : (
              <ChartContainer
                config={{
                  views: { label: "Views", color: CHART_SERIES[0] },
                  downloads: { label: "Downloads", color: CHART_SERIES[1] },
                }}
                className="h-[240px] w-full"
              >
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} className="stroke-border/50" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    tickFormatter={(value) => formatDate(value).replace(/, \d{4}$/, "")}
                  />
                  <YAxis tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Area
                    dataKey="views"
                    type="monotone"
                    stroke={CHART_SERIES[0]}
                    fill={CHART_SERIES[0]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                  <Area
                    dataKey="downloads"
                    type="monotone"
                    stroke={CHART_SERIES[1]}
                    fill={CHART_SERIES[1]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </SectionCard>

          <SectionCard
            title="Top assets"
            description="Ranked by total engagement in the selected window."
          >
            <DataTable
              columns={topColumns}
              data={topAssets}
              getRowKey={(row) => row.assetId || "deleted"}
              empty={
                <EmptyState
                  icon={BarChart3}
                  title={filtersActive ? "No assets match these filters" : "No engagement in this window"}
                  description={
                    filtersActive
                      ? "Try a different event kind or search term."
                      : "Recorded events fall outside the selected range."
                  }
                  action={
                    filtersActive ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-xs font-medium text-foreground underline underline-offset-4"
                      >
                        Clear filters
                      </button>
                    ) : null
                  }
                />
              }
            />
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Usage locations"
              description="Hosts and referrers recorded on engagement events."
            >
              {locations.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">
                  No location detail recorded — events carry no host or referrer yet, so
                  nothing is estimated here.
                </p>
              ) : (
                <div className="space-y-3">
                  {locations.map((row) => (
                    <div key={row.host} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-foreground">{row.host}</span>
                      <span className="shrink-0 tabular-nums text-text-secondary">
                        {formatCount(row.events)} events
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Variant mix"
              description="Which delivery variants actually get served."
            >
              {variantUsage.rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">
                  No delivery detail in recent events.
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
          </div>
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default AssetAnalyticsScreen;
