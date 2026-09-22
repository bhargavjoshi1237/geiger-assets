import { requireApiKey, countUsage } from "@/lib/api/auth";
import { apiError, ok, paginate } from "@/lib/api/respond";

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

export async function GET(request) {
  const auth = await requireApiKey(request, "folders:read");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;
  const params = new URL(request.url).searchParams;

  try {
    const { data, error } = await supabase
      .schema("assets")
      .from("folders")
      .select("*")
      .eq("project_id", key.projectId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(500);
    if (error) {
      console.error("[v1.folders.list]", error.message);
      return apiError("read_failed", "Could not list folders.", 500);
    }
    countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/folders", method: "GET", status: 200 }).catch(() => {});
    return ok(paginate((data || []).map(normalize), { limit: params.get("limit"), cursor: params.get("cursor") }));
  } catch (e) {
    console.error("[v1.folders.list]", e?.message || e);
    return apiError("read_failed", "Could not list folders.", 500);
  }
}

export async function POST(request) {
  const auth = await requireApiKey(request, "folders:write");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", "Request body must be JSON.", 400);
  }
  if (!body?.name?.trim()) return apiError("bad_request", "name is required.", 400);

  try {
    const { data, error } = await supabase
      .schema("assets")
      .from("folders")
      .insert({
        project_id: key.projectId,
        name: String(body.name).slice(0, 180),
        parent_id: body.parentId || null,
        path: body.path || "",
      })
      .select("*")
      .single();
    if (error) {
      console.error("[v1.folders.create]", error.message);
      return apiError("write_failed", "Could not create the folder.", 500);
    }
    return ok(normalize(data), { status: 201 });
  } catch (e) {
    console.error("[v1.folders.create]", e?.message || e);
    return apiError("write_failed", "Could not create the folder.", 500);
  }
}
