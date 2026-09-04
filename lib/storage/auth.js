if (typeof window !== "undefined") {
  throw new Error("lib/storage/auth is server-only.");
}

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/supabase/components/assets-client";

// Role sets mirror the geiger-rbac.config.js system roles for the two storage
// gates (owner holds "*"; admin has edit+delete; manager/member have edit;
// viewer has neither). They are written out here — instead of importing that
// module — because it cannot load server-side, and because a silent fallback
// inside roleHasPermission (unknown role -> allow) must never gate bytes.
// If the config's system roles change, update these sets together.
const WRITE_ROLES = new Set(["owner", "admin", "manager", "member"]);
const DELETE_ROLES = new Set(["owner", "admin"]);

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

// Strict role check: unknown or missing role keys deny. Never lenient.
export function roleCan(roleKey, action) {
  if (!roleKey) return false;
  if (action === "delete") return DELETE_ROLES.has(roleKey);
  if (action === "write") return WRITE_ROLES.has(roleKey);
  return false;
}

export async function memberRole(supabase, projectId, userId) {
  // Rows without a project (demo seeds) stay readable to any authenticated
  // user; everything with a project requires a membership row.
  if (!projectId) return { roleKey: null, open: true };
  if (!supabase || !userId) return { roleKey: null, open: false };
  try {
    const { data, error } = await supabase
      .schema("assets")
      .from("project_members")
      .select("role_key")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .single();
    if (error || !data) return { roleKey: null, open: false };
    return { roleKey: data.role_key ?? null, open: false };
  } catch (e) {
    console.error("[storage.memberRole]", e);
    return { roleKey: null, open: false };
  }
}

// Full gate for storage routes: session, then membership, then (for writes and
// deletes) the role check. Returns { supabase, userId, roleKey } or { response }.
export async function requireProjectAccess({ projectId, action = "read" } = {}) {
  const auth = await storageAuth();
  if (auth.response) return auth;
  const m = await memberRole(auth.supabase, projectId, auth.userId);
  if (!m.roleKey && !m.open) {
    return { response: forbidden("forbidden") };
  }
  if (action !== "read" && !m.open && !roleCan(m.roleKey, action)) {
    return { response: forbidden("forbidden") };
  }
  return { supabase: auth.supabase, userId: auth.userId, roleKey: m.roleKey };
}
