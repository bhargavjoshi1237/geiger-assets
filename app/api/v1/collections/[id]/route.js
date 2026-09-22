import { requireApiKey, countUsage } from "@/lib/api/auth";
import { apiError, ok } from "@/lib/api/respond";

export const runtime = "nodejs";

function normalize(row, assetCount = 0) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    description: row.description ?? "",
    type: row.type ?? "manual",
    coverColor: row.cover_color ?? "#737373",
    status: row.status ?? "active",
    isFavorite: Boolean(row.is_favorite),
    visibility: row.visibility ?? "private",
    assetCount,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

async function loadCollection(supabase, projectId, id) {
  const { data, error } = await supabase
    .schema("assets")
    .from("collections")
    .select("*, items:collection_assets(count)")
    .eq("id", id)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[v1.collections.get]", error.message);
    return null;
  }
  if (!data) return null;
  return normalize(data, Array.isArray(data.items) ? data.items?.[0]?.count ?? 0 : 0);
}

export async function GET(request, { params }) {
  const auth = await requireApiKey(request, "collections:read");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;
  const { id } = await params;

  const row = await loadCollection(supabase, key.projectId, id);
  if (!row) return apiError("not_found", "Collection not found.", 404);
  return ok(row);
}

export async function PATCH(request, { params }) {
  const auth = await requireApiKey(request, "collections:write");
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
  for (const field of ["name", "description", "type", "status", "visibility", "cover_color"]) {
    if (field in body) patch[field] = body[field];
  }
  if ("coverColor" in body) patch.cover_color = body.coverColor;
  if ("isFavorite" in body) patch.is_favorite = Boolean(body.isFavorite);
  if (!Object.keys(patch).length) return apiError("bad_request", "Nothing to update.", 400);

  const { error } = await supabase
    .schema("assets")
    .from("collections")
    .update(patch)
    .eq("id", id)
    .eq("project_id", key.projectId)
    .is("deleted_at", null);
  if (error) {
    console.error("[v1.collections.patch]", error.message);
    return apiError("write_failed", "Could not update the collection.", 500);
  }
  const row = await loadCollection(supabase, key.projectId, id);
  if (!row) return apiError("not_found", "Collection not found.", 404);
  countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/collections/[id]", method: "PATCH", status: 200 }).catch(() => {});
  return ok(row);
}

export async function DELETE(request, { params }) {
  const auth = await requireApiKey(request, "collections:write");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;
  const { id } = await params;

  const { data, error } = await supabase
    .schema("assets")
    .from("collections")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("project_id", key.projectId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[v1.collections.delete]", error.message);
    return apiError("write_failed", "Could not delete the collection.", 500);
  }
  if (!data) return apiError("not_found", "Collection not found.", 404);
  return ok({ id, deleted: true });
}
