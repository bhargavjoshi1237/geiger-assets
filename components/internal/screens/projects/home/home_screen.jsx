"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowDownRight,
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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProject } from "@/context/project-context";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import FilterDropdown from "./filter_dropdown";

const CHART_COLORS = {
  primary: "#ffffff",
  background: "#161616",
};

const SERIES = ["#ffffff", "#d4d4d4", "#a3a3a3", "#737373", "#525252"];

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
  { location: "us-east-2", requests: 1840000, share: 96, fill: SERIES[0] },
  { location: "us-west-1", requests: 1460000, share: 91, fill: SERIES[1] },
  { location: "eu-west-1", requests: 1180000, share: 86, fill: SERIES[2] },
  { location: "ap-south-1", requests: 940000, share: 79, fill: SERIES[3] },
];

const CDN_HIT_RATIO = { value: 94, hits: "1.15M", requests: "1.22M" };
const BANDWIDTH = { value: 68, used: 6.8, capacity: 10 };

const TOP_COLLECTIONS = [
  { name: "Summer Campaign 2026", description: "Hero banners, social cuts, and paid media exports", status: "Shared", assets: 248, activity: 982, bandwidth: 82 },
  { name: "Brand Assets", description: "Approved logos, typography, and identity guidelines", status: "Active", assets: 312, activity: 764, bandwidth: 64 },
  { name: "Product Mockups", description: "Product renders and lifestyle photography", status: "Active", assets: 196, activity: 511, bandwidth: 41 },
  { name: "Partner Toolkit", description: "Co-marketing templates and distribution-ready files", status: "Shared", assets: 128, activity: 284, bandwidth: 33 },
  { name: "Q1 Archive", description: "Retired campaign assets retained for reference", status: "Archived", assets: 540, activity: 92, bandwidth: 12 },
];

const COLLECTION_STATUS = {
  Active: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  Shared: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  Archived: "border-border bg-surface-card text-muted-foreground",
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

const ROLL_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function RollingDigit({ digit, active, delay }) {
  return (
    <span className="relative inline-block h-[1em] w-[1ch] overflow-hidden align-baseline">
      <span
        className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-[900ms] ease-out"
        style={{
          transform: `translateY(-${(active ? digit : 0) * 10}%)`,
          transitionDelay: `${delay}ms`,
        }}
      >
        {ROLL_DIGITS.map((number) => (
          <span key={number} className="flex h-[1em] items-center justify-center leading-none">
            {number}
          </span>
        ))}
      </span>
    </span>
  );
}

function RollingNumber({ value, className }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const characters = String(value).split("");
  const digitCountBefore = characters.map((_, index) =>
    characters.slice(0, index).filter((character) => /\d/.test(character)).length,
  );

  return (
    <span className={cn("inline-flex items-center tabular-nums", className)}>
      {characters.map((character, index) => {
          if (/\d/.test(character)) {
            return (
              <RollingDigit
                key={index}
                digit={Number(character)}
                active={active}
                delay={digitCountBefore[index] * 70}
              />
            );
          }

          return <span key={index}>{character}</span>;
        })}
    </span>
  );
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

function StatsBar() {
  return (
    <Card className="gap-0 overflow-hidden rounded-xl border-border bg-surface-subtle py-0 text-foreground shadow-none">
      <CardContent className="p-0">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {STATS.map((stat, index) => {
            const up = stat.trend === "up";
            const TrendIcon = up ? ArrowUpRight : ArrowDownRight;

            return (
              <div
                key={stat.label}
                className={cn(
                  "p-4",
                  index % 2 !== 0 && "border-l border-border",
                  index >= 2 && "border-t border-border",
                  "md:border-l md:border-t-0",
                  index === 0 && "md:border-l-0",
                )}
              >
                <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                  {stat.label}
                </span>
                <div className="mt-1 flex items-end gap-2">
                  <RollingNumber value={stat.value} className="text-2xl font-bold leading-none text-white" />
                  <span
                    className="mb-0.5 inline-flex items-center gap-0.5 text-xs font-medium text-emerald-400"
                  >
                    <TrendIcon className="h-3 w-3" />
                    {stat.delta}
                  </span>
                </div>
                <span className="mt-1 block text-[11px] text-text-tertiary">{stat.footer}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityTrendWidget() {
  const [metric, setMetric] = useState("uploads");
  const selected = ACTIVITY_OPTIONS.find((option) => option.value === metric) || ACTIVITY_OPTIONS[0];
  const series = ACTIVITY_SERIES[metric];
  const data = series.map((value, index) => ({ week: `W${index + 1}`, value }));
  const change = Math.round(((series.at(-1) - series[0]) / series[0]) * 100);
  const total = series.reduce((sum, value) => sum + value, 0);

  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader
        title="Library Activity"
        subtitle={`${selected.label} across the workspace over 12 weeks.`}
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
          config={{ value: { label: selected.label, color: CHART_COLORS.primary } }}
          className="h-full w-full"
        >
          <LineChart data={data} margin={{ top: 24, right: 16, left: 12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#2a2a2a" strokeDasharray="3 3" />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: "#737373", fontSize: 11 }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" hideLabel />}
            />
            <Line
              dataKey="value"
              type="monotone"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.primary, r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive
            >
              <LabelList
                dataKey="value"
                position="top"
                offset={10}
                className="fill-[#ededed]"
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
    fill: SERIES[index % SERIES.length],
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
              stroke={CHART_COLORS.background}
              strokeWidth={2}
              isAnimationActive
            />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <span className="text-3xl font-bold leading-none text-white">{selectedItem.value}</span>
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
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.fill }} />
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
            <p className="text-2xl font-bold leading-none text-white">
              {(total / 1000000).toFixed(2)}M
            </p>
            <p className="mt-1 text-[11px] text-text-secondary">requests</p>
          </div>
        }
      />
      <div className="mt-4 min-h-0 flex-1">
        <ChartContainer
          config={{ share: { label: "Relative traffic", color: CHART_COLORS.primary } }}
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
              stroke="#333333"
              strokeOpacity={0.65}
            />
            <RadialBar
              dataKey="share"
              nameKey="location"
              background={{ fill: "#242424" }}
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
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
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
          config={{ value: { label: caption, color: CHART_COLORS.primary } }}
          className="mx-auto aspect-square h-full max-h-[190px]"
        >
          <RadialBarChart
            data={[{ name: caption, value: clamped, fill: CHART_COLORS.primary }]}
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
              className="first:fill-[#202020] last:fill-[#1a1a1a]"
            />
            <RadialBar dataKey="value" cornerRadius={8} isAnimationActive />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-white text-3xl font-bold">
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

function TopCollectionsTable() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <WidgetHeader title="Top Collections" subtitle="Ranked by recent library activity." />
      </div>
      <div className="bg-surface-card border border-border rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-subtle border-border">
              <TableHead className="h-12 px-6 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Collection
              </TableHead>
              <TableHead className="h-12 px-6 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Status
              </TableHead>
              <TableHead className="h-12 px-6 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Assets
              </TableHead>
              <TableHead className="h-12 px-6 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Activity
              </TableHead>
              <TableHead className="h-12 px-6 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Bandwidth
              </TableHead>
              <TableHead className="h-12 px-6 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TOP_COLLECTIONS.map((collection) => (
                <TableRow key={collection.name} className="border-border hover:bg-surface-active">
                  <TableCell className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-foreground font-medium">{collection.name}</span>
                      <p className="text-xs text-text-secondary line-clamp-1">
                        {collection.description}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <Badge
                      className={cn(
                        "min-w-[86px] justify-center whitespace-nowrap rounded-md border px-2",
                        COLLECTION_STATUS[collection.status],
                      )}
                    >
                      {collection.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4 tabular-nums text-muted-foreground">
                    {collection.assets.toLocaleString()}
                  </TableCell>
                  <TableCell className="px-6 py-4 tabular-nums text-muted-foreground">
                    {collection.activity.toLocaleString()} requests
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="w-[130px] space-y-1.5">
                      <Progress
                        value={collection.bandwidth}
                        className="h-1.5 bg-surface-hover [&_[data-slot=progress-indicator]]:bg-primary"
                      />
                      <p className="text-xs text-text-secondary">{collection.bandwidth}%</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
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
              <span className="shrink-0 text-xl font-bold tabular-nums text-white">{item.value}</span>
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
    <MainScreenWrapper className="dark">
      <div className="mt-2">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex w-full items-center justify-center gap-3 text-center md:w-auto md:justify-start md:text-left">
              {loading ? (
                <div className="h-7 w-56 animate-pulse rounded-md bg-surface-hover" />
              ) : (
                <h1 className="text-2xl font-bold tracking-tight text-white">
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
                  <RollingNumber value={stat.value} className="mt-0.5 text-2xl font-bold text-white" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <StatsBar />

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
