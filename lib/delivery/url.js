"use client";

// Public delivery URLs for an asset — the `/d/<project>/<asset>/[transform]/<file>`
// route. This is the only link that should ever be handed out for an asset: the
// workspace deep link is auth-gated, and a provider's own URL bypasses the
// delivery policy and breaks when the object is migrated between providers.

import { appOrigin } from "@/lib/share";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function filenameFor(asset) {
  const fallback = asset?.originalFilename || asset?.name || "image.jpg";
  return String(fallback).split("/").pop() || "image.jpg";
}

// The canonical route path, without basePath. Not fetchable from the browser
// as-is in production — use deliveryHref or deliveryUrl for that.
export function deliveryPath(asset, transform = "") {
  if (!asset?.projectId || !asset?.id) return "";
  const step = transform ? `${transform}/` : "";
  return `/d/${asset.projectId}/${asset.id}/${step}${filenameFor(asset)}`;
}

// Browser-relative href for an <img>/<video> on a page of this app. The app is
// served under basePath in production, so a bare /d/... would resolve against
// the suite root and miss the rewrite into this deployment entirely.
export function deliveryHref(asset, transform = "") {
  const path = deliveryPath(asset, transform);
  return path ? `${BASE}${path}` : "";
}

// Absolute, shareable URL. appOrigin() already carries basePath, so the bare
// path is the right thing to append here.
export function deliveryUrl(asset, transform = "") {
  const path = deliveryPath(asset, transform);
  return path ? `${appOrigin()}${path}` : "";
}
