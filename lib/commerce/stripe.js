if (typeof window !== "undefined") {
  throw new Error("lib/commerce/stripe is server-only.");
}

// Minimal Stripe client over the REST API — Checkout Sessions, refunds and
// webhook signature checks are all this app needs, so it talks to
// api.stripe.com with fetch instead of pulling in the SDK.
//
// Configured by STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET for the webhook).
// When the key is absent the store runs its built-in test checkout instead.

import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.stripe.com/v1";
const TIMEOUT_MS = 15_000;
const SIGNATURE_TOLERANCE_S = 300;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isStripeTestKey() {
  return String(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_");
}

/** { a: { b: [1] } } -> "a[b][0]=1" — Stripe's form encoding for nested params. */
function encode(params, prefix = "", out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object") encode(value, name, out);
    else out.append(name, String(value));
  }
  return out;
}

async function call(path, params, { method = "POST", idempotencyKey } = {}) {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "GET" ? undefined : encode(params).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Stripe responded ${res.status}`);
  return body;
}

/**
 * A hosted Checkout Session for one order. `lines` are
 * `{ name, description?, unitCents, quantity }`.
 */
export function createCheckoutSession({ order, lines, successUrl, cancelUrl, descriptor }) {
  return call(
    "checkout/sessions",
    {
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: order.email || undefined,
      client_reference_id: order.id,
      metadata: { order_id: order.id, project_id: order.projectId, order_number: order.number },
      payment_intent_data: {
        metadata: { order_id: order.id, order_number: order.number },
        ...(descriptor ? { statement_descriptor_suffix: descriptor.slice(0, 22) } : {}),
      },
      line_items: lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: order.currency || "usd",
          unit_amount: line.unitCents,
          product_data: {
            name: line.name.slice(0, 250),
            ...(line.description ? { description: line.description.slice(0, 500) } : {}),
          },
        },
      })),
    },
    { idempotencyKey: `checkout-${order.id}` },
  );
}

/**
 * A one-off hosted Checkout Session that isn't a store order — fan
 * subscriptions, tips and unlocks. `metadata` rides on both the session and the
 * payment intent so the webhook can route it back.
 */
export function createPaymentSession({ reference, email, currency = "usd", lines, successUrl, cancelUrl, metadata }) {
  return call(
    "checkout/sessions",
    {
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email || undefined,
      client_reference_id: reference,
      metadata,
      payment_intent_data: { metadata },
      line_items: lines.map((line) => ({
        quantity: line.quantity || 1,
        price_data: {
          currency,
          unit_amount: line.unitCents,
          product_data: {
            name: line.name.slice(0, 250),
            ...(line.description ? { description: line.description.slice(0, 500) } : {}),
          },
        },
      })),
    },
    { idempotencyKey: `payment-${reference}` },
  );
}

export function createRefund({ paymentIntent, amountCents, reason, orderId }) {
  return call(
    "refunds",
    {
      payment_intent: paymentIntent,
      amount: amountCents,
      reason: reason === "duplicate" || reason === "fraudulent" ? reason : "requested_by_customer",
      metadata: { order_id: orderId },
    },
    { idempotencyKey: `refund-${orderId}-${amountCents}-${Date.now()}` },
  );
}

/**
 * Verify a Stripe-Signature header against the raw request body and return the
 * parsed event, or null when the signature doesn't match or is stale.
 */
export function verifyWebhook(rawBody, header) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return null;
  const parts = Object.fromEntries(
    String(header)
      .split(",")
      .map((p) => p.split("="))
      .filter((p) => p.length === 2),
  );
  const timestamp = Number(parts.t);
  const provided = String(header)
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!Number.isFinite(timestamp) || !provided.length) return null;
  if (Math.abs(Date.now() / 1000 - timestamp) > SIGNATURE_TOLERANCE_S) return null;

  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex"),
  );
  const ok = provided.some((sig) => {
    const given = Buffer.from(sig);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!ok) return null;
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}
