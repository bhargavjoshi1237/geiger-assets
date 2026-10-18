import { notFound } from "next/navigation";

import { FanCheckout } from "@/components/internal/screens/projects/creator/public/fan_checkout";
import { creatorDb, loadCreator, loadPayment } from "@/lib/creator/server";

export const dynamic = "force-dynamic";

const SUMMARY = {
  subscription: "Membership",
  tip: "Tip",
  post_unlock: "Unlock a post",
  message_unlock: "Unlock a message",
  bundle_unlock: "Bundle",
};

/**
 * Test checkout for a fan payment, and the return page after Stripe. The
 * payment's access token in the URL is the only key — without it, 404.
 */
export default async function FanPaymentRoute({ params, searchParams }) {
  const { handle, paymentId } = await params;
  const { token } = await searchParams;
  const db = await creatorDb();
  const creator = await loadCreator(db, handle);
  const payment = creator ? await loadPayment(db, paymentId, token) : null;
  if (!payment || payment.project_id !== creator.profile.projectId) notFound();

  let summary = SUMMARY[payment.kind] || "Payment";
  if (payment.kind === "subscription" && payment.tier_id) {
    const tier = creator.tiers.find((t) => t.id === payment.tier_id);
    const cycle = payment.metadata?.cycle || tier?.interval;
    if (tier) summary = `${tier.name} membership · ${cycle === "year" ? "1 year" : "1 month"}`;
  } else if (payment.kind === "post_unlock" && payment.target_id) {
    const { data } = await db.from("ppv_posts").select("title").eq("id", payment.target_id).maybeSingle();
    if (data?.title) summary = `Unlock “${data.title}”`;
  }

  return (
    <FanCheckout
      profile={{ ...creator.profile, accentColor: creator.page.theme.accent }}
      theme={creator.page.theme}
      token={token}
      summary={summary}
      payment={{
        id: payment.id,
        kind: payment.kind,
        status: payment.status,
        provider: payment.provider,
        amountCents: Number(payment.amount_cents),
        currency: payment.currency,
        promoCode: payment.metadata?.promo_code || "",
      }}
    />
  );
}

export const metadata = { title: "Checkout", robots: { index: false, follow: false } };
