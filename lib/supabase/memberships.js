"use client";

// Data access for the memberships domain: access rules, member activity log,
// billing invoices, and gallery integrations.
//
// DB is snake_case, the UI is camelCase; the mapping happens here and nowhere
// else. Pure data access: validate, console.error on failure, return
// null/false/[]. Never throw, never toast — the screen owns UX.
//
// Tri-state contract (same as creator.js):
//   null -> not configured or read failed | [] -> configured, no rows
//   object / true -> success | false -> a write failed.

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

function meta(row) {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

function toRowGeneric(input, map, numerics = []) {
  const row = {};
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  for (const key of numerics) {
    if (key in input) {
      const col = map[key] || key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      row[col] = Number(input[key]) || 0;
    }
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

// Empty-string dates carry no meaning for timestamptz columns — fold them to
// null so one update helper serves full-form saves and inline edits alike.
function nullDateFields(payload, cols) {
  for (const col of cols) {
    if (col in payload && payload[col] === "") payload[col] = null;
  }
  return payload;
}

async function listRows(table, projectId, order = "updated_at") {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    let q = sb.from(table).select("*");
    if (table !== "membership_activity") {
      q = q.is("deleted_at", null);
    }
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order(order, { ascending: false });
    if (error) {
      console.error(`[memberships.${table}.list]`, error.message);
      return null;
    }
    return data ?? [];
  } catch (err) {
    console.error(`[memberships.${table}.list]`, err?.message);
    return null;
  }
}

async function getRow(table, id, normalize) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.from(table).select("*").eq("id", id).single();
    if (error) {
      console.error(`[memberships.${table}.get]`, error.message);
      return null;
    }
    return normalize ? normalize(data) : data;
  } catch (err) {
    console.error(`[memberships.${table}.get]`, err?.message);
    return null;
  }
}

async function createRow(table, input, normalize) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = { ...input };
    if (input.id) payload.id = input.id; // honor optimistic UUID
    const { data, error } = await sb.from(table).insert(payload).select("*").single();
    if (error) {
      console.error(`[memberships.${table}.create]`, error.message);
      return null;
    }
    return normalize ? normalize(data) : data;
  } catch (err) {
    console.error(`[memberships.${table}.create]`, err?.message);
    return null;
  }
}

async function updateRow(table, id, patch, normalize) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.from(table).update(patch).eq("id", id).select("*").single();
    if (error) {
      console.error(`[memberships.${table}.update]`, error.message);
      return false;
    }
    return normalize ? normalize(data) : true;
  } catch (err) {
    console.error(`[memberships.${table}.update]`, err?.message);
    return false;
  }
}

async function softDeleteRow(table, id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      console.error(`[memberships.${table}.delete]`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[memberships.${table}.delete]`, err?.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Access rules — one row binds a scope (folder | collection | gallery) to a
// tier plus a set of allowances (login gate, paywall, hi-res, watermark…).
// ---------------------------------------------------------------------------

const ACCESS_RULE_MAP = {
  projectId: "project_id", name: "name", scopeType: "scope_type",
  scopeId: "scope_id", scopeName: "scope_name", tierId: "tier_id",
  loginRequired: "login_required", paywallEnabled: "paywall_enabled",
  allowHiresDownload: "allow_hires_download", watermarkBypass: "watermark_bypass",
  previewOnly: "preview_only", metadataVisible: "metadata_visible",
  isActive: "is_active", createdBy: "created_by",
};

export function normalizeAccessRule(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, name: row.name ?? "",
    scopeType: row.scope_type ?? "collection", scopeId: row.scope_id ?? null,
    scopeName: row.scope_name ?? "", tierId: row.tier_id ?? null,
    loginRequired: row.login_required !== false,
    paywallEnabled: Boolean(row.paywall_enabled),
    allowHiresDownload: Boolean(row.allow_hires_download),
    watermarkBypass: Boolean(row.watermark_bypass),
    previewOnly: Boolean(row.preview_only),
    metadataVisible: row.metadata_visible !== false,
    isActive: row.is_active !== false,
    position: Number(row.position ?? 0),
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

function toAccessRuleRow(input) {
  const row = toRowGeneric(input, ACCESS_RULE_MAP, ["position"]);
  if ("scopeId" in row && !row.scope_id) row.scope_id = null;
  if ("tierId" in row && !row.tier_id) row.tier_id = null;
  return row;
}

export const listAccessRules = (projectId) => listRows("membership_access_rules", projectId).then((r) => (r ? r.map(normalizeAccessRule) : r));
export const getAccessRule = (id) => getRow("membership_access_rules", id, normalizeAccessRule);
export const createAccessRule = (input) => createRow("membership_access_rules", toAccessRuleRow(input), normalizeAccessRule);
export const updateAccessRule = (id, input) => updateRow("membership_access_rules", id, toAccessRuleRow(input), normalizeAccessRule);
export const softDeleteAccessRule = (id) => softDeleteRow("membership_access_rules", id);

// ---------------------------------------------------------------------------
// Member activity — append-only log (logins, views, downloads, signups, tier
// changes). No updated_at / deleted_at / get / update: history is immutable.
// ---------------------------------------------------------------------------

export function normalizeActivity(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, memberId: row.member_id ?? null,
    kind: row.kind ?? "view", detail: row.detail ?? "",
    assetId: row.asset_id ?? null,
    createdAt: row.created_at ?? "", ...meta(row),
  };
}

export const listActivity = (projectId) => listRows("membership_activity", projectId, "created_at").then((r) => (r ? r.map(normalizeActivity) : r));
export const recordActivity = (input) => createRow("membership_activity", {
  project_id: input.projectId ?? null, member_id: input.memberId ?? null,
  kind: input.kind || "view", detail: input.detail || "",
  asset_id: input.assetId ?? null,
}, normalizeActivity);

// ---------------------------------------------------------------------------
// Invoices — renewals, one-off charges, the failed-payment dunning queue and
// refunds. Providers are configuration only; this table is the ledger.
// ---------------------------------------------------------------------------

const INVOICE_MAP = {
  projectId: "project_id", memberId: "member_id", subscriptionId: "subscription_id",
  number: "number", status: "status", currency: "currency", provider: "provider",
  dueAt: "due_at", paidAt: "paid_at", lastError: "last_error", createdBy: "created_by",
};

export function normalizeInvoice(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, memberId: row.member_id ?? null,
    subscriptionId: row.subscription_id ?? null, number: row.number ?? "",
    status: row.status ?? "open", amountCents: Number(row.amount_cents ?? 0),
    currency: row.currency ?? "usd", provider: row.provider ?? "manual",
    dueAt: row.due_at ?? "", paidAt: row.paid_at ?? "",
    attemptCount: Number(row.attempt_count ?? 0), lastError: row.last_error ?? "",
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

function toInvoiceRow(input) {
  const row = toRowGeneric(input, INVOICE_MAP, ["amountCents", "attemptCount"]);
  if ("memberId" in row && !row.member_id) row.member_id = null;
  if ("subscriptionId" in row && !row.subscription_id) row.subscription_id = null;
  return nullDateFields(row, ["due_at", "paid_at"]);
}

export const listInvoices = (projectId) => listRows("membership_invoices", projectId).then((r) => (r ? r.map(normalizeInvoice) : r));
export const getInvoice = (id) => getRow("membership_invoices", id, normalizeInvoice);
export const createInvoice = (input) => createRow("membership_invoices", toInvoiceRow(input), normalizeInvoice);
export const updateInvoice = (id, input) => updateRow("membership_invoices", id, toInvoiceRow(input), normalizeInvoice);
export const softDeleteInvoice = (id) => softDeleteRow("membership_invoices", id);

// ---------------------------------------------------------------------------
// Gallery links — membership features attached to showcase galleries and
// asset storefronts (login, member pricing, paywalls, signup forms, banners).
// ---------------------------------------------------------------------------

const GALLERY_LINK_MAP = {
  projectId: "project_id", galleryId: "gallery_id", galleryName: "gallery_name",
  tierId: "tier_id", loginRequired: "login_required",
  memberPricingEnabled: "member_pricing_enabled", paywallEnabled: "paywall_enabled",
  signupFormEnabled: "signup_form_enabled", welcomeBanner: "welcome_banner",
  isActive: "is_active", createdBy: "created_by",
};

export function normalizeGalleryLink(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, galleryId: row.gallery_id ?? null,
    galleryName: row.gallery_name ?? "", tierId: row.tier_id ?? null,
    loginRequired: row.login_required !== false,
    memberPricingEnabled: Boolean(row.member_pricing_enabled),
    paywallEnabled: Boolean(row.paywall_enabled),
    signupFormEnabled: Boolean(row.signup_form_enabled),
    welcomeBanner: row.welcome_banner ?? "",
    isActive: row.is_active !== false,
    position: Number(row.position ?? 0),
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

function toGalleryLinkRow(input) {
  const row = toRowGeneric(input, GALLERY_LINK_MAP, ["position"]);
  if ("galleryId" in row && !row.gallery_id) row.gallery_id = null;
  if ("tierId" in row && !row.tier_id) row.tier_id = null;
  return row;
}

export const listGalleryLinks = (projectId) => listRows("membership_gallery_links", projectId).then((r) => (r ? r.map(normalizeGalleryLink) : r));
export const getGalleryLink = (id) => getRow("membership_gallery_links", id, normalizeGalleryLink);
export const createGalleryLink = (input) => createRow("membership_gallery_links", toGalleryLinkRow(input), normalizeGalleryLink);
export const updateGalleryLink = (id, input) => updateRow("membership_gallery_links", id, toGalleryLinkRow(input), normalizeGalleryLink);
export const softDeleteGalleryLink = (id) => softDeleteRow("membership_gallery_links", id);
