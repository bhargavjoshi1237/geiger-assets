// Data-access layer for the Delivery domain — owns `assets.delivery_domains`,
// `assets.channel_destinations`, `assets.channel_exports`, `assets.share_links`
// and `assets.video_configs`, plus reads of the existing
// `assets.delivery_events` log for analytics.
//
// Anything already answered by lib/media/* stays there: variant manifests and
// transform resolution (lib/media/variants.js + transform.js), usage rollups
// and daily series (lib/media/usage.js), signed share tokens (lib/media/token.js
// — the token itself is never stored here), and the CDN seam
// (lib/storage/cdn.js). This module only persists what those modules do not.
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const DOMAINS_TABLE = "delivery_domains";
const DESTINATIONS_TABLE = "channel_destinations";
const EXPORTS_TABLE = "channel_exports";
const LINKS_TABLE = "share_links";
const VIDEO_TABLE = "video_configs";
const EVENTS_TABLE = "delivery_events";

function meta(row) {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function normalizeDeliveryDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    domain: row.domain ?? "",
    backendId: row.backend_id ?? null,
    isPrimary: Boolean(row.is_primary),
    verified: Boolean(row.verified),
    verifiedAt: row.verified_at ?? null,
    edgeTtlSeconds: Number(row.edge_ttl_seconds ?? 3600),
    originProtection: row.origin_protection !== false,
    lastPurgedAt: row.last_purged_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toDomainRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    domain: "domain",
    backendId: "backend_id",
    isPrimary: "is_primary",
    verified: "verified",
    originProtection: "origin_protection",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("verifiedAt" in input) row.verified_at = input.verifiedAt || null;
  if ("lastPurgedAt" in input) row.last_purged_at = input.lastPurgedAt || null;
  if ("edgeTtlSeconds" in input) {
    const n = Math.floor(Number(input.edgeTtlSeconds) || 0);
    row.edge_ttl_seconds = n < 0 ? 0 : n;
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function normalizeDestination(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    kind: row.kind ?? "cms",
    name: row.name ?? "",
    status: row.status ?? "connected",
    baseUrl: row.base_url ?? "",
    lastSyncAt: row.last_sync_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toDestinationRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    kind: "kind",
    name: "name",
    status: "status",
    baseUrl: "base_url",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("lastSyncAt" in input) row.last_sync_at = input.lastSyncAt || null;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function normalizeChannelExport(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    destinationId: row.destination_id ?? null,
    name: row.name ?? "",
    status: row.status ?? "draft",
    scheduledAt: row.scheduled_at ?? null,
    assetCount: Number(row.asset_count ?? 0),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toExportRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    destinationId: "destination_id",
    name: "name",
    status: "status",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("scheduledAt" in input) row.scheduled_at = input.scheduledAt || null;
  if ("assetCount" in input) {
    const n = Math.floor(Number(input.assetCount) || 0);
    row.asset_count = n < 0 ? 0 : n;
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function normalizeShareLink(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    assetId: row.asset_id ?? null,
    variant: row.variant ?? "original",
    scope: row.scope ?? "view",
    tokenPrefix: row.token_prefix ?? "",
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

function toShareLinkRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    assetId: "asset_id",
    variant: "variant",
    scope: "scope",
    tokenPrefix: "token_prefix",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("expiresAt" in input) row.expires_at = input.expiresAt || null;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function normalizeVideoConfig(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    assetId: row.asset_id ?? null,
    autoplay: Boolean(row.autoplay),
    muted: row.muted !== false,
    loopEnabled: Boolean(row.loop_enabled),
    showControls: row.show_controls !== false,
    posterVariant: row.poster_variant ?? "poster",
    captionsEnabled: Boolean(row.captions_enabled),
    captionsLanguage: row.captions_language ?? "en",
    signedUrls: Boolean(row.signed_urls),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toVideoConfigRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    assetId: "asset_id",
    autoplay: "autoplay",
    muted: "muted",
    loopEnabled: "loop_enabled",
    showControls: "show_controls",
    posterVariant: "poster_variant",
    captionsEnabled: "captions_enabled",
    captionsLanguage: "captions_language",
    signedUrls: "signed_urls",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function normalizeDeliveryEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    assetId: row.asset_id ?? null,
    variant: row.variant ?? "",
    bytesServed: Number(row.bytes_served ?? 0),
    servedAt: row.served_at ?? "",
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

// ---------------------------------------------------------------------------
// Generic helpers (same tri-state contract as the other area modules)
// ---------------------------------------------------------------------------

async function listRows(table, projectId, normalize, tag) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(table)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(`[delivery.${tag}.list]`, error.message);
      return null;
    }
    return (data || []).map(normalize);
  } catch (e) {
    console.error(`[delivery.${tag}.list]`, e);
    return null;
  }
}

async function createRow(table, input, normalize, tag) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.from(table).insert(input).select("*").single();
    if (error) {
      console.error(`[delivery.${tag}.create]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[delivery.${tag}.create]`, e);
    return null;
  }
}

async function updateRow(table, id, patch, normalize, tag) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(table)
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error(`[delivery.${tag}.update]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[delivery.${tag}.update]`, e);
    return null;
  }
}

async function softDeleteRow(table, id, tag) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error(`[delivery.${tag}.delete]`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[delivery.${tag}.delete]`, e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Delivery domains
// ---------------------------------------------------------------------------

export const listDeliveryDomains = (projectId) =>
  listRows(DOMAINS_TABLE, projectId, normalizeDeliveryDomain, "domains");

export function createDeliveryDomain(input) {
  if (!input?.projectId || !input?.domain) return Promise.resolve(null);
  const payload = toDomainRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(DOMAINS_TABLE, payload, normalizeDeliveryDomain, "domains");
}

export const updateDeliveryDomain = (id, patch) =>
  updateRow(DOMAINS_TABLE, id, toDomainRow(patch), normalizeDeliveryDomain, "domains");

export const softDeleteDeliveryDomain = (id) => softDeleteRow(DOMAINS_TABLE, id, "domains");

// ---------------------------------------------------------------------------
// Channel destinations
// ---------------------------------------------------------------------------

export const listDestinations = (projectId) =>
  listRows(DESTINATIONS_TABLE, projectId, normalizeDestination, "destinations");

export function createDestination(input) {
  if (!input?.projectId || !input?.name) return Promise.resolve(null);
  const payload = toDestinationRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(DESTINATIONS_TABLE, payload, normalizeDestination, "destinations");
}

export const updateDestination = (id, patch) =>
  updateRow(DESTINATIONS_TABLE, id, toDestinationRow(patch), normalizeDestination, "destinations");

export const softDeleteDestination = (id) => softDeleteRow(DESTINATIONS_TABLE, id, "destinations");

// ---------------------------------------------------------------------------
// Channel exports
// ---------------------------------------------------------------------------

export const listChannelExports = (projectId) =>
  listRows(EXPORTS_TABLE, projectId, normalizeChannelExport, "exports");

export function createChannelExport(input) {
  if (!input?.projectId || !input?.name) return Promise.resolve(null);
  const payload = toExportRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(EXPORTS_TABLE, payload, normalizeChannelExport, "exports");
}

export const updateChannelExport = (id, patch) =>
  updateRow(EXPORTS_TABLE, id, toExportRow(patch), normalizeChannelExport, "exports");

export const softDeleteChannelExport = (id) => softDeleteRow(EXPORTS_TABLE, id, "exports");

// ---------------------------------------------------------------------------
// Share links (minted-link ledger; the bearer token itself is never stored)
// ---------------------------------------------------------------------------

export const listShareLinks = (projectId) =>
  listRows(LINKS_TABLE, projectId, normalizeShareLink, "shareLinks");

export function createShareLink(input) {
  if (!input?.projectId || !input?.assetId) return Promise.resolve(null);
  const payload = toShareLinkRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(LINKS_TABLE, payload, normalizeShareLink, "shareLinks");
}

export const revokeShareLink = (id) => softDeleteRow(LINKS_TABLE, id, "shareLinks");

// ---------------------------------------------------------------------------
// Video configs (one row per asset)
// ---------------------------------------------------------------------------

export const listVideoConfigs = (projectId) =>
  listRows(VIDEO_TABLE, projectId, normalizeVideoConfig, "videoConfigs");

export function createVideoConfig(input) {
  if (!input?.projectId || !input?.assetId) return Promise.resolve(null);
  const payload = toVideoConfigRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(VIDEO_TABLE, payload, normalizeVideoConfig, "videoConfigs");
}

export const updateVideoConfig = (id, patch) =>
  updateRow(VIDEO_TABLE, id, toVideoConfigRow(patch), normalizeVideoConfig, "videoConfigs");

export const softDeleteVideoConfig = (id) => softDeleteRow(VIDEO_TABLE, id, "videoConfigs");

// ---------------------------------------------------------------------------
// Delivery events (read-only analytics over the existing metering log)
// ---------------------------------------------------------------------------

export async function listDeliveryEvents(projectId, { limit = 1000 } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const n = Number.isFinite(Number(limit))
      ? Math.min(Math.max(Math.floor(Number(limit)), 1), 5000)
      : 1000;
    const sb = assetsClient();
    const { data, error } = await sb
      .from(EVENTS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .order("served_at", { ascending: false })
      .limit(n);
    if (error) {
      console.error("[delivery.events.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeDeliveryEvent);
  } catch (e) {
    console.error("[delivery.events.list]", e);
    return null;
  }
}
