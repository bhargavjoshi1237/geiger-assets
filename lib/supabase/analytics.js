// Data-access layer for the Analytics domain — owns `assets.asset_events`,
// `assets.search_events`, `assets.portal_visits`, `assets.commerce_orders`,
// `assets.asset_licenses`, `assets.report_configs` and `assets.report_exports`.
//
// Anything already answered elsewhere stays there: delivery and storage
// metering (lib/media/usage.js over assets.project_usage + delivery_events),
// asset rows (lib/supabase/assets.js), duplicate groups
// (lib/supabase/duplicates.js), and project quotas
// (lib/supabase/settings.js). This module only persists what those modules do
// not: engagement/search/portal event logs, the commerce and license ledgers,
// and report configuration.
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

function clampLimit(limit, fallback, max) {
  const n = Math.floor(Number(limit));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

// ---------------------------------------------------------------------------
// Generic helpers (same tri-state contract as creator.js / memberships.js)
// ---------------------------------------------------------------------------

async function listLog(table, projectId, normalize, tag, { since, limit = 5000 } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    let q = sb.from(table).select("*").eq("project_id", projectId);
    if (since) q = q.gte("created_at", since);
    const { data, error } = await q
      .order("created_at", { ascending: false })
      .limit(clampLimit(limit, 5000, 10000));
    if (error) {
      console.error(`[analytics.${tag}.list]`, error.message);
      return null;
    }
    return (data || []).map(normalize);
  } catch (e) {
    console.error(`[analytics.${tag}.list]`, e);
    return null;
  }
}

async function recordLog(table, payload, normalize, tag) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.from(table).insert(payload).select("*").single();
    if (error) {
      console.error(`[analytics.${tag}.record]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[analytics.${tag}.record]`, e);
    return null;
  }
}

async function listLedger(table, projectId, normalize, tag) {
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
      console.error(`[analytics.${tag}.list]`, error.message);
      return null;
    }
    return (data || []).map(normalize);
  } catch (e) {
    console.error(`[analytics.${tag}.list]`, e);
    return null;
  }
}

async function createLedgerRow(table, payload, normalize, tag) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.from(table).insert(payload).select("*").single();
    if (error) {
      console.error(`[analytics.${tag}.create]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[analytics.${tag}.create]`, e);
    return null;
  }
}

async function updateLedgerRow(table, id, patch, normalize, tag) {
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
      console.error(`[analytics.${tag}.update]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[analytics.${tag}.update]`, e);
    return null;
  }
}

async function softDeleteLedgerRow(table, id, tag) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error(`[analytics.${tag}.delete]`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[analytics.${tag}.delete]`, e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Asset events (append-only engagement log — no update / delete, like
// membership_activity)
// ---------------------------------------------------------------------------

const ASSET_EVENT_KINDS = ["view", "download", "share", "embed"];

export function normalizeAssetEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    assetId: row.asset_id ?? null,
    kind: row.kind ?? "view",
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

export function listAssetEvents(projectId, options) {
  return listLog("asset_events", projectId, normalizeAssetEvent, "assetEvents", options);
}

export function recordAssetEvent(input) {
  if (!input?.projectId || !isSupabaseConfigured()) return Promise.resolve(null);
  const kind = ASSET_EVENT_KINDS.includes(input.kind) ? input.kind : "view";
  const payload = {
    project_id: input.projectId,
    asset_id: input.assetId ?? null,
    kind,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return recordLog("asset_events", payload, normalizeAssetEvent, "assetEvents");
}

// ---------------------------------------------------------------------------
// Search events (append-only log)
// ---------------------------------------------------------------------------

export function normalizeSearchEvent(row) {
  if (!row) return null;
  const filters = row.metadata?.filters;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    query: row.query ?? "",
    resultsCount: Number(row.results_count ?? 0),
    converted: Boolean(row.converted),
    filters: filters && typeof filters === "object" ? filters : {},
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

export function listSearchEvents(projectId, options) {
  return listLog("search_events", projectId, normalizeSearchEvent, "searchEvents", options);
}

export function recordSearchEvent(input) {
  if (!input?.projectId || !isSupabaseConfigured()) return Promise.resolve(null);
  const payload = {
    project_id: input.projectId,
    query: String(input.query ?? ""),
    results_count: Math.max(0, Math.floor(Number(input.resultsCount) || 0)),
    converted: Boolean(input.converted),
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };
  if (input.filters && typeof input.filters === "object") {
    payload.metadata = { ...payload.metadata, filters: input.filters };
  }
  if (input.id) payload.id = input.id;
  return recordLog("search_events", payload, normalizeSearchEvent, "searchEvents");
}

// ---------------------------------------------------------------------------
// Portal visits (append-only log)
// ---------------------------------------------------------------------------

const PORTAL_VISIT_KINDS = ["visit", "download", "signup"];

export function normalizePortalVisit(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    portalKey: row.portal_key ?? "",
    assetId: row.asset_id ?? null,
    kind: row.kind ?? "visit",
    referrer: row.referrer ?? "",
    country: row.country ?? "",
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

export function listPortalVisits(projectId, options) {
  return listLog("portal_visits", projectId, normalizePortalVisit, "portalVisits", options);
}

export function recordPortalVisit(input) {
  if (!input?.projectId || !isSupabaseConfigured()) return Promise.resolve(null);
  const payload = {
    project_id: input.projectId,
    portal_key: String(input.portalKey ?? ""),
    asset_id: input.assetId ?? null,
    kind: PORTAL_VISIT_KINDS.includes(input.kind) ? input.kind : "visit",
    referrer: String(input.referrer ?? ""),
    country: String(input.country ?? ""),
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };
  if (input.id) payload.id = input.id;
  return recordLog("portal_visits", payload, normalizePortalVisit, "portalVisits");
}

// ---------------------------------------------------------------------------
// Commerce orders (mutable ledger)
// ---------------------------------------------------------------------------

const ORDER_MAP = {
  projectId: "project_id",
  status: "status",
  currency: "currency",
};

export function normalizeOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    status: row.status ?? "pending",
    amountCents: Number(row.amount_cents ?? 0),
    currency: row.currency ?? "usd",
    refundedCents: Number(row.refunded_cents ?? 0),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toOrderRow(input) {
  const row = {};
  for (const [key, col] of Object.entries(ORDER_MAP)) {
    if (key in input) row[col] = input[key];
  }
  if ("amountCents" in input) row.amount_cents = Math.max(0, Math.round(Number(input.amountCents) || 0));
  if ("refundedCents" in input) {
    row.refunded_cents = Math.max(0, Math.round(Number(input.refundedCents) || 0));
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function listOrders(projectId) {
  return listLedger("commerce_orders", projectId, normalizeOrder, "orders");
}

export function createOrder(input) {
  if (!input?.projectId || !isSupabaseConfigured()) return Promise.resolve(null);
  const payload = toOrderRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createLedgerRow("commerce_orders", payload, normalizeOrder, "orders");
}

export function updateOrder(id, patch) {
  return updateLedgerRow("commerce_orders", id, toOrderRow(patch), normalizeOrder, "orders");
}

export function softDeleteOrder(id) {
  return softDeleteLedgerRow("commerce_orders", id, "orders");
}

// ---------------------------------------------------------------------------
// Asset licenses (mutable ledger)
// ---------------------------------------------------------------------------

const LICENSE_MAP = {
  projectId: "project_id",
  assetId: "asset_id",
  licensee: "licensee",
  kind: "kind",
  territory: "territory",
  status: "status",
  currency: "currency",
  renewedFrom: "renewed_from",
};

export function normalizeLicense(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    assetId: row.asset_id ?? null,
    licensee: row.licensee ?? "",
    kind: row.kind ?? "standard",
    territory: row.territory ?? "",
    status: row.status ?? "active",
    amountCents: Number(row.amount_cents ?? 0),
    currency: row.currency ?? "usd",
    startsAt: row.starts_at ?? null,
    expiresAt: row.expires_at ?? null,
    renewedFrom: row.renewed_from ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toLicenseRow(input) {
  const row = {};
  for (const [key, col] of Object.entries(LICENSE_MAP)) {
    if (key in input) row[col] = input[key] || null;
  }
  if (row.asset_id === null && !("assetId" in input)) delete row.asset_id;
  if ("licensee" in input) row.licensee = String(input.licensee ?? "");
  if ("kind" in input) row.kind = String(input.kind || "standard");
  if ("territory" in input) row.territory = String(input.territory ?? "");
  if ("status" in input) row.status = String(input.status || "active");
  if ("amountCents" in input) row.amount_cents = Math.max(0, Math.round(Number(input.amountCents) || 0));
  if ("startsAt" in input) row.starts_at = input.startsAt || null;
  if ("expiresAt" in input) row.expires_at = input.expiresAt || null;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function listLicenses(projectId) {
  return listLedger("asset_licenses", projectId, normalizeLicense, "licenses");
}

export function createLicense(input) {
  if (!input?.projectId || !isSupabaseConfigured()) return Promise.resolve(null);
  const payload = toLicenseRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createLedgerRow("asset_licenses", payload, normalizeLicense, "licenses");
}

export function updateLicense(id, patch) {
  return updateLedgerRow("asset_licenses", id, toLicenseRow(patch), normalizeLicense, "licenses");
}

export function softDeleteLicense(id) {
  return softDeleteLedgerRow("asset_licenses", id, "licenses");
}

// ---------------------------------------------------------------------------
// Report configs (mutable — dashboards and scheduled reports)
// ---------------------------------------------------------------------------

const REPORT_MAP = {
  projectId: "project_id",
  name: "name",
  kind: "kind",
  schedule: "schedule",
  isActive: "is_active",
};

export function normalizeReportConfig(row) {
  if (!row) return null;
  const bag = meta(row);
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    kind: row.kind ?? "report",
    schedule: row.schedule ?? "manual",
    isActive: row.is_active !== false,
    lastRunAt: row.last_run_at ?? null,
    // Saved report configuration lives in the metadata bag and round-trips as
    // first-class fields so updates never clobber it.
    filters: Array.isArray(bag.filters) ? bag.filters : [],
    formats: Array.isArray(bag.formats) ? bag.formats : ["csv"],
    shared: Boolean(bag.shared),
    sharedWith: Array.isArray(bag.sharedWith) ? bag.sharedWith : [],
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...bag,
  };
}

function toReportRow(input) {
  const row = {};
  for (const [key, col] of Object.entries(REPORT_MAP)) {
    if (key in input) row[col] = input[key];
  }
  if ("name" in input) row.name = String(input.name ?? "");
  if ("isActive" in input) row.is_active = Boolean(input.isActive);
  if ("lastRunAt" in input) row.last_run_at = input.lastRunAt || null;
  const bag = {};
  if ("filters" in input) bag.filters = Array.isArray(input.filters) ? input.filters : [];
  if ("formats" in input) bag.formats = Array.isArray(input.formats) ? input.formats : ["csv"];
  if ("shared" in input) bag.shared = Boolean(input.shared);
  if ("sharedWith" in input) bag.sharedWith = Array.isArray(input.sharedWith) ? input.sharedWith : [];
  if ("metadata" in input && input.metadata && typeof input.metadata === "object") {
    Object.assign(bag, input.metadata);
  }
  if (Object.keys(bag).length > 0) row.metadata = bag;
  return row;
}

// The full saved-config bag of a normalized row — pass it back on every update
// so a single-field edit never drops the filters, formats, or sharing state.
export function reportConfigBag(config) {
  return {
    filters: Array.isArray(config?.filters) ? config.filters : [],
    formats: Array.isArray(config?.formats) ? config.formats : ["csv"],
    shared: Boolean(config?.shared),
    sharedWith: Array.isArray(config?.sharedWith) ? config.sharedWith : [],
  };
}

export function listReportConfigs(projectId) {
  return listLedger("report_configs", projectId, normalizeReportConfig, "reports");
}

export function createReportConfig(input) {
  if (!input?.projectId || !String(input?.name ?? "").trim() || !isSupabaseConfigured()) {
    return Promise.resolve(null);
  }
  const payload = { ...toReportRow(input), name: String(input.name).trim() };
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createLedgerRow("report_configs", payload, normalizeReportConfig, "reports");
}

export function updateReportConfig(id, patch) {
  return updateLedgerRow("report_configs", id, toReportRow(patch), normalizeReportConfig, "reports");
}

export function softDeleteReportConfig(id) {
  return softDeleteLedgerRow("report_configs", id, "reports");
}

// ---------------------------------------------------------------------------
// Report exports (append-only run log)
// ---------------------------------------------------------------------------

export function normalizeReportExport(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    reportId: row.report_id ?? null,
    format: row.format ?? "csv",
    status: row.status ?? "completed",
    rowCount: Number(row.row_count ?? 0),
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

export function listReportExports(projectId, options) {
  return listLog("report_exports", projectId, normalizeReportExport, "reportExports", options);
}

export function createReportExport(input) {
  if (!input?.projectId || !isSupabaseConfigured()) return Promise.resolve(null);
  const format = input.format === "pdf" ? "pdf" : "csv";
  const payload = {
    project_id: input.projectId,
    report_id: input.reportId ?? null,
    format,
    status: input.status || "completed",
    row_count: Math.max(0, Math.floor(Number(input.rowCount) || 0)),
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return recordLog("report_exports", payload, normalizeReportExport, "reportExports");
}
