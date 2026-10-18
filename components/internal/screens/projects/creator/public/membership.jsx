"use client";

// Membership on the public creator page: the plans grid (monthly / annual
// switch, promo codes, what each tier unlocks), the member's lifecycle banner
// (trial, overdue, ending, lapsed) and the cancel flow with its save offers.

import React, { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Check, Clock, Loader2, RotateCcw, Sparkles, Tag, X } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDay, formatMoney, intervalSuffix, postJson } from "./public_kit";

const CANCEL_REASONS = [
  { value: "price", label: "It's too expensive" },
  { value: "content", label: "Not enough new content" },
  { value: "break", label: "I'm taking a break" },
  { value: "value", label: "It wasn't what I expected" },
  { value: "other", label: "Something else" },
];

/** First charge after a discount code, or null when the code isn't a discount. */
function discounted(promo, cents) {
  if (promo?.kind !== "discount") return null;
  const off = promo.percentOff ? Math.round((cents * promo.percentOff) / 100) : Math.min(cents, promo.amountOffCents || 0);
  return Math.max(0, cents - off);
}

/** Price of a tier for the chosen cycle: { cents, suffix, monthlyCents, savePct }. */
export function tierPrice(tier, cycle) {
  if (tier.isFree) return { cents: 0, suffix: "", monthlyCents: 0, savePct: 0 };
  if (cycle === "year" && tier.annualPriceCents) {
    const full = tier.priceCents * 12;
    return {
      cents: tier.annualPriceCents,
      suffix: "/year",
      monthlyCents: Math.round(tier.annualPriceCents / 12),
      savePct: full > tier.annualPriceCents ? Math.round((1 - tier.annualPriceCents / full) * 100) : 0,
    };
  }
  return { cents: tier.priceCents, suffix: intervalSuffix(tier.interval), monthlyCents: 0, savePct: 0 };
}

function CycleToggle({ value, onChange, savePct }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-card p-1 text-sm">
      {[
        { value: "month", label: "Monthly" },
        { value: "year", label: "Annual" },
      ].map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-4 font-medium transition-colors",
            value === opt.value ? "cp-accent" : "text-text-secondary hover:text-foreground",
          )}
        >
          {opt.label}
          {opt.value === "year" && savePct ? (
            <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", value === "year" ? "bg-black/15" : "cp-accent-soft")}>-{savePct}%</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** "Have a code?" — checks the code on the server and shows what it does. */
export function PromoField({ handle, promo, onChange, tierId, cycle }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const apply = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError("");
    const result = await postJson(`/api/creator/${encodeURIComponent(handle)}`, { action: "promo", code: code.trim(), tierId, cycle });
    setBusy(false);
    if (result.error) return setError(result.error);
    onChange(result.promo);
    setOpen(false);
    setCode("");
  };

  if (promo) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-card py-1 pl-3 pr-1 text-sm">
        <Tag className="h-3.5 w-3.5 cp-accent-text" />
        <span className="font-medium text-foreground">{promo.code}</span>
        <span className="text-text-secondary">· {promo.label}</span>
        <button type="button" aria-label="Remove code" onClick={() => onChange(null)} className="rounded-full p-1 text-text-tertiary hover:bg-surface-hover hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-foreground">
        <Tag className="h-3.5 w-3.5" />
        Have a promo code?
      </button>
    );
  }
  return (
    <div className="flex w-full max-w-sm flex-col gap-1.5">
      <div className="flex gap-2">
        <Input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 64))}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          placeholder="PROMO CODE"
          className="bg-surface-card font-mono uppercase"
        />
        <Button variant="outline" className="border-border bg-transparent hover:bg-surface-hover" disabled={busy || !code.trim()} onClick={apply}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Apply
        </Button>
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

function TierCard({ tier, cycle, promo, current, subscription, highlight, unlocks, busy, onJoin, onManage }) {
  const price = tierPrice(tier, cycle);
  const promoHere = promo && !tier.isFree ? promo : null;
  const first = discounted(promoHere, price.cents);
  const cancelling = subscription?.cancelAtPeriodEnd;
  const cta = tier.isFree ? "Join for free" : promoHere ? "Redeem offer" : tier.trialDays && cycle !== "year" ? `Start ${tier.trialDays}-day free trial` : "Join";

  return (
    <div className={cn("cp-card relative flex flex-col p-5 sm:p-6", (highlight || current) && "cp-ring")}>
      {highlight && !current ? (
        <span className="cp-accent absolute -top-3 left-5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">Most popular</span>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <h3 className="cp-heading text-lg font-semibold text-foreground">{tier.name}</h3>
        {current ? (
          <span className="cp-accent rounded-full px-2 py-0.5 text-[10px] font-semibold">{subscription?.status === "trialing" ? "Trial" : "Your tier"}</span>
        ) : null}
      </div>

      <div className="mt-3">
        <p className="flex items-baseline gap-1.5">
          {first !== null ? (
            <>
              <span className="cp-heading text-3xl font-semibold tabular-nums text-foreground">{formatMoney(first, tier.currency)}</span>
              <span className="text-sm text-text-tertiary line-through">{formatMoney(price.cents, tier.currency)}</span>
            </>
          ) : (
            <span className="cp-heading text-3xl font-semibold tabular-nums text-foreground">{tier.isFree ? "Free" : formatMoney(price.cents, tier.currency)}</span>
          )}
          {tier.isFree ? null : <span className="text-sm text-text-secondary">{price.suffix}</span>}
        </p>
        <p className="mt-1 min-h-4 text-xs text-text-secondary">
          {promoHere
            ? promoHere.label
            : price.monthlyCents
              ? `${formatMoney(price.monthlyCents, tier.currency)}/month billed yearly${price.savePct ? ` · save ${price.savePct}%` : ""}`
              : tier.trialDays && !tier.isFree
                ? `${tier.trialDays}-day free trial, then ${formatMoney(tier.priceCents, tier.currency)}${intervalSuffix(tier.interval)}`
                : ""}
        </p>
      </div>

      {tier.description ? <p className="mt-4 text-sm text-text-secondary">{tier.description}</p> : null}
      {tier.perks.length || unlocks ? (
        <ul className="mt-4 space-y-2.5">
          {unlocks ? (
            <li className="flex items-start gap-2 text-sm font-medium text-foreground">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 cp-accent-text" />
              {unlocks} post{unlocks === 1 ? "" : "s"} unlocked right away
            </li>
          ) : null}
          {tier.perks.map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 cp-accent-text" />
              {perk}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto pt-6">
        {current ? (
          <div className="space-y-2">
            <p className="text-xs text-text-secondary">
              {cancelling ? "Ends" : subscription?.status === "trialing" ? "Trial ends" : "Renews"} {formatDay(subscription?.currentPeriodEnd)}
            </p>
            <Button variant="outline" className="cp-radius-sm w-full border-border bg-transparent hover:bg-surface-hover" disabled={busy === "cancel"} onClick={onManage}>
              {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {cancelling ? "Resume membership" : "Manage membership"}
            </Button>
          </div>
        ) : (
          <Button className="cp-accent cp-radius-sm h-10 w-full" disabled={busy === `join:${tier.id}`} onClick={() => onJoin(tier.id)}>
            {busy === `join:${tier.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {cta}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Every tier side by side, with the cycle switch and the promo field above them. */
export function PlansGrid({ handle, tiers, viewer, cycle, setCycle, promo, setPromo, highlightTierId, unlocksByTier, busy, onJoin, onManage }) {
  const savePct = useMemo(() => Math.max(0, ...tiers.map((t) => tierPrice(t, "year").savePct)), [tiers]);
  const anyAnnual = tiers.some((t) => t.annualPriceCents);
  const anyPaid = tiers.some((t) => !t.isFree);
  const firstPaid = tiers.find((t) => !t.isFree);
  const cols = tiers.length >= 3 ? "lg:grid-cols-3" : tiers.length === 2 ? "sm:grid-cols-2" : "";

  return (
    <div className="space-y-5">
      {anyAnnual || anyPaid ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {anyAnnual ? <CycleToggle value={cycle} onChange={setCycle} savePct={savePct} /> : <span />}
          {anyPaid && !viewer.subscription ? <PromoField handle={handle} promo={promo} onChange={setPromo} tierId={firstPaid?.id} cycle={cycle} /> : null}
        </div>
      ) : null}
      <div className={cn("grid gap-4 pt-2", cols, tiers.length === 1 && "max-w-md")}>
        {tiers.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            cycle={cycle}
            promo={promo}
            current={tier.id === viewer.tierId}
            subscription={viewer.subscription}
            highlight={tier.id === highlightTierId}
            unlocks={unlocksByTier?.get(tier.id) || 0}
            busy={busy}
            onJoin={onJoin}
            onManage={onManage}
          />
        ))}
      </div>
    </div>
  );
}

/** The one line a member most needs to see right now, if anything. */
export function LifecycleBanner({ viewer, currentTier, newCount, onRenew, onResume, onRejoin }) {
  const sub = viewer.subscription;
  let tone = "neutral";
  let icon = CalendarClock;
  let text = "";
  let action = null;

  if (sub?.status === "past_due") {
    tone = "warning";
    icon = AlertTriangle;
    text = `Your last payment didn't go through. Renew ${currentTier?.name || "your membership"} to keep access.`;
    action = { label: "Renew now", run: onRenew };
  } else if (sub?.cancelAtPeriodEnd) {
    icon = Clock;
    text = `Your membership ends ${formatDay(sub.currentPeriodEnd)}. You'll keep access until then.`;
    action = { label: "Resume", run: onResume, icon: RotateCcw };
  } else if (sub?.status === "trialing") {
    text = `Your free trial of ${currentTier?.name || "this tier"} ends ${formatDay(sub.trialEnd || sub.currentPeriodEnd)}. Join to keep access.`;
    action = { label: "Keep access", run: onRenew };
  } else if (viewer.lapsed) {
    icon = Sparkles;
    text = "Welcome back! Your membership has ended — rejoin to pick up where you left off.";
    action = { label: "Rejoin", run: onRejoin };
  } else if (sub && newCount > 0) {
    icon = Sparkles;
    text = `${newCount} new post${newCount === 1 ? "" : "s"} since your last visit.`;
  }
  if (!text) return null;
  const Icon = icon;
  return (
    <div
      className={cn(
        "cp-card flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center",
        tone === "warning" && "!border-amber-500/30 !bg-amber-500/10",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", tone === "warning" ? "text-amber-400" : "cp-accent-text")} />
      <p className="flex-1 text-foreground">{text}</p>
      {action ? (
        <Button size="sm" className="cp-accent cp-radius-sm self-start sm:self-auto" onClick={action.run}>
          {action.icon ? <action.icon className="h-4 w-4" /> : null}
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Cancelling: why, then a save offer where one fits (annual, a cheaper tier),
 * then the confirmation. Nothing changes until the last step.
 */
export function CancelDialog({ open, onOpenChange, tiers, currentTier, subscription, busy, onCancel, onSwitch }) {
  const [step, setStep] = useState("reason");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const offers = useMemo(() => {
    if (!currentTier) return [];
    const list = [];
    const onMonthly = subscription?.cycle !== "year" && currentTier.annualPriceCents;
    if (onMonthly) {
      const p = tierPrice(currentTier, "year");
      list.push({
        key: "annual",
        title: `Switch to annual${p.savePct ? ` and save ${p.savePct}%` : ""}`,
        body: `${formatMoney(p.cents, currentTier.currency)} for the year — about ${formatMoney(p.monthlyCents, currentTier.currency)}/month.`,
        run: () => onSwitch({ tierId: currentTier.id, cycle: "year" }),
      });
    }
    const cheaper = tiers
      .filter((t) => t.id !== currentTier.id && t.position < currentTier.position)
      .sort((a, b) => b.position - a.position)[0];
    if (cheaper) {
      list.push({
        key: "downgrade",
        title: cheaper.isFree ? `Stay as a free ${cheaper.name} member` : `Move to ${cheaper.name}`,
        body: cheaper.isFree
          ? "Switch now and keep following along for free."
          : `${formatMoney(cheaper.priceCents, cheaper.currency)}${intervalSuffix(cheaper.interval)} — keep the essentials for less.`,
        run: () => onSwitch({ tierId: cheaper.id, cycle: "month" }),
      });
    }
    return list;
  }, [currentTier, subscription, tiers, onSwitch]);

  const change = (v) => {
    if (!v) {
      setStep("reason");
      setReason("");
      setNote("");
    }
    onOpenChange(v);
  };

  const next = () => setStep(offers.length ? "offer" : "confirm");

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-md">
        {step === "reason" ? (
          <>
            <DialogHeader>
              <DialogTitle>Before you go</DialogTitle>
              <DialogDescription>What&apos;s the main reason you&apos;re cancelling? It helps the creator make this better.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={reason === r.value}
                  onClick={() => setReason(r.value)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    reason === r.value ? "border-transparent cp-ring bg-surface-card text-foreground" : "border-border text-text-secondary hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  {r.label}
                  {reason === r.value ? <Check className="h-4 w-4 cp-accent-text" /> : null}
                </button>
              ))}
              {reason ? (
                <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={2} placeholder="Anything else? (optional)" className="bg-surface-card" />
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => change(false)}>
                Keep membership
              </Button>
              <Button className="cp-accent" disabled={!reason} onClick={next}>
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : step === "offer" ? (
          <>
            <DialogHeader>
              <DialogTitle>Would one of these work instead?</DialogTitle>
              <DialogDescription>You can still cancel — nothing changes until you confirm.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {offers.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={o.run}
                  className="cp-card flex flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-surface-hover disabled:opacity-60"
                >
                  <span className="text-sm font-semibold text-foreground">{o.title}</span>
                  <span className="text-xs text-text-secondary">{o.body}</span>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" className="text-text-secondary" onClick={() => setStep("confirm")}>
                No thanks, cancel
              </Button>
              <Button className="cp-accent" onClick={() => change(false)}>
                Keep my membership
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Cancel {currentTier?.name || "membership"}?</DialogTitle>
              <DialogDescription>
                You won&apos;t be charged again. You keep access until {formatDay(subscription?.currentPeriodEnd)}, and you can resume any time before then.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => change(false)}>
                Keep membership
              </Button>
              <Button
                variant="destructive"
                disabled={busy === "cancel"}
                onClick={async () => {
                  const ok = await onCancel({ reason, note });
                  if (ok) change(false);
                }}
              >
                {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cancel membership
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
