"use client";

// Delivery — owns assets.delivery_events, assets.delivery_daily,
// assets.delivery_profiles, assets.delivery_domains and assets.delivery_keys.
//
// delivery_events is append-only (written fire-and-forget from the file
// routes); delivery_daily is maintained by a trigger and read here.
// Profiles, domains and keys are ordinary config records.
//
// DB is snake_case, the UI is camelCase; the mapping happens here. Reads return
// null (no DB / failure) or [] (configured, empty); writes return the normalized
// row, or null/false on failure. Nothing here throws or toasts.

import {
  createRow,
  dateOrNull,
  getRow,
  listRows,
  meta,
  softDeleteRow,
  toRowGeneric,
  updateRow,
} from "./row_helpers";
import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

// Events ----------------------------------------------------------------------

export function normalizeDeliveryEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    assetId: row.asset_id ?? null,
    linkId: row.link_id ?? null,
    embedId: row.embed_id ?? null,
    kind: row.kind ?? "file",
    bytes: Number(row.bytes ?? 0),
    cacheStatus: row.cache_status ?? "miss",
    statusCode: Number(row.status_code ?? 200),
    country: row.country ?? "",
    referrerHost: row.referrer_host ?? "",
    transform: row.transform && typeof row.transform === "object" ? row.transform : {},
    occurredAt: row.occurred_at ?? null,
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

const EVENT_MAP = {
  projectId: "project_id",
  assetId: "asset_id",
  linkId: "link_id",
  embedId: "embed_id",
  kind: "kind",
  cacheStatus: "cache_status",
  statusCode: "status_code",
  country: "country",
  referrerHost: "referrer_host",
  transform: "transform",
};

function eventRow(input) {
  const row = toRowGeneric(input, EVENT_MAP, { numerics: ["statusCode"] });
  if ("bytes" in input) row.bytes = Number(input.bytes) || 0;
  if ("assetId" in input) row.asset_id = input.assetId || null;
  if ("linkId" in input) row.link_id = input.linkId || null;
  if ("embedId" in input) row.embed_id = input.embedId || null;
  if ("occurredAt" in input) row.occurred_at = input.occurredAt || null;
  return row;
}

/** Recent serves, newest first. Best-effort read for analytics + embed counts. */
export async function listDeliveryEvents(projectId, { limit = 500 } = {}) {
  if (!isSupabaseConfigured()) return null;
  try {
    let q = assetsClient()
      .from("delivery_events")
      .select("*")
      .is("deleted_at", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q
      .order("occurred_at", { ascending: false })
      .limit(limit);
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

/** Fire-and-forget insert used by server routes; null when it did not land. */
export async function logDeliveryEvent(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient()
      .from("delivery_events")
      .insert(eventRow(input))
      .select("*")
      .single();
    if (error) {
      console.error("[delivery.events.log]", error.message);
      return null;
    }
    return normalizeDeliveryEvent(data);
  } catch (e) {
    console.error("[delivery.events.log]", e);
    return null;
  }
}

// Daily rollup ------------------------------------------------------------------

export function normalizeDeliveryDaily(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    day: row.day ?? "",
    assetId: row.asset_id ?? null,
    requests: Number(row.requests ?? 0),
    bytes: Number(row.bytes ?? 0),
    hits: Number(row.hits ?? 0),
    misses: Number(row.misses ?? 0),
    countries: row.countries && typeof row.countries === "object" ? row.countries : {},
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

export async function listDeliveryDaily(projectId) {
  if (!isSupabaseConfigured()) return null;
  try {
    let q = assetsClient().from("delivery_daily").select("*");
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("day", { ascending: false }).limit(1000);
    if (error) {
      console.error("[delivery.daily.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeDeliveryDaily);
  } catch (e) {
    console.error("[delivery.daily.list]", e);
    return null;
  }
}

// Profiles (edge config) ---------------------------------------------------------

const PROFILE_MAP = {
  projectId: "project_id",
  cacheTtlSeconds: "cache_ttl_seconds",
  originProtection: "origin_protection",
  allowedReferrers: "allowed_referrers",
  formatNegotiation: "format_negotiation",
  status: "status",
  createdBy: "created_by",
};

export function normalizeDeliveryProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    cacheTtlSeconds: Number(row.cache_ttl_seconds ?? 3600),
    originProtection: row.origin_protection ?? "open",
    allowedReferrers: Array.isArray(row.allowed_referrers) ? row.allowed_referrers : [],
    formatNegotiation: row.format_negotiation !== false,
    status: row.status ?? "active",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

const profileRow = (input) =>
  toRowGeneric(input, PROFILE_MAP, {
    numerics: ["cacheTtlSeconds"],
    arrays: ["allowedReferrers"],
  });

export const listDeliveryProfiles = (projectId) =>
  listRows("delivery_profiles", projectId).then((r) => (r ? r.map(normalizeDeliveryProfile) : r));

export const getDeliveryProfile = (id) =>
  getRow("delivery_profiles", id).then(normalizeDeliveryProfile);

export const createDeliveryProfile = (input) =>
  createRow("delivery_profiles", profileRow(input)).then(normalizeDeliveryProfile);

export const updateDeliveryProfile = (id, patch) =>
  updateRow("delivery_profiles", id, profileRow(patch)).then(normalizeDeliveryProfile);

export const softDeleteDeliveryProfile = (id) => softDeleteRow("delivery_profiles", id);

// Delivery domains (gallery verification flow, reused) ---------------------------

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

export function normalizeDeliveryDomain(row) {
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
  if ("galleryId" in input) row.gallery_id = input.galleryId || null;
  return row;
}

/** The TXT record a customer must publish to prove they control the hostname. */
export function mintDeliveryVerification(hostname) {
  const token = `geiger-verify-${Math.random().toString(36).slice(2, 12)}`;
  return {
    verificationToken: token,
    dnsRecordType: "TXT",
    dnsRecordName: `_geiger.${hostname}`,
    dnsRecordValue: token,
  };
}

export const listDeliveryDomains = (projectId) =>
  listRows("delivery_domains", projectId).then((r) => (r ? r.map(normalizeDeliveryDomain) : r));

export const getDeliveryDomain = (id) =>
  getRow("delivery_domains", id).then(normalizeDeliveryDomain);

export const createDeliveryDomain = (input) =>
  createRow("delivery_domains", domainRow(input)).then(normalizeDeliveryDomain);

export const updateDeliveryDomain = (id, patch) =>
  updateRow("delivery_domains", id, domainRow(patch)).then(normalizeDeliveryDomain);

export const softDeleteDeliveryDomain = (id) => softDeleteRow("delivery_domains", id);

// API keys ------------------------------------------------------------------------

const KEY_MAP = {
  projectId: "project_id",
  name: "name",
  prefix: "prefix",
  keyHash: "key_hash",
  scopes: "scopes",
  createdBy: "created_by",
};

export function normalizeDeliveryKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    prefix: row.prefix ?? "",
    keyHash: row.key_hash ?? "",
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    lastUsedAt: row.last_used_at ?? null,
    revokedAt: row.revoked_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function keyRow(input) {
  const row = toRowGeneric(input, KEY_MAP, { arrays: ["scopes"] });
  if ("lastUsedAt" in input) row.last_used_at = dateOrNull(input.lastUsedAt);
  if ("revokedAt" in input) row.revoked_at = dateOrNull(input.revokedAt);
  return row;
}

export const listDeliveryKeys = (projectId) =>
  listRows("delivery_keys", projectId).then((r) => (r ? r.map(normalizeDeliveryKey) : r));

export const getDeliveryKey = (id) => getRow("delivery_keys", id).then(normalizeDeliveryKey);

export const createDeliveryKey = (input) =>
  createRow("delivery_keys", keyRow(input)).then(normalizeDeliveryKey);

export const updateDeliveryKey = (id, patch) =>
  updateRow("delivery_keys", id, keyRow(patch)).then(normalizeDeliveryKey);

export const softDeleteDeliveryKey = (id) => softDeleteRow("delivery_keys", id);
