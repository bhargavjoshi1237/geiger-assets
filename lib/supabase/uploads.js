// Data-access layer for the Upload Center — owns the `assets.upload_jobs` table.
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const TABLE = "upload_jobs";

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function normalizeUploadJob(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    filename: row.filename ?? "",
    fileType: row.file_type ?? "image",
    sizeBytes: Number(row.size_bytes ?? 0),
    status: row.status ?? "queued",
    progress: Number(row.progress ?? 0),
    source: row.source ?? "drag-drop",
    error: row.error ?? "",
    assetId: row.asset_id ?? null,
    storageKey: row.storage_key ?? null,
    uploadMode: row.upload_mode ?? "presigned",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta,
  };
}

function toRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    filename: "filename",
    fileType: "file_type",
    status: "status",
    source: "source",
    error: "error",
    assetId: "asset_id",
    storageKey: "storage_key",
    uploadMode: "upload_mode",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("sizeBytes" in input) row.size_bytes = Number(input.sizeBytes) || 0;
  if ("progress" in input) row.progress = Number(input.progress) || 0;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listUploadJobs(projectId) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    let q = sb.from(TABLE).select("*");
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) {
      console.error("[uploads.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeUploadJob);
  } catch (e) {
    console.error("[uploads.list]", e);
    return null;
  }
}

export async function getUploadJob(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      console.error("[uploads.get]", error.message);
      return null;
    }
    return normalizeUploadJob(data);
  } catch (e) {
    console.error("[uploads.get]", e);
    return null;
  }
}

export async function createUploadJob(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = toRow(input);
    if (input.id) payload.id = input.id; // honor optimistic UUID
    const { data, error } = await sb.from(TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[uploads.create]", error.message);
      return null;
    }
    return normalizeUploadJob(data);
  } catch (e) {
    console.error("[uploads.create]", e);
    return null;
  }
}

export async function updateUploadJob(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(toRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[uploads.update]", error.message);
      return null;
    }
    return normalizeUploadJob(data);
  } catch (e) {
    console.error("[uploads.update]", e);
    return null;
  }
}

export async function deleteUploadJob(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb.from(TABLE).delete().eq("id", id);
    if (error) {
      console.error("[uploads.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[uploads.delete]", e);
    return false;
  }
}
