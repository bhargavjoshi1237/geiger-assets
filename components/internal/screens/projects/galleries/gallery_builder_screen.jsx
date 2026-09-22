"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpDown,
  ArrowUpRight,
  Copy,
  Eye,
  Globe,
  Images,
  Layers,
  Link2,
  Loader2,
  Plus,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { ActionMenu } from "@geiger/ui/action-menu";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  DEFAULT_THEME,
  LAYOUT_FILTER_OPTIONS,
  LAYOUT_META,
  LAYOUT_OPTIONS,
  SORT_OPTIONS,
  SOURCE_OPTIONS,
  STATUS_FILTER_OPTIONS,
  STATUS_META,
  VISIBILITY_FILTER_OPTIONS,
  VISIBILITY_META,
  VISIBILITY_OPTIONS,
  formatDate,
} from "./constants";
import { ThemeSwatch } from "./galleries_kit";
import { GalleryDetailScreen } from "./gallery_detail";
import {
  createGallery,
  deleteGallery,
  listGalleries,
  updateGallery,
  uniqueSlug,
} from "@/lib/supabase/galleries";
import { listCollections } from "@/lib/supabase/collections";
import { getUser } from "@/lib/supabase/user";

const EMPTY_DRAFT = {
  name: "",
  headline: "",
  description: "",
  sourceKind: "collection",
  collectionId: "",
  layout: "grid",
  visibility: "private",
};

/** Absolute public URL for a gallery, resolved against the current origin. */
export function galleryUrl(slug) {
  if (!slug) return "";
  const base = typeof window === "undefined" ? "" : window.location.origin;
  return `${base}/g/${slug}`;
}

function CreateDialog({ open, onOpenChange, onCreate, collections }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const needsCollection = draft.sourceKind === "collection";
  const valid = draft.name.trim() && (!needsCollection || draft.collectionId);

  const submit = async () => {
    if (!valid) {
      toast.error(
        needsCollection && !draft.collectionId
          ? "Pick the collection this gallery publishes."
          : "Give the gallery a name.",
      );
      return;
    }
    setSaving(true);
    await onCreate(draft);
    setSaving(false);
    setDraft(EMPTY_DRAFT);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New gallery</DialogTitle>
          <DialogDescription>
            Publish a collection, or start from an empty curated selection.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Name">
            <Input
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Autumn Campaign 2026"
              className="bg-surface-card"
            />
          </Field>

          <Field label="Headline" hint="Shown at the top of the public page.">
            <Input
              value={draft.headline}
              onChange={(e) => set("headline")(e.target.value)}
              placeholder="Selected work for the autumn launch"
              className="bg-surface-card"
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="What this gallery is for, and who it's for."
              rows={2}
              className="bg-surface-card"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source">
              <Select value={draft.sourceKind} onValueChange={set("sourceKind")}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Layout">
              <Select value={draft.layout} onValueChange={set("layout")}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAYOUT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {needsCollection ? (
            <Field
              label="Collection"
              hint="The gallery stays in step with this collection as it changes."
            >
              <Select value={draft.collectionId} onValueChange={set("collectionId")}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue placeholder="Choose a collection" />
                </SelectTrigger>
                <SelectContent>
                  {collections.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No collections yet
                    </SelectItem>
                  ) : (
                    collections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field label="Visibility" hint="You can publish once the content looks right.">
            <Select value={draft.visibility} onValueChange={set("visibility")}>
              <SelectTrigger className="bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
            disabled={saving || !valid}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create gallery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RowActions({ gallery, onOpen, onCopyLink, onDuplicate, onTogglePublish, onDelete }) {
  const published = gallery.status === "published";
  return (
    <ActionMenu
      label="Gallery actions"
      items={[
        { icon: ArrowUpRight, label: "Open", onSelect: () => onOpen(gallery) },
        {
          icon: Link2,
          label: "Copy public link",
          disabled: !gallery.slug,
          onSelect: () => onCopyLink(gallery),
        },
        { icon: Copy, label: "Duplicate", onSelect: () => onDuplicate(gallery) },
        {
          icon: published ? Eye : Upload,
          label: published ? "Unpublish" : "Publish",
          onSelect: () => onTogglePublish(gallery),
        },
        { separator: true },
        {
          icon: Trash2,
          label: "Delete",
          destructive: true,
          onSelect: () => onDelete(gallery),
        },
      ]}
    />
  );
}

export function GalleryBuilderScreen({ projectId }) {
  const [galleries, setGalleries] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [layoutFilter, setLayoutFilter] = useState("all");
  const [sortValue, setSortValue] = useState("modified-desc");
  const [openId, setOpenId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([listGalleries(projectId), listCollections(projectId)]).then(
      ([rows, cols]) => {
        if (!alive) return;
        setGalleries(rows ?? []);
        setCollections(cols ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const collectionName = useMemo(() => {
    const map = new Map(collections.map((c) => [c.id, c.name]));
    return (id) => map.get(id) || "";
  }, [collections]);

  const filtered = useMemo(() => {
    let result = [...galleries];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.headline.toLowerCase().includes(q) ||
          g.slug.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") result = result.filter((g) => g.status === statusFilter);
    if (visibilityFilter !== "all")
      result = result.filter((g) => g.visibility === visibilityFilter);
    if (layoutFilter !== "all") result = result.filter((g) => g.layout === layoutFilter);

    const [field, direction] = sortValue.split("-");
    result.sort((a, b) => {
      let cmp = 0;
      if (field === "modified") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
      else if (field === "name") cmp = a.name.localeCompare(b.name);
      return direction === "desc" ? -cmp : cmp;
    });
    return result;
  }, [galleries, search, statusFilter, visibilityFilter, layoutFilter, sortValue]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${statusFilter}|${visibilityFilter}|${layoutFilter}|${sortValue}`,
  });

  const stats = useMemo(() => {
    const published = galleries.filter((g) => g.status === "published").length;
    const drafts = galleries.filter((g) => g.status === "draft").length;
    const protectedCount = galleries.filter((g) => g.hasPassword || g.requireEmail).length;
    return [
      { label: "Galleries", value: String(galleries.length), footer: "in this project" },
      { label: "Published", value: String(published), footer: "live now" },
      { label: "Drafts", value: String(drafts), footer: "not yet public" },
      { label: "Gated", value: String(protectedCount), footer: "password or email" },
    ];
  }, [galleries]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    visibilityFilter !== "all" ||
    layoutFilter !== "all" ||
    Boolean(search);

  const clearFilters = () => {
    setStatusFilter("all");
    setVisibilityFilter("all");
    setLayoutFilter("all");
    setSearch("");
  };

  const handleCreate = async (draft) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const user = await getUser();
    const payload = {
      id,
      projectId,
      createdBy: user?.id || null,
      slug: uniqueSlug(draft.name, galleries),
      name: draft.name.trim(),
      headline: draft.headline.trim(),
      description: draft.description.trim(),
      sourceKind: draft.sourceKind,
      collectionId: draft.sourceKind === "collection" ? draft.collectionId : null,
      layout: draft.layout,
      theme: DEFAULT_THEME,
      nav: [],
      visibility: draft.visibility,
      downloadMode: "off",
      allowFavorites: true,
      seo: {},
      status: "draft",
    };
    const optimistic = {
      ...payload,
      hasPassword: false,
      requireEmail: false,
      expired: false,
      createdAt: now,
      updatedAt: now,
    };
    setGalleries((rows) => [optimistic, ...rows]);
    const created = await createGallery(payload);
    if (created) {
      setGalleries((rows) => rows.map((g) => (g.id === id ? created : g)));
      toast.success(`Gallery "${created.name}" created.`);
    } else {
      setGalleries((rows) => rows.filter((g) => g.id !== id));
      toast.error("Couldn't create the gallery.");
    }
  };

  const handleCopyLink = async (gallery) => {
    const url = galleryUrl(gallery.slug);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Public link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const handleDuplicate = async (gallery) => {
    const id = crypto.randomUUID();
    const user = await getUser();
    const name = `${gallery.name} copy`;
    const payload = {
      id,
      projectId,
      createdBy: user?.id || null,
      slug: uniqueSlug(name, galleries),
      name,
      headline: gallery.headline,
      description: gallery.description,
      sourceKind: gallery.sourceKind,
      collectionId: gallery.collectionId,
      coverAssetId: gallery.coverAssetId,
      layout: gallery.layout,
      theme: gallery.theme,
      nav: gallery.nav,
      visibility: "private",
      requireEmail: gallery.requireEmail,
      downloadMode: gallery.downloadMode,
      allowFavorites: gallery.allowFavorites,
      seo: gallery.seo,
      // A duplicate always starts as a draft — never silently republish a copy.
      status: "draft",
    };
    const now = new Date().toISOString();
    setGalleries((rows) => [
      { ...payload, hasPassword: false, expired: false, createdAt: now, updatedAt: now },
      ...rows,
    ]);
    const created = await createGallery(payload);
    if (created) {
      setGalleries((rows) => rows.map((g) => (g.id === id ? created : g)));
      toast.success(`Duplicated as "${created.name}".`);
    } else {
      setGalleries((rows) => rows.filter((g) => g.id !== id));
      toast.error("Couldn't duplicate the gallery.");
    }
  };

  const handleTogglePublish = async (gallery) => {
    const next = gallery.status === "published" ? "unpublished" : "published";
    if (next === "published" && !gallery.slug) {
      toast.error("Give the gallery a URL slug before publishing.");
      return;
    }
    const patch = {
      status: next,
      publishedAt: next === "published" ? new Date().toISOString() : gallery.publishedAt,
    };
    setGalleries((rows) =>
      rows.map((g) => (g.id === gallery.id ? { ...g, ...patch } : g)),
    );
    const updated = await updateGallery(gallery.id, patch);
    if (updated) {
      setGalleries((rows) => rows.map((g) => (g.id === gallery.id ? updated : g)));
      toast.success(next === "published" ? "Gallery published." : "Gallery unpublished.");
    } else {
      setGalleries((rows) =>
        rows.map((g) => (g.id === gallery.id ? { ...g, status: gallery.status } : g)),
      );
      toast.error("Couldn't change the publish state.");
    }
  };

  const handleDelete = async (gallery) => {
    const prev = galleries;
    setGalleries((rows) => rows.filter((g) => g.id !== gallery.id));
    const ok = await deleteGallery(gallery.id);
    if (ok) toast.success(`Deleted "${gallery.name}".`);
    else {
      setGalleries(prev);
      toast.error("Couldn't delete the gallery.");
    }
  };

  const syncRow = (updated) =>
    setGalleries((rows) => rows.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)));

  const columns = [
    {
      key: "name",
      header: "Gallery",
      render: (g) => (
        <div className="flex items-center gap-3">
          <ThemeSwatch theme={g.theme} />
          <div className="min-w-0">
            <p className="max-w-[240px] truncate text-sm font-medium text-foreground">
              {g.name}
            </p>
            <p className="max-w-[280px] truncate text-[11px] text-text-tertiary">
              {g.slug ? `/g/${g.slug}` : "No public URL yet"}
              {g.sourceKind === "collection" && collectionName(g.collectionId)
                ? ` · ${collectionName(g.collectionId)}`
                : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (g) => <StatusPill status={g.status} map={STATUS_META} className="text-[10px]" />,
    },
    {
      key: "visibility",
      header: "Visibility",
      render: (g) => (
        <div className="flex items-center gap-1.5">
          <StatusPill status={g.visibility} map={VISIBILITY_META} className="text-[10px]" />
          {g.hasPassword ? (
            <Badge className="border border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-300">
              Password
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: "layout",
      header: "Layout",
      className: "text-xs text-muted-foreground hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (g) => LAYOUT_META[g.layout]?.label || g.layout,
    },
    {
      key: "updated",
      header: "Updated",
      className: "text-xs text-text-secondary hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (g) => formatDate(g.updatedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (g) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            gallery={g}
            onOpen={(x) => setOpenId(x.id)}
            onCopyLink={handleCopyLink}
            onDuplicate={handleDuplicate}
            onTogglePublish={handleTogglePublish}
            onDelete={handleDelete}
          />
        </div>
      ),
    },
  ];

  if (openId) {
    return (
      <GalleryDetailScreen
        key={openId}
        id={openId}
        projectId={projectId}
        collections={collections}
        galleries={galleries}
        onBack={() => setOpenId(null)}
        onChange={syncRow}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Gallery Builder"
        description="Turn a collection into a hosted, branded gallery people can visit."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" />
            New Gallery
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            placeholder="Status"
            icon={SlidersHorizontal}
          />
          <FilterDropdown
            value={visibilityFilter}
            onValueChange={setVisibilityFilter}
            options={VISIBILITY_FILTER_OPTIONS}
            placeholder="Visibility"
            icon={Eye}
          />
          <FilterDropdown
            value={layoutFilter}
            onValueChange={setLayoutFilter}
            options={LAYOUT_FILTER_OPTIONS}
            placeholder="Layout"
            icon={Layers}
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
          placeholder="Search galleries..."
          className="w-full sm:w-64"
        />
      </Toolbar>

      {loading ? (
        <LoadingArea panel size={56} />
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(g) => g.id}
            onRowClick={(g) => setOpenId(g.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={hasActiveFilters ? Images : Globe}
                  title={hasActiveFilters ? "No matching galleries" : "No galleries yet"}
                  description={
                    hasActiveFilters
                      ? "Try adjusting your filters or search query."
                      : "Publish a collection as a branded page people outside the workspace can visit."
                  }
                  action={
                    hasActiveFilters ? (
                      <Button
                        variant="outline"
                        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </Button>
                    ) : (
                      <Button
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => setShowCreate(true)}
                      >
                        <Plus className="h-4 w-4" />
                        New Gallery
                      </Button>
                    )
                  }
                />
              </div>
            }
          />
          <ListPagination {...pager} itemLabel="galleries" />
        </div>
      )}

      <CreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={handleCreate}
        collections={collections}
      />
    </MainScreenWrapper>
  );
}

export default GalleryBuilderScreen;
