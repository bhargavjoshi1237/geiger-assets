import { NextResponse } from "next/server";
import { storageAuth } from "@/lib/storage/auth";
import { issueUploadUrl } from "@/lib/storage/service";
import { isStorageConfigured } from "@/lib/storage/service";

export const runtime = "nodejs";

export async function POST(request) {
  const auth = await storageAuth();
  if (auth.response) return auth.response;

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { projectId, assetId, filename, contentType, sizeBytes, uploadJobId } = body ?? {};
  if (!projectId || !filename || !contentType || !sizeBytes || !uploadJobId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await issueUploadUrl({ projectId, assetId, filename, contentType, sizeBytes, uploadJobId });
  if (result.error === "too_large") return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (result.error === "unsupported_type") return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
