"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Eye, LayoutGrid, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { Switch } from "@geiger/ui/switch";
import { ActionMenu } from "@geiger/ui/action-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import {
  GALLERY_LAYOUT_FILTER_OPTIONS,
  GALLERY_LAYOUT_MAP,
  GALLERY_LAYOUT_OPTIONS,
  GALLERY_NAV_OPTIONS,
  GALLERY_STATUS_FILTER_OPTIONS,
  GALLERY_STATUS_MAP,
  GALLERY_THEME_OPTIONS,
  formatCount,
} from "./constants";
import {
  createGallery,
  listGalleries,
  softDeleteGallery,
  updateGallery,
} from "@/lib/supabase/galleries";

// Gallery Builder — turn a collection into a hosted gallery: collection
// publishing, layouts, theme controls, custom navigation, preview and
// publish, duplication.

const EMPTY_DRAFT = {
  name: "",
  slug: "",
  collectionId: "",
  layout: "grid",
  theme: "dark",
  navigationStyle: "topbar",
  description: "",
  isPublished: false,
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function GalleryDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDraft({ ...EMPTY_DRAFT, ...(initial || {}) });
    setBusy(false);
  }, [open, initial]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give the gallery a name.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      name,
      slug: draft.slug.trim() ? slugify(draft.slug) : slugify(name),
      collectionId: draft.collectionId.trim() || null,
      layout: draft.layout,
      theme: draft.theme,
      navigationStyle: draft.navigationStyle,
      description: draft.description.trim(),
      isPublished: Boolean(draft.isPublished),
      status: draft.isPublished ? "published" : initial?.status || "draft",
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit gallery" : "New gallery"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Pick a collection, choose a layout and theme, then publish when ready.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="gallery-name">
            <Input
              id="gallery-name"
              className="bg-surface-card"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Spring lookbook…"
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Slug" htmlFor="gallery-slug" hint="Defaults from the name.">
              <Input
                id="gallery-slug"
                className="bg-surface-card"
                value={draft.slug}
                onChange={(e) => set("slug")(e.target.value)}
                placeholder="spring-lookbook"
              />
            </Field>
            <Field label="Collection ID" htmlFor="gallery-collection" hint="Source collection.">
              <Input
                id="gallery-collection"
                className="bg-surface-card"
                value={draft.collectionId}
                onChange={(e) => set("collectionId")(e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Layout">
              <Select value={draft.layout} onValueChange={set("layout")}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GALLERY_LAYOUT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Theme">
              <Select value={draft.theme} onValueChange={set("theme")}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GALLERY_THEME_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Navigation">
              <Select value={draft.navigationStyle} onValueChange={set("navigationStyle")}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GALLERY_NAV_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Description" htmlFor="gallery-desc">
            <Textarea
              id="gallery-desc"
              className="min-h-20 bg-surface-card"
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="What is this gallery for?"
            />
          </Field>
          <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Published</p>
              <p className="text-xs text-text-secondary">Visible at its hosted URL.</p>
            </div>
            <Switch
              checked={draft.isPublished}
              onCheckedChange={set("isPublished")}
              aria-label="Published"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
            disabled={busy}
          >
            {editing ? "Save changes" : "Create gallery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GalleryBuilderScreen({ projectId }) {
  const [galleries, setGalleries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [layoutFilter, setLayoutFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let alive = true;
    listGalleries(projectId).then((rows) => {
      if (!alive) return;
      setGalleries(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const stats = useMemo(
    () => [
      { label: "Galleries", value: String(galleries.length), footer: "hosted galleries" },
      {
        label: "Published",
        value: String(galleries.filter((g) => g.status === "published").length),
        footer: "live at their URL",
      },
      {
        label: "Drafts",
        value: String(galleries.filter((g) => g.status === "draft").length),
        footer: "still being built",
      },
      {
        label: "Views",
        value: formatCount(galleries.reduce((s, g) => s + g.viewCount, 0)),
        footer: "across galleries",
      },
    ],
    [galleries],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return galleries.filter((gallery) => {
      if (statusFilter !== "all" && gallery.status !== statusFilter) return false;
      if (layoutFilter !== "all" && gallery.layout !== layoutFilter) return false;
      if (
        needle &&
        !`${gallery.name} ${gallery.slug} ${gallery.description}`.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [galleries, search, statusFilter, layoutFilter]);

  const filtersActive =
    statusFilter !== "all" || layoutFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setStatusFilter("all");
    setLayoutFilter("all");
    setSearch("");
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (gallery) => {
    setEditing(gallery);
    setDialogOpen(true);
  };

  const submitGallery = async (draft) => {
    if (editing) {
      const previous = galleries;
      setGalleries((rows) =>
        rows.map((g) => (g.id === editing.id ? { ...g, ...draft } : g)),
      );
      const saved = await updateGallery(editing.id, draft);
      if (!saved) {
        setGalleries(previous);
        toast.error("Could not save the gallery.");
        return false;
      }
      setGalleries((rows) => rows.map((g) => (g.id === saved.id ? saved : g)));
      toast.success(`Saved “${saved.name}”.`);
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      collectionId: null,
      viewCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setGalleries((rows) => [optimistic, ...rows]);
    const created = await createGallery({ id, projectId, ...draft });
    if (!created) {
      setGalleries((rows) => rows.filter((g) => g.id !== id));
      toast.error("Could not create the gallery.");
      return false;
    }
    setGalleries((rows) => rows.map((g) => (g.id === id ? created : g)));
    toast.success(`Created “${created.name}”.`);
    return true;
  };

  const setPublished = async (gallery, published) => {
    const previous = galleries;
    setGalleries((rows) =>
      rows.map((g) =>
        g.id === gallery.id
          ? { ...g, isPublished: published, status: published ? "published" : "draft" }
          : g,
      ),
    );
    const saved = await updateGallery(gallery.id, {
      isPublished: published,
      status: published ? "published" : "draft",
    });
    if (!saved) {
      setGalleries(previous);
      toast.error("Could not change publishing.");
      return;
    }
    setGalleries((rows) => rows.map((g) => (g.id === saved.id ? saved : g)));
    toast.success(published ? `Published “${saved.name}”.` : `Unpublished “${saved.name}”.`);
  };

  const duplicateGallery = async (gallery) => {
    const id = crypto.randomUUID();
    const copy = `Copy of ${gallery.name}`;
    const optimistic = {
      ...gallery,
      id,
      name: copy,
      slug: gallery.slug ? `${gallery.slug}-copy` : slugify(copy),
      status: "draft",
      isPublished: false,
      viewCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setGalleries((rows) => [optimistic, ...rows]);
    const created = await createGallery({
      id,
      projectId,
      name: copy,
      slug: optimistic.slug,
      collectionId: gallery.collectionId,
      layout: gallery.layout,
      theme: gallery.theme,
      navigationStyle: gallery.navigationStyle,
      description: gallery.description,
      status: "draft",
      isPublished: false,
    });
    if (!created) {
      setGalleries((rows) => rows.filter((g) => g.id !== id));
      toast.error("Could not duplicate the gallery.");
      return;
    }
    setGalleries((rows) => rows.map((g) => (g.id === id ? created : g)));
    toast.success(`Duplicated as “${created.name}”.`);
  };

  const removeGallery = async (gallery) => {
    const previous = galleries;
    setGalleries((rows) => rows.filter((g) => g.id !== gallery.id));
    const ok = await softDeleteGallery(gallery.id);
    if (!ok) {
      setGalleries(previous);
      toast.error("Could not delete the gallery.");
      return;
    }
    toast.success(`Deleted “${gallery.name}”.`);
  };

  const previewGallery = async (gallery) => {
    const url = `https://galleries.example.com/${gallery.slug || gallery.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Preview link copied.");
    } catch {
      toast.success("Preview ready — copy the link manually.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Gallery",
      render: (gallery) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">
            {gallery.name || "Untitled gallery"}
          </span>
          <span className="truncate text-xs text-text-secondary">
            /{gallery.slug || gallery.id} · {gallery.theme} theme · {gallery.navigationStyle} nav
          </span>
        </div>
      ),
    },
    {
      key: "layout",
      header: "Layout",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (gallery) => <StatusPill status={gallery.layout} map={GALLERY_LAYOUT_MAP} />,
    },
    {
      key: "status",
      header: "Status",
      render: (gallery) => (
        <div className="flex flex-col gap-1">
          <StatusPill status={gallery.status} map={GALLERY_STATUS_MAP} />
          <span className="text-[11px] text-text-tertiary">
            {formatCount(gallery.viewCount)} views
          </span>
        </div>
      ),
    },
    {
      key: "published",
      header: "Live",
      align: "right",
      className: "text-right",
      render: (gallery) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={gallery.isPublished}
            aria-label={`Publish ${gallery.name}`}
            onCheckedChange={(value) => setPublished(gallery, value)}
          />
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (gallery) => (
        <ActionMenu
          label={`Actions for ${gallery.name}`}
          items={[
            { icon: Eye, label: "Preview & copy link", onSelect: () => previewGallery(gallery) },
            {
              icon: Rocket,
              label: gallery.isPublished ? "Unpublish" : "Publish",
              onSelect: () => setPublished(gallery, !gallery.isPublished),
            },
            { icon: Pencil, label: "Edit", onSelect: () => openEdit(gallery) },
            { icon: Copy, label: "Duplicate", onSelect: () => duplicateGallery(gallery) },
            { separator: true },
            { icon: Trash2, label: "Delete", destructive: true, onSelect: () => removeGallery(gallery) },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Gallery Builder"
        description="Turn a collection into a hosted gallery — layouts, themes, navigation, preview and publish."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> New gallery
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={GALLERY_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={layoutFilter}
            onValueChange={setLayoutFilter}
            options={GALLERY_LAYOUT_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search galleries…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading galleries" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(gallery) => gallery.id}
          onRowClick={openEdit}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              {filtersActive ? (
                <EmptyState
                  icon={LayoutGrid}
                  title="No galleries match these filters"
                  description="Try a different status, layout, or search term."
                  action={
                    <Button
                      variant="outline"
                      className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={LayoutGrid}
                  title="No galleries yet"
                  description="Turn your first collection into a hosted gallery."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={openCreate}
                    >
                      <Plus className="h-4 w-4" /> New gallery
                    </Button>
                  }
                />
              )}
            </div>
          }
        />
      )}

      <GalleryDialog
        key={editing ? `gallery:${editing.id}` : "gallery:new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={submitGallery}
      />
    </MainScreenWrapper>
  );
}

export default GalleryBuilderScreen;
