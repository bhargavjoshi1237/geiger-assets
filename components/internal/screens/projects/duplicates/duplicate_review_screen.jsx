"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  MoreHorizontal,
  Eye,
  CheckCircle2,
  EyeOff,
  X,
  ArrowUpDown,
  SlidersHorizontal,
  CopyCheck,
  Loader2,
  RadarIcon,
  ScanSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  StatsBar,
  SearchInput,
  StatusPill,
  EmptyState,
  DataTable,
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

function FilterDropdown({ value, onValueChange, options, placeholder, icon: Icon }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-8 gap-1.5 rounded-md border-border bg-surface-card px-3 text-xs font-medium text-foreground hover:bg-surface-subtle"
        >
          {Icon ? <Icon className="h-3.5 w-3.5 text-text-secondary" /> : null}
          {options.find((o) => o.value === value)?.label || placeholder}
          <ChevronDown className="h-3 w-3 text-text-secondary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="border-border bg-surface-subtle text-foreground" align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="cursor-pointer text-xs focus:bg-surface-hover focus:text-foreground"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowActions({ group, onReview, onResolve, onIgnore }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Duplicate group actions"
            className="h-7 w-7 text-text-secondary hover:bg-surface-hover hover:text-foreground"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="border-border bg-surface-subtle text-foreground" align="end">
          <DropdownMenuItem
            className="cursor-pointer text-xs focus:bg-surface-hover"
            onClick={() => onReview(group)}
          >
            <Eye className="mr-2 h-3.5 w-3.5" /> Review
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-xs focus:bg-surface-hover"
            onClick={() => onResolve(group)}
          >
            <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Resolve
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-surface-hover" />
          <DropdownMenuItem
            className="cursor-pointer text-xs focus:bg-surface-hover"
            onClick={() => onIgnore(group)}
          >
            <EyeOff className="mr-2 h-3.5 w-3.5" /> Ignore
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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

  useEffect(() => {
    listGroups(projectId).then((rows) => {
      setGroups(rows ?? []);
      setLoading(false);
    });
  }, []);

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
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="Duplicate Review"
        description="Find and resolve duplicate or near-duplicate assets."
        actions={
          <Button
            variant="outline"
            className="h-9 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => console.info("[duplicates] scan requested")}
          >
            <ScanSearch className="mr-1.5 h-4 w-4" />
            Scan for duplicates
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search recommendations..."
            className="w-full sm:w-64"
          />
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
        <FilterDropdown
          value={sortValue}
          onValueChange={setSortValue}
          options={SORT_OPTIONS}
          placeholder="Sort"
          icon={ArrowUpDown}
        />
      </Toolbar>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(g) => g.id}
          onRowClick={(g) => setOpenGroupId(g.id)}
          empty={
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
                    className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                ) : null
              }
            />
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
