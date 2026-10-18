import { NextResponse } from "next/server";

import { commerceDb, completeOrder, paymentProvider } from "@/lib/commerce/server";
import { loadOrderBundle } from "@/lib/commerce/fulfillment";

export const runtime = "nodejs";

/**
 * The built-in test checkout's "pay" button. Only an order placed in test mode
 * can be completed this way, and only by someone holding its access token —
 * Stripe orders are completed by the webhook, manual ones by staff.
 */
export async function POST(request, { params }) {
  const { orderId } = await params;
  let token = "";
  try {
    ({ token } = await request.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const db = await commerceDb();
  const bundle = await loadOrderBundle(db, orderId);
  if (!bundle || !token || bundle.order.accessToken !== token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (bundle.order.provider !== "test" || paymentProvider(bundle.settings) !== "test") {
    return NextResponse.json({ error: "This order isn't in test mode." }, { status: 409 });
  }

  const done = await completeOrder(db, orderId, {
    provider: "test",
    providerRef: `test_${Date.now().toString(36)}`,
    actor: bundle.order.email,
    note: "Test payment approved",
  });
  if (!done) return NextResponse.json({ error: "Couldn't complete the order." }, { status: 500 });
  return NextResponse.json({ ok: true, status: done.order.status });
}
