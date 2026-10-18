"use client";

import React, { useEffect, useState } from "react";
import { File } from "lucide-react";

import { TYPE_ICONS, DEFAULT_ASSET_COLOR } from "@/components/internal/shared/asset_meta";
import { listAssetThumbs } from "@/lib/supabase/assets";
import { cn } from "@/lib/utils";

// id -> asset (or null when it doesn't exist). Shared by every thumbnail on the
// page so a list of 50 rows costs one query, not 50.
const cache = new Map();
const waiters = new Map();
let queue = new Set();
let flushTimer = null;

function flush() {
  const ids = Array.from(queue);
  queue = new Set();
  flushTimer = null;
  listAssetThumbs(ids).then((rows) => {
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const id of ids) {
      const row = byId.get(id) ?? null;
      cache.set(id, row);
      for (const resolve of waiters.get(id) || []) resolve(row);
      waiters.delete(id);
    }
  });
}

function loadThumb(id) {
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  return new Promise((resolve) => {
    const list = waiters.get(id);
    if (list) list.push(resolve);
    else waiters.set(id, [resolve]);
    queue.add(id);
    // Collect every id requested in the same tick into one batch.
    if (!flushTimer) flushTimer = setTimeout(flush, 0);
  });
}

/** Resolves an asset by id (batched + cached); `undefined` while loading. */
export function useAssetThumb(assetId) {
  const [loaded, setLoaded] = useState(() =>
    assetId && cache.has(assetId) ? { id: assetId, asset: cache.get(assetId) } : null,
  );

  useEffect(() => {
    if (!assetId) return undefined;
    let alive = true;
    loadThumb(assetId).then((asset) => {
      if (alive) setLoaded({ id: assetId, asset });
    });
    return () => {
      alive = false;
    };
  }, [assetId]);

  return loaded?.id === assetId ? loaded.asset : undefined;
}

/** Best small image for an asset: the 96px list tile, then the 512px preview. */
export function thumbnailSrc(asset, { large = false } = {}) {
  if (!asset) return "";
  return large
    ? asset.thumbnailUrl || asset.miniThumbnailUrl || ""
    : asset.miniThumbnailUrl || asset.thumbnailUrl || "";
}

function ThumbImage({ asset, large, className, iconClassName, alt }) {
  const src = thumbnailSrc(asset, { large });
  const [failedSrc, setFailedSrc] = useState(null);
  const color = asset?.color || DEFAULT_ASSET_COLOR;

  if (src && failedSrc !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(src)}
        className={cn(
          "h-9 w-9 shrink-0 rounded-lg border border-border bg-surface-card object-cover",
          className,
        )}
      />
    );
  }

  const Icon = TYPE_ICONS[asset?.type] || File;
  return (
    <span
      aria-hidden={alt ? undefined : "true"}
      aria-label={alt || undefined}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
        className,
      )}
      style={{ background: `${color}15`, borderColor: `${color}25` }}
    >
      <Icon className={cn("h-4 w-4", iconClassName)} style={{ color }} />
    </span>
  );
}

function ThumbById({ assetId, ...rest }) {
  const asset = useAssetThumb(assetId);
  return <ThumbImage asset={asset} {...rest} />;
}

/**
 * The one asset thumbnail used across the app. Pass the `asset` you already
 * have, or just an `assetId` and it's looked up (batched, cached). Falls back
 * to the tinted type icon when there's no thumbnail or it fails to load.
 * Size it with `className` (default 36px square); `large` prefers the 512px
 * preview for bigger tiles.
 */
export function AssetThumbnail({ asset, assetId, large = false, className, iconClassName, alt }) {
  const props = { large, className, iconClassName, alt };
  if (asset) return <ThumbImage asset={asset} {...props} />;
  return <ThumbById assetId={assetId} {...props} />;
}

export default AssetThumbnail;
