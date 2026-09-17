if (typeof window !== "undefined") {
  throw new Error("lib/media/token is server-only — it reads the signing secret.");
}

// Signed, expiring, scoped tokens for public asset delivery.
//
// Every read today requires a session plus an active project grant, which
// structurally blocks share links, the brand portal, embeds and external
// upload portals. A token stands in for that session: it names exactly one
// asset and one variant, carries its own expiry, and is useless for anything
// else. It is a bearer credential — the caller still decides whether the
// underlying asset may be shared at all before minting one.
//
// Format: v1.<payload>.<signature>, both base64url. The payload is readable
// by design (it is not secret) — the signature is what makes it unforgeable.

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const VERSION = "v1";
// A token is a URL segment; cap it so a malformed one can never become an
// expensive HMAC over attacker-controlled megabytes.
const MAX_TOKEN_LENGTH = 2048;

export function isTokenSigningConfigured() {
  return Boolean(process.env.MEDIA_TOKEN_SECRET);
}

function secret() {
  const value = process.env.MEDIA_TOKEN_SECRET;
  return value ? Buffer.from(String(value), "utf8") : null;
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payloadB64, key) {
  return b64url(createHmac("sha256", key).update(`${VERSION}.${payloadB64}`).digest());
}

// Generate a signing secret. Exported so a setup script never invents a weak one.
export function generateSigningSecret() {
  return randomBytes(32).toString("hex");
}

// `ttlSeconds` is clamped rather than rejected: a share link with no practical
// expiry is the failure mode worth designing against.
const MAX_TTL_SECONDS = 60 * 60 * 24 * 30;

export function signDeliveryToken({ assetId, variant, ttlSeconds, scope } = {}) {
  try {
    const key = secret();
    if (!key) return null;
    if (typeof assetId !== "string" || assetId === "") return null;

    const ttl = Number(ttlSeconds);
    const effectiveTtl = Number.isFinite(ttl) && ttl > 0 ? Math.min(Math.floor(ttl), MAX_TTL_SECONDS) : 3600;

    const payload = {
      a: assetId,
      v: typeof variant === "string" && variant ? variant : "original",
      e: Math.floor(Date.now() / 1000) + effectiveTtl,
      s: scope === "download" ? "download" : "view",
    };
    const payloadB64 = b64url(JSON.stringify(payload));
    return `${VERSION}.${payloadB64}.${sign(payloadB64, key)}`;
  } catch (e) {
    console.error("[media.token.sign]", e?.message || e);
    return null;
  }
}

// Returns the claims, or null for anything that is not a currently-valid token.
// The caller cannot distinguish forged from expired — deliberately, so a probing
// client learns nothing from the difference.
export function verifyDeliveryToken(token) {
  try {
    const key = secret();
    if (!key) return null;
    if (typeof token !== "string" || token === "" || token.length > MAX_TOKEN_LENGTH) return null;

    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== VERSION) return null;
    const [, payloadB64, providedSig] = parts;
    if (!payloadB64 || !providedSig) return null;

    const expected = Buffer.from(sign(payloadB64, key), "utf8");
    const provided = Buffer.from(providedSig, "utf8");
    // timingSafeEqual throws on a length mismatch, and the lengths themselves
    // are not secret, so compare them first.
    if (expected.length !== provided.length) return null;
    if (!timingSafeEqual(expected, provided)) return null;

    const claims = JSON.parse(unb64url(payloadB64).toString("utf8"));
    if (!claims || typeof claims !== "object") return null;
    if (typeof claims.a !== "string" || claims.a === "") return null;
    if (!Number.isFinite(claims.e) || claims.e <= Math.floor(Date.now() / 1000)) return null;

    return {
      assetId: claims.a,
      variant: typeof claims.v === "string" && claims.v ? claims.v : "original",
      scope: claims.s === "download" ? "download" : "view",
      expiresAt: new Date(claims.e * 1000).toISOString(),
    };
  } catch {
    // Malformed base64, malformed JSON, anything — all indistinguishable.
    return null;
  }
}
