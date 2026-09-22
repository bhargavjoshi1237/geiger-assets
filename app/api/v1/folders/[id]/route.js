import { requireApiKey, countUsage } from "@/lib/api/auth";
import { apiError, ok } from "@/lib/api/respond";

export const runtime = "nodejs";

function normalize(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    parentId: row.parent_id ?? null,
    path: row.path ?? "",
    storageLocation: row.storage_location ?? "hot",
    color: row.color ?? "#737373",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

export async function GET(request, { params }) {
  const auth = await requireApiKey(request, "folders:read");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;
  const { id } = await params;

  const { data, error } = await supabase
    .schema("assets")
    .from("folders")
    .select("*")
    .eq("id", id)
    .eq("project_id", key.projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[v1.folders.get]", error.message);
    return apiError("read_failed", "Could not load the folder.", 500);
  }
  if (!data) return apiError("not_found", "Folder not found.", 404);
  return ok(normalize(data));
}

export async function PATCH(request, { params }) {
  const auth = await requireApiKey(request, "folders:write");
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
  if ("name" in body) patch.name = body.name;
  if ("path" in body) patch.path = body.path;
  if ("parentId" in body) patch.parent_id = body.parentId || null;
  if (!Object.keys(patch).length) return apiError("bad_request", "Nothing to update.", 400);

  const { data, error } = await supabase
    .schema("assets")
    .from("folders")
    .update(patch)
    .eq("id", id)
    .eq("project_id", key.projectId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[v1.folders.patch]", error.message);
    return apiError("write_failed", "Could not update the folder.", 500);
  }
  if (!data) return apiError("not_found", "Folder not found.", 404);
  countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/folders/[id]", method: "PATCH", status: 200 }).catch(() => {});
  return ok(normalize(data));
}

export async function DELETE(request, { params }) {
  const auth = await requireApiKey(request, "folders:write");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;
  const { id } = await params;

  const { data, error } = await supabase
    .schema("assets")
    .from("folders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("project_id", key.projectId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[v1.folders.delete]", error.message);
    return apiError("write_failed", "Could not delete the folder.", 500);
  }
  if (!data) return apiError("not_found", "Folder not found.", 404);
  return ok({ id, deleted: true });
}
