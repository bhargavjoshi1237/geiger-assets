if (typeof window !== "undefined") {
  throw new Error("lib/storage/auth is server-only.");
}

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/supabase/components/assets-client";

// Storage authorization runs through @geiger/rbac — the same engine, catalog and
// grants the rest of the suite uses — rather than a role list copied into this
// file. The permission keys come from geiger-rbac.config.js.
//
// Each action maps to the catalog key that gates it. "read" is deliberately
// membership-only: every asset predating the RBAC adoption has a null
// project_id, and gating reads on a view permission would hide them from the
// viewer role that is supposed to see them. Tightening reads to
// assets.assets.view is a separate, deliberate change.
const PERMISSION_FOR = {
  write: "assets.asset.edit",
  delete: "assets.asset.delete",
};

export async function storageAuth() {
  // Fail shut: without an auth backend there is no session to verify, so no
  // storage route may proceed. A misconfigured deploy returns 503, never open
  // storage.
  if (!isSupabaseConfigured()) {
    return { response: NextResponse.json({ error: "auth_unconfigured" }, { status: 503 }) };
  }
  let supabase;
  try {
    supabase = await createServerSupabase();
  } catch (e) {
    console.error("[storage.auth]", e);
    return { response: NextResponse.json({ error: "auth_failed" }, { status: 500 }) };
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
    return { supabase, userId: user.id };
  } catch (e) {
    console.error("[storage.auth]", e);
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
}

export function forbidden(message = "forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

// assets.rbac_allows() resolves the caller's grants, their roles' permission
// patterns and any scope narrowing, all under auth.uid(). It is the same
// predicate the RLS policies call, so the API and the database cannot drift.
// Any failure denies.
async function allows(supabase, permission, projectId) {
  try {
    const { data, error } = await supabase.schema("assets").rpc("rbac_allows", {
      p_permission: permission,
      p_project: projectId,
      p_scope_type: null,
      p_scope_id: null,
    });
    if (error) {
      console.error("[storage.rbac]", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("[storage.rbac]", e);
    return false;
  }
}

// True when the caller holds any active grant in the project. Exported because
// key authorization (lib/storage/service.js) needs the same membership test
// without going through the NextResponse-returning gate.
export async function hasProjectGrant(supabase, projectId, userId) {
  try {
    const { data, error } = await supabase
      .schema("assets")
      .from("role_grants")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(1);
    if (error) {
      console.error("[storage.hasProjectGrant]", error.message);
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch (e) {
    console.error("[storage.hasProjectGrant]", e);
    return false;
  }
}

// Full gate for storage routes: session, then the permission the action needs.
// Returns { supabase, userId } or { response }.
export async function requireProjectAccess({ projectId, action = "read" } = {}) {
  const auth = await storageAuth();
  if (auth.response) return auth;
  const { supabase, userId } = auth;

  // Rows without a project (everything seeded before the storage layer existed)
  // stay readable to any authenticated user; there is no project to authorize
  // against. Writes still have to name a project.
  if (!projectId) {
    if (action === "read") return { supabase, userId };
    return { response: forbidden("forbidden") };
  }

  // A user who joined the organization after the last sync has no grant yet.
  // Bootstrapping here — rather than only on workspace load — means an API call
  // is never denied for a membership the org already implies. It is a no-op once
  // a grant exists, and returns nothing for a non-member or a revoked grant.
  if (!(await hasProjectGrant(supabase, projectId, userId))) {
    try {
      await supabase.schema("assets").rpc("rbac_ensure_membership", { p_project_id: projectId });
    } catch (e) {
      console.error("[storage.ensureMembership]", e);
    }
  }

  if (action === "read") {
    if (!(await hasProjectGrant(supabase, projectId, userId))) return { response: forbidden("forbidden") };
    return { supabase, userId };
  }

  const permission = PERMISSION_FOR[action];
  if (!permission) return { response: forbidden("forbidden") };
  if (!(await allows(supabase, permission, projectId))) return { response: forbidden("forbidden") };

  return { supabase, userId };
}
