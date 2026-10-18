// The Postgres functions the data layer calls, re-implemented over the
// in-memory playground tables. Passed to createMemoryClient as its `rpc` map
// (see ./handlers.js); each handler gets `{ db, args, user }` and returns the
// function's result.

const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

function allows({ db, args: { p_permission: permission, p_project: projectId }, user }) {
  return db.table("role_grants").some((grant) => {
    if (grant.project_id !== projectId || grant.user_id !== user.id || grant.status !== "active" || grant.deleted_at != null) return false;
    const role = db.table("roles").find((item) => item.id === grant.role_id && item.deleted_at == null);
    return Boolean(role && (role.permissions?.includes("*") || role.permissions?.includes(permission)));
  });
}

function listMembers({ db, args: { p_project_id: projectId } }) {
  const roles = db.table("roles");
  const users = db.table("users");
  return db
    .table("role_grants")
    .filter((g) => g.project_id === projectId && g.status === "active" && g.deleted_at == null)
    .map((g) => {
      const user = users.find((u) => u.id === g.user_id) || {};
      const role = roles.find((r) => r.id === g.role_id) || {};
      return {
        user_id: g.user_id,
        email: user.email ?? "",
        name: user.name ?? "",
        avatar_url: user.avatar_url ?? "",
        role_id: g.role_id,
        role_key: role.key ?? "",
        role_name: role.name ?? "",
        status: g.status,
        granted_at: g.created_at,
      };
    });
}

function listCandidates({ db, args: { p_project_id: projectId } }) {
  const granted = new Set(
    db
      .table("role_grants")
      .filter((g) => g.project_id === projectId && g.deleted_at == null)
      .map((g) => g.user_id),
  );
  return db
    .table("users")
    .filter((u) => !granted.has(u.id))
    .map((u) => ({
      user_id: u.id,
      email: u.email,
      name: u.name,
      avatar_url: u.avatar_url ?? "",
      org_role: u.org_role ?? "member",
    }));
}

function resolveShare({ db, args: { p_token: token } }) {
  const link = db
    .table("share_links")
    .find((l) => l.token === token && l.status === "active" && l.deleted_at == null);
  if (!link) return [];
  return [{ ...clone(link), has_password: Boolean(link.password_hash) }];
}

function touchShare({ db, args: { p_token: token } }) {
  const link = db.table("share_links").find((l) => l.token === token);
  if (link) {
    link.view_count = Number(link.view_count || 0) + 1;
    link.last_viewed_at = new Date().toISOString();
  }
  return null;
}

// assets.project_merge_settings(): shallow-merge a patch into the settings
// row's metadata bag, creating the row on first save.
function mergeSettings({ db, args: { p_project_id: projectId, p_patch: patch } }) {
  const rows = db.table("project_settings");
  const now = new Date().toISOString();
  let row = rows.find((r) => r.project_id === projectId && r.deleted_at == null);
  if (!row) {
    row = { id: globalThis.crypto.randomUUID(), project_id: projectId, created_at: now, deleted_at: null, metadata: {} };
    rows.unshift(row);
  }
  row.metadata = { ...(row.metadata || {}), ...(patch || {}) };
  row.updated_at = now;
  return clone(row);
}

export const playgroundRpc = {
  rbac_allows: allows,
  rbac_list_members: listMembers,
  rbac_org_candidates: listCandidates,
  rbac_ensure_membership: () => null,
  sync_project_team: () => 0,
  resolve_share_link: resolveShare,
  touch_share_link: touchShare,
  project_merge_settings: mergeSettings,
};
