"use client";

// Shared gallery rendering. The workspace editor's live preview and the public
// /g/<slug> page both draw from here, so a theme or layout change shows up in
// both places at once.

import React from "react";
import { ArrowDown, Check, Clock, File, Heart, Images, ShoppingBag } from "lucide-react";

import { cn } from "@/lib/utils";
import { TYPE_ICONS } from "@/components/internal/shared/asset_meta";
import {
  GAP_CLASS,
  RADIUS_CLASS,
  TYPOGRAPHY_CLASS,
  formatDate,
  groundTone,
  pageWidth,
  primaryButton,
  withThemeDefaults,
} from "./constants";

/** Column classes per column setting, widening at each breakpoint. "auto" is 4. */
const GRID_COLUMNS = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
};
const MASONRY_COLUMNS = {
  2: "columns-2",
  3: "columns-2 sm:columns-3",
  4: "columns-2 sm:columns-3 lg:columns-4",
  5: "columns-2 sm:columns-3 lg:columns-5",
};
// Mosaic needs an even column count so its 2×2 features pack cleanly.
const MOSAIC_COLUMNS = {
  2: "grid-cols-2",
  3: "grid-cols-2 lg:grid-cols-4",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6",
};

function columnCount(theme) {
  const n = Number(theme.columns);
  return GRID_COLUMNS[n] ? n : 4;
}

// Masonry columns space tiles with a bottom margin rather than a row gap.
const MASONRY_SPACING = {
  tight: "gap-1 [&>*]:mb-1",
  comfortable: "gap-3 [&>*]:mb-3",
  airy: "gap-6 [&>*]:mb-6",
};

// Single column is editorial, so it breathes more than the grid gaps.
const SINGLE_GAP = { tight: "gap-3", comfortable: "gap-8", airy: "gap-16" };

// Target row height for justified rows; tiles grow from here to fill a row.
const JUSTIFIED_ROW_HEIGHT = 240;

const TILE_SHAPE_CLASS = {
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  landscape: "aspect-[3/2]",
};

// What a tile does under the pointer: on the image, and on the tile's frame.
const HOVER_IMAGE_CLASS = {
  zoom: "transition-transform duration-500 ease-out group-hover:scale-[1.03]",
  lift: "",
  mono: "grayscale transition-[filter] duration-500 group-hover:grayscale-0",
  none: "",
};
const HOVER_FRAME_CLASS = {
  lift: "transition-[translate,box-shadow] duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_-18px_rgb(0_0_0/0.55)]",
};

const ENTRANCE_CLASS = {
  fade: "animate-in fade-in fill-mode-both duration-700",
  rise: "animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700",
};

/** Every sixth mosaic tile, starting with the first, is featured at 2×2. */
function isFeatured(index) {
  return index % 6 === 0;
}

/** An asset's display title: its name without the file extension. */
export function assetTitle(asset) {
  return String(asset?.name ?? "").replace(/\.[a-z0-9]{2,5}$/i, "");
}

/** Width / height of an asset, or null when its dimensions aren't known. */
export function aspectOf(asset) {
  return asset?.width > 0 && asset?.height > 0 ? asset.width / asset.height : null;
}

/**
 * One asset in a gallery. Renders the stored thumbnail when there is one and
 * falls back to a type-tinted placeholder, the way the library does.
 *
 * `protect` turns off the context menu and dragging on the image — a
 * deterrent for galleries with downloads off, not real protection.
 *
 * Selling galleries pass `priceLabel` + `onBuy` for the price chip, and
 * `selectable` / `selected` / `onSelect` while the buyer picks a bundle.
 */
export function GalleryTile({
  asset,
  caption,
  theme,
  layout = "grid",
  index = 0,
  favorited = false,
  onToggleFavorite,
  onOpen,
  protect = false,
  priceLabel = null,
  onBuy,
  selectable = false,
  selected = false,
  onSelect,
  className,
  style,
}) {
  const t = withThemeDefaults(theme);
  const tone = groundTone(t);
  const Icon = TYPE_ICONS[asset?.type] || File;
  const radius = RADIUS_CLASS[t.radius] || RADIUS_CLASS.rounded;
  const ratio = aspectOf(asset);
  const label = caption || assetTitle(asset);
  // A caption below a mosaic tile would push its row out of the square grid,
  // so mosaic shows it over the image instead.
  const captionMode = layout === "mosaic" && t.caption === "below" ? "overlay" : t.caption;

  // Grid crops to its tile shape, mosaic to squares and single/slideshow to a
  // wide frame; masonry and justified keep the asset's own shape.
  const natural = layout === "masonry" || layout === "justified";
  const frameStyle = natural && ratio ? { aspectRatio: ratio } : undefined;
  const frameClass = natural
    ? ratio
      ? ""
      : "aspect-[4/3]"
    : layout === "single" || layout === "slideshow"
      ? "aspect-[3/2]"
      : layout === "grid"
        ? TILE_SHAPE_CLASS[t.tileShape] || TILE_SHAPE_CLASS.square
        : "aspect-square";

  const entrance = ENTRANCE_CLASS[t.entrance];
  const figureStyle = entrance
    ? { ...style, animationDelay: `${Math.min(index, 12) * 60}ms` }
    : style;

  return (
    <figure
      className={cn("group relative m-0 break-inside-avoid", entrance, className)}
      style={figureStyle}
    >
      <div className={cn("relative overflow-hidden", radius, HOVER_FRAME_CLASS[t.hover])}>
        <button
          type="button"
          onClick={
            selectable ? () => onSelect?.(asset) : onOpen ? () => onOpen(asset) : undefined
          }
          aria-pressed={selectable ? selected : undefined}
          className={cn(
            "block w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gallery-accent)]",
            tone.media,
            radius,
            !onOpen && !selectable && "cursor-default",
            selectable && selected && "ring-2 ring-[var(--gallery-accent)] ring-offset-2 ring-offset-transparent",
          )}
          style={{ "--gallery-accent": t.accent }}
          aria-label={
            selectable
              ? `${selected ? "Deselect" : "Select"} ${asset?.name || "asset"}`
              : onOpen
                ? `Open ${asset?.name || "asset"}`
                : asset?.name || "Asset"
          }
        >
          {asset?.thumbnailUrl ? (
            // Stored thumbnails are arbitrary remote URLs, so next/image's loader
            // isn't a fit here — a plain img keeps the public page dependency-free.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.thumbnailUrl}
              alt={asset.name || ""}
              loading="lazy"
              decoding="async"
              draggable={!protect}
              onContextMenu={protect ? (e) => e.preventDefault() : undefined}
              className={cn(
                "block w-full object-cover",
                HOVER_IMAGE_CLASS[t.hover] ?? HOVER_IMAGE_CLASS.zoom,
                frameClass,
              )}
              style={frameStyle}
            />
          ) : (
            <div
              className={cn("flex w-full items-center justify-center", frameClass || "aspect-[4/3]")}
              style={{ ...frameStyle, background: `${asset?.color || "#737373"}20` }}
            >
              <Icon className="h-6 w-6" style={{ color: asset?.color || "#737373" }} />
            </div>
          )}
        </button>

        {captionMode === "overlay" && label ? (
          <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3 pb-2.5 pt-10 text-xs text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="line-clamp-2">{label}</span>
          </figcaption>
        ) : null}

        {selectable ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 backdrop-blur-md transition-colors",
              selected ? "border-transparent text-white" : "border-white/80 bg-black/30 text-transparent",
            )}
            style={selected ? { background: t.accent } : undefined}
          >
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : priceLabel && onBuy ? (
          <button
            type="button"
            onClick={() => onBuy(asset)}
            aria-label={`Buy ${asset?.name || "asset"} — ${priceLabel}`}
            className="absolute left-2 top-2 inline-flex h-7 items-center gap-1 rounded-full bg-black/55 px-2.5 text-[11px] font-medium text-white backdrop-blur-md transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ShoppingBag className="h-3 w-3" aria-hidden="true" />
            {priceLabel}
          </button>
        ) : null}

        {onToggleFavorite && !selectable ? (
          <button
            type="button"
            onClick={() => onToggleFavorite(asset)}
            aria-label={favorited ? "Remove favorite" : "Add favorite"}
            aria-pressed={favorited}
            className={cn(
              "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-opacity hover:bg-black/65",
              favorited
                ? "opacity-100"
                : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
            )}
          >
            <Heart
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                favorited && "scale-110 fill-red-500 text-red-500",
              )}
            />
          </button>
        ) : null}
      </div>

      {captionMode === "below" && label ? (
        <figcaption className={cn("truncate px-0.5 pt-2 text-xs", tone.caption)}>{label}</figcaption>
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
  protect = false,
  priceFor,
  onBuy,
  selection,
  onSelect,
  className,
}) {
  const t = withThemeDefaults(theme);
  if (!items?.length) return null;

  const typography = TYPOGRAPHY_CLASS[t.typography] || TYPOGRAPHY_CLASS.sans;
  const columns = columnCount(t);
  const gap = GAP_CLASS[t.gap] || GAP_CLASS.comfortable;
  const tiles = (extra) =>
    items.map(({ asset, caption, key }, index) => (
      <GalleryTile
        key={key || asset?.id}
        asset={asset}
        caption={caption}
        theme={t}
        layout={layout}
        index={index}
        favorited={favorites?.has(asset?.id)}
        onToggleFavorite={onToggleFavorite}
        onOpen={onOpen}
        protect={protect}
        priceLabel={priceFor?.(asset) ?? null}
        onBuy={onBuy}
        selectable={Boolean(selection)}
        selected={Boolean(selection?.has(asset?.id))}
        onSelect={onSelect}
        {...extra?.(asset, index)}
      />
    ));

  if (layout === "masonry") {
    return (
      <div
        className={cn(
          MASONRY_COLUMNS[columns],
          MASONRY_SPACING[t.gap] || MASONRY_SPACING.comfortable,
          typography,
          className,
        )}
      >
        {tiles()}
      </div>
    );
  }

  if (layout === "justified") {
    // Flex rows where each tile grows in proportion to its aspect ratio, so a
    // row fills the width at roughly the target height. The trailing spacer
    // soaks up the last row's slack instead of stretching its tiles.
    return (
      <div className={cn("flex flex-wrap", gap, typography, className)}>
        {tiles((asset) => {
          const ratio = aspectOf(asset) || 4 / 3;
          return {
            className: "min-w-0",
            style: { flexGrow: ratio, flexBasis: `${Math.round(ratio * JUSTIFIED_ROW_HEIGHT)}px` },
          };
        })}
        <div className="grow-[999]" aria-hidden="true" />
      </div>
    );
  }

  if (layout === "mosaic") {
    // Dense flow lets the small tiles back-fill around each 2×2 feature.
    return (
      <div className={cn("grid grid-flow-dense", MOSAIC_COLUMNS[columns], gap, typography, className)}>
        {tiles((asset, index) =>
          isFeatured(index) ? { className: "col-span-2 row-span-2" } : null,
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid",
        layout === "single"
          ? "mx-auto max-w-4xl grid-cols-1"
          : layout === "slideshow"
            ? "grid-cols-1"
            : GRID_COLUMNS[columns],
        layout === "single" ? SINGLE_GAP[t.gap] || SINGLE_GAP.comfortable : gap,
        typography,
        className,
      )}
    >
      {tiles()}
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

// Page chrome ------------------------------------------------------------------

/** Links with a label and a target — half-typed rows in the editor are skipped. */
export function completeLinks(links) {
  return (links || []).filter((link) => link?.label && link?.href);
}

/**
 * An outbound link that opens off-site targets in a new tab. In the editor's
 * preview (`preview`) it renders the same markup but never navigates.
 */
function PageLink({ href, preview, className, style, children }) {
  const offsite = /^https?:/.test(href || "");
  return (
    <a
      href={href}
      target={offsite ? "_blank" : undefined}
      rel={offsite ? "noopener noreferrer" : undefined}
      onClick={preview ? (e) => e.preventDefault() : undefined}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}

/** Optional top bar: brand (logo and/or text), header links and a call to action. */
export function GalleryTopbar({ gallery, theme, tone, links, preview = false }) {
  const t = withThemeDefaults(theme);
  const header = t.header;
  const button = primaryButton(t, tone);
  const brand = String(header.brand || "").trim() || gallery?.name || "Gallery";
  const cta = header.ctaLabel && header.ctaHref ? header : null;
  const centered = header.align === "center";
  const linkClass = cn(
    "inline-flex h-8 shrink-0 items-center rounded-md px-3 text-sm transition-colors",
    tone.link,
  );

  return (
    <div className={cn("relative z-20 border-b", tone.border)}>
      <div className={cn("relative mx-auto flex h-14 items-center gap-4 px-4 sm:px-6", pageWidth(t))}>
        <div className="flex min-w-0 items-center gap-2.5">
          {header.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={header.logoUrl} alt="" className="h-7 w-auto max-w-[120px] object-contain" />
          ) : null}
          <span className="truncate text-sm font-semibold tracking-tight">{brand}</span>
        </div>

        {links.length ? (
          <nav
            aria-label="Gallery links"
            className={cn(
              "hidden items-center gap-0.5 sm:flex",
              centered ? "absolute left-1/2 -translate-x-1/2" : "ml-auto",
            )}
          >
            {links.map((link, i) => (
              <PageLink key={`${link.href}-${i}`} href={link.href} preview={preview} className={linkClass}>
                {link.label}
              </PageLink>
            ))}
          </nav>
        ) : null}

        {cta ? (
          <PageLink
            href={cta.ctaHref}
            preview={preview}
            className={cn(
              "ml-auto inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-sm font-medium transition",
              button.className,
              links.length && !centered && "sm:ml-0",
            )}
            style={button.style}
          >
            {cta.ctaLabel}
          </PageLink>
        ) : null}
      </div>

      {/* Small screens: the links drop to their own scrolling row. */}
      {links.length ? (
        <nav aria-label="Gallery links" className="flex gap-0.5 overflow-x-auto px-2 pb-2 sm:hidden">
          {links.map((link, i) => (
            <PageLink key={`${link.href}-${i}`} href={link.href} preview={preview} className={linkClass}>
              {link.label}
            </PageLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

/** Page footer: a line of text, footer links, the expiry notice and the credit. */
export function GalleryFooter({ gallery, theme, tone, preview = false, className }) {
  const t = withThemeDefaults(theme);
  const footer = t.footer;
  if (!footer.show) return null;

  const text =
    String(footer.text || "").trim() ||
    `© ${new Date().getFullYear()} ${gallery?.name || ""}`.trim();
  const links = completeLinks(footer.links);
  const centered = footer.align === "center";
  const notes = [
    gallery?.expiresAt ? (
      <span key="expires" className="inline-flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        Available until {formatDate(gallery.expiresAt)}
      </span>
    ) : null,
    footer.credit ? <span key="credit">Shared with Geiger Assets</span> : null,
  ].filter(Boolean);

  const linkRow = links.length ? (
    <nav
      aria-label="Footer links"
      className={cn("flex flex-wrap items-center gap-x-5 gap-y-2", centered && "justify-center")}
    >
      {links.map((link, i) => (
        <PageLink
          key={`${link.href}-${i}`}
          href={link.href}
          preview={preview}
          className={cn("text-sm underline-offset-4 transition-colors hover:underline", tone.muted)}
        >
          {link.label}
        </PageLink>
      ))}
    </nav>
  ) : null;

  return (
    <footer className={cn("border-t", tone.border, className)}>
      <div
        className={cn(
          "mx-auto flex flex-col gap-4 px-4 py-10 sm:px-6",
          pageWidth(t),
          centered ? "items-center text-center" : "sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        {centered ? linkRow : null}
        <div className={cn("flex flex-col gap-1.5", centered && "items-center")}>
          <p className="text-sm">{text}</p>
          {notes.length ? (
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs",
                tone.subtle,
                centered && "justify-center",
              )}
            >
              {notes}
            </div>
          ) : null}
        </div>
        {centered ? null : linkRow}
      </div>
    </footer>
  );
}

// Poster -----------------------------------------------------------------------

const POSTER_ASPECT_CLASS = {
  cinema: "aspect-[16/10] @2xl:aspect-[21/9]",
  wide: "aspect-video",
  classic: "aspect-[3/2]",
  natural: "h-auto",
};
const POSTER_FOCUS_CLASS = { top: "object-top", center: "object-center", bottom: "object-bottom" };
const POSTER_CORNER_CLASS = {
  square: "rounded-none",
  subtle: "rounded-sm",
  rounded: "rounded-xl",
  soft: "rounded-3xl",
};
// A matted poster's image sits inside the mat, so its corners step down a size.
const POSTER_INNER_CORNER_CLASS = {
  square: "rounded-none",
  subtle: "rounded-[1px]",
  rounded: "rounded-md",
  soft: "rounded-2xl",
};
const POSTER_MOTION_CLASS = {
  none: "",
  hover: "transition-transform duration-[1600ms] ease-out group-hover/poster:scale-105",
  drift: "gallery-drift animate-[gallery-drift_28s_ease-in-out_infinite_alternate]",
};
// Where the overlay block sits (outer flex) and how its own lines align.
const POSTER_POSITION_CLASS = {
  "top-left": { wrap: "items-start justify-start", block: "items-start text-left" },
  center: { wrap: "items-center justify-center", block: "items-center text-center" },
  "bottom-left": { wrap: "items-end justify-start", block: "items-start text-left" },
  "bottom-center": { wrap: "items-end justify-center", block: "items-center text-center" },
};
const POSTER_TITLE_CLASS = {
  sm: "text-lg @2xl:text-2xl",
  md: "text-2xl @2xl:text-3xl @4xl:text-4xl",
  lg: "text-3xl @2xl:text-5xl @4xl:text-6xl",
};
const POSTER_SUBTITLE_CLASS = {
  sm: "text-xs @2xl:text-sm",
  md: "text-sm @2xl:text-base",
  lg: "text-base @2xl:text-lg",
};

function posterScrim(scrim, position) {
  if (scrim === "full") return "bg-black/45";
  if (scrim !== "gradient") return "";
  if (position === "top-left") return "bg-gradient-to-b from-black/75 via-black/25 to-transparent";
  if (position === "center") {
    return "bg-[radial-gradient(ellipse_at_center,rgb(0_0_0/0.6),transparent_70%)]";
  }
  return "bg-gradient-to-t from-black/80 via-black/30 to-transparent";
}

/**
 * The gallery's cover as a styled poster: aspect and focal point, a frame,
 * corners, depth, optional motion, and an optional text overlay. Container
 * queries size the overlay, so the editor's narrow preview and the full-width
 * public page read the same.
 */
export function GalleryPoster({ asset, theme, tone, protect = false, preview = false, className }) {
  const t = withThemeDefaults(theme);
  const p = t.poster;
  const matted = p.frame === "matted";
  const aspect = POSTER_ASPECT_CLASS[p.aspect] || POSTER_ASPECT_CLASS.cinema;
  const position = POSTER_POSITION_CLASS[p.position] || POSTER_POSITION_CLASS["bottom-left"];
  const size = POSTER_TITLE_CLASS[p.size] ? p.size : "md";
  const hasText = p.overlay && (p.eyebrow || p.title || p.subtitle || p.button);

  const frameColor =
    p.frameColor === "accent" ? "" : p.frameColor === "contrast" ? tone.contrast : tone.border;
  const style = {
    ...(p.frame !== "none" && p.frameColor === "accent" ? { borderColor: t.accent } : null),
    ...(p.shadow === "glow"
      ? { boxShadow: `0 28px 90px -28px ${t.accent}, 0 0 0 1px ${t.accent}26` }
      : null),
  };

  return (
    <figure
      className={cn(
        "group/poster @container relative m-0 animate-in fade-in duration-700",
        POSTER_CORNER_CLASS[p.corners] || POSTER_CORNER_CLASS.subtle,
        p.frame === "hairline" && "border",
        p.frame === "bold" && "border-4",
        matted && cn("border p-2 @2xl:p-3", tone.card),
        p.frame !== "none" && frameColor,
        !matted && "overflow-hidden",
        p.shadow === "soft" && "shadow-[0_28px_70px_-24px_rgb(0_0_0/0.6)]",
        className,
      )}
      style={style}
    >
      <div
        className={cn(
          "relative overflow-hidden",
          matted && (POSTER_INNER_CORNER_CLASS[p.corners] || POSTER_INNER_CORNER_CLASS.subtle),
          !asset?.thumbnailUrl && tone.card,
        )}
      >
        {asset?.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnailUrl}
            alt={asset.name || ""}
            draggable={!protect}
            onContextMenu={protect ? (e) => e.preventDefault() : undefined}
            className={cn(
              "block w-full object-cover",
              aspect,
              POSTER_FOCUS_CLASS[p.focus] || POSTER_FOCUS_CLASS.center,
              POSTER_MOTION_CLASS[p.motion],
            )}
          />
        ) : (
          <div
            className={cn(
              "flex w-full items-center justify-center",
              p.aspect === "natural" ? "aspect-[21/9]" : aspect,
              tone.subtle,
            )}
          >
            <Images className="h-8 w-8" aria-hidden="true" />
          </div>
        )}

        {hasText ? (
          <figcaption
            className={cn(
              "absolute inset-0 flex p-5 text-white @2xl:p-8 @4xl:p-12",
              position.wrap,
              posterScrim(p.scrim, p.position),
            )}
          >
            <div
              className={cn(
                "flex max-w-2xl flex-col gap-2 @2xl:gap-3",
                position.block,
                p.scrim === "none" && "[text-shadow:0_1px_12px_rgb(0_0_0/0.45)]",
              )}
            >
              {p.eyebrow ? (
                <span className="flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/80">
                  <span aria-hidden="true" className="h-px w-6" style={{ background: t.accent }} />
                  {p.eyebrow}
                </span>
              ) : null}
              {p.title ? (
                <span
                  className={cn(
                    "text-balance font-semibold leading-[1.05] tracking-tight",
                    POSTER_TITLE_CLASS[size],
                  )}
                >
                  {p.title}
                </span>
              ) : null}
              {p.subtitle ? (
                <span className={cn("max-w-xl text-pretty text-white/80", POSTER_SUBTITLE_CLASS[size])}>
                  {p.subtitle}
                </span>
              ) : null}
              {p.button ? (
                <a
                  href="#gallery"
                  onClick={preview ? (e) => e.preventDefault() : undefined}
                  className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-zinc-900 transition-colors [text-shadow:none] hover:bg-white/90"
                >
                  {p.button}
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </figcaption>
        ) : null}
      </div>
    </figure>
  );
}
