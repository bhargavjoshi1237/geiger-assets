// Data-access layer for Geiger Assets — owns the `assets.folders` table, a
// self-referencing storage tree (folders point at a parent_id).
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const TABLE = "folders";

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function normalizeFolder(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    parentId: row.parent_id ?? null,
    path: row.path ?? "",
    storageLocation: row.storage_location ?? "hot",
    color: row.color ?? "#737373",
    sizeBytes: Number(row.size_bytes ?? 0),
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
    name: "name",
    path: "path",
    storageLocation: "storage_location",
    color: "color",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("parentId" in input) row.parent_id = input.parentId || null;
  if ("sizeBytes" in input) row.size_bytes = Number(input.sizeBytes) || 0;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listFolders(projectId) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    let q = sb.from(TABLE).select("*").is("deleted_at", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("name", { ascending: true });
    if (error) {
      console.error("[folders.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeFolder);
  } catch (e) {
    console.error("[folders.list]", e);
    return null;
  }
}

export async function getFolder(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error("[folders.get]", error.message);
      return null;
    }
    return normalizeFolder(data);
  } catch (e) {
    console.error("[folders.get]", e);
    return null;
  }
}

export async function createFolder(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = toRow(input);
    if (input.id) payload.id = input.id; // honor optimistic UUID
    const { data, error } = await sb.from(TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[folders.create]", error.message);
      return null;
    }
    return normalizeFolder(data);
  } catch (e) {
    console.error("[folders.create]", e);
    return null;
  }
}

export async function updateFolder(id, patch) {
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
      console.error("[folders.update]", error.message);
      return null;
    }
    return normalizeFolder(data);
  } catch (e) {
    console.error("[folders.update]", e);
    return null;
  }
}

export async function softDeleteFolder(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[folders.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[folders.delete]", e);
    return false;
  }
}
