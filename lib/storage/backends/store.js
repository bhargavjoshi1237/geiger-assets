if (typeof window !== "undefined") {
  throw new Error("lib/storage/backends/store is server-only — it decrypts backend credentials.");
}

// Storage backends and pools for Geiger Assets.
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access:
// validate, console.error on failure, return null/[]/false. Never throw,
// never toast — the screen owns UX.
//
// Secret handling: configs are encrypted with encryptConfig() before they are
// written and only decrypted (decryptConfig) when a driver is constructed.
// Reads default to redactConfig() so an accidental call never leaks a key.

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";
import { decryptConfig, encryptConfig, isSecretField, redactConfig } from "./secrets.js";

const BACKENDS_TABLE = "storage_backends";
const POOLS_TABLE = "storage_pools";
const MEMBERS_TABLE = "storage_pool_members";

const BACKEND_KINDS = Object.freeze(["s3", "rest"]);
const POOL_STRATEGIES = Object.freeze(["failover", "spread", "mirror"]);

// Server routes construct drivers, where assetsClient() (the browser client)
// carries no session — callers hand in their own schema-scoped client.
// Screen-side reads omit it and are unchanged.
function clientFor(override) { return override || assetsClient(); }

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function normalizeBackend(row, opts = {}) {
  if (!row) return null;
  const includeSecrets = typeof opts === "boolean" ? opts : Boolean(opts && opts.includeSecrets);
  let config = {};
  try {
    const raw = row.config && typeof row.config === "object" ? row.config : {};
    config = includeSecrets ? decryptConfig(raw) : redactConfig(raw);
    if (!config || typeof config !== "object") config = {};
  } catch (e) {
    console.error("[storage.backends.normalize]", e);
    config = {};
  }
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    kind: row.kind ?? "",
    label: row.label ?? "",
    enabled: Boolean(row.enabled ?? true),
    config,
    maxUploadBytes: Number(row.max_upload_bytes ?? 0) || 0,
    healthOk: row.health_ok ?? null,
    healthDetail: row.health_detail ?? null,
    healthCheckedAt: row.health_checked_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

export function normalizeMember(row) {
  if (!row) return null;
  const backendId = row.backend_id ?? row.backendId ?? null;
  if (!backendId) return null;
  let priority = Math.floor(Number(row.priority ?? 100));
  if (!Number.isFinite(priority) || priority <= 0) priority = 100;
  let weight = Math.floor(Number(row.weight ?? 1));
  if (!Number.isFinite(weight) || weight <= 0) weight = 1;
  return {
    backendId,
    priority,
    weight,
    readOnly: Boolean(row.read_only ?? row.readOnly ?? false),
  };
}

export function normalizePool(row) {
  if (!row) return null;
  let rawMembers = [];
  if (Array.isArray(row.members)) rawMembers = row.members;
  else if (Array.isArray(row.storage_pool_members)) rawMembers = row.storage_pool_members;
  const members = rawMembers
    .map(normalizeMember)
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority);
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    strategy: row.strategy ?? "failover",
    enabled: Boolean(row.enabled ?? true),
    members,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

// Emits a column only when its key is present in the input, so one update
// serves both a full save and a single-field toggle. Config is encrypted by
// the caller and health is written via recordBackendHealth, so neither lives
// here.
function toRow(input) {
  const row = {};
  if (!input || typeof input !== "object") return row;
  if ("projectId" in input) row.project_id = input.projectId;
  if ("kind" in input) row.kind = input.kind;
  if ("label" in input) row.label = input.label;
  if ("enabled" in input) row.enabled = Boolean(input.enabled);
  if ("maxUploadBytes" in input) row.max_upload_bytes = Number(input.maxUploadBytes) || 0;
  return row;
}

function toPoolRow(input) {
  const row = {};
  if (!input || typeof input !== "object") return row;
  if ("projectId" in input) row.project_id = input.projectId;
  if ("name" in input) row.name = input.name;
  if ("strategy" in input) row.strategy = input.strategy;
  if ("enabled" in input) row.enabled = Boolean(input.enabled);
  return row;
}

// ---------------------------------------------------------------------------
// Backends
// ---------------------------------------------------------------------------

export async function listBackends({ projectId, includeSecrets = false, client } = {}) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = clientFor(client);
    let q = sb.from(BACKENDS_TABLE).select("*").is("deleted_at", null);
    if (projectId !== undefined) {
      q = projectId === null ? q.is("project_id", null) : q.eq("project_id", projectId);
    }
    const { data, error } = await q.order("created_at", { ascending: true });
    if (error) {
      console.error("[storage.backends.list]", error.message);
      return null;
    }
    return (data || []).map((row) => normalizeBackend(row, { includeSecrets }));
  } catch (e) {
    console.error("[storage.backends.list]", e);
    return null;
  }
}

export async function getBackend(id, { includeSecrets = false, client } = {}) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = clientFor(client);
    const { data, error } = await sb
      .from(BACKENDS_TABLE)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error("[storage.backends.get]", error.message);
      return null;
    }
    return normalizeBackend(data, { includeSecrets });
  } catch (e) {
    console.error("[storage.backends.get]", e);
    return null;
  }
}

export async function createBackend(input, { client } = {}) {
  if (!input || typeof input !== "object" || !isSupabaseConfigured()) return null;
  try {
    if (!BACKEND_KINDS.includes(input.kind)) {
      console.error("[storage.backends.create]", `invalid kind: ${input.kind}`);
      return null;
    }
    const rawConfig = input.config !== undefined ? input.config : {};
    if (rawConfig !== null && (typeof rawConfig !== "object" || Array.isArray(rawConfig))) {
      console.error("[storage.backends.create]", "config must be an object");
      return null;
    }
    const encrypted = encryptConfig(rawConfig || {});
    if (encrypted === null) {
      console.error(
        "[storage.backends.create]",
        "refusing to store a half-protected config (STORAGE_SECRET_KEY missing?)",
      );
      return null;
    }
    const sb = clientFor(client);
    const payload = { ...toRow(input), config: encrypted };
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(BACKENDS_TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[storage.backends.create]", error.message);
      return null;
    }
    return normalizeBackend(data);
  } catch (e) {
    console.error("[storage.backends.create]", e);
    return null;
  }
}

export async function updateBackend(id, patch = {}, { client } = {}) {
  if (!id || !patch || typeof patch !== "object" || !isSupabaseConfigured()) return null;
  try {
    if ("kind" in patch && !BACKEND_KINDS.includes(patch.kind)) {
      console.error("[storage.backends.update]", `invalid kind: ${patch.kind}`);
      return null;
    }
    const sb = clientFor(client);
    const row = toRow(patch);
    if ("config" in patch) {
      const incoming = patch.config;
      if (incoming !== null && (typeof incoming !== "object" || Array.isArray(incoming))) {
        console.error("[storage.backends.update]", "config must be an object");
        return null;
      }
      // Merge onto the stored config so an omitted secret keeps its value
      // instead of being blanked, then re-encrypt the whole bag.
      const current = await sb
        .from(BACKENDS_TABLE)
        .select("config")
        .eq("id", id)
        .is("deleted_at", null)
        .single();
      if (current.error || !current.data) {
        console.error("[storage.backends.update]", current.error ? current.error.message : "backend not found");
        return null;
      }
      const storedEnc =
        current.data.config && typeof current.data.config === "object" ? current.data.config : {};
      let storedPlain = {};
      try {
        storedPlain = decryptConfig(storedEnc) || {};
      } catch (e) {
        console.error("[storage.backends.update]", e);
        storedPlain = {};
      }
      if (!storedPlain || typeof storedPlain !== "object") storedPlain = {};
      // Presence flags from redacted reads are derived, never source — drop
      // them so they never persist alongside the real secrets.
      for (const k of Object.keys(storedPlain)) {
        if (k.endsWith("Set")) delete storedPlain[k];
      }
      const clean = {};
      for (const [k, v] of Object.entries(incoming || {})) {
        if (k.endsWith("Set")) continue;
        // A blank secret field means "unchanged" (a password input left
        // empty) — only an explicit value rotates the secret.
        if (isSecretField(k) && (v === "" || v === undefined)) continue;
        clean[k] = v;
      }
      const encrypted = encryptConfig({ ...storedPlain, ...clean });
      if (encrypted === null) {
        console.error(
          "[storage.backends.update]",
          "refusing to store a half-protected config (STORAGE_SECRET_KEY missing?)",
        );
        return null;
      }
      // A secret that failed to decrypt (rotation/tamper) decrypts to null —
      // keep its stored ciphertext rather than blanking it.
      for (const [k, v] of Object.entries(storedEnc)) {
        if (
          isSecretField(k) &&
          (encrypted[k] === null || encrypted[k] === undefined || encrypted[k] === "") &&
          v !== null &&
          v !== undefined &&
          v !== ""
        ) {
          encrypted[k] = v;
        }
      }
      row.config = encrypted;
    }
    if (Object.keys(row).length === 0) {
      return getBackend(id, { client });
    }
    const { data, error } = await sb
      .from(BACKENDS_TABLE)
      .update(row)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) {
      console.error("[storage.backends.update]", error.message);
      return null;
    }
    return normalizeBackend(data);
  } catch (e) {
    console.error("[storage.backends.update]", e);
    return null;
  }
}

export async function softDeleteBackend(id, { client } = {}) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = clientFor(client);
    const { error } = await sb
      .from(BACKENDS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[storage.backends.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[storage.backends.delete]", e);
    return false;
  }
}

export async function recordBackendHealth(id, health = {}, { client } = {}) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = clientFor(client);
    const src = health && typeof health === "object" ? health : {};
    const ok = src.ok ?? src.healthOk ?? null;
    const detail = src.detail ?? src.healthDetail ?? null;
    const { error } = await sb
      .from(BACKENDS_TABLE)
      .update({
        health_ok: ok === null || ok === undefined ? null : Boolean(ok),
        health_detail: detail === null || detail === undefined ? null : String(detail),
        health_checked_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      console.error("[storage.backends.health]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[storage.backends.health]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Pools
// ---------------------------------------------------------------------------

const POOL_MEMBERS_SELECT = "*, members:storage_pool_members(backend_id, priority, weight, read_only)";

export async function listPools({ projectId, client } = {}) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = clientFor(client);
    let q = sb.from(POOLS_TABLE).select(POOL_MEMBERS_SELECT).is("deleted_at", null);
    if (projectId !== undefined) {
      q = projectId === null ? q.is("project_id", null) : q.eq("project_id", projectId);
    }
    const { data, error } = await q.order("created_at", { ascending: true });
    if (error) {
      console.error("[storage.backends.pools.list]", error.message);
      return null;
    }
    return (data || []).map(normalizePool);
  } catch (e) {
    console.error("[storage.backends.pools.list]", e);
    return null;
  }
}

export async function getPool(id, { client } = {}) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = clientFor(client);
    const { data, error } = await sb
      .from(POOLS_TABLE)
      .select(POOL_MEMBERS_SELECT)
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error("[storage.backends.pools.get]", error.message);
      return null;
    }
    return normalizePool(data);
  } catch (e) {
    console.error("[storage.backends.pools.get]", e);
    return null;
  }
}

export async function createPool(input, { client } = {}) {
  if (!input || typeof input !== "object" || !isSupabaseConfigured()) return null;
  try {
    if (typeof input.name !== "string" || input.name.trim() === "") {
      console.error("[storage.backends.pools.create]", "name is required");
      return null;
    }
    const strategy = input.strategy === undefined ? "failover" : input.strategy;
    if (!POOL_STRATEGIES.includes(strategy)) {
      console.error("[storage.backends.pools.create]", `invalid strategy: ${strategy}`);
      return null;
    }
    const sb = clientFor(client);
    const payload = { ...toPoolRow({ ...input, strategy }), name: input.name.trim() };
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(POOLS_TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[storage.backends.pools.create]", error.message);
      return null;
    }
    return getPool(data.id, { client });
  } catch (e) {
    console.error("[storage.backends.pools.create]", e);
    return null;
  }
}

export async function updatePool(id, patch = {}, { client } = {}) {
  if (!id || !patch || typeof patch !== "object" || !isSupabaseConfigured()) return null;
  try {
    if ("strategy" in patch && !POOL_STRATEGIES.includes(patch.strategy)) {
      console.error("[storage.backends.pools.update]", `invalid strategy: ${patch.strategy}`);
      return null;
    }
    if ("name" in patch && (typeof patch.name !== "string" || patch.name.trim() === "")) {
      console.error("[storage.backends.pools.update]", "name must be a non-empty string");
      return null;
    }
    const sb = clientFor(client);
    const row = toPoolRow(patch);
    if ("name" in row && typeof row.name === "string") row.name = row.name.trim();
    if (Object.keys(row).length === 0) {
      return getPool(id, { client });
    }
    const { error } = await sb.from(POOLS_TABLE).update(row).eq("id", id).is("deleted_at", null);
    if (error) {
      console.error("[storage.backends.pools.update]", error.message);
      return null;
    }
    return getPool(id, { client });
  } catch (e) {
    console.error("[storage.backends.pools.update]", e);
    return null;
  }
}

export async function softDeletePool(id, { client } = {}) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = clientFor(client);
    const { error } = await sb
      .from(POOLS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[storage.backends.pools.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[storage.backends.pools.delete]", e);
    return false;
  }
}

export async function setPoolMembers(poolId, members = [], { client } = {}) {
  if (!poolId || !Array.isArray(members) || !isSupabaseConfigured()) return null;
  try {
    const sb = clientFor(client);
    const rows = [];
    for (const m of members) {
      if (!m || typeof m !== "object") continue;
      const backendId = m.backendId ?? m.backend_id ?? null;
      if (!backendId) continue;
      let priority = Math.floor(Number(m.priority ?? 100));
      if (!Number.isFinite(priority) || priority <= 0) priority = 100;
      let weight = Math.floor(Number(m.weight ?? 1));
      if (!Number.isFinite(weight) || weight <= 0) weight = 1;
      rows.push({
        pool_id: poolId,
        backend_id: backendId,
        priority,
        weight,
        read_only: Boolean(m.readOnly ?? m.read_only ?? false),
      });
    }
    const gone = await sb.from(MEMBERS_TABLE).delete().eq("pool_id", poolId);
    if (gone.error) {
      console.error("[storage.backends.pools.members]", gone.error.message);
      return null;
    }
    if (rows.length > 0) {
      const added = await sb.from(MEMBERS_TABLE).insert(rows);
      if (added.error) {
        console.error("[storage.backends.pools.members]", added.error.message);
        return null;
      }
    }
    return getPool(poolId, { client });
  } catch (e) {
    console.error("[storage.backends.pools.members]", e);
    return null;
  }
}
