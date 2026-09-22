if (typeof window !== "undefined") {
  throw new Error("lib/storage/auth is server-only.");
}

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/supabase/components/assets-client";

const PERMISSION_FOR = {
  write: "assets.asset.edit",
  delete: "assets.asset.delete",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function storageAuth() {
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

export async function hasProjectGrant(supabase, projectId, userId) {
  if (projectId && !UUID_RE.test(String(projectId))) {
    console.warn("[storage.hasProjectGrant] invalid projectId", projectId);
    return false;
  }
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

export async function requireProjectAccess({ projectId, action = "read" } = {}) {
  const auth = await storageAuth();
  if (auth.response) return auth;
  const { supabase, userId } = auth;

  if (!projectId) {
    if (action === "read") return { supabase, userId };
    return { response: forbidden("forbidden") };
  }

  if (!UUID_RE.test(String(projectId))) {
    return { response: NextResponse.json({ error: "unknown_project" }, { status: 404 }) };
  }

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
