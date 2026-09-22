import { requireApiKey, countUsage } from "@/lib/api/auth";
import { apiError, ok, paginate } from "@/lib/api/respond";

export const runtime = "nodejs";

function normalize(row) {
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
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

export async function GET(request) {
  const auth = await requireApiKey(request, "collections:read");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;
  const params = new URL(request.url).searchParams;

  try {
    const { data, error } = await supabase
      .schema("assets")
      .from("collections")
      .select("*, items:collection_assets(count)")
      .eq("project_id", key.projectId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[v1.collections.list]", error.message);
      return apiError("read_failed", "Could not list collections.", 500);
    }
    const rows = (data || []).map((row) => ({
      ...normalize(row),
      assetCount: Array.isArray(row.items) ? row.items?.[0]?.count ?? 0 : 0,
    }));
    countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/collections", method: "GET", status: 200 }).catch(() => {});
    return ok(paginate(rows, { limit: params.get("limit"), cursor: params.get("cursor") }));
  } catch (e) {
    console.error("[v1.collections.list]", e?.message || e);
    return apiError("read_failed", "Could not list collections.", 500);
  }
}

export async function POST(request) {
  const auth = await requireApiKey(request, "collections:write");
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
      .from("collections")
      .insert({
        project_id: key.projectId,
        name: String(body.name).slice(0, 180),
        description: body.description || "",
        type: body.type || "manual",
        visibility: body.visibility || "private",
      })
      .select("*")
      .single();
    if (error) {
      console.error("[v1.collections.create]", error.message);
      return apiError("write_failed", "Could not create the collection.", 500);
    }
    countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/collections", method: "POST", status: 201 }).catch(() => {});
    return ok({ ...normalize(data), assetCount: 0 }, { status: 201 });
  } catch (e) {
    console.error("[v1.collections.create]", e?.message || e);
    return apiError("write_failed", "Could not create the collection.", 500);
  }
}
