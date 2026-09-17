// Data-access layer for the Governance domain — owns `assets.permission_overrides`,
// `assets.identity_providers`, `assets.retention_policies`,
// `assets.retention_exceptions`, `assets.legal_holds`, `assets.legal_hold_assets`
// and `assets.legal_hold_events`.
//
// Workspace roles themselves are NOT owned here: role definitions live in
// public.roles and assignments in assets.role_grants (see lib/supabase/rbac.js).
// This module persists only what those do not — per-scope permission overrides,
// identity-provider configuration, retention schedules, and legal holds.
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const OVERRIDES_TABLE = "permission_overrides";
const PROVIDERS_TABLE = "identity_providers";
const POLICIES_TABLE = "retention_policies";
const EXCEPTIONS_TABLE = "retention_exceptions";
const HOLDS_TABLE = "legal_holds";
const HOLD_ASSETS_TABLE = "legal_hold_assets";
const HOLD_EVENTS_TABLE = "legal_hold_events";

function meta(row) {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

// ---------------------------------------------------------------------------
// Permission overrides
// ---------------------------------------------------------------------------

export function normalizePermissionOverride(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    scope: row.scope ?? "workspace",
    targetId: row.target_id ?? "",
    targetLabel: row.target_label ?? "",
    fieldName: row.field_name ?? "",
    roleId: row.role_id ?? null,
    roleKey: row.role_key ?? "",
    permissionKey: row.permission_key ?? "",
    effect: row.effect ?? "allow",
    note: row.note ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toOverrideRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    scope: "scope",
    targetId: "target_id",
    targetLabel: "target_label",
    fieldName: "field_name",
    roleId: "role_id",
    roleKey: "role_key",
    permissionKey: "permission_key",
    effect: "effect",
    note: "note",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

// ---------------------------------------------------------------------------
// Identity providers (configuration only — secrets live in the IdP, never here)
// ---------------------------------------------------------------------------

export function normalizeIdentityProvider(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    protocol: row.protocol ?? "saml",
    status: row.status ?? "pending",
    domain: row.domain ?? "",
    ssoUrl: row.sso_url ?? "",
    entityId: row.entity_id ?? "",
    scimEnabled: Boolean(row.scim_enabled),
    autoProvision: row.auto_provision !== false,
    requireMfa: Boolean(row.require_mfa),
    deprovisionOnDisable: Boolean(row.deprovision_on_disable),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toProviderRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    name: "name",
    protocol: "protocol",
    status: "status",
    domain: "domain",
    ssoUrl: "sso_url",
    entityId: "entity_id",
    scimEnabled: "scim_enabled",
    autoProvision: "auto_provision",
    requireMfa: "require_mfa",
    deprovisionOnDisable: "deprovision_on_disable",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

// ---------------------------------------------------------------------------
// Retention policies + exceptions. The schedules configured here are carried
// out by the reconciler in lib/storage/reconcile.js (pass 3 sweeps
// soft-deleted rows past the retention window) — this module never deletes
// bytes itself.
// ---------------------------------------------------------------------------

export function normalizeRetentionPolicy(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    scope: row.scope ?? "workspace",
    target: row.target ?? "",
    retentionDays: Number(row.retention_days ?? 30),
    autoArchiveDays: row.auto_archive_days ?? null,
    autoDeleteDays: row.auto_delete_days ?? null,
    disposition: row.disposition ?? "retain",
    requiresReview: Boolean(row.requires_review),
    isActive: row.is_active !== false,
    lastReviewedAt: row.last_reviewed_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toPolicyRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    name: "name",
    scope: "scope",
    target: "target",
    disposition: "disposition",
    requiresReview: "requires_review",
    isActive: "is_active",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("retentionDays" in input) {
    row.retention_days = Math.max(0, Math.floor(Number(input.retentionDays) || 0));
  }
  if ("autoArchiveDays" in input) {
    row.auto_archive_days =
      input.autoArchiveDays === null || input.autoArchiveDays === ""
        ? null
        : Math.max(0, Math.floor(Number(input.autoArchiveDays) || 0));
  }
  if ("autoDeleteDays" in input) {
    row.auto_delete_days =
      input.autoDeleteDays === null || input.autoDeleteDays === ""
        ? null
        : Math.max(0, Math.floor(Number(input.autoDeleteDays) || 0));
  }
  if ("lastReviewedAt" in input) row.last_reviewed_at = input.lastReviewedAt || null;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function normalizeRetentionException(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    policyId: row.policy_id ?? null,
    targetId: row.target_id ?? "",
    targetLabel: row.target_label ?? "",
    reason: row.reason ?? "",
    expiresAt: row.expires_at ?? null,
    approvedBy: row.approved_by ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toExceptionRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    policyId: "policy_id",
    targetId: "target_id",
    targetLabel: "target_label",
    reason: "reason",
    approvedBy: "approved_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("expiresAt" in input) row.expires_at = input.expiresAt || null;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

// ---------------------------------------------------------------------------
// Legal holds. An active hold suspends retention for its assets — the
// retention sweep must exclude held ids (see the legal_holds screen, which
// renders that relationship). Holds never delete anything; releasing one only
// flips status and lets the normal schedule resume.
// ---------------------------------------------------------------------------

export function normalizeLegalHold(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    matter: row.matter ?? "",
    reason: row.reason ?? "",
    status: row.status ?? "active",
    custodians: Array.isArray(row.custodians) ? row.custodians : [],
    notifyCustodians: row.notify_custodians !== false,
    releasedAt: row.released_at ?? null,
    releasedBy: row.released_by ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toHoldRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    name: "name",
    matter: "matter",
    reason: "reason",
    status: "status",
    notifyCustodians: "notify_custodians",
    releasedBy: "released_by",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("custodians" in input) {
    row.custodians = Array.isArray(input.custodians)
      ? input.custodians.map((c) => String(c).trim()).filter(Boolean)
      : [];
  }
  if ("releasedAt" in input) row.released_at = input.releasedAt || null;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function normalizeLegalHoldAsset(row) {
  if (!row) return null;
  return {
    id: row.id,
    holdId: row.hold_id ?? null,
    projectId: row.project_id ?? null,
    assetId: row.asset_id ?? "",
    assetLabel: row.asset_label ?? "",
    addedBy: row.added_by ?? "",
    addedAt: row.added_at ?? row.created_at ?? "",
  };
}

function toHoldAssetRow(input) {
  const row = {};
  const map = {
    holdId: "hold_id",
    projectId: "project_id",
    assetId: "asset_id",
    assetLabel: "asset_label",
    addedBy: "added_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  return row;
}

export function normalizeLegalHoldEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    holdId: row.hold_id ?? null,
    projectId: row.project_id ?? null,
    action: row.action ?? "updated",
    actor: row.actor ?? "",
    detail: row.detail ?? "",
    createdAt: row.created_at ?? "",
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
      console.error(`[governance.${tag}.list]`, error.message);
      return null;
    }
    return (data || []).map(normalize);
  } catch (e) {
    console.error(`[governance.${tag}.list]`, e);
    return null;
  }
}

async function createRow(table, input, normalize, tag) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.from(table).insert(input).select("*").single();
    if (error) {
      console.error(`[governance.${tag}.create]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[governance.${tag}.create]`, e);
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
      console.error(`[governance.${tag}.update]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[governance.${tag}.update]`, e);
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
      console.error(`[governance.${tag}.delete]`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[governance.${tag}.delete]`, e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Permission overrides
// ---------------------------------------------------------------------------

export const listPermissionOverrides = (projectId) =>
  listRows(OVERRIDES_TABLE, projectId, normalizePermissionOverride, "overrides");

export function createPermissionOverride(input) {
  if (!input?.projectId || !input?.permissionKey) return Promise.resolve(null);
  const payload = toOverrideRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(OVERRIDES_TABLE, payload, normalizePermissionOverride, "overrides");
}

export const updatePermissionOverride = (id, patch) =>
  updateRow(OVERRIDES_TABLE, id, toOverrideRow(patch), normalizePermissionOverride, "overrides");

export const softDeletePermissionOverride = (id) =>
  softDeleteRow(OVERRIDES_TABLE, id, "overrides");

// ---------------------------------------------------------------------------
// Identity providers
// ---------------------------------------------------------------------------

export const listIdentityProviders = (projectId) =>
  listRows(PROVIDERS_TABLE, projectId, normalizeIdentityProvider, "providers");

export function createIdentityProvider(input) {
  if (!input?.projectId || !input?.name?.trim()) return Promise.resolve(null);
  const payload = toProviderRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(PROVIDERS_TABLE, payload, normalizeIdentityProvider, "providers");
}

export const updateIdentityProvider = (id, patch) =>
  updateRow(PROVIDERS_TABLE, id, toProviderRow(patch), normalizeIdentityProvider, "providers");

export const softDeleteIdentityProvider = (id) =>
  softDeleteRow(PROVIDERS_TABLE, id, "providers");

// ---------------------------------------------------------------------------
// Retention policies + exceptions
// ---------------------------------------------------------------------------

export const listRetentionPolicies = (projectId) =>
  listRows(POLICIES_TABLE, projectId, normalizeRetentionPolicy, "policies");

export function createRetentionPolicy(input) {
  if (!input?.projectId || !input?.name?.trim()) return Promise.resolve(null);
  const payload = toPolicyRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(POLICIES_TABLE, payload, normalizeRetentionPolicy, "policies");
}

export const updateRetentionPolicy = (id, patch) =>
  updateRow(POLICIES_TABLE, id, toPolicyRow(patch), normalizeRetentionPolicy, "policies");

export const softDeleteRetentionPolicy = (id) =>
  softDeleteRow(POLICIES_TABLE, id, "policies");

export const listRetentionExceptions = (projectId) =>
  listRows(EXCEPTIONS_TABLE, projectId, normalizeRetentionException, "exceptions");

export function createRetentionException(input) {
  if (!input?.projectId || !input?.targetId?.trim()) return Promise.resolve(null);
  const payload = toExceptionRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(EXCEPTIONS_TABLE, payload, normalizeRetentionException, "exceptions");
}

export const updateRetentionException = (id, patch) =>
  updateRow(EXCEPTIONS_TABLE, id, toExceptionRow(patch), normalizeRetentionException, "exceptions");

export const softDeleteRetentionException = (id) =>
  softDeleteRow(EXCEPTIONS_TABLE, id, "exceptions");

// ---------------------------------------------------------------------------
// Legal holds + preserved assets + audit history
// ---------------------------------------------------------------------------

export const listLegalHolds = (projectId) =>
  listRows(HOLDS_TABLE, projectId, normalizeLegalHold, "holds");

export function createLegalHold(input) {
  if (!input?.projectId || !input?.name?.trim()) return Promise.resolve(null);
  const payload = toHoldRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(HOLDS_TABLE, payload, normalizeLegalHold, "holds");
}

export const updateLegalHold = (id, patch) =>
  updateRow(HOLDS_TABLE, id, toHoldRow(patch), normalizeLegalHold, "holds");

export const softDeleteLegalHold = (id) => softDeleteRow(HOLDS_TABLE, id, "holds");

export const listLegalHoldAssets = (projectId) =>
  listRows(HOLD_ASSETS_TABLE, projectId, normalizeLegalHoldAsset, "holdAssets");

export function addLegalHoldAsset(input) {
  if (!input?.holdId || !input?.projectId || !input?.assetId?.trim()) {
    return Promise.resolve(null);
  }
  const payload = toHoldAssetRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(HOLD_ASSETS_TABLE, payload, normalizeLegalHoldAsset, "holdAssets");
}

export const removeLegalHoldAsset = (id) => softDeleteRow(HOLD_ASSETS_TABLE, id, "holdAssets");

// Audit history is append-only: reads plus a single writer. No update/delete.
export async function listLegalHoldEvents(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(HOLD_EVENTS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[governance.holdEvents.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeLegalHoldEvent);
  } catch (e) {
    console.error("[governance.holdEvents.list]", e);
    return null;
  }
}

export async function logLegalHoldEvent(input) {
  if (!input?.holdId || !input?.projectId || !input?.action) return null;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(HOLD_EVENTS_TABLE)
      .insert({
        hold_id: input.holdId,
        project_id: input.projectId,
        action: input.action,
        actor: input.actor || "",
        detail: input.detail || "",
      })
      .select("*")
      .single();
    if (error) {
      console.error("[governance.holdEvents.create]", error.message);
      return null;
    }
    return normalizeLegalHoldEvent(data);
  } catch (e) {
    console.error("[governance.holdEvents.create]", e);
    return null;
  }
}
