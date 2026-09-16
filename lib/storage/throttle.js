if (typeof window !== "undefined") {
  throw new Error("lib/storage/throttle is server-only.");
}

import { NextResponse } from "next/server";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/media/ratelimit";

// One spelling of the rate-limit gate for every storage route, so a new route
// cannot quietly ship without one and the 429 shape stays identical across all
// of them. Returns a response to return, or null to continue.
//
// Identity is the session user where there is one. Unauthenticated delivery
// falls back to the client IP, which is spoofable through x-forwarded-for — it
// dampens naive scraping, it is not an authorization control.
export function throttle(bucket, identity) {
  const budget = RATE_LIMITS[bucket];
  if (!budget) return null;
  const result = rateLimit(`${bucket}:${identity || "anonymous"}`, budget);
  if (result.ok) return null;
  return NextResponse.json(
    { error: "rate_limited" },
    { status: 429, headers: rateLimitHeaders(result) },
  );
}

// First entry of x-forwarded-for is the client as the nearest proxy saw it;
// later entries are the proxies themselves.
export function clientIp(request) {
  const fwd = request?.headers?.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request?.headers?.get("x-real-ip") || "unknown";
}
