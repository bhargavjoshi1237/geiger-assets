"use client";

// Rights Inventory — owns assets.rights_holders and assets.rights_records.
// DB is snake_case, the UI is camelCase; the mapping happens here and nowhere
// else. Reads return null (no DB / failure) or [] (configured, empty).

import {
  createRow,
  dateOrNull,
  getRow,
  listRows,
  meta,
  softDeleteRow,
  toRowGeneric,
  updateRow,
} from "./row_helpers";

const HOLDERS = "rights_holders";
const RECORDS = "rights_records";

// Rights holders --------------------------------------------------------------

const HOLDER_MAP = {
  projectId: "project_id",
  name: "name",
  kind: "kind",
  email: "email",
  defaultRoyaltyRate: "default_royalty_rate",
  paymentTerms: "payment_terms",
  notes: "notes",
  createdBy: "created_by",
};

export function normalizeRightsHolder(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    kind: row.kind ?? "creator",
    email: row.email ?? "",
    defaultRoyaltyRate: Number(row.default_royalty_rate ?? 0),
    paymentTerms: row.payment_terms ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function holderRow(input) {
  return toRowGeneric(input, HOLDER_MAP, { numerics: ["defaultRoyaltyRate"] });
}

export const listRightsHolders = (projectId) =>
  listRows(HOLDERS, projectId).then((r) => (r ? r.map(normalizeRightsHolder) : r));

export const createRightsHolder = (input) =>
  createRow(HOLDERS, holderRow(input)).then(normalizeRightsHolder);

export const updateRightsHolder = (id, patch) =>
  updateRow(HOLDERS, id, holderRow(patch)).then(normalizeRightsHolder);

export const deleteRightsHolder = (id) => softDeleteRow(HOLDERS, id);

// Rights records --------------------------------------------------------------

const RECORD_MAP = {
  projectId: "project_id",
  title: "title",
  rightsHolderId: "rights_holder_id",
  assetId: "asset_id",
  collectionId: "collection_id",
  externalRef: "external_ref",
  acquisitionType: "acquisition_type",
  ownershipShare: "ownership_share",
  territories: "territories",
  channels: "channels",
  exclusivity: "exclusivity",
  status: "status",
  documentUrl: "document_url",
  notes: "notes",
  createdBy: "created_by",
};

export function normalizeRightsRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    title: row.title ?? "",
    rightsHolderId: row.rights_holder_id ?? null,
    assetId: row.asset_id ?? null,
    collectionId: row.collection_id ?? null,
    externalRef: row.external_ref ?? "",
    acquisitionType: row.acquisition_type ?? "licensed_in",
    ownershipShare: Number(row.ownership_share ?? 100),
    territories: Array.isArray(row.territories) ? row.territories : [],
    channels: Array.isArray(row.channels) ? row.channels : [],
    windowStart: row.window_start ?? "",
    windowEnd: row.window_end ?? "",
    exclusivity: row.exclusivity ?? "non_exclusive",
    status: row.status ?? "active",
    documentUrl: row.document_url ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function recordRow(input) {
  const row = toRowGeneric(input, RECORD_MAP, {
    numerics: ["ownershipShare"],
    arrays: ["territories", "channels"],
  });
  if ("windowStart" in input) row.window_start = dateOrNull(input.windowStart);
  if ("windowEnd" in input) row.window_end = dateOrNull(input.windowEnd);
  if ("assetId" in input) row.asset_id = input.assetId || null;
  if ("collectionId" in input) row.collection_id = input.collectionId || null;
  if ("rightsHolderId" in input) row.rights_holder_id = input.rightsHolderId || null;
  return row;
}

export const listRightsRecords = (projectId) =>
  listRows(RECORDS, projectId).then((r) => (r ? r.map(normalizeRightsRecord) : r));

export const getRightsRecord = (id) => getRow(RECORDS, id).then(normalizeRightsRecord);

export const createRightsRecord = (input) =>
  createRow(RECORDS, recordRow(input)).then(normalizeRightsRecord);

export const updateRightsRecord = (id, patch) =>
  updateRow(RECORDS, id, recordRow(patch)).then(normalizeRightsRecord);

export const deleteRightsRecord = (id) => softDeleteRow(RECORDS, id);
