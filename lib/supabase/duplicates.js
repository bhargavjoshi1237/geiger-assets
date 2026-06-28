// Data-access layer for Geiger Assets — owns the duplicate-review tables:
//   assets.duplicate_groups, assets.duplicate_members
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const TABLE = "duplicate_groups";
const MEMBER_TABLE = "duplicate_members";

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function normalizeGroup(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const members = Array.isArray(row.members) ? row.members : null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    matchType: row.match_type ?? "exact",
    similarity: Number(row.similarity ?? 0),
    status: row.status ?? "open",
    recommendedAction: row.recommended_action ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    memberCount: members ? members?.[0]?.count ?? 0 : Number(row.member_count ?? 0),
    ...meta,
  };
}

function toRow(input) {
  const row = {};
  const map = {
    status: "status",
    recommendedAction: "recommended_action",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export function normalizeMember(row) {
  if (!row) return null;
  const asset = row.asset && typeof row.asset === "object" ? row.asset : null;
  return {
    id: row.id,
    groupId: row.group_id,
    assetId: row.asset_id ?? null,
    isKeeper: Boolean(row.is_keeper),
    createdAt: row.created_at ?? "",
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
// Duplicate groups
// ---------------------------------------------------------------------------

export async function listGroups(projectId) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    let q = sb.from(TABLE).select("*, members:duplicate_members(count)");
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) {
      console.error("[duplicates.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeGroup);
  } catch (e) {
    console.error("[duplicates.list]", e);
    return null;
  }
}

export async function getGroup(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*, members:duplicate_members(count)")
      .eq("id", id)
      .single();
    if (error) {
      console.error("[duplicates.get]", error.message);
      return null;
    }
    return normalizeGroup(data);
  } catch (e) {
    console.error("[duplicates.get]", e);
    return null;
  }
}

export async function updateGroup(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(toRow(patch))
      .eq("id", id)
      .select("*, members:duplicate_members(count)")
      .single();
    if (error) {
      console.error("[duplicates.update]", error.message);
      return null;
    }
    return normalizeGroup(data);
  } catch (e) {
    console.error("[duplicates.update]", e);
    return null;
  }
}

export async function resolveGroup(id) {
  return updateGroup(id, { status: "resolved" });
}

export async function ignoreGroup(id) {
  return updateGroup(id, { status: "ignored" });
}

// ---------------------------------------------------------------------------
// Duplicate members
// ---------------------------------------------------------------------------

export async function listMembers(groupId) {
  if (!groupId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(MEMBER_TABLE)
      .select("*, asset:asset_id(id,name,type,format,color,status,size_bytes)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[duplicates.listMembers]", error.message);
      return null;
    }
    return (data || []).map(normalizeMember);
  } catch (e) {
    console.error("[duplicates.listMembers]", e);
    return null;
  }
}

// Make `memberId` the single keeper for its group. Clears the others first so
// only one member is ever flagged as the keeper.
export async function setKeeper(groupId, memberId) {
  if (!groupId || !memberId || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const cleared = await sb
      .from(MEMBER_TABLE)
      .update({ is_keeper: false })
      .eq("group_id", groupId);
    if (cleared.error) {
      console.error("[duplicates.setKeeper]", cleared.error.message);
      return false;
    }
    const set = await sb
      .from(MEMBER_TABLE)
      .update({ is_keeper: true })
      .eq("id", memberId);
    if (set.error) {
      console.error("[duplicates.setKeeper]", set.error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[duplicates.setKeeper]", e);
    return false;
  }
}
