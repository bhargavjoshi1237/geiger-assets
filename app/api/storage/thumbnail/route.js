import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { getAssetRow } from "@/lib/storage/service";
import {
  THUMBNAIL_BUCKET,
  thumbnailAdminClient,
  storeThumbnailVariants,
  removeThumbnailUrls,
} from "@/lib/storage/thumbnail-store";

export const runtime = "nodejs";

// Convert client previews to AVIF and keep them in Supabase instead of the pool.
const MAX_BYTES = 2 * 1024 * 1024;

const PARTS = [
  { field: "file", kind: "preview", column: "thumbnail_url", key: "thumbnailUrl" },
  { field: "mini", kind: "mini", column: "mini_thumbnail_url", key: "miniThumbnailUrl" },
];

function isValidPart(file) {
  return file instanceof Blob && file.size > 0 && file.size <= MAX_BYTES;
}

export async function POST(request) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const assetId = String(form.get("assetId") || "");
  const parts = PARTS.map((part) => ({ ...part, file: form.get(part.field) })).filter(
    (part) => part.file != null,
  );
  if (!assetId || !parts.length || !parts.every((part) => isValidPart(part.file))) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const row = await getAssetRow(assetId);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const access = await requireProjectAccess({ projectId: row.project_id, action: "write" });
  if (access.response) return access.response;

  let admin;
  try {
    admin = thumbnailAdminClient();
  } catch (error) {
    console.error("[storage.thumbnail]", error.message);
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }

  const storage = admin.storage;
  let stored;
  try {
    stored = await storeThumbnailVariants(storage, {
      projectId: row.project_id,
      assetId,
      parts: await Promise.all(parts.map(async (part) => ({
        kind: part.kind,
        body: Buffer.from(await part.file.arrayBuffer()),
      }))),
    });
  } catch (error) {
    console.error("[storage.thumbnail.store]", error);
    return NextResponse.json({ error: "store_failed" }, { status: 502 });
  }

  const patch = Object.fromEntries(parts.map((part) => [part.column, stored.urls[part.kind]]));
  const { data, error } = await admin.schema("assets").from("assets")
    .update(patch).eq("id", assetId).eq("project_id", row.project_id)
    .is("deleted_at", null).select("id").maybeSingle();
  if (error || !data) {
    console.error("[storage.thumbnail.update]", error?.message || "Asset disappeared before update.");
    const cleanup = await storage.from(THUMBNAIL_BUCKET).remove(Object.values(stored.paths));
    if (cleanup.error) console.error("[storage.thumbnail.cleanup]", cleanup.error.message);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  try {
    await removeThumbnailUrls(
      storage,
      parts.map((part) => row[part.column]),
      `p/${row.project_id}/thumb/${assetId}/`,
    );
  } catch (error) {
    console.error("[storage.thumbnail.previous]", error.message);
  }

  const urls = Object.fromEntries(parts.map((part) => [part.key, stored.urls[part.kind]]));
  return NextResponse.json({ thumbnailUrl: "", miniThumbnailUrl: "", ...urls });
}
