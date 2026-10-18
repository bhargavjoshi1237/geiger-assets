"use client";

// The built-in test checkout for fan payments (no Stripe key configured), and
// the landing page a Stripe payment returns to. Shows what's being bought, lets
// the fan approve or cancel a test payment, then sends them back to the page.

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleX, Clock, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { accentStyle, formatMoney, postJson } from "./public_kit";
import { PageTheme } from "./page_theme";

const KIND_LABEL = {
  subscription: "Membership",
  tip: "Tip",
  post_unlock: "Post unlock",
  message_unlock: "Message unlock",
};

export function FanCheckout({ profile, theme, payment, token, summary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const home = `/c/${encodeURIComponent(profile.handle)}`;
  const accent = accentStyle(profile.accentColor);

  const act = async (decline) => {
    setBusy(decline ? "decline" : "pay");
    setError("");
    const result = await postJson(`/api/creator/${encodeURIComponent(profile.handle)}/pay/${payment.id}`, { token, decline });
    setBusy(null);
    if (result.error) return setError(result.error);
    router.refresh();
  };

  let state;
  if (payment.status === "paid") {
    state = (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Payment complete</h1>
          <p className="mt-1 text-sm text-text-secondary">Thanks for supporting {profile.displayName}.</p>
        </div>
        <Button asChild className="w-full hover:opacity-90" style={accent}>
          <Link href={payment.kind === "message_unlock" ? `${home}?messages=1` : home}>Continue</Link>
        </Button>
      </div>
    );
  } else if (payment.status === "pending" && payment.provider === "test") {
    state = (
      <div className="space-y-4">
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Test checkout — no card is charged. Approve to simulate a successful payment.
        </p>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <Button className="h-10 w-full hover:opacity-90" style={accent} disabled={Boolean(busy)} onClick={() => act(false)}>
          {busy === "pay" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          Pay {formatMoney(payment.amountCents, payment.currency)}
        </Button>
        <Button variant="ghost" className="w-full text-muted-foreground hover:bg-surface-active" disabled={Boolean(busy)} onClick={() => act(true)}>
          Cancel
        </Button>
      </div>
    );
  } else if (payment.status === "pending") {
    state = (
      <div className="space-y-3 text-center">
        <Clock className="mx-auto h-10 w-10 text-text-secondary" />
        <p className="text-sm text-text-secondary">Confirming your payment — this page updates in a moment.</p>
        <Button variant="outline" className="border-border bg-transparent" onClick={() => router.refresh()}>
          Refresh
        </Button>
      </div>
    );
  } else {
    state = (
      <div className="space-y-4 text-center">
        <CircleX className="mx-auto h-10 w-10 text-text-tertiary" />
        <p className="text-sm text-text-secondary">This payment was {payment.status === "failed" ? "not completed" : "cancelled"}.</p>
        <Button asChild variant="outline" className="w-full border-border bg-transparent">
          <Link href={home}>Back to {profile.displayName}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="cp-root flex items-center justify-center px-4 py-10 text-foreground">
      {theme ? <PageTheme theme={theme} /> : null}
      <div className="cp-card w-full max-w-sm space-y-6 p-6">
        <div className="space-y-1 border-b border-border pb-4">
          <p className="text-xs uppercase tracking-wider text-text-tertiary">{KIND_LABEL[payment.kind] || "Payment"}</p>
          <p className="text-sm text-foreground">{summary}</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">{formatMoney(payment.amountCents, payment.currency)}</p>
          {payment.promoCode ? <p className="text-xs text-text-secondary">Code {payment.promoCode} applied</p> : null}
          <p className="text-xs text-text-secondary">to {profile.displayName}</p>
        </div>
        {state}
      </div>
    </div>
  );
}

export default FanCheckout;
