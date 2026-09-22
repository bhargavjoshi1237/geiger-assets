import { randomUUID } from "node:crypto";
import { requireApiKey, countUsage } from "@/lib/api/auth";
import { apiError, ok } from "@/lib/api/respond";
import { isStorageConfigured, issueUploadUrl } from "@/lib/storage/service";

export const runtime = "nodejs";

// POST /api/v1/upload — presign a direct-to-storage upload.
export async function POST(request) {
  const auth = await requireApiKey(request, "upload:write");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;

  if (!isStorageConfigured()) {
    return apiError("service_unavailable", "Storage is not configured on the server.", 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", "Request body must be JSON.", 400);
  }
  const { filename, contentType, sizeBytes, assetId } = body ?? {};
  if (!filename || !contentType || !sizeBytes) {
    return apiError("bad_request", "filename, contentType and sizeBytes are required.", 400);
  }

  const uploadJobId = randomUUID();
  const result = await issueUploadUrl({
    projectId: key.projectId,
    assetId,
    filename,
    contentType,
    sizeBytes,
    uploadJobId,
  });
  if (result.error === "too_large") return apiError("too_large", "File exceeds the size limit.", 413);
  if (result.error === "unsupported_type") return apiError("unsupported_type", "File type is not supported.", 415);
  if (result.error) return apiError("bad_request", "Could not start the upload.", 400);
  countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/upload", method: "POST", status: 201 }).catch(() => {});
  return ok(
    {
      uploadJobId,
      url: result.url,
      key: result.key,
      mode: result.mode,
      expiresAt: result.expiresAt ?? null,
    },
    { status: 201 },
  );
}
