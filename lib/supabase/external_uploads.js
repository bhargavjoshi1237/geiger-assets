// Data-access layer for Geiger Assets — owns the `assets` schema tables:
//   assets.upload_portals, assets.upload_submissions
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const TABLE = "upload_portals";
const SUB_TABLE = "upload_submissions";

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function normalizePortal(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  // The embedded `submissions:upload_submissions(count)` select returns an
  // array with a single { count } row — read it defensively.
  const submissionCount = Array.isArray(row.submissions)
    ? Number(row.submissions[0]?.count ?? 0)
    : 0;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    type: row.type ?? "link",
    slug: row.slug ?? "",
    status: row.status ?? "active",
    requireMetadata: Boolean(row.require_metadata),
    destinationFolder: row.destination_folder ?? "root",
    expiresAt: row.expires_at ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    submissionCount,
    ...meta,
  };
}

function toRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    name: "name",
    type: "type",
    slug: "slug",
    status: "status",
    destinationFolder: "destination_folder",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("requireMetadata" in input) row.require_metadata = Boolean(input.requireMetadata);
  if ("expiresAt" in input) row.expires_at = input.expiresAt || null;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function normalizeSubmission(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    portalId: row.portal_id ?? null,
    submitterName: row.submitter_name ?? "",
    submitterEmail: row.submitter_email ?? "",
    fileCount: Number(row.file_count ?? 0),
    status: row.status ?? "pending",
    note: row.note ?? "",
    createdAt: row.created_at ?? "",
    ...meta,
  };
}

function toSubmissionRow(input) {
  const row = {};
  const map = {
    portalId: "portal_id",
    submitterName: "submitter_name",
    submitterEmail: "submitter_email",
    status: "status",
    note: "note",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("fileCount" in input) row.file_count = Number(input.fileCount) || 0;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

// ---------------------------------------------------------------------------
// Portals CRUD
// ---------------------------------------------------------------------------

export async function listPortals(projectId) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    let q = sb.from(TABLE).select("*, submissions:upload_submissions(count)");
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) {
      console.error("[external_uploads.list]", error.message);
      return null;
    }
    return (data || []).map(normalizePortal);
  } catch (e) {
    console.error("[external_uploads.list]", e);
    return null;
  }
}

export async function getPortal(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*, submissions:upload_submissions(count)")
      .eq("id", id)
      .single();
    if (error) {
      console.error("[external_uploads.get]", error.message);
      return null;
    }
    return normalizePortal(data);
  } catch (e) {
    console.error("[external_uploads.get]", e);
    return null;
  }
}

export async function createPortal(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = toRow(input);
    if (input.id) payload.id = input.id; // honor optimistic UUID
    const { data, error } = await sb
      .from(TABLE)
      .insert(payload)
      .select("*, submissions:upload_submissions(count)")
      .single();
    if (error) {
      console.error("[external_uploads.create]", error.message);
      return null;
    }
    return normalizePortal(data);
  } catch (e) {
    console.error("[external_uploads.create]", e);
    return null;
  }
}

export async function updatePortal(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(toRow(patch))
      .eq("id", id)
      .select("*, submissions:upload_submissions(count)")
      .single();
    if (error) {
      console.error("[external_uploads.update]", error.message);
      return null;
    }
    return normalizePortal(data);
  } catch (e) {
    console.error("[external_uploads.update]", e);
    return null;
  }
}

export async function deletePortal(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb.from(TABLE).delete().eq("id", id);
    if (error) {
      console.error("[external_uploads.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[external_uploads.delete]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export async function listSubmissions(portalId) {
  if (!portalId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(SUB_TABLE)
      .select("*")
      .eq("portal_id", portalId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[external_uploads.listSubmissions]", error.message);
      return null;
    }
    return (data || []).map(normalizeSubmission);
  } catch (e) {
    console.error("[external_uploads.listSubmissions]", e);
    return null;
  }
}

export async function updateSubmission(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(SUB_TABLE)
      .update(toSubmissionRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[external_uploads.updateSubmission]", error.message);
      return null;
    }
    return normalizeSubmission(data);
  } catch (e) {
    console.error("[external_uploads.updateSubmission]", e);
    return null;
  }
}

// Lightweight read for KPI counts only — selects status to avoid pulling rows.
export async function listAllSubmissions() {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.from(SUB_TABLE).select("status");
    if (error) {
      console.error("[external_uploads.listAllSubmissions]", error.message);
      return null;
    }
    return data || [];
  } catch (e) {
    console.error("[external_uploads.listAllSubmissions]", e);
    return null;
  }
}
