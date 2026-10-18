import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { apiError, ok } from "@/lib/api/respond";
import { isStorageConfigured } from "@/lib/storage/service";
import { backendForRef, refFromAssetRow } from "@/lib/storage/backends/index.js";

export const runtime = "nodejs";

// Suite-internal read URL for one stored asset. Other Geiger products (Grey's ingestion worker and
// media playback) call it server-to-server with `Authorization: Bearer $GEIGER_INTERNAL_TOKEN`;
// there is no user session, so the row is read with the service role and scoped to `projectId`.
// GET /api/internal/assets/{id}/read-url?projectId= -> { url, mimeType, filename, sizeBytes }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Constant-time: both sides are hashed to the same length before comparing.
function tokenMatches(request, expected) {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") || "");
  if (!match) return false;
  const given = createHash("sha256").update(match[1]).digest();
  const wanted = createHash("sha256").update(expected).digest();
  return timingSafeEqual(given, wanted);
}

function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).schema("assets");
}

export async function GET(request, { params }) {
  const expected = String(process.env.GEIGER_INTERNAL_TOKEN || "").trim();
  if (!expected) return apiError("service_unavailable", "Internal access is not configured.", 503);
  if (!tokenMatches(request, expected)) return apiError("unauthorized", "Missing or invalid internal token.", 401);

  const { id } = await params;
  const projectId = new URL(request.url).searchParams.get("projectId") || "";
  if (!UUID_RE.test(String(id)) || !UUID_RE.test(projectId)) {
    return apiError("not_found", "Asset file not found.", 404);
  }

  const db = serviceDb();
  if (!db || !isStorageConfigured()) return apiError("service_unavailable", "Storage is not configured.", 503);

  try {
    const { data: row, error } = await db
      .from("assets")
      .select("id, name, mime_type, size_bytes, storage_key, storage_status, pool_file_id, pool_url, original_filename")
      .eq("id", id)
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[internal.assets.read-url]", error.message);
      return apiError("read_failed", "Could not load the asset.", 500);
    }
    const ref = row?.storage_status === "stored" ? refFromAssetRow(row) : null;
    if (!ref) return apiError("not_found", "Asset file not found.", 404);

    const filename = row.original_filename || row.name || null;
    const url = await backendForRef(ref).signRead(ref, { filename });
    if (!url) return apiError("sign_failed", "Could not sign the read URL.", 500);

    return ok(
      {
        url,
        mimeType: row.mime_type || null,
        filename,
        sizeBytes: Number(row.size_bytes) || null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[internal.assets.read-url]", e?.message || e);
    return apiError("read_failed", "Could not load the asset.", 500);
  }
}
