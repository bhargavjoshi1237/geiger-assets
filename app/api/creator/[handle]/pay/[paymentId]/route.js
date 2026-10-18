import { NextResponse } from "next/server";

import { completePayment, creatorDb, loadPayment, paymentProviderName } from "@/lib/creator/server";

export const runtime = "nodejs";

/**
 * The built-in test checkout's "pay" button for fan payments. Only a payment
 * opened in test mode, by someone holding its access token, can be approved
 * here — Stripe payments are settled by the webhook.
 */
export async function POST(request, { params }) {
  const { paymentId } = await params;
  let token = "";
  let decline = false;
  try {
    ({ token, decline = false } = await request.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const db = await creatorDb();
  const payment = await loadPayment(db, paymentId, token);
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (payment.provider !== "test" || paymentProviderName() !== "test") {
    return NextResponse.json({ error: "This payment isn't in test mode." }, { status: 409 });
  }
  if (payment.status !== "pending") return NextResponse.json({ ok: true, status: payment.status });

  if (decline) {
    await db.from("fan_payments").update({ status: "cancelled" }).eq("id", payment.id).eq("status", "pending");
    return NextResponse.json({ ok: true, status: "cancelled" });
  }
  const done = await completePayment(db, payment.id, { provider: "test", providerRef: `test_${Date.now().toString(36)}` });
  if (!done) return NextResponse.json({ error: "Couldn't complete the payment." }, { status: 500 });
  return NextResponse.json({ ok: true, status: "paid" });
}
