"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Download,
  Eye,
  File as FileIcon,
  Globe,
  Heart,
  Images,
  Inbox,
  Mail,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@geiger/ui/chart";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import {
  DataTable,
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { TYPE_ICONS } from "@/components/internal/shared/asset_meta";
import {
  REQUEST_FILTER_OPTIONS,
  REQUEST_STATUS_META,
  STATUS_META,
  VISIBILITY_META,
  formatDate,
} from "./constants";
import { ThemeSwatch } from "./galleries_kit";
import { listGalleries } from "@/lib/supabase/galleries";
import {
  decideDownloadRequest,
  listDownloadRequests,
  listGalleryEvents,
  listProjectFavorites,
  listProjectVisitors,
  rollUpByGallery,
  rollUpDaily,
  rollUpTopAssets,
} from "@/lib/supabase/gallery_audience";
import { listAssets } from "@/lib/supabase/assets";
import { getUser } from "@/lib/supabase/user";

const CHART_COLORS = {
  ink: "var(--color-foreground)",
  grid: "var(--color-border)",
  axis: "var(--color-text-secondary)",
};

const EMPTY_ROLLUP = { views: 0, itemViews: 0, favorites: 0, downloads: 0, requests: 0, visitors: 0 };

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

/** A visitor and everything they picked in one gallery. */
function ProofingCard({ group, assetById, galleryName }) {
  return (
    <div className="border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {group.visitor?.name || group.visitor?.email || "Anonymous visitor"}
          </p>
          <p className="truncate text-[11px] text-text-tertiary">
            {group.visitor?.email ? (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" aria-hidden="true" />
                {group.visitor.email}
              </span>
            ) : (
              "No contact details"
            )}
            {galleryName ? ` · ${galleryName}` : ""}
          </p>
        </div>
        <Badge className="border border-red-500/30 bg-red-500/15 px-1.5 py-0 text-[10px] text-red-300">
          {group.assetIds.length} favorite{group.assetIds.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {group.assetIds.slice(0, 12).map((assetId) => {
          const asset = assetById.get(assetId);
          const Icon = TYPE_ICONS[asset?.type] || FileIcon;
          return (
            <span
              key={assetId}
              className="inline-flex max-w-[160px] items-center gap-1 rounded-md border border-border bg-surface-card px-1.5 py-0.5 text-[10px] text-text-secondary"
            >
              <Icon className="h-3 w-3 shrink-0" style={{ color: asset?.color || "#737373" }} />
              <span className="truncate">{asset?.name || "Unknown asset"}</span>
            </span>
          );
        })}
        {group.assetIds.length > 12 ? (
          <span className="text-[10px] text-text-tertiary">
            +{group.assetIds.length - 12} more
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ShowcaseGalleriesScreen({ projectId }) {
  const [galleries, setGalleries] = useState([]);
  const [events, setEvents] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  // Clock stamped once, when the data lands — a Date.now() read during render
  // would make the window drift on every re-render.
  const [loadedAt, setLoadedAt] = useState(0);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("30");
  const [galleryFilter, setGalleryFilter] = useState("all");
  const [requestFilter, setRequestFilter] = useState("pending");

  useEffect(() => {
    let alive = true;
    Promise.all([
      listGalleries(projectId),
      listGalleryEvents(projectId),
      listProjectVisitors(projectId),
      listProjectFavorites(projectId),
      listDownloadRequests(projectId),
      listAssets(projectId),
    ]).then(([g, e, v, f, r, a]) => {
      if (!alive) return;
      setGalleries(g ?? []);
      setEvents(e ?? []);
      setVisitors(v ?? []);
      setFavorites(f ?? []);
      setRequests(r ?? []);
      setAssets(a ?? []);
      setLoadedAt(Date.now());
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const visitorById = useMemo(() => new Map(visitors.map((v) => [v.id, v])), [visitors]);
  const galleryById = useMemo(() => new Map(galleries.map((g) => [g.id, g])), [galleries]);

  // Only published galleries belong on this screen — drafts live in the builder.
  const published = useMemo(
    () => galleries.filter((g) => g.status === "published" || g.status === "unpublished"),
    [galleries],
  );

  const galleryOptions = useMemo(
    () => [
      { value: "all", label: "All Galleries" },
      ...published.map((g) => ({ value: g.id, label: g.name })),
    ],
    [published],
  );

  const scopedEvents = useMemo(() => {
    const days = Number(range);
    const cutoff = loadedAt - days * 24 * 60 * 60 * 1000;
    return events.filter((e) => {
      if (galleryFilter !== "all" && e.galleryId !== galleryFilter) return false;
      const at = new Date(e.occurredAt).getTime();
      return Number.isFinite(at) ? at >= cutoff : true;
    });
  }, [events, range, galleryFilter, loadedAt]);

  const byGallery = useMemo(() => rollUpByGallery(scopedEvents), [scopedEvents]);
  const daily = useMemo(() => rollUpDaily(scopedEvents, Number(range)), [scopedEvents, range]);
  const topAssets = useMemo(() => rollUpTopAssets(scopedEvents), [scopedEvents]);

  const stats = useMemo(() => {
    const totals = Array.from(byGallery.values()).reduce(
      (acc, b) => ({
        views: acc.views + b.views,
        favorites: acc.favorites + b.favorites,
        downloads: acc.downloads + b.downloads,
        visitors: acc.visitors + b.visitors,
      }),
      { views: 0, favorites: 0, downloads: 0, visitors: 0 },
    );
    const live = published.filter((g) => g.status === "published").length;
    return [
      { label: "Live Galleries", value: String(live), footer: "published now" },
      { label: "Visits", value: totals.views.toLocaleString(), footer: `last ${range} days` },
      { label: "Favorites", value: totals.favorites.toLocaleString(), footer: "assets picked" },
      { label: "Downloads", value: totals.downloads.toLocaleString(), footer: "files taken" },
    ];
  }, [byGallery, published, range]);

  const filteredGalleries = useMemo(() => {
    const q = search.toLowerCase();
    return published
      .filter((g) => !q || g.name.toLowerCase().includes(q) || g.slug.toLowerCase().includes(q))
      .filter((g) => galleryFilter === "all" || g.id === galleryFilter);
  }, [published, search, galleryFilter]);

  /** Favorites grouped by (visitor, gallery) — the proofing inbox. */
  const proofing = useMemo(() => {
    const groups = new Map();
    for (const fav of favorites) {
      if (galleryFilter !== "all" && fav.galleryId !== galleryFilter) continue;
      const key = `${fav.visitorId}|${fav.galleryId}`;
      const group = groups.get(key) || {
        key,
        visitorId: fav.visitorId,
        galleryId: fav.galleryId,
        visitor: visitorById.get(fav.visitorId),
        assetIds: [],
      };
      group.assetIds.push(fav.assetId);
      groups.set(key, group);
    }
    return Array.from(groups.values()).sort((a, b) => b.assetIds.length - a.assetIds.length);
  }, [favorites, visitorById, galleryFilter]);

  const filteredRequests = useMemo(
    () =>
      requests
        .filter((r) => galleryFilter === "all" || r.galleryId === galleryFilter)
        .filter((r) => requestFilter === "all" || r.status === requestFilter)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [requests, galleryFilter, requestFilter],
  );

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests],
  );

  const handleDecide = async (request, status) => {
    const prev = requests;
    setRequests((rows) =>
      rows.map((r) => (r.id === request.id ? { ...r, status } : r)),
    );
    const user = await getUser();
    const updated = await decideDownloadRequest(request.id, status, { decidedBy: user?.id || null });
    if (updated) {
      setRequests((rows) => rows.map((r) => (r.id === request.id ? updated : r)));
      toast.success(status === "approved" ? "Download approved." : "Download denied.");
    } else {
      setRequests(prev);
      toast.error("Couldn't update the request.");
    }
  };

  const galleryColumns = [
    {
      key: "name",
      header: "Gallery",
      render: (g) => (
        <div className="flex items-center gap-3">
          <ThemeSwatch theme={g.theme} />
          <div className="min-w-0">
            <p className="max-w-[220px] truncate text-sm font-medium text-foreground">{g.name}</p>
            <p className="max-w-[240px] truncate text-[11px] text-text-tertiary">/g/{g.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (g) => (
        <div className="flex items-center gap-1.5">
          <StatusPill status={g.status} map={STATUS_META} className="text-[10px]" />
          <StatusPill status={g.visibility} map={VISIBILITY_META} className="text-[10px]" />
        </div>
      ),
    },
    {
      key: "visitors",
      header: "Visitors",
      align: "right",
      className: "tabular-nums text-xs text-muted-foreground",
      render: (g) => (byGallery.get(g.id) || EMPTY_ROLLUP).visitors.toLocaleString(),
    },
    {
      key: "views",
      header: "Visits",
      align: "right",
      className: "tabular-nums text-xs text-muted-foreground",
      render: (g) => (byGallery.get(g.id) || EMPTY_ROLLUP).views.toLocaleString(),
    },
    {
      key: "favorites",
      header: "Favorites",
      align: "right",
      className: "tabular-nums text-xs text-muted-foreground hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (g) => (byGallery.get(g.id) || EMPTY_ROLLUP).favorites.toLocaleString(),
    },
    {
      key: "downloads",
      header: "Downloads",
      align: "right",
      className: "tabular-nums text-xs text-muted-foreground hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (g) => (byGallery.get(g.id) || EMPTY_ROLLUP).downloads.toLocaleString(),
    },
    {
      key: "published",
      header: "Published",
      className: "text-xs text-text-secondary hidden xl:table-cell",
      headClassName: "hidden xl:table-cell",
      render: (g) => formatDate(g.publishedAt),
    },
  ];

  const requestColumns = [
    {
      key: "visitor",
      header: "Requested by",
      render: (r) => {
        const visitor = visitorById.get(r.visitorId);
        return (
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">
              {visitor?.name || visitor?.email || "Anonymous visitor"}
            </p>
            <p className="truncate text-[11px] text-text-tertiary">
              {galleryById.get(r.galleryId)?.name || "Unknown gallery"}
            </p>
          </div>
        );
      },
    },
    {
      key: "scope",
      header: "Scope",
      className: "text-xs text-muted-foreground",
      render: (r) =>
        r.scope === "gallery"
          ? "Whole gallery"
          : `${r.assetIds.length} asset${r.assetIds.length === 1 ? "" : "s"}`,
    },
    {
      key: "message",
      header: "Message",
      className: "text-xs text-text-secondary hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (r) => (
        <span className="line-clamp-1 max-w-[280px]">{r.message || "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusPill status={r.status} map={REQUEST_STATUS_META} className="text-[10px]" />
      ),
    },
    {
      key: "created",
      header: "Asked",
      className: "text-xs text-text-secondary hidden xl:table-cell",
      headClassName: "hidden xl:table-cell",
      render: (r) => formatDate(r.createdAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) =>
        r.status === "pending" ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => handleDecide(r, "approved")}
            >
              <Check className="mr-1 h-3 w-3" />
              Approve
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-400 hover:bg-red-500/10"
              onClick={() => handleDecide(r, "denied")}
            >
              <X className="mr-1 h-3 w-3" />
              Deny
            </Button>
          </div>
        ) : (
          <span className="text-[11px] text-text-tertiary">
            {r.decidedAt ? formatDate(r.decidedAt) : "—"}
          </span>
        ),
    },
  ];

  if (loading) {
    return (
      <MainScreenWrapper>
        <ScreenHeader
          title="Showcase Galleries"
          description="What visitors did with your published galleries."
        />
        <LoadingArea panel size={72} />
      </MainScreenWrapper>
    );
  }

  if (published.length === 0) {
    return (
      <MainScreenWrapper>
        <ScreenHeader
          title="Showcase Galleries"
          description="What visitors did with your published galleries."
        />
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Globe}
            title="Nothing published yet"
            description="Publish a gallery from Gallery Builder and its visits, favorites and download requests will land here."
          />
        </div>
      </MainScreenWrapper>
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Showcase Galleries"
        description="What visitors did with your published galleries."
        actions={
          pendingCount > 0 ? (
            <Badge className="border border-amber-500/30 bg-amber-500/15 px-2 py-1 text-xs text-amber-300">
              <Inbox className="mr-1 h-3.5 w-3.5" />
              {pendingCount} pending request{pendingCount === 1 ? "" : "s"}
            </Badge>
          ) : null
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={galleryFilter}
            onValueChange={setGalleryFilter}
            options={galleryOptions}
            placeholder="Gallery"
            icon={Images}
          />
          <FilterDropdown
            value={range}
            onValueChange={setRange}
            options={RANGE_OPTIONS}
            placeholder="Range"
            icon={SlidersHorizontal}
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search galleries..."
          className="w-full sm:w-64"
        />
      </Toolbar>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            title="Visits"
            description={`Gallery views over the last ${range} days.`}
          >
            <ChartContainer
              config={{ views: { label: "Visits", color: CHART_COLORS.ink } }}
              className="h-[240px] w-full"
            >
              <LineChart data={daily} margin={{ top: 16, right: 16, left: 12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                  tickFormatter={(value) => String(value).slice(5)}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                <Line
                  dataKey="views"
                  type="monotone"
                  stroke={CHART_COLORS.ink}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartContainer>
          </SectionCard>
        </div>

        <SectionCard title="Most engaged" description="Weighted by views, favorites and downloads.">
          {topAssets.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-tertiary">
              No asset activity in this window yet.
            </p>
          ) : (
            <div className="space-y-2">
              {topAssets.map((row) => {
                const asset = assetById.get(row.assetId);
                const Icon = TYPE_ICONS[asset?.type] || FileIcon;
                return (
                  <div key={row.assetId} className="flex items-center gap-2.5">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ background: `${asset?.color || "#737373"}20` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: asset?.color || "#737373" }} />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                      {asset?.name || "Unknown asset"}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-[11px] tabular-nums text-text-tertiary">
                      <span className="inline-flex items-center gap-0.5">
                        <Eye className="h-3 w-3" aria-hidden="true" />
                        {row.views}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Heart className="h-3 w-3" aria-hidden="true" />
                        {row.favorites}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Download className="h-3 w-3" aria-hidden="true" />
                        {row.downloads}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Published galleries" description="Per-gallery audience totals." bodyPadding={false}>
        <DataTable
          columns={galleryColumns}
          data={filteredGalleries}
          getRowKey={(g) => g.id}
          empty={
            <EmptyState
              icon={Images}
              title="No matching galleries"
              description="Try a different search or gallery filter."
            />
          }
        />
      </SectionCard>

      <SectionCard
        title="Proofing"
        description="What each visitor picked out — favorites grouped by person."
        bodyPadding={false}
      >
        {proofing.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No favorites yet"
            description="When visitors mark assets in a gallery, their picks collect here."
          />
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            {proofing.map((group) => (
              <ProofingCard
                key={group.key}
                group={group}
                assetById={assetById}
                galleryName={galleryById.get(group.galleryId)?.name}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Download requests"
        description="Approve or deny what visitors asked to take away."
        action={
          <FilterDropdown
            value={requestFilter}
            onValueChange={setRequestFilter}
            options={REQUEST_FILTER_OPTIONS}
            placeholder="Status"
            height="h-8"
          />
        }
        bodyPadding={false}
      >
        <DataTable
          columns={requestColumns}
          data={filteredRequests}
          getRowKey={(r) => r.id}
          empty={
            <EmptyState
              icon={Users}
              title={requestFilter === "pending" ? "Nothing waiting" : "No requests"}
              description={
                requestFilter === "pending"
                  ? "Requests needing a decision will appear here."
                  : "No download requests match this filter."
              }
            />
          }
        />
      </SectionCard>
    </MainScreenWrapper>
  );
}

export default ShowcaseGalleriesScreen;
