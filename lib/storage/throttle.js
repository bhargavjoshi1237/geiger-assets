if (typeof window !== "undefined") {
  throw new Error("lib/storage/throttle is server-only.");
}

import { NextResponse } from "next/server";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/media/ratelimit";

// One spelling of the rate-limit gate for every storage route, so a new route
// cannot quietly ship without one and the 429 shape stays identical across all
// of them. Returns a response to return, or null to continue.
//
// Identity is the signed-in user, so routes call this after their auth check.
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
