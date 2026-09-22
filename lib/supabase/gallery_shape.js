// Pure snake_case -> camelCase mappers for the gallery tables.
//
// Deliberately free of a "use client" directive and of any Supabase client, so
// both the browser data layer (lib/supabase/galleries.js) and the server-side
// public-page loader (lib/supabase/gallery_server.js) can call these.

function meta(row) {
  return row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

/** Name -> url-safe slug. Not unique on its own; the caller dedupes. */
export function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function normalizeGallery(row) {
  if (!row) return null;
  const expired =
    row.expires_at && new Date(row.expires_at).getTime() < Date.now();
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    slug: row.slug ?? "",
    name: row.name ?? "",
    headline: row.headline ?? "",
    description: row.description ?? "",
    sourceKind: row.source_kind ?? "collection",
    collectionId: row.collection_id ?? null,
    coverAssetId: row.cover_asset_id ?? null,
    layout: row.layout ?? "grid",
    theme: row.theme && typeof row.theme === "object" ? row.theme : {},
    nav: Array.isArray(row.nav) ? row.nav : [],
    visibility: row.visibility ?? "private",
    // The password itself never leaves the data layer — only whether one is set.
    hasPassword: Boolean(row.password_hash),
    requireEmail: Boolean(row.require_email),
    downloadMode: row.download_mode ?? "off",
    allowFavorites: Boolean(row.allow_favorites),
    seo: row.seo && typeof row.seo === "object" ? row.seo : {},
    // A gallery past its expiry reads as unpublished even if the row still says published.
    status: expired && row.status === "published" ? "unpublished" : row.status ?? "draft",
    expired: Boolean(expired),
    publishedAt: row.published_at ?? null,
    expiresAt: row.expires_at ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

export function normalizeGalleryItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    galleryId: row.gallery_id ?? null,
    assetId: row.asset_id ?? null,
    position: Number(row.position ?? 0),
    caption: row.caption ?? "",
    isHidden: Boolean(row.is_hidden),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

/** The subset of an asset the public page needs — never the storage internals. */
export function publicAsset(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? "",
    type: row.type ?? "image",
    format: row.format ?? "",
    color: row.color ?? "#737373",
    thumbnailUrl: row.thumbnail_url ?? "",
  };
}
