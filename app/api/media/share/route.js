import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { getAssetRow } from "@/lib/storage/service";
import { isVariantName } from "@/lib/media/variants";
import { isTokenSigningConfigured, signDeliveryToken, verifyDeliveryToken } from "@/lib/media/token";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    if (!isTokenSigningConfigured()) {
      return NextResponse.json({ error: "signing_unconfigured" }, { status: 503 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const assetId = body?.assetId;
    if (typeof assetId !== "string" || assetId === "") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const rawVariant = body?.variant ?? "original";
    const variant = typeof rawVariant === "string" ? rawVariant.trim().toLowerCase() || "original" : "original";
    if (variant !== "original" && !isVariantName(variant)) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const scope = body?.scope ?? "view";
    if (scope !== "view" && scope !== "download") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const row = await getAssetRow(assetId);
    if (!row?.storage_key) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const access = await requireProjectAccess({ projectId: row.project_id, action: "read" });
    if (access.response) return access.response;

    const token = signDeliveryToken({ assetId: row.id, variant, ttlSeconds: body?.ttlSeconds, scope });
    if (!token) {
      return NextResponse.json({ error: "sign_failed" }, { status: 500 });
    }

    const claims = verifyDeliveryToken(token);
    return NextResponse.json({ token, url: `/t/${token}`, expiresAt: claims?.expiresAt ?? null });
  } catch (e) {
    console.error("[media.share]", e?.message || e);
    return NextResponse.json({ error: "share_failed" }, { status: 500 });
  }
}
