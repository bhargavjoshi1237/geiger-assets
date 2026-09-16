import { NextResponse } from "next/server";
import { getAssetRow, proxyStreamResponse } from "@/lib/storage/service";
import { verifyDeliveryToken } from "@/lib/media/token";
import { resolveVariant, isVariantName, DELIVERABLE_FORMATS, DEFAULT_FORMAT } from "@/lib/media/variants";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/media/ratelimit";
import { negotiateImageFormat, varyHeader } from "@/lib/media/negotiate";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  try {
    // Unauthenticated, so this is the route that gets scraped — bound it before any I/O.
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const limited = rateLimit(`deliver:${ip}`, RATE_LIMITS.deliver);
    if (!limited.ok) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(limited) });
    }

    const { token } = await params;
    const claims = verifyDeliveryToken(token);
    if (!claims) {
      // Expired and forged read identically, so a prober learns nothing from the difference.
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // The token is the only authority — no assetId, variant or scope is ever read elsewhere.
    const row = await getAssetRow(claims.assetId);
    if (!row?.storage_key) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const filename = row.original_filename || row.name;
    const download = claims.scope === "download";
    let key = row.storage_key;
    let negotiated = false;

    const variant = typeof claims.variant === "string" ? claims.variant.trim().toLowerCase() || "original" : "original";
    if (variant !== "original" && isVariantName(variant)) {
      const picked = negotiateImageFormat(request.headers.get("accept"), {
        candidates: [...DELIVERABLE_FORMATS],
        fallback: DEFAULT_FORMAT,
      });
      negotiated = true;
      const resolved = await resolveVariant({ row, variant, format: picked?.format || DEFAULT_FORMAT });
      if (resolved?.key) key = resolved.key;
    }

    const res = await proxyStreamResponse(key, { filename, download, request });
    if (!res) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // The URL is a bearer credential — a shared cache keyed on it hands the bytes onward.
    res.headers.set("Cache-Control", "private, max-age=31536000, immutable");
    if (negotiated) res.headers.set("Vary", varyHeader(res.headers.get("Vary")));
    return res;
  } catch (e) {
    console.error("[media.deliver]", e?.message || e);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
