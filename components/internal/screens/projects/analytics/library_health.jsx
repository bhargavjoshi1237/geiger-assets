"use client";

import React, { useEffect, useMemo, useState } from "react";
import { HeartPulse } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import { listAssets } from "@/lib/supabase/assets";
import { listGroups } from "@/lib/supabase/duplicates";
import { listDeliveryEvents } from "@/lib/supabase/delivery";
import {
  RANGE_OPTIONS,
  formatCount,
  formatDate,
  formatPercent,
  inRange,
  nowMs,
  rangeDays,
} from "./constants";

// Library Health — is the library clean, described, rights-safe, and used?
//
// Nothing here is recomputed from scratch: metadata and rights come from the
// asset rows, duplicate volume is reused from the duplicates review data
// (listGroups), and usage comes from the delivery log. An empty library
// renders the empty state, never fabricated queues.

const STATUS_MAP = {
  approved: { label: "Approved", variant: "success", dotClass: "bg-emerald-400" },
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  review: { label: "In Review", variant: "warning", dotClass: "bg-amber-400" },
  archived: { label: "Archived", variant: "neutral", dotClass: "bg-zinc-500" },
  processing: { label: "Processing", variant: "info", dotClass: "bg-sky-400" },
};

const ARCHIVE_AGE_MS = 180 * 24 * 60 * 60 * 1000;

function rightsExpiryOf(asset) {
  const raw = asset?.rightsExpiresAt ?? asset?.rights_expires_at ?? asset?.metadata?.rightsExpiresAt ?? null;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

function isComplete(asset) {
  return Boolean(asset.description?.trim()) && (asset.tags?.length ?? 0) > 0;
}

export function LibraryHealthScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [deliveryEvents, setDeliveryEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([listAssets(projectId), listGroups(projectId), listDeliveryEvents(projectId, { limit: 5000 })]).then(
      ([assetRows, groupRows, eventRows]) => {
        if (!alive) return;
        setAssets(assetRows ?? []);
        setGroups(groupRows ?? []);
        setDeliveryEvents(eventRows ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const liveAssets = useMemo(() => assets.filter((asset) => asset.status !== "archived"), [assets]);

  const activeAssetIds = useMemo(() => {
    const ids = new Set();
    for (const event of deliveryEvents) {
      if (event.assetId && inRange(event.servedAt, range)) ids.add(event.assetId);
    }
    return ids;
  }, [deliveryEvents, range]);

  const expiredRights = useMemo(() => {
    const now = nowMs();
    return liveAssets.filter((asset) => {
      const expiry = rightsExpiryOf(asset);
      return expiry != null && expiry < now;
    });
  }, [liveAssets]);

  const missingMetadata = useMemo(() => liveAssets.filter((asset) => !isComplete(asset)), [liveAssets]);

  const unapproved = useMemo(
    () => liveAssets.filter((asset) => asset.status !== "approved"),
    [liveAssets],
  );

  const unused = useMemo(
    () =>
      liveAssets.filter(
        (asset) => (asset.downloads ?? 0) === 0 && !activeAssetIds.has(asset.id),
      ),
    [liveAssets, activeAssetIds],
  );

  const archiveCandidates = useMemo(() => {
    const now = nowMs();
    return unused.filter((asset) => {
      const created = new Date(asset.createdAt).getTime();
      return Number.isFinite(created) && now - created > ARCHIVE_AGE_MS;
    });
  }, [unused]);

  const duplicateVolume = useMemo(() => {
    const open = groups.filter((group) => group.status === "open");
    return {
      open: open.length,
      assets: open.reduce((sum, group) => sum + Math.max((group.memberCount ?? 0) - 1, 0), 0),
    };
  }, [groups]);

  const stats = useMemo(
    () => [
      {
        label: "Completeness",
        value: formatPercent(liveAssets.length ? (liveAssets.length - missingMetadata.length) / liveAssets.length : NaN),
        footer: `${formatCount(liveAssets.length - missingMetadata.length)} of ${formatCount(liveAssets.length)} described`,
      },
      {
        label: "Open duplicates",
        value: formatCount(duplicateVolume.open),
        footer: `${formatCount(duplicateVolume.assets)} duplicate assets`,
      },
      {
        label: "Expired rights",
        value: formatCount(expiredRights.length),
        footer: "license term passed",
      },
      {
        label: "Unused",
        value: formatCount(unused.length),
        footer: `no use in ${rangeDays(range)} days`,
      },
    ],
    [liveAssets, missingMetadata, duplicateVolume, expiredRights, unused, range],
  );

  const needle = search.trim().toLowerCase();
  const matches = (asset) =>
    !needle ||
    `${asset.name} ${asset.type} ${asset.format} ${(asset.tags || []).join(" ")}`
      .toLowerCase()
      .includes(needle);

  const assetColumns = (extra) => [
    {
      key: "asset",
      header: "Asset",
      render: (asset) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">{asset.name || "Untitled"}</span>
          <span className="truncate text-xs text-text-secondary">
            {[asset.type, asset.format].filter(Boolean).join(" · ") || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (asset) => <StatusPill status={asset.status} map={STATUS_MAP} />,
    },
    ...(extra || []),
  ];

  const filtersActive = search.trim() !== "";
  const clearFilters = () => setSearch("");

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Library Health"
        description="Metadata completeness, duplicates, rights, approvals, usage, and archive candidates."
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
          <LogoLoading size={56} aria-label="Loading library health" />
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={HeartPulse}
            title="No assets to assess yet"
            description="Health queues appear here once the library holds assets."
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Needs metadata"
              description="Missing a description, tags, or both."
            >
              <DataTable
                columns={assetColumns()}
                data={missingMetadata.filter(matches).slice(0, 8)}
                getRowKey={(asset) => asset.id}
                empty={
                  <EmptyState
                    icon={HeartPulse}
                    title={filtersActive ? "No assets match this filter" : "Fully described"}
                    description={
                      filtersActive ? "Try a different search term." : "Every live asset has a description and tags."
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

            <SectionCard title="Unapproved" description="Live assets not yet approved.">
              <DataTable
                columns={assetColumns()}
                data={unapproved.filter(matches).slice(0, 8)}
                getRowKey={(asset) => asset.id}
                empty={
                  <EmptyState
                    icon={HeartPulse}
                    title={filtersActive ? "No assets match this filter" : "Nothing awaiting approval"}
                    description={
                      filtersActive ? "Try a different search term." : "Every live asset is approved."
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
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Archive candidates"
              description={`Unused in the last ${rangeDays(range)} days and older than 180 days.`}
            >
              <DataTable
                columns={assetColumns([
                  {
                    key: "created",
                    header: "Created",
                    className: "hidden text-xs text-text-secondary md:table-cell",
                    headClassName: "hidden md:table-cell",
                    render: (asset) => formatDate(asset.createdAt),
                  },
                ])}
                data={archiveCandidates.filter(matches).slice(0, 8)}
                getRowKey={(asset) => asset.id}
                empty={
                  <EmptyState
                    icon={HeartPulse}
                    title="No archive candidates"
                    description="Nothing is both old and unused in the selected window."
                  />
                }
              />
            </SectionCard>

            <SectionCard title="Duplicates" description="Reused from Duplicate Review — not recomputed here.">
              {duplicateVolume.open === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">
                  No open duplicate groups — the library is clean.
                </p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-secondary">Open groups</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCount(duplicateVolume.open)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-secondary">Duplicate assets</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCount(duplicateVolume.assets)}
                    </span>
                  </div>
                  <p className="pt-1 text-xs text-text-tertiary">
                    Review and resolve them in Duplicate Review; this screen only
                    reports that queue&apos;s volume.
                  </p>
                </div>
              )}
              {expiredRights.length > 0 ? (
                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Expired rights ({formatCount(expiredRights.length)})
                  </p>
                  {expiredRights.filter(matches).slice(0, 5).map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {asset.name || "Untitled"}
                      </span>
                      <span className="shrink-0 tabular-nums text-red-400">
                        expired {formatDate(rightsExpiryOf(asset))}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 border-t border-border pt-4 text-xs text-text-tertiary">
                  No expired rights recorded — expiry is read from each asset&apos;s
                  recorded rights term, when one exists.
                </p>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default LibraryHealthScreen;
