import { NextResponse } from "next/server";

import { currentFan } from "@/lib/creator/fan_auth";
import { creatorDb, isPageAsset, loadCreator, loadInbox, loadViewer, postAssetFor } from "@/lib/creator/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { getAssetRow, isStorageConfigured } from "@/lib/storage/service";
import { backendForRef, refFromAssetRow } from "@/lib/storage/backends/index.js";

export const runtime = "nodejs";

/**
 * The full-resolution file behind a post's media item (?post=<id>&i=<n>), a DM attachment
 * (?message=<id>) or the page layout's own media (?page=<assetId>, e.g. a hero video; the
 * builder's unpublished draft media needs &preview=1 and a workspace session). Access is re-checked on every request with the same rules
 * the page used, so a locked file can't be fetched by guessing its URL; the
 * response is a short-lived signed redirect that's never shared-cached.
 */
export async function GET(request, { params }) {
  if (!isStorageConfigured()) return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  const { handle } = await params;
  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("post");
  const messageId = searchParams.get("message");
  const pageAssetId = searchParams.get("page");

  const db = await creatorDb();
  let creator = await loadCreator(db, handle);
  if (pageAssetId && searchParams.get("preview") === "1" && !(creator && isPageAsset(creator, pageAssetId))) {
    const draft = await loadCreator(db, handle, { preview: true });
    if (draft && !(await requireProjectAccess({ projectId: draft.profile.projectId })).response) creator = draft;
  }
  if (!creator) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let assetId = null;
  if (pageAssetId) {
    assetId = isPageAsset(creator, pageAssetId) ? pageAssetId : null;
  } else if (postId) {
    const viewer = await loadViewer(db, creator.profile, await currentFan(db));
    assetId = await postAssetFor(db, creator, viewer, postId, searchParams.get("i"));
  } else if (messageId) {
    const viewer = await loadViewer(db, creator.profile, await currentFan(db));
    const message = (await loadInbox(db, creator, viewer)).find((m) => m.id === messageId);
    if (message && !message.locked) {
      const { data } = await db.from("paid_messages").select("attachment_asset_id").eq("id", messageId).maybeSingle();
      assetId = data?.attachment_asset_id ?? null;
    }
  }
  if (!assetId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const row = await getAssetRow(assetId);
  if (!row?.storage_key || row.project_id !== creator.profile.projectId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const ref = refFromAssetRow(row) || { backend: "s3", key: row.storage_key };
  const url = await backendForRef(ref).signRead(ref, { download: searchParams.get("download") === "1", filename: row.original_filename || row.name });
  if (!url) return NextResponse.json({ error: "sign_failed" }, { status: 500 });
  return NextResponse.redirect(url, { status: 307, headers: { "Cache-Control": "private, no-store" } });
}
