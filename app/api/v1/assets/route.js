import { requireApiKey, countUsage } from "@/lib/api/auth";
import { apiError, ok, paginate, normalizeAssetRow } from "@/lib/api/respond";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireApiKey(request, "assets:read");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? params.get("search") ?? "").trim();
  const type = params.get("type");
  const status = params.get("status");
  const folder = params.get("folder");
  const tag = params.get("tag");

  try {
    let query = supabase
      .schema("assets")
      .from("assets")
      .select("*", { count: "exact" })
      .eq("project_id", key.projectId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);
    if (folder) query = query.eq("folder", folder);
    if (tag) query = query.contains("tags", [tag]);

    const { data, error } = await query.limit(500);
    if (error) {
      console.error("[v1.assets.list]", error.message);
      return apiError("read_failed", "Could not list assets.", 500);
    }
    const page = paginate((data || []).map(normalizeAssetRow), {
      limit: params.get("limit"),
      cursor: params.get("cursor"),
    });
    countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/assets", method: "GET", status: 200 }).catch(() => {});
    return ok(page);
  } catch (e) {
    console.error("[v1.assets.list]", e?.message || e);
    return apiError("read_failed", "Could not list assets.", 500);
  }
}

export async function POST(request) {
  const auth = await requireApiKey(request, "assets:write");
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
      .from("assets")
      .insert({
        project_id: key.projectId,
        name: String(body.name).slice(0, 180),
        type: body.type || "image",
        folder: body.folder || "root",
        status: body.status || "draft",
        description: body.description || "",
        tags: Array.isArray(body.tags) ? body.tags : [],
      })
      .select("*")
      .single();
    if (error) {
      console.error("[v1.assets.create]", error.message);
      return apiError("write_failed", "Could not create the asset.", 500);
    }
    countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/assets", method: "POST", status: 201, assetId: data.id }).catch(() => {});
    return ok(normalizeAssetRow(data), { status: 201 });
  } catch (e) {
    console.error("[v1.assets.create]", e?.message || e);
    return apiError("write_failed", "Could not create the asset.", 500);
  }
}
