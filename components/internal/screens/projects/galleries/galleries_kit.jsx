"use client";

// Shared gallery rendering. The workspace editor's live preview and the public
// /g/<slug> page both draw from here, so a theme or layout change shows up in
// both places at once.

import React from "react";
import { File, Heart, Images } from "lucide-react";

import { cn } from "@/lib/utils";
import { TYPE_ICONS } from "@/components/internal/shared/asset_meta";
import {
  GAP_CLASS,
  RADIUS_CLASS,
  TYPOGRAPHY_CLASS,
  withThemeDefaults,
} from "./constants";

/** Column count per layout, widening at each breakpoint. */
const LAYOUT_COLUMNS = {
  grid: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  masonry: "columns-2 sm:columns-3 lg:columns-4",
  justified: "grid-cols-2 sm:grid-cols-3",
  slideshow: "grid-cols-1",
  single: "grid-cols-1",
};

/**
 * One asset in a gallery. Renders the stored thumbnail when there is one and
 * falls back to a type-tinted placeholder, the way the library does.
 */
export function GalleryTile({
  asset,
  caption,
  theme,
  layout = "grid",
  favorited = false,
  onToggleFavorite,
  onOpen,
  className,
}) {
  const t = withThemeDefaults(theme);
  const Icon = TYPE_ICONS[asset?.type] || File;
  const radius = RADIUS_CLASS[t.radius] || RADIUS_CLASS.rounded;
  const tall = layout === "single" || layout === "slideshow";

  return (
    <figure
      className={cn(
        "group relative m-0 overflow-hidden",
        layout === "masonry" && "mb-3 break-inside-avoid",
        radius,
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpen ? () => onOpen(asset) : undefined}
        className={cn(
          "block w-full overflow-hidden border border-border bg-surface-card",
          radius,
          !onOpen && "cursor-default",
        )}
        aria-label={asset?.name || "Asset"}
      >
        {asset?.thumbnailUrl ? (
          // Stored thumbnails are arbitrary remote URLs, so next/image's loader
          // isn't a fit here — a plain img keeps the public page dependency-free.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnailUrl}
            alt={asset.name || ""}
            className={cn(
              "w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]",
              layout === "masonry" ? "h-auto" : tall ? "aspect-[3/2]" : "aspect-square",
            )}
          />
        ) : (
          <div
            className={cn(
              "flex w-full items-center justify-center",
              layout === "masonry" ? "aspect-[4/3]" : tall ? "aspect-[3/2]" : "aspect-square",
            )}
            style={{ background: `${asset?.color || "#737373"}20` }}
          >
            <Icon className="h-6 w-6" style={{ color: asset?.color || "#737373" }} />
          </div>
        )}
      </button>

      {onToggleFavorite ? (
        <button
          type="button"
          onClick={() => onToggleFavorite(asset)}
          aria-label={favorited ? "Remove favorite" : "Add favorite"}
          aria-pressed={favorited}
          className={cn(
            "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/70 backdrop-blur transition-opacity",
            favorited ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100",
          )}
        >
          <Heart
            className={cn("h-3.5 w-3.5", favorited ? "fill-red-400 text-red-400" : "text-foreground")}
          />
        </button>
      ) : null}

      {t.caption !== "none" && (caption || asset?.name) ? (
        <figcaption
          className={cn(
            "truncate text-xs",
            t.caption === "overlay"
              ? "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent px-2 pb-2 pt-6 text-foreground"
              : "px-0.5 pt-2 text-text-secondary",
          )}
        >
          {caption || asset?.name}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * The arrangement of tiles for a layout. `items` are `{ asset, caption }` pairs
 * so a curated gallery can override the caption per item.
 */
export function GalleryGrid({
  items,
  theme,
  layout = "grid",
  favorites,
  onToggleFavorite,
  onOpen,
  className,
}) {
  const t = withThemeDefaults(theme);
  const gap = GAP_CLASS[t.gap] || GAP_CLASS.comfortable;
  const columns = LAYOUT_COLUMNS[layout] || LAYOUT_COLUMNS.grid;
  const masonry = layout === "masonry";

  if (!items?.length) return null;

  return (
    <div
      className={cn(
        masonry ? columns : "grid",
        !masonry && columns,
        !masonry && gap,
        masonry && (t.gap === "tight" ? "gap-1" : t.gap === "airy" ? "gap-6" : "gap-3"),
        TYPOGRAPHY_CLASS[t.typography] || TYPOGRAPHY_CLASS.sans,
        className,
      )}
    >
      {items.map(({ asset, caption, key }) => (
        <GalleryTile
          key={key || asset?.id}
          asset={asset}
          caption={caption}
          theme={t}
          layout={layout}
          favorited={favorites?.has(asset?.id)}
          onToggleFavorite={onToggleFavorite}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

/** Accent + ground preview chip used in the theme editor and the domains list. */
export function ThemeSwatch({ theme, className }) {
  const t = withThemeDefaults(theme);
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border",
        t.ground === "light" ? "bg-zinc-100" : "bg-surface-card",
        className,
      )}
    >
      <span className="h-4 w-4 rounded-full" style={{ background: t.accent }} />
    </div>
  );
}

/** Small count strip reused by the builder rows and the showcase cards. */
export function GalleryMetrics({ metrics, className }) {
  if (!metrics?.length) return null;
  return (
    <div className={cn("flex items-center gap-3 text-[11px] text-text-tertiary", className)}>
      {metrics.map(({ icon: Icon, label, value }) => (
        <span key={label} className="inline-flex items-center gap-1 tabular-nums">
          <Icon className="h-3 w-3" aria-hidden="true" />
          {value}
          <span className="sr-only">{label}</span>
        </span>
      ))}
    </div>
  );
}

export const GalleryPlaceholderIcon = Images;
