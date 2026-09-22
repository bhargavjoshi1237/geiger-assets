"use client";

import { createClient } from "@/lib/supabase/client";
import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";
import { ALL_PERMISSION_KEYS } from "@/lib/rbac";

const ROLES_TABLE = "roles";
const GRANTS_TABLE = "role_grants";

function publicClient() {
  return isSupabaseConfigured() ? createClient() : null;
}

const PRODUCT_PREFIX = "assets.";

export function isProductKey(key) {
  return typeof key === "string" && key.startsWith(PRODUCT_PREFIX);
}

export function normalizeRole(row) {
  if (!row) return null;
  const permissions = Array.isArray(row.permissions) ? row.permissions : [];
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    key: row.key ?? "",
    name: row.name ?? "Untitled role",
    description: row.description ?? "",
    color: row.color ?? "slate",
    permissions,

    productPermissions: permissions.filter(isProductKey),
    isWildcard: permissions.includes("*"),
    isSystem: Boolean(row.is_system),
    sort: Number(row.sort ?? 0),
    createdAt: row.created_at ?? null,
  };
}

export function normalizeMember(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    email: row.email ?? "",
    name: row.name ?? "",
    avatarUrl: row.avatar_url ?? "",
    roleId: row.role_id ?? null,
    roleKey: row.role_key ?? "",
    roleName: row.role_name ?? "",
    status: row.status ?? "active",
    grantedAt: row.granted_at ?? null,
  };
}

export function normalizeCandidate(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    email: row.email ?? "",
    name: row.name ?? "",
    avatarUrl: row.avatar_url ?? "",
    orgRole: row.org_role ?? "",
  };
}

function toRoleRow(input) {
  const row = {};
  const map = { name: "name", description: "description", color: "color", key: "key" };
  for (const [key, col] of Object.entries(map)) if (key in input) row[col] = input[key];
  if ("sort" in input) row.sort = Number(input.sort) || 0;
  if ("permissions" in input) {
    row.permissions = Array.isArray(input.permissions) ? input.permissions : [];
  }
  return row;
}

export async function listRoles(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = publicClient();
    const { data, error } = await sb
      .from(ROLES_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("sort", { ascending: true });
    if (error) {
      console.error("[rbac.listRoles]", error.message);
      return null;
    }
    return (data || []).map(normalizeRole);
  } catch (e) {
    console.error("[rbac.listRoles]", e);
    return null;
  }
}

export async function createRole(projectId, input = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = publicClient();
    const payload = {
      ...toRoleRow(input),
      project_id: projectId,

      is_system: false,
    };
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(ROLES_TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[rbac.createRole]", error.message);
      return null;
    }
    return normalizeRole(data);
  } catch (e) {
    console.error("[rbac.createRole]", e);
    return null;
  }
}

export async function setRoleProductPermissions(roleId, nextProductKeys) {
  if (!roleId || !isSupabaseConfigured()) return null;
  try {
    const sb = publicClient();
    const { data: current, error: readError } = await sb
      .from(ROLES_TABLE)
      .select("permissions")
      .eq("id", roleId)
      .single();
    if (readError) {
      console.error("[rbac.setRoleProductPermissions]", readError.message);
      return null;
    }
    const existing = Array.isArray(current?.permissions) ? current.permissions : [];
    const foreign = existing.filter((k) => !isProductKey(k) && k !== "*");
    const wildcard = existing.includes("*") ? ["*"] : [];
    const wanted = (Array.isArray(nextProductKeys) ? nextProductKeys : [])
      .filter((k) => ALL_PERMISSION_KEYS.includes(k));
    const merged = Array.from(new Set([...wildcard, ...foreign, ...wanted])).sort();

    const { data, error } = await sb
      .from(ROLES_TABLE)
      .update({ permissions: merged })
      .eq("id", roleId)
      .select("*")
      .single();
    if (error) {
      console.error("[rbac.setRoleProductPermissions]", error.message);
      return null;
    }
    return normalizeRole(data);
  } catch (e) {
    console.error("[rbac.setRoleProductPermissions]", e);
    return null;
  }
}

export async function updateRole(roleId, patch = {}) {
  if (!roleId || !isSupabaseConfigured()) return null;
  try {
    const sb = publicClient();
    const { data, error } = await sb
      .from(ROLES_TABLE)
      .update(toRoleRow(patch))
      .eq("id", roleId)
      .select("*")
      .single();
    if (error) {
      console.error("[rbac.updateRole]", error.message);
      return null;
    }
    return normalizeRole(data);
  } catch (e) {
    console.error("[rbac.updateRole]", e);
    return null;
  }
}

export async function softDeleteRole(roleId) {
  if (!roleId || !isSupabaseConfigured()) return false;
  try {
    const sb = publicClient();
    const { error } = await sb
      .from(ROLES_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", roleId)
      .eq("is_system", false);
    if (error) {
      console.error("[rbac.softDeleteRole]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[rbac.softDeleteRole]", e);
    return false;
  }
}

export async function listMembers(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.rpc("rbac_list_members", { p_project_id: projectId });
    if (error) {
      console.error("[rbac.listMembers]", error.message);
      return null;
    }
    return (data || []).map(normalizeMember);
  } catch (e) {
    console.error("[rbac.listMembers]", e);
    return null;
  }
}

export async function listOrgCandidates(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.rpc("rbac_org_candidates", { p_project_id: projectId });
    if (error) {
      console.error("[rbac.listOrgCandidates]", error.message);
      return null;
    }
    return (data || []).map(normalizeCandidate);
  } catch (e) {
    console.error("[rbac.listOrgCandidates]", e);
    return null;
  }
}

export async function assignRole(projectId, userId, roleId, grantedBy = null) {
  if (!projectId || !userId || !roleId || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();

    const { error: clearError } = await sb
      .from(GRANTS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (clearError) {
      console.error("[rbac.assignRole]", clearError.message);
      return false;
    }
    const { error } = await sb.from(GRANTS_TABLE).insert({
      project_id: projectId,
      user_id: userId,
      role_id: roleId,
      status: "active",
      granted_by: grantedBy,
    });
    if (error) {
      console.error("[rbac.assignRole]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[rbac.assignRole]", e);
    return false;
  }
}

export async function revokeMember(projectId, userId) {
  if (!projectId || !userId || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(GRANTS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) {
      console.error("[rbac.revokeMember]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[rbac.revokeMember]", e);
    return false;
  }
}

export async function ensureMembership(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.rpc("rbac_ensure_membership", { p_project_id: projectId });
    if (error) {
      console.error("[rbac.ensureMembership]", error.message);
      return null;
    }
    return data ?? null;
  } catch (e) {
    console.error("[rbac.ensureMembership]", e);
    return null;
  }
}

export async function syncTeamFromOrg(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.rpc("sync_project_team", { p_project_id: projectId });
    if (error) {
      console.error("[rbac.syncTeamFromOrg]", error.message);
      return null;
    }
    return Number(data ?? 0);
  } catch (e) {
    console.error("[rbac.syncTeamFromOrg]", e);
    return null;
  }
}

export async function getMyGrant(projectId, userId) {
  if (!projectId || !userId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(GRANTS_TABLE)
      .select("role_id, status")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(1);
    if (error) {
      console.error("[rbac.getMyGrant]", error.message);
      return null;
    }
    const row = (data || [])[0];
    return row ? { roleId: row.role_id, status: row.status } : null;
  } catch (e) {
    console.error("[rbac.getMyGrant]", e);
    return null;
  }
}
