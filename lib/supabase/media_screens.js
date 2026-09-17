// Data-access layer for the media screens — owns three `assets` schema tables:
//   assets.media_annotations, assets.media_transcripts, assets.media_jobs
//
// These sit alongside the existing asset library (lib/supabase/assets.js); the
// nine media screens read their grids from listAssets() and keep their
// type-specific state (focal points, captions, OCR, edit/process jobs) here.
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const ANNOTATIONS_TABLE = "media_annotations";
const TRANSCRIPTS_TABLE = "media_transcripts";
const JOBS_TABLE = "media_jobs";

function meta(row) {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function normalizeMediaAnnotation(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    assetId: row.asset_id ?? null,
    kind: row.kind ?? "annotation",
    label: row.label ?? "",
    body: row.body ?? "",
    positionX: row.position_x == null ? null : Number(row.position_x),
    positionY: row.position_y == null ? null : Number(row.position_y),
    timestampSeconds: row.timestamp_seconds == null ? null : Number(row.timestamp_seconds),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toAnnotationRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    assetId: "asset_id",
    kind: "kind",
    label: "label",
    body: "body",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("positionX" in input) row.position_x = input.positionX == null ? null : Number(input.positionX);
  if ("positionY" in input) row.position_y = input.positionY == null ? null : Number(input.positionY);
  if ("timestampSeconds" in input) {
    row.timestamp_seconds = input.timestampSeconds == null ? null : Number(input.timestampSeconds);
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function normalizeMediaTranscript(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    assetId: row.asset_id ?? null,
    kind: row.kind ?? "transcript",
    language: row.language ?? "en",
    text: row.text ?? "",
    status: row.status ?? "draft",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toTranscriptRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    assetId: "asset_id",
    kind: "kind",
    language: "language",
    text: "text",
    status: "status",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function normalizeMediaJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    assetId: row.asset_id ?? null,
    jobType: row.job_type ?? "rendition",
    operation: row.operation ?? "preset",
    status: row.status ?? "queued",
    progress: Number(row.progress ?? 0),
    error: row.error ?? "",
    outputAssetId: row.output_asset_id ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toJobRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    assetId: "asset_id",
    jobType: "job_type",
    operation: "operation",
    status: "status",
    error: "error",
    outputAssetId: "output_asset_id",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("progress" in input) row.progress = Math.max(0, Math.min(100, Number(input.progress) || 0));
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function listBy(table, column, value, normalize, tag) {
  if (!value || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(table)
      .select("*")
      .eq(column, value)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(`[media_screens.${tag}.list]`, error.message);
      return null;
    }
    return (data || []).map(normalize);
  } catch (e) {
    console.error(`[media_screens.${tag}.list]`, e);
    return null;
  }
}

async function createInto(table, input, normalize, tag) {
  if (!input?.assetId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = table === ANNOTATIONS_TABLE
      ? toAnnotationRow(input)
      : table === TRANSCRIPTS_TABLE
        ? toTranscriptRow(input)
        : toJobRow(input);
    if (input.id) payload.id = input.id; // honor optimistic UUID
    const { data, error } = await sb.from(table).insert(payload).select("*").single();
    if (error) {
      console.error(`[media_screens.${tag}.create]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[media_screens.${tag}.create]`, e);
    return null;
  }
}

async function updateIn(table, id, patch, normalize, tag) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = table === ANNOTATIONS_TABLE
      ? toAnnotationRow(patch)
      : table === TRANSCRIPTS_TABLE
        ? toTranscriptRow(patch)
        : toJobRow(patch);
    const { data, error } = await sb.from(table).update(payload).eq("id", id).select("*").single();
    if (error) {
      console.error(`[media_screens.${tag}.update]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (e) {
    console.error(`[media_screens.${tag}.update]`, e);
    return null;
  }
}

async function softDeleteFrom(table, id, tag) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error(`[media_screens.${tag}.delete]`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[media_screens.${tag}.delete]`, e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Annotations (focal points, frame comments, annotations, watermarks, clips)
// ---------------------------------------------------------------------------

export function listMediaAnnotations(projectId) {
  return listBy(ANNOTATIONS_TABLE, "project_id", projectId, normalizeMediaAnnotation, "annotations");
}

export function listMediaAnnotationsByAsset(assetId) {
  return listBy(ANNOTATIONS_TABLE, "asset_id", assetId, normalizeMediaAnnotation, "annotations");
}

export function createMediaAnnotation(input) {
  return createInto(ANNOTATIONS_TABLE, input, normalizeMediaAnnotation, "annotations");
}

export function updateMediaAnnotation(id, patch) {
  return updateIn(ANNOTATIONS_TABLE, id, patch, normalizeMediaAnnotation, "annotations");
}

export function softDeleteMediaAnnotation(id) {
  return softDeleteFrom(ANNOTATIONS_TABLE, id, "annotations");
}

// ---------------------------------------------------------------------------
// Transcripts (captions, subtitles, transcripts, OCR)
// ---------------------------------------------------------------------------

export function listMediaTranscripts(projectId) {
  return listBy(TRANSCRIPTS_TABLE, "project_id", projectId, normalizeMediaTranscript, "transcripts");
}

export function listMediaTranscriptsByAsset(assetId) {
  return listBy(TRANSCRIPTS_TABLE, "asset_id", assetId, normalizeMediaTranscript, "transcripts");
}

export function createMediaTranscript(input) {
  return createInto(TRANSCRIPTS_TABLE, input, normalizeMediaTranscript, "transcripts");
}

export function updateMediaTranscript(id, patch) {
  return updateIn(TRANSCRIPTS_TABLE, id, patch, normalizeMediaTranscript, "transcripts");
}

export function softDeleteMediaTranscript(id) {
  return softDeleteFrom(TRANSCRIPTS_TABLE, id, "transcripts");
}

// ---------------------------------------------------------------------------
// Jobs (image edits, video processing, renditions)
// ---------------------------------------------------------------------------

export function listMediaJobs(projectId) {
  return listBy(JOBS_TABLE, "project_id", projectId, normalizeMediaJob, "jobs");
}

export function listMediaJobsByAsset(assetId) {
  return listBy(JOBS_TABLE, "asset_id", assetId, normalizeMediaJob, "jobs");
}

export function createMediaJob(input) {
  return createInto(JOBS_TABLE, input, normalizeMediaJob, "jobs");
}

export function updateMediaJob(id, patch) {
  return updateIn(JOBS_TABLE, id, patch, normalizeMediaJob, "jobs");
}

export function softDeleteMediaJob(id) {
  return softDeleteFrom(JOBS_TABLE, id, "jobs");
}
