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

// Resolves a role from whichever spelling the caller has. Roles reach this from
// two places that disagree: the seed catalog keys them by slug ("owner"), while
// a persisted role row carries a uuid `id` plus a `key`. Slugifying a uuid can
// never match its own `id` (the dashes become underscores), so matching on one
// spelling alone silently resolved nothing and every check fell through to the
// permissive branch below. Exact matches win; slug matches are the fallback.
export function getRoleById(roles, roleId) {
  if (!roles?.length || roleId == null || roleId === "") return null;
  const raw = String(roleId);
  const exact = roles.find((role) => role.id === raw || role.key === raw);
  if (exact) return exact;
  const slug = navSlug(raw);
  if (!slug) return null;
  return roles.find((role) => navSlug(role.id) === slug || navSlug(role.key) === slug) || null;
}

export function roleHasPermission(roles, roleId, key) {
  if (!roles || !roles.length) return true;
  // Not pre-slugified: getRoleById needs the raw value to try an exact match
  // against a uuid id first.
  const role = getRoleById(roles, roleId);
  if (!role) return true;
  const perms = role.permissions || [];
  if (perms.includes("*")) return true;
  return perms.includes(key);
}
