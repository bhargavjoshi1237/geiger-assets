"use client";

import { assetsClient, isSupabaseConfigured, isUuid } from "@/supabase/components/assets-client";
import { archiveAsset, trashAsset } from "@/lib/supabase/archive";
import { isPlaygroundActive } from "@/lib/playground/mode";
import { emitWorkflowEvent } from "@/lib/workflows/emit";

const validProject = (projectId) => isUuid(projectId) && isSupabaseConfigured();
const PAGE_SIZE = 500;

async function allPages(query) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await query().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) return rows;
  }
}

export async function canManageGovernance(projectId) {
  if (!validProject(projectId)) return false;
  try {
    const { data, error } = await assetsClient().rpc("rbac_allows", {
      p_permission: "assets.settings.manage",
      p_project: projectId,
      p_scope_type: null,
      p_scope_id: null,
    });
    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error("[governance.canManage]", error);
    return false;
  }
}

export function normalizeRetentionPolicy(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name ?? "",
    description: row.description ?? "",
    assetType: row.asset_type ?? "all",
    ageDays: Number(row.age_days ?? 30),
    action: row.action ?? "archive",
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function policyRow(input) {
  const row = {};
  if ("name" in input) row.name = String(input.name).trim();
  if ("description" in input) row.description = String(input.description ?? "").trim();
  if ("assetType" in input) row.asset_type = input.assetType;
  if ("ageDays" in input) row.age_days = Number(input.ageDays);
  if ("action" in input) row.action = input.action;
  return row;
}

export async function listRetentionPolicies(projectId) {
  if (!validProject(projectId)) return null;
  try {
    const sb = assetsClient();
    const rows = await allPages(() => sb.from("retention_policies").select("*")
      .eq("project_id", projectId).is("deleted_at", null)
      .order("created_at", { ascending: false }).order("id"));
    return rows.map(normalizeRetentionPolicy);
  } catch (error) {
    console.error("[governance.listRetentionPolicies]", error);
    return null;
  }
}

export async function createRetentionPolicy(projectId, input) {
  if (!validProject(projectId)) return null;
  try {
    const { data, error } = await assetsClient().from("retention_policies")
      .insert({ id: input.id, project_id: projectId, created_by: input.createdBy ?? null, ...policyRow(input) })
      .select("*").single();
    if (error) throw error;
    return normalizeRetentionPolicy(data);
  } catch (error) {
    console.error("[governance.createRetentionPolicy]", error);
    return null;
  }
}

export async function updateRetentionPolicy(id, input) {
  if (!isUuid(id) || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient().from("retention_policies")
      .update(policyRow(input)).eq("id", id).select("*").single();
    if (error) throw error;
    return normalizeRetentionPolicy(data);
  } catch (error) {
    console.error("[governance.updateRetentionPolicy]", error);
    return null;
  }
}

export async function deleteRetentionPolicy(id) {
  if (!isUuid(id) || !isSupabaseConfigured()) return false;
  try {
    const { data, error } = await assetsClient().from("retention_policies")
      .update({ deleted_at: new Date().toISOString() }).eq("id", id)
      .select("id").maybeSingle();
    if (error) throw error;
    return Boolean(data);
  } catch (error) {
    console.error("[governance.deleteRetentionPolicy]", error);
    return false;
  }
}

export async function listEligibleAssets(projectId, policy) {
  if (!validProject(projectId) || !policy) return null;
  try {
    const cutoff = new Date(Date.now() - policy.ageDays * 86400000).toISOString();
    let query = assetsClient().from("assets")
      .select("id,name,type,status,created_at", { count: "exact" })
      .eq("project_id", projectId).is("deleted_at", null)
      .lte("created_at", cutoff).order("created_at", { ascending: true }).limit(100);
    if (policy.assetType !== "all") query = query.eq("type", policy.assetType);
    if (policy.action === "archive") query = query.neq("status", "archived");
    const { data, count, error } = await query;
    if (error) throw error;
    return { rows: data ?? [], count: count ?? 0 };
  } catch (error) {
    console.error("[governance.listEligibleAssets]", error);
    return null;
  }
}

export async function applyRetentionPolicy(projectId, policy) {
  if (!validProject(projectId) || !isUuid(policy?.id)) return null;
  try {
    if (isPlaygroundActive()) {
      const preview = await listEligibleAssets(projectId, policy);
      if (!preview) return null;
      let succeeded = 0;
      let failed = 0;
      for (const asset of preview.rows) {
        const ok = policy.action === "archive" ? await archiveAsset(asset.id) : await trashAsset(asset.id);
        if (ok) succeeded += 1;
        else failed += 1;
      }
      return { succeeded, failed };
    }
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/governance/retention/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, policyId: policy.id }),
    });
    if (!response.ok) return null;
    const result = await response.json();
    if (policy.action === "archive") {
      for (const assetId of result.appliedIds ?? []) {
        emitWorkflowEvent({ type: "asset.archived", projectId, assetId });
      }
    }
    return result;
  } catch (error) {
    console.error("[governance.applyRetentionPolicy]", error);
    return null;
  }
}

export function normalizeLegalHold(row, assets = []) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name ?? "",
    matterReference: row.matter_reference ?? "",
    reason: row.reason ?? "",
    custodian: row.custodian ?? "",
    status: row.status ?? "active",
    assets,
    createdAt: row.created_at ?? null,
    releasedAt: row.released_at ?? null,
  };
}

function holdRow(input) {
  const row = {};
  if ("name" in input) row.name = String(input.name).trim();
  if ("matterReference" in input) row.matter_reference = String(input.matterReference ?? "").trim();
  if ("reason" in input) row.reason = String(input.reason ?? "").trim();
  if ("custodian" in input) row.custodian = String(input.custodian ?? "").trim();
  return row;
}

export async function listLegalHolds(projectId) {
  if (!validProject(projectId)) return null;
  try {
    const sb = assetsClient();
    const [holds, links] = await Promise.all([
      allPages(() => sb.from("legal_holds").select("*").eq("project_id", projectId)
        .order("created_at", { ascending: false }).order("id")),
      allPages(() => sb.from("legal_hold_assets").select("hold_id,asset_id,added_at,assets(name,type)")
        .eq("project_id", projectId).order("hold_id").order("asset_id")),
    ]);
    const byHold = new Map();
    for (const link of links) {
      const list = byHold.get(link.hold_id) ?? [];
      list.push({ id: link.asset_id, name: link.assets?.name ?? "Asset", type: link.assets?.type ?? "", addedAt: link.added_at });
      byHold.set(link.hold_id, list);
    }
    return holds.map((row) => normalizeLegalHold(row, byHold.get(row.id) ?? []));
  } catch (error) {
    console.error("[governance.listLegalHolds]", error);
    return null;
  }
}

export async function listLegalHoldEvents(holdId) {
  if (!isUuid(holdId) || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const rows = await allPages(() => sb.from("legal_hold_events")
      .select("id,event_type,asset_id,actor_id,created_at")
      .eq("hold_id", holdId).order("created_at", { ascending: false }).order("id"));
    return rows.map((row) => ({
      id: row.id,
      type: row.event_type,
      assetId: row.asset_id,
      actorId: row.actor_id,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error("[governance.listLegalHoldEvents]", error);
    return null;
  }
}

export async function createLegalHold(projectId, input) {
  if (!validProject(projectId)) return null;
  try {
    const { data, error } = await assetsClient().from("legal_holds")
      .insert({ id: input.id, project_id: projectId, created_by: input.createdBy ?? null, ...holdRow(input) })
      .select("*").single();
    if (error) throw error;
    return normalizeLegalHold(data);
  } catch (error) {
    console.error("[governance.createLegalHold]", error);
    return null;
  }
}

export async function updateLegalHold(id, input) {
  if (!isUuid(id) || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient().from("legal_holds")
      .update(holdRow(input)).eq("id", id).eq("status", "active").select("*").single();
    if (error) throw error;
    return normalizeLegalHold(data);
  } catch (error) {
    console.error("[governance.updateLegalHold]", error);
    return null;
  }
}

export async function releaseLegalHold(id, releasedBy) {
  if (!isUuid(id) || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient().from("legal_holds")
      .update({ status: "released", released_at: new Date().toISOString(), released_by: releasedBy ?? null })
      .eq("id", id).eq("status", "active").select("*").single();
    if (error) throw error;
    return normalizeLegalHold(data);
  } catch (error) {
    console.error("[governance.releaseLegalHold]", error);
    return null;
  }
}

export async function addLegalHoldAsset(hold, assetId, userId) {
  if (!isSupabaseConfigured() || !isUuid(assetId) || !hold?.id) return false;
  try {
    const { error } = await assetsClient().from("legal_hold_assets")
      .insert({ hold_id: hold.id, project_id: hold.projectId, asset_id: assetId, added_by: userId ?? null });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("[governance.addLegalHoldAsset]", error);
    return false;
  }
}

export async function removeLegalHoldAsset(holdId, assetId) {
  if (!isSupabaseConfigured() || !isUuid(holdId) || !isUuid(assetId)) return false;
  try {
    const { data, error } = await assetsClient().from("legal_hold_assets")
      .delete().eq("hold_id", holdId).eq("asset_id", assetId)
      .select("asset_id").maybeSingle();
    if (error) throw error;
    return Boolean(data);
  } catch (error) {
    console.error("[governance.removeLegalHoldAsset]", error);
    return false;
  }
}

export async function searchHoldAssets(projectId, search) {
  if (!validProject(projectId)) return null;
  try {
    let query = assetsClient().from("assets").select("id,name,type,status")
      .eq("project_id", projectId).is("deleted_at", null)
      .order("created_at", { ascending: false }).limit(30);
    if (search?.trim()) query = query.ilike("name", `%${search.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.error("[governance.searchHoldAssets]", error);
    return null;
  }
}
