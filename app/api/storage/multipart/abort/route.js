import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { isStorageConfigured, markJob } from "@/lib/storage/service";
import { parseKey } from "@/lib/s3/keys";
import { abortMultipart } from "@/lib/s3/multipart";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { uploadId, key } = body ?? {};
  if (!uploadId || !key) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Ownership is re-derived from the key, never trusted from the body: the
  // project segment decides whose membership (and whose edit right) applies.
  const parsed = parseKey(key);
  if (!parsed?.projectId) return NextResponse.json({ error: "bad_key" }, { status: 400 });
  const access = await requireProjectAccess({ projectId: parsed.projectId, action: "write" });
  if (access.response) return access.response;

  const aborted = await abortMultipart(key, uploadId);
  if (!aborted) return NextResponse.json({ error: "abort_failed" }, { status: 400 });

  try {
    const sb = await createServerSupabase();
    const { data } = await sb.schema("assets").from("upload_jobs")
      .select("id").eq("storage_key", key).in("status", ["queued", "uploading", "processing"]);
    await Promise.all((data ?? []).map((row) => markJob(row.id, { status: "failed", error: "Upload aborted" })));
  } catch (e) {
    console.error("[storage.multipart.abort]", e);
  }

  return NextResponse.json({ aborted: true });
}
