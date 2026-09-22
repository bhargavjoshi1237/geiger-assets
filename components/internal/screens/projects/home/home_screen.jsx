"use client";

import React, { useState } from "react";
import {
  ArrowUpRight,
  Activity,
  ChevronRight,
  Clock3,
  Database,
  Files,
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
import { Progress } from "@geiger/ui/progress";
import { Skeleton } from "@geiger/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@geiger/ui/chart";
import { useProject } from "@/context/project-context";
import { cn } from "@/lib/utils";
import {
  DataTable,
  RollingNumber,
  StatsBar,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";

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

const WORKSPACE_SUMMARY = [
  { label: "Assets", value: "2,847" },
  { label: "Collections", value: "18" },
  { label: "Storage", value: "4.2 GB" },
];

const STATS = [
  { label: "Uploads", value: "324", delta: "+18.4%", trend: "up", footer: "vs last period" },
  { label: "Downloads", value: "8,155", delta: "+12.1%", trend: "up", footer: "vs last period" },
  { label: "Shared Assets", value: "486", delta: "+6.8%", trend: "up", footer: "vs last period" },
  { label: "Needs Review", value: "37", delta: "-9.7%", trend: "down", footer: "vs last period" },
];

const ACTIVITY_SERIES = {
  uploads: [42, 58, 51, 73, 66, 88, 102, 95, 121, 134, 148, 167],
  downloads: [310, 420, 380, 540, 505, 640, 720, 690, 820, 910, 1040, 1180],
  views: [1200, 1650, 1480, 2100, 1980, 2480, 2810, 2660, 3120, 3540, 3980, 4420],
};

const ACTIVITY_OPTIONS = [
  { value: "uploads", label: "Uploads" },
  { value: "downloads", label: "Downloads" },
  { value: "views", label: "Views" },
];

const FILE_TYPES = [
  { key: "images", label: "Images", value: 1640 },
  { key: "videos", label: "Videos", value: 482 },
  { key: "documents", label: "Documents", value: 396 },
  { key: "audio", label: "Audio", value: 214 },
  { key: "other", label: "Other", value: 115 },
];

const SERVER_TRAFFIC = [
  { location: "us-east-2", requests: 1840000, share: 96 },
  { location: "us-west-1", requests: 1460000, share: 91 },
  { location: "eu-west-1", requests: 1180000, share: 86 },
  { location: "ap-south-1", requests: 940000, share: 79 },
].map((row, index) => ({
  ...row,
  fill: CHART_COLORS.ink,
  fillOpacity: SERIES_OPACITY[index % SERIES_OPACITY.length],
}));

const CDN_HIT_RATIO = { value: 94, hits: "1.15M", requests: "1.22M" };
const BANDWIDTH = { value: 68, used: 6.8, capacity: 10 };

const TOP_COLLECTIONS = [
  { name: "Summer Campaign 2026", description: "Hero banners, social cuts, and paid media exports", status: "Shared", assets: 248, activity: 982, bandwidth: 82 },
  { name: "Brand Assets", description: "Approved logos, typography, and identity guidelines", status: "Active", assets: 312, activity: 764, bandwidth: 64 },
  { name: "Product Mockups", description: "Product renders and lifestyle photography", status: "Active", assets: 196, activity: 511, bandwidth: 41 },
  { name: "Partner Toolkit", description: "Co-marketing templates and distribution-ready files", status: "Shared", assets: 128, activity: 284, bandwidth: 33 },
  { name: "Q1 Archive", description: "Retired campaign assets retained for reference", status: "Archived", assets: 540, activity: 92, bandwidth: 12 },
];

const COLLECTION_STATUS_META = {
  Active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  Shared: { label: "Shared", variant: "info", dotClass: "bg-sky-400" },
  Archived: { label: "Archived", variant: "neutral", dotClass: "bg-zinc-400" },
};

const ATTENTION_ITEMS = [
  { key: "review", label: "Awaiting review", hint: "Across 6 collections", value: "37", icon: ScanSearch, urgency: "urgent" },
  { key: "rights", label: "Rights expiring", hint: "Within the next 30 days", value: "12", icon: Clock3, urgency: "urgent" },
  { key: "metadata", label: "Missing metadata", hint: "No owner, tags, or description", value: "86", icon: Tags, urgency: "soon" },
  { key: "duplicates", label: "Possible duplicates", hint: "Ready to compare and merge", value: "24", icon: Files, urgency: "soon" },
  { key: "links", label: "Public share links", hint: "8 links expire this week", value: "42", icon: Share2, urgency: "routine" },
  { key: "storage", label: "Storage available", hint: "Across the current workspace", value: "5.8 GB", icon: Database, urgency: "routine" },
];

const URGENCY_ORDER = ["urgent", "soon", "routine"];
const URGENCY_LABELS = { urgent: "Urgent", soon: "Soon", routine: "Routine" };

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

function ActivityTrendWidget() {
  const [metric, setMetric] = useState("uploads");
  const selected = ACTIVITY_OPTIONS.find((option) => option.value === metric) || ACTIVITY_OPTIONS[0];
  const series = ACTIVITY_SERIES[metric];
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const data = series.map((value, index) => ({ month: MONTHS[index], value }));
  const change = Math.round(((series.at(-1) - series[0]) / series[0]) * 100);
  const total = series.reduce((sum, value) => sum + value, 0);

  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader
        title="Library Activity"
        subtitle={`${selected.label} across the workspace over 12 months.`}
        action={
          <FilterDropdown
            value={metric}
            onValueChange={setMetric}
            options={ACTIVITY_OPTIONS}
            height="h-9"
          />
        }
      />
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
                formatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value)}
              />
            </Line>
          </LineChart>
        </ChartContainer>
      </div>
    </WidgetShell>
  );
}

function FileMixWidget() {
  const [selectedType, setSelectedType] = useState(FILE_TYPES[0].key);
  const total = FILE_TYPES.reduce((sum, item) => sum + item.value, 0);
  const data = FILE_TYPES.map((item, index) => ({
    ...item,
    fill: CHART_COLORS.ink,
    fillOpacity: SERIES_OPACITY[index % SERIES_OPACITY.length],
  }));
  const selectedIndex = Math.max(data.findIndex((item) => item.key === selectedType), 0);
  const selectedItem = data[selectedIndex];

  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader title="File Type Mix" subtitle="How the library is composed." />
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
          <span className="text-3xl font-bold leading-none text-foreground">{selectedItem.value}</span>
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
    </WidgetShell>
  );
}

function ServerTrafficWidget() {
  const total = SERVER_TRAFFIC.reduce((sum, item) => sum + item.requests, 0);
  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader
        title="Overall Traffic"
        subtitle="Requests served by edge location."
        action={
          <div className="text-right">
            <p className="text-2xl font-bold leading-none text-foreground">
              {(total / 1000000).toFixed(2)}M
            </p>
            <p className="mt-1 text-[11px] text-text-secondary">requests</p>
          </div>
        }
      />
      <div className="mt-4 min-h-0 flex-1">
        <ChartContainer
          config={{ share: { label: "Relative traffic", color: CHART_COLORS.ink } }}
          className="mx-auto aspect-square h-full max-h-[175px]"
        >
          <RadialBarChart
            data={SERVER_TRAFFIC}
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
                      <span className="text-muted-foreground">{item.payload.location}</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {item.payload.requests.toLocaleString()} requests
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
              nameKey="location"
              background={{ fill: CHART_COLORS.track }}
              cornerRadius={8}
              isAnimationActive
            />
          </RadialBarChart>
        </ChartContainer>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-text-secondary">
        {SERVER_TRAFFIC.map((item) => (
          <div key={item.location} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.fill, opacity: item.fillOpacity }}
              />
              <span className="truncate">{item.location}</span>
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {item.requests >= 1000000
                ? `${(item.requests / 1000000).toFixed(2)}M`
                : `${Math.round(item.requests / 1000)}k`}
            </span>
          </div>
        ))}
      </div>
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
          {collection.description}
        </p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (collection) => (
      <StatusPill status={collection.status} map={COLLECTION_STATUS_META} />
    ),
  },
  {
    key: "assets",
    header: "Assets",
    className: "tabular-nums text-muted-foreground",
    render: (collection) => collection.assets.toLocaleString(),
  },
  {
    key: "activity",
    header: "Activity",
    className: "tabular-nums text-muted-foreground",
    render: (collection) => `${collection.activity.toLocaleString()} requests`,
  },
  {
    key: "bandwidth",
    header: "Bandwidth",
    render: (collection) => (
      <div className="w-[130px] space-y-1.5">
        <Progress
          value={collection.bandwidth}
          className="h-1.5 bg-surface-hover [&_[data-slot=progress-indicator]]:bg-primary"
        />
        <p className="text-xs text-text-secondary">{collection.bandwidth}%</p>
      </div>
    ),
  },
  {
    key: "open",
    header: "",
    align: "right",
    render: () => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Open collection"
        className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
      >
        <ArrowUpRight className="h-4 w-4" />
      </Button>
    ),
  },
];

function TopCollectionsTable() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <WidgetHeader title="Top Collections" subtitle="Ranked by recent library activity." />
      </div>
      <DataTable
        columns={TOP_COLLECTION_COLUMNS}
        data={TOP_COLLECTIONS}
        getRowKey={(collection) => collection.name}
      />
    </div>
  );
}

function WorkflowAttention() {
  const sorted = [...ATTENTION_ITEMS].sort(
    (a, b) => URGENCY_ORDER.indexOf(a.urgency) - URGENCY_ORDER.indexOf(b.urgency),
  );

  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader
        title="Workflow Attention"
        subtitle="The next actions that will keep the library clean and usable."
        action={
          <span className="shrink-0 rounded-md border border-border bg-surface-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            6 queues
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

export function HomeScreen() {
  const { project, loading } = useProject();
  const projectName = project?.name && !loading ? project.name : null;

  return (
    <MainScreenWrapper>
      <div className="mt-2">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex w-full items-center justify-center gap-3 text-center md:w-auto md:justify-start md:text-left">
              {loading ? (
                <Skeleton className="h-7 w-56" />
              ) : (
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Assets Overview
                </h1>
              )}
              <span className="shrink-0 rounded border border-border bg-surface-subtle px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-text-secondary">
                WORKSPACE
              </span>
            </div>
            <p className="mt-1 max-w-xl text-center text-sm text-muted-foreground md:text-left">
              Monitor library growth, asset quality, storage, and team workflows in one place.
            </p>
          </div>
          <div className="w-full md:w-auto">
            <div className="flex w-full md:w-auto">
              {WORKSPACE_SUMMARY.map((stat, index) => (
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
        </div>
      </div>

      <StatsBar stats={STATS} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-[390px] lg:col-span-2">
          <ActivityTrendWidget />
        </div>
        <div className="h-[390px]">
          <FileMixWidget />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="h-[310px]">
          <ServerTrafficWidget />
        </div>
        <div className="h-[310px]">
          <GaugeWidget
            title="Edge CDN Hit Ratio"
            subtitle="Requests served directly from edge cache."
            value={CDN_HIT_RATIO.value}
            caption="cache hits"
            footnote={`${CDN_HIT_RATIO.hits} of ${CDN_HIT_RATIO.requests} requests`}
            icon={Network}
          />
        </div>
        <div className="h-[310px]">
          <GaugeWidget
            title="Bandwidth Usage"
            subtitle="Data transfer used this billing period."
            value={BANDWIDTH.value}
            caption="used"
            footnote={`${BANDWIDTH.used} TB of ${BANDWIDTH.capacity} TB included`}
            icon={Activity}
          />
        </div>
      </div>

      <TopCollectionsTable />
      <WorkflowAttention />
    </MainScreenWrapper>
  );
}
