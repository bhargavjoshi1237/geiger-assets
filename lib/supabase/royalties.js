"use client";

// Revenue & Royalties — owns assets.royalty_rules, assets.royalty_lines and
// assets.royalty_statements. Rules say who is owed what; lines are the accruals
// against licence revenue; statements settle a period for one rights holder.

import {
  createRow,
  createRows,
  dateOrNull,
  listRows,
  meta,
  softDeleteRow,
  toRowGeneric,
  updateRow,
} from "./row_helpers";

const RULES = "royalty_rules";
const LINES = "royalty_lines";
const STATEMENTS = "royalty_statements";

// Rules -----------------------------------------------------------------------

const RULE_MAP = {
  projectId: "project_id",
  rightsHolderId: "rights_holder_id",
  label: "label",
  scopeKind: "scope_kind",
  scopeId: "scope_id",
  ratePercent: "rate_percent",
  flatCents: "flat_cents",
  minimumGuaranteeCents: "minimum_guarantee_cents",
  recoupable: "recoupable",
  priority: "priority",
  isActive: "is_active",
  createdBy: "created_by",
};

export function normalizeRoyaltyRule(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    rightsHolderId: row.rights_holder_id ?? null,
    label: row.label ?? "",
    scopeKind: row.scope_kind ?? "global",
    scopeId: row.scope_id ?? null,
    ratePercent: Number(row.rate_percent ?? 0),
    flatCents: Number(row.flat_cents ?? 0),
    minimumGuaranteeCents: Number(row.minimum_guarantee_cents ?? 0),
    recoupable: Boolean(row.recoupable),
    priority: Number(row.priority ?? 0),
    isActive: row.is_active !== false,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function ruleRow(input) {
  const row = toRowGeneric(input, RULE_MAP, {
    numerics: ["ratePercent", "flatCents", "minimumGuaranteeCents", "priority"],
  });
  for (const key of ["rightsHolderId", "scopeId"]) {
    const col = RULE_MAP[key];
    if (key in input) row[col] = input[key] || null;
  }
  return row;
}

export const listRoyaltyRules = (projectId) =>
  listRows(RULES, projectId, { order: "priority", ascending: true }).then((r) =>
    r ? r.map(normalizeRoyaltyRule) : r,
  );

export const createRoyaltyRule = (input) =>
  createRow(RULES, ruleRow(input)).then(normalizeRoyaltyRule);

export const updateRoyaltyRule = (id, patch) =>
  updateRow(RULES, id, ruleRow(patch)).then(normalizeRoyaltyRule);

export const deleteRoyaltyRule = (id) => softDeleteRow(RULES, id);

// Lines -----------------------------------------------------------------------

const LINE_MAP = {
  projectId: "project_id",
  licenseId: "license_id",
  rightsHolderId: "rights_holder_id",
  royaltyRuleId: "royalty_rule_id",
  statementId: "statement_id",
  basisCents: "basis_cents",
  ratePercent: "rate_percent",
  amountCents: "amount_cents",
  currency: "currency",
  status: "status",
  note: "note",
  createdBy: "created_by",
};

export function normalizeRoyaltyLine(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    licenseId: row.license_id ?? null,
    rightsHolderId: row.rights_holder_id ?? null,
    royaltyRuleId: row.royalty_rule_id ?? null,
    statementId: row.statement_id ?? null,
    basisCents: Number(row.basis_cents ?? 0),
    ratePercent: Number(row.rate_percent ?? 0),
    amountCents: Number(row.amount_cents ?? 0),
    currency: row.currency ?? "usd",
    periodStart: row.period_start ?? "",
    status: row.status ?? "accrued",
    note: row.note ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function lineRow(input) {
  const row = toRowGeneric(input, LINE_MAP, {
    numerics: ["basisCents", "ratePercent", "amountCents"],
  });
  if ("periodStart" in input) row.period_start = dateOrNull(input.periodStart);
  for (const key of ["licenseId", "rightsHolderId", "royaltyRuleId", "statementId"]) {
    const col = LINE_MAP[key];
    if (key in input) row[col] = input[key] || null;
  }
  return row;
}

export const listRoyaltyLines = (projectId) =>
  listRows(LINES, projectId, { order: "created_at" }).then((r) =>
    r ? r.map(normalizeRoyaltyLine) : r,
  );

export const createRoyaltyLine = (input) =>
  createRow(LINES, lineRow(input)).then(normalizeRoyaltyLine);

export const createRoyaltyLines = (inputs) =>
  createRows(LINES, (inputs || []).map(lineRow)).then((r) =>
    r ? r.map(normalizeRoyaltyLine) : r,
  );

export const updateRoyaltyLine = (id, patch) =>
  updateRow(LINES, id, lineRow(patch)).then(normalizeRoyaltyLine);

export const deleteRoyaltyLine = (id) => softDeleteRow(LINES, id);

// Statements ------------------------------------------------------------------

const STATEMENT_MAP = {
  projectId: "project_id",
  rightsHolderId: "rights_holder_id",
  grossCents: "gross_cents",
  royaltyCents: "royalty_cents",
  minimumGuaranteeCents: "minimum_guarantee_cents",
  recoupedCents: "recouped_cents",
  payableCents: "payable_cents",
  currency: "currency",
  status: "status",
  note: "note",
  createdBy: "created_by",
};

export function normalizeStatement(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    rightsHolderId: row.rights_holder_id ?? null,
    periodStart: row.period_start ?? "",
    periodEnd: row.period_end ?? "",
    grossCents: Number(row.gross_cents ?? 0),
    royaltyCents: Number(row.royalty_cents ?? 0),
    minimumGuaranteeCents: Number(row.minimum_guarantee_cents ?? 0),
    recoupedCents: Number(row.recouped_cents ?? 0),
    payableCents: Number(row.payable_cents ?? 0),
    currency: row.currency ?? "usd",
    status: row.status ?? "draft",
    issuedAt: row.issued_at ?? "",
    paidAt: row.paid_at ?? "",
    note: row.note ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function statementRow(input) {
  const row = toRowGeneric(input, STATEMENT_MAP, {
    numerics: [
      "grossCents",
      "royaltyCents",
      "minimumGuaranteeCents",
      "recoupedCents",
      "payableCents",
    ],
  });
  if ("periodStart" in input) row.period_start = dateOrNull(input.periodStart);
  if ("periodEnd" in input) row.period_end = dateOrNull(input.periodEnd);
  if ("issuedAt" in input) row.issued_at = input.issuedAt || null;
  if ("paidAt" in input) row.paid_at = input.paidAt || null;
  if ("rightsHolderId" in input) row.rights_holder_id = input.rightsHolderId || null;
  return row;
}

export const listStatements = (projectId) =>
  listRows(STATEMENTS, projectId, { order: "period_start" }).then((r) =>
    r ? r.map(normalizeStatement) : r,
  );

export const createStatement = (input) =>
  createRow(STATEMENTS, statementRow(input)).then(normalizeStatement);

export const updateStatement = (id, patch) =>
  updateRow(STATEMENTS, id, statementRow(patch)).then(normalizeStatement);

export const deleteStatement = (id) => softDeleteRow(STATEMENTS, id);
