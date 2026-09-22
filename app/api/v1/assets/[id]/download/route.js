import { NextResponse } from "next/server";
import { requireApiKey, countUsage } from "@/lib/api/auth";
import { apiError } from "@/lib/api/respond";
import { isStorageConfigured } from "@/lib/storage/service";
import { backendForRef, refFromAssetRow } from "@/lib/storage/backends/index.js";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const auth = await requireApiKey(request, "assets:read");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;
  const { id } = await params;

  try {
    const { data, error } = await supabase
      .schema("assets")
      .from("assets")
      .select("id, storage_key, pool_file_id, pool_url, original_filename, name")
      .eq("id", id)
      .eq("project_id", key.projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[v1.assets.download]", error.message);
      return apiError("read_failed", "Could not load the asset.", 500);
    }
    if (!data?.storage_key) return apiError("not_found", "Asset file not found.", 404);
    if (!isStorageConfigured()) return apiError("service_unavailable", "Storage is not configured.", 503);

    const ref = refFromAssetRow(data) || { backend: "s3", key: data.storage_key };
    const url = await backendForRef(ref).signRead(ref, {
      download: true,
      filename: data.original_filename || data.name,
    });
    if (!url) return apiError("sign_failed", "Could not sign the download URL.", 500);
    countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/assets/[id]/download", method: "GET", status: 302, assetId: id }).catch(() => {});
    return NextResponse.redirect(url, { status: 302 });
  } catch (e) {
    console.error("[v1.assets.download]", e?.message || e);
    return apiError("read_failed", "Could not load the asset.", 500);
  }
}
