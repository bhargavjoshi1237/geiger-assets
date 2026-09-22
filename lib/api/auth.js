if (typeof window !== "undefined") {
  throw new Error("lib/api/auth is server-only.");
}

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/supabase/components/assets-client";

// Public API v1 auth — resolves a `gk_live_…` bearer token by sha256 hash,
// enforces scopes, stamps last_used_at and counts usage.
//
// Mirrors lib/storage/auth.js: project access reuses the role_grants path so
// API keys stay consistent with workspace membership.

export const API_SCOPES = [
  "assets:read",
  "assets:write",
  "collections:read",
  "collections:write",
  "folders:read",
  "folders:write",
  "tags:read",
  "upload:write",
  "delivery:read",
  "delivery:write",
];

export function apiError(code, message, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function sha256Hex(secret) {
  return createHash("sha256").update(String(secret)).digest("hex");
}

function bearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

function keyActive(row) {
  if (!row || row.deleted_at) return false;
  if (row.revoked_at) return false;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return false;
  return true;
}

export function hasScope(key, scope) {
  const scopes = Array.isArray(key?.scopes) ? key.scopes : [];
  if (scopes.includes(scope)) return true;
  // Write implies read within the same resource.
  const [resource, action] = String(scope).split(":");
  if (action === "read" && scopes.includes(`${resource}:write`)) return true;
  return false;
}

export async function recordUsage({ supabase, projectId, keyId, route, method, status, kind = "api", assetId = null, transforms = 0 }) {
  try {
    await supabase.schema("assets").from("api_usage").insert({
      project_id: projectId,
      api_key_id: keyId,
      route: String(route || "").slice(0, 200),
      method: String(method || "").slice(0, 12),
      status: Number(status) || 200,
      kind,
      asset_id: assetId,
      transforms: Number(transforms) || 0,
    });
  } catch (e) {
    console.error("[api.auth.usage]", e?.message || e);
  }
}

async function stampLastUsed(supabase, keyId) {
  try {
    await supabase.schema("assets").from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyId);
  } catch (e) {
    console.error("[api.auth.stamp]", e?.message || e);
  }
}

// Resolve the bearer token to an active key row (camelCase). Returns
// { key, supabase } or { response } on failure.
export async function resolveApiKey(request) {
  if (!isSupabaseConfigured()) {
    return { response: apiError("service_unavailable", "API is not configured on the server.", 503) };
  }
  const token = bearerToken(request);
  if (!token || !token.startsWith("gk_live_")) {
    return { response: apiError("unauthorized", "Missing or invalid API key.", 401) };
  }
  let supabase;
  try {
    supabase = await createServerSupabase();
  } catch (e) {
    console.error("[api.auth]", e);
    return { response: apiError("auth_failed", "Could not authenticate the request.", 500) };
  }
  try {
    const { data, error } = await supabase
      .schema("assets")
      .from("api_keys")
      .select("*")
      .eq("key_hash", sha256Hex(token))
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[api.auth.lookup]", error.message);
      return { response: apiError("unauthorized", "Missing or invalid API key.", 401) };
    }
    if (!keyActive(data)) {
      return { response: apiError("unauthorized", "This API key is expired, revoked, or unknown.", 401) };
    }
    const key = {
      id: data.id,
      projectId: data.project_id,
      name: data.name ?? "",
      prefix: data.prefix ?? "",
      scopes: Array.isArray(data.scopes) ? data.scopes : [],
      lastUsedAt: data.last_used_at ?? null,
      expiresAt: data.expires_at ?? null,
      createdAt: data.created_at ?? "",
    };
    stampLastUsed(supabase, key.id).catch(() => {});
    return { key, supabase };
  } catch (e) {
    console.error("[api.auth]", e?.message || e);
    return { response: apiError("unauthorized", "Missing or invalid API key.", 401) };
  }
}

// Require one of `scopes` (string or array). On success returns
// { key, supabase }; on failure { response } with the error shape.
export async function requireApiKey(request, scopes) {
  const resolved = await resolveApiKey(request);
  if (resolved.response) return resolved;
  const wanted = Array.isArray(scopes) ? scopes : [scopes].filter(Boolean);
  if (wanted.length && !wanted.some((s) => hasScope(resolved.key, s))) {
    return { response: apiError("forbidden", "This API key lacks the required scope.", 403) };
  }
  return resolved;
}

export async function countUsage({ supabase, projectId, keyId, route, method, status, kind, assetId, transforms }) {
  await recordUsage({ supabase, projectId, keyId, route, method, status, kind, assetId, transforms });
}
