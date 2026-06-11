"use client";

import React, { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import FilterDropdown from "./filter_dropdown";

// --- Palette (suite dark theme — monochrome series) --------------------------

const SERIES = ["#ffffff", "#a3a3a3", "#525252", "#737373", "#d4d4d4"];

// --- Sample data (placeholder until backend is connected) --------------------

const UPLOADS = [42, 58, 51, 73, 66, 88, 102, 95, 121, 134, 148, 167];
const DOWNLOADS = [310, 420, 380, 540, 505, 640, 720, 690, 820, 910, 1040, 1180];
const VIEWS = [1200, 1650, 1480, 2100, 1980, 2480, 2810, 2660, 3120, 3540, 3980, 4420];

const ACTIVITY_DATA = UPLOADS.map((u, i) => ({
  week: `W${i + 1}`,
  uploads: u,
  downloads: DOWNLOADS[i],
  views: VIEWS[i],
}));

const ASSET_TYPE_DATA = [
  { type: "Images", count: 1640, fill: SERIES[0] },
  { type: "Videos", count: 482, fill: SERIES[4] },
  { type: "Documents", count: 396, fill: SERIES[1] },
  { type: "Audio", count: 214, fill: SERIES[3] },
  { type: "3D / Other", count: 115, fill: SERIES[2] },
];

const STORAGE_DATA = [
  { type: "Images", value: 2.1, fill: SERIES[0] },
  { type: "Videos", value: 1.4, fill: SERIES[4] },
  { type: "Documents", value: 0.5, fill: SERIES[1] },
  { type: "Audio", value: 0.1, fill: SERIES[3] },
  { type: "Other", value: 0.1, fill: SERIES[2] },
];

const STORAGE_TOTAL = STORAGE_DATA.reduce((a, b) => a + b.value, 0);
const STORAGE_QUOTA = 10;

const GROWTH_DATA = [
  { week: "W1", assets: 1980 },
  { week: "W2", assets: 2120 },
  { week: "W3", assets: 2240 },
  { week: "W4", assets: 2380 },
  { week: "W5", assets: 2510 },
  { week: "W6", assets: 2620 },
  { week: "W7", assets: 2740 },
  { week: "W8", assets: 2847 },
];

const TOP_COLLECTIONS = [
  {
    name: "Brand Assets",
    description: "Logos, palettes, and identity guidelines",
    status: "Active",
    assets: 312,
    size: "1.8 GB",
    usage: 64,
  },
  {
    name: "Summer Campaign 2026",
    description: "Hero banners, social cuts, and ad creatives",
    status: "Shared",
    assets: 248,
    size: "2.4 GB",
    usage: 82,
  },
  {
    name: "Product Mockups",
    description: "Renders and lifestyle product photography",
    status: "Active",
    assets: 196,
    size: "1.2 GB",
    usage: 41,
  },
  {
    name: "Q1 Archive",
    description: "Retired campaign assets kept for reference",
    status: "Archived",
    assets: 540,
    size: "3.1 GB",
    usage: 0,
  },
];

const STATUS_META = {
  Active: { label: "Active", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  Shared: { label: "Shared", className: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  Archived: { label: "Archived", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30" },
};

const ACTIVITY_CONFIG = {
  uploads: { label: "Uploads", color: SERIES[0] },
  downloads: { label: "Downloads", color: SERIES[1] },
  views: { label: "Views", color: SERIES[2] },
};

const ASSET_TYPE_CONFIG = {
  count: { label: "Assets" },
  Images: { label: "Images" },
  Videos: { label: "Videos" },
  Documents: { label: "Documents" },
  Audio: { label: "Audio" },
  "3D / Other": { label: "3D / Other" },
};

const STORAGE_CONFIG = {
  value: { label: "Storage" },
  Images: { label: "Images" },
  Videos: { label: "Videos" },
  Documents: { label: "Documents" },
  Audio: { label: "Audio" },
  Other: { label: "Other" },
};

const GROWTH_CONFIG = {
  assets: { label: "Total assets", color: SERIES[0] },
};

const TOOLTIP_CLASS = "bg-surface-subtle border-border text-foreground";

// --- Rolling number (odometer) — shared suite overview pattern ---------------

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
        {ROLL_DIGITS.map((n) => (
          <span key={n} className="flex h-[1em] items-center justify-center leading-none">
            {n}
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

  const chars = String(value).split("");
  const digitCountBefore = chars.map((_, i) =>
    chars.slice(0, i).filter((c) => /\d/.test(c)).length,
  );

  return (
    <span className={cn("inline-flex items-center leading-none tabular-nums", className)}>
      {chars.map((char, i) => {
        if (/\d/.test(char)) {
          const delay = digitCountBefore[i] * 70;
          return (
            <RollingDigit key={i} digit={Number(char)} active={active} delay={delay} />
          );
        }
        return (
          <span key={i} className="inline-flex h-[1em] items-center leading-none">
            {char}
          </span>
        );
      })}
    </span>
  );
}

// --- Card primitive ----------------------------------------------------------

function Panel({ children, className }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-subtle text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

function PanelHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-text-secondary">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// --- Asset activity hero (multi-series line) ---------------------------------

function ActivityCard() {
  const [activeChart, setActiveChart] = useState("uploads");

  const totals = {
    uploads: UPLOADS.reduce((a, b) => a + b, 0),
    downloads: DOWNLOADS.reduce((a, b) => a + b, 0),
    views: VIEWS.reduce((a, b) => a + b, 0),
  };

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col items-stretch border-b border-border sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Asset Activity</h3>
          <p className="text-xs text-text-secondary">Totals over the last 12 weeks.</p>
        </div>
        <div className="flex">
          {["uploads", "downloads", "views"].map((key) => (
            <button
              key={key}
              type="button"
              data-active={activeChart === key}
              onClick={() => setActiveChart(key)}
              className="flex flex-1 flex-col justify-center gap-1 border-t border-border px-5 py-4 text-left transition-colors hover:bg-surface-card data-[active=true]:bg-surface-card sm:border-t-0 sm:border-l sm:px-7"
            >
              <span className="text-[11px] uppercase tracking-wider text-text-secondary">
                {ACTIVITY_CONFIG[key].label}
              </span>
              <RollingNumber
                value={totals[key].toLocaleString()}
                className="text-2xl font-bold leading-none text-white sm:text-3xl"
              />
            </button>
          ))}
        </div>
      </div>
      <div className="px-3 pb-3 pt-4">
        <ChartContainer config={ACTIVITY_CONFIG} className="aspect-auto h-[260px] w-full">
          <LineChart data={ACTIVITY_DATA} margin={{ top: 24, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#2a2a2a" />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              padding={{ left: 12, right: 12 }}
              stroke="#737373"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={36}
              stroke="#737373"
              domain={[(min) => Math.max(0, Math.floor(min * 0.85)), (max) => Math.ceil(max * 1.08)]}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
            />
            <ChartTooltip
              cursor={{ stroke: "#333333" }}
              content={<ChartTooltipContent nameKey={activeChart} className={TOOLTIP_CLASS} />}
            />
            <Line
              dataKey={activeChart}
              type="natural"
              stroke={`var(--color-${activeChart})`}
              strokeWidth={2}
              dot={{ fill: `var(--color-${activeChart})`, r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={true}
              animationDuration={800}
            >
              <LabelList
                position="top"
                offset={10}
                className="fill-foreground"
                fontSize={11}
                formatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
              />
            </Line>
          </LineChart>
        </ChartContainer>
      </div>
    </Panel>
  );
}

// --- Asset types (bar) -------------------------------------------------------

function AssetTypesCard() {
  return (
    <Panel>
      <PanelHeader title="Assets by Type" subtitle="Distribution across the library." />
      <div className="px-3 pb-3 pt-4">
        <ChartContainer config={ASSET_TYPE_CONFIG} className="aspect-auto h-[240px] w-full">
          <BarChart data={ASSET_TYPE_DATA} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#2a2a2a" />
            <XAxis dataKey="type" tickLine={false} axisLine={false} tickMargin={8} stroke="#737373" interval={0} fontSize={10} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={36}
              stroke="#737373"
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
            />
            <ChartTooltip
              cursor={{ fill: "#ffffff10" }}
              content={<ChartTooltipContent hideLabel className={TOOLTIP_CLASS} />}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {ASSET_TYPE_DATA.map((entry) => (
                <Cell key={entry.type} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </Panel>
  );
}

// --- Storage breakdown (donut) -----------------------------------------------

function StorageCard() {
  return (
    <Panel>
      <PanelHeader title="Storage" subtitle={`${STORAGE_TOTAL.toFixed(1)} GB of ${STORAGE_QUOTA} GB used.`} />
      <div className="px-3 pb-3 pt-2">
        <ChartContainer
          config={STORAGE_CONFIG}
          className="[&_.recharts-text]:fill-foreground mx-auto aspect-square max-h-[200px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="type" className={TOOLTIP_CLASS} />}
            />
            <Pie
              data={STORAGE_DATA}
              dataKey="value"
              nameKey="type"
              innerRadius={52}
              outerRadius={80}
              strokeWidth={2}
              stroke="#1a1a1a"
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-white text-2xl font-bold">
                          {STORAGE_TOTAL.toFixed(1)}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">
                          GB used
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-2 pb-1 pt-2">
          {STORAGE_DATA.map((d) => (
            <div key={d.type} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-[#c4c4c4]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.fill }} />
                {d.type}
              </span>
              <span className="tabular-nums font-medium text-foreground">{d.value} GB</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// --- Library growth (area) ---------------------------------------------------

function GrowthCard() {
  return (
    <Panel>
      <PanelHeader title="Library Growth" subtitle="Total assets stored over time." />
      <div className="px-3 pb-3 pt-4">
        <ChartContainer config={GROWTH_CONFIG} className="aspect-auto h-[240px] w-full">
          <AreaChart data={GROWTH_DATA} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-assets)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--color-assets)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#2a2a2a" />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} stroke="#737373" />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={36}
              stroke="#737373"
              domain={[(min) => Math.floor(min * 0.96), (max) => Math.ceil(max * 1.02)]}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
            />
            <ChartTooltip
              cursor={{ stroke: "#333333" }}
              content={<ChartTooltipContent className={TOOLTIP_CLASS} />}
            />
            <Area
              dataKey="assets"
              type="monotone"
              stroke="var(--color-assets)"
              strokeWidth={2}
              fill="url(#growth-fill)"
              isAnimationActive={true}
              animationDuration={800}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </Panel>
  );
}

// --- Top collections table ---------------------------------------------------

function TopCollectionsTable() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Top Collections</h3>
          <p className="text-xs text-text-secondary">Largest and most active collections.</p>
        </div>
        <Button
          variant="ghost"
          className="text-xs font-medium text-text-secondary hover:text-foreground hover:bg-surface-active px-2 py-1 rounded-lg"
        >
          View all
        </Button>
      </div>

      <div className="bg-surface-card border border-border rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-subtle border-border hover:bg-surface-subtle">
              <TableHead className="px-5 text-xs uppercase tracking-wider text-text-secondary">Collection</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-text-secondary">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-text-secondary">Assets</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-text-secondary">Size</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-text-secondary">Quota used</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TOP_COLLECTIONS.map((c) => {
              const meta = STATUS_META[c.status] || STATUS_META.Active;
              return (
                <TableRow key={c.name} className="border-border hover:bg-surface-active">
                  <TableCell className="px-5 py-3.5">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">{c.name}</span>
                      <p className="line-clamp-1 text-xs text-text-secondary">{c.description}</p>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      className={cn(
                        "min-w-[72px] justify-center whitespace-nowrap border px-2",
                        meta.className,
                      )}
                    >
                      {meta.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {c.assets.toLocaleString()}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{c.size}</TableCell>
                  <TableCell>
                    <div className="w-[130px] space-y-1.5">
                      <Progress
                        value={c.usage}
                        className="h-1.5 bg-surface-hover [&_[data-slot=progress-indicator]]:bg-[#ededed]"
                      />
                      <p className="text-xs text-text-secondary">{c.usage}%</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground hover:bg-surface-active"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// --- Screen ------------------------------------------------------------------

export function HomeScreen({ id }) {
  const { project, loading } = useProject();
  const projectName = project?.name && !loading ? project.name : null;
  const [filterValue, setFilterValue] = useState("1w");

  return (
    <MainScreenWrapper className="dark">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mt-2 gap-4">
        <div>
          <div className="flex items-center justify-center md:justify-start gap-3 w-full md:w-auto text-center md:text-left">
            {loading ? (
              <div className="h-7 w-56 rounded-md bg-surface-hover animate-pulse" />
            ) : (
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {projectName ? `${projectName} Overview` : "Assets Overview"}
              </h1>
            )}
            <span className="bg-surface-subtle text-text-secondary text-[9px] px-1.5 py-0.5 rounded border border-border font-mono tracking-widest shrink-0">
              WORKSPACE
            </span>
          </div>
          <div className="w-full mt-2">
            <p className="text-foreground0 text-sm text-center md:text-left max-w-xl">
              Track uploads, downloads, storage, and collection activity across
              your asset library.
            </p>
          </div>
        </div>
        <div className="w-full md:w-auto">
          <div className="flex w-full md:w-auto md:gap-0">
            <div className="flex-1 md:flex-none flex flex-col items-center md:pr-8">
              <span className="text-text-secondary text-[11px] uppercase tracking-wider font-medium">
                Assets
              </span>
              <RollingNumber value="2,847" className="text-white font-bold text-2xl mt-0.5" />
            </div>
            <div className="flex-1 md:flex-none flex flex-col items-center border-l border-border md:px-8">
              <span className="text-text-secondary text-[11px] uppercase tracking-wider font-medium">
                Storage
              </span>
              <RollingNumber value="4.2 GB" className="text-white font-bold text-2xl mt-0.5" />
            </div>
            <div className="flex-1 md:flex-none flex flex-col items-center border-l border-border md:pl-8">
              <span className="text-text-secondary text-[11px] uppercase tracking-wider font-medium">
                Collections
              </span>
              <RollingNumber value="5" className="text-white font-bold text-2xl mt-0.5" />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-surface-active">
        <FilterDropdown value={filterValue} onValueChange={setFilterValue} />
      </div>

      {/* Full-width activity line */}
      <ActivityCard />

      {/* Three chart columns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AssetTypesCard />
        <StorageCard />
        <GrowthCard />
      </div>

      {/* Collections table */}
      <TopCollectionsTable />
    </MainScreenWrapper>
  );
}
