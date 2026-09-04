import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { commitUpload, isStorageConfigured } from "@/lib/storage/service";
import { parseKey } from "@/lib/s3/keys";

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

  const { uploadJobId, key, assetId, checksum, name, type, folder, tags } = body ?? {};
  if (!uploadJobId || !key) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Ownership is re-derived from the key, never trusted from the body: the
  // project segment decides whose membership (and whose edit right) applies.
  const parsed = parseKey(key);
  if (!parsed?.projectId) return NextResponse.json({ error: "bad_key" }, { status: 400 });
  const access = await requireProjectAccess({ projectId: parsed.projectId, action: "write" });
  if (access.response) return access.response;

  const result = await commitUpload({ uploadJobId, key, assetId, checksum, name, type, folder, tags });
  if (result.error === "not_committed") return NextResponse.json({ error: "not_committed" }, { status: 409 });
  if (result.error === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (result.error === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (result.error === "too_large") return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
