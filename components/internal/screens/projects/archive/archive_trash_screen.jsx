"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  MoreHorizontal,
  Eye,
  RotateCcw,
  Trash2,
  X,
  ArrowUpDown,
  SlidersHorizontal,
  Archive as ArchiveIcon,
  Loader2,
  File,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  StatsBar,
  SearchInput,
  EmptyState,
  DataTable,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  TYPE_ICONS,
  FILE_TYPE_COLORS,
  TYPE_FILTER_OPTIONS,
  SORT_OPTIONS,
  formatBytes,
  formatDate,
} from "./constants";
import {
  listArchived,
  listTrashed,
  restoreFromArchive,
  trashAsset,
  restoreFromTrash,
  purgeAsset,
} from "@/lib/supabase/archive";
import { ArchiveDetailScreen } from "./archive_detail";

const VIEWS = [
  { value: "archived", label: "Archived" },
  { value: "trash", label: "Trash" },
];

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

function AssetThumb({ asset }) {
  const Icon = TYPE_ICONS[asset.type] || File;
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
      style={{ background: `${asset.color}15`, borderColor: `${asset.color}25` }}
    >
      <Icon className="h-4 w-4" style={{ color: asset.color || "#737373" }} />
    </div>
  );
}

function RowActions({ asset, isTrash, onView, onRestore, onTrash, onPurge }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Asset actions"
            className="h-7 w-7 text-text-secondary hover:bg-surface-hover hover:text-foreground"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="border-border bg-surface-subtle text-foreground" align="end">
          <DropdownMenuItem
            className="cursor-pointer text-xs focus:bg-surface-hover"
            onClick={() => onView(asset)}
          >
            <Eye className="mr-2 h-3.5 w-3.5" /> View
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-xs focus:bg-surface-hover"
            onClick={() => onRestore(asset)}
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" /> Restore
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-surface-hover" />
          {isTrash ? (
            <DropdownMenuItem
              className="cursor-pointer text-xs text-red-400 focus:bg-red-500/10 focus:text-red-400"
              onClick={() => onPurge(asset)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete permanently
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="cursor-pointer text-xs text-red-400 focus:bg-red-500/10 focus:text-red-400"
              onClick={() => onTrash(asset)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Move to Trash
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ViewToggle({ view, onChange, counts }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-subtle p-1">
      {VIEWS.map((v) => (
        <button
          key={v.value}
          type="button"
          onClick={() => onChange(v.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            view === v.value
              ? "bg-surface-card text-foreground"
              : "text-text-secondary hover:text-foreground",
          )}
        >
          {v.label}
          <span className="tabular-nums text-text-tertiary">{counts[v.value]}</span>
        </button>
      ))}
    </div>
  );
}

export function ArchiveTrashScreen({ projectId }) {
  const [view, setView] = useState("archived");
  const [archived, setArchived] = useState([]);
  const [trashed, setTrashed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortValue, setSortValue] = useState("date-desc");
  const [selectedId, setSelectedId] = useState(null);
  const [purgeTarget, setPurgeTarget] = useState(null);

  const isTrash = view === "trash";

  useEffect(() => {
    Promise.all([listArchived(projectId), listTrashed(projectId)]).then(([a, t]) => {
      setArchived(a ?? []);
      setTrashed(t ?? []);
      setLoading(false);
    });
  }, []);

  const activeRows = isTrash ? trashed : archived;

  const filtered = useMemo(() => {
    let result = [...activeRows];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.format.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (typeFilter !== "all") result = result.filter((a) => a.type === typeFilter);

    const dateOf = (a) => (isTrash ? a.deletedAt : a.updatedAt);
    const [field, direction] = sortValue.split("-");
    result.sort((a, b) => {
      let cmp = 0;
      if (field === "date") cmp = new Date(dateOf(a)) - new Date(dateOf(b));
      else if (field === "name") cmp = a.name.localeCompare(b.name);
      else if (field === "size") cmp = a.sizeBytes - b.sizeBytes;
      return direction === "desc" ? -cmp : cmp;
    });
    return result;
  }, [activeRows, search, typeFilter, sortValue, isTrash]);

  const stats = useMemo(() => {
    const trashBytes = trashed.reduce((sum, a) => sum + a.sizeBytes, 0);
    return [
      { label: "Archived", value: String(archived.length), footer: "retired from library" },
      { label: "In Trash", value: String(trashed.length), footer: "pending deletion" },
      { label: "Trash Size", value: formatBytes(trashBytes), footer: "reclaimable storage" },
      {
        label: "Recoverable",
        value: String(archived.length + trashed.length),
        footer: "can be restored",
      },
    ];
  }, [archived, trashed]);

  const hasActiveFilters = typeFilter !== "all" || Boolean(search);

  const clearFilters = () => {
    setTypeFilter("all");
    setSearch("");
  };

  const switchView = (v) => {
    setView(v);
    clearFilters();
    setSortValue("date-desc");
  };

  // Re-fetch a single row after a detail-screen action changed its state.
  const syncRow = async () => {
    const [a, t] = await Promise.all([listArchived(projectId), listTrashed(projectId)]);
    setArchived(a ?? []);
    setTrashed(t ?? []);
  };

  const handleRestoreArchive = async (asset) => {
    const prev = archived;
    setArchived((rows) => rows.filter((a) => a.id !== asset.id));
    const ok = await restoreFromArchive(asset.id);
    if (!ok) setArchived(prev);
  };

  const handleTrashFromArchive = async (asset) => {
    const prevA = archived;
    const prevT = trashed;
    setArchived((rows) => rows.filter((a) => a.id !== asset.id));
    setTrashed((rows) => [{ ...asset, deletedAt: new Date().toISOString() }, ...rows]);
    const ok = await trashAsset(asset.id);
    if (!ok) {
      setArchived(prevA);
      setTrashed(prevT);
    }
  };

  const handleRestoreTrash = async (asset) => {
    const prev = trashed;
    setTrashed((rows) => rows.filter((a) => a.id !== asset.id));
    const ok = await restoreFromTrash(asset.id);
    if (!ok) setTrashed(prev);
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    const prev = trashed;
    const id = purgeTarget.id;
    setTrashed((rows) => rows.filter((a) => a.id !== id));
    setPurgeTarget(null);
    const ok = await purgeAsset(id);
    if (!ok) setTrashed(prev);
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (a) => (
        <div className="flex items-center gap-3">
          <AssetThumb asset={a} />
          <div className="min-w-0">
            <p className="max-w-[260px] truncate text-sm font-medium text-foreground">{a.name}</p>
            <div className="mt-0.5 flex gap-1">
              {a.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] text-text-tertiary">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (a) => (
        <Badge className={cn("border px-1.5 py-0 text-[10px]", FILE_TYPE_COLORS[a.type])}>
          {a.format || a.type}
        </Badge>
      ),
    },
    {
      key: "size",
      header: "Size",
      className: "tabular-nums text-xs text-muted-foreground",
      render: (a) => formatBytes(a.sizeBytes),
    },
    {
      key: "folder",
      header: "Folder",
      className: "text-xs text-text-secondary hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => a.folder || "root",
    },
    {
      key: "date",
      header: isTrash ? "Trashed" : "Archived",
      className: "text-xs text-text-secondary hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (a) => formatDate(isTrash ? a.deletedAt : a.updatedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (a) => (
        <RowActions
          asset={a}
          isTrash={isTrash}
          onView={(x) => setSelectedId(x.id)}
          onRestore={isTrash ? handleRestoreTrash : handleRestoreArchive}
          onTrash={handleTrashFromArchive}
          onPurge={(x) => setPurgeTarget(x)}
        />
      ),
    },
  ];

  if (selectedId) {
    return (
      <ArchiveDetailScreen
        key={selectedId}
        id={selectedId}
        mode={view}
        onBack={() => setSelectedId(null)}
        onChange={syncRow}
      />
    );
  }

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="Archive & Trash"
        description="Retire content without immediately losing it."
        actions={
          <ViewToggle
            view={view}
            onChange={switchView}
            counts={{ archived: archived.length, trash: trashed.length }}
          />
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search assets..."
            className="w-full sm:w-64"
          />
          <FilterDropdown
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={TYPE_FILTER_OPTIONS}
            placeholder="Type"
            icon={SlidersHorizontal}
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
          getRowKey={(a) => a.id}
          onRowClick={(a) => setSelectedId(a.id)}
          empty={
            <EmptyState
              icon={isTrash ? Trash2 : ArchiveIcon}
              title={
                hasActiveFilters
                  ? "No results"
                  : isTrash
                    ? "Trash is empty"
                    : "Nothing archived"
              }
              description={
                hasActiveFilters
                  ? "Try adjusting your filters or search query."
                  : isTrash
                    ? "Deleted assets will appear here until you permanently remove them."
                    : "Archived assets will appear here, ready to restore at any time."
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
          Showing {filtered.length} of {activeRows.length}{" "}
          {isTrash ? "trashed" : "archived"} assets
        </div>
      ) : null}

      <Dialog open={Boolean(purgeTarget)} onOpenChange={(o) => !o && setPurgeTarget(null)}>
        <DialogContent className="max-w-md border-border bg-surface-subtle text-foreground">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Delete permanently?</DialogTitle>
            <DialogDescription className="text-sm text-text-secondary">
              This will permanently remove{" "}
              <span className="font-medium text-foreground">{purgeTarget?.name}</span>. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
              onClick={() => setPurgeTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-xs text-white hover:bg-red-500"
              onClick={handlePurge}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default ArchiveTrashScreen;
