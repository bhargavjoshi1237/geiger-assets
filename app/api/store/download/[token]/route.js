import { NextResponse } from "next/server";

import { commerceDb } from "@/lib/commerce/server";
import { RENDITIONS, entitlementProblem, normalizeEntitlement } from "@/lib/commerce/shape";
import { DOWNLOAD_COLUMNS, assetDownloadResponse } from "@/lib/storage/download_response";

export const runtime = "nodejs";

const PROBLEM_STATUS = { revoked: 410, expired: 410, exhausted: 429, missing: 404 };
const PROBLEM_TEXT = {
  revoked: "This download link has been revoked.",
  expired: "This download link has expired.",
  exhausted: "This download link has been used the maximum number of times.",
  missing: "This download link doesn't exist.",
};

/**
 * A purchased download. The token is the whole credential: it maps to one
 * entitlement, which is checked for revocation, expiry and its download limit
 * before the count is taken and the file (or its sized rendition) is served.
 */
export async function GET(request, { params }) {
  const { token } = await params;
  if (!/^[a-f0-9]{16,64}$/i.test(String(token || ""))) {
    return NextResponse.json({ error: PROBLEM_TEXT.missing }, { status: 404 });
  }

  const db = await commerceDb();
  const { data: row } = await db
    .from("store_entitlements")
    .select("*")
    .eq("token", token)
    .is("deleted_at", null)
    .maybeSingle();
  const entitlement = normalizeEntitlement(row);
  const problem = entitlementProblem(entitlement);
  if (problem) {
    return NextResponse.json({ error: PROBLEM_TEXT[problem] }, { status: PROBLEM_STATUS[problem] });
  }

  // Take the download before serving it, conditioned on the count just read,
  // so two parallel requests can't both spend the last one.
  const { data: taken } = await db
    .from("store_entitlements")
    .update({
      downloads_count: entitlement.downloadsCount + 1,
      last_downloaded_at: new Date().toISOString(),
    })
    .eq("id", entitlement.id)
    .eq("downloads_count", entitlement.downloadsCount)
    .select("id");
  if (!taken?.length) return NextResponse.json({ error: "Try the download again." }, { status: 409 });

  const { data: asset } = await db
    .from("assets")
    .select(DOWNLOAD_COLUMNS)
    .eq("id", entitlement.assetId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!asset) return NextResponse.json({ error: "This file is no longer available." }, { status: 404 });

  return assetDownloadResponse(asset, {
    maxEdge: RENDITIONS[entitlement.rendition]?.maxEdge ?? null,
    format: entitlement.format || "original",
  });
}
