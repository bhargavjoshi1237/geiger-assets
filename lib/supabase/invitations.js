"use client";

// Owns assets.team_invitations — the half of Team that rbac.js can't reach.
//
// rbac.js handles people who already exist in the org (list, assign role,
// revoke). This module handles everyone else: an emailed invitation carrying a
// role, a kind (member / guest / external reviewer), and an optional scope
// narrowing what a guest can see.
//
// Sending the actual email is not wired here — an invitation is a row plus a
// token, and the screen surfaces the link for manual sending. `scope` mirrors
// the shape assets.role_grants.scope uses: { asset: [uuid, ...] }.
//
// DB is snake_case, the UI is camelCase — mapped here at the boundary.

import { assetsClient, isSupabaseConfigured, isUuid } from "@/supabase/components/assets-client";
import { logActivity } from "./activity";
import { mintToken } from "./shares";

const TABLE = "team_invitations";

const DEFAULT_TTL_DAYS = 14;

export function normalizeInvitation(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const expired =
    row.expires_at && new Date(row.expires_at).getTime() < Date.now();
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    email: row.email ?? "",
    name: row.name ?? "",
    roleId: row.role_id ?? null,
    kind: row.kind ?? "member",
    // A pending invite past its expiry reads as expired without a sweeper job.
    status: expired && row.status === "pending" ? "expired" : row.status ?? "pending",
    token: row.token ?? "",
    message: row.message ?? "",
    scope: row.scope && typeof row.scope === "object" ? row.scope : {},
    expiresAt: row.expires_at ?? null,
    acceptedAt: row.accepted_at ?? null,
    acceptedBy: row.accepted_by ?? null,
    invitedBy: row.invited_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    ...meta,
  };
}

function toRow(input) {
  const row = {};
  const map = {
    email: "email",
    name: "name",
    kind: "kind",
    status: "status",
    token: "token",
    message: "message",
    projectId: "project_id",
    invitedBy: "invited_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("roleId" in input) row.role_id = input.roleId || null;
  if ("expiresAt" in input) row.expires_at = input.expiresAt || null;
  if ("acceptedAt" in input) row.accepted_at = input.acceptedAt || null;
  if ("scope" in input) {
    row.scope = input.scope && typeof input.scope === "object" ? input.scope : {};
  }
  return row;
}

export function defaultExpiry(days = DEFAULT_TTL_DAYS) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

export async function listInvitations(projectId) {
  if (!isSupabaseConfigured()) return null;
  if (projectId && !isUuid(projectId)) return [];
  try {
    const sb = assetsClient();
    let q = sb.from(TABLE).select("*").is("deleted_at", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) {
      console.error("[invitations.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeInvitation);
  } catch (e) {
    console.error("[invitations.list]", e);
    return null;
  }
}

export async function createInvitation(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = toRow(input);
    if (!payload.token) payload.token = mintToken();
    if (!payload.expires_at) payload.expires_at = defaultExpiry();
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[invitations.create]", error.message);
      return null;
    }
    const invite = normalizeInvitation(data);
    logActivity({
      projectId: invite.projectId,
      verb: "member.invited",
      subjectType: "team_invitation",
      subjectId: invite.id,
      subjectLabel: invite.email,
      actorId: invite.invitedBy,
      actorName: input.actorName || "",
      summary: invite.email,
      metadata: { kind: invite.kind },
    });
    return invite;
  } catch (e) {
    console.error("[invitations.create]", e);
    return null;
  }
}

export async function updateInvitation(id, patch) {
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
      console.error("[invitations.update]", error.message);
      return null;
    }
    return normalizeInvitation(data);
  } catch (e) {
    console.error("[invitations.update]", e);
    return null;
  }
}

export async function revokeInvitation(id) {
  return updateInvitation(id, { status: "revoked" });
}

/** Re-arm a pending invite: fresh token, fresh expiry window. */
export async function resendInvitation(id) {
  return updateInvitation(id, {
    status: "pending",
    token: mintToken(),
    expiresAt: defaultExpiry(),
  });
}

export async function softDeleteInvitation(id) {
  if (!id || !isSupabaseConfigured() || !isUuid(id)) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[invitations.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[invitations.delete]", e);
    return false;
  }
}

/** Invite link the screen offers for copy-paste until email sending lands. */
export function invitationUrl(token) {
  if (!token) return "";
  if (typeof window === "undefined") return `/invite/${token}`;
  return `${window.location.origin}/invite/${token}`;
}
