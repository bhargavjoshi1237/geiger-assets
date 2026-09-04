import { NextResponse } from "next/server";
import { storageAuth } from "@/lib/storage/auth";
import { proxyStore, PROXY_MAX_BYTES, isStorageConfigured } from "@/lib/storage/service";

export const runtime = "nodejs";

export async function POST(request) {
  const auth = await storageAuth();
  if (auth.response) return auth.response;

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const file = form.get("file");
  const projectId = form.get("projectId");
  const uploadJobId = form.get("uploadJobId");
  if (!(file instanceof Blob) || !projectId || !uploadJobId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (file.size > PROXY_MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const tagsRaw = form.get("tags");
  let tags;
  try {
    tags = typeof tagsRaw === "string" && tagsRaw ? JSON.parse(tagsRaw) : undefined;
  } catch {
    tags = undefined;
  }

  const result = await proxyStore({
    projectId: String(projectId),
    uploadJobId: String(uploadJobId),
    filename: file.name || "file",
    contentType: file.type || "application/octet-stream",
    bytes: buffer,
    assetId: form.get("assetId") ? String(form.get("assetId")) : undefined,
    name: form.get("name") ? String(form.get("name")) : undefined,
    type: form.get("type") ? String(form.get("type")) : undefined,
    folder: form.get("folder") ? String(form.get("folder")) : undefined,
    tags,
    checksum: form.get("checksum") ? String(form.get("checksum")) : undefined,
  });

  if (result.error === "too_large") return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (result.error === "unsupported_type") return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
