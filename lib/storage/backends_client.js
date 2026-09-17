"use client";

// Browser-side access to the storage backend + pool API.
//
// The store itself (lib/storage/backends/store.js) is server-only — it decrypts
// credentials — so the settings screen talks to it through the route handlers
// instead. This module is that boundary, and it keeps the same contract as the
// Supabase data layer: validate, console.error on failure, return
// null / [] / false. It never throws and never toasts; the screen owns UX.
//
// Failures also hand the caller a stable error code through an `onError`
// callback (the same shape lib/storage/client.js uses for uploads) so a screen
// can say "STORAGE_SECRET_KEY isn't set" instead of "something went wrong".

// basePath is "/assets" in production and "" in dev, so every URL is built from
// it rather than hardcoding a leading slash.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function api(path) {
  return `${BASE}${path}`;
}

export const BACKEND_ERROR_MESSAGES = {
  secret_key_missing:
    "STORAGE_SECRET_KEY isn't set on the server, so credentials can't be stored.",
  unauthorized: "You're signed out — sign in and try again.",
  forbidden: "You don't have permission to change storage settings here.",
  rate_limited: "Too many changes at once — wait a moment and try again.",
  unsupported_kind: "That backend kind isn't supported.",
  bad_strategy: "That pool strategy isn't supported.",
  bad_request: "Some of those values weren't accepted.",
  not_found: "That record no longer exists.",
  write_failed: "The server couldn't save that.",
  server: "Something went wrong — try again.",
};

export function backendErrorMessage(code, fallback = BACKEND_ERROR_MESSAGES.server) {
  return BACKEND_ERROR_MESSAGES[code] || fallback;
}

function httpToCode(status) {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status === 503) return "secret_key_missing";
  return "server";
}

// One fetch spelling for every call: JSON in, JSON out, an error code on the
// way back down. Returns the parsed payload, or null when the call failed.
async function request(path, { method = "GET", body, onError } = {}) {
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
      const code = payload?.error || httpToCode(res.status);
      console.error("[storage.backendsClient]", method, path, code);
      if (typeof onError === "function") onError(code);
      return null;
    }
    return payload ?? {};
  } catch (e) {
    console.error("[storage.backendsClient]", method, path, e);
    if (typeof onError === "function") onError("server");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Backends
// ---------------------------------------------------------------------------

// Project backends first, then the suite-wide ones (project_id is null). The
// suite rows are readable by any signed-in user but are seeded in SQL and
// writable only outside this product, so the screen renders them read-only.
export async function listStorageBackends(projectId, { onError } = {}) {
  if (!projectId) return null;
  const payload = await request(
    `/api/storage/backends?projectId=${encodeURIComponent(projectId)}&includeSuite=1`,
    { onError },
  );
  if (!payload) return null;
  const own = Array.isArray(payload.backends) ? payload.backends : [];
  const suite = Array.isArray(payload.suiteBackends) ? payload.suiteBackends : [];
  return [...own, ...suite];
}

// `{ backend, usage: { assetCount } }`. `assetCount` is null when the count
// could not be taken — the caller must say so rather than showing a confident 0.
export async function getStorageBackend(id, { onError } = {}) {
  if (!id) return null;
  const payload = await request(`/api/storage/backends/${encodeURIComponent(id)}`, { onError });
  if (!payload?.backend) return null;
  return { backend: payload.backend, usage: payload.usage ?? null };
}

export async function createStorageBackend(input, { onError } = {}) {
  if (!input?.projectId) return null;
  const payload = await request("/api/storage/backends", {
    method: "POST",
    body: input,
    onError,
  });
  return payload?.backend ?? null;
}

export async function updateStorageBackend(id, patch, { onError } = {}) {
  if (!id || !patch) return null;
  const payload = await request(`/api/storage/backends/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
    onError,
  });
  return payload?.backend ?? null;
}

export async function deleteStorageBackend(id, { onError } = {}) {
  if (!id) return false;
  const payload = await request(`/api/storage/backends/${encodeURIComponent(id)}`, {
    method: "DELETE",
    onError,
  });
  return Boolean(payload?.ok);
}

// `{ ok, detail, latencyMs, capabilities }`. A reachable-but-unhealthy backend
// answers 200 with ok:false, so a null here means the probe itself failed.
export async function testStorageBackend(id, { onError } = {}) {
  if (!id) return null;
  return request(`/api/storage/backends/${encodeURIComponent(id)}/health`, {
    method: "POST",
    onError,
  });
}

// ---------------------------------------------------------------------------
// Pools
// ---------------------------------------------------------------------------

export async function listStoragePools(projectId, { onError } = {}) {
  if (!projectId) return null;
  const payload = await request(
    `/api/storage/pools?projectId=${encodeURIComponent(projectId)}`,
    { onError },
  );
  if (!payload) return null;
  return Array.isArray(payload.pools) ? payload.pools : [];
}

export async function createStoragePool(input, { onError } = {}) {
  if (!input?.projectId || !input?.name) return null;
  const payload = await request("/api/storage/pools", {
    method: "POST",
    body: input,
    onError,
  });
  return payload?.pool ?? null;
}

export async function updateStoragePool(id, patch, { onError } = {}) {
  if (!id || !patch) return null;
  const payload = await request(`/api/storage/pools/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
    onError,
  });
  return payload?.pool ?? null;
}

export async function deleteStoragePool(id, { onError } = {}) {
  if (!id) return false;
  const payload = await request(`/api/storage/pools/${encodeURIComponent(id)}`, {
    method: "DELETE",
    onError,
  });
  return Boolean(payload?.ok);
}

// PUT replaces the membership wholesale, so always send the complete list —
// never a patch of the entries that changed.
export async function setStoragePoolMembers(id, members, { onError } = {}) {
  if (!id || !Array.isArray(members)) return null;
  const payload = await request(`/api/storage/pools/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: { members },
    onError,
  });
  return payload?.pool ?? null;
}
