import { NextResponse } from "next/server";

import { commerceDb, completeOrder, orderIdForSession } from "@/lib/commerce/server";
import { loadOrderBundle, logOrderEvent } from "@/lib/commerce/fulfillment";
import { verifyWebhook } from "@/lib/commerce/stripe";
import { completePayment, paymentIdForSession } from "@/lib/creator/server";

export const runtime = "nodejs";

/**
 * Stripe → store. Point a Stripe webhook endpoint at /api/store/stripe/webhook
 * with `checkout.session.completed`, `checkout.session.async_payment_succeeded`
 * and `checkout.session.expired`, and put its signing secret in
 * STRIPE_WEBHOOK_SECRET. Completing an order is idempotent, so Stripe's
 * retries are harmless.
 */
export async function POST(request) {
  const raw = await request.text();
  const event = verifyWebhook(raw, request.headers.get("stripe-signature"));
  if (!event) return NextResponse.json({ error: "invalid_signature" }, { status: 400 });

  const session = event.data?.object;
  const db = await commerceDb();

  // Fan payments from a creator page (subscriptions, tips, unlocks) carry a
  // fan_payment_id and settle through the creator core, not the store.
  if (session?.metadata?.fan_payment_id) {
    const paid = session.payment_status === "paid";
    if (event.type === "checkout.session.expired") {
      await db.from("fan_payments").update({ status: "cancelled" }).eq("id", session.metadata.fan_payment_id).eq("status", "pending");
    } else if (paid && event.type.startsWith("checkout.session.")) {
      const paymentId = await paymentIdForSession(db, session);
      if (paymentId) await completePayment(db, paymentId, { provider: "stripe", providerRef: session.payment_intent || session.id });
    }
    return NextResponse.json({ received: true });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (session?.payment_status !== "paid") break;
      const orderId = await orderIdForSession(db, session);
      if (!orderId) break;
      await completeOrder(db, orderId, {
        provider: "stripe",
        providerRef: session.payment_intent || session.id,
        actor: "Stripe",
      });
      break;
    }
    case "checkout.session.expired": {
      const orderId = await orderIdForSession(db, session);
      const bundle = orderId ? await loadOrderBundle(db, orderId) : null;
      if (bundle?.order.status === "pending") {
        await db.from("store_orders").update({ status: "failed" }).eq("id", orderId);
        await logOrderEvent(db, bundle.order, "payment", "Checkout expired without payment", { actor: "Stripe" });
      }
      break;
    }
    default:
      break;
  }
  return NextResponse.json({ received: true });
}
