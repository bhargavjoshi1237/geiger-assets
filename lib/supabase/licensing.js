"use client";

// Licensing — owns assets.licensees, assets.license_templates,
// assets.license_price_rules, assets.license_quotes, assets.licenses,
// assets.license_items and assets.license_renewals.
//
// DB is snake_case, the UI is camelCase; the mapping happens here. Reads return
// null (no DB / failure) or [] (configured, empty); writes return the normalized
// row, or null/false on failure. Nothing here throws or toasts.

import {
  createRow,
  createRows,
  dateOrNull,
  getRow,
  listRows,
  meta,
  softDeleteRow,
  toRowGeneric,
  updateRow,
} from "./row_helpers";

const LICENSEES = "licensees";
const TEMPLATES = "license_templates";
const PRICE_RULES = "license_price_rules";
const QUOTES = "license_quotes";
const LICENSES = "licenses";
const ITEMS = "license_items";
const RENEWALS = "license_renewals";

// Licensees -------------------------------------------------------------------

const LICENSEE_MAP = {
  projectId: "project_id",
  name: "name",
  contactName: "contact_name",
  email: "email",
  kind: "kind",
  territory: "territory",
  website: "website",
  notes: "notes",
  createdBy: "created_by",
};

export function normalizeLicensee(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    contactName: row.contact_name ?? "",
    email: row.email ?? "",
    kind: row.kind ?? "brand",
    territory: row.territory ?? "",
    website: row.website ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

export const listLicensees = (projectId) =>
  listRows(LICENSEES, projectId).then((r) => (r ? r.map(normalizeLicensee) : r));

export const createLicensee = (input) =>
  createRow(LICENSEES, toRowGeneric(input, LICENSEE_MAP)).then(normalizeLicensee);

export const updateLicensee = (id, patch) =>
  updateRow(LICENSEES, id, toRowGeneric(patch, LICENSEE_MAP)).then(normalizeLicensee);

export const deleteLicensee = (id) => softDeleteRow(LICENSEES, id);

// Templates -------------------------------------------------------------------

const TEMPLATE_MAP = {
  projectId: "project_id",
  name: "name",
  description: "description",
  usageType: "usage_type",
  defaultTerritories: "default_territories",
  defaultChannels: "default_channels",
  defaultDurationMonths: "default_duration_months",
  exclusivity: "exclusivity",
  restrictions: "restrictions",
  termsBody: "terms_body",
  requiresApproval: "requires_approval",
  status: "status",
  version: "version",
  position: "position",
  createdBy: "created_by",
};

export function normalizeTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    description: row.description ?? "",
    usageType: row.usage_type ?? "web",
    defaultTerritories: Array.isArray(row.default_territories) ? row.default_territories : [],
    defaultChannels: Array.isArray(row.default_channels) ? row.default_channels : [],
    defaultDurationMonths: Number(row.default_duration_months ?? 12),
    exclusivity: row.exclusivity ?? "non_exclusive",
    restrictions: Array.isArray(row.restrictions) ? row.restrictions : [],
    termsBody: row.terms_body ?? "",
    requiresApproval: Boolean(row.requires_approval),
    status: row.status ?? "draft",
    version: Number(row.version ?? 1),
    position: Number(row.position ?? 0),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

const templateRow = (input) =>
  toRowGeneric(input, TEMPLATE_MAP, {
    numerics: ["defaultDurationMonths", "version", "position"],
    arrays: ["defaultTerritories", "defaultChannels", "restrictions"],
  });

export const listTemplates = (projectId) =>
  listRows(TEMPLATES, projectId).then((r) => (r ? r.map(normalizeTemplate) : r));

export const createTemplate = (input) =>
  createRow(TEMPLATES, templateRow(input)).then(normalizeTemplate);

export const updateTemplate = (id, patch) =>
  updateRow(TEMPLATES, id, templateRow(patch)).then(normalizeTemplate);

export const deleteTemplate = (id) => softDeleteRow(TEMPLATES, id);

// Price rules -----------------------------------------------------------------

const PRICE_RULE_MAP = {
  projectId: "project_id",
  templateId: "template_id",
  kind: "kind",
  ruleKey: "rule_key",
  label: "label",
  multiplier: "multiplier",
  flatCents: "flat_cents",
  currency: "currency",
  position: "position",
  isActive: "is_active",
  createdBy: "created_by",
};

export function normalizePriceRule(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    templateId: row.template_id ?? null,
    kind: row.kind ?? "territory",
    ruleKey: row.rule_key ?? "",
    label: row.label ?? "",
    multiplier: Number(row.multiplier ?? 1),
    flatCents: Number(row.flat_cents ?? 0),
    currency: row.currency ?? "usd",
    position: Number(row.position ?? 0),
    isActive: row.is_active !== false,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function priceRuleRow(input) {
  const row = toRowGeneric(input, PRICE_RULE_MAP, {
    numerics: ["multiplier", "flatCents", "position"],
  });
  if ("templateId" in input) row.template_id = input.templateId || null;
  return row;
}

export const listPriceRules = (projectId) =>
  listRows(PRICE_RULES, projectId, { order: "position", ascending: true }).then((r) =>
    r ? r.map(normalizePriceRule) : r,
  );

export const createPriceRule = (input) =>
  createRow(PRICE_RULES, priceRuleRow(input)).then(normalizePriceRule);

export const createPriceRules = (inputs) =>
  createRows(PRICE_RULES, (inputs || []).map(priceRuleRow)).then((r) =>
    r ? r.map(normalizePriceRule) : r,
  );

export const updatePriceRule = (id, patch) =>
  updateRow(PRICE_RULES, id, priceRuleRow(patch)).then(normalizePriceRule);

export const deletePriceRule = (id) => softDeleteRow(PRICE_RULES, id);

// Quote requests --------------------------------------------------------------

const QUOTE_MAP = {
  projectId: "project_id",
  licenseeId: "licensee_id",
  templateId: "template_id",
  subject: "subject",
  scope: "scope",
  computedCents: "computed_cents",
  quotedCents: "quoted_cents",
  currency: "currency",
  status: "status",
  licenseId: "license_id",
  note: "note",
  createdBy: "created_by",
};

export function normalizeQuote(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    licenseeId: row.licensee_id ?? null,
    templateId: row.template_id ?? null,
    subject: row.subject ?? "",
    scope: row.scope && typeof row.scope === "object" ? row.scope : {},
    computedCents: Number(row.computed_cents ?? 0),
    quotedCents: Number(row.quoted_cents ?? 0),
    currency: row.currency ?? "usd",
    status: row.status ?? "requested",
    licenseId: row.license_id ?? null,
    note: row.note ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function quoteRow(input) {
  const row = toRowGeneric(input, QUOTE_MAP, { numerics: ["computedCents", "quotedCents"] });
  for (const key of ["licenseeId", "templateId", "licenseId"]) {
    const col = QUOTE_MAP[key];
    if (key in input) row[col] = input[key] || null;
  }
  if ("scope" in input) row.scope = input.scope || {};
  return row;
}

export const listQuotes = (projectId) =>
  listRows(QUOTES, projectId).then((r) => (r ? r.map(normalizeQuote) : r));

export const createQuote = (input) => createRow(QUOTES, quoteRow(input)).then(normalizeQuote);

export const updateQuote = (id, patch) =>
  updateRow(QUOTES, id, quoteRow(patch)).then(normalizeQuote);

export const deleteQuote = (id) => softDeleteRow(QUOTES, id);

// Licences --------------------------------------------------------------------

const LICENSE_MAP = {
  projectId: "project_id",
  reference: "reference",
  title: "title",
  templateId: "template_id",
  licenseeId: "licensee_id",
  status: "status",
  usageType: "usage_type",
  territories: "territories",
  channels: "channels",
  exclusivity: "exclusivity",
  graceDays: "grace_days",
  isPerpetual: "is_perpetual",
  autoRenew: "auto_renew",
  feeCents: "fee_cents",
  currency: "currency",
  priceBreakdown: "price_breakdown",
  royaltyRate: "royalty_rate",
  restrictions: "restrictions",
  termsBody: "terms_body",
  documentUrl: "document_url",
  notes: "notes",
  renewalOf: "renewal_of",
  renewedTo: "renewed_to",
  createdBy: "created_by",
};

export function normalizeLicense(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    reference: row.reference ?? "",
    title: row.title ?? "",
    templateId: row.template_id ?? null,
    licenseeId: row.licensee_id ?? null,
    status: row.status ?? "draft",
    usageType: row.usage_type ?? "web",
    territories: Array.isArray(row.territories) ? row.territories : [],
    channels: Array.isArray(row.channels) ? row.channels : [],
    exclusivity: row.exclusivity ?? "non_exclusive",
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    graceDays: Number(row.grace_days ?? 0),
    isPerpetual: Boolean(row.is_perpetual),
    autoRenew: Boolean(row.auto_renew),
    feeCents: Number(row.fee_cents ?? 0),
    currency: row.currency ?? "usd",
    priceBreakdown:
      row.price_breakdown && typeof row.price_breakdown === "object" ? row.price_breakdown : {},
    royaltyRate: Number(row.royalty_rate ?? 0),
    restrictions: Array.isArray(row.restrictions) ? row.restrictions : [],
    termsBody: row.terms_body ?? "",
    documentUrl: row.document_url ?? "",
    notes: row.notes ?? "",
    issuedAt: row.issued_at ?? "",
    renewalOf: row.renewal_of ?? null,
    renewedTo: row.renewed_to ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function licenseRow(input) {
  const row = toRowGeneric(input, LICENSE_MAP, {
    numerics: ["graceDays", "feeCents", "royaltyRate"],
    arrays: ["territories", "channels", "restrictions"],
  });
  if ("startDate" in input) row.start_date = dateOrNull(input.startDate);
  if ("endDate" in input) row.end_date = dateOrNull(input.endDate);
  if ("issuedAt" in input) row.issued_at = input.issuedAt || null;
  if ("priceBreakdown" in input) row.price_breakdown = input.priceBreakdown || {};
  for (const key of ["templateId", "licenseeId", "renewalOf", "renewedTo"]) {
    const col = LICENSE_MAP[key];
    if (key in input) row[col] = input[key] || null;
  }
  return row;
}

export const listLicenses = (projectId) =>
  listRows(LICENSES, projectId).then((r) => (r ? r.map(normalizeLicense) : r));

export const getLicense = (id) => getRow(LICENSES, id).then(normalizeLicense);

export const createLicense = (input) =>
  createRow(LICENSES, licenseRow(input)).then(normalizeLicense);

export const updateLicense = (id, patch) =>
  updateRow(LICENSES, id, licenseRow(patch)).then(normalizeLicense);

export const deleteLicense = (id) => softDeleteRow(LICENSES, id);

// Licence items ---------------------------------------------------------------

const ITEM_MAP = {
  projectId: "project_id",
  licenseId: "license_id",
  assetId: "asset_id",
  collectionId: "collection_id",
  rightsRecordId: "rights_record_id",
  externalTitle: "external_title",
  externalRef: "external_ref",
  versionLabel: "version_label",
  notes: "notes",
};

export function normalizeLicenseItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    licenseId: row.license_id ?? null,
    assetId: row.asset_id ?? null,
    collectionId: row.collection_id ?? null,
    rightsRecordId: row.rights_record_id ?? null,
    externalTitle: row.external_title ?? "",
    externalRef: row.external_ref ?? "",
    versionLabel: row.version_label ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function itemRow(input) {
  const row = toRowGeneric(input, ITEM_MAP);
  for (const key of ["assetId", "collectionId", "rightsRecordId"]) {
    const col = ITEM_MAP[key];
    if (key in input) row[col] = input[key] || null;
  }
  return row;
}

export const listLicenseItems = (projectId) =>
  listRows(ITEMS, projectId, { order: "created_at", ascending: true }).then((r) =>
    r ? r.map(normalizeLicenseItem) : r,
  );

export const listItemsForLicense = (licenseId) =>
  listRows(ITEMS, null, {
    order: "created_at",
    ascending: true,
    match: { license_id: licenseId },
  }).then((r) => (r ? r.map(normalizeLicenseItem) : r));

export const createLicenseItem = (input) =>
  createRow(ITEMS, itemRow(input)).then(normalizeLicenseItem);

export const createLicenseItems = (inputs) =>
  createRows(ITEMS, (inputs || []).map(itemRow)).then((r) =>
    r ? r.map(normalizeLicenseItem) : r,
  );

export const updateLicenseItem = (id, patch) =>
  updateRow(ITEMS, id, itemRow(patch)).then(normalizeLicenseItem);

export const deleteLicenseItem = (id) => softDeleteRow(ITEMS, id);

// Renewal history -------------------------------------------------------------

const RENEWAL_MAP = {
  projectId: "project_id",
  licenseId: "license_id",
  action: "action",
  feeCents: "fee_cents",
  currency: "currency",
  note: "note",
  createdBy: "created_by",
};

export function normalizeRenewal(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    licenseId: row.license_id ?? null,
    action: row.action ?? "renewed",
    previousEndDate: row.previous_end_date ?? "",
    newEndDate: row.new_end_date ?? "",
    feeCents: Number(row.fee_cents ?? 0),
    currency: row.currency ?? "usd",
    note: row.note ?? "",
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

function renewalRow(input) {
  const row = toRowGeneric(input, RENEWAL_MAP, { numerics: ["feeCents"] });
  if ("previousEndDate" in input) row.previous_end_date = dateOrNull(input.previousEndDate);
  if ("newEndDate" in input) row.new_end_date = dateOrNull(input.newEndDate);
  return row;
}

export const listRenewals = (projectId) =>
  listRows(RENEWALS, projectId, { order: "created_at", softDeleted: false }).then((r) =>
    r ? r.map(normalizeRenewal) : r,
  );

export const createRenewal = (input) =>
  createRow(RENEWALS, renewalRow(input)).then(normalizeRenewal);
