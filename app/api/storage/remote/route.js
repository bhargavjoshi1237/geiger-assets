import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { proxyStore, isStorageConfigured } from "@/lib/storage/service";
import { fetchRemoteFile } from "@/lib/storage/remote";

export const runtime = "nodejs";

const STATUS_FOR_ERROR = {
  invalid_url: 400,
  blocked_url: 400,
  too_many_redirects: 400,
  bad_request: 400,
  empty_file: 400,
  not_found: 404,
  too_large: 413,
  unsupported_type: 415,
  timeout: 504,
  fetch_failed: 502,
  storage_unconfigured: 503,
};

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

  const { projectId, uploadJobId, url, folder, tags, quality, name, status } = body || {};
  if (!projectId || !uploadJobId || !url) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const access = await requireProjectAccess({ projectId: String(projectId), action: "write" });
  if (access.response) return access.response;

  const fetched = await fetchRemoteFile(String(url));
  if (fetched.error) {
    return NextResponse.json(
      { error: fetched.error },
      { status: STATUS_FOR_ERROR[fetched.error] ?? 400 },
    );
  }

  const result = await proxyStore({
    projectId: String(projectId),
    uploadJobId: String(uploadJobId),
    filename: fetched.filename,
    contentType: fetched.contentType,
    bytes: fetched.bytes,
    name: name ? String(name) : undefined,
    status: status ? String(status) : undefined,
    folder: folder ? String(folder) : undefined,
    tags: Array.isArray(tags) ? tags : undefined,
    quality: quality ? String(quality) : undefined,
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: STATUS_FOR_ERROR[result.error] ?? 400 },
    );
  }
  return NextResponse.json({ ...result, sourceUrl: fetched.sourceUrl });
}
