// Server-side reads for the public /g/<slug> page.
//
// Separate from lib/supabase/galleries.js (a "use client" module) because the
// public page must resolve access *before* rendering: a private gallery, an
// expired one, or one whose password hasn't been entered never has its contents
// sent to the browser at all.
//
// Server-only by construction: createServerSupabase() reads next/headers,
// which throws if this module is ever pulled into a client component.

import { createServerSupabase } from "./server";
import { PUBLIC_ASSET_COLUMNS, normalizeGallery, publicAsset } from "./gallery_shape";

const UNLOCK_PREFIX = "geiger_gallery_unlock_";

export function unlockCookieName(galleryId) {
  return `${UNLOCK_PREFIX}${galleryId}`;
}

function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

async function assetsSchema() {
  const sb = await createServerSupabase();
  return sb.schema("assets");
}

/** Resolve a gallery by its public slug. Returns null when there is no such row. */
export async function loadGalleryBySlug(slug) {
  if (!slug || !isConfigured()) return null;
  try {
    const sb = await assetsSchema();
    const { data, error } = await sb
      .from("galleries")
      .select("*")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[gallery_server.loadBySlug]", error.message);
      return null;
    }
    // The raw row carries password_hash; hand back only the normalized shape,
    // which exposes `hasPassword` and never the secret itself.
    return { gallery: normalizeGallery(data), passwordHash: data?.password_hash ?? "" };
  } catch (err) {
    console.error("[gallery_server.loadBySlug]", err?.message);
    return null;
  }
}

/**
 * The assets this gallery publishes, in render order. Collection-backed
 * galleries follow their collection; curated ones use their own item list and
 * drop anything marked hidden.
 */
export async function loadGalleryAssets(gallery) {
  if (!gallery || !isConfigured()) return [];
  try {
    const sb = await assetsSchema();

    if (gallery.sourceKind === "collection") {
      if (!gallery.collectionId) return [];
      const { data, error } = await sb
        .from("collection_assets")
        .select(`position, asset:asset_id(${PUBLIC_ASSET_COLUMNS})`)
        .eq("collection_id", gallery.collectionId)
        .order("position", { ascending: true });
      if (error) {
        console.error("[gallery_server.loadAssets]", error.message);
        return [];
      }
      return (data || [])
        .map((row) => ({ asset: publicAsset(row.asset), caption: "" }))
        .filter((row) => row.asset);
    }

    const { data, error } = await sb
      .from("gallery_items")
      .select(`id, caption, is_hidden, position, asset:asset_id(${PUBLIC_ASSET_COLUMNS})`)
      .eq("gallery_id", gallery.id)
      .is("deleted_at", null)
      .eq("is_hidden", false)
      .order("position", { ascending: true });
    if (error) {
      console.error("[gallery_server.loadAssets]", error.message);
      return [];
    }
    return (data || [])
      .map((row) => ({ key: row.id, asset: publicAsset(row.asset), caption: row.caption ?? "" }))
      .filter((row) => row.asset);
  } catch (err) {
    console.error("[gallery_server.loadAssets]", err?.message);
    return [];
  }
}

/**
 * The asset the hero shows: the chosen cover when set, otherwise the first
 * published item with a thumbnail. The cover may sit outside the item list, so
 * it is fetched on its own when it isn't already loaded.
 */
export async function loadGalleryCover(gallery, items = []) {
  if (!gallery) return null;
  const fromItems = (id) => items.find((row) => row.asset?.id === id)?.asset ?? null;
  const firstVisual = items.find((row) => row.asset?.thumbnailUrl)?.asset ?? null;
  if (!gallery.coverAssetId) return firstVisual;

  const loaded = fromItems(gallery.coverAssetId);
  if (loaded) return loaded;
  if (!isConfigured()) return firstVisual;
  try {
    const sb = await assetsSchema();
    const { data, error } = await sb
      .from("assets")
      .select(PUBLIC_ASSET_COLUMNS)
      .eq("id", gallery.coverAssetId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[gallery_server.loadCover]", error.message);
      return firstVisual;
    }
    return publicAsset(data) ?? firstVisual;
  } catch (err) {
    console.error("[gallery_server.loadCover]", err?.message);
    return firstVisual;
  }
}

/**
 * The storage row behind one asset this gallery publishes, or null when the
 * asset isn't part of it. Only the download route calls this, and only after
 * it has cleared the same access check the page runs.
 */
export async function loadGalleryDownload(gallery, assetId) {
  if (!gallery || !assetId || !isConfigured()) return null;
  const items = await loadGalleryAssets(gallery);
  if (!items.some((row) => row.asset?.id === assetId)) return null;
  try {
    const sb = await assetsSchema();
    const { data, error } = await sb
      .from("assets")
      .select("id,name,original_filename,mime_type,thumbnail_url,storage_key,pool_file_id,pool_url")
      .eq("id", assetId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[gallery_server.loadDownload]", error.message);
      return null;
    }
    return data ?? null;
  } catch (err) {
    console.error("[gallery_server.loadDownload]", err?.message);
    return null;
  }
}

/**
 * Why a visitor may not see this gallery, or null when they may.
 *
 * `unlocked` comes from the httpOnly cookie the unlock route sets, so a
 * password-gated gallery stays gated until the server has seen the password.
 */
export function accessProblem(gallery, { unlocked } = {}) {
  if (!gallery) return "missing";
  if (gallery.visibility === "private") return "private";
  if (gallery.status !== "published") return "unpublished";
  if (gallery.expired) return "expired";
  if (gallery.hasPassword && !unlocked) return "password";
  return null;
}

/** Server-side password compare. Plaintext today — see the migration's note. */
export function passwordMatches(passwordHash, attempt) {
  if (!passwordHash) return true;
  return String(attempt ?? "") === String(passwordHash);
}
