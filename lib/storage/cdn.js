if (typeof window !== "undefined") {
  throw new Error("lib/storage/cdn is server-only — it resolves backend drivers.");
}

// The CDN seam: given a stored object key, the origin-side URL a client can
// fetch directly, or null when no CDN is configured.
//
// This is deliberately provider-agnostic. R2, Appwrite, Cloudflare, Fastly and
// a plain bucket website all look the same from here: an operator names an
// origin on the backend (`cdnBaseUrl`), the driver turns a key into a URL
// (`publicUrl`), and delivery routes redirect instead of streaming bytes
// through Node. Nothing here knows or cares which provider it is, so the
// R2-vs-Appwrite decision can be made later without touching this code.
//
// WHAT THIS TRADES AWAY -- read before enabling it:
//
//   1. Authorization. requireProjectAccess still gates the *redirect*, so an
//      unauthorized caller gets a 403 and never learns the URL. But once a
//      permitted viewer holds the CDN URL it is fetchable by anyone it is
//      shared with, because the CDN does not consult us. Naming an origin is
//      an operator's explicit statement that these objects may be public.
//      That is why publicReads is opt-in per backend and never inferred.
//   2. Metering. lib/storage/meter.js bills what crossed the wire, read off
//      Content-Length. A redirect carries no body, so CDN-served bytes do not
//      appear in project_usage. The CDN's own logs become the source of truth
//      for delivery volume once this is on.
//
// Both are inherent to CDN fronting rather than flaws in this implementation,
// but neither should be discovered later by surprise.
//
// Only IMMUTABLE keys should be routed here. Derivatives are content-addressed
// by (asset, variant, format) and rewritten rather than mutated, so they are
// safe to pin on a CDN forever. Originals are NOT: an asset id keeps its URL
// across a re-upload, so a CDN copy would serve superseded bytes with no way
// to invalidate them.

import { driverFor } from "@/lib/storage/pool";

// Resolves the origin URL for a key on a given backend.
//
// `backendId` defaults to null, which driverFor() reads as the env-configured
// default backend -- and that default is the right answer for derivatives:
// lib/media/variants.js writes them through lib/s3/objects.js (the env
// singleton), not through the pool, so a derivative lives in the env bucket
// regardless of which backend holds the asset's original. Pass an explicit
// backendId only for a key you know was placed by the pool.
export async function cdnUrlFor(key, { backendId = null } = {}) {
  if (!key) return null;
  try {
    const driver = await driverFor(backendId);
    // capabilities.publicReads is false unless an origin was configured, so an
    // unconfigured deployment returns null here and every caller proxies as
    // it always did.
    if (!driver?.capabilities?.publicReads) return null;
    if (typeof driver.publicUrl !== "function") return null;
    return driver.publicUrl(key) || null;
  } catch (e) {
    console.error("[storage.cdn]", e?.message || e);
    return null;
  }
}

export default cdnUrlFor;
