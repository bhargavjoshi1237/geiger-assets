// Data-access layer for the Licensing domain — owns `assets.license_rights`,
// `assets.license_templates`, `assets.license_price_rules`,
// `assets.license_quote_requests`, `assets.issued_licenses` and
// `assets.license_revenues`.
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const RIGHTS_TABLE = "license_rights";
const TEMPLATES_TABLE = "license_templates";
const PRICE_RULES_TABLE = "license_price_rules";
const QUOTES_TABLE = "license_quote_requests";
const ISSUED_TABLE = "issued_licenses";
const REVENUES_TABLE = "license_revenues";

function meta(row) {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// Generic helpers (tri-state contract: null = not configured/read failed,
// [] = no rows, object/true = success, false = write failed)
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
      console.error(`[licensing.${tag}.list]`, error.message);
      return null;
    }
    return (data || []).map(normalize);
  } catch (e) {
    console.error(`[licensing.${tag}.list]`, e);
    return null;
  }
}

async function getRow(table, id, normalize, tag) {
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
      console.error(`[licensing.${tag}.get]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[licensing.${tag}.get]`, e);
    return null;
  }
}

async function createRow(table, payload, normalize, tag) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.from(table).insert(payload).select("*").single();
    if (error) {
      console.error(`[licensing.${tag}.create]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[licensing.${tag}.create]`, e);
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
      console.error(`[licensing.${tag}.update]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[licensing.${tag}.update]`, e);
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
      console.error(`[licensing.${tag}.delete]`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[licensing.${tag}.delete]`, e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Rights inventory
// ---------------------------------------------------------------------------

export function normalizeRight(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    holderName: row.holder_name ?? "",
    title: row.title ?? "",
    rightType: row.right_type ?? "ownership",
    sharePercent: num(row.share_percent, 100),
    territories: row.territories ?? "",
    channels: row.channels ?? "",
    media: row.media ?? "",
    windowStart: row.window_start ?? null,
    windowEnd: row.window_end ?? null,
    status: row.status ?? "active",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toRightRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    holderName: "holder_name",
    title: "title",
    rightType: "right_type",
    territories: "territories",
    channels: "channels",
    media: "media",
    status: "status",
  };
  for (const [key, col] of Object.entries(map)) if (key in input) row[col] = input[key];
  if ("sharePercent" in input) row.share_percent = num(input.sharePercent, 0);
  if ("windowStart" in input) row.window_start = input.windowStart || null;
  if ("windowEnd" in input) row.window_end = input.windowEnd || null;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export const listRights = (projectId) => listRows(RIGHTS_TABLE, projectId, normalizeRight, "rights");
export const getRight = (id) => getRow(RIGHTS_TABLE, id, normalizeRight, "rights");

export function createRight(input) {
  if (!input?.projectId || !input?.holderName?.trim()) return Promise.resolve(null);
  const payload = toRightRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(RIGHTS_TABLE, payload, normalizeRight, "rights");
}

export const updateRight = (id, patch) =>
  updateRow(RIGHTS_TABLE, id, toRightRow(patch), normalizeRight, "rights");
export const softDeleteRight = (id) => softDeleteRow(RIGHTS_TABLE, id, "rights");

// ---------------------------------------------------------------------------
// License templates
// ---------------------------------------------------------------------------

export function normalizeLicenseTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    description: row.description ?? "",
    usageType: row.usage_type ?? "commercial",
    territories: row.territories ?? "",
    channels: row.channels ?? "",
    durationDays: Math.floor(num(row.duration_days, 365)),
    restrictions: row.restrictions ?? "",
    basePriceCents: Math.round(num(row.base_price_cents, 0)),
    currency: row.currency ?? "usd",
    isActive: row.is_active !== false,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toTemplateRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    name: "name",
    description: "description",
    usageType: "usage_type",
    territories: "territories",
    channels: "channels",
    restrictions: "restrictions",
    currency: "currency",
    isActive: "is_active",
  };
  for (const [key, col] of Object.entries(map)) if (key in input) row[col] = input[key];
  if ("durationDays" in input) row.duration_days = Math.max(0, Math.floor(num(input.durationDays, 0)));
  if ("basePriceCents" in input) row.base_price_cents = Math.max(0, Math.round(num(input.basePriceCents, 0)));
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export const listLicenseTemplates = (projectId) =>
  listRows(TEMPLATES_TABLE, projectId, normalizeLicenseTemplate, "templates");
export const getLicenseTemplate = (id) => getRow(TEMPLATES_TABLE, id, normalizeLicenseTemplate, "templates");

export function createLicenseTemplate(input) {
  if (!input?.projectId || !input?.name?.trim()) return Promise.resolve(null);
  const payload = toTemplateRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(TEMPLATES_TABLE, payload, normalizeLicenseTemplate, "templates");
}

export const updateLicenseTemplate = (id, patch) =>
  updateRow(TEMPLATES_TABLE, id, toTemplateRow(patch), normalizeLicenseTemplate, "templates");
export const softDeleteLicenseTemplate = (id) => softDeleteRow(TEMPLATES_TABLE, id, "templates");

// ---------------------------------------------------------------------------
// License price rules (base prices feeding the calculator)
// ---------------------------------------------------------------------------

export function normalizePriceRule(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    usageType: row.usage_type ?? "commercial",
    basePriceCents: Math.round(num(row.base_price_cents, 0)),
    currency: row.currency ?? "usd",
    notes: row.notes ?? "",
    isActive: row.is_active !== false,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toPriceRuleRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    name: "name",
    usageType: "usage_type",
    currency: "currency",
    notes: "notes",
    isActive: "is_active",
  };
  for (const [key, col] of Object.entries(map)) if (key in input) row[col] = input[key];
  if ("basePriceCents" in input) row.base_price_cents = Math.max(0, Math.round(num(input.basePriceCents, 0)));
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export const listPriceRules = (projectId) =>
  listRows(PRICE_RULES_TABLE, projectId, normalizePriceRule, "priceRules");
export const getPriceRule = (id) => getRow(PRICE_RULES_TABLE, id, normalizePriceRule, "priceRules");

export function createPriceRule(input) {
  if (!input?.projectId || !input?.name?.trim()) return Promise.resolve(null);
  const payload = toPriceRuleRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(PRICE_RULES_TABLE, payload, normalizePriceRule, "priceRules");
}

export const updatePriceRule = (id, patch) =>
  updateRow(PRICE_RULES_TABLE, id, toPriceRuleRow(patch), normalizePriceRule, "priceRules");
export const softDeletePriceRule = (id) => softDeleteRow(PRICE_RULES_TABLE, id, "priceRules");

// ---------------------------------------------------------------------------
// Custom quote requests
// ---------------------------------------------------------------------------

export function normalizeQuoteRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    requesterName: row.requester_name ?? "",
    requesterEmail: row.requester_email ?? "",
    usageType: row.usage_type ?? "commercial",
    territories: row.territories ?? "",
    channels: row.channels ?? "",
    durationDays: Math.floor(num(row.duration_days, 30)),
    exclusivity: row.exclusivity ?? "non_exclusive",
    estimatedCents: Math.round(num(row.estimated_cents, 0)),
    status: row.status ?? "pending",
    decidedAt: row.decided_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toQuoteRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    requesterName: "requester_name",
    requesterEmail: "requester_email",
    usageType: "usage_type",
    territories: "territories",
    channels: "channels",
    exclusivity: "exclusivity",
    status: "status",
  };
  for (const [key, col] of Object.entries(map)) if (key in input) row[col] = input[key];
  if ("durationDays" in input) row.duration_days = Math.max(0, Math.floor(num(input.durationDays, 0)));
  if ("estimatedCents" in input) row.estimated_cents = Math.max(0, Math.round(num(input.estimatedCents, 0)));
  if ("decidedAt" in input) row.decided_at = input.decidedAt || null;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export const listQuoteRequests = (projectId) =>
  listRows(QUOTES_TABLE, projectId, normalizeQuoteRequest, "quotes");
export const getQuoteRequest = (id) => getRow(QUOTES_TABLE, id, normalizeQuoteRequest, "quotes");

export function createQuoteRequest(input) {
  if (!input?.projectId || !input?.requesterName?.trim()) return Promise.resolve(null);
  const payload = toQuoteRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(QUOTES_TABLE, payload, normalizeQuoteRequest, "quotes");
}

export const updateQuoteRequest = (id, patch) =>
  updateRow(QUOTES_TABLE, id, toQuoteRow(patch), normalizeQuoteRequest, "quotes");
export const softDeleteQuoteRequest = (id) => softDeleteRow(QUOTES_TABLE, id, "quotes");

// ---------------------------------------------------------------------------
// Issued licenses
// ---------------------------------------------------------------------------

export function normalizeIssuedLicense(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    licenseeName: row.licensee_name ?? "",
    licenseeEmail: row.licensee_email ?? "",
    assetName: row.asset_name ?? "",
    templateId: row.template_id ?? null,
    usageType: row.usage_type ?? "commercial",
    territories: row.territories ?? "",
    channels: row.channels ?? "",
    issueDate: row.issue_date ?? null,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    status: row.status ?? "pending",
    certificateCode: row.certificate_code ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toIssuedRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    licenseeName: "licensee_name",
    licenseeEmail: "licensee_email",
    assetName: "asset_name",
    templateId: "template_id",
    usageType: "usage_type",
    territories: "territories",
    channels: "channels",
    status: "status",
    certificateCode: "certificate_code",
  };
  for (const [key, col] of Object.entries(map)) if (key in input) row[col] = input[key];
  if ("issueDate" in input) row.issue_date = input.issueDate || null;
  if ("startDate" in input) row.start_date = input.startDate || null;
  if ("endDate" in input) row.end_date = input.endDate || null;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export const listIssuedLicenses = (projectId) =>
  listRows(ISSUED_TABLE, projectId, normalizeIssuedLicense, "issued");
export const getIssuedLicense = (id) => getRow(ISSUED_TABLE, id, normalizeIssuedLicense, "issued");

export function createIssuedLicense(input) {
  if (!input?.projectId || !input?.licenseeName?.trim()) return Promise.resolve(null);
  const payload = toIssuedRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(ISSUED_TABLE, payload, normalizeIssuedLicense, "issued");
}

export const updateIssuedLicense = (id, patch) =>
  updateRow(ISSUED_TABLE, id, toIssuedRow(patch), normalizeIssuedLicense, "issued");
export const softDeleteIssuedLicense = (id) => softDeleteRow(ISSUED_TABLE, id, "issued");

// ---------------------------------------------------------------------------
// Revenue and royalties
// ---------------------------------------------------------------------------

export function normalizeRevenue(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    assetName: row.asset_name ?? "",
    licenseId: row.license_id ?? null,
    licenseeName: row.licensee_name ?? "",
    revenueType: row.revenue_type ?? "license",
    grossCents: Math.round(num(row.gross_cents, 0)),
    royaltyRatePercent: num(row.royalty_rate_percent, 0),
    sharePercent: num(row.share_percent, 100),
    minimumGuaranteeCents: Math.round(num(row.minimum_guarantee_cents, 0)),
    recoupedCents: Math.round(num(row.recouped_cents, 0)),
    periodStart: row.period_start ?? null,
    periodEnd: row.period_end ?? null,
    status: row.status ?? "pending",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toRevenueRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    assetName: "asset_name",
    licenseId: "license_id",
    licenseeName: "licensee_name",
    revenueType: "revenue_type",
    status: "status",
  };
  for (const [key, col] of Object.entries(map)) if (key in input) row[col] = input[key];
  if ("grossCents" in input) row.gross_cents = Math.max(0, Math.round(num(input.grossCents, 0)));
  if ("royaltyRatePercent" in input) row.royalty_rate_percent = num(input.royaltyRatePercent, 0);
  if ("sharePercent" in input) row.share_percent = num(input.sharePercent, 0);
  if ("minimumGuaranteeCents" in input)
    row.minimum_guarantee_cents = Math.max(0, Math.round(num(input.minimumGuaranteeCents, 0)));
  if ("recoupedCents" in input) row.recouped_cents = Math.max(0, Math.round(num(input.recoupedCents, 0)));
  if ("periodStart" in input) row.period_start = input.periodStart || null;
  if ("periodEnd" in input) row.period_end = input.periodEnd || null;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export const listRevenues = (projectId) =>
  listRows(REVENUES_TABLE, projectId, normalizeRevenue, "revenues");
export const getRevenue = (id) => getRow(REVENUES_TABLE, id, normalizeRevenue, "revenues");

export function createRevenue(input) {
  if (!input?.projectId || !input?.assetName?.trim()) return Promise.resolve(null);
  const payload = toRevenueRow(input);
  if (input.id) payload.id = input.id; // honor optimistic UUID
  return createRow(REVENUES_TABLE, payload, normalizeRevenue, "revenues");
}

export const updateRevenue = (id, patch) =>
  updateRow(REVENUES_TABLE, id, toRevenueRow(patch), normalizeRevenue, "revenues");
export const softDeleteRevenue = (id) => softDeleteRow(REVENUES_TABLE, id, "revenues");
