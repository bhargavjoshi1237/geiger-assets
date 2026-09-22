import { requireApiKey, countUsage } from "@/lib/api/auth";
import { apiError, ok, normalizeAssetRow } from "@/lib/api/respond";

export const runtime = "nodejs";

async function loadAsset(supabase, projectId, id) {
  const { data, error } = await supabase
    .schema("assets")
    .from("assets")
    .select("*")
    .eq("id", id)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[v1.assets.get]", error.message);
    return null;
  }
  return data;
}

export async function GET(request, { params }) {
  const auth = await requireApiKey(request, "assets:read");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;
  const { id } = await params;

  const row = await loadAsset(supabase, key.projectId, id);
  if (!row) return apiError("not_found", "Asset not found.", 404);
  countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/assets/[id]", method: "GET", status: 200, assetId: id }).catch(() => {});
  return ok(normalizeAssetRow(row));
}

export async function PATCH(request, { params }) {
  const auth = await requireApiKey(request, "assets:write");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", "Request body must be JSON.", 400);
  }

  const patch = {};
  for (const field of ["name", "folder", "status", "description", "color"]) {
    if (field in body) patch[field] = body[field];
  }
  if ("tags" in body) patch.tags = Array.isArray(body.tags) ? body.tags : [];
  if ("deliveryEnabled" in body) patch.delivery_enabled = Boolean(body.deliveryEnabled);
  if (!Object.keys(patch).length) return apiError("bad_request", "Nothing to update.", 400);

  try {
    const { data, error } = await supabase
      .schema("assets")
      .from("assets")
      .update(patch)
      .eq("id", id)
      .eq("project_id", key.projectId)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[v1.assets.patch]", error.message);
      return apiError("write_failed", "Could not update the asset.", 500);
    }
    if (!data) return apiError("not_found", "Asset not found.", 404);
    countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/assets/[id]", method: "PATCH", status: 200, assetId: id }).catch(() => {});
    return ok(normalizeAssetRow(data));
  } catch (e) {
    console.error("[v1.assets.patch]", e?.message || e);
    return apiError("write_failed", "Could not update the asset.", 500);
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireApiKey(request, "assets:write");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;
  const { id } = await params;

  try {
    const { data, error } = await supabase
      .schema("assets")
      .from("assets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("project_id", key.projectId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[v1.assets.delete]", error.message);
      return apiError("write_failed", "Could not delete the asset.", 500);
    }
    if (!data) return apiError("not_found", "Asset not found.", 404);
    countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/assets/[id]", method: "DELETE", status: 200, assetId: id }).catch(() => {});
    return ok({ id, deleted: true });
  } catch (e) {
    console.error("[v1.assets.delete]", e?.message || e);
    return apiError("write_failed", "Could not delete the asset.", 500);
  }
}
