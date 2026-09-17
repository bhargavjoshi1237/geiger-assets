// Data-access layer for Geiger Assets — owns `assets.shared_links`,
// `assets.approvals` and `assets.collaboration_invites`.
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

function meta(row) {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

function toRowGeneric(input, map) {
  const row = {};
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

function emptyToNull(value) {
  return value ? value : null;
}

async function listRows(table, projectId, normalize) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    let q = sb.from(table).select("*").is("deleted_at", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) {
      console.error(`[collaboration.${table}.list]`, error.message);
      return null;
    }
    return (data || []).map(normalize);
  } catch (e) {
    console.error(`[collaboration.${table}.list]`, e);
    return null;
  }
}

async function getRow(table, id, normalize) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(table)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error(`[collaboration.${table}.get]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[collaboration.${table}.get]`, e);
    return null;
  }
}

async function createRow(table, payload, normalize) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.from(table).insert(payload).select("*").single();
    if (error) {
      console.error(`[collaboration.${table}.create]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[collaboration.${table}.create]`, e);
    return null;
  }
}

async function updateRow(table, id, patch, normalize) {
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
      console.error(`[collaboration.${table}.update]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[collaboration.${table}.update]`, e);
    return null;
  }
}

async function softDeleteRow(table, id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error(`[collaboration.${table}.delete]`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[collaboration.${table}.delete]`, e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Shared links — records for the HMAC-signed delivery tokens minted through
// POST /api/media/share. The token itself is stateless (verified by
// lib/media/token, never looked up), so this row is the workspace's handle
// for listing, expiring and revoking it.
// ---------------------------------------------------------------------------

const SHARED_LINK_MAP = {
  projectId: "project_id",
  label: "label",
  kind: "kind",
  assetId: "asset_id",
  collectionId: "collection_id",
  collectionName: "collection_name",
  visibility: "visibility",
  scope: "scope",
  passwordProtected: "password_protected",
  passwordHint: "password_hint",
  token: "token",
  url: "url",
  viewCount: "view_count",
  revokedAt: "revoked_at",
  isActive: "is_active",
  createdBy: "created_by",
};

export function normalizeSharedLink(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    label: row.label ?? "",
    kind: row.kind ?? "asset",
    assetId: row.asset_id ?? null,
    collectionId: row.collection_id ?? null,
    collectionName: row.collection_name ?? "",
    visibility: row.visibility ?? "private",
    scope: row.scope ?? "view",
    passwordProtected: Boolean(row.password_protected),
    passwordHint: row.password_hint ?? "",
    token: row.token ?? "",
    url: row.url ?? "",
    viewCount: Number(row.view_count ?? 0),
    expiresAt: row.expires_at ?? "",
    revokedAt: row.revoked_at ?? "",
    isActive: row.is_active !== false,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toSharedLinkRow(input) {
  const row = toRowGeneric(input, SHARED_LINK_MAP);
  if ("viewCount" in input) row.view_count = Number(input.viewCount) || 0;
  if ("passwordProtected" in input) row.password_protected = Boolean(input.passwordProtected);
  if ("isActive" in input) row.is_active = Boolean(input.isActive);
  if ("expiresAt" in input) row.expires_at = emptyToNull(input.expiresAt);
  if ("revokedAt" in input) row.revoked_at = emptyToNull(input.revokedAt);
  return row;
}

export const listSharedLinks = (projectId) =>
  listRows("shared_links", projectId, normalizeSharedLink);
export const getSharedLink = (id) => getRow("shared_links", id, normalizeSharedLink);

export function createSharedLink(input) {
  const payload = toSharedLinkRow(input || {});
  if (input?.id) payload.id = input.id; // honor optimistic UUID
  return createRow("shared_links", payload, normalizeSharedLink);
}

export function updateSharedLink(id, patch) {
  return updateRow("shared_links", id, toSharedLinkRow(patch || {}), normalizeSharedLink);
}

// Revoking deactivates the link in place (the row stays for history) — the
// bearer token itself cannot be un-signed, so the delivery route must check
// this table before serving a revoked token.
export function revokeSharedLink(id) {
  return updateRow(
    "shared_links",
    id,
    { is_active: false, revoked_at: new Date().toISOString() },
    normalizeSharedLink,
  );
}

export const softDeleteSharedLink = (id) => softDeleteRow("shared_links", id);

// ---------------------------------------------------------------------------
// Approvals — review requests that move an asset from draft to approved.
// The decision trail lives in metadata.history (appended by the screen),
// so the row plus its history render without a second fetch.
// ---------------------------------------------------------------------------

const APPROVAL_MAP = {
  projectId: "project_id",
  assetId: "asset_id",
  title: "title",
  description: "description",
  requester: "requester",
  reviewer: "reviewer",
  status: "status",
  versionLabel: "version_label",
  isLocked: "is_locked",
  externalToken: "external_token",
  note: "note",
  decidedAt: "decided_at",
  decidedBy: "decided_by",
  createdBy: "created_by",
};

export function normalizeApproval(row) {
  if (!row) return null;
  const bag = meta(row);
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    assetId: row.asset_id ?? null,
    title: row.title ?? "",
    description: row.description ?? "",
    requester: row.requester ?? "",
    reviewer: row.reviewer ?? "",
    status: row.status ?? "pending",
    versionLabel: row.version_label ?? "",
    isLocked: Boolean(row.is_locked),
    externalToken: row.external_token ?? "",
    note: row.note ?? "",
    decidedAt: row.decided_at ?? "",
    decidedBy: row.decided_by ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    history: Array.isArray(bag.history) ? bag.history : [],
    ...bag,
  };
}

function toApprovalRow(input) {
  const row = toRowGeneric(input, APPROVAL_MAP);
  if ("isLocked" in input) row.is_locked = Boolean(input.isLocked);
  if ("decidedAt" in input) row.decided_at = emptyToNull(input.decidedAt);
  if ("history" in input) {
    row.metadata = { ...((input.metadata && typeof input.metadata === "object" ? input.metadata : {})), history: input.history };
  }
  return row;
}

export const listApprovals = (projectId) =>
  listRows("approvals", projectId, normalizeApproval);
export const getApproval = (id) => getRow("approvals", id, normalizeApproval);

export function createApproval(input) {
  const payload = toApprovalRow(input || {});
  if (input?.id) payload.id = input.id; // honor optimistic UUID
  return createRow("approvals", payload, normalizeApproval);
}

export function updateApproval(id, patch) {
  return updateRow("approvals", id, toApprovalRow(patch || {}), normalizeApproval);
}

export const softDeleteApproval = (id) => softDeleteRow("approvals", id);

// ---------------------------------------------------------------------------
// Collaboration invites — member, guest and external-reviewer invitations.
// Workspace membership itself stays in public.roles + assets.role_grants
// (lib/supabase/rbac.js); this table is the pending-invite queue in front of it.
// ---------------------------------------------------------------------------

const INVITE_MAP = {
  projectId: "project_id",
  email: "email",
  name: "name",
  roleId: "role_id",
  roleKey: "role_key",
  roleName: "role_name",
  inviteType: "invite_type",
  status: "status",
  message: "message",
  acceptedAt: "accepted_at",
  createdBy: "created_by",
};

export function normalizeInvite(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    email: row.email ?? "",
    name: row.name ?? "",
    roleId: row.role_id ?? null,
    roleKey: row.role_key ?? "",
    roleName: row.role_name ?? "",
    inviteType: row.invite_type ?? "member",
    status: row.status ?? "pending",
    message: row.message ?? "",
    expiresAt: row.expires_at ?? "",
    acceptedAt: row.accepted_at ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toInviteRow(input) {
  const row = toRowGeneric(input, INVITE_MAP);
  if ("expiresAt" in input) row.expires_at = emptyToNull(input.expiresAt);
  if ("acceptedAt" in input) row.accepted_at = emptyToNull(input.acceptedAt);
  return row;
}

export const listInvites = (projectId) =>
  listRows("collaboration_invites", projectId, normalizeInvite);
export const getInvite = (id) => getRow("collaboration_invites", id, normalizeInvite);

export function createInvite(input) {
  const payload = toInviteRow(input || {});
  if (input?.id) payload.id = input.id; // honor optimistic UUID
  return createRow("collaboration_invites", payload, normalizeInvite);
}

export function updateInvite(id, patch) {
  return updateRow("collaboration_invites", id, toInviteRow(patch || {}), normalizeInvite);
}

export const softDeleteInvite = (id) => softDeleteRow("collaboration_invites", id);
