if (typeof window !== "undefined") {
  throw new Error("lib/storage/delivery_log is server-only.");
}

import { createServerSupabase } from "@/lib/supabase/server";

const COUNTRY_HEADERS = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "cloudfront-viewer-country",
  "x-country",
  "x-geo-country",
];

function countryOf(request) {
  try {
    for (const name of COUNTRY_HEADERS) {
      const value = request?.headers?.get(name);
      if (value) return String(value).trim().toUpperCase().slice(0, 2);
    }
  } catch {
    // headers unavailable — record without a country
  }
  return "";
}

function referrerHostOf(request) {
  try {
    const raw =
      request?.headers?.get("referer") || request?.headers?.get("referrer") || "";
    if (!raw) return "";
    return new URL(String(raw), "http://local").hostname || "";
  } catch {
    return "";
  }
}

/**
 * Append one row to assets.delivery_events without ever blocking the caller.
 * Call AFTER the file response is built; the stream returns while the insert
 * runs in the background. A bare 304 on ETag match is the cache hit signal
 * (proxyStreamResponse answers 304 with no body), so bytes come from the
 * response's Content-Length and the country/referrer from request headers.
 */
export function logFileDelivery({
  request,
  response,
  projectId,
  assetId,
  kind = "file",
  linkId = null,
  embedId = null,
  transform = {},
}) {
  try {
    if (!projectId || !response) return;
    const status = Number(response.status) || 200;
    const payload = {
      project_id: projectId,
      asset_id: assetId || null,
      link_id: linkId || null,
      embed_id: embedId || null,
      kind,
      bytes: Number(response.headers?.get("content-length")) || 0,
      cache_status: status === 304 ? "hit" : "miss",
      status_code: status,
      country: countryOf(request),
      referrer_host: referrerHostOf(request),
      transform: transform || {},
      occurred_at: new Date().toISOString(),
    };
    createServerSupabase()
      .then((sb) => sb.schema("assets").from("delivery_events").insert(payload))
      .then(
        () => {},
        (e) => console.error("[delivery.log]", e?.message || e),
      );
  } catch (e) {
    console.error("[delivery.log]", e?.message || e);
  }
}
