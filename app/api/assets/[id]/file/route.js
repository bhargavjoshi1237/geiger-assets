import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { getAssetRow, proxyStreamResponse, isStorageConfigured } from "@/lib/storage/service";
import { backendForRef, refFromAssetRow } from "@/lib/storage/backends/index.js";
import { s3Config } from "@/lib/s3/config";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }

  const { id } = await params;
  const row = await getAssetRow(id);
  if (!row?.storage_key) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const access = await requireProjectAccess({ projectId: row.project_id, action: "read" });
  if (access.response) return access.response;

  const { searchParams } = new URL(request.url);
  const download = searchParams.get("download") === "1";
  const filename = row.original_filename || row.name;
  const ref = refFromAssetRow(row) || { backend: "s3", key: row.storage_key };
  const backend = backendForRef(ref);

  // Pooled objects always read via the pool gateway, which is stable and
  // handles private objects. S3 keeps today's presigned/proxy branch.
  if (ref.backend === "pool") {
    const url = await backend.signRead(ref, { download, filename });
    if (!url) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (download) await bumpDownloads(id, row.downloads);
    return NextResponse.redirect(url, { status: 307 });
  }

  // Gateways without presigned GETs stream through the handler instead of
  // redirecting to a URL the gateway would reject.
  if (!s3Config().presignedReads) {
    const res = await proxyStreamResponse(row.storage_key, { filename, download, request, ref });
    if (!res) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (download) await bumpDownloads(id, row.downloads);
    return res;
  }

  const url = await backend.signRead(ref, { download, filename });
  if (!url) return NextResponse.json({ error: "sign_failed" }, { status: 500 });

  if (download) await bumpDownloads(id, row.downloads);

  const ttl = s3Config().signedUrlTtl;
  return NextResponse.redirect(url, {
    status: 307,
    headers: { "Cache-Control": `private, max-age=${Math.max(ttl - 600, 60)}` },
  });
}

async function bumpDownloads(id, current) {
  try {
    const sb = await createServerSupabase();
    await sb.schema("assets").rpc("increment_downloads", { p_asset_id: id });
  } catch (e) {
    console.error("[storage.file]", e, current);
  }
}
