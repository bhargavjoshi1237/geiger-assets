"use client";

// The "slideshow" layout on the public page: one asset on a large stage with
// prev/next, optional autoplay and a thumbnail rail. Clicking the stage opens
// the lightbox for a full-screen look.

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, File, Heart, Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import { TYPE_ICONS } from "@/components/internal/shared/asset_meta";
import { RADIUS_CLASS, groundTone, withThemeDefaults } from "../constants";
import { assetTitle } from "../galleries_kit";

const AUTOPLAY_MS = 5000;

function RoundButton({ label, onClick, className, children, pressed }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GallerySlideshow({ items, theme, favorites, onToggleFavorite, onOpen, protect = false }) {
  const t = withThemeDefaults(theme);
  const tone = groundTone(t);
  const radius = RADIUS_CLASS[t.radius] || RADIUS_CLASS.rounded;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const total = items.length;
  const safeIndex = Math.min(index, Math.max(total - 1, 0));
  const current = items[safeIndex];
  const asset = current?.asset;

  useEffect(() => {
    if (!playing || total < 2) return undefined;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % total), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [playing, total]);

  if (!asset) return null;

  const go = (delta) => setIndex((safeIndex + delta + total) % total);
  const Icon = TYPE_ICONS[asset.type] || File;
  const favorited = favorites?.has(asset.id);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Gallery slideshow"
      className="space-y-4"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(1);
        if (event.key === "ArrowLeft") go(-1);
      }}
    >
      <div
        className={cn("group relative overflow-hidden", radius, tone.stage)}
      >
        <button
          type="button"
          onClick={() => onOpen?.(asset)}
          aria-label={`Open ${asset.name || "asset"} full screen`}
          className="flex aspect-[16/10] max-h-[78svh] w-full items-center justify-center"
        >
          {asset.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={asset.id}
              src={asset.thumbnailUrl}
              alt={asset.name || ""}
              draggable={!protect}
              onContextMenu={protect ? (e) => e.preventDefault() : undefined}
              className="h-full w-full object-contain animate-in fade-in duration-500"
            />
          ) : (
            <Icon className="h-10 w-10" style={{ color: asset.color || "#737373" }} />
          )}
        </button>

        {total > 1 ? (
          <>
            <RoundButton label="Previous" onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2">
              <ChevronLeft className="h-5 w-5" />
            </RoundButton>
            <RoundButton label="Next" onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2">
              <ChevronRight className="h-5 w-5" />
            </RoundButton>
          </>
        ) : null}

        <div className="absolute right-3 top-3 flex gap-2">
          {onToggleFavorite ? (
            <RoundButton
              label={favorited ? "Remove favorite" : "Add favorite"}
              pressed={favorited}
              onClick={() => onToggleFavorite(asset)}
            >
              <Heart className={cn("h-4 w-4", favorited && "fill-red-500 text-red-500")} />
            </RoundButton>
          ) : null}
          <RoundButton label="Full screen" onClick={() => onOpen?.(asset)}>
            <Expand className="h-4 w-4" />
          </RoundButton>
        </div>

        {playing ? (
          <span
            key={`${asset.id}-progress`}
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-0.5 origin-left animate-[gallery-progress_linear_forwards]"
            style={{ background: t.accent, width: "100%", animationDuration: `${AUTOPLAY_MS}ms` }}
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{current.caption || assetTitle(asset)}</p>
          <p className={cn("text-xs tabular-nums", tone.subtle)}>
            {safeIndex + 1} of {total}
          </p>
        </div>
        {total > 1 ? (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
              tone.chip,
            )}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "Pause" : "Autoplay"}
          </button>
        ) : null}
      </div>

      {total > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map(({ asset: thumb, key }, i) => (
            <button
              key={key || thumb.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show ${thumb.name || `item ${i + 1}`}`}
              aria-current={i === safeIndex}
              className={cn(
                "h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 transition-opacity",
                i === safeIndex ? "opacity-100" : "border-transparent opacity-50 hover:opacity-90",
              )}
              style={i === safeIndex ? { borderColor: t.accent } : undefined}
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
                <span className="block h-full w-full" style={{ background: `${thumb.color || "#737373"}30` }} />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default GallerySlideshow;
