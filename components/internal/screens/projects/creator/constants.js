export const TIER_STATUS_META = {
  active: { variant: "success", label: "Active", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  paused: { variant: "warning", label: "Paused", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  archived: { variant: "neutral", label: "Archived", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const MEMBER_STATUS_META = {
  active: { variant: "success", label: "Active", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  trialing: { variant: "info", label: "Trialing", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  past_due: { variant: "warning", label: "Past due", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  cancelled: { variant: "neutral", label: "Cancelled", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
  blocked: { variant: "danger", label: "Blocked", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30", dotClass: "bg-red-400" },
};

export const SUB_STATUS_META = {
  trialing: { variant: "info", label: "Trialing", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  active: { variant: "success", label: "Active", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  past_due: { variant: "warning", label: "Past due", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  cancelled: { variant: "neutral", label: "Cancelled", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
  expired: { variant: "neutral", label: "Expired", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const PPV_STATUS_META = {
  draft: { variant: "neutral", label: "Draft", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-400" },
  published: { variant: "success", label: "Published", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  archived: { variant: "neutral", label: "Archived", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const MSG_STATUS_META = {
  draft: { variant: "neutral", label: "Draft", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-400" },
  locked: { variant: "warning", label: "Locked", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  unlocked: { variant: "success", label: "Unlocked", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  expired: { variant: "neutral", label: "Expired", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const TIP_STATUS_META = {
  pending: { variant: "warning", label: "Pending", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  succeeded: { variant: "success", label: "Succeeded", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  refunded: { variant: "neutral", label: "Refunded", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const PAYOUT_STATUS_META = {
  pending: { variant: "warning", label: "Pending", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  processing: { variant: "info", label: "Processing", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  paid: { variant: "success", label: "Paid", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  failed: { variant: "danger", label: "Failed", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30", dotClass: "bg-red-400" },
};

export const PROMO_KIND_META = {
  discount: { variant: "purple", label: "Discount", className: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30", dotClass: "bg-violet-400" },
  trial: { variant: "info", label: "Trial", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  free_month: { variant: "success", label: "Free month", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
};

export const POST_VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "members", label: "All members" },
  { value: "tier", label: "Minimum tier" },
  { value: "ppv", label: "Pay-per-view" },
];

export const INTERVAL_OPTIONS = [
  { value: "month", label: "Monthly" },
  { value: "year", label: "Annual" },
  { value: "one_time", label: "One-time" },
];

export const INVOICE_STATUS_META = {
  open: { variant: "info", label: "Open", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  paid: { variant: "success", label: "Paid", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  failed: { variant: "danger", label: "Failed", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30", dotClass: "bg-red-400" },
  refunded: { variant: "warning", label: "Refunded", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  void: { variant: "neutral", label: "Void", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const ACCESS_GATE_META = {
  login: { variant: "info", label: "Login gate", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  paywall: { variant: "purple", label: "Paywall", className: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30", dotClass: "bg-violet-400" },
  preview: { variant: "warning", label: "Preview only", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
};

export const ACCESS_TARGET_OPTIONS = [
  { value: "gallery", label: "Gallery" },
  { value: "collection", label: "Collection" },
  { value: "folder", label: "Folder" },
];

export const ACCESS_LEVEL_OPTIONS = [
  { value: "preview", label: "Preview (watermarked, low-res)" },
  { value: "standard", label: "Standard (web resolution)" },
  { value: "full_res", label: "Full resolution originals" },
];

export const GATE_OPTIONS = [
  { value: "login", label: "Login gate — members sign in" },
  { value: "paywall", label: "Paywall — subscribe to view" },
  { value: "preview", label: "Preview only — teaser for everyone" },
];

// Billing cadence in days, so renewals and MRR stay consistent across screens.
export function intervalDays(interval) {
  return interval === "year" ? 365 : 30;
}

export function addInterval(iso, interval) {
  const from = iso ? new Date(iso) : new Date();
  const base = Number.isNaN(from.getTime()) ? new Date() : from;
  const next = new Date(base);
  if (interval === "year") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}

// Monthly-normalised price: annual tiers count 1/12 toward MRR, one-time none.
export function monthlyCents(tier) {
  if (!tier || tier.isFree || !tier.priceCents) return 0;
  if (tier.interval === "year") return Math.round(tier.priceCents / 12);
  if (tier.interval === "one_time") return 0;
  return tier.priceCents;
}

/**
 * What a subscription bills at its next renewal: { amountCents, interval, discounted }.
 * Honours a yearly cycle bought on a monthly tier and any promo discount periods left.
 */
export function renewalTerms(sub, tier) {
  const interval = sub?.cycle || tier?.interval || "month";
  const base = Number(sub?.priceCents) || Number(tier?.priceCents) || 0;
  const d = sub?.discount;
  if (d && Number(d.remaining) > 0) {
    const off = d.percentOff ? Math.round((base * d.percentOff) / 100) : Math.min(base, Number(d.amountOffCents) || 0);
    return { amountCents: Math.max(0, base - off), interval, discounted: true };
  }
  return { amountCents: base, interval, discounted: false };
}

/** A subscription's share of MRR. */
export function subscriptionMonthlyCents(sub, tier) {
  if (!tier || tier.isFree) return 0;
  if (sub?.cycle === "year" && sub.priceCents) return Math.round(sub.priceCents / 12);
  return monthlyCents(tier);
}

export function intervalLabel(interval) {
  return interval === "year" ? "yr" : interval === "one_time" ? "once" : "mo";
}

export function centsToDollars(cents) {
  return ((Number(cents) || 0) / 100).toFixed(2);
}

export function statusFilterOptions(meta, allLabel) {
  return [{ value: "all", label: allLabel }, ...Object.entries(meta).map(([value, m]) => ({ value, label: m.label }))];
}

export function formatMoney(cents, currency = "usd") {
  const n = Number(cents) || 0;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency || "usd").toUpperCase() }).format(n / 100);
  } catch {
    return `$${(n / 100).toFixed(2)}`;
  }
}

export function parseDollarsToCents(value) {
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export { formatDate } from "@/lib/format";
