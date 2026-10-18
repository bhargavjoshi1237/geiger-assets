import { NextResponse } from "next/server";

import { requireProjectAccess } from "@/lib/storage/auth";
import { isStripeConfigured, isStripeTestKey } from "@/lib/commerce/stripe";

export const runtime = "nodejs";

/**
 * What the store screens can't read from the browser: whether the Stripe keys
 * are set, whether the key is a test key, and whether the webhook secret is in
 * place. Never returns the keys themselves.
 */
export async function GET(request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  const access = await requireProjectAccess({ projectId, action: "read" });
  if (access.response) return access.response;

  return NextResponse.json({
    stripeConfigured: isStripeConfigured(),
    stripeTestKey: isStripeTestKey(),
    webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
