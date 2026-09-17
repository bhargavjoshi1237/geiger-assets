"use client";

import { useCallback, useEffect, useState } from "react";

import { roleHasPermission } from "@/lib/rbac";
import { getMyGrant, listRoles } from "@/lib/supabase/rbac";
import { getUser } from "@/lib/supabase/user";

// Advisory UI gating for navigation entries.
//
// This hides nav items the caller's role does not carry a `view` permission for.
// It is a convenience, not a security boundary — the data is protected by RLS
// and by the permission checks in lib/storage/auth.js, which run server-side and
// do not consult this.
//
// It stays deliberately permissive: no roles configured, no grant yet, or a
// role that cannot be resolved all read as "allowed", so a workspace never
// blanks out because the role lookup was slow or the project has not adopted
// RBAC.
export function useNavPermissions(projectId) {
  const [roles, setRoles] = useState(null);
  const [roleId, setRoleId] = useState(null);

  useEffect(() => {
    if (!projectId) return undefined;
    let alive = true;
    (async () => {
      const user = await getUser();
      const [roleRows, grant] = await Promise.all([
        listRoles(projectId),
        user?.id ? getMyGrant(projectId, user.id) : Promise.resolve(null),
      ]);
      if (!alive) return;
      setRoles(roleRows ?? []);
      setRoleId(grant?.roleId ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  const can = useCallback(
    (key) => {
      if (!key) return true;
      return roleHasPermission(roles || [], roleId, key);
    },
    [roles, roleId],
  );

  return { can, ready: roles !== null };
}

export default useNavPermissions;
