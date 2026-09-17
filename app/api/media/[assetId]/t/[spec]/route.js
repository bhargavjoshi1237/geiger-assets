import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { getAssetRow, isStorageConfigured, proxyStreamResponse } from "@/lib/storage/service";
import { DEFAULT_FORMAT, DELIVERABLE_FORMATS, resolveTransform } from "@/lib/media/variants";
import { parseTransform } from "@/lib/media/transform";
import { negotiateImageFormat, varyHeader } from "@/lib/media/negotiate";
import { throttle } from "@/lib/storage/throttle";
import { meterVariantDelivery } from "@/lib/storage/meter";
import { cdnUrlFor } from "@/lib/storage/cdn";

// URL image transforms: /api/media/<assetId>/t/<spec>, e.g.
// /api/media/<id>/t/w_384,h_256,c_fill
//
// The literal "t" segment is what keeps this route from colliding with the
// named-variant route one level up (app/api/media/[assetId]/[variant]). Two
// differently-named dynamic segments at the same position are a hard App
// Router error; a static segment beside a dynamic one is not, and static wins
// the match, so /api/media/<id>/thumb still resolves to [variant] exactly as
// before while /api/media/<id>/t/... resolves here.
//
// Every value in <spec> comes from a fixed allowlist (lib/media/transform.js).
// That is the security boundary: without it this route is an open CPU and
// bucket amplifier, since each novel spec costs a sharp decode and leaves a
// permanent derivative behind. Anything off the allowlist is a 400 — never
// clamped to the nearest legal value, which would let a walk of arbitrary
// widths resolve and still pay for a derive apiece.

export const runtime = "nodejs";

export async function GET(request, { params }) {
  try {
    const { assetId, spec } = await params;
    // Parsed before anything else so a malformed spec is a cheap 400 rather
    // than a DB read. The parsed object is handed to the resolver so the
    // string is only ever parsed once.
    const transform = parseTransform(typeof spec === "string" ? spec : "");
    if (!transform) {
      return NextResponse.json({ error: "bad_transform" }, { status: 400 });
    }
    if (!isStorageConfigured()) {
      return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
    }

    const row = await getAssetRow(assetId);
    if (!row?.storage_key) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const access = await requireProjectAccess({ projectId: row.project_id, action: "read" });
    if (access.response) return access.response;

    const limited = throttle("deliver", access.userId);
    if (limited) return limited;

    const { searchParams } = new URL(request.url);
    const override = searchParams.get("format");
    let format;
    if (override !== null) {
      const normalized = override.trim().toLowerCase();
      if (!DELIVERABLE_FORMATS.includes(normalized)) {
        return NextResponse.json({ error: "bad_format" }, { status: 400 });
      }
      format = normalized;
    } else {
      format = negotiateImageFormat(request.headers.get("accept"), {
        candidates: DELIVERABLE_FORMATS,
        fallback: DEFAULT_FORMAT,
      }).format;
    }

    const resolved = await resolveTransform({ row, transform, format });
    if (!resolved?.key) {
      // Null covers non-raster originals, oversized inputs and derive
      // failures — the original is always correct, so serve it instead.
      const fallback = await proxyStreamResponse(row.storage_key, {
        filename: row.original_filename || row.name,
        request,
      });
      if (!fallback) return NextResponse.json({ error: "not_found" }, { status: 404 });
      // Originals stay mutable under this URL (a re-upload keeps the asset id),
      // so they revalidate on a short lifetime instead of pinning immutable.
      fallback.headers.set("Cache-Control", "public, max-age=3600, must-revalidate");
      // Without Vary: Accept a shared cache would serve AVIF bytes to a client that cannot decode them.
      fallback.headers.set("Vary", varyHeader(fallback.headers.get("Vary")));
      await meterVariantDelivery(row, "original", fallback);
      return fallback;
    }

    // CDN seam — same bargain as the named-variant route: a transform
    // derivative is immutable and content-addressed, so redirect to the origin
    // when one is configured and proxy otherwise. See lib/storage/cdn.js for
    // what a CDN hop gives up (re-checked permissions, byte metering).
    const cdn = await cdnUrlFor(resolved.key);
    if (cdn) {
      const hop = NextResponse.redirect(cdn, 307);
      hop.headers.set("Cache-Control", "public, max-age=31536000, immutable");
      hop.headers.set("Vary", varyHeader(hop.headers.get("Vary")));
      return hop;
    }

    const res = await proxyStreamResponse(resolved.key, {
      filename: row.original_filename || row.name,
      request,
    });
    if (!res) return NextResponse.json({ error: "not_found" }, { status: 404 });
    res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    // Without Vary: Accept a shared cache would serve AVIF bytes to a client that cannot decode them.
    res.headers.set("Vary", varyHeader(res.headers.get("Vary")));
    // Metered under the canonical slot, so the usage rollup groups every
    // spelling of one transform ("h_256,w_384" and "w_384,h_256") together.
    await meterVariantDelivery(row, resolved.slot || `t/${transform.canonical}.${format}`, res);
    return res;
  } catch (e) {
    console.error("[media.transform]", e?.message || e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
