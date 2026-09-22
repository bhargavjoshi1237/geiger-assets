"use client";

import { assetsClient, isSupabaseConfigured, isUuid } from "@/supabase/components/assets-client";
import { normalizeAsset } from "@/lib/supabase/assets";

const TABLE = "assets";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function mapArchiveRow(row) {
  const asset = normalizeAsset(row);
  if (!asset) return null;
  return { ...asset, deletedAt: row.deleted_at ?? null };
}

export async function listArchived(projectId) {
  if (!isSupabaseConfigured()) return null;
  if (projectId && !isUuid(projectId)) {
    console.warn("[archive.listArchived] skipping fetch: invalid projectId", projectId);
    return [];
  }
  try {
    const sb = assetsClient();
    let q = sb.from(TABLE).select("*").eq("status", "archived").is("deleted_at", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) {
      console.error("[archive.listArchived]", error.message);
      return null;
    }
    return (data || []).map(mapArchiveRow);
  } catch (e) {
    console.error("[archive.listArchived]", e);
    return null;
  }
}

export async function listTrashed(projectId) {
  if (!isSupabaseConfigured()) return null;
  if (projectId && !isUuid(projectId)) {
    console.warn("[archive.listTrashed] skipping fetch: invalid projectId", projectId);
    return [];
  }
  try {
    const sb = assetsClient();
    let q = sb.from(TABLE).select("*").not("deleted_at", "is", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("deleted_at", { ascending: false });
    if (error) {
      console.error("[archive.listTrashed]", error.message);
      return null;
    }
    return (data || []).map(mapArchiveRow);
  } catch (e) {
    console.error("[archive.listTrashed]", e);
    return null;
  }
}

export async function getArchivedOrTrashed(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.from(TABLE).select("*").eq("id", id).single();
    if (error) {
      console.error("[archive.get]", error.message);
      return null;
    }
    return mapArchiveRow(data);
  } catch (e) {
    console.error("[archive.get]", e);
    return null;
  }
}

export async function archiveAsset(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .update({ status: "archived" })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[archive.archiveAsset]", error.message);
      return null;
    }
    return mapArchiveRow(data);
  } catch (e) {
    console.error("[archive.archiveAsset]", e);
    return null;
  }
}

export async function restoreFromArchive(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb.from(TABLE).update({ status: "draft" }).eq("id", id);
    if (error) {
      console.error("[archive.restoreFromArchive]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[archive.restoreFromArchive]", e);
    return false;
  }
}

export async function trashAsset(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[archive.trashAsset]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[archive.trashAsset]", e);
    return false;
  }
}

export async function restoreFromTrash(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb.from(TABLE).update({ deleted_at: null }).eq("id", id);
    if (error) {
      console.error("[archive.restoreFromTrash]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[archive.restoreFromTrash]", e);
    return false;
  }
}

export async function purgeAsset(id) {
  if (!id) return false;
  // Irreversible destroy goes through the server so every byte (current
  // object, all versions, derivative cache) is freed per its backend before
  // the row is hard-deleted. Trash/restore keeps bytes; only purge frees.
  try {
    const res = await fetch(`${BASE}/api/storage/object`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: id, purge: true }),
    });
    if (!res.ok) {
      console.error("[archive.purgeAsset]", res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[archive.purgeAsset]", e);
    return false;
  }
}
