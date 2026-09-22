export const TIER_STATUS_META = {
  active: { variant: "success", label: "Active", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  paused: { variant: "warning", label: "Paused", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  archived: { variant: "neutral", label: "Archived", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const MEMBER_STATUS_META = {
  active: { variant: "success", label: "Active", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  trialing: { variant: "info", label: "Trialing", className: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  past_due: { variant: "warning", label: "Past due", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  cancelled: { variant: "neutral", label: "Cancelled", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
  blocked: { variant: "danger", label: "Blocked", className: "bg-red-500/15 text-red-300 border-red-500/30", dotClass: "bg-red-400" },
};

export const SUB_STATUS_META = {
  trialing: { variant: "info", label: "Trialing", className: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  active: { variant: "success", label: "Active", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  past_due: { variant: "warning", label: "Past due", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  cancelled: { variant: "neutral", label: "Cancelled", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
  expired: { variant: "neutral", label: "Expired", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const PPV_STATUS_META = {
  draft: { variant: "neutral", label: "Draft", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-400" },
  published: { variant: "success", label: "Published", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  archived: { variant: "neutral", label: "Archived", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const MSG_STATUS_META = {
  draft: { variant: "neutral", label: "Draft", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-400" },
  locked: { variant: "warning", label: "Locked", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  unlocked: { variant: "success", label: "Unlocked", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  expired: { variant: "neutral", label: "Expired", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const TIP_STATUS_META = {
  pending: { variant: "warning", label: "Pending", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  succeeded: { variant: "success", label: "Succeeded", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  refunded: { variant: "neutral", label: "Refunded", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const PAYOUT_STATUS_META = {
  pending: { variant: "warning", label: "Pending", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  processing: { variant: "info", label: "Processing", className: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  paid: { variant: "success", label: "Paid", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  failed: { variant: "danger", label: "Failed", className: "bg-red-500/15 text-red-300 border-red-500/30", dotClass: "bg-red-400" },
};

export const PROMO_KIND_META = {
  discount: { variant: "purple", label: "Discount", className: "bg-violet-500/15 text-violet-300 border-violet-500/30", dotClass: "bg-violet-400" },
  trial: { variant: "info", label: "Trial", className: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  free_month: { variant: "success", label: "Free month", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
};

export const INTERVAL_OPTIONS = [
  { value: "month", label: "Monthly" },
  { value: "year", label: "Annual" },
  { value: "one_time", label: "One-time" },
];

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
