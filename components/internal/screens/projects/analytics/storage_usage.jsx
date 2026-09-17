"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Database } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, LogoLoading } from "@geiger/ui";

import { Badge } from "@geiger/ui/badge";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  ScreenHeader,
  SectionCard,
  StatsBar,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import { getDailySeries, getProjectUsage } from "@/lib/media/usage";
import { listDeliveryEvents } from "@/lib/supabase/delivery";
import { getProjectSettings } from "@/lib/supabase/settings";
import {
  CHART_SERIES,
  RANGE_OPTIONS,
  formatBytes,
  formatCount,
  formatDate,
  formatPercent,
  rangeDays,
} from "./constants";

// Storage and Usage — what the project stores, serves, and has left.
//
// Driven entirely off lib/media/usage.js: the project_usage rollup for
// lifetime totals and the delivery log's daily series for trends. Quota caps
// come from the project settings row. AI credits and seat-level activity have
// no meter behind them, so those cards say so instead of showing numbers.

function QuotaBar({ label, used, cap }) {
  if (cap == null || cap <= 0) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-foreground">{label}</span>
          <span className="tabular-nums text-text-secondary">{formatBytes(used)} · no limit configured</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-card">
          <div className="h-full rounded-full bg-primary/60" style={{ width: "100%" }} />
        </div>
      </div>
    );
  }
  const ratio = Math.min(used / cap, 1);
  const over = used > cap;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className={`tabular-nums ${over ? "text-red-400" : "text-text-secondary"}`}>
          {formatBytes(used)} of {formatBytes(cap)} · {formatPercent(used / cap)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-card">
        <div
          className={`h-full rounded-full ${over ? "bg-red-400" : "bg-primary/80"}`}
          style={{ width: `${Math.max(2, Math.round(ratio * 100))}%` }}
        />
      </div>
      {over ? (
        <p className="text-[11px] text-red-400">Over the configured limit — uploads may be blocked.</p>
      ) : null}
    </div>
  );
}

export function StorageUsageScreen({ projectId }) {
  const [usage, setUsage] = useState(null);
  const [series, setSeries] = useState([]);
  const [deliveryEvents, setDeliveryEvents] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [range, setRange] = useState("30");
  const [metric, setMetric] = useState("bytes");

  const handleRangeChange = (value) => {
    setSeriesLoading(true);
    setRange(value);
  };

  useEffect(() => {
    let alive = true;
    Promise.all([
      getProjectUsage(projectId),
      getDailySeries(projectId, { days: 30 }),
      listDeliveryEvents(projectId, { limit: 1000 }),
      getProjectSettings(projectId),
    ]).then(([usageRow, daily, eventRows, settingsRow]) => {
      if (!alive) return;
      setUsage(usageRow);
      setSeries(daily ?? []);
      setDeliveryEvents(eventRows ?? []);
      setSettings(settingsRow);
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

  const stats = useMemo(
    () => [
      { label: "Stored", value: formatBytes(usage?.storedBytes ?? 0), footer: `${formatCount(usage?.storedObjects ?? 0)} objects live` },
      { label: "Bandwidth", value: formatBytes(usage?.servedBytesTotal ?? 0), footer: "lifetime served" },
      { label: "Deliveries", value: formatCount(usage?.servedEventsTotal ?? 0), footer: "lifetime events" },
      {
        label: "Avg delivery",
        value: formatBytes(
          (usage?.servedEventsTotal ?? 0) > 0
            ? Math.round((usage?.servedBytesTotal ?? 0) / (usage?.servedEventsTotal ?? 1))
            : 0,
        ),
        footer: "bytes per event",
      },
    ],
    [usage],
  );

  const trend = useMemo(
    () =>
      series.map((point) => ({
        date: point.date,
        bytes: point.bytesServed,
        deliveries: point.deliveries,
      })),
    [series],
  );

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

  const hasMetering = usage != null || deliveryEvents.length > 0;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Storage and Usage"
        description="Storage, bandwidth, transformation usage, and limit alerts."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={range} onValueChange={handleRangeChange} options={RANGE_OPTIONS} height="h-9" />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-card p-1">
          {[
            { value: "bytes", label: "Bandwidth" },
            { value: "deliveries", label: "Deliveries" },
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
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading storage and usage" />
        </div>
      ) : !hasMetering ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Database}
            title="No metering recorded yet"
            description="Storage and bandwidth appear here once uploads and deliveries start metering this project."
          />
        </div>
      ) : (
        <div className="space-y-6">
          <SectionCard
            title={metric === "bytes" ? "Bandwidth over time" : "Deliveries over time"}
            description={`Daily ${metric === "bytes" ? "bytes served" : "delivery events"} for the last ${rangeDays(range)} days, zero-filled.`}
          >
            {seriesLoading ? (
              <div className="flex items-center justify-center py-12">
                <LogoLoading size={40} aria-label="Loading usage trend" />
              </div>
            ) : (
              <ChartContainer
                config={{
                  value: { label: metric === "bytes" ? "Bytes" : "Deliveries", color: CHART_SERIES[1] },
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
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    allowDecimals={false}
                    tickFormatter={(value) => (metric === "bytes" ? formatBytes(value) : formatCount(value))}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        formatter={(value) => (metric === "bytes" ? formatBytes(value) : formatCount(value))}
                      />
                    }
                  />
                  <Area
                    dataKey={metric}
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

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Limit alerts" description="Usage against the configured project quotas.">
              <div className="space-y-4">
                <QuotaBar
                  label="Stored bytes"
                  used={usage?.storedBytes ?? 0}
                  cap={Number(settings?.maxStoredBytes) || null}
                />
                <QuotaBar
                  label="Served bytes"
                  used={usage?.servedBytesTotal ?? 0}
                  cap={Number(settings?.maxServedBytes) || null}
                />
                {!settings ? (
                  <p className="text-[11px] text-text-tertiary">
                    No settings row yet — quotas are unset until the project is configured.
                  </p>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title="Transformation usage"
              description="Which variants and encodings actually get served."
            >
              {variantUsage.rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">
                  No variant detail in recent delivery events.
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

            <SectionCard title="AI credits" description="Why this card stays empty.">
              <p className="text-sm text-text-secondary">
                The metering layer records stored and served bytes only — there is no
                AI-credit meter behind it, so credit usage is not estimated here.
              </p>
            </SectionCard>

            <SectionCard title="Active users" description="Why this card stays empty.">
              <p className="text-sm text-text-secondary">
                Delivery events carry no seat or session identity, so active-user
                counts cannot be derived from metering and are not estimated here.
              </p>
            </SectionCard>
          </div>
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default StorageUsageScreen;
