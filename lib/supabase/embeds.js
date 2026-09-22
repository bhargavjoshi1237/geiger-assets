"use client";

// Embeds — owns assets.embeds.
//
// Registered headless embeds: a kind (iframe/img/video/oembed/url), a
// polymorphic subject pointer, a version mode, and render params. Serve counts
// come from assets.delivery_events filtered on embed_id — this module never
// stores counters itself.
//
// DB is snake_case, the UI is camelCase; the mapping happens here. Reads return
// null (no DB / failure) or [] (configured, empty); writes return the normalized
// row, or null/false on failure. Nothing here throws or toasts.

import {
  createRow,
  getRow,
  listRows,
  meta,
  softDeleteRow,
  toRowGeneric,
  updateRow,
} from "./row_helpers";

const TABLE = "embeds";

const EMBED_MAP = {
  projectId: "project_id",
  name: "name",
  kind: "kind",
  subjectKind: "subject_kind",
  subjectId: "subject_id",
  versionMode: "version_mode",
  params: "params",
  status: "status",
  createdBy: "created_by",
};

export function normalizeEmbed(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    kind: row.kind ?? "iframe",
    subjectKind: row.subject_kind ?? "asset",
    subjectId: row.subject_id ?? null,
    versionMode: row.version_mode ?? "latest",
    params: row.params && typeof row.params === "object" ? row.params : {},
    status: row.status ?? "active",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function embedRow(input) {
  const row = toRowGeneric(input, EMBED_MAP);
  if ("subjectId" in input) row.subject_id = input.subjectId || null;
  if ("params" in input) row.params = input.params || {};
  return row;
}

export const listEmbeds = (projectId) =>
  listRows(TABLE, projectId).then((r) => (r ? r.map(normalizeEmbed) : r));

export const getEmbed = (id) => getRow(TABLE, id).then(normalizeEmbed);

export const createEmbed = (input) => createRow(TABLE, embedRow(input)).then(normalizeEmbed);

export const updateEmbed = (id, patch) =>
  updateRow(TABLE, id, embedRow(patch)).then(normalizeEmbed);

export const softDeleteEmbed = (id) => softDeleteRow(TABLE, id);
