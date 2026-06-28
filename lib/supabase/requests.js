// Data-access layer for Geiger Assets — owns the `assets.asset_requests` table.
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const TABLE = "asset_requests";

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function normalizeRequest(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    title: row.title ?? "",
    description: row.description ?? "",
    requester: row.requester ?? "",
    assignee: row.assignee ?? "",
    priority: row.priority ?? "medium",
    status: row.status ?? "open",
    dueDate: row.due_date ?? "",
    referenceAssetId: row.reference_asset_id ?? null,
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
    title: "title",
    description: "description",
    requester: "requester",
    assignee: "assignee",
    priority: "priority",
    status: "status",
    referenceAssetId: "reference_asset_id",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("dueDate" in input) row.due_date = input.dueDate || null; // "" -> null
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listRequests(projectId) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    let q = sb.from(TABLE).select("*").is("deleted_at", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) {
      console.error("[requests.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeRequest);
  } catch (e) {
    console.error("[requests.list]", e);
    return null;
  }
}

export async function getRequest(id) {
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
      console.error("[requests.get]", error.message);
      return null;
    }
    return normalizeRequest(data);
  } catch (e) {
    console.error("[requests.get]", e);
    return null;
  }
}

export async function createRequest(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = toRow(input);
    if (input.id) payload.id = input.id; // honor optimistic UUID
    const { data, error } = await sb.from(TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[requests.create]", error.message);
      return null;
    }
    return normalizeRequest(data);
  } catch (e) {
    console.error("[requests.create]", e);
    return null;
  }
}

export async function updateRequest(id, patch) {
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
      console.error("[requests.update]", error.message);
      return null;
    }
    return normalizeRequest(data);
  } catch (e) {
    console.error("[requests.update]", e);
    return null;
  }
}

export async function softDeleteRequest(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[requests.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[requests.delete]", e);
    return false;
  }
}
