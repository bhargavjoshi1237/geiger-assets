if (typeof window !== "undefined") {
  throw new Error("lib/delivery/signing is server-only.");
}

import { createHmac, timingSafeEqual } from "node:crypto";

// Optional URL signing for dynamic delivery. Opt-in per project via
// delivery_settings.require_signed_urls (default OFF).

function payloadFor({ projectId, assetId, canonical, filename }) {
  return `${projectId}:${assetId}:${canonical}:${filename}`;
}

export function signDelivery({ projectId, assetId, canonical, filename, secret }) {
  return createHmac("sha256", String(secret || ""))
    .update(payloadFor({ projectId, assetId, canonical, filename }))
    .digest("hex");
}

export function verifyDeliverySignature({ projectId, assetId, canonical, filename, secret, signature }) {
  if (!secret || !signature) return false;
  const expected = signDelivery({ projectId, assetId, canonical, filename, secret });
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildDeliveryUrl({ projectId, assetId, canonical, filename, secret = null }) {
  const base = `/d/${projectId}/${assetId}/${canonical}/${filename}`;
  if (!secret) return base;
  const sig = signDelivery({ projectId, assetId, canonical, filename, secret });
  return `${base}?sig=${sig}`;
}
