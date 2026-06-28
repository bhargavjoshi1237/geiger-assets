// Data-access layer for Geiger Assets — owns the `assets` schema tables:
//   assets.collections, assets.collection_assets
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const TABLE = "collections";
const JOIN_TABLE = "collection_assets";

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function normalizeCollection(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const items = Array.isArray(row.items) ? row.items : null;
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    type: row.type ?? "manual",
    coverColor: row.cover_color ?? "#737373",
    status: row.status ?? "active",
    isFavorite: Boolean(row.is_favorite),
    visibility: row.visibility ?? "private",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    assetCount: items ? items?.[0]?.count ?? 0 : Number(row.asset_count ?? 0),
    ...meta,
  };
}

function toRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    name: "name",
    description: "description",
    type: "type",
    coverColor: "cover_color",
    status: "status",
    visibility: "visibility",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("isFavorite" in input) row.is_favorite = Boolean(input.isFavorite);
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function normalizeMember(row) {
  if (!row) return null;
  const asset = row.asset && typeof row.asset === "object" ? row.asset : null;
  return {
    id: row.id,
    collectionId: row.collection_id,
    assetId: row.asset_id,
    position: Number(row.position ?? 0),
    asset: asset
      ? {
          id: asset.id,
          name: asset.name ?? "",
          type: asset.type ?? "image",
          format: asset.format ?? "",
          color: asset.color ?? "#737373",
          status: asset.status ?? "draft",
          sizeBytes: Number(asset.size_bytes ?? 0),
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Collections CRUD
// ---------------------------------------------------------------------------

export async function listCollections(projectId) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    let q = sb.from(TABLE).select("*, items:collection_assets(count)").is("deleted_at", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) {
      console.error("[collections.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeCollection);
  } catch (e) {
    console.error("[collections.list]", e);
    return null;
  }
}

export async function getCollection(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*, items:collection_assets(count)")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error("[collections.get]", error.message);
      return null;
    }
    return normalizeCollection(data);
  } catch (e) {
    console.error("[collections.get]", e);
    return null;
  }
}

export async function createCollection(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = toRow(input);
    if (input.id) payload.id = input.id; // honor optimistic UUID
    const { data, error } = await sb.from(TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[collections.create]", error.message);
      return null;
    }
    return normalizeCollection(data);
  } catch (e) {
    console.error("[collections.create]", e);
    return null;
  }
}

export async function updateCollection(id, patch) {
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
      console.error("[collections.update]", error.message);
      return null;
    }
    return normalizeCollection(data);
  } catch (e) {
    console.error("[collections.update]", e);
    return null;
  }
}

export async function softDeleteCollection(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[collections.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[collections.delete]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Collection members (collection_assets)
// ---------------------------------------------------------------------------

export async function listCollectionAssets(collectionId) {
  if (!collectionId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(JOIN_TABLE)
      .select("*, asset:asset_id(id,name,type,format,color,status,size_bytes)")
      .eq("collection_id", collectionId)
      .order("position", { ascending: true });
    if (error) {
      console.error("[collections.listAssets]", error.message);
      return null;
    }
    return (data || []).map(normalizeMember);
  } catch (e) {
    console.error("[collections.listAssets]", e);
    return null;
  }
}

export async function addAssetToCollection(collectionId, assetId) {
  if (!collectionId || !assetId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(JOIN_TABLE)
      .insert({ collection_id: collectionId, asset_id: assetId })
      .select("*, asset:asset_id(id,name,type,format,color,status,size_bytes)")
      .single();
    if (error) {
      console.error("[collections.addAsset]", error.message);
      return null;
    }
    return normalizeMember(data);
  } catch (e) {
    console.error("[collections.addAsset]", e);
    return null;
  }
}

export async function removeCollectionAsset(rowId) {
  if (!rowId || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb.from(JOIN_TABLE).delete().eq("id", rowId);
    if (error) {
      console.error("[collections.removeAsset]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[collections.removeAsset]", e);
    return false;
  }
}
