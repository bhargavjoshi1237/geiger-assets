import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  accessProblem,
  loadGalleryBySlug,
  loadGalleryDownload,
  unlockCookieName,
} from "@/lib/supabase/gallery_server";
import { assetDownloadResponse } from "@/lib/storage/download_response";

export const runtime = "nodejs";

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

/**
 * Download one asset from a gallery whose download mode is "open".
 *
 * Runs the same access check as the page itself (visibility, publish state,
 * expiry and the password cookie), then confirms the asset really belongs to
 * this gallery — so the route can't be used to pull arbitrary project assets.
 * The response itself (signed redirect or streamed attachment) is shared with
 * the store's paid-download route.
 */
export async function GET(request, { params }) {
  const { slug, assetId } = await params;
  const resolved = await loadGalleryBySlug(slug);
  const gallery = resolved?.gallery;
  if (!gallery) return notFound();

  const jar = await cookies();
  const unlocked = jar.get(unlockCookieName(gallery.id))?.value === "1";
  // A gated gallery answers exactly like a missing one, as the page does.
  if (accessProblem(gallery, { unlocked })) return notFound();
  if (gallery.downloadMode !== "open") {
    return NextResponse.json({ error: "downloads_disabled" }, { status: 403 });
  }

  const row = await loadGalleryDownload(gallery, assetId);
  if (!row) return notFound();
  return assetDownloadResponse(row);
}
