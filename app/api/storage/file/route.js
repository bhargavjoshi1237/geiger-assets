import { NextResponse } from "next/server";
import { storageAuth } from "@/lib/storage/auth";
import { authorizeKey, proxyStreamResponse, isStorageConfigured } from "@/lib/storage/service";
import { refFromAssetRow } from "@/lib/storage/backends/index.js";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Same-origin read proxy: streams bytes for an authorized key. This is the
// read path for gateways without presigned GETs (Appwrite answers those with
// 501), and the target batchSign() points at when presigned reads are off.
export async function GET(request) {
  const auth = await storageAuth();
  if (auth.response) return auth.response;

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const parsed = await authorizeKey(key, auth.userId);
  if (!parsed) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Reads follow the row: a pooled object streams from the pool even though
  // the key layout is unchanged.
  let ref = { backend: "s3", key };
  try {
    const sb = await createServerSupabase();
    const { data: row } = await sb.schema("assets").from("assets")
      .select("storage_key, pool_file_id, pool_url").eq("storage_key", key).is("deleted_at", null).limit(1).maybeSingle();
    if (row) ref = refFromAssetRow(row) || ref;
  } catch {
    /* fall back to the S3 ref */
  }

  const res = await proxyStreamResponse(key, {
    filename: key.split("/").pop(),
    download: searchParams.get("download") === "1",
    request,
    ref,
  });
  if (!res) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return res;
}
