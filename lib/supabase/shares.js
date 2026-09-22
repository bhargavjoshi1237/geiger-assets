"use client";

// Owns assets.share_links — every outbound link that exposes an asset or
// collection outside the workspace.
//
// The token is minted client-side and is the public identity of the link
// (/s/<token>). Passwords are NOT hashed here — the column carries whatever
// the caller supplies, and the public page does not yet enforce it. That is
// deliberate for this pass: the recipient page is a read-only stub. Wire a
// server-side hash + check before treating a password as real protection.
//
// DB is snake_case, the UI is camelCase — mapped here at the boundary.

import { assetsClient, isSupabaseConfigured, isUuid } from "@/supabase/components/assets-client";
import { logActivity } from "./activity";

const TABLE = "share_links";

/** URL-safe, collision-resistant enough for a share slug. */
export function mintToken(length = 22) {
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

export function normalizeShareLink(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const expired =
    row.expires_at && new Date(row.expires_at).getTime() < Date.now();
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    token: row.token ?? "",
    subjectType: row.subject_type ?? "asset",
    subjectId: row.subject_id ?? null,
    visibility: row.visibility ?? "private",
    hasPassword: Boolean(row.password_hash),
    expiresAt: row.expires_at ?? null,
    allowDownload: Boolean(row.allow_download),
    allowComments: Boolean(row.allow_comments),
    requireEmail: Boolean(row.require_email),
    // A link past its expiry reads as expired even if the row still says active.
    status: expired && row.status === "active" ? "expired" : row.status ?? "active",
    viewCount: Number(row.view_count ?? 0),
    downloadCount: Number(row.download_count ?? 0),
    lastViewedAt: row.last_viewed_at ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    ...meta,
  };
}

function toRow(input) {
  const row = {};
  const map = {
    name: "name",
    token: "token",
    subjectType: "subject_type",
    visibility: "visibility",
    status: "status",
    projectId: "project_id",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("subjectId" in input) row.subject_id = input.subjectId || null;
  if ("expiresAt" in input) row.expires_at = input.expiresAt || null;
  if ("password" in input) row.password_hash = input.password || "";
  if ("allowDownload" in input) row.allow_download = Boolean(input.allowDownload);
  if ("allowComments" in input) row.allow_comments = Boolean(input.allowComments);
  if ("requireEmail" in input) row.require_email = Boolean(input.requireEmail);
  if ("viewCount" in input) row.view_count = Number(input.viewCount) || 0;
  if ("downloadCount" in input) row.download_count = Number(input.downloadCount) || 0;
  return row;
}

export async function listShareLinks(projectId) {
  if (!isSupabaseConfigured()) return null;
  if (projectId && !isUuid(projectId)) return [];
  try {
    const sb = assetsClient();
    let q = sb.from(TABLE).select("*").is("deleted_at", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) {
      console.error("[shares.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeShareLink);
  } catch (e) {
    console.error("[shares.list]", e);
    return null;
  }
}

export async function getShareLink(id) {
  if (!id || !isSupabaseConfigured() || !isUuid(id)) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error("[shares.get]", error.message);
      return null;
    }
    return normalizeShareLink(data);
  } catch (e) {
    console.error("[shares.get]", e);
    return null;
  }
}

export async function createShareLink(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = toRow(input);
    if (!payload.token) payload.token = mintToken();
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[shares.create]", error.message);
      return null;
    }
    const link = normalizeShareLink(data);
    logActivity({
      projectId: link.projectId,
      verb: "share.created",
      subjectType: link.subjectType,
      subjectId: link.subjectId,
      subjectLabel: link.name,
      actorId: link.createdBy,
      actorName: input.actorName || "",
      summary: link.name,
    });
    return link;
  } catch (e) {
    console.error("[shares.create]", e);
    return null;
  }
}

export async function updateShareLink(id, patch) {
  if (!id || !isSupabaseConfigured() || !isUuid(id)) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(toRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[shares.update]", error.message);
      return null;
    }
    return normalizeShareLink(data);
  } catch (e) {
    console.error("[shares.update]", e);
    return null;
  }
}

/** Revoking keeps the row (and its counters) but kills the URL. */
export async function revokeShareLink(id, actor = {}) {
  const updated = await updateShareLink(id, { status: "revoked" });
  if (!updated) return null;
  logActivity({
    projectId: updated.projectId,
    verb: "share.revoked",
    subjectType: updated.subjectType,
    subjectId: updated.subjectId,
    subjectLabel: updated.name,
    actorId: actor.id || null,
    actorName: actor.name || "",
    summary: updated.name,
  });
  return updated;
}

export async function softDeleteShareLink(id) {
  if (!id || !isSupabaseConfigured() || !isUuid(id)) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[shares.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[shares.delete]", e);
    return false;
  }
}

/**
 * Resolve a public token through the security-definer RPC. Used by the public
 * /s/<token> page, which has no read access to the table itself.
 * Returns null for a missing, revoked, or expired link.
 */
export async function resolveShareToken(token) {
  if (!token || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.rpc("resolve_share_link", { p_token: token });
    if (error) {
      console.error("[shares.resolve]", error.message);
      return null;
    }
    const row = (data || [])[0];
    if (!row) return null;
    return {
      id: row.id,
      name: row.name ?? "",
      subjectType: row.subject_type ?? "asset",
      subjectId: row.subject_id ?? null,
      visibility: row.visibility ?? "private",
      allowDownload: Boolean(row.allow_download),
      allowComments: Boolean(row.allow_comments),
      hasPassword: Boolean(row.has_password),
      expiresAt: row.expires_at ?? null,
    };
  } catch (e) {
    console.error("[shares.resolve]", e);
    return null;
  }
}

/** Bump the view counter for a public visit. Best-effort. */
export async function touchShareToken(token) {
  if (!token || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb.rpc("touch_share_link", { p_token: token });
    if (error) {
      console.error("[shares.touch]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[shares.touch]", e);
    return false;
  }
}
