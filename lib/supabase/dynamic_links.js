"use client";

// Dynamic links — owns assets.dynamic_links.
//
// A stable token whose transform (w/h/fit/format/quality/dpr) and target
// asset can change without the URL changing: re-point asset_id, keep token.
//
// DB is snake_case, the UI is camelCase; the mapping happens here. Reads return
// null (no DB / failure) or [] (configured, empty); writes return the normalized
// row, or null/false on failure. Nothing here throws or toasts.

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

const TABLE = "dynamic_links";

const LINK_MAP = {
  projectId: "project_id",
  name: "name",
  token: "token",
  assetId: "asset_id",
  transform: "transform",
  signed: "signed",
  status: "status",
  createdBy: "created_by",
};

export function normalizeDynamicLink(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    token: row.token ?? "",
    assetId: row.asset_id ?? null,
    transform: row.transform && typeof row.transform === "object" ? row.transform : {},
    signed: Boolean(row.signed),
    expiresAt: row.expires_at ?? null,
    status: row.status ?? "active",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function linkRow(input) {
  const row = toRowGeneric(input, LINK_MAP);
  if ("assetId" in input) row.asset_id = input.assetId || null;
  if ("transform" in input) row.transform = input.transform || {};
  if ("signed" in input) row.signed = Boolean(input.signed);
  if ("expiresAt" in input) row.expires_at = dateOrNull(input.expiresAt);
  return row;
}

/** URL-safe token; the public identity of the link (/dyn/<token>). */
export function mintLinkToken(length = 22) {
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

export const listDynamicLinks = (projectId) =>
  listRows(TABLE, projectId).then((r) => (r ? r.map(normalizeDynamicLink) : r));

export const getDynamicLink = (id) => getRow(TABLE, id).then(normalizeDynamicLink);

export const createDynamicLink = (input) =>
  createRow(TABLE, linkRow(input)).then(normalizeDynamicLink);

export const updateDynamicLink = (id, patch) =>
  updateRow(TABLE, id, linkRow(patch)).then(normalizeDynamicLink);

export const softDeleteDynamicLink = (id) => softDeleteRow(TABLE, id);
