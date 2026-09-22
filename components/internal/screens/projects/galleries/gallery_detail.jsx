"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  File as FileIcon,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Images,
  Link2,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { Switch } from "@geiger/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@geiger/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  LoadingArea,
  SearchInput,
  SectionCard,
  SettingRow,
  SettingsList,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { TYPE_ICONS } from "@/components/internal/shared/asset_meta";
import {
  ACCENT_SWATCHES,
  CAPTION_OPTIONS,
  DOWNLOAD_MODE_META,
  DOWNLOAD_MODE_OPTIONS,
  GAP_OPTIONS,
  GROUND_OPTIONS,
  LAYOUT_META,
  LAYOUT_OPTIONS,
  RADIUS_OPTIONS,
  SOURCE_OPTIONS,
  STATUS_META,
  TYPOGRAPHY_OPTIONS,
  VISIBILITY_META,
  VISIBILITY_OPTIONS,
  withThemeDefaults,
} from "./constants";
import { GalleryGrid, ThemeSwatch } from "./galleries_kit";
import {
  createGalleryItems,
  deleteGalleryItem,
  getGallery,
  listGalleryItems,
  reorderGalleryItems,
  slugify,
  updateGallery,
  updateGalleryItem,
  uniqueSlug,
} from "@/lib/supabase/galleries";
import { listAssets } from "@/lib/supabase/assets";
import { listCollectionAssets } from "@/lib/supabase/collections";
import { getUser } from "@/lib/supabase/user";

function publicUrl(slug) {
  if (!slug) return "";
  const base = typeof window === "undefined" ? "" : window.location.origin;
  return `${base}/g/${slug}`;
}

/** Row in the curated-content list: reorder, caption, hide, remove. */
function CuratedRow({ item, asset, index, total, onMove, onCaption, onToggleHidden, onRemove }) {
  const Icon = TYPE_ICONS[asset?.type] || FileIcon;
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border"
        style={{ background: `${asset?.color || "#737373"}20` }}
      >
        <Icon className="h-4 w-4" style={{ color: asset?.color || "#737373" }} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm",
            item.isHidden ? "text-text-tertiary line-through" : "text-foreground",
          )}
        >
          {asset?.name || "Missing asset"}
        </p>
        <Input
          value={item.caption}
          onChange={(e) => onCaption(item, e.target.value)}
          placeholder="Caption (optional)"
          className="mt-1 h-7 border-none bg-transparent px-0 text-[11px] text-text-secondary shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Move up"
          disabled={index === 0}
          className="h-7 w-7 text-text-secondary hover:bg-surface-active hover:text-foreground"
          onClick={() => onMove(index, -1)}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Move down"
          disabled={index === total - 1}
          className="h-7 w-7 text-text-secondary hover:bg-surface-active hover:text-foreground"
          onClick={() => onMove(index, 1)}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={item.isHidden ? "Show in gallery" : "Hide from gallery"}
          className="h-7 w-7 text-text-secondary hover:bg-surface-active hover:text-foreground"
          onClick={() => onToggleHidden(item)}
        >
          {item.isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Remove from gallery"
          className="h-7 w-7 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
          onClick={() => onRemove(item)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function AddAssetsDialog({ open, onOpenChange, assets, existingIds, onAdd }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(() => new Set());

  // Reset on the way out rather than in an effect, so closing by Esc, overlay
  // click or either button all land on a clean dialog next time.
  const close = (next) => {
    if (!next) {
      setQuery("");
      setPicked(new Set());
    }
    onOpenChange(next);
  };

  const candidates = useMemo(() => {
    const q = query.toLowerCase();
    return assets
      .filter((a) => !existingIds.has(a.id))
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .slice(0, 100);
  }, [assets, existingIds, query]);

  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add assets</DialogTitle>
          <DialogDescription>
            Pick what this gallery shows. Ordering and captions come next.
          </DialogDescription>
        </DialogHeader>

        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search the library..."
          className="w-full"
        />

        <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-surface-card">
          {candidates.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-text-tertiary">
              {assets.length === 0
                ? "No assets in this project yet."
                : "Nothing left to add that matches."}
            </p>
          ) : (
            candidates.map((a) => {
              const Icon = TYPE_ICONS[a.type] || FileIcon;
              const on = picked.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-surface-hover"
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    style={{ background: `${a.color}20` }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: a.color }} />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">{a.name}</span>
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {on ? <Check className="h-3 w-3" /> : null}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-text-tertiary">{picked.size} selected</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={picked.size === 0}
              onClick={() => {
                onAdd(Array.from(picked));
                close(false);
              }}
            >
              Add {picked.size || ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GalleryDetailScreen({ id, projectId, collections, galleries, onBack, onChange }) {
  const [gallery, setGallery] = useState(null);
  const [draft, setDraft] = useState(null);
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [collectionAssetIds, setCollectionAssetIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getGallery(id), listGalleryItems(id), listAssets(projectId)]).then(
      ([row, itemRows, assetRows]) => {
        if (!alive) return;
        setGallery(row);
        setDraft(row ? { ...row, theme: withThemeDefaults(row.theme) } : null);
        setItems(itemRows ?? []);
        setAssets(assetRows ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [id, projectId]);

  // A collection-backed gallery follows its collection, so the member list is
  // re-read whenever the bound collection changes.
  useEffect(() => {
    let alive = true;
    const collectionId = draft?.sourceKind === "collection" ? draft?.collectionId : null;
    Promise.resolve(collectionId ? listCollectionAssets(collectionId) : []).then((rows) => {
      if (!alive) return;
      setCollectionAssetIds((rows ?? []).map((r) => r.assetId));
    });
    return () => {
      alive = false;
    };
  }, [draft?.sourceKind, draft?.collectionId]);

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const set = useCallback(
    (key) => (value) => setDraft((d) => (d ? { ...d, [key]: value } : d)),
    [],
  );

  const setTheme = useCallback(
    (key) => (value) =>
      setDraft((d) => (d ? { ...d, theme: { ...withThemeDefaults(d.theme), [key]: value } } : d)),
    [],
  );

  const dirty = useMemo(() => {
    if (!gallery || !draft) return false;
    return JSON.stringify({ ...gallery, theme: withThemeDefaults(gallery.theme) }) !== JSON.stringify(draft);
  }, [gallery, draft]);

  /** What the gallery actually renders, in order, honoring hidden items. */
  const previewItems = useMemo(() => {
    if (!draft) return [];
    if (draft.sourceKind === "collection") {
      return collectionAssetIds
        .map((assetId) => assetById.get(assetId))
        .filter(Boolean)
        .map((asset) => ({ asset, key: asset.id }));
    }
    return items
      .filter((i) => !i.isHidden)
      .map((i) => ({ asset: assetById.get(i.assetId), caption: i.caption, key: i.id }))
      .filter((i) => i.asset);
  }, [draft, items, collectionAssetIds, assetById]);

  const curatedIds = useMemo(() => new Set(items.map((i) => i.assetId)), [items]);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    const patch = {
      name: draft.name,
      headline: draft.headline,
      description: draft.description,
      sourceKind: draft.sourceKind,
      collectionId: draft.sourceKind === "collection" ? draft.collectionId || null : null,
      coverAssetId: draft.coverAssetId || null,
      layout: draft.layout,
      theme: draft.theme,
      nav: draft.nav,
      visibility: draft.visibility,
      requireEmail: draft.requireEmail,
      downloadMode: draft.downloadMode,
      allowFavorites: draft.allowFavorites,
      seo: draft.seo,
      slug: draft.slug,
      expiresAt: draft.expiresAt || null,
    };
    // Only touch the password column when the editor actually typed a new one.
    if (typeof draft.password === "string") patch.password = draft.password;

    const updated = await updateGallery(id, patch);
    setSaving(false);
    if (updated) {
      setGallery(updated);
      setDraft({ ...updated, theme: withThemeDefaults(updated.theme) });
      onChange?.(updated);
      toast.success("Gallery saved.");
    } else {
      toast.error("Couldn't save the gallery.");
    }
  };

  const handleTogglePublish = async () => {
    if (!draft) return;
    const next = draft.status === "published" ? "unpublished" : "published";
    if (next === "published" && !draft.slug) {
      toast.error("Give the gallery a URL slug before publishing.");
      return;
    }
    const patch = {
      status: next,
      publishedAt: next === "published" ? new Date().toISOString() : draft.publishedAt,
    };
    const updated = await updateGallery(id, patch);
    if (updated) {
      setGallery(updated);
      setDraft((d) => ({ ...d, ...patch }));
      onChange?.(updated);
      toast.success(next === "published" ? "Gallery published." : "Gallery unpublished.");
    } else {
      toast.error("Couldn't change the publish state.");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl(draft?.slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const handleAddAssets = async (assetIds) => {
    const user = await getUser();
    const base = items.length;
    const payloads = assetIds.map((assetId, i) => ({
      id: crypto.randomUUID(),
      projectId,
      galleryId: id,
      assetId,
      position: base + i,
      caption: "",
      isHidden: false,
      createdBy: user?.id || null,
    }));
    const optimistic = payloads.map((p) => ({ ...p, createdAt: "", updatedAt: "" }));
    setItems((rows) => [...rows, ...optimistic]);
    const created = await createGalleryItems(payloads);
    if (created) {
      const byId = new Map(created.map((c) => [c.id, c]));
      setItems((rows) => rows.map((r) => byId.get(r.id) || r));
      toast.success(`Added ${payloads.length} asset${payloads.length === 1 ? "" : "s"}.`);
    } else {
      const ids = new Set(payloads.map((p) => p.id));
      setItems((rows) => rows.filter((r) => !ids.has(r.id)));
      toast.error("Couldn't add those assets.");
    }
  };

  const handleMove = async (index, delta) => {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const renumbered = next.map((item, i) => ({ ...item, position: i }));
    const prev = items;
    setItems(renumbered);
    const ok = await reorderGalleryItems(renumbered);
    if (!ok) {
      setItems(prev);
      toast.error("Couldn't save the new order.");
    }
  };

  const handleCaption = (item, caption) => {
    setItems((rows) => rows.map((r) => (r.id === item.id ? { ...r, caption } : r)));
  };

  // Captions are typed freely and persisted on blur-equivalent (the save button),
  // so this commits whatever the row currently holds.
  const commitCaption = async (item) => {
    const current = items.find((r) => r.id === item.id);
    if (!current || current.caption === item.caption) return;
    await updateGalleryItem(item.id, { caption: current.caption });
  };

  const handleToggleHidden = async (item) => {
    const next = !item.isHidden;
    setItems((rows) => rows.map((r) => (r.id === item.id ? { ...r, isHidden: next } : r)));
    const updated = await updateGalleryItem(item.id, { isHidden: next });
    if (!updated) {
      setItems((rows) => rows.map((r) => (r.id === item.id ? { ...r, isHidden: !next } : r)));
      toast.error("Couldn't update the item.");
    }
  };

  const handleRemoveItem = async (item) => {
    const prev = items;
    setItems((rows) => rows.filter((r) => r.id !== item.id));
    const ok = await deleteGalleryItem(item.id);
    if (!ok) {
      setItems(prev);
      toast.error("Couldn't remove the item.");
    }
  };

  const addNavLink = () =>
    setDraft((d) => ({ ...d, nav: [...(d.nav || []), { label: "", href: "" }] }));

  const setNavLink = (index, key, value) =>
    setDraft((d) => ({
      ...d,
      nav: (d.nav || []).map((n, i) => (i === index ? { ...n, [key]: value } : n)),
    }));

  const removeNavLink = (index) =>
    setDraft((d) => ({ ...d, nav: (d.nav || []).filter((_, i) => i !== index) }));

  if (loading) {
    return (
      <MainScreenWrapper>
        <LoadingArea panel size={72} />
      </MainScreenWrapper>
    );
  }

  if (!gallery || !draft) {
    return (
      <MainScreenWrapper>
        <EmptyState
          icon={Images}
          title="Gallery not found"
          description="This gallery may have been deleted or isn't available."
          action={
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active"
              onClick={onBack}
            >
              Back to Gallery Builder
            </Button>
          }
        />
      </MainScreenWrapper>
    );
  }

  const published = draft.status === "published";

  return (
    <MainScreenWrapper>
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to Gallery Builder"
            className="h-8 w-8 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <ThemeSwatch theme={draft.theme} className="h-10 w-10" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {draft.name || "Untitled gallery"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusPill status={draft.status} map={STATUS_META} className="text-[10px]" />
              <StatusPill status={draft.visibility} map={VISIBILITY_META} className="text-[10px]" />
              <span className="text-xs text-text-secondary">
                {previewItems.length} asset{previewItems.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={handleTogglePublish}
          >
            {published ? <EyeOff className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            {published ? "Unpublish" : "Publish"}
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="content" className="gap-6">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="design">Layout &amp; Theme</TabsTrigger>
          <TabsTrigger value="navigation">Navigation</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="seo">SEO &amp; Social</TabsTrigger>
          <TabsTrigger value="publish">Publish</TabsTrigger>
        </TabsList>

        {/* Content ------------------------------------------------------- */}
        <TabsContent value="content" className="space-y-5">
          <SectionCard
            title="Source"
            description="A collection-backed gallery follows the collection; a curated one keeps its own list."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Source type">
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

              {draft.sourceKind === "collection" ? (
                <Field label="Collection">
                  <Select
                    value={draft.collectionId || ""}
                    onValueChange={set("collectionId")}
                  >
                    <SelectTrigger className="bg-surface-card">
                      <SelectValue placeholder="Choose a collection" />
                    </SelectTrigger>
                    <SelectContent>
                      {(collections || []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
            </div>
          </SectionCard>

          {draft.sourceKind === "curated" ? (
            <SectionCard
              title="Items"
              description="Order, caption and hide what this gallery shows."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => setShowAdd(true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add assets
                </Button>
              }
              bodyPadding={false}
            >
              {items.length === 0 ? (
                <EmptyState
                  icon={Images}
                  title="Nothing in this gallery yet"
                  description="Add assets from your library to start building the page."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => setShowAdd(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Add assets
                    </Button>
                  }
                />
              ) : (
                items.map((item, index) => (
                  <div key={item.id} onBlur={() => commitCaption(item)}>
                    <CuratedRow
                      item={item}
                      asset={assetById.get(item.assetId)}
                      index={index}
                      total={items.length}
                      onMove={handleMove}
                      onCaption={handleCaption}
                      onToggleHidden={handleToggleHidden}
                      onRemove={handleRemoveItem}
                    />
                  </div>
                ))
              )}
            </SectionCard>
          ) : (
            <SectionCard
              title="Collection contents"
              description="Read-only here — change the collection to change the gallery."
            >
              {previewItems.length === 0 ? (
                <p className="py-6 text-center text-xs text-text-tertiary">
                  {draft.collectionId
                    ? "This collection has no assets yet."
                    : "Pick a collection to publish."}
                </p>
              ) : (
                <p className="text-xs text-text-secondary">
                  {previewItems.length} asset{previewItems.length === 1 ? "" : "s"} will be
                  published from this collection.
                </p>
              )}
            </SectionCard>
          )}
        </TabsContent>

        {/* Layout & Theme ------------------------------------------------ */}
        <TabsContent value="design" className="space-y-5">
          <SectionCard title="Layout" description={LAYOUT_META[draft.layout]?.hint}>
            <div className="grid gap-2 sm:grid-cols-5">
              {LAYOUT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set("layout")(o.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs transition-colors",
                    draft.layout === o.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-surface-card text-muted-foreground hover:bg-surface-hover",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Theme" description="How the public page looks.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Accent">
                <div className="flex flex-wrap gap-2">
                  {ACCENT_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Accent ${hex}`}
                      onClick={() => setTheme("accent")(hex)}
                      className={cn(
                        "h-7 w-7 rounded-full border-2 transition-transform",
                        draft.theme.accent === hex
                          ? "border-foreground scale-110"
                          : "border-transparent",
                      )}
                      style={{ background: hex }}
                    />
                  ))}
                </div>
              </Field>

              <Field label="Ground">
                <Select value={draft.theme.ground} onValueChange={setTheme("ground")}>
                  <SelectTrigger className="bg-surface-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUND_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Typography">
                <Select value={draft.theme.typography} onValueChange={setTheme("typography")}>
                  <SelectTrigger className="bg-surface-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPOGRAPHY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Spacing">
                <Select value={draft.theme.gap} onValueChange={setTheme("gap")}>
                  <SelectTrigger className="bg-surface-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GAP_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Corners">
                <Select value={draft.theme.radius} onValueChange={setTheme("radius")}>
                  <SelectTrigger className="bg-surface-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RADIUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Captions">
                <Select value={draft.theme.caption} onValueChange={setTheme("caption")}>
                  <SelectTrigger className="bg-surface-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAPTION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Preview" description="The same renderer the public page uses.">
            {previewItems.length === 0 ? (
              <p className="py-6 text-center text-xs text-text-tertiary">
                Add content to see the preview.
              </p>
            ) : (
              <div
                className={cn(
                  "rounded-lg p-4",
                  draft.theme.ground === "light" ? "bg-zinc-100" : "bg-surface-card",
                )}
              >
                <GalleryGrid
                  items={previewItems.slice(0, 8)}
                  theme={draft.theme}
                  layout={draft.layout}
                />
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* Navigation ---------------------------------------------------- */}
        <TabsContent value="navigation" className="space-y-5">
          <SectionCard
            title="Custom navigation"
            description="Links rendered in the gallery's header — a portfolio, a contact page, a brief."
            action={
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
                onClick={addNavLink}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add link
              </Button>
            }
          >
            {(draft.nav || []).length === 0 ? (
              <p className="py-6 text-center text-xs text-text-tertiary">
                No navigation links. The gallery header shows just its name.
              </p>
            ) : (
              <div className="space-y-2">
                {(draft.nav || []).map((link, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={link.label || ""}
                      onChange={(e) => setNavLink(index, "label", e.target.value)}
                      placeholder="Label"
                      className="bg-surface-card sm:w-48"
                    />
                    <Input
                      value={link.href || ""}
                      onChange={(e) => setNavLink(index, "href", e.target.value)}
                      placeholder="https://"
                      className="flex-1 bg-surface-card"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove link"
                      className="h-8 w-8 shrink-0 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => removeNavLink(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* Access -------------------------------------------------------- */}
        <TabsContent value="access" className="space-y-5">
          <SectionCard title="Who can see this" description="Applied by the public page.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Visibility"
                hint="Unlisted stays reachable by link but is never indexed."
              >
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

              <Field
                label="Password"
                hint={
                  draft.hasPassword
                    ? "A password is set. Type to replace it, or clear the field to remove it."
                    : "Leave empty for no password."
                }
              >
                <Input
                  type="password"
                  value={draft.password ?? ""}
                  onChange={(e) => set("password")(e.target.value)}
                  placeholder={draft.hasPassword ? "••••••••" : "No password"}
                  className="bg-surface-card"
                />
              </Field>

              <Field label="Access expires" hint="Leave empty to keep it open indefinitely.">
                <Input
                  type="date"
                  value={draft.expiresAt ? String(draft.expiresAt).slice(0, 10) : ""}
                  onChange={(e) => set("expiresAt")(e.target.value)}
                  className="bg-surface-card"
                />
              </Field>

              <Field label="Downloads" hint={DOWNLOAD_MODE_META[draft.downloadMode]?.hint}>
                <Select value={draft.downloadMode} onValueChange={set("downloadMode")}>
                  <SelectTrigger className="bg-surface-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOWNLOAD_MODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </SectionCard>

          <SettingsList>
            <SettingRow
              title="Ask visitors for their details"
              description="Name and email before the gallery opens, so proofing shows who picked what."
              control={
                <Switch
                  checked={Boolean(draft.requireEmail)}
                  onCheckedChange={set("requireEmail")}
                />
              }
            />
            <SettingRow
              title="Allow favorites"
              description="Visitors can mark assets, and the picks land in your proofing inbox."
              control={
                <Switch
                  checked={Boolean(draft.allowFavorites)}
                  onCheckedChange={set("allowFavorites")}
                />
              }
            />
          </SettingsList>
        </TabsContent>

        {/* SEO & Social -------------------------------------------------- */}
        <TabsContent value="seo" className="space-y-5">
          <SectionCard
            title="Search and social"
            description="How the gallery appears when it's shared or indexed."
          >
            <div className="grid gap-4">
              <Field label="Page title" hint="Falls back to the gallery name.">
                <Input
                  value={draft.seo?.title || ""}
                  onChange={(e) => set("seo")({ ...draft.seo, title: e.target.value })}
                  placeholder={draft.name}
                  className="bg-surface-card"
                />
              </Field>
              <Field label="Meta description">
                <Textarea
                  value={draft.seo?.description || ""}
                  onChange={(e) => set("seo")({ ...draft.seo, description: e.target.value })}
                  placeholder={draft.headline || "A short summary for search results."}
                  rows={2}
                  className="bg-surface-card"
                />
              </Field>
              <Field label="Social preview image URL" hint="Used for link previews.">
                <Input
                  value={draft.seo?.ogImage || ""}
                  onChange={(e) => set("seo")({ ...draft.seo, ogImage: e.target.value })}
                  placeholder="https://"
                  className="bg-surface-card"
                />
              </Field>
              {draft.visibility !== "public" ? (
                <p className="text-[11px] text-text-tertiary">
                  This gallery is {draft.visibility}, so it carries a no-index tag regardless of
                  these settings.
                </p>
              ) : null}
            </div>
          </SectionCard>
        </TabsContent>

        {/* Publish ------------------------------------------------------- */}
        <TabsContent value="publish" className="space-y-5">
          <SectionCard title="Public address" description="Where people will find this gallery.">
            <div className="grid gap-4">
              <Field label="URL slug">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs text-text-tertiary">/g/</span>
                  <Input
                    value={draft.slug}
                    onChange={(e) => set("slug")(slugify(e.target.value))}
                    placeholder="autumn-campaign-2026"
                    className="bg-surface-card"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => set("slug")(uniqueSlug(draft.name, galleries || [], id))}
                  >
                    From name
                  </Button>
                </div>
              </Field>

              {draft.slug ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                  <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">
                    {publicUrl(draft.slug)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy public link"
                    className="h-7 w-7 text-text-secondary hover:bg-surface-active hover:text-foreground"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Publish state"
            description="Unpublishing takes the page down without deleting anything."
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <StatusPill status={draft.status} map={STATUS_META} className="text-[10px]" />
                {draft.publishedAt ? (
                  <span className="text-xs text-text-tertiary">
                    Last published {new Date(draft.publishedAt).toLocaleDateString()}
                  </span>
                ) : null}
                {draft.expired ? (
                  <Badge className="border border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-300">
                    Past expiry
                  </Badge>
                ) : null}
              </div>
              <Button
                variant={published ? "outline" : "default"}
                className={cn(
                  published
                    ? "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
                onClick={handleTogglePublish}
              >
                {published ? <EyeOff className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                {published ? "Unpublish gallery" : "Publish gallery"}
              </Button>
            </div>
            {dirty ? (
              <p className="mt-3 text-[11px] text-amber-300">
                You have unsaved changes — save them before they reach the public page.
              </p>
            ) : null}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <AddAssetsDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        assets={assets}
        existingIds={curatedIds}
        onAdd={handleAddAssets}
      />
    </MainScreenWrapper>
  );
}

export default GalleryDetailScreen;
