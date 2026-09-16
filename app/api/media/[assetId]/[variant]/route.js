import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { getAssetRow, isStorageConfigured, proxyStreamResponse } from "@/lib/storage/service";
import { DEFAULT_FORMAT, DELIVERABLE_FORMATS, isVariantName, resolveVariant } from "@/lib/media/variants";
import { negotiateImageFormat, varyHeader } from "@/lib/media/negotiate";
import { throttle } from "@/lib/storage/throttle";
import { meterVariantDelivery } from "@/lib/storage/meter";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  try {
    const { assetId, variant } = await params;
    const name = typeof variant === "string" ? variant.trim().toLowerCase() : "";
    if (!isVariantName(name)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
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

    const resolved = await resolveVariant({ row, variant: name, format });
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

    const res = await proxyStreamResponse(resolved.key, {
      filename: row.original_filename || row.name,
      request,
    });
    if (!res) return NextResponse.json({ error: "not_found" }, { status: 404 });
    res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    // Without Vary: Accept a shared cache would serve AVIF bytes to a client that cannot decode them.
    res.headers.set("Vary", varyHeader(res.headers.get("Vary")));
    await meterVariantDelivery(row, `${name}.${format}`, res);
    return res;
  } catch (e) {
    console.error("[media.variant]", e?.message || e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
