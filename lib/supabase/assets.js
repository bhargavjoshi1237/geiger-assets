// Data-access layer for Geiger Assets — owns the `assets` schema tables:
//   assets.assets, assets.asset_relationships, assets.asset_versions
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const TABLE = "assets";
const REL_TABLE = "asset_relationships";
const VER_TABLE = "asset_versions";

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function normalizeAsset(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    type: row.type ?? "image",
    format: row.format ?? "",
    sizeBytes: Number(row.size_bytes ?? 0),
    dimensions: row.dimensions ?? "",
    folder: row.folder ?? "root",
    status: row.status ?? "draft",
    tags: Array.isArray(row.tags) ? row.tags : [],
    description: row.description ?? "",
    downloads: Number(row.downloads ?? 0),
    color: row.color ?? "#737373",
    thumbnailUrl: row.thumbnail_url ?? "",
    storageKey: row.storage_key ?? null,
    storageBucket: row.storage_bucket ?? null,
    storageStatus: row.storage_status ?? "none",
    etag: row.etag ?? null,
    checksum: row.checksum ?? null,
    mimeType: row.mime_type ?? "",
    originalFilename: row.original_filename ?? "",
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
    type: "type",
    format: "format",
    folder: "folder",
    status: "status",
    description: "description",
    color: "color",
    thumbnailUrl: "thumbnail_url",
    storageKey: "storage_key",
    storageBucket: "storage_bucket",
    storageStatus: "storage_status",
    etag: "etag",
    checksum: "checksum",
    mimeType: "mime_type",
    originalFilename: "original_filename",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("sizeBytes" in input) row.size_bytes = Number(input.sizeBytes) || 0;
  if ("downloads" in input) row.downloads = Number(input.downloads) || 0;
  if ("dimensions" in input) row.dimensions = input.dimensions || null;
  if ("tags" in input) row.tags = Array.isArray(input.tags) ? input.tags : [];
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function normalizeRelationship(row) {
  if (!row) return null;
  const related = row.related && typeof row.related === "object" ? row.related : null;
  return {
    id: row.id,
    assetId: row.asset_id,
    relatedAssetId: row.related_asset_id ?? null,
    relationType: row.relation_type ?? "derived",
    label: row.label ?? "",
    createdAt: row.created_at ?? "",
    related: related
      ? {
          id: related.id,
          name: related.name ?? "",
          type: related.type ?? "image",
          format: related.format ?? "",
          color: related.color ?? "#737373",
          status: related.status ?? "draft",
        }
      : null,
  };
}

export function normalizeVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    assetId: row.asset_id,
    versionNumber: Number(row.version_number ?? 0),
    label: row.label ?? "",
    isCurrent: Boolean(row.is_current),
    sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
    storageKey: row.storage_key ?? null,
    etag: row.etag ?? null,
    checksum: row.checksum ?? null,
    mimeType: row.mime_type ?? "",
    note: row.note ?? "",
    createdAt: row.created_at ?? "",
  };
}

// ---------------------------------------------------------------------------
// Assets CRUD
// ---------------------------------------------------------------------------

export async function listAssets(projectId) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    let q = sb.from(TABLE).select("*").is("deleted_at", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) {
      console.error("[assets.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeAsset);
  } catch (e) {
    console.error("[assets.list]", e);
    return null;
  }
}

export async function getAsset(id) {
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
      console.error("[assets.get]", error.message);
      return null;
    }
    return normalizeAsset(data);
  } catch (e) {
    console.error("[assets.get]", e);
    return null;
  }
}

export async function createAsset(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = toRow(input);
    if (input.id) payload.id = input.id; // honor optimistic UUID
    const { data, error } = await sb.from(TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[assets.create]", error.message);
      return null;
    }
    return normalizeAsset(data);
  } catch (e) {
    console.error("[assets.create]", e);
    return null;
  }
}

export async function updateAsset(id, patch) {
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
      console.error("[assets.update]", error.message);
      return null;
    }
    return normalizeAsset(data);
  } catch (e) {
    console.error("[assets.update]", e);
    return null;
  }
}

export async function softDeleteAsset(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[assets.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[assets.delete]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

export async function listRelationships(assetId) {
  if (!assetId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(REL_TABLE)
      .select("*, related:related_asset_id(id,name,type,format,color,status)")
      .eq("asset_id", assetId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[assets.listRelationships]", error.message);
      return null;
    }
    return (data || []).map(normalizeRelationship);
  } catch (e) {
    console.error("[assets.listRelationships]", e);
    return null;
  }
}

export async function createRelationship(input) {
  if (!input?.assetId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = {
      asset_id: input.assetId,
      related_asset_id: input.relatedAssetId || null,
      relation_type: input.relationType || "derived",
      label: input.label || "",
    };
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(REL_TABLE)
      .insert(payload)
      .select("*, related:related_asset_id(id,name,type,format,color,status)")
      .single();
    if (error) {
      console.error("[assets.createRelationship]", error.message);
      return null;
    }
    return normalizeRelationship(data);
  } catch (e) {
    console.error("[assets.createRelationship]", e);
    return null;
  }
}

export async function deleteRelationship(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb.from(REL_TABLE).delete().eq("id", id);
    if (error) {
      console.error("[assets.deleteRelationship]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[assets.deleteRelationship]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export async function listVersions(assetId) {
  if (!assetId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(VER_TABLE)
      .select("*")
      .eq("asset_id", assetId)
      .order("version_number", { ascending: false });
    if (error) {
      console.error("[assets.listVersions]", error.message);
      return null;
    }
    return (data || []).map(normalizeVersion);
  } catch (e) {
    console.error("[assets.listVersions]", e);
    return null;
  }
}

// Make `versionId` the single current version for its asset. Clears the others
// first so the one-current-per-asset partial unique index never conflicts.
export async function restoreVersion(assetId, versionId) {
  if (!assetId || !versionId || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const cleared = await sb
      .from(VER_TABLE)
      .update({ is_current: false })
      .eq("asset_id", assetId);
    if (cleared.error) {
      console.error("[assets.restoreVersion]", cleared.error.message);
      return false;
    }
    const set = await sb
      .from(VER_TABLE)
      .update({ is_current: true })
      .eq("id", versionId);
    if (set.error) {
      console.error("[assets.restoreVersion]", set.error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[assets.restoreVersion]", e);
    return false;
  }
}
