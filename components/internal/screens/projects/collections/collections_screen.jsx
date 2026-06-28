"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Star,
  ArrowUpRight,
  ArrowUpDown,
  SlidersHorizontal,
  Eye,
  Layers,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  StatusPill,
  EmptyState,
  DataTable,
  Toolbar,
  Field,
} from "@/components/internal/shared/screen_kit";
import {
  TYPE_META,
  VISIBILITY_META,
  TYPE_OPTIONS,
  VISIBILITY_OPTIONS,
  TYPE_FILTER_OPTIONS,
  VISIBILITY_FILTER_OPTIONS,
  SORT_OPTIONS,
  formatDate,
} from "./constants";
import {
  listCollections,
  createCollection,
  updateCollection,
  softDeleteCollection,
} from "@/lib/supabase/collections";
import { CollectionDetailScreen } from "./collection_detail";

const EMPTY_DRAFT = {
  name: "",
  description: "",
  type: "manual",
  visibility: "private",
  isFavorite: false,
};

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

function CoverSwatch({ color }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
      style={{ background: `${color}25`, borderColor: `${color}40` }}
    >
      <Layers className="h-4 w-4" style={{ color: color || "#737373" }} />
    </div>
  );
}

function RowActions({ collection, onOpen, onToggleFavorite, onDelete }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Collection actions"
            className="h-7 w-7 text-text-secondary hover:bg-surface-hover hover:text-foreground"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="border-border bg-surface-subtle text-foreground" align="end">
          <DropdownMenuItem
            className="cursor-pointer text-xs focus:bg-surface-hover"
            onClick={() => onOpen(collection)}
          >
            <ArrowUpRight className="mr-2 h-3.5 w-3.5" /> Open
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-xs focus:bg-surface-hover"
            onClick={() => onToggleFavorite(collection)}
          >
            <Star
              className={cn(
                "mr-2 h-3.5 w-3.5",
                collection.isFavorite && "fill-amber-400 text-amber-400",
              )}
            />
            {collection.isFavorite ? "Unfavorite" : "Favorite"}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-surface-hover" />
          <DropdownMenuItem
            className="cursor-pointer text-xs text-red-400 focus:bg-red-500/10 focus:text-red-400"
            onClick={() => onDelete(collection)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CreateDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    await onCreate(draft);
    setSaving(false);
    setDraft(EMPTY_DRAFT);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Collection</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Curate assets without changing their library location.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="collection-name">
            <Input
              id="collection-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Brand kit, Q3 launch…"
              className="border-border bg-surface-card text-foreground"
            />
          </Field>
          <Field label="Description" htmlFor="collection-desc">
            <Textarea
              id="collection-desc"
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="What's this collection for?"
              className="min-h-20 border-border bg-surface-card text-foreground"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value={draft.type} onValueChange={set("type")}>
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle text-foreground">
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Visibility">
              <Select value={draft.visibility} onValueChange={set("visibility")}>
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle text-foreground">
                  {VISIBILITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Favorite</p>
              <p className="text-xs text-text-secondary">Pin this collection for quick access.</p>
            </div>
            <Switch checked={draft.isFavorite} onCheckedChange={set("isFavorite")} />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={submit}
            disabled={saving || !draft.name.trim()}
          >
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Create Collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CollectionsScreen({ projectId }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [sortValue, setSortValue] = useState("modified-desc");
  const [openId, setOpenId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    listCollections(projectId).then((rows) => {
      setCollections(rows ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    let result = [...collections];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== "all") result = result.filter((c) => c.type === typeFilter);
    if (visibilityFilter !== "all")
      result = result.filter((c) => c.visibility === visibilityFilter);

    const [field, direction] = sortValue.split("-");
    result.sort((a, b) => {
      let cmp = 0;
      if (field === "modified") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
      else if (field === "name") cmp = a.name.localeCompare(b.name);
      else if (field === "assets") cmp = a.assetCount - b.assetCount;
      return direction === "desc" ? -cmp : cmp;
    });
    return result;
  }, [collections, search, typeFilter, visibilityFilter, sortValue]);

  const stats = useMemo(() => {
    const smart = collections.filter((c) => c.type === "smart").length;
    const favorites = collections.filter((c) => c.isFavorite).length;
    const shared = collections.filter((c) => c.visibility !== "private").length;
    return [
      { label: "Total Collections", value: String(collections.length), footer: "in this project" },
      { label: "Smart", value: String(smart), footer: "rule-based" },
      { label: "Favorites", value: String(favorites), footer: "pinned" },
      { label: "Shared", value: String(shared), footer: "team or public" },
    ];
  }, [collections]);

  const hasActiveFilters =
    typeFilter !== "all" || visibilityFilter !== "all" || Boolean(search);

  const clearFilters = () => {
    setTypeFilter("all");
    setVisibilityFilter("all");
    setSearch("");
  };

  const handleCreate = async (draft) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic = {
      id,
      name: draft.name.trim(),
      description: draft.description.trim(),
      type: draft.type,
      coverColor: "#737373",
      status: "active",
      isFavorite: draft.isFavorite,
      visibility: draft.visibility,
      createdAt: now,
      updatedAt: now,
      assetCount: 0,
    };
    setCollections((rows) => [optimistic, ...rows]);
    const created = await createCollection({
      id,
      name: optimistic.name,
      description: optimistic.description,
      type: optimistic.type,
      coverColor: optimistic.coverColor,
      status: "active",
      isFavorite: optimistic.isFavorite,
      visibility: optimistic.visibility,
    });
    if (created) {
      setCollections((rows) => rows.map((c) => (c.id === id ? { ...created, assetCount: 0 } : c)));
    } else {
      setCollections((rows) => rows.filter((c) => c.id !== id));
    }
  };

  const handleToggleFavorite = async (collection) => {
    const next = !collection.isFavorite;
    setCollections((rows) =>
      rows.map((c) => (c.id === collection.id ? { ...c, isFavorite: next } : c)),
    );
    const updated = await updateCollection(collection.id, { isFavorite: next });
    if (!updated) {
      setCollections((rows) =>
        rows.map((c) => (c.id === collection.id ? { ...c, isFavorite: !next } : c)),
      );
    }
  };

  const handleDelete = async (collection) => {
    const prev = collections;
    setCollections((rows) => rows.filter((c) => c.id !== collection.id));
    const ok = await softDeleteCollection(collection.id);
    if (!ok) setCollections(prev);
  };

  const syncRow = (updated) =>
    setCollections((rows) => rows.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (c) => (
        <div className="flex items-center gap-3">
          <CoverSwatch color={c.coverColor} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="max-w-[240px] truncate text-sm font-medium text-foreground">{c.name}</p>
              {c.isFavorite ? (
                <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
              ) : null}
            </div>
            {c.description ? (
              <p className="max-w-[280px] truncate text-[11px] text-text-tertiary">
                {c.description}
              </p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (c) => (
        <Badge className={cn("border px-1.5 py-0 text-[10px]", TYPE_META[c.type]?.className)}>
          {TYPE_META[c.type]?.label || c.type}
        </Badge>
      ),
    },
    {
      key: "visibility",
      header: "Visibility",
      render: (c) => (
        <StatusPill status={c.visibility} map={VISIBILITY_META} className="text-[10px]" />
      ),
    },
    {
      key: "assets",
      header: "Assets",
      align: "right",
      className: "tabular-nums text-xs text-muted-foreground",
      render: (c) => c.assetCount.toLocaleString(),
    },
    {
      key: "updated",
      header: "Updated",
      className: "text-xs text-text-secondary hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (c) => formatDate(c.updatedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <RowActions
          collection={c}
          onOpen={(x) => setOpenId(x.id)}
          onToggleFavorite={handleToggleFavorite}
          onDelete={handleDelete}
        />
      ),
    },
  ];

  if (openId) {
    return (
      <CollectionDetailScreen
        key={openId}
        id={openId}
        onBack={() => setOpenId(null)}
        onChange={syncRow}
        projectId={projectId}
      />
    );
  }

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="Collections"
        description="Curate assets without changing their library location."
        actions={
          <Button
            className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Collection
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search collections..."
            className="w-full sm:w-64"
          />
          <FilterDropdown
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={TYPE_FILTER_OPTIONS}
            placeholder="Type"
            icon={SlidersHorizontal}
          />
          <FilterDropdown
            value={visibilityFilter}
            onValueChange={setVisibilityFilter}
            options={VISIBILITY_FILTER_OPTIONS}
            placeholder="Visibility"
            icon={Eye}
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
          getRowKey={(c) => c.id}
          onRowClick={(c) => setOpenId(c.id)}
          empty={
            <EmptyState
              icon={Layers}
              title="No collections found"
              description={
                hasActiveFilters
                  ? "Try adjusting your filters or search query."
                  : "Create your first collection to start curating assets."
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
                ) : (
                  <Button
                    className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    New Collection
                  </Button>
                )
              }
            />
          }
        />
      )}

      {!loading && filtered.length > 0 ? (
        <div className="text-xs text-text-secondary">
          Showing {filtered.length} of {collections.length} collections
        </div>
      ) : null}

      <CreateDialog open={showCreate} onOpenChange={setShowCreate} onCreate={handleCreate} />
    </MainScreenWrapper>
  );
}

export default CollectionsScreen;
