"use client";

// Full-screen viewer for the public gallery: one asset at a time on a black
// stage, with keyboard (← → Esc F), swipe and filmstrip navigation.

import React, { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Download, File, Heart, Share2, ShoppingBag, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { TYPE_ICONS } from "@/components/internal/shared/asset_meta";
import { formatBytes } from "../constants";
import { assetTitle } from "../galleries_kit";

const SWIPE_THRESHOLD = 48;

function IconButton({ label, onClick, href, download, pressed, className, children }) {
  const classes = cn(
    "flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
    className,
  );
  if (href) {
    return (
      <a href={href} download={download} aria-label={label} title={label} className={classes} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}

export function GalleryLightbox({
  items,
  index,
  onIndexChange,
  onClose,
  favorites,
  onToggleFavorite,
  downloadHref,
  onDownload,
  onShare,
  protect = false,
  priceFor,
  onBuy,
}) {
  const stageRef = useRef(null);
  const touchX = useRef(null);
  const filmstripRef = useRef(null);
  const total = items.length;
  const current = items[index];
  const asset = current?.asset;

  const go = (delta) => onIndexChange((index + delta + total) % total);

  // Keyboard navigation, scroll lock, and focus on open.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") onIndexChange((i) => (i + 1) % total);
      else if (event.key === "ArrowLeft") onIndexChange((i) => (i - 1 + total) % total);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    stageRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, onIndexChange, total]);

  // Warm the neighbours so paging feels instant.
  useEffect(() => {
    [index + 1, index - 1].forEach((i) => {
      const url = items[(i + total) % total]?.asset?.thumbnailUrl;
      if (url) {
        const img = new window.Image();
        img.src = url;
      }
    });
  }, [index, items, total]);

  // Keep the active filmstrip thumb in view.
  useEffect(() => {
    filmstripRef.current
      ?.querySelector(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  if (!asset) return null;

  const Icon = TYPE_ICONS[asset.type] || File;
  const favorited = favorites?.has(asset.id);
  const caption = current.caption || assetTitle(asset);
  const meta = [
    asset.format,
    asset.width && asset.height ? `${asset.width} × ${asset.height}` : "",
    asset.sizeBytes ? formatBytes(asset.sizeBytes) : "",
  ].filter(Boolean);
  const href = downloadHref?.(asset);
  const price = priceFor?.(asset) ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${caption} — ${index + 1} of ${total}`}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white backdrop-blur-sm animate-in fade-in duration-200"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-5">
        <span className="min-w-[4rem] text-sm tabular-nums text-white/60">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-1">
          {price && onBuy ? (
            <button
              type="button"
              onClick={() => onBuy(asset)}
              className="mr-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              {price}
            </button>
          ) : null}
          {onToggleFavorite ? (
            <IconButton
              label={favorited ? "Remove favorite" : "Add favorite"}
              pressed={favorited}
              onClick={() => onToggleFavorite(asset)}
            >
              <Heart className={cn("h-5 w-5", favorited && "fill-red-500 text-red-500")} />
            </IconButton>
          ) : null}
          {href ? (
            <IconButton label="Download" href={href} download onClick={() => onDownload?.(asset)}>
              <Download className="h-5 w-5" />
            </IconButton>
          ) : null}
          {onShare ? (
            <IconButton label="Share gallery" onClick={onShare}>
              <Share2 className="h-5 w-5" />
            </IconButton>
          ) : null}
          <span className="mx-1 h-5 w-px bg-white/15" aria-hidden="true" />
          <IconButton label="Close" onClick={onClose}>
            <X className="h-5 w-5" />
          </IconButton>
        </div>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        tabIndex={-1}
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 outline-none sm:px-16"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onTouchStart={(event) => {
          touchX.current = event.touches[0].clientX;
        }}
        onTouchEnd={(event) => {
          if (touchX.current == null) return;
          const dx = event.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > SWIPE_THRESHOLD) go(dx < 0 ? 1 : -1);
        }}
      >
        {asset.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={asset.id}
            src={asset.thumbnailUrl}
            alt={asset.name || ""}
            draggable={!protect}
            onContextMenu={protect ? (e) => e.preventDefault() : undefined}
            className="max-h-full max-w-full select-none object-contain shadow-2xl animate-in fade-in zoom-in-95 duration-300"
          />
        ) : (
          <div
            key={asset.id}
            className="flex aspect-[4/3] w-full max-w-xl items-center justify-center rounded-xl"
            style={{ background: `${asset.color || "#737373"}30` }}
          >
            <Icon className="h-10 w-10" style={{ color: asset.color || "#a3a3a3" }} />
          </div>
        )}

        {total > 1 ? (
          <>
            <IconButton
              label="Previous"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 bg-white/5 sm:flex"
            >
              <ChevronLeft className="h-6 w-6" />
            </IconButton>
            <IconButton
              label="Next"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 bg-white/5 sm:flex"
            >
              <ChevronRight className="h-6 w-6" />
            </IconButton>
          </>
        ) : null}
      </div>

      {/* Caption + filmstrip */}
      <div className="space-y-3 px-3 pb-4 pt-3 sm:px-5">
        <div className="text-center">
          <p className="truncate text-sm font-medium text-white/90">{caption}</p>
          {meta.length ? (
            <p className="mt-0.5 text-xs text-white/45">{meta.join("  ·  ")}</p>
          ) : null}
        </div>
        {total > 1 ? (
          <div
            ref={filmstripRef}
            className="mx-auto flex max-w-4xl gap-1.5 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map(({ asset: thumb, key }, i) => (
              <button
                key={key || thumb.id}
                type="button"
                data-index={i}
                onClick={() => onIndexChange(i)}
                aria-label={`Show ${thumb.name || `item ${i + 1}`}`}
                aria-current={i === index}
                className={cn(
                  "relative h-12 w-16 shrink-0 overflow-hidden rounded-md transition-all",
                  i === index ? "opacity-100 ring-2 ring-white" : "opacity-40 hover:opacity-80",
                )}
              >
                {thumb.miniThumbnailUrl || thumb.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb.miniThumbnailUrl || thumb.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="block h-full w-full" style={{ background: `${thumb.color || "#737373"}40` }} />
                )}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default GalleryLightbox;
