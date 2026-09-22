"use client";

// Galleries — owns assets.galleries, assets.gallery_items and
// assets.gallery_domains.
//
// A gallery is a persistent branded page at a chosen slug. It is deliberately
// not assets.share_links (transient delivery keyed by a random token), so the
// overlapping access fields live here too.
//
// DB is snake_case, the UI is camelCase; the mapping happens here. Reads return
// null (no DB / failure) or [] (configured, empty); writes return the normalized
// row, or null/false on failure. Nothing here throws or toasts.

import {
  createRow,
  createRows,
  dateOrNull,
  getRow,
  listRows,
  meta,
  softDeleteRow,
  toRowGeneric,
  updateRow,
} from "./row_helpers";
import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";
import { normalizeGallery, normalizeGalleryItem, slugify } from "./gallery_shape";

// Re-exported so screens keep importing the gallery surface from one place.
export { normalizeGallery, normalizeGalleryItem, slugify };

const GALLERIES = "galleries";
const ITEMS = "gallery_items";
const DOMAINS = "gallery_domains";

// Galleries -------------------------------------------------------------------

const GALLERY_MAP = {
  projectId: "project_id",
  slug: "slug",
  name: "name",
  headline: "headline",
  description: "description",
  sourceKind: "source_kind",
  collectionId: "collection_id",
  coverAssetId: "cover_asset_id",
  layout: "layout",
  theme: "theme",
  nav: "nav",
  visibility: "visibility",
  password: "password_hash",
  requireEmail: "require_email",
  downloadMode: "download_mode",
  allowFavorites: "allow_favorites",
  seo: "seo",
  status: "status",
  createdBy: "created_by",
};

function galleryRow(input) {
  const row = toRowGeneric(input, GALLERY_MAP);
  if ("expiresAt" in input) row.expires_at = dateOrNull(input.expiresAt);
  if ("publishedAt" in input) row.published_at = dateOrNull(input.publishedAt);
  return row;
}

export const listGalleries = (projectId) =>
  listRows(GALLERIES, projectId).then((r) => (r ? r.map(normalizeGallery) : r));

export const getGallery = (id) => getRow(GALLERIES, id).then(normalizeGallery);

export const createGallery = (input) =>
  createRow(GALLERIES, galleryRow(input)).then(normalizeGallery);

export const updateGallery = (id, patch) =>
  updateRow(GALLERIES, id, galleryRow(patch)).then(normalizeGallery);

export const deleteGallery = (id) => softDeleteRow(GALLERIES, id);

/**
 * Resolve a gallery by its public slug. Used by the /g/<slug> route, so it
 * intentionally does not filter on project — the slug is the public identity.
 */
export async function getGalleryBySlug(slug) {
  if (!slug || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient()
      .from(GALLERIES)
      .select("*")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[galleries.getBySlug]", error.message);
      return null;
    }
    return normalizeGallery(data);
  } catch (err) {
    console.error("[galleries.getBySlug]", err?.message);
    return null;
  }
}

/**
 * Free slug derived from `name`, avoiding the slugs already taken in this
 * project. Falls back to a numeric suffix.
 */
export function uniqueSlug(name, taken, currentId = null) {
  const base = slugify(name) || "gallery";
  const used = new Set(
    (taken || [])
      .filter((g) => g.id !== currentId)
      .map((g) => g.slug)
      .filter(Boolean),
  );
  if (!used.has(base)) return base;
  for (let n = 2; n < 500; n += 1) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// Gallery items ----------------------------------------------------------------

const ITEM_MAP = {
  projectId: "project_id",
  galleryId: "gallery_id",
  assetId: "asset_id",
  position: "position",
  caption: "caption",
  isHidden: "is_hidden",
  createdBy: "created_by",
};

export const listGalleryItems = (galleryId) =>
  listRows(ITEMS, null, { order: "position", ascending: true, match: { gallery_id: galleryId } })
    .then((r) => (r ? r.map(normalizeGalleryItem) : r));

export const createGalleryItem = (input) =>
  createRow(ITEMS, toRowGeneric(input, ITEM_MAP, { numerics: ["position"] })).then(
    normalizeGalleryItem,
  );

export const createGalleryItems = (inputs) =>
  createRows(
    ITEMS,
    (inputs || []).map((i) => toRowGeneric(i, ITEM_MAP, { numerics: ["position"] })),
  ).then((r) => (r ? r.map(normalizeGalleryItem) : r));

export const updateGalleryItem = (id, patch) =>
  updateRow(ITEMS, id, toRowGeneric(patch, ITEM_MAP, { numerics: ["position"] })).then(
    normalizeGalleryItem,
  );

export const deleteGalleryItem = (id) => softDeleteRow(ITEMS, id);

/** Persist a whole reordering in one pass. Returns false if any write failed. */
export async function reorderGalleryItems(ordered) {
  const results = await Promise.all(
    (ordered || []).map((item, index) =>
      item.position === index ? true : updateGalleryItem(item.id, { position: index }),
    ),
  );
  return results.every(Boolean);
}

// Domains ----------------------------------------------------------------------

const DOMAIN_MAP = {
  projectId: "project_id",
  galleryId: "gallery_id",
  hostname: "hostname",
  kind: "kind",
  verificationToken: "verification_token",
  dnsRecordType: "dns_record_type",
  dnsRecordName: "dns_record_name",
  dnsRecordValue: "dns_record_value",
  status: "status",
  sslStatus: "ssl_status",
  isPrimary: "is_primary",
  createdBy: "created_by",
};

export function normalizeGalleryDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    galleryId: row.gallery_id ?? null,
    hostname: row.hostname ?? "",
    kind: row.kind ?? "subdomain",
    verificationToken: row.verification_token ?? "",
    dnsRecordType: row.dns_record_type ?? "TXT",
    dnsRecordName: row.dns_record_name ?? "",
    dnsRecordValue: row.dns_record_value ?? "",
    status: row.status ?? "pending",
    sslStatus: row.ssl_status ?? "none",
    isPrimary: Boolean(row.is_primary),
    verifiedAt: row.verified_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function domainRow(input) {
  const row = toRowGeneric(input, DOMAIN_MAP);
  if ("verifiedAt" in input) row.verified_at = dateOrNull(input.verifiedAt);
  return row;
}

/** The TXT record a customer must publish to prove they control the hostname. */
export function mintVerification(hostname) {
  const token = `geiger-verify-${Math.random().toString(36).slice(2, 12)}`;
  return {
    verificationToken: token,
    dnsRecordType: "TXT",
    dnsRecordName: `_geiger.${hostname}`,
    dnsRecordValue: token,
  };
}

export const listGalleryDomains = (projectId) =>
  listRows(DOMAINS, projectId).then((r) => (r ? r.map(normalizeGalleryDomain) : r));

export const createGalleryDomain = (input) =>
  createRow(DOMAINS, domainRow(input)).then(normalizeGalleryDomain);

export const updateGalleryDomain = (id, patch) =>
  updateRow(DOMAINS, id, domainRow(patch)).then(normalizeGalleryDomain);

export const deleteGalleryDomain = (id) => softDeleteRow(DOMAINS, id);
