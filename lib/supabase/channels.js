"use client";

// Channels — owns assets.channels and assets.channel_runs.
//
// Destinations are config records only: what system, what source, on what
// schedule (credentials live in metadata). Runs are the local ledger of what
// was published — nothing here calls a third-party API.
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

const CHANNELS = "channels";
const RUNS = "channel_runs";

const CHANNEL_MAP = {
  projectId: "project_id",
  name: "name",
  kind: "kind",
  sourceKind: "source_kind",
  sourceId: "source_id",
  schedule: "schedule",
  status: "status",
  createdBy: "created_by",
};

export function normalizeChannel(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    kind: row.kind ?? "cms",
    sourceKind: row.source_kind ?? "collection",
    sourceId: row.source_id ?? null,
    schedule: row.schedule ?? "manual",
    status: row.status ?? "draft",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function channelRow(input) {
  const row = toRowGeneric(input, CHANNEL_MAP);
  if ("sourceId" in input) row.source_id = input.sourceId || null;
  return row;
}

export const listChannels = (projectId) =>
  listRows(CHANNELS, projectId).then((r) => (r ? r.map(normalizeChannel) : r));

export const getChannel = (id) => getRow(CHANNELS, id).then(normalizeChannel);

export const createChannel = (input) =>
  createRow(CHANNELS, channelRow(input)).then(normalizeChannel);

export const updateChannel = (id, patch) =>
  updateRow(CHANNELS, id, channelRow(patch)).then(normalizeChannel);

export const softDeleteChannel = (id) => softDeleteRow(CHANNELS, id);

// Runs --------------------------------------------------------------------------

const RUN_MAP = {
  projectId: "project_id",
  channelId: "channel_id",
  status: "status",
  publishedCount: "published_count",
  failedCount: "failed_count",
  error: "error",
};

export function normalizeChannelRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    channelId: row.channel_id ?? null,
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
    status: row.status ?? "running",
    publishedCount: Number(row.published_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    error: row.error ?? "",
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

function runRow(input) {
  const row = toRowGeneric(input, RUN_MAP, {
    numerics: ["publishedCount", "failedCount"],
  });
  if ("startedAt" in input) row.started_at = dateOrNull(input.startedAt);
  if ("finishedAt" in input) row.finished_at = dateOrNull(input.finishedAt);
  if ("channelId" in input) row.channel_id = input.channelId || null;
  return row;
}

export const listChannelRuns = (projectId) =>
  listRows(RUNS, projectId, { order: "started_at" }).then((r) =>
    r ? r.map(normalizeChannelRun) : r,
  );

/** Runs for one channel, newest first. */
export const listRunsForChannel = (channelId) =>
  listRows(RUNS, null, {
    order: "started_at",
    match: { channel_id: channelId },
  }).then((r) => (r ? r.map(normalizeChannelRun) : r));

export const createChannelRun = (input) =>
  createRow(RUNS, runRow(input)).then(normalizeChannelRun);

export const updateChannelRun = (id, patch) =>
  updateRow(RUNS, id, runRow(patch)).then(normalizeChannelRun);
