if (typeof window !== "undefined") {
  throw new Error("lib/media/variants is server-only — it reads originals and writes derivatives.");
}

// Derivative resolution: (asset, variant, format) -> a stored object key.
//
// This is the seam every delivery route sits on. Commit-time fan-out only ever
// produces WebP (see lib/media/derive.js for the measured reason), so any other
// format a client negotiates has to be produced the first time it is asked for.
// resolveVariant() hides that difference: callers get a key back either way and
// never learn whether it was a cache hit.
//
// The manifest lives in assets.metadata.derivatives, keyed "<variant>.<ext>".
// That is the documented expansion bag from SUPABASE_CONVENTIONS — derivatives
// are regenerable cache state, not something that needs its own table, indexes
// or RLS. Promote it if that ever stops being true.

import { deriveVariant, variantSpec, DERIVE_FORMATS, VARIANTS } from "@/lib/media/derive";
import { derivativeKey } from "@/lib/s3/keys";
import { getObjectStream, putObject, headObject } from "@/lib/s3/objects";
import { createServerSupabase } from "@/lib/supabase/server";

export const MANIFEST_KEY = "derivatives";

// Ordered best-first: what a delivery route may offer to Accept negotiation.
// AVIF leads because when a client takes it the bytes are materially smaller;
// WebP is the floor every target browser decodes.
export const DELIVERABLE_FORMATS = Object.freeze(["avif", "webp"]);
export const DEFAULT_FORMAT = "webp";

// Originals above this are served as-is rather than derived: the bytes must be
// buffered in memory to reach sharp, so this bounds one request's working set.
// Kept at derive.js's own input ceiling so the two cannot disagree.
const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

export function isVariantName(name) {
  return Boolean(variantSpec(name));
}

export function variantNames() {
  return Object.keys(VARIANTS);
}

export function isDeliverableFormat(format) {
  return typeof format === "string" && Object.hasOwn(DERIVE_FORMATS, format.trim().toLowerCase());
}

function manifestSlot(variant, ext) {
  return `${variant}.${ext}`;
}

// Reads the manifest defensively: metadata is a free-form jsonb bag that older
// rows predate entirely, so anything unexpected reads as "no derivatives".
export function readManifest(row) {
  const meta = row?.metadata;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const bag = meta[MANIFEST_KEY];
  if (!bag || typeof bag !== "object" || Array.isArray(bag)) return {};
  return bag;
}

export function manifestEntry(row, variant, format) {
  const fmt = DERIVE_FORMATS[String(format || DEFAULT_FORMAT).toLowerCase()];
  if (!fmt) return null;
  const entry = readManifest(row)[manifestSlot(variant, fmt.ext)];
  if (!entry || typeof entry !== "object" || typeof entry.key !== "string" || !entry.key) return null;
  return entry;
}

// Merges into metadata.derivatives through an RPC rather than a read-modify-write
// so two derivations racing on the same asset cannot clobber each other's slot.
export async function persistDerivatives(assetId, entries, { thumbnailUrl } = {}) {
  if (!assetId || !entries || Object.keys(entries).length === 0) return false;
  try {
    const sb = await createServerSupabase();
    const { error } = await sb.schema("assets").rpc("asset_merge_derivatives", {
      p_asset_id: assetId,
      p_patch: entries,
      p_thumbnail_url: thumbnailUrl ?? null,
    });
    if (error) {
      console.error("[media.variants.persist]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[media.variants.persist]", e?.message || e);
    return false;
  }
}

// Buffers an object, refusing anything past the ceiling. Returns null rather
// than throwing so every caller can treat "too big" and "gone" identically.
async function readOriginal(key) {
  try {
    const head = await headObject(key);
    if (!head) return null;
    if (Number(head.size) > MAX_ORIGINAL_BYTES) return null;
    const got = await getObjectStream(key);
    if (!got?.body) return null;
    const chunks = [];
    let total = 0;
    for await (const chunk of got.body) {
      total += chunk.length;
      // The HEAD above is advisory; a lying or changed length must not be able
      // to grow this buffer without bound.
      if (total > MAX_ORIGINAL_BYTES) return null;
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch (e) {
    console.error("[media.variants.read]", e?.message || e);
    return null;
  }
}

export function derivativeEntry({ key, contentType, ext, width, height, bytes }) {
  return {
    key,
    contentType,
    ext,
    width: width ?? null,
    height: height ?? null,
    bytes: bytes ?? null,
    createdAt: new Date().toISOString(),
  };
}

// Derives every configured variant in one pass over the original and stores
// them. Used by the commit path, where the bytes are already in hand — pass
// them in rather than making this re-read what the caller just uploaded.
export async function buildDerivatives({ projectId, assetId, buffer, contentType, filename, variants, format } = {}) {
  if (!projectId || !assetId || !buffer) return {};
  const { deriveAll } = await import("@/lib/media/derive");
  const produced = await deriveAll(buffer, { contentType, filename, variants, format });
  const entries = {};
  for (const [name, d] of Object.entries(produced)) {
    const key = derivativeKey({ projectId, assetId, variant: name, ext: d.ext });
    const stored = await putObject({
      key,
      body: d.bytes,
      contentType: d.contentType,
      // Derivatives are content-addressed by (asset, variant, format) and are
      // rewritten rather than mutated, so they are safe to cache hard.
      cacheControl: "public, max-age=31536000, immutable",
    });
    if (!stored) continue;
    entries[manifestSlot(name, d.ext)] = derivativeEntry({
      key,
      contentType: d.contentType,
      ext: d.ext,
      width: d.width,
      height: d.height,
      bytes: d.bytes.length,
    });
  }
  return entries;
}

// The delivery seam. Returns { key, contentType, width, height, cached } for a
// servable derivative, or null when this asset cannot produce one (non-raster
// original, oversized, missing bytes) — the caller then falls back to serving
// the original, which is always correct if not always small.
export async function resolveVariant({ row, variant, format } = {}) {
  try {
    if (!row?.id || !row?.storage_key) return null;
    if (!isVariantName(variant)) return null;
    const fmtName = isDeliverableFormat(format) ? String(format).toLowerCase() : DEFAULT_FORMAT;

    const existing = manifestEntry(row, variant, fmtName);
    if (existing) {
      // Trust the manifest without a HEAD. A swept or missing object costs one
      // 404 on the stream that follows; verifying every hit would add a
      // round-trip to the hot path to protect against a rare case.
      return { ...existing, cached: true };
    }

    const projectId = row.project_id;
    if (!projectId) return null;

    const original = await readOriginal(row.storage_key);
    if (!original) return null;

    const d = await deriveVariant(original, variant, {
      contentType: row.mime_type || "",
      filename: row.original_filename || "",
      format: fmtName,
    });
    if (!d) return null;

    const key = derivativeKey({ projectId, assetId: row.id, variant, ext: d.ext });
    const stored = await putObject({
      key,
      body: d.bytes,
      contentType: d.contentType,
      cacheControl: "public, max-age=31536000, immutable",
    });
    if (!stored) return null;

    const entry = derivativeEntry({
      key,
      contentType: d.contentType,
      ext: d.ext,
      width: d.width,
      height: d.height,
      bytes: d.bytes.length,
    });
    // Best-effort: the bytes are already in the bucket, so a failed manifest
    // write costs a re-derive next time, never a broken response.
    await persistDerivatives(row.id, { [manifestSlot(variant, d.ext)]: entry });
    return { ...entry, cached: false };
  } catch (e) {
    console.error("[media.variants.resolve]", e?.message || e);
    return null;
  }
}
