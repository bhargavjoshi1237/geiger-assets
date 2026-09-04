import rbacConfig, { navPermissionKey, navSlug } from "@/geiger-rbac.config";

export { navPermissionKey, navSlug };

export const WORKSPACE_PERMISSIONS = rbacConfig.permissions.map((p) => ({
  key: p.key,
  label: p.label,
  group: p.group,
  scopeBy: p.scopeBy,
  conditionText: p.conditionText,
}));

export const ALL_PERMISSION_KEYS = WORKSPACE_PERMISSIONS.map((p) => p.key);

export const SYSTEM_ROLE_SEED = rbacConfig.systemRoles;

export function normalizeRoleId(value) {
  return navSlug(value);
}

export function tabPermissionKey(title) {
  return navPermissionKey(title);
}

export function getRoleById(roles, roleId) {
  return roles?.find((role) => role.id === roleId) || null;
}

export function roleHasPermission(roles, roleId, key) {
  if (!roles || !roles.length) return true;
  const role = getRoleById(roles, normalizeRoleId(roleId));
  if (!role) return true;
  const perms = role.permissions || [];
  if (perms.includes("*")) return true;
  return perms.includes(key);
}
