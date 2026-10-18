"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Copy,
  ExternalLink,
  EyeOff,
  Images,
  Link2,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@geiger/ui/sheet";
import { Button } from "@geiger/ui/button";
import { Switch } from "@geiger/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  Field,
  RollingNumber,
  SettingRow,
  SettingsList,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { AssetThumbnail } from "@/components/internal/shared/asset_thumbnail";
import { cn } from "@/lib/utils";
import { listGalleryItems } from "@/lib/supabase/galleries";
import { listCollectionAssets } from "@/lib/supabase/collections";
import {
  listFavorites,
  listGalleryDownloadRequests,
  listGalleryEvents,
  rollUpByGallery,
} from "@/lib/supabase/gallery_audience";
import {
  DOWNLOAD_MODE_OPTIONS,
  LAYOUT_META,
  LAYOUT_OPTIONS,
  STATUS_META,
  VISIBILITY_META,
  VISIBILITY_OPTIONS,
  formatDate,
} from "./constants";

// One full row of tiles; the last cell turns into "+N" when there are more.
const STRIP_COLUMNS = 7;

function MetaRow({ label, value }) {
  return (
    <SettingRow
      title={label}
      control={
        <span className="max-w-[16rem] truncate text-right text-sm text-foreground">
          {value || <span className="text-text-tertiary">—</span>}
        </span>
      }
    />
  );
}

function QuickSelect({ value, onChange, options, className }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-8 w-36 border-border bg-surface-card text-xs", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-border bg-surface-subtle text-foreground">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Divider-separated numbers, sized for a sheet rather than a full screen. */
function QuickStats({ stats }) {
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-border bg-surface-card">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={cn(
            "px-3 py-3",
            i % 3 !== 0 && "border-l border-border",
            i >= 3 && "border-t border-border",
          )}
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            {stat.label}
          </p>
          <RollingNumber
            value={stat.value}
            className="mt-1.5 text-lg font-semibold leading-none tabular-nums text-foreground"
          />
        </div>
      ))}
    </div>
  );
}

export function GalleryQuickViewSheet({
  gallery,
  projectId,
  collectionName,
  open,
  onOpenChange,
  onEdit,
  onUpdate,
  onCopyLink,
  onOpenPublic,
  onDuplicate,
  onTogglePublish,
  onDelete,
}) {
  const [loaded, setLoaded] = useState(null);

  const galleryId = gallery?.id;
  const sourceKind = gallery?.sourceKind;
  const collectionId = gallery?.collectionId;

  useEffect(() => {
    if (!open || !galleryId) return undefined;
    let alive = true;
    const itemsLoad =
      sourceKind === "collection"
        ? Promise.resolve(collectionId ? listCollectionAssets(collectionId) : [])
        : listGalleryItems(galleryId).then((rows) => (rows ?? []).filter((r) => !r.isHidden));
    Promise.all([
      itemsLoad,
      listGalleryEvents(projectId),
      listFavorites(galleryId),
      listGalleryDownloadRequests(galleryId),
    ]).then(([items, events, favorites, requests]) => {
      if (!alive) return;
      setLoaded({
        id: galleryId,
        assetIds: (items ?? []).map((r) => r.assetId).filter(Boolean),
        audience: rollUpByGallery(events).get(galleryId) || null,
        favorites: (favorites ?? []).length,
        pending: (requests ?? []).filter((r) => r.status === "pending").length,
      });
    });
    return () => {
      alive = false;
    };
  }, [open, galleryId, sourceKind, collectionId, projectId]);

  const data = loaded?.id === galleryId ? loaded : null;

  const stats = useMemo(() => {
    const n = (v) => (data ? String(v ?? 0) : "0");
    return [
      { label: "Items", value: n(data?.assetIds.length) },
      { label: "Views", value: n(data?.audience?.views) },
      { label: "Visitors", value: n(data?.audience?.visitors) },
      { label: "Favorites", value: n(data?.favorites) },
      { label: "Downloads", value: n(data?.audience?.downloads) },
      { label: "Requests", value: n(data?.pending) },
    ];
  }, [data]);

  if (!gallery) return null;

  const published = gallery.status === "published";
  const coverId = gallery.coverAssetId || data?.assetIds[0] || null;
  const total = data?.assetIds.length || 0;
  const strip = data?.assetIds.slice(0, total > STRIP_COLUMNS ? STRIP_COLUMNS - 1 : STRIP_COLUMNS) || [];
  const extra = total - strip.length;
  const source =
    gallery.sourceKind === "collection"
      ? collectionName(gallery.collectionId) || "Collection"
      : "Curated selection";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-l border-border bg-surface-subtle p-0 sm:max-w-lg"
      >
        <SheetHeader className="gap-3 border-b border-border p-6 pb-4">
          <div className="flex items-center gap-3">
            {coverId ? (
              <AssetThumbnail assetId={coverId} large className="h-11 w-11" />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
                <Images className="h-4 w-4 text-text-tertiary" />
              </span>
            )}
            <div className="min-w-0 flex-1 pr-6">
              <SheetTitle className="truncate text-base leading-snug">
                {gallery.name || "Untitled gallery"}
              </SheetTitle>
              <SheetDescription className="truncate text-xs">
                {gallery.slug ? `/g/${gallery.slug}` : "No public URL yet"} · {source}
              </SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill status={gallery.status} map={STATUS_META} className="text-[10px]" />
            <StatusPill status={gallery.visibility} map={VISIBILITY_META} className="text-[10px]" />
            {gallery.hasPassword ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                Password
              </span>
            ) : null}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-6 p-6">
            <QuickStats stats={stats} />

            <Field label="Items">
              {!data ? (
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: STRIP_COLUMNS }, (_, i) => (
                    <span key={i} className="aspect-square animate-pulse rounded-lg bg-surface-card" />
                  ))}
                </div>
              ) : strip.length === 0 ? (
                <p className="text-xs text-text-tertiary">Nothing in this gallery yet.</p>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {strip.map((assetId) => (
                    <AssetThumbnail
                      key={assetId}
                      assetId={assetId}
                      large
                      className="aspect-square h-auto w-full"
                    />
                  ))}
                  {extra > 0 ? (
                    <span className="flex aspect-square items-center justify-center rounded-lg border border-border bg-surface-card text-xs font-medium text-text-secondary">
                      +{extra}
                    </span>
                  ) : null}
                </div>
              )}
            </Field>

            <Field label="Quick settings">
              <SettingsList className="mt-1 rounded-lg border border-border bg-surface-card px-4 py-3.5">
                <SettingRow
                  title="Visibility"
                  control={
                    <QuickSelect
                      value={gallery.visibility}
                      onChange={(visibility) => onUpdate(gallery, { visibility })}
                      options={VISIBILITY_OPTIONS}
                    />
                  }
                />
                <SettingRow
                  title="Layout"
                  control={
                    <QuickSelect
                      value={gallery.layout}
                      onChange={(layout) => onUpdate(gallery, { layout })}
                      options={LAYOUT_OPTIONS}
                    />
                  }
                />
                <SettingRow
                  title="Downloads"
                  control={
                    <QuickSelect
                      value={gallery.downloadMode || "off"}
                      onChange={(downloadMode) => onUpdate(gallery, { downloadMode })}
                      options={DOWNLOAD_MODE_OPTIONS}
                    />
                  }
                />
                <SettingRow
                  title="Ask for visitor details"
                  control={
                    <Switch
                      checked={Boolean(gallery.requireEmail)}
                      onCheckedChange={(requireEmail) => onUpdate(gallery, { requireEmail })}
                    />
                  }
                />
                <SettingRow
                  title="Allow favorites"
                  control={
                    <Switch
                      checked={Boolean(gallery.allowFavorites)}
                      onCheckedChange={(allowFavorites) => onUpdate(gallery, { allowFavorites })}
                    />
                  }
                />
              </SettingsList>
            </Field>

            <Field label="Details">
              <SettingsList className="mt-1 rounded-lg border border-border bg-surface-card px-4 py-3.5">
                <MetaRow label="Source" value={source} />
                <MetaRow label="Layout" value={LAYOUT_META[gallery.layout]?.label} />
                <MetaRow label="Published" value={published ? formatDate(gallery.publishedAt) : ""} />
                <MetaRow label="Expires" value={gallery.expiresAt ? formatDate(gallery.expiresAt) : ""} />
                <MetaRow label="Updated" value={formatDate(gallery.updatedAt)} />
              </SettingsList>
            </Field>
          </div>
        </div>

        <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t border-border px-6 py-4">
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onEdit(gallery)}
          >
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onTogglePublish(gallery)}
          >
            {published ? <EyeOff className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            {published ? "Unpublish" : "Publish"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Copy public link"
            disabled={!gallery.slug}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onCopyLink(gallery)}
          >
            <Link2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Open public page"
            disabled={!published || !gallery.slug}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenPublic(gallery)}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Duplicate gallery"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onDuplicate(gallery)}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="ml-auto text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
            onClick={() => {
              onOpenChange(false);
              onDelete(gallery);
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default GalleryQuickViewSheet;
