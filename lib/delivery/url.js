"use client";

// Public delivery URLs for an asset — the `/d/<project>/<asset>/[transform]/<file>`
// route. This is the only link that should ever be handed out for an asset: the
// workspace deep link is auth-gated, and a provider's own URL bypasses the
// delivery policy and breaks when the object is migrated between providers.

import { appOrigin } from "@/lib/share";

export function filenameFor(asset) {
  const fallback = asset?.originalFilename || asset?.name || "image.jpg";
  return String(fallback).split("/").pop() || "image.jpg";
}

// Path only (already basePath-prefixed by appOrigin on the absolute form).
export function deliveryPath(asset, transform = "") {
  if (!asset?.projectId || !asset?.id) return "";
  const step = transform ? `${transform}/` : "";
  return `/d/${asset.projectId}/${asset.id}/${step}${filenameFor(asset)}`;
}

export function deliveryUrl(asset, transform = "") {
  const path = deliveryPath(asset, transform);
  return path ? `${appOrigin()}${path}` : "";
}
