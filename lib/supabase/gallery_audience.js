"use client";

// Gallery audience — owns assets.gallery_visitors, assets.gallery_favorites,
// assets.gallery_download_requests and assets.gallery_events.
//
// Everything a gallery's public page produces. Events are stored raw rather
// than folded into counters so the Showcase screen can show trends, top assets
// and per-visitor proofing detail; the rollups at the bottom of this file are
// pure functions over the fetched rows.
//
// DB is snake_case, the UI is camelCase; the mapping happens here. Reads return
// null (no DB / failure) or [] (configured, empty); writes return the normalized
// row, or null/false on failure. Nothing here throws or toasts.

import {
  createRow,
  getRow,
  listRows,
  meta,
  softDeleteRow,
  toRowGeneric,
  updateRow,
} from "./row_helpers";
import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const VISITORS = "gallery_visitors";
const FAVORITES = "gallery_favorites";
const REQUESTS = "gallery_download_requests";
const EVENTS = "gallery_events";

// Visitors ---------------------------------------------------------------------

const VISITOR_MAP = {
  projectId: "project_id",
  galleryId: "gallery_id",
  token: "token",
  name: "name",
  email: "email",
};

export function normalizeVisitor(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    galleryId: row.gallery_id ?? null,
    token: row.token ?? "",
    name: row.name ?? "",
    email: row.email ?? "",
    firstSeenAt: row.first_seen_at ?? "",
    lastSeenAt: row.last_seen_at ?? "",
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

/** URL-safe anonymous browser identity, stored in localStorage by the public page. */
export function mintVisitorToken(length = 20) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  }
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export const listVisitors = (galleryId) =>
  listRows(VISITORS, null, { order: "last_seen_at", match: { gallery_id: galleryId } })
    .then((r) => (r ? r.map(normalizeVisitor) : r));

export const listProjectVisitors = (projectId) =>
  listRows(VISITORS, projectId, { order: "last_seen_at" })
    .then((r) => (r ? r.map(normalizeVisitor) : r));

/**
 * Find the visitor behind a browser token, creating the row on first sight and
 * touching `last_seen_at` on every later one.
 */
export async function resolveVisitor({ galleryId, token, projectId, name, email }) {
  if (!galleryId || !token || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient()
      .from(VISITORS)
      .select("*")
      .eq("gallery_id", galleryId)
      .eq("token", token)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[gallery_audience.resolveVisitor]", error.message);
      return null;
    }
    if (data) {
      const patch = { last_seen_at: new Date().toISOString() };
      if (name) patch.name = name;
      if (email) patch.email = email;
      return updateRow(VISITORS, data.id, patch).then(normalizeVisitor);
    }
    return createRow(
      VISITORS,
      toRowGeneric({ galleryId, token, projectId, name: name || "", email: email || null }, VISITOR_MAP),
    ).then(normalizeVisitor);
  } catch (err) {
    console.error("[gallery_audience.resolveVisitor]", err?.message);
    return null;
  }
}

export const getVisitor = (id) => getRow(VISITORS, id).then(normalizeVisitor);

export const updateVisitor = (id, patch) =>
  updateRow(VISITORS, id, toRowGeneric(patch, VISITOR_MAP)).then(normalizeVisitor);

// Favorites ---------------------------------------------------------------------

const FAVORITE_MAP = {
  projectId: "project_id",
  galleryId: "gallery_id",
  visitorId: "visitor_id",
  assetId: "asset_id",
};

export function normalizeFavorite(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    galleryId: row.gallery_id ?? null,
    visitorId: row.visitor_id ?? null,
    assetId: row.asset_id ?? null,
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

export const listFavorites = (galleryId) =>
  listRows(FAVORITES, null, { match: { gallery_id: galleryId } })
    .then((r) => (r ? r.map(normalizeFavorite) : r));

export const listProjectFavorites = (projectId) =>
  listRows(FAVORITES, projectId).then((r) => (r ? r.map(normalizeFavorite) : r));

export const addFavorite = (input) =>
  createRow(FAVORITES, toRowGeneric(input, FAVORITE_MAP)).then(normalizeFavorite);

export const removeFavorite = (id) => softDeleteRow(FAVORITES, id);

// Download requests ---------------------------------------------------------------

const REQUEST_MAP = {
  projectId: "project_id",
  galleryId: "gallery_id",
  visitorId: "visitor_id",
  scope: "scope",
  assetIds: "asset_ids",
  message: "message",
  status: "status",
  decisionNote: "decision_note",
  decidedBy: "decided_by",
};

export function normalizeDownloadRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    galleryId: row.gallery_id ?? null,
    visitorId: row.visitor_id ?? null,
    scope: row.scope ?? "gallery",
    assetIds: Array.isArray(row.asset_ids) ? row.asset_ids : [],
    message: row.message ?? "",
    status: row.status ?? "pending",
    decisionNote: row.decision_note ?? "",
    decidedBy: row.decided_by ?? null,
    decidedAt: row.decided_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

export const listDownloadRequests = (projectId) =>
  listRows(REQUESTS, projectId).then((r) => (r ? r.map(normalizeDownloadRequest) : r));

export const listGalleryDownloadRequests = (galleryId) =>
  listRows(REQUESTS, null, { match: { gallery_id: galleryId } })
    .then((r) => (r ? r.map(normalizeDownloadRequest) : r));

export const createDownloadRequest = (input) =>
  createRow(REQUESTS, toRowGeneric(input, REQUEST_MAP, { arrays: ["assetIds"] })).then(
    normalizeDownloadRequest,
  );

/** Approve or deny a request, stamping who decided and when. */
export const decideDownloadRequest = (id, status, { decidedBy, note } = {}) =>
  updateRow(REQUESTS, id, {
    status,
    decision_note: note || "",
    decided_by: decidedBy || null,
    decided_at: new Date().toISOString(),
  }).then(normalizeDownloadRequest);

export const deleteDownloadRequest = (id) => softDeleteRow(REQUESTS, id);

// Events --------------------------------------------------------------------------

const EVENT_MAP = {
  projectId: "project_id",
  galleryId: "gallery_id",
  visitorId: "visitor_id",
  assetId: "asset_id",
  kind: "kind",
};

export function normalizeGalleryEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    galleryId: row.gallery_id ?? null,
    visitorId: row.visitor_id ?? null,
    assetId: row.asset_id ?? null,
    kind: row.kind ?? "view",
    occurredAt: row.occurred_at ?? row.created_at ?? "",
    ...meta(row),
  };
}

export const listGalleryEvents = (projectId) =>
  listRows(EVENTS, projectId, { order: "occurred_at" })
    .then((r) => (r ? r.map(normalizeGalleryEvent) : r));

export const recordGalleryEvent = (input) =>
  createRow(EVENTS, toRowGeneric(input, EVENT_MAP)).then(normalizeGalleryEvent);

// Rollups -----------------------------------------------------------------------
// Pure functions over already-fetched event rows — no DB access, so screens can
// derive them inside a useMemo.

/** Per-gallery totals keyed by gallery id. */
export function rollUpByGallery(events) {
  const out = new Map();
  for (const event of events || []) {
    const bucket = out.get(event.galleryId) || {
      views: 0,
      itemViews: 0,
      favorites: 0,
      downloads: 0,
      requests: 0,
      visitors: new Set(),
    };
    if (event.kind === "view") bucket.views += 1;
    if (event.kind === "item_view") bucket.itemViews += 1;
    if (event.kind === "favorite") bucket.favorites += 1;
    if (event.kind === "download") bucket.downloads += 1;
    if (event.kind === "request") bucket.requests += 1;
    if (event.visitorId) bucket.visitors.add(event.visitorId);
    out.set(event.galleryId, bucket);
  }
  // Collapse the visitor set to a count so the result is plain data.
  return new Map(
    Array.from(out, ([id, b]) => [id, { ...b, visitors: b.visitors.size }]),
  );
}

/** Daily view counts over the trailing `days` window, oldest first. */
export function rollUpDaily(events, days = 30) {
  const buckets = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    buckets.set(day.toISOString().slice(0, 10), { date: day.toISOString().slice(0, 10), views: 0, favorites: 0, downloads: 0 });
  }
  for (const event of events || []) {
    const key = String(event.occurredAt).slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (event.kind === "view") bucket.views += 1;
    if (event.kind === "favorite") bucket.favorites += 1;
    if (event.kind === "download") bucket.downloads += 1;
  }
  return Array.from(buckets.values());
}

/** Most-engaged assets across the given events, richest first. */
export function rollUpTopAssets(events, limit = 8) {
  const out = new Map();
  for (const event of events || []) {
    if (!event.assetId) continue;
    const bucket = out.get(event.assetId) || { assetId: event.assetId, views: 0, favorites: 0, downloads: 0 };
    if (event.kind === "item_view") bucket.views += 1;
    if (event.kind === "favorite") bucket.favorites += 1;
    if (event.kind === "download") bucket.downloads += 1;
    out.set(event.assetId, bucket);
  }
  return Array.from(out.values())
    .map((b) => ({ ...b, score: b.views + b.favorites * 3 + b.downloads * 5 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
