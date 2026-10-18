import { NextResponse } from "next/server";
import { storageAuth } from "@/lib/storage/auth";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function allowed(sb, projectId, permission) {
  const { data, error } = await sb.rpc("rbac_allows", {
    p_permission: permission,
    p_project: projectId,
    p_scope_type: null,
    p_scope_id: null,
  });
  if (error) throw error;
  return data === true;
}

export async function POST(request) {
  const auth = await storageAuth();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const projectId = body?.projectId;
  const policyId = body?.policyId;
  if (!UUID.test(projectId ?? "") || !UUID.test(policyId ?? "")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const sb = auth.supabase.schema("assets");
    if (!await allowed(sb, projectId, "assets.settings.manage")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const { data: policy, error: policyError } = await sb.from("retention_policies")
      .select("id,project_id,asset_type,age_days,action")
      .eq("id", policyId).eq("project_id", projectId).is("deleted_at", null).maybeSingle();
    if (policyError) throw policyError;
    if (!policy) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const assetPermission = policy.action === "trash" ? "assets.asset.delete" : "assets.asset.edit";
    if (!await allowed(sb, projectId, assetPermission)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const cutoff = new Date(Date.now() - policy.age_days * 86400000).toISOString();
    let query = sb.from("assets").select("id")
      .eq("project_id", projectId).is("deleted_at", null).lte("created_at", cutoff)
      .order("created_at", { ascending: true }).order("id").limit(100);
    if (policy.asset_type !== "all") query = query.eq("type", policy.asset_type);
    if (policy.action === "archive") query = query.neq("status", "archived");
    const { data: matches, error: matchError } = await query;
    if (matchError) throw matchError;

    const appliedIds = [];
    let failed = 0;
    for (const asset of matches ?? []) {
      const patch = policy.action === "trash"
        ? { deleted_at: new Date().toISOString() }
        : { status: "archived" };
      const { data, error } = await sb.from("assets").update(patch)
        .eq("id", asset.id).eq("project_id", projectId).is("deleted_at", null)
        .select("id").maybeSingle();
      if (error || !data) failed += 1;
      else appliedIds.push(data.id);
    }
    return NextResponse.json({ appliedIds, succeeded: appliedIds.length, failed });
  } catch (error) {
    console.error("[governance.retention.apply]", error);
    return NextResponse.json({ error: "apply_failed" }, { status: 500 });
  }
}
