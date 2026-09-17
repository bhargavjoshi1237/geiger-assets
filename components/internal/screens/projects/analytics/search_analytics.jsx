"use client";

import React, { useEffect, useMemo, useState } from "react";
import { SearchX } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, LogoLoading } from "@geiger/ui";

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import { listSearchEvents } from "@/lib/supabase/analytics";
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

// Search Analytics — what people look for and whether they find it.
//
// Every number derives from the search_events log (query, result count,
// conversion flag, filter usage in metadata.filters). Zero-result and failed
// searches are rows with results_count 0 — never a sampled estimate. An empty
// log renders the empty state, never fabricated queries.

export function SearchAnalyticsScreen({ projectId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    listSearchEvents(projectId).then((rows) => {
      if (!alive) return;
      setEvents(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const rangeEvents = useMemo(
    () => events.filter((event) => inRange(event.createdAt, range)),
    [events, range],
  );

  const stats = useMemo(() => {
    const total = rangeEvents.length;
    const zero = rangeEvents.filter((event) => event.resultsCount === 0).length;
    const converted = rangeEvents.filter((event) => event.converted).length;
    const avg = total > 0 ? rangeEvents.reduce((sum, e) => sum + e.resultsCount, 0) / total : 0;
    return [
      { label: "Searches", value: formatCount(total), footer: `last ${rangeDays(range)} days` },
      { label: "Zero-result", value: formatCount(zero), footer: `${formatPercent(total ? zero / total : NaN)} of searches` },
      { label: "Avg results", value: total ? avg.toFixed(1) : "—", footer: "per search" },
      { label: "Converted", value: formatPercent(total ? converted / total : NaN), footer: `${formatCount(converted)} searches` },
    ];
  }, [rangeEvents, range]);

  const trend = useMemo(() => {
    const days = rangeDays(range);
    const searches = bucketByDay(rangeEvents, days, () => 1);
    const zero = bucketByDay(
      rangeEvents.filter((event) => event.resultsCount === 0),
      days,
      () => 1,
    );
    return searches.map((bucket, i) => ({
      date: bucket.date,
      searches: bucket.value,
      zeroResult: zero[i]?.value ?? 0,
    }));
  }, [rangeEvents, range]);

  const queries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const byQuery = new Map();
    for (const event of rangeEvents) {
      const key = event.query.trim() || "(empty query)";
      const entry = byQuery.get(key) || {
        query: key,
        searches: 0,
        zeroResult: 0,
        converted: 0,
        resultsSum: 0,
      };
      entry.searches += 1;
      if (event.resultsCount === 0) entry.zeroResult += 1;
      if (event.converted) entry.converted += 1;
      entry.resultsSum += event.resultsCount;
      byQuery.set(key, entry);
    }
    return [...byQuery.values()]
      .map((entry) => ({ ...entry, avgResults: entry.searches ? entry.resultsSum / entry.searches : 0 }))
      .filter((entry) => !needle || entry.query.toLowerCase().includes(needle))
      .sort((a, b) => b.searches - a.searches)
      .slice(0, 15);
  }, [rangeEvents, search]);

  const failedQueries = useMemo(
    () => queries.filter((entry) => entry.zeroResult > 0).slice(0, 10),
    [queries],
  );

  const filterUsage = useMemo(() => {
    const byFilter = new Map();
    for (const event of rangeEvents) {
      for (const key of Object.keys(event.filters || {})) {
        const entry = byFilter.get(key) || { filter: key, uses: 0 };
        entry.uses += 1;
        byFilter.set(key, entry);
      }
    }
    const rows = [...byFilter.values()].sort((a, b) => b.uses - a.uses).slice(0, 8);
    const max = rows.reduce((m, row) => Math.max(m, row.uses), 0);
    return { rows, max };
  }, [rangeEvents]);

  const queryColumns = [
    {
      key: "query",
      header: "Query",
      render: (row) => (
        <span className="block max-w-[280px] truncate font-medium text-foreground">{row.query}</span>
      ),
    },
    {
      key: "searches",
      header: "Searches",
      align: "right",
      className: "text-right tabular-nums text-xs",
      render: (row) => formatCount(row.searches),
    },
    {
      key: "zero",
      header: "Zero-result",
      align: "right",
      className: "text-right tabular-nums text-xs",
      render: (row) => (
        <span className={row.zeroResult > 0 ? "text-amber-400" : "text-text-secondary"}>
          {formatCount(row.zeroResult)}
        </span>
      ),
    },
    {
      key: "avg",
      header: "Avg results",
      align: "right",
      className: "hidden text-right tabular-nums text-xs md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (row) => row.avgResults.toFixed(1),
    },
    {
      key: "conversion",
      header: "Converted",
      align: "right",
      className: "text-right tabular-nums text-xs",
      render: (row) => formatPercent(row.searches ? row.converted / row.searches : NaN),
    },
  ];

  const failedColumns = [
    {
      key: "query",
      header: "Failed query",
      render: (row) => (
        <span className="block max-w-[280px] truncate font-medium text-foreground">{row.query}</span>
      ),
    },
    {
      key: "zero",
      header: "Times",
      align: "right",
      className: "text-right tabular-nums text-xs text-amber-400",
      render: (row) => formatCount(row.zeroResult),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Search Analytics"
        description="Top queries, failed searches, filter usage, and conversion."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={range} onValueChange={setRange} options={RANGE_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Filter queries…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading search analytics" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={SearchX}
            title="No searches recorded yet"
            description="Top queries, zero-result searches, and conversion appear here once the app starts recording search events."
          />
        </div>
      ) : (
        <div className="space-y-6">
          <SectionCard
            title="Search trend"
            description={`Searches and zero-result searches per day for the last ${rangeDays(range)} days.`}
          >
            <ChartContainer
              config={{
                searches: { label: "Searches", color: CHART_SERIES[0] },
                zeroResult: { label: "Zero-result", color: CHART_SERIES[2] },
              }}
              className="h-[240px] w-full"
            >
              <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                <Line dataKey="searches" type="monotone" stroke={CHART_SERIES[0]} strokeWidth={2} dot={false} />
                <Line dataKey="zeroResult" type="monotone" stroke={CHART_SERIES[2]} strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </SectionCard>

          <SectionCard title="Top queries" description="Ranked by search volume in the selected window.">
            <DataTable
              columns={queryColumns}
              data={queries}
              getRowKey={(row) => row.query}
              empty={
                <EmptyState
                  icon={SearchX}
                  title={search.trim() ? "No queries match this filter" : "No searches in this window"}
                  description={
                    search.trim()
                      ? "Try a different search term."
                      : "Recorded searches fall outside the selected range."
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
            <SectionCard
              title="Failed searches"
              description="Queries that returned zero results — candidates for synonyms or new content."
            >
              {failedQueries.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">
                  No zero-result searches in this window.
                </p>
              ) : (
                <DataTable
                  columns={failedColumns}
                  data={failedQueries}
                  getRowKey={(row) => row.query}
                />
              )}
            </SectionCard>

            <SectionCard
              title="Filter usage"
              description="Which search filters callers actually record on events."
            >
              {filterUsage.rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">
                  No filter detail recorded — events carry no filters yet, so nothing
                  is estimated here.
                </p>
              ) : (
                <div className="space-y-3">
                  {filterUsage.rows.map((row) => (
                    <div key={row.filter} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-foreground">{row.filter}</span>
                        <span className="tabular-nums text-text-secondary">
                          {formatCount(row.uses)} uses
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-card">
                        <div
                          className="h-full rounded-full bg-primary/80"
                          style={{
                            width: `${filterUsage.max > 0 ? Math.max(2, Math.round((row.uses / filterUsage.max) * 100)) : 0}%`,
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

export default SearchAnalyticsScreen;
