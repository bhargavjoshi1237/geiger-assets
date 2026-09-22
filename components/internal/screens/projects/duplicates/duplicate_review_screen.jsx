"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Eye,
  CheckCircle2,
  EyeOff,
  X,
  ArrowUpDown,
  SlidersHorizontal,
  CopyCheck,
  RadarIcon,
  RefreshCw,
} from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { ActionMenu } from "@geiger/ui/action-menu";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  MATCH_META,
  STATUS_META,
  MATCH_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  SORT_OPTIONS,
  formatDate,
} from "./constants";
import { listGroups, resolveGroup, ignoreGroup } from "@/lib/supabase/duplicates";
import { DuplicateGroupDetailScreen } from "./duplicate_group_detail";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";

function RowActions({ group, onReview, onResolve, onIgnore }) {
  return (
    <ActionMenu
      label="Duplicate group actions"
      items={[
        { icon: Eye, label: "Review", onSelect: () => onReview(group) },
        { icon: CheckCircle2, label: "Resolve", onSelect: () => onResolve(group) },
        { separator: true },
        { icon: EyeOff, label: "Ignore", onSelect: () => onIgnore(group) },
      ]}
    />
  );
}

export function DuplicateReviewScreen({ projectId }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [matchFilter, setMatchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortValue, setSortValue] = useState("created-desc");
  const [openGroupId, setOpenGroupId] = useState(null);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    listGroups(projectId).then((rows) => {
      if (!alive) return;
      setGroups(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const rows = await listGroups(projectId);
    setGroups(rows ?? []);
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    let result = [...groups];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (g) =>
          g.recommendedAction.toLowerCase().includes(q) ||
          g.matchType.toLowerCase().includes(q) ||
          (MATCH_META[g.matchType]?.label || "").toLowerCase().includes(q),
      );
    }
    if (matchFilter !== "all") result = result.filter((g) => g.matchType === matchFilter);
    if (statusFilter !== "all") result = result.filter((g) => g.status === statusFilter);

    const [field, direction] = sortValue.split("-");
    result.sort((a, b) => {
      let cmp = 0;
      if (field === "created") cmp = new Date(a.createdAt) - new Date(b.createdAt);
      else if (field === "similarity") cmp = a.similarity - b.similarity;
      else if (field === "members") cmp = a.memberCount - b.memberCount;
      return direction === "desc" ? -cmp : cmp;
    });
    return result;
  }, [groups, search, matchFilter, statusFilter, sortValue]);

  const stats = useMemo(() => {
    const open = groups.filter((g) => g.status === "open").length;
    const exact = groups.filter((g) => g.matchType === "exact").length;
    const near = groups.filter((g) => g.matchType === "near").length;
    const dupeAssets = groups.reduce((sum, g) => sum + Math.max(g.memberCount - 1, 0), 0);
    return [
      { label: "Open Groups", value: String(open), footer: "awaiting review" },
      { label: "Exact", value: String(exact), footer: "byte-identical" },
      { label: "Near", value: String(near), footer: "near-duplicate" },
      { label: "Duplicate Assets", value: String(dupeAssets), footer: "could be removed" },
    ];
  }, [groups]);

  const hasActiveFilters =
    matchFilter !== "all" || statusFilter !== "all" || Boolean(search);

  const clearFilters = () => {
    setMatchFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  const handleResolve = async (group) => {
    const prev = groups;
    setGroups((rows) => rows.map((g) => (g.id === group.id ? { ...g, status: "resolved" } : g)));
    const updated = await resolveGroup(group.id);
    if (updated) {
      setGroups((rows) => rows.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)));
    } else {
      setGroups(prev);
    }
  };

  const handleIgnore = async (group) => {
    const prev = groups;
    setGroups((rows) => rows.map((g) => (g.id === group.id ? { ...g, status: "ignored" } : g)));
    const updated = await ignoreGroup(group.id);
    if (updated) {
      setGroups((rows) => rows.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)));
    } else {
      setGroups(prev);
    }
  };

  const syncRow = (updated) =>
    setGroups((rows) => rows.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)));

  const columns = [
    {
      key: "group",
      header: "Group",
      render: (g) => (
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
              MATCH_META[g.matchType]?.className || MATCH_META.exact.className,
            )}
          >
            <CopyCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Duplicate group</p>
            <p className="max-w-[280px] truncate text-[11px] text-text-tertiary">
              {g.recommendedAction || "No recommendation yet"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "match",
      header: "Match",
      render: (g) => (
        <Badge
          className={cn(
            "border px-1.5 py-0 text-[10px]",
            MATCH_META[g.matchType]?.className || MATCH_META.exact.className,
          )}
        >
          {MATCH_META[g.matchType]?.label || g.matchType}
        </Badge>
      ),
    },
    {
      key: "similarity",
      header: "Similarity",
      className: "tabular-nums text-xs text-muted-foreground",
      render: (g) => `${g.similarity}%`,
    },
    {
      key: "members",
      header: "Members",
      className: "tabular-nums text-xs text-text-secondary hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (g) => g.memberCount,
    },
    {
      key: "status",
      header: "Status",
      render: (g) => <StatusPill status={g.status} map={STATUS_META} className="text-[10px]" />,
    },
    {
      key: "created",
      header: "Detected",
      className: "text-xs text-text-secondary hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (g) => formatDate(g.createdAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (g) => (
        <RowActions
          group={g}
          onReview={(x) => setOpenGroupId(x.id)}
          onResolve={handleResolve}
          onIgnore={handleIgnore}
        />
      ),
    },
  ];

  if (openGroupId) {
    return (
      <DuplicateGroupDetailScreen
        key={openGroupId}
        id={openGroupId}
        onBack={() => setOpenGroupId(null)}
        onChange={syncRow}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Duplicate Review"
        description="Find and resolve duplicate or near-duplicate assets."
        actions={
          <Button
            variant="outline"
            disabled={refreshing}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={handleRefresh}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={matchFilter}
            onValueChange={setMatchFilter}
            options={MATCH_FILTER_OPTIONS}
            placeholder="Match"
            icon={SlidersHorizontal}
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            placeholder="Status"
          />
          <FilterDropdown
            value={sortValue}
            onValueChange={setSortValue}
            options={SORT_OPTIONS}
            placeholder="Sort"
            icon={ArrowUpDown}
          />
          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
              onClick={clearFilters}
            >
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          ) : null}
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search recommendations..."
          className="w-full sm:w-64"
        />
      </Toolbar>

      {loading ? (
        <LoadingArea panel className="h-64 py-0" />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(g) => g.id}
          onRowClick={(g) => setOpenGroupId(g.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={RadarIcon}
                title="No duplicate groups"
                description={
                  hasActiveFilters
                    ? "Try adjusting your filters or search query."
                    : "Your library is clean — no duplicates have been detected."
                }
                action={
                  hasActiveFilters ? (
                    <Button
                      variant="outline"
                      className="border-border bg-transparent text-muted-foreground hover:bg-surface-active"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            </div>
          }
        />
      )}

      {!loading && filtered.length > 0 ? (
        <div className="text-xs text-text-secondary">
          Showing {filtered.length} of {groups.length} groups
        </div>
      ) : null}
    </MainScreenWrapper>
  );
}

export default DuplicateReviewScreen;
