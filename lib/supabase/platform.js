"use client";

// Platform — owns assets.webhook_endpoints, assets.webhook_deliveries,
// assets.export_runs, assets.api_keys, assets.delivery_settings and
// assets.api_usage.
//
// A webhook signing secret and an API key secret are both shown once: the
// browser mints the secret, persists only the value (webhooks) or its sha256
// hash (API keys), and never reads it back.
// DB is snake_case, the UI is camelCase; the mapping happens here. Reads
// return null (no DB / failure) or [] (configured, empty); writes return the
// normalized row, or null/false on failure. Nothing here throws or toasts.

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

const ENDPOINTS = "webhook_endpoints";
const DELIVERIES = "webhook_deliveries";
const EXPORT_RUNS = "export_runs";
const KEYS = "api_keys";
const SETTINGS = "delivery_settings";
const USAGE = "api_usage";

// Webhook endpoints ------------------------------------------------------------

const ENDPOINT_MAP = {
  projectId: "project_id",
  name: "name",
  url: "url",
  description: "description",
  status: "status",
  signingSecret: "signing_secret",
  createdBy: "created_by",
};

export function normalizeWebhookEndpoint(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    url: row.url ?? "",
    description: row.description ?? "",
    events: Array.isArray(row.events) ? row.events : [],
    status: row.status ?? "active",
    signingSecret: row.signing_secret ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function endpointRow(input) {
  const row = toRowGeneric(input, ENDPOINT_MAP, { arrays: [] });
  if ("events" in input) row.events = Array.isArray(input.events) ? input.events : [];
  return row;
}

function mintSecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const listWebhookEndpoints = (projectId) =>
  listRows(ENDPOINTS, projectId).then((r) => (r ? r.map(normalizeWebhookEndpoint) : r));

export const getWebhookEndpoint = (id) => getRow(ENDPOINTS, id).then(normalizeWebhookEndpoint);

export async function createWebhookEndpoint(input) {
  const created = await createRow(
    ENDPOINTS,
    endpointRow({ ...input, signingSecret: input?.signingSecret || mintSecret() }),
  );
  return normalizeWebhookEndpoint(created);
}

export const updateWebhookEndpoint = (id, patch) =>
  updateRow(ENDPOINTS, id, endpointRow(patch)).then(normalizeWebhookEndpoint);

export const softDeleteWebhookEndpoint = (id) => softDeleteRow(ENDPOINTS, id);

/** Rotate the HMAC secret a receiver uses to verify payloads. Returns the new secret. */
export async function rotateWebhookSecret(id) {
  if (!id || !isSupabaseConfigured()) return null;
  const secret = mintSecret();
  const updated = await updateRow(ENDPOINTS, id, { signing_secret: secret });
  return updated ? secret : null;
}

// Webhook deliveries ------------------------------------------------------------

const DELIVERY_MAP = {
  projectId: "project_id",
  endpointId: "endpoint_id",
  event: "event",
  payload: "payload",
  status: "status",
  error: "error",
};

export function normalizeWebhookDelivery(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    endpointId: row.endpoint_id ?? null,
    event: row.event ?? "",
    payload: row.payload && typeof row.payload === "object" ? row.payload : {},
    status: row.status ?? "queued",
    attemptCount: Number(row.attempt_count ?? 0),
    responseCode: row.response_code ?? null,
    error: row.error ?? "",
    durationMs: row.duration_ms ?? null,
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

function deliveryRow(input) {
  const row = toRowGeneric(input, DELIVERY_MAP);
  if ("attemptCount" in input) row.attempt_count = Number(input.attemptCount) || 0;
  if ("responseCode" in input) row.response_code = input.responseCode ?? null;
  if ("durationMs" in input) row.duration_ms = input.durationMs ?? null;
  if (input.id) row.id = input.id;
  return row;
}

export const listWebhookDeliveries = (projectId) =>
  listRows(DELIVERIES, projectId, { order: "created_at" }).then((r) =>
    r ? r.map(normalizeWebhookDelivery) : r,
  );

export const createWebhookDelivery = (input) =>
  createRow(DELIVERIES, deliveryRow(input)).then(normalizeWebhookDelivery);

// Export runs ---------------------------------------------------------------------

const EXPORT_RUN_MAP = {
  projectId: "project_id",
  format: "format",
  scopeType: "scope_type",
  scopeId: "scope_id",
  scopeLabel: "scope_label",
  options: "options",
  status: "status",
  error: "error",
  createdBy: "created_by",
};

export function normalizeExportRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    format: row.format ?? "csv",
    scopeType: row.scope_type ?? "project",
    scopeId: row.scope_id ?? null,
    scopeLabel: row.scope_label ?? "",
    options: row.options && typeof row.options === "object" ? row.options : {},
    status: row.status ?? "completed",
    fileCount: Number(row.file_count ?? 0),
    totalBytes: Number(row.total_bytes ?? 0),
    error: row.error ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

function exportRunRow(input) {
  const row = toRowGeneric(input, EXPORT_RUN_MAP);
  if ("fileCount" in input) row.file_count = Number(input.fileCount) || 0;
  if ("totalBytes" in input) row.total_bytes = Number(input.totalBytes) || 0;
  if (input.id) row.id = input.id;
  return row;
}

export const listExportRuns = (projectId) =>
  listRows(EXPORT_RUNS, projectId, { order: "created_at" }).then((r) =>
    r ? r.map(normalizeExportRun) : r,
  );

export const createExportRun = (input) =>
  createRow(EXPORT_RUNS, exportRunRow(input)).then(normalizeExportRun);

// API keys ------------------------------------------------------------------

export function randomSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `gk_live_${b64}`;
}

export async function sha256Hex(secret) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(secret)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function keyPrefix(secret) {
  return String(secret || "").slice(0, 12);
}

const KEY_MAP = {
  projectId: "project_id",
  name: "name",
  prefix: "prefix",
  keyHash: "key_hash",
  createdBy: "created_by",
};

export function normalizeApiKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    prefix: row.prefix ?? "",
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    lastUsedAt: row.last_used_at ?? null,
    expiresAt: row.expires_at ?? null,
    revokedAt: row.revoked_at ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function keyRow(input) {
  const row = toRowGeneric(input, KEY_MAP, { arrays: [] });
  if ("scopes" in input) row.scopes = Array.isArray(input.scopes) ? input.scopes : [];
  if ("lastUsedAt" in input) row.last_used_at = input.lastUsedAt || null;
  if ("expiresAt" in input) row.expires_at = input.expiresAt || null;
  if ("revokedAt" in input) row.revoked_at = input.revokedAt || null;
  return row;
}

/** Mint a key: generates the secret, stores only its hash. Returns { key, secret }. */
export async function mintApiKey(input) {
  if (!isSupabaseConfigured()) return null;
  const secret = randomSecret();
  const hash = await sha256Hex(secret);
  const created = await createRow(
    KEYS,
    keyRow({ ...input, prefix: keyPrefix(secret), keyHash: hash }),
  );
  const key = normalizeApiKey(created);
  return key ? { key, secret } : null;
}

export const listApiKeys = (projectId) =>
  listRows(KEYS, projectId).then((r) => (r ? r.map(normalizeApiKey) : r));

export const getApiKey = (id) => getRow(KEYS, id).then(normalizeApiKey);

export const createApiKeyRecord = (input) =>
  createRow(KEYS, keyRow(input)).then(normalizeApiKey);

export const updateApiKey = (id, patch) =>
  updateRow(KEYS, id, keyRow(patch)).then(normalizeApiKey);

/** Rotate: mint a fresh secret for an existing key row. Returns { key, secret }. */
export async function rotateApiKey(id) {
  if (!id || !isSupabaseConfigured()) return null;
  const secret = randomSecret();
  const hash = await sha256Hex(secret);
  const updated = await updateRow(KEYS, id, { prefix: keyPrefix(secret), key_hash: hash, revoked_at: null });
  const key = normalizeApiKey(updated);
  return key ? { key, secret } : null;
}

export async function revokeApiKey(id) {
  if (!id || !isSupabaseConfigured()) return false;
  const updated = await updateRow(KEYS, id, { revoked_at: new Date().toISOString() });
  return Boolean(updated);
}

export const deleteApiKey = (id) => softDeleteRow(KEYS, id);

// Delivery settings -----------------------------------------------------------

const SETTINGS_MAP = {
  projectId: "project_id",
  createdBy: "created_by",
};

export function normalizeDeliverySettings(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    maxWidth: Number(row.max_width ?? 4000),
    maxHeight: Number(row.max_height ?? 4000),
    maxMegapixels: Number(row.max_megapixels ?? 25),
    allowedFormats: Array.isArray(row.allowed_formats) ? row.allowed_formats : ["auto", "webp", "avif", "jpg", "png"],
    allowedEffects: Array.isArray(row.allowed_effects) ? row.allowed_effects : [],
    referrerAllowlist: Array.isArray(row.referrer_allowlist) ? row.referrer_allowlist : [],
    monthlyTransformBudget: Number(row.monthly_transform_budget ?? 100000),
    requireSignedUrls: Boolean(row.require_signed_urls),
    signingSecret: row.signing_secret ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function settingsRow(input) {
  const row = toRowGeneric(input, SETTINGS_MAP);
  if ("maxWidth" in input) row.max_width = Number(input.maxWidth) || 4000;
  if ("maxHeight" in input) row.max_height = Number(input.maxHeight) || 4000;
  if ("maxMegapixels" in input) row.max_megapixels = Number(input.maxMegapixels) || 25;
  if ("allowedFormats" in input) row.allowed_formats = Array.isArray(input.allowedFormats) ? input.allowedFormats : [];
  if ("allowedEffects" in input) row.allowed_effects = Array.isArray(input.allowedEffects) ? input.allowedEffects : [];
  if ("referrerAllowlist" in input) row.referrer_allowlist = Array.isArray(input.referrerAllowlist) ? input.referrerAllowlist : [];
  if ("monthlyTransformBudget" in input) row.monthly_transform_budget = Number(input.monthlyTransformBudget) || 0;
  if ("requireSignedUrls" in input) row.require_signed_urls = Boolean(input.requireSignedUrls);
  if ("signingSecret" in input) row.signing_secret = input.signingSecret || "";
  return row;
}

export async function getDeliverySettings(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient()
      .from(SETTINGS)
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) {
      console.error("[platform.settings.get]", error.message);
      return null;
    }
    return normalizeDeliverySettings(data);
  } catch (err) {
    console.error("[platform.settings.get]", err?.message);
    return null;
  }
}

/** Upsert the single settings row for a project. */
export async function saveDeliverySettings(projectId, patch) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data: existing } = await sb.from(SETTINGS).select("id").eq("project_id", projectId).maybeSingle();
    if (existing?.id) {
      return updateRow(SETTINGS, existing.id, settingsRow(patch)).then(normalizeDeliverySettings);
    }
    return createRow(SETTINGS, settingsRow({ ...patch, projectId })).then(normalizeDeliverySettings);
  } catch (err) {
    console.error("[platform.settings.save]", err?.message);
    return null;
  }
}

// Usage -----------------------------------------------------------------------

export function normalizeUsage(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    apiKeyId: row.api_key_id ?? null,
    route: row.route ?? "",
    method: row.method ?? "",
    status: Number(row.status ?? 200),
    kind: row.kind ?? "api",
    assetId: row.asset_id ?? null,
    transforms: Number(row.transforms ?? 0),
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

export async function listUsage(projectId, { limit = 200 } = {}) {
  if (!isSupabaseConfigured()) return null;
  try {
    let query = assetsClient()
      .from(USAGE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(1000, Number(limit) || 200)));
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) {
      console.error("[platform.usage.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeUsage);
  } catch (err) {
    console.error("[platform.usage.list]", err?.message);
    return null;
  }
}

export async function countMonthTransforms(projectId) {
  if (!projectId || !isSupabaseConfigured()) return 0;
  try {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const { data, error } = await assetsClient()
      .from(USAGE)
      .select("transforms")
      .eq("project_id", projectId)
      .gte("created_at", start.toISOString());
    if (error) {
      console.error("[platform.usage.count]", error.message);
      return 0;
    }
    return (data || []).reduce((n, r) => n + (Number(r.transforms) || 0), 0);
  } catch (err) {
    console.error("[platform.usage.count]", err?.message);
    return 0;
  }
}
