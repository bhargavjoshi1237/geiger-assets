import { requireApiKey, countUsage } from "@/lib/api/auth";
import { apiError, ok, paginate } from "@/lib/api/respond";

export const runtime = "nodejs";

// GET /api/v1/tags — the project's tag vocabulary with usage counts,
// derived from assets.tags (the single source of truth for tags).
export async function GET(request) {
  const auth = await requireApiKey(request, "tags:read");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;
  const params = new URL(request.url).searchParams;

  try {
    const { data, error } = await supabase
      .schema("assets")
      .from("assets")
      .select("tags")
      .eq("project_id", key.projectId)
      .is("deleted_at", null)
      .limit(2000);
    if (error) {
      console.error("[v1.tags.list]", error.message);
      return apiError("read_failed", "Could not list tags.", 500);
    }
    const counts = new Map();
    for (const row of data || []) {
      for (const tag of Array.isArray(row.tags) ? row.tags : []) {
        const t = String(tag || "").trim().toLowerCase();
        if (!t) continue;
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    const rows = [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/tags", method: "GET", status: 200 }).catch(() => {});
    return ok(paginate(rows, { limit: params.get("limit"), cursor: params.get("cursor") }));
  } catch (e) {
    console.error("[v1.tags.list]", e?.message || e);
    return apiError("read_failed", "Could not list tags.", 500);
  }
}
