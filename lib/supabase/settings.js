"use client";

// Data-access layer for project settings — owns `assets.project_settings`
// (one row per project) and `assets.custom_fields` (per-project metadata field
// definitions), plus the browser boundary for outbound webhooks.
//
// Webhooks need a note: endpoint CRUD and signed dispatch live server-side in
// lib/media/webhooks.js, which throws when imported in the browser (it signs
// and delivers to attacker-controlled URLs). The settings screens therefore
// never import it — the helpers at the bottom of this file reach the same code
// through `/api/webhooks/endpoints`, the way lib/storage/backends_client.js
// reaches the storage store. Same contract: validate, console.error on
// failure, return null/[]/false. Never throw, never toast — the screen owns UX.
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly.

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const SETTINGS_TABLE = "project_settings";
const FIELDS_TABLE = "custom_fields";

// basePath is "/assets" in production and "" in dev, so webhook URLs are built
// from it rather than hardcoding a leading slash.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function api(path) {
  return `${BASE}${path}`;
}

function metaOf(row) {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

// Defaults for the singleton. A project with no settings row yet renders these;
// the first successful save upserts a real row.
export const DEFAULT_PROJECT_SETTINGS = {
  name: "",
  description: "",
  slug: "",
  defaultLocale: "en",
  timezone: "UTC",
  defaultVisibility: "private",
  archivedAt: null,
  apiBaseUrl: "",
  cdnBaseUrl: "",
  services: {},
  addons: {},
  maxStoredBytes: 0,
  maxServedBytes: 0,
  retentionDays: 90,
  softDeleteWindowDays: 30,
  reconcileSchedule: "nightly",
  cacheTtlSeconds: 3600,
  staleWhileRevalidateSeconds: 86400,
  cdnEnabled: true,
  sessionTimeoutMinutes: 60,
  idleTimeoutMinutes: 15,
  require2fa: false,
  ipAllowlist: "",
  ssoEnabled: false,
  ssoProvider: "saml",
  ssoEntityId: "",
  ssoUrl: "",
  ssoCertificate: "",
  scimEnabled: false,
  scimToken: "",
  auditRetentionDays: 365,
  legalHold: false,
  legalHoldNote: "",
  contractTier: "growth",
};

// Every camelCase settings key the import path accepts. Anything else in an
// imported file is dropped rather than written into the metadata bag.
export const SETTINGS_KEYS = Object.keys(DEFAULT_PROJECT_SETTINGS);

// Real columns on assets.project_settings; everything else in a patch folds
// into the metadata bag.
const COLUMN_MAP = {
  name: "name",
  description: "description",
  slug: "slug",
  defaultLocale: "default_locale",
  timezone: "timezone",
  defaultVisibility: "default_visibility",
  archivedAt: "archived_at",
};

const NUMERIC_KEYS = new Set([
  "maxStoredBytes",
  "maxServedBytes",
  "retentionDays",
  "softDeleteWindowDays",
  "cacheTtlSeconds",
  "staleWhileRevalidateSeconds",
  "sessionTimeoutMinutes",
  "idleTimeoutMinutes",
  "auditRetentionDays",
]);

const BOOLEAN_KEYS = new Set([
  "cdnEnabled",
  "require2fa",
  "ssoEnabled",
  "scimEnabled",
  "legalHold",
]);

function coerceValue(key, value) {
  if (NUMERIC_KEYS.has(key)) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  if (BOOLEAN_KEYS.has(key)) return Boolean(value);
  if (key === "services" || key === "addons") {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  if (key === "archivedAt") return value || null;
  return value ?? "";
}

export function normalizeProjectSettings(row) {
  if (!row) return null;
  const meta = metaOf(row);
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    ...DEFAULT_PROJECT_SETTINGS,
    name: row.name ?? "",
    description: row.description ?? "",
    slug: row.slug ?? "",
    defaultLocale: row.default_locale ?? "en",
    timezone: row.timezone ?? "UTC",
    defaultVisibility: row.default_visibility ?? "private",
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta,
  };
}

// camelCase patch → snake_case row. Emits a column only when its key is
// present in `input`; any other present key folds into `metadata` so one
// update serves a whole-form save and a single-toggle flip alike.
function toSettingsRow(input) {
  const row = {};
  const bag = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "id" || key === "projectId" || key === "createdAt" || key === "updatedAt") continue;
    if (key in COLUMN_MAP) {
      row[COLUMN_MAP[key]] = key === "archivedAt" ? value || null : value;
    } else if (key === "metadata") {
      if (value && typeof value === "object") Object.assign(bag, value);
    } else {
      bag[key] = coerceValue(key, value);
    }
  }
  if (Object.keys(bag).length > 0) row.metadata = bag;
  return row;
}

export async function getProjectSettings(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(SETTINGS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[settings.get]", error.message);
      return null;
    }
    return normalizeProjectSettings(data);
  } catch (e) {
    console.error("[settings.get]", e);
    return null;
  }
}

// Upsert on project_id: the first save inserts, every later save updates.
// Metadata merges read-modify-write so a single-toggle flip never clobbers the
// rest of the bag. Returns the normalized row, `false` when the write failed,
// `null` when the DB is not configured.
export async function updateProjectSettings(projectId, patch) {
  if (!projectId || !patch || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data: current, error: readError } = await sb
      .from(SETTINGS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (readError) {
      console.error("[settings.update.read]", readError.message);
      return false;
    }
    const currentMeta = current ? metaOf(current) : {};
    const patchRow = toSettingsRow(patch);
    const patchMeta = patchRow.metadata || {};
    delete patchRow.metadata;
    const metadata = { ...currentMeta, ...patchMeta };
    // Column-mapped keys must never linger in the bag from an older write —
    // the columns are the source of truth for them.
    for (const key of Object.keys(COLUMN_MAP)) delete metadata[key];
    const payload = { ...patchRow, project_id: projectId, metadata, deleted_at: null };
    const { data, error } = await sb
      .from(SETTINGS_TABLE)
      .upsert(payload, { onConflict: "project_id" })
      .select("*")
      .single();
    if (error) {
      console.error("[settings.update]", error.message);
      return false;
    }
    return normalizeProjectSettings(data);
  } catch (e) {
    console.error("[settings.update]", e);
    return false;
  }
}

export async function archiveProject(projectId, archived = true) {
  if (!projectId) return false;
  const saved = await updateProjectSettings(projectId, {
    archivedAt: archived ? new Date().toISOString() : null,
  });
  return saved ? normalizeProjectSettings(saved) : false;
}

// Danger-zone reset: soft-deletes the settings row and every custom field, so
// the screens fall back to defaults and empty states. The suite project itself
// (public.projects) is untouched — this only removes Assets configuration.
export async function deleteProjectConfiguration(projectId) {
  if (!projectId || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const stamp = new Date().toISOString();
    const settingsRes = await sb
      .from(SETTINGS_TABLE)
      .update({ deleted_at: stamp })
      .eq("project_id", projectId)
      .is("deleted_at", null);
    if (settingsRes.error) {
      console.error("[settings.deleteProject]", settingsRes.error.message);
      return false;
    }
    const fieldsRes = await sb
      .from(FIELDS_TABLE)
      .update({ deleted_at: stamp })
      .eq("project_id", projectId)
      .is("deleted_at", null);
    if (fieldsRes.error) {
      console.error("[settings.deleteProject.fields]", fieldsRes.error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[settings.deleteProject]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Custom fields
// ---------------------------------------------------------------------------

const FIELD_MAP = {
  projectId: "project_id",
  name: "name",
  key: "key",
  type: "type",
  required: "required",
  defaultValue: "default_value",
  active: "active",
};

const FIELD_KEY_RE = /^[a-z][a-z0-9_]*$/;

export function normalizeCustomField(row) {
  if (!row) return null;
  const meta = metaOf(row);
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    key: row.key ?? "",
    type: row.type ?? "text",
    required: Boolean(row.required),
    defaultValue: row.default_value ?? "",
    options: Array.isArray(row.options) ? row.options : [],
    assetTypes: Array.isArray(row.asset_types) ? row.asset_types : [],
    position: Number(row.position ?? 0),
    active: row.active !== false,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta,
  };
}

function toFieldRow(input) {
  const row = {};
  for (const [key, col] of Object.entries(FIELD_MAP)) {
    if (key in input) row[col] = input[key];
  }
  if ("required" in input) row.required = Boolean(input.required);
  if ("active" in input) row.active = Boolean(input.active);
  if ("position" in input) row.position = Math.max(0, Math.floor(Number(input.position) || 0));
  if ("options" in input) row.options = Array.isArray(input.options) ? input.options : [];
  if ("assetTypes" in input) row.asset_types = Array.isArray(input.assetTypes) ? input.assetTypes : [];
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export async function listCustomFields(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(FIELDS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("position", { ascending: true });
    if (error) {
      console.error("[settings.fields.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeCustomField);
  } catch (e) {
    console.error("[settings.fields.list]", e);
    return null;
  }
}

export async function getCustomField(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(FIELDS_TABLE)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error("[settings.fields.get]", error.message);
      return null;
    }
    return normalizeCustomField(data);
  } catch (e) {
    console.error("[settings.fields.get]", e);
    return null;
  }
}

export async function createCustomField(input) {
  if (!input?.projectId || !input?.name?.trim() || !isSupabaseConfigured()) return null;
  const key = String(input.key || "").trim().toLowerCase();
  if (!FIELD_KEY_RE.test(key)) {
    console.error("[settings.fields.create] invalid key", input.key);
    return null;
  }
  try {
    const sb = assetsClient();
    const payload = { ...toFieldRow({ ...input, key }), project_id: input.projectId };
    if (input.id) payload.id = input.id; // honor optimistic UUID
    const { data, error } = await sb.from(FIELDS_TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[settings.fields.create]", error.message);
      return null;
    }
    return normalizeCustomField(data);
  } catch (e) {
    console.error("[settings.fields.create]", e);
    return null;
  }
}

export async function updateCustomField(id, patch) {
  if (!id || !patch || !isSupabaseConfigured()) return null;
  if (patch.key !== undefined && !FIELD_KEY_RE.test(String(patch.key).trim().toLowerCase())) {
    console.error("[settings.fields.update] invalid key", patch.key);
    return false;
  }
  try {
    const sb = assetsClient();
    const row = toFieldRow(patch);
    if (row.key !== undefined) row.key = String(row.key).trim().toLowerCase();
    const { data, error } = await sb
      .from(FIELDS_TABLE)
      .update(row)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[settings.fields.update]", error.message);
      return false;
    }
    return normalizeCustomField(data);
  } catch (e) {
    console.error("[settings.fields.update]", e);
    return false;
  }
}

export async function softDeleteCustomField(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(FIELDS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[settings.fields.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[settings.fields.delete]", e);
    return false;
  }
}

// Persists a manual order: `orderedIds` is the full ordered id list.
export async function reorderCustomFields(projectId, orderedIds) {
  if (!projectId || !Array.isArray(orderedIds) || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    for (let i = 0; i < orderedIds.length; i += 1) {
      const { error } = await sb
        .from(FIELDS_TABLE)
        .update({ position: i })
        .eq("id", orderedIds[i])
        .eq("project_id", projectId);
      if (error) {
        console.error("[settings.fields.reorder]", error.message);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error("[settings.fields.reorder]", e);
    return false;
  }
}

// Replaces a project's whole field set — the import path in Advanced. Invalid
// rows are skipped, never stored.
export async function replaceCustomFields(projectId, fields) {
  if (!projectId || !Array.isArray(fields) || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const stamp = new Date().toISOString();
    const cleared = await sb
      .from(FIELDS_TABLE)
      .update({ deleted_at: stamp })
      .eq("project_id", projectId)
      .is("deleted_at", null);
    if (cleared.error) {
      console.error("[settings.fields.replace.clear]", cleared.error.message);
      return false;
    }
    const created = [];
    for (let i = 0; i < fields.length; i += 1) {
      const f = fields[i] || {};
      if (!f.name || !f.key || !FIELD_KEY_RE.test(String(f.key).trim().toLowerCase())) continue;
      const row = await createCustomField({
        projectId,
        name: String(f.name),
        key: String(f.key).trim().toLowerCase(),
        type: f.type || "text",
        required: Boolean(f.required),
        defaultValue: f.defaultValue ?? "",
        options: Array.isArray(f.options) ? f.options : [],
        assetTypes: Array.isArray(f.assetTypes) ? f.assetTypes : [],
        position: i,
        active: f.active !== false,
      });
      if (row) created.push(row);
    }
    return created;
  } catch (e) {
    console.error("[settings.fields.replace]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Outbound webhooks (browser boundary over /api/webhooks/endpoints)
// ---------------------------------------------------------------------------

export function normalizeWebhookEndpoint(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? row.projectId ?? null,
    url: row.url ?? "",
    events: Array.isArray(row.events) ? [...row.events] : [],
    active: row.active !== false,
    createdAt: row.created_at ?? row.createdAt ?? "",
    updatedAt: row.updated_at ?? row.updatedAt ?? "",
  };
}

async function webhookRequest(path, { method = "GET", body } = {}) {
  try {
    const res = await fetch(api(path), {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    if (!res.ok) {
      console.error("[settings.webhooks]", method, path, payload?.error || res.status);
      return null;
    }
    return payload ?? {};
  } catch (e) {
    console.error("[settings.webhooks]", method, path, e);
    return null;
  }
}

export async function listWebhookEndpoints(projectId) {
  if (!projectId) return null;
  const payload = await webhookRequest(
    `/api/webhooks/endpoints?projectId=${encodeURIComponent(projectId)}`,
  );
  if (!payload) return null;
  const rows = Array.isArray(payload.endpoints) ? payload.endpoints : [];
  return rows.map(normalizeWebhookEndpoint).filter(Boolean);
}

export async function createWebhookEndpoint(input) {
  if (!input?.projectId || !input?.url || !Array.isArray(input.events) || input.events.length === 0) {
    return null;
  }
  const payload = await webhookRequest("/api/webhooks/endpoints", {
    method: "POST",
    body: {
      projectId: input.projectId,
      url: input.url,
      events: input.events,
      active: input.active !== false,
    },
  });
  if (!payload?.endpoint) return null;
  const pub = normalizeWebhookEndpoint(payload.endpoint);
  if (!pub) return null;
  // The secret is returned once, at create time, and never on reads.
  return { ...pub, secret: payload.endpoint.secret ?? null };
}

export async function updateWebhookEndpoint(id, patch) {
  if (!id || !patch) return null;
  const payload = await webhookRequest(`/api/webhooks/endpoints/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
  if (!payload?.endpoint) return null;
  return normalizeWebhookEndpoint(payload.endpoint);
}

export async function deleteWebhookEndpoint(id) {
  if (!id) return false;
  const payload = await webhookRequest(`/api/webhooks/endpoints/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return Boolean(payload?.ok);
}
