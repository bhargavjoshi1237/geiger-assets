"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Globe } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, LogoLoading } from "@geiger/ui";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

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
import { listPortalVisits } from "@/lib/supabase/analytics";
import {
  CHART_SERIES,
  RANGE_OPTIONS,
  bucketByDay,
  formatCount,
  formatDate,
  formatPercent,
  inRange,
  rangeDays,
} from "./constants";

// Portal Analytics — who visits shared portals and what they take.
//
// Every number derives from the portal_visits log (portal key, asset,
// visit/download/signup kind, referrer, optional country). Geography is only
// ever what a caller recorded on the event — the log carries no tracking by
// default, so an empty geography card says so instead of guessing.

export function PortalAnalyticsScreen({ projectId }) {
  const [visits, setVisits] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([listPortalVisits(projectId), listAssets(projectId)]).then(([visitRows, assetRows]) => {
      if (!alive) return;
      setVisits(visitRows ?? []);
      setAssets(assetRows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const assetById = useMemo(() => {
    const map = new Map();
    for (const asset of assets) map.set(asset.id, asset);
    return map;
  }, [assets]);

  const rangeVisits = useMemo(
    () => visits.filter((visit) => inRange(visit.createdAt, range)),
    [visits, range],
  );

  const stats = useMemo(() => {
    const visitCount = rangeVisits.filter((v) => v.kind === "visit").length;
    const downloads = rangeVisits.filter((v) => v.kind === "download").length;
    const signups = rangeVisits.filter((v) => v.kind === "signup").length;
    return [
      { label: "Visitors", value: formatCount(visitCount), footer: `last ${rangeDays(range)} days` },
      { label: "Downloads", value: formatCount(downloads), footer: "from portals" },
      { label: "Signups", value: formatCount(signups), footer: "from portals" },
      {
        label: "Conversion",
        value: formatPercent(visitCount ? downloads / visitCount : NaN),
        footer: "downloads per visit",
      },
    ];
  }, [rangeVisits, range]);

  const trend = useMemo(() => {
    const days = rangeDays(range);
    const buckets = bucketByDay(
      rangeVisits.filter((v) => v.kind === "visit"),
      days,
      () => 1,
    );
    return buckets.map((bucket) => ({ date: bucket.date, visits: bucket.value }));
  }, [rangeVisits, range]);

  const popularAssets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const byAsset = new Map();
    for (const visit of rangeVisits) {
      if (!visit.assetId) continue;
      const entry = byAsset.get(visit.assetId) || { assetId: visit.assetId, visits: 0, downloads: 0 };
      if (visit.kind === "download") entry.downloads += 1;
      else entry.visits += 1;
      byAsset.set(visit.assetId, entry);
    }
    return [...byAsset.values()]
      .map((entry) => ({ ...entry, total: entry.visits + entry.downloads }))
      .filter((entry) => {
        if (!needle) return true;
        const asset = assetById.get(entry.assetId);
        return `${asset?.name || ""} ${asset?.type || ""}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [rangeVisits, search, assetById]);

  const referrers = useMemo(() => {
    const byRef = new Map();
    for (const visit of rangeVisits) {
      const key = visit.referrer.trim() || "Direct";
      const entry = byRef.get(key) || { referrer: key, visits: 0 };
      entry.visits += 1;
      byRef.set(key, entry);
    }
    return [...byRef.values()].sort((a, b) => b.visits - a.visits).slice(0, 8);
  }, [rangeVisits]);

  const portals = useMemo(() => {
    const byPortal = new Map();
    for (const visit of rangeVisits) {
      const key = visit.portalKey.trim() || "(no portal key)";
      const entry = byPortal.get(key) || { portal: key, visits: 0, downloads: 0 };
      if (visit.kind === "download") entry.downloads += 1;
      else entry.visits += 1;
      byPortal.set(key, entry);
    }
    return [...byPortal.values()].sort((a, b) => b.visits + b.downloads - (a.visits + a.downloads));
  }, [rangeVisits]);

  const geography = useMemo(() => {
    const byCountry = new Map();
    for (const visit of rangeVisits) {
      const key = visit.country.trim();
      if (!key) continue;
      const entry = byCountry.get(key) || { name: key, value: 0 };
      entry.value += 1;
      byCountry.set(key, entry);
    }
    return [...byCountry.values()].sort((a, b) => b.value - a.value).slice(0, 6);
  }, [rangeVisits]);

  const assetColumns = [
    {
      key: "asset",
      header: "Asset",
      render: (row) => {
        const asset = assetById.get(row.assetId);
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="max-w-[260px] truncate font-medium text-foreground">
              {asset?.name || `Asset ${String(row.assetId).slice(0, 8)}`}
            </span>
            <span className="truncate text-xs text-text-secondary">
              {[asset?.type, asset?.format].filter(Boolean).join(" · ") || "—"}
            </span>
          </div>
        );
      },
    },
    {
      key: "visits",
      header: "Views",
      align: "right",
      className: "text-right tabular-nums text-xs",
      render: (row) => formatCount(row.visits),
    },
    {
      key: "downloads",
      header: "Downloads",
      align: "right",
      className: "text-right tabular-nums text-xs",
      render: (row) => formatCount(row.downloads),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Portal Analytics"
        description="Portal visitors, popular assets, referrers, and conversion."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={range} onValueChange={setRange} options={RANGE_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Filter assets…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading portal analytics" />
        </div>
      ) : visits.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Globe}
            title="No portal visits recorded yet"
            description="Visitors, popular assets, referrers, and conversion appear here once portals start recording visits."
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Visits over time"
              description={`Portal visits per day for the last ${rangeDays(range)} days.`}
            >
              <ChartContainer
                config={{ visits: { label: "Visits", color: CHART_SERIES[0] } }}
                className="h-[220px] w-full"
              >
                <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                  <Bar dataKey="visits" fill={CHART_SERIES[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </SectionCard>

            <SectionCard
              title="Visitor geography"
              description="Countries recorded on portal events."
            >
              {geography.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">
                  No geography collected — portal events carry no country yet, so
                  visitor locations are not estimated here.
                </p>
              ) : (
                <ChartContainer
                  config={Object.fromEntries(
                    geography.map((entry, i) => [
                      entry.name,
                      { label: entry.name, color: CHART_SERIES[i % CHART_SERIES.length] },
                    ]),
                  )}
                  className="mx-auto h-[220px] w-full"
                >
                  <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="name" />} />
                    <Pie data={geography} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88}>
                      {geography.map((entry, i) => (
                        <Cell key={entry.name} fill={CHART_SERIES[i % CHART_SERIES.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Popular assets" description="Most viewed and downloaded through portals.">
            <DataTable
              columns={assetColumns}
              data={popularAssets}
              getRowKey={(row) => row.assetId}
              empty={
                <EmptyState
                  icon={Globe}
                  title={search.trim() ? "No assets match this filter" : "No per-asset detail in this window"}
                  description={
                    search.trim()
                      ? "Try a different search term."
                      : "Recorded visits fall outside the selected range or carry no asset."
                  }
                  action={
                    search.trim() ? (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
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
            <SectionCard title="Referrers" description="Where portal visitors arrive from.">
              {referrers.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">No referrer detail recorded.</p>
              ) : (
                <div className="space-y-2.5">
                  {referrers.map((row) => (
                    <div key={row.referrer} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-foreground">{row.referrer}</span>
                      <span className="shrink-0 tabular-nums text-text-secondary">
                        {formatCount(row.visits)} visits
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Portals" description="Visits and downloads by portal key.">
              {portals.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">No portal detail recorded.</p>
              ) : (
                <div className="space-y-2.5">
                  {portals.map((row) => (
                    <div key={row.portal} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-foreground">{row.portal}</span>
                      <span className="shrink-0 tabular-nums text-text-secondary">
                        {formatCount(row.visits)} visits · {formatCount(row.downloads)} downloads
                      </span>
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

export default PortalAnalyticsScreen;
