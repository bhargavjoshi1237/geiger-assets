import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { getAssetRow, proxyStreamResponse, isStorageConfigured } from "@/lib/storage/service";
import { signGetUrl } from "@/lib/s3/objects";
import { s3Config } from "@/lib/s3/config";
import { createServerSupabase } from "@/lib/supabase/server";
import { throttle } from "@/lib/storage/throttle";
import { meterVariantDelivery } from "@/lib/storage/meter";

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

  const limited = throttle("deliver", access.userId);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const download = searchParams.get("download") === "1";
  const filename = row.original_filename || row.name;

  // Gateways without presigned GETs stream through the handler instead of
  // redirecting to a URL the gateway would reject.
  if (!s3Config().presignedReads) {
    const res = await proxyStreamResponse(row.storage_key, { filename, download, request });
    if (!res) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (download) await bumpDownloads(id, row.downloads);
    await meterVariantDelivery(row, "original", res);
    return res;
  }

  const url = await signGetUrl(row.storage_key, { download, filename });
  if (!url) return NextResponse.json({ error: "sign_failed" }, { status: 500 });

  if (download) await bumpDownloads(id, row.downloads);
  // On the presigned path the bytes go gateway->client and never touch this
  // process, so the object's own size is the only figure available — pass it as
  // a synthetic content-length rather than leaving the delivery unbilled.
  await meterVariantDelivery(row, "original", {
    headers: { get: () => String(row.size_bytes ?? 0) },
  });

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
