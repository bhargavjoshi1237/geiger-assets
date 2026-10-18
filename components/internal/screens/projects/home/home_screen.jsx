"use client";

// Assets Overview — every number here derives client-side from the area data
// layers (assets, collections, delivery rollups, reviews, duplicates, share
// links, licences) plus the project's storage quota. There is no dashboard
// rollup table; widgets fall back to an empty message when a source has no rows.

import React, { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  Clock3,
  Database,
  Files,
  HardDrive,
  Layers,
  Network,
  ScanSearch,
  Share2,
  Tags,
} from "lucide-react";
import {
  CartesianGrid,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
} from "recharts";

import { Button } from "@geiger/ui/button";
import { Card, CardContent } from "@geiger/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@geiger/ui/chart";
import { cn } from "@/lib/utils";
import {
  DataTable,
  EmptyState,
  LoadingArea,
  RollingNumber,
  StatsBar,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { useModuleRows } from "@/components/internal/shared/module_kit";
import { useProjectSettings } from "@/components/internal/screens/projects/settings/settings_kit";
import { VISIBILITY_META } from "@/components/internal/screens/projects/collections/constants";
import { isExpiringSoon } from "@/components/internal/screens/projects/collaboration/constants";
import { TYPE_OPTIONS } from "@/components/internal/screens/projects/library/constants";
import { formatBytes, formatDate } from "@/lib/format";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listAssets } from "@/lib/supabase/assets";
import { listCollections } from "@/lib/supabase/collections";
import { listDeliveryDaily } from "@/lib/supabase/delivery";
import { listReviews } from "@/lib/supabase/approvals";
import { listGroups } from "@/lib/supabase/duplicates";
import { listShareLinks } from "@/lib/supabase/shares";
import { listLicenses } from "@/lib/supabase/licensing";

const CHART_COLORS = {
  ink: "var(--color-foreground)",
  grid: "var(--color-border)",
  axis: "var(--color-text-secondary)",
  track: "var(--color-surface-active)",
  separator: "var(--color-surface-subtle)",
};

// One ink at descending opacity rather than five fixed greys, so the ramp keeps
// its contrast when the theme flips instead of going white-on-white.
const SERIES_OPACITY = [1, 0.76, 0.56, 0.38, 0.24];

const DAY_MS = 24 * 60 * 60 * 1000;
const GB = 1024 ** 3;
const OPEN_REVIEW_STATUSES = new Set(["Pending", "In Review"]);
const LICENSE_WINDOW_DAYS = 30;

const ACTIVITY_OPTIONS = [
  { value: "uploads", label: "Uploads" },
  { value: "requests", label: "CDN Requests" },
  { value: "bandwidth", label: "Bandwidth (GB)" },
];

const TYPE_LABELS = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));

const URGENCY_ORDER = ["urgent", "soon", "routine"];
const URGENCY_LABELS = { urgent: "Urgent", soon: "Soon", routine: "Routine" };

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const sum = (rows, pick) => rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0);

function timeOf(value) {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Count of rows whose `pick` timestamp falls in [from, to). */
function countBetween(rows, pick, from, to) {
  return rows.filter((row) => {
    const t = timeOf(pick(row));
    return t !== null && t >= from && t < to;
  }).length;
}

/** "+12.4%" delta against the previous window; nothing when there's no baseline. */
function deltaOf(current, previous) {
  if (!previous) return {};
  const pct = ((current - previous) / previous) * 100;
  return {
    delta: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
    trend: pct >= 0 ? "up" : "down",
  };
}

/** The last 12 calendar months, oldest first, as { key: "YYYY-MM", label }. */
function lastMonths(now) {
  const out = [];
  const anchor = new Date(now);
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    });
  }
  return out;
}

function monthKey(value) {
  const t = timeOf(value);
  if (t === null) return null;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysUntil(value, now) {
  const t = timeOf(value);
  return t === null ? null : Math.ceil((t - now) / DAY_MS);
}

function WidgetShell({ children, className, contentClassName }) {
  return (
    <Card
      className={cn(
        "h-full gap-0 overflow-hidden rounded-xl border-border bg-surface-subtle py-0 text-foreground shadow-none",
        className,
      )}
    >
      <CardContent className={cn("h-full p-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

function WidgetHeader({ title, subtitle, action }) {
  return (
    <div className="flex w-full items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function WidgetEmpty({ children }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-text-secondary">
      {children}
    </div>
  );
}

function ActivityTrendWidget({ series }) {
  const [metric, setMetric] = useState("uploads");
  const selected = ACTIVITY_OPTIONS.find((option) => option.value === metric) || ACTIVITY_OPTIONS[0];
  const data = series.map((month) => ({ month: month.label, value: month[metric] }));
  const hasData = data.some((point) => point.value > 0);

  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader
        title="Library Activity"
        subtitle={`${selected.label} across the project over 12 months.`}
        action={
          <FilterDropdown
            value={metric}
            onValueChange={setMetric}
            options={ACTIVITY_OPTIONS}
            height="h-9"
          />
        }
      />
      {hasData ? (
        <div className="mt-3 min-h-0 flex-1">
          <ChartContainer
            config={{ value: { label: selected.label, color: CHART_COLORS.ink } }}
            className="h-full w-full"
          >
            <LineChart data={data} margin={{ top: 24, right: 16, left: 12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" hideLabel />}
              />
              <Line
                dataKey="value"
                type="monotone"
                stroke={CHART_COLORS.ink}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.ink, r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive
              >
                <LabelList
                  dataKey="value"
                  position="top"
                  offset={10}
                  className="fill-foreground"
                  fontSize={11}
                  formatter={(value) => (value ? compact.format(value) : "")}
                />
              </Line>
            </LineChart>
          </ChartContainer>
        </div>
      ) : (
        <WidgetEmpty>No {selected.label.toLowerCase()} in the last 12 months.</WidgetEmpty>
      )}
    </WidgetShell>
  );
}

function FileMixWidget({ mix }) {
  const [selectedType, setSelectedType] = useState(null);
  const total = sum(mix, (item) => item.value);
  const data = mix.map((item, index) => ({
    ...item,
    fill: CHART_COLORS.ink,
    fillOpacity: SERIES_OPACITY[index % SERIES_OPACITY.length],
  }));
  const selectedIndex = Math.max(data.findIndex((item) => item.key === selectedType), 0);
  const selectedItem = data[selectedIndex];

  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader title="File Type Mix" subtitle="How the library is composed." />
      {total ? (
        <>
          <div className="relative mt-3 flex min-h-0 flex-1 items-center justify-center">
            <ChartContainer
              config={Object.fromEntries(data.map((item) => [item.key, { label: item.label, color: item.fill }]))}
              className="mx-auto h-[220px] w-[220px]"
            >
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="key" />} />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="key"
                  innerRadius={44}
                  outerRadius={78}
                  activeIndex={selectedIndex}
                  activeShape={{ outerRadius: 88 }}
                  onMouseEnter={(_, index) => setSelectedType(data[index]?.key || selectedType)}
                  stroke={CHART_COLORS.separator}
                  strokeWidth={2}
                  isAnimationActive
                />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
              <span className="text-3xl font-bold leading-none text-foreground">
                {selectedItem.value.toLocaleString("en-US")}
              </span>
              <span className="mt-1 text-xs font-medium text-muted-foreground">{selectedItem.label}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3">
            {data.slice(0, 4).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedType(item.key)}
                className="flex items-center justify-between gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.fill, opacity: item.fillOpacity }}
                  />
                  {item.label}
                </span>
                <span className="tabular-nums">{Math.round((item.value / total) * 100)}%</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <WidgetEmpty>Upload assets to see the mix.</WidgetEmpty>
      )}
    </WidgetShell>
  );
}

function TrafficWidget({ countries }) {
  const total = sum(countries, (item) => item.requests);
  const max = Math.max(1, ...countries.map((item) => item.requests));
  const data = countries.map((item, index) => ({
    ...item,
    share: Math.round((item.requests / max) * 100),
    fill: CHART_COLORS.ink,
    fillOpacity: SERIES_OPACITY[index % SERIES_OPACITY.length],
  }));

  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader
        title="Overall Traffic"
        subtitle="CDN requests by country, last 30 days."
        action={
          <div className="text-right">
            <p className="text-2xl font-bold leading-none text-foreground">{compact.format(total)}</p>
            <p className="mt-1 text-[11px] text-text-secondary">requests</p>
          </div>
        }
      />
      {data.length ? (
        <>
          <div className="mt-4 min-h-0 flex-1">
            <ChartContainer
              config={{ share: { label: "Relative traffic", color: CHART_COLORS.ink } }}
              className="mx-auto aspect-square h-full max-h-[175px]"
            >
              <RadialBarChart
                data={data}
                innerRadius={24}
                outerRadius={82}
                startAngle={90}
                endAngle={-270}
              >
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name, item) => (
                        <span className="flex w-full items-center justify-between gap-3">
                          <span className="text-muted-foreground">{item.payload.country}</span>
                          <span className="font-medium tabular-nums text-foreground">
                            {item.payload.requests.toLocaleString("en-US")} requests
                          </span>
                        </span>
                      )}
                    />
                  }
                />
                <PolarGrid
                  gridType="circle"
                  radialLines={false}
                  stroke={CHART_COLORS.grid}
                  strokeOpacity={0.65}
                />
                <RadialBar
                  dataKey="share"
                  nameKey="country"
                  background={{ fill: CHART_COLORS.track }}
                  cornerRadius={8}
                  isAnimationActive
                />
              </RadialBarChart>
            </ChartContainer>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-text-secondary">
            {data.map((item) => (
              <div key={item.country} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.fill, opacity: item.fillOpacity }}
                  />
                  <span className="truncate">{item.country}</span>
                </span>
                <span className="font-medium tabular-nums text-foreground">
                  {compact.format(item.requests)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <WidgetEmpty>No CDN traffic in the last 30 days.</WidgetEmpty>
      )}
    </WidgetShell>
  );
}

function GaugeWidget({ title, subtitle, value, caption, footnote, icon: Icon }) {
  const clamped = Math.max(0, Math.min(100, value));
  const endAngle = 90 - (clamped / 100) * 360;

  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        }
      />
      <div className="mt-1 flex min-h-0 flex-1 items-center justify-center">
        <ChartContainer
          config={{ value: { label: caption, color: CHART_COLORS.ink } }}
          className="mx-auto aspect-square h-full max-h-[190px]"
        >
          <RadialBarChart
            data={[{ name: caption, value: clamped, fill: CHART_COLORS.ink }]}
            startAngle={90}
            endAngle={endAngle}
            innerRadius={72}
            outerRadius={104}
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              polarRadius={[78, 66]}
              className="first:fill-surface-card last:fill-surface-subtle"
            />
            <RadialBar dataKey="value" cornerRadius={8} isAnimationActive />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                          {clamped}%
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 22}
                          className="fill-muted-foreground text-xs font-medium"
                        >
                          {caption}
                        </tspan>
                      </text>
                    );
                  }

                  return null;
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </div>
      <p className="mt-1 text-center text-xs text-text-secondary">{footnote}</p>
    </WidgetShell>
  );
}

const TOP_COLLECTION_COLUMNS = [
  {
    key: "name",
    header: "Collection",
    render: (collection) => (
      <div className="flex flex-col gap-1">
        <span className="font-medium text-foreground">{collection.name}</span>
        <p className="line-clamp-1 text-xs text-text-secondary">
          {collection.description || "No description"}
        </p>
      </div>
    ),
  },
  {
    key: "visibility",
    header: "Visibility",
    render: (collection) => (
      <StatusPill status={collection.visibility} map={VISIBILITY_META} />
    ),
  },
  {
    key: "assets",
    header: "Assets",
    className: "tabular-nums text-muted-foreground",
    render: (collection) => collection.assetCount.toLocaleString("en-US"),
  },
  {
    key: "updated",
    header: "Updated",
    className: "text-xs text-text-secondary",
    render: (collection) => formatDate(collection.updatedAt),
  },
  {
    key: "open",
    header: "",
    align: "right",
    render: () => (
      <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
    ),
  },
];

function TopCollectionsTable({ collections, onOpen }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <WidgetHeader title="Top Collections" subtitle="Largest collections in this project." />
      </div>
      <DataTable
        columns={TOP_COLLECTION_COLUMNS}
        data={collections}
        getRowKey={(collection) => collection.id}
        onRowClick={onOpen}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={Layers}
              title="No collections yet"
              description="Group assets into collections to see them ranked here."
              action={
                <Button variant="outline" onClick={onOpen}>
                  Open Collections
                </Button>
              }
            />
          </div>
        }
      />
    </div>
  );
}

function WorkflowAttention({ items, onOpen }) {
  const sorted = [...items].sort(
    (a, b) => URGENCY_ORDER.indexOf(a.urgency) - URGENCY_ORDER.indexOf(b.urgency),
  );
  const open = items.filter((item) => item.count > 0).length;

  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader
        title="Workflow Attention"
        subtitle="The next actions that will keep the library clean and usable."
        action={
          <span className="shrink-0 rounded-md border border-border bg-surface-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {open ? `${open} need attention` : "All clear"}
          </span>
        }
      />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onOpen(item.tab)}
              className="group flex items-center gap-3.5 rounded-xl p-3.5 text-left transition-colors hover:bg-surface-card"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{item.label}</span>
                  <span className="shrink-0 rounded-md border border-border bg-surface-card px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                    {URGENCY_LABELS[item.urgency]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-text-secondary">{item.hint}</p>
              </div>
              <span className="shrink-0 text-xl font-bold tabular-nums text-foreground">{item.value}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-secondary transition-colors group-hover:text-foreground" />
            </button>
          );
        })}
      </div>
    </WidgetShell>
  );
}

export function HomeScreen({ projectId }) {
  const { setTab } = useWorkspaceUrl();
  const { settings, loading: settingsLoading } = useProjectSettings(projectId);
  const [assets, , assetsLoading] = useModuleRows(listAssets, projectId);
  const [collections, , collectionsLoading] = useModuleRows(listCollections, projectId);
  const [daily, , dailyLoading] = useModuleRows(listDeliveryDaily, projectId);
  const [reviews, , reviewsLoading] = useModuleRows(listReviews, projectId);
  const [duplicates, , duplicatesLoading] = useModuleRows(listGroups, projectId);
  const [links, , linksLoading] = useModuleRows(listShareLinks, projectId);
  const [licenses, , licensesLoading] = useModuleRows(listLicenses, projectId);
  // Frozen at mount so the 30-day windows don't shift between renders.
  const [now] = useState(() => Date.now());

  const loading =
    settingsLoading ||
    assetsLoading ||
    collectionsLoading ||
    dailyLoading ||
    reviewsLoading ||
    duplicatesLoading ||
    linksLoading ||
    licensesLoading;

  const dashboard = useMemo(() => {
    const monthAgo = now - 30 * DAY_MS;
    const twoMonthsAgo = now - 60 * DAY_MS;

    // Project-wide daily rows carry no asset id; per-asset slices are a fallback.
    const projectDaily = daily.filter((d) => !d.assetId);
    const traffic = projectDaily.length ? projectDaily : daily;
    const traffic30d = traffic.filter((d) => (timeOf(d.day) ?? 0) >= monthAgo);

    const storageBytes = sum(assets, (a) => a.sizeBytes);
    const quotaBytes = Number(settings.storageQuotaGb || 0) * GB;

    const openReviews = reviews.filter((r) => OPEN_REVIEW_STATUSES.has(r.status));
    const overdueReviews = openReviews.filter((r) => (timeOf(r.dueAt) ?? Infinity) < now);
    const activeLinks = links.filter((l) => l.status === "active");
    const expiringLinks = activeLinks.filter((l) => isExpiringSoon(l.expiresAt));
    const expiringLicenses = licenses.filter((l) => {
      if (l.status === "terminated" || l.status === "renewed" || l.isPerpetual) return false;
      const days = daysUntil(l.endDate, now);
      return days !== null && days >= 0 && days <= LICENSE_WINDOW_DAYS;
    });
    const missingMetadata = assets.filter((a) => !a.tags?.length && !a.description);
    const openDuplicates = duplicates.filter((g) => g.status === "open");

    const uploads30d = countBetween(assets, (a) => a.createdAt, monthAgo, now + DAY_MS);
    const uploadsPrev = countBetween(assets, (a) => a.createdAt, twoMonthsAgo, monthAgo);

    const stats = [
      {
        label: "Uploads",
        value: uploads30d.toLocaleString("en-US"),
        ...deltaOf(uploads30d, uploadsPrev),
        footer: "Last 30 days",
      },
      {
        label: "Downloads",
        value: sum(assets, (a) => a.downloads).toLocaleString("en-US"),
        footer: "All time",
      },
      {
        label: "Shared Links",
        value: activeLinks.length.toLocaleString("en-US"),
        footer: expiringLinks.length ? `${expiringLinks.length} expire this week` : "Active links",
      },
      {
        label: "Needs Review",
        value: openReviews.length.toLocaleString("en-US"),
        footer: overdueReviews.length ? `${overdueReviews.length} overdue` : "In approval queues",
      },
    ];

    const months = lastMonths(now);
    const monthly = new Map(
      months.map((m) => [m.key, { ...m, uploads: 0, requests: 0, bandwidth: 0 }]),
    );
    for (const a of assets) {
      const bucket = monthly.get(monthKey(a.createdAt));
      if (bucket) bucket.uploads += 1;
    }
    for (const d of traffic) {
      const bucket = monthly.get(monthKey(d.day));
      if (!bucket) continue;
      bucket.requests += d.requests;
      bucket.bandwidth += d.bytes;
    }
    const activity = [...monthly.values()].map((m) => ({
      ...m,
      bandwidth: Math.round((m.bandwidth / GB) * 100) / 100,
    }));

    const typeCounts = new Map();
    for (const a of assets) typeCounts.set(a.type, (typeCounts.get(a.type) || 0) + 1);
    const byType = [...typeCounts.entries()]
      .map(([key, value]) => ({ key, label: TYPE_LABELS[key] || key, value }))
      .sort((a, b) => b.value - a.value);
    // Pie keeps five slices; the tail folds into "Other".
    const mix =
      byType.length > 5
        ? [
            ...byType.slice(0, 4),
            { key: "other", label: "Other", value: sum(byType.slice(4), (t) => t.value) },
          ]
        : byType;

    const countryCounts = new Map();
    for (const d of traffic30d) {
      for (const [country, count] of Object.entries(d.countries || {})) {
        countryCounts.set(country, (countryCounts.get(country) || 0) + (Number(count) || 0));
      }
    }
    const countries = [...countryCounts.entries()]
      .map(([country, requests]) => ({ country, requests }))
      .filter((c) => c.requests > 0)
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 4);

    const hits = sum(traffic30d, (d) => d.hits);
    const served = hits + sum(traffic30d, (d) => d.misses);

    const attention = [
      {
        key: "review",
        label: "Awaiting review",
        hint: overdueReviews.length ? `${overdueReviews.length} past due` : "Open approval requests",
        count: openReviews.length,
        icon: ScanSearch,
        urgency: "urgent",
        tab: "Approvals",
      },
      {
        key: "licenses",
        label: "Licenses expiring",
        hint: `Within the next ${LICENSE_WINDOW_DAYS} days`,
        count: expiringLicenses.length,
        icon: Clock3,
        urgency: "urgent",
        tab: "Expirations & Renewals",
      },
      {
        key: "metadata",
        label: "Missing metadata",
        hint: "No tags or description",
        count: missingMetadata.length,
        icon: Tags,
        urgency: "soon",
        tab: "Asset Library",
      },
      {
        key: "duplicates",
        label: "Possible duplicates",
        hint: "Ready to compare and merge",
        count: openDuplicates.length,
        icon: Files,
        urgency: "soon",
        tab: "Duplicate Review",
      },
      {
        key: "links",
        label: "Active share links",
        hint: expiringLinks.length ? `${expiringLinks.length} expire this week` : "None expiring this week",
        count: activeLinks.length,
        icon: Share2,
        urgency: "routine",
        tab: "Shared Links",
      },
    ].map((item) => ({
      ...item,
      value: item.count.toLocaleString("en-US"),
      // Nothing waiting means nothing urgent.
      urgency: item.count ? item.urgency : "routine",
    }));
    attention.push({
      key: "storage",
      label: "Storage available",
      hint: quotaBytes ? `Of the ${settings.storageQuotaGb} GB quota` : "No quota set",
      count: 0,
      value: quotaBytes ? formatBytes(Math.max(0, quotaBytes - storageBytes)) : "—",
      icon: Database,
      urgency: quotaBytes && storageBytes / quotaBytes >= 0.9 ? "urgent" : "routine",
      tab: "Usage & Storage",
    });

    return {
      summary: [
        { label: "Assets", value: assets.length.toLocaleString("en-US") },
        { label: "Collections", value: collections.length.toLocaleString("en-US") },
        { label: "Storage", value: formatBytes(storageBytes) },
      ],
      stats,
      activity,
      mix,
      countries,
      cdn: {
        value: served ? Math.round((hits / served) * 100) : 0,
        footnote: served
          ? `${compact.format(hits)} of ${compact.format(served)} requests`
          : "No CDN requests in the last 30 days",
      },
      storage: {
        value: quotaBytes ? Math.round((storageBytes / quotaBytes) * 100) : 0,
        footnote: quotaBytes
          ? `${formatBytes(storageBytes)} of ${settings.storageQuotaGb} GB quota`
          : `${formatBytes(storageBytes)} used · no quota set`,
      },
      topCollections: [...collections]
        .sort((a, b) => b.assetCount - a.assetCount)
        .slice(0, 5),
      attention,
    };
  }, [assets, collections, daily, reviews, duplicates, links, licenses, settings, now]);

  return (
    <MainScreenWrapper>
      <div className="mt-2">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex w-full items-center justify-center gap-3 text-center md:w-auto md:justify-start md:text-left">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Assets Overview
              </h1>
              {/* Caps-only label: trim the text box to the cap height so the
                  word centers in the pill instead of riding high on the
                  font's descender space. */}
              <span className="inline-flex h-[18px] shrink-0 items-center rounded border border-border bg-surface-subtle px-1.5 font-mono text-[9px] leading-none tracking-widest text-text-secondary [text-box:trim-both_cap_alphabetic]">
                WORKSPACE
              </span>
            </div>
            <p className="mt-1 max-w-xl text-center text-sm text-muted-foreground md:text-left">
              Monitor library growth, asset quality, storage, and team workflows in one place.
            </p>
          </div>
          {!loading && (
            <div className="w-full md:w-auto">
              <div className="flex w-full md:w-auto">
                {dashboard.summary.map((stat, index) => (
                  <div
                    key={stat.label}
                    className={cn(
                      "flex flex-1 flex-col items-center md:flex-none",
                      index === 0 && "md:pr-8",
                      index > 0 && "border-l border-border",
                      index === 1 && "md:px-8",
                      index === 2 && "md:pl-8",
                    )}
                  >
                    <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                      {stat.label}
                    </span>
                    <RollingNumber value={stat.value} className="mt-0.5 text-2xl font-bold leading-none text-foreground" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingArea size={80} className="min-h-[50vh]" />
      ) : (
        <>
          <StatsBar stats={dashboard.stats} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="h-[390px] lg:col-span-2">
              <ActivityTrendWidget series={dashboard.activity} />
            </div>
            <div className="h-[390px]">
              <FileMixWidget mix={dashboard.mix} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="h-[310px]">
              <TrafficWidget countries={dashboard.countries} />
            </div>
            <div className="h-[310px]">
              <GaugeWidget
                title="Edge CDN Hit Ratio"
                subtitle="Requests served from edge cache, last 30 days."
                value={dashboard.cdn.value}
                caption="cache hits"
                footnote={dashboard.cdn.footnote}
                icon={Network}
              />
            </div>
            <div className="h-[310px]">
              <GaugeWidget
                title="Storage Usage"
                subtitle="Stored bytes against the project quota."
                value={dashboard.storage.value}
                caption="used"
                footnote={dashboard.storage.footnote}
                icon={HardDrive}
              />
            </div>
          </div>

          <TopCollectionsTable
            collections={dashboard.topCollections}
            onOpen={() => setTab("Collections")}
          />
          <WorkflowAttention items={dashboard.attention} onOpen={setTab} />
        </>
      )}
    </MainScreenWrapper>
  );
}

export default HomeScreen;
