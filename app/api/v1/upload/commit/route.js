import { requireApiKey, countUsage } from "@/lib/api/auth";
import { apiError, ok } from "@/lib/api/respond";
import { commitUpload, isStorageConfigured } from "@/lib/storage/service";
import { parseKey } from "@/lib/s3/keys";

export const runtime = "nodejs";

// POST /api/v1/upload/commit — attach a finished upload to an asset record.
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
  const { uploadJobId, key: storageKey, assetId, checksum, name, type, status, folder, tags } = body ?? {};
  if (!uploadJobId || !storageKey) {
    return apiError("bad_request", "uploadJobId and key are required.", 400);
  }
  const parsed = parseKey(storageKey);
  if (!parsed?.projectId || parsed.projectId !== key.projectId) {
    return apiError("forbidden", "Storage key does not belong to this project.", 403);
  }

  const result = await commitUpload({ uploadJobId, key: storageKey, assetId, checksum, name, type, status, folder, tags });
  if (result.error === "not_committed") return apiError("not_committed", "Upload finished but could not be saved.", 409);
  if (result.error === "forbidden") return apiError("forbidden", "Key does not belong to this asset.", 403);
  if (result.error === "not_found") return apiError("not_found", "Upload target not found.", 404);
  if (result.error === "too_large") return apiError("too_large", "File exceeds the size limit.", 413);
  if (result.error) return apiError("bad_request", "Could not commit the upload.", 400);
  countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/upload/commit", method: "POST", status: 201, assetId: result.asset?.id }).catch(() => {});
  return ok(result, { status: 201 });
}
