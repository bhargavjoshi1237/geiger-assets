"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Frame,
  Globe,
  GripVertical,
  Images,
  Link2,
  Lock,
  Palette,
  PanelsTopLeft,
  Pipette,
  Plus,
  Search,
  ShoppingCart,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import {
  EditorLoading,
  EditorNotFound,
  EditorShell,
} from "@/components/internal/shared/editor_shell";
import { EditorSaveActions, useEditorGuard } from "@/components/internal/shared/unsaved_changes";
import {
  EmptyState,
  Field,
  SearchInput,
  SectionCard,
  SegmentedTabs,
  SettingRow,
  SettingsList,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { AssetThumbnail } from "@/components/internal/shared/asset_thumbnail";
import {
  ACCENT_SWATCHES,
  CAPTION_OPTIONS,
  COLUMN_OPTIONS,
  DOWNLOAD_MODE_META,
  DOWNLOAD_MODE_OPTIONS,
  ENTRANCE_OPTIONS,
  FOOTER_ALIGN_OPTIONS,
  GAP_OPTIONS,
  GROUND_OPTIONS,
  HEADER_ALIGN_OPTIONS,
  HERO_ALIGN_OPTIONS,
  HOVER_OPTIONS,
  LAYOUT_META,
  LAYOUT_OPTIONS,
  POSTER_ASPECT_OPTIONS,
  POSTER_CORNER_OPTIONS,
  POSTER_FOCUS_OPTIONS,
  POSTER_FRAME_COLOR_OPTIONS,
  POSTER_FRAME_OPTIONS,
  POSTER_MOTION_OPTIONS,
  POSTER_POSITION_OPTIONS,
  POSTER_SCRIM_OPTIONS,
  POSTER_SHADOW_OPTIONS,
  POSTER_SIZE_OPTIONS,
  RADIUS_OPTIONS,
  SOURCE_OPTIONS,
  STATUS_META,
  TEXTURE_OPTIONS,
  TILE_SHAPE_OPTIONS,
  TITLE_SIZE_OPTIONS,
  TYPOGRAPHY_CLASS,
  TYPOGRAPHY_OPTIONS,
  VISIBILITY_META,
  VISIBILITY_OPTIONS,
  WIDTH_OPTIONS,
  groundTone,
  withThemeDefaults,
} from "./constants";
import {
  GalleryFooter,
  GalleryGrid,
  GalleryPoster,
  GalleryTopbar,
  completeLinks,
} from "./galleries_kit";
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
import { GallerySellingSection } from "./gallery_selling";
import { ConfirmDeleteDialog } from "../settings/settings_kit";

const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "content",
        label: "Content",
        icon: Images,
        desc: "The source, cover, and curated assets this gallery shows.",
      },
    ],
  },
  {
    group: "Design",
    items: [
      {
        key: "design",
        label: "Layout & theme",
        icon: Palette,
        desc: "Grid layout, spacing, typography, and colors.",
      },
      {
        key: "poster",
        label: "Poster",
        icon: Frame,
        desc: "The cover image, its frame, and a text overlay.",
      },
      {
        key: "navigation",
        label: "Header & footer",
        icon: PanelsTopLeft,
        desc: "Top bar, footer, and the links in each.",
      },
    ],
  },
  {
    group: "Store",
    items: [
      {
        key: "selling",
        label: "Selling",
        icon: ShoppingCart,
        desc: "Prices, licences, prints, physical products, bundles and a whole-gallery unlock.",
      },
    ],
  },
  {
    group: "Sharing",
    items: [
      {
        key: "access",
        label: "Access",
        icon: Lock,
        desc: "Visibility, passwords, email capture, and downloads.",
      },
      {
        key: "seo",
        label: "SEO & social",
        icon: Search,
        desc: "How the gallery appears in search results and link previews.",
      },
      {
        key: "publish",
        label: "Publish",
        icon: Globe,
        desc: "The public address and publish state.",
      },
    ],
  },
];

// Layouts that honor the column count.
const COLUMN_LAYOUTS = new Set(["grid", "masonry", "mosaic"]);

/** Editable label + URL rows, shared by the header and footer link lists. */
function LinkListEditor({ links, onChange, empty }) {
  const update = (index, key, value) =>
    onChange(links.map((link, i) => (i === index ? { ...link, [key]: value } : link)));

  return (
    <div className="space-y-2">
      {links.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-5 text-center text-xs text-text-tertiary">
          {empty}
        </p>
      ) : (
        links.map((link, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={link.label || ""}
              onChange={(e) => update(index, "label", e.target.value)}
              placeholder="Label"
              className="w-32 bg-surface-card sm:w-44"
            />
            <Input
              value={link.href || ""}
              onChange={(e) => update(index, "href", e.target.value)}
              placeholder="https://"
              className="flex-1 bg-surface-card"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove link"
              className="h-8 w-8 shrink-0 text-text-secondary hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
              onClick={() => onChange(links.filter((_, i) => i !== index))}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-8 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
        onClick={() => onChange([...links, { label: "", href: "" }])}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add link
      </Button>
    </div>
  );
}

/** A slice of the public page on the gallery's own ground, for live previews. */
function GroundPreview({ theme, className, children }) {
  const tone = groundTone(theme);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border",
        TYPOGRAPHY_CLASS[theme.typography] || TYPOGRAPHY_CLASS.sans,
        tone.page,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Image assets as Select options, with a thumbnail beside each name. */
function ImageAssetItems({ assets }) {
  return assets.map((asset) => (
    <SelectItem key={asset.id} value={asset.id}>
      <span className="flex min-w-0 items-center gap-2">
        <AssetThumbnail asset={asset} className="h-5 w-8 rounded-sm" iconClassName="h-3 w-3" />
        <span className="truncate">{asset.name}</span>
      </span>
    </SelectItem>
  ));
}

function publicUrl(slug) {
  if (!slug) return "";
  const base = typeof window === "undefined" ? "" : window.location.origin;
  return `${base}/g/${slug}`;
}

/**
 * Row in the curated-content list. Drag the handle (or use the arrows) to
 * reorder, type straight into the caption, and hide or remove from the actions
 * that surface on hover.
 */
function CuratedRow({
  item,
  asset,
  index,
  total,
  dragging,
  dropTarget,
  onMove,
  onCaption,
  onToggleHidden,
  onRemove,
  dragHandlers,
}) {
  const iconButton =
    "h-7 w-7 text-text-secondary hover:bg-surface-active hover:text-foreground";
  return (
    <div
      {...dragHandlers}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-hover",
        dragging && "opacity-40",
        dropTarget && "bg-surface-hover ring-1 ring-inset ring-border-strong",
      )}
    >
      <span
        draggable
        onDragStart={dragHandlers.onHandleDragStart}
        onDragEnd={dragHandlers.onHandleDragEnd}
        aria-hidden="true"
        title="Drag to reorder"
        className="flex h-8 w-4 shrink-0 cursor-grab items-center justify-center text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-text-tertiary">
        {index + 1}
      </span>
      <AssetThumbnail
        asset={asset}
        assetId={item.assetId}
        large
        className={cn("h-11 w-11 rounded-md", item.isHidden && "opacity-40 grayscale")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p
            className={cn(
              "truncate text-sm font-medium",
              item.isHidden ? "text-text-tertiary" : "text-foreground",
            )}
          >
            {asset?.name || "Missing asset"}
          </p>
          {item.isHidden ? (
            <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
              Hidden
            </Badge>
          ) : null}
        </div>
        <Input
          value={item.caption}
          onChange={(e) => onCaption(item, e.target.value)}
          placeholder="Add a caption…"
          aria-label={`Caption for ${asset?.name || "item"}`}
          className="-ml-1.5 mt-0.5 h-6 w-full max-w-md border-transparent bg-transparent px-1.5 text-xs text-text-secondary shadow-none placeholder:text-text-tertiary hover:border-border focus-visible:border-border-strong focus-visible:bg-surface-card focus-visible:ring-0"
        />
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Move up"
          disabled={index === 0}
          className={iconButton}
          onClick={() => onMove(index, index - 1)}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Move down"
          disabled={index === total - 1}
          className={iconButton}
          onClick={() => onMove(index, index + 1)}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={item.isHidden ? "Show in gallery" : "Hide from gallery"}
          title={item.isHidden ? "Show in gallery" : "Hide from gallery"}
          className={iconButton}
          onClick={() => onToggleHidden(item)}
        >
          {item.isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Remove from gallery"
          title="Remove from gallery"
          className="h-7 w-7 text-text-secondary hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
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
              const on = picked.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-surface-hover"
                >
                  <AssetThumbnail asset={a} className="h-8 w-8 rounded-md" iconClassName="h-3.5 w-3.5" />
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
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [drag, setDrag] = useState(null); // { from, over }

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

  // Header, footer and poster are nested groups inside the theme bag.
  const patchThemePart = useCallback(
    (part, patch) =>
      setDraft((d) => {
        if (!d) return d;
        const theme = withThemeDefaults(d.theme);
        return { ...d, theme: { ...theme, [part]: { ...theme[part], ...patch } } };
      }),
    [],
  );

  const setThemePart = useCallback(
    (part, key) => (value) => patchThemePart(part, { [key]: value }),
    [patchThemePart],
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
  const hiddenCount = items.filter((i) => i.isHidden).length;

  // Library images that can stand in as a logo.
  const imageAssets = useMemo(
    () => assets.filter((a) => a.type === "image" && a.thumbnailUrl),
    [assets],
  );

  // Poster candidates are the gallery's own images, plus the chosen cover even
  // if it has since left the gallery.
  const coverAssetId = draft?.coverAssetId || null;
  const coverOptions = useMemo(() => {
    const seen = new Set();
    const candidates = [
      ...previewItems.map((i) => i.asset),
      coverAssetId ? assetById.get(coverAssetId) : null,
    ];
    return candidates.filter((a) => {
      if (!a?.thumbnailUrl || seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [previewItems, coverAssetId, assetById]);

  // Same pick the public page makes: the chosen cover, else the first image.
  const posterAsset =
    (coverAssetId && assetById.get(coverAssetId)) ||
    previewItems.find((i) => i.asset?.thumbnailUrl)?.asset ||
    null;

  const save = useCallback(async () => {
    if (!dirty || saving || !draft) return false;
    if (!draft.name?.trim()) {
      toast.error("Give the gallery a name before saving.");
      return false;
    }
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
      commerce: draft.commerce,
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
      return true;
    }
    toast.error("Couldn't save the gallery.");
    return false;
  }, [dirty, draft, id, onChange, saving]);

  const discard = useCallback(
    () => setDraft(gallery ? { ...gallery, theme: withThemeDefaults(gallery.theme) } : null),
    [gallery],
  );

  // Publishing and unpublishing both go through a type-to-confirm dialog.
  const requestTogglePublish = () => {
    if (!draft) return;
    if (draft.status !== "published" && !draft.slug) {
      toast.error("Give the gallery a URL slug before publishing.");
      return;
    }
    setPublishConfirm(true);
  };

  const handleTogglePublish = async () => {
    if (!draft) return;
    const next = draft.status === "published" ? "unpublished" : "published";
    if (next === "published" && !draft.slug) {
      toast.error("Give the gallery a URL slug before publishing.");
      return;
    }
    setPublishing(true);
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
      setPublishConfirm(false);
    } else {
      toast.error("Couldn't change the publish state.");
    }
    setPublishing(false);
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

  const handleMove = async (from, to) => {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
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

  const guard = useEditorGuard({
    dirty,
    saving,
    save,
    discard,
    onBack,
    name: draft?.name || "this gallery",
  });
  const back = { label: "Gallery Builder", onClick: guard.back };

  if (loading) {
    return <EditorLoading back={back} title="Loading gallery…" nav={NAV_GROUPS} />;
  }

  if (!gallery || !draft) {
    return (
      <EditorNotFound
        back={back}
        nav={NAV_GROUPS}
        icon={Images}
        title="Gallery not found"
        description="This gallery may have been deleted or isn't available."
      />
    );
  }

  const published = draft.status === "published";
  const customAccent = !ACCENT_SWATCHES.includes(draft.theme.accent);

  return (
    <>
      <EditorShell
        back={back}
        title={draft.name || "Untitled gallery"}
        status={draft.status}
        statusMap={STATUS_META}
        badges={<StatusPill status={draft.visibility} map={VISIBILITY_META} className="text-[10px]" />}
        meta={`${previewItems.length} asset${previewItems.length === 1 ? "" : "s"}${
          draft.slug ? ` · /g/${draft.slug}` : ""
        }`}
        actions={
          <EditorSaveActions dirty={dirty} saving={saving} onSave={save} onDiscard={discard}>
            {published && gallery.slug ? (
              <Button
                asChild
                variant="outline"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <a href={publicUrl(gallery.slug)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={requestTogglePublish}
            >
              {published ? <EyeOff className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {published ? "Unpublish" : "Publish"}
            </Button>
          </EditorSaveActions>
        }
        nav={NAV_GROUPS}
        subject={draft}
        active={guard.active}
        onActiveChange={guard.selectSection}
      >
        {({ active }) => (
          <>
            {/* Content ------------------------------------------------------- */}
            {active === "content" ? (
              <div className="space-y-8">
                <SectionCard
                  bare
                  title="Source"
                  description="A collection-backed gallery follows the collection; a curated one keeps its own list."
                  bodyPadding={false}
                  action={
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Select value={draft.sourceKind} onValueChange={set("sourceKind")}>
                        <SelectTrigger aria-label="Source type" className="h-9 w-44 bg-surface-card">
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
                      {draft.sourceKind === "collection" ? (
                        <Select
                          value={draft.collectionId || ""}
                          onValueChange={set("collectionId")}
                        >
                          <SelectTrigger aria-label="Collection" className="h-9 w-48 bg-surface-card">
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
                      ) : null}
                    </div>
                  }
                >
                </SectionCard>

                {draft.sourceKind === "curated" ? (
                  <SectionCard
                    bare
                    title="Items"
                    description={
                      items.length
                        ? `${items.length} item${items.length === 1 ? "" : "s"}${
                            hiddenCount ? ` · ${hiddenCount} hidden` : ""
                          } — drag to reorder, click a caption to edit it.`
                        : "Order, caption and hide what this gallery shows."
                    }
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 border-border bg-transparent px-3 text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
                        onClick={() => setShowAdd(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
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
                      <div className="-mx-2 space-y-0.5 pt-2">
                        {items.map((item, index) => (
                          <div key={item.id} onBlur={() => commitCaption(item)}>
                            <CuratedRow
                              item={item}
                              asset={assetById.get(item.assetId)}
                              index={index}
                              total={items.length}
                              dragging={drag?.from === index}
                              dropTarget={drag && drag.over === index && drag.from !== index}
                              onMove={handleMove}
                              onCaption={handleCaption}
                              onToggleHidden={handleToggleHidden}
                              onRemove={handleRemoveItem}
                              dragHandlers={{
                                onHandleDragStart: (e) => {
                                  e.dataTransfer.effectAllowed = "move";
                                  e.dataTransfer.setData("text/plain", item.id);
                                  setDrag({ from: index, over: index });
                                },
                                onHandleDragEnd: () => setDrag(null),
                                onDragOver: (e) => {
                                  if (!drag) return;
                                  e.preventDefault();
                                  if (drag.over !== index) setDrag((d) => (d ? { ...d, over: index } : d));
                                },
                                onDrop: (e) => {
                                  e.preventDefault();
                                  if (drag) handleMove(drag.from, index);
                                  setDrag(null);
                                },
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>
                ) : (
                  <SectionCard
                    bare
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
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                        {previewItems.map(({ asset, key }) => (
                          <AssetThumbnail
                            key={key}
                            asset={asset}
                            large
                            alt={asset.name}
                            className="aspect-square h-auto w-full"
                            iconClassName="h-5 w-5"
                          />
                        ))}
                      </div>
                    )}
                  </SectionCard>
                )}
              </div>
            ) : null}

            {/* Layout & Theme ------------------------------------------------ */}
            {active === "design" ? (
              <div className="space-y-8">
                <SectionCard bare title="Layout" description={LAYOUT_META[draft.layout]?.hint}>
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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

                    <div className="grid gap-4 sm:grid-cols-2">
                      {COLUMN_LAYOUTS.has(draft.layout) ? (
                        <Field label="Columns" hint="On wide screens; phones always show two.">
                          <SegmentedTabs
                            fullWidth
                            tabs={COLUMN_OPTIONS}
                            value={draft.theme.columns}
                            onChange={setTheme("columns")}
                          />
                        </Field>
                      ) : null}
                      {draft.layout === "grid" ? (
                        <Field label="Tile shape">
                          <SegmentedTabs
                            fullWidth
                            tabs={TILE_SHAPE_OPTIONS}
                            value={draft.theme.tileShape}
                            onChange={setTheme("tileShape")}
                          />
                        </Field>
                      ) : null}
                      <Field label="Page width" hint="How far the page spreads on large screens.">
                        <SegmentedTabs
                          fullWidth
                          tabs={WIDTH_OPTIONS}
                          value={draft.theme.width}
                          onChange={setTheme("width")}
                        />
                      </Field>
                      <Field label="Hover" hint="What a tile does under the pointer.">
                        <SegmentedTabs
                          fullWidth
                          tabs={HOVER_OPTIONS}
                          value={draft.theme.hover}
                          onChange={setTheme("hover")}
                        />
                      </Field>
                      <Field label="Entrance" hint="How tiles appear when the page opens.">
                        <SegmentedTabs
                          fullWidth
                          tabs={ENTRANCE_OPTIONS}
                          value={draft.theme.entrance}
                          onChange={setTheme("entrance")}
                        />
                      </Field>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard bare title="Theme" description="Colors, type and finish of the public page.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Accent" hint="Tints focus rings, the poster and, optionally, buttons.">
                      <div className="flex flex-wrap items-center gap-2">
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
                        <label
                          title="Custom color"
                          className={cn(
                            "relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 transition-transform",
                            customAccent ? "border-foreground scale-110" : "border-border",
                          )}
                          style={{ background: customAccent ? draft.theme.accent : undefined }}
                        >
                          {customAccent ? null : (
                            <Pipette className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
                          )}
                          <input
                            type="color"
                            aria-label="Custom accent color"
                            value={draft.theme.accent}
                            onChange={(e) => setTheme("accent")(e.target.value)}
                            className="absolute inset-0 cursor-pointer opacity-0"
                          />
                        </label>
                        <span className="font-mono text-xs uppercase text-text-tertiary">
                          {draft.theme.accent}
                        </span>
                      </div>
                    </Field>

                    <Field label="Ground" hint="Suite follows the app theme; the others stay fixed.">
                      <SegmentedTabs
                        fullWidth
                        tabs={GROUND_OPTIONS}
                        value={draft.theme.ground}
                        onChange={setTheme("ground")}
                      />
                    </Field>

                    <Field label="Typography">
                      <SegmentedTabs
                        fullWidth
                        tabs={TYPOGRAPHY_OPTIONS}
                        value={draft.theme.typography}
                        onChange={setTheme("typography")}
                      />
                    </Field>

                    <Field label="Backdrop" hint="The texture behind the title.">
                      <SegmentedTabs
                        fullWidth
                        tabs={TEXTURE_OPTIONS}
                        value={draft.theme.texture}
                        onChange={setTheme("texture")}
                      />
                    </Field>

                    <Field label="Title size">
                      <SegmentedTabs
                        fullWidth
                        tabs={TITLE_SIZE_OPTIONS}
                        value={draft.theme.titleSize}
                        onChange={setTheme("titleSize")}
                      />
                    </Field>

                    <Field label="Title alignment">
                      <SegmentedTabs
                        fullWidth
                        tabs={HERO_ALIGN_OPTIONS}
                        value={draft.theme.heroAlign}
                        onChange={setTheme("heroAlign")}
                      />
                    </Field>

                    <Field label="Spacing">
                      <SegmentedTabs
                        fullWidth
                        tabs={GAP_OPTIONS}
                        value={draft.theme.gap}
                        onChange={setTheme("gap")}
                      />
                    </Field>

                    <Field label="Corners">
                      <SegmentedTabs
                        fullWidth
                        tabs={RADIUS_OPTIONS}
                        value={draft.theme.radius}
                        onChange={setTheme("radius")}
                      />
                    </Field>

                    <Field
                      label="Captions"
                      hint={draft.layout === "mosaic" ? "Mosaic shows captions over the image." : undefined}
                    >
                      <SegmentedTabs
                        fullWidth
                        tabs={CAPTION_OPTIONS}
                        value={draft.theme.caption}
                        onChange={setTheme("caption")}
                      />
                    </Field>
                  </div>

                  <SettingsList className="mt-5 border-t border-border pt-4">
                    <SettingRow
                      title="Accent on buttons"
                      description="Primary buttons take the accent color, with text that stays readable."
                      control={
                        <Switch
                          checked={Boolean(draft.theme.accentButtons)}
                          onCheckedChange={setTheme("accentButtons")}
                        />
                      }
                    />
                    <SettingRow
                      title="Show gallery details"
                      description="Item count, publish date and expiry beside the title."
                      control={
                        <Switch
                          checked={Boolean(draft.theme.showStats)}
                          onCheckedChange={setTheme("showStats")}
                        />
                      }
                    />
                  </SettingsList>
                </SectionCard>

                <SectionCard bare title="Preview" description="The same renderer the public page uses.">
                  {previewItems.length === 0 ? (
                    <p className="py-6 text-center text-xs text-text-tertiary">
                      Add content to see the preview.
                    </p>
                  ) : (
                    <GroundPreview theme={draft.theme} className="p-4">
                      <GalleryGrid
                        items={previewItems.slice(0, 12)}
                        theme={draft.theme}
                        layout={draft.layout}
                      />
                    </GroundPreview>
                  )}
                </SectionCard>
              </div>
            ) : null}

            {/* Poster -------------------------------------------------------- */}
            {active === "poster" ? (
              <div className="space-y-8">
                <SectionCard bare title="Preview" description="The poster as it sits under the gallery's title.">
                  <GroundPreview theme={draft.theme} className="p-4 sm:p-6">
                    <GalleryPoster
                      asset={posterAsset}
                      theme={draft.theme}
                      tone={groundTone(draft.theme)}
                      preview
                    />
                  </GroundPreview>
                </SectionCard>

                <SectionCard bare title="Image" description="Which image leads the page and how it's cropped.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Poster image"
                      hint="Automatic uses the first image in the gallery."
                      className="sm:col-span-2"
                    >
                      <Select
                        value={draft.coverAssetId || "auto"}
                        onValueChange={(v) => set("coverAssetId")(v === "auto" ? null : v)}
                      >
                        <SelectTrigger className="bg-surface-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automatic</SelectItem>
                          <ImageAssetItems assets={coverOptions} />
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Crop">
                      <SegmentedTabs
                        fullWidth
                        tabs={POSTER_ASPECT_OPTIONS}
                        value={draft.theme.poster.aspect}
                        onChange={setThemePart("poster", "aspect")}
                      />
                    </Field>
                    <Field label="Focus" hint="Which part of the image stays in frame.">
                      <SegmentedTabs
                        fullWidth
                        tabs={POSTER_FOCUS_OPTIONS}
                        value={draft.theme.poster.focus}
                        onChange={setThemePart("poster", "focus")}
                      />
                    </Field>
                    <Field label="Motion" className="sm:col-span-2">
                      <SegmentedTabs
                        fullWidth
                        tabs={POSTER_MOTION_OPTIONS}
                        value={draft.theme.poster.motion}
                        onChange={setThemePart("poster", "motion")}
                      />
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard bare title="Frame" description="Border, corners and depth around the poster.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Border" hint="Matted sets the image inside a card-colored mat.">
                      <SegmentedTabs
                        fullWidth
                        tabs={POSTER_FRAME_OPTIONS}
                        value={draft.theme.poster.frame}
                        onChange={setThemePart("poster", "frame")}
                      />
                    </Field>
                    <Field label="Border color" hint="Accent follows the theme's accent swatch.">
                      <SegmentedTabs
                        fullWidth
                        tabs={POSTER_FRAME_COLOR_OPTIONS}
                        value={draft.theme.poster.frameColor}
                        onChange={setThemePart("poster", "frameColor")}
                      />
                    </Field>
                    <Field label="Corners">
                      <SegmentedTabs
                        fullWidth
                        tabs={POSTER_CORNER_OPTIONS}
                        value={draft.theme.poster.corners}
                        onChange={setThemePart("poster", "corners")}
                      />
                    </Field>
                    <Field label="Depth">
                      <SegmentedTabs
                        fullWidth
                        tabs={POSTER_SHADOW_OPTIONS}
                        value={draft.theme.poster.shadow}
                        onChange={setThemePart("poster", "shadow")}
                      />
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard
                  bare
                  title="Text overlay"
                  description="Words set over the image — a tagline, a date, a way in."
                  action={
                    <Switch
                      checked={draft.theme.poster.overlay}
                      onCheckedChange={setThemePart("poster", "overlay")}
                      aria-label="Show text overlay"
                    />
                  }
                >
                  {draft.theme.poster.overlay ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Eyebrow" hint="A small label above the title.">
                        <Input
                          value={draft.theme.poster.eyebrow}
                          onChange={(e) => setThemePart("poster", "eyebrow")(e.target.value)}
                          placeholder="Fight week"
                          className="bg-surface-card"
                        />
                      </Field>
                      <Field label="Title">
                        <Input
                          value={draft.theme.poster.title}
                          onChange={(e) => setThemePart("poster", "title")(e.target.value)}
                          placeholder={draft.name || "Title"}
                          className="bg-surface-card"
                        />
                      </Field>
                      <Field label="Subtitle" className="sm:col-span-2">
                        <Textarea
                          value={draft.theme.poster.subtitle}
                          onChange={(e) => setThemePart("poster", "subtitle")(e.target.value)}
                          placeholder="A line or two under the title."
                          rows={2}
                          className="bg-surface-card"
                        />
                      </Field>
                      <Field label="Button" hint="Scrolls to the gallery. Leave empty for none.">
                        <Input
                          value={draft.theme.poster.button}
                          onChange={(e) => setThemePart("poster", "button")(e.target.value)}
                          placeholder="View gallery"
                          className="bg-surface-card"
                        />
                      </Field>
                      <Field label="Text size">
                        <SegmentedTabs
                          fullWidth
                          tabs={POSTER_SIZE_OPTIONS}
                          value={draft.theme.poster.size}
                          onChange={setThemePart("poster", "size")}
                        />
                      </Field>
                      <Field label="Position" className="sm:col-span-2">
                        <SegmentedTabs
                          fullWidth
                          tabs={POSTER_POSITION_OPTIONS}
                          value={draft.theme.poster.position}
                          onChange={setThemePart("poster", "position")}
                        />
                      </Field>
                      <Field label="Backdrop" hint="Darkens the image behind the text so it stays legible.">
                        <SegmentedTabs
                          fullWidth
                          tabs={POSTER_SCRIM_OPTIONS}
                          value={draft.theme.poster.scrim}
                          onChange={setThemePart("poster", "scrim")}
                        />
                      </Field>
                    </div>
                  ) : (
                    <p className="py-2 text-xs text-text-tertiary">
                      Off — the poster shows the image alone.
                    </p>
                  )}
                </SectionCard>
              </div>
            ) : null}

            {/* Header & footer ----------------------------------------------- */}
            {active === "navigation" ? (
              <div className="space-y-8">
                <SectionCard
                  bare
                  title="Top bar"
                  description="A slim bar above the title with your brand, links and a call to action."
                  action={
                    <Switch
                      checked={draft.theme.header.show}
                      onCheckedChange={setThemePart("header", "show")}
                      aria-label="Show top bar"
                    />
                  }
                >
                  <div className="space-y-5">
                    {draft.theme.header.show ? (
                      <>
                        <GroundPreview theme={draft.theme}>
                          <GalleryTopbar
                            gallery={draft}
                            theme={draft.theme}
                            tone={groundTone(draft.theme)}
                            links={completeLinks(draft.nav)}
                            preview
                          />
                        </GroundPreview>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Brand name" hint="Defaults to the gallery's name.">
                            <Input
                              value={draft.theme.header.brand}
                              onChange={(e) => setThemePart("header", "brand")(e.target.value)}
                              placeholder={draft.name || "Brand"}
                              className="bg-surface-card"
                            />
                          </Field>
                          <Field label="Logo" hint="Any image from the library.">
                            <Select
                              value={draft.theme.header.logoAssetId || "none"}
                              onValueChange={(v) => {
                                const logo = v === "none" ? null : assetById.get(v);
                                patchThemePart("header", {
                                  logoAssetId: logo?.id || "",
                                  logoUrl: logo?.thumbnailUrl || "",
                                });
                              }}
                            >
                              <SelectTrigger className="bg-surface-card">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No logo</SelectItem>
                                <ImageAssetItems assets={imageAssets} />
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field label="Button label" hint="A call to action on the right.">
                            <Input
                              value={draft.theme.header.ctaLabel}
                              onChange={(e) => setThemePart("header", "ctaLabel")(e.target.value)}
                              placeholder="Get in touch"
                              className="bg-surface-card"
                            />
                          </Field>
                          <Field label="Button link">
                            <Input
                              value={draft.theme.header.ctaHref}
                              onChange={(e) => setThemePart("header", "ctaHref")(e.target.value)}
                              placeholder="https:// or mailto:"
                              className="bg-surface-card"
                            />
                          </Field>
                          <Field label="Link placement">
                            <SegmentedTabs
                              fullWidth
                              tabs={HEADER_ALIGN_OPTIONS}
                              value={draft.theme.header.align}
                              onChange={setThemePart("header", "align")}
                            />
                          </Field>
                        </div>
                      </>
                    ) : null}

                    <Field
                      label="Header links"
                      hint={
                        draft.theme.header.show
                          ? "Shown in the top bar."
                          : "With the top bar off, these show as chips under the title."
                      }
                    >
                      <LinkListEditor
                        links={draft.nav || []}
                        onChange={set("nav")}
                        empty="No header links — a portfolio, a contact page, a brief."
                      />
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard
                  bare
                  title="Footer"
                  description="The closing line of the page, with its own links."
                  action={
                    <Switch
                      checked={draft.theme.footer.show}
                      onCheckedChange={setThemePart("footer", "show")}
                      aria-label="Show footer"
                    />
                  }
                >
                  {draft.theme.footer.show ? (
                    <div className="space-y-5">
                      <GroundPreview theme={draft.theme}>
                        <GalleryFooter
                          gallery={draft}
                          theme={draft.theme}
                          tone={groundTone(draft.theme)}
                          preview
                          className="border-t-0"
                        />
                      </GroundPreview>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Footer text" hint="Defaults to a copyright line.">
                          <Input
                            value={draft.theme.footer.text}
                            onChange={(e) => setThemePart("footer", "text")(e.target.value)}
                            placeholder={`© ${new Date().getFullYear()} ${draft.name || ""}`}
                            className="bg-surface-card"
                          />
                        </Field>
                        <Field label="Layout">
                          <SegmentedTabs
                            fullWidth
                            tabs={FOOTER_ALIGN_OPTIONS}
                            value={draft.theme.footer.align}
                            onChange={setThemePart("footer", "align")}
                          />
                        </Field>
                      </div>

                      <Field label="Footer links">
                        <LinkListEditor
                          links={draft.theme.footer.links}
                          onChange={setThemePart("footer", "links")}
                          empty="No footer links — terms, a website, socials."
                        />
                      </Field>

                      <SettingsList>
                        <SettingRow
                          title="Show the Geiger Assets credit"
                          description="A small “Shared with Geiger Assets” note beside the footer text."
                          control={
                            <Switch
                              checked={draft.theme.footer.credit}
                              onCheckedChange={setThemePart("footer", "credit")}
                            />
                          }
                        />
                      </SettingsList>
                    </div>
                  ) : (
                    <p className="py-2 text-xs text-text-tertiary">
                      Off — the page ends with the gallery.
                    </p>
                  )}
                </SectionCard>
              </div>
            ) : null}

            {/* Selling ------------------------------------------------------- */}
            {active === "selling" ? (
              <GallerySellingSection
                projectId={projectId}
                commerce={draft.commerce}
                onChange={set("commerce")}
                items={previewItems}
              />
            ) : null}

            {/* Access -------------------------------------------------------- */}
            {active === "access" ? (
              <div className="space-y-8">
                <SectionCard bare title="Who can see this" description="Applied by the public page.">
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
              </div>
            ) : null}

            {/* SEO & Social -------------------------------------------------- */}
            {active === "seo" ? (
              <div className="space-y-8">
                <SectionCard
                  bare
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
              </div>
            ) : null}

            {/* Publish ------------------------------------------------------- */}
            {active === "publish" ? (
              <div className="space-y-8">
                <SectionCard bare title="Public address" description="Where people will find this gallery.">
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
                            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </SectionCard>

                <SectionCard
                  bare
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
                        <Badge className="border border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-700 dark:text-amber-300">
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
                      onClick={requestTogglePublish}
                    >
                      {published ? <EyeOff className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                      {published ? "Unpublish gallery" : "Publish gallery"}
                    </Button>
                  </div>
                  {dirty ? (
                    <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-300">
                      You have unsaved changes — save them before they reach the public page.
                    </p>
                  ) : null}
                </SectionCard>
              </div>
            ) : null}
          </>
        )}
      </EditorShell>

      <AddAssetsDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        assets={assets}
        existingIds={curatedIds}
        onAdd={handleAddAssets}
      />

      <ConfirmDeleteDialog
        open={publishConfirm}
        onOpenChange={(next) => !publishing && setPublishConfirm(next)}
        title={published ? "Unpublish this gallery?" : "Publish this gallery?"}
        description={
          published
            ? "The page goes offline for everyone straight away — shared links, embeds and any live checkout. Nothing is deleted."
            : draft.visibility === "public"
              ? "Anyone can open it, and it can show up in search."
              : draft.visibility === "unlisted"
                ? "Anyone with the link can open it."
                : "It's set to Private, so visitors still get a not-found page until you change Access."
        }
        confirmLabel={published ? "Unpublish gallery" : "Publish gallery"}
        tone={published ? "danger" : "primary"}
        pending={publishing}
        onConfirm={handleTogglePublish}
      >
      </ConfirmDeleteDialog>

      {guard.dialog}
    </>
  );
}

export default GalleryDetailScreen;
