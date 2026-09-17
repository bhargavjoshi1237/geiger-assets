export const ACCESS_SCOPE_META = {
  folder: { label: "Folder", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  collection: { label: "Collection", className: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  gallery: { label: "Gallery", className: "bg-violet-500/15 text-violet-300 border-violet-500/30", dotClass: "bg-violet-400" },
};

export const RULE_STATUS_META = {
  active: { label: "Active", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const ACTIVITY_KIND_META = {
  login: { label: "Login", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  view: { label: "View", className: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  download: { label: "Download", className: "bg-violet-500/15 text-violet-300 border-violet-500/30", dotClass: "bg-violet-400" },
  signup: { label: "Signup", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  tier_change: { label: "Tier change", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const INVOICE_STATUS_META = {
  open: { label: "Open", className: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  paid: { label: "Paid", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  failed: { label: "Failed", className: "bg-red-500/15 text-red-300 border-red-500/30", dotClass: "bg-red-400" },
  past_due: { label: "Past due", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  refunded: { label: "Refunded", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
  void: { label: "Void", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

// Payment providers are configuration only — the UI never calls Stripe/PayPal.
export const PROVIDER_META = {
  manual: { label: "Manual invoicing", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
  stripe: { label: "Stripe", className: "bg-violet-500/15 text-violet-300 border-violet-500/30", dotClass: "bg-violet-400" },
  paypal: { label: "PayPal", className: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
};

export const GALLERY_STATUS_META = {
  active: { label: "Active", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const SCOPE_OPTIONS = [
  { value: "folder", label: "Folder" },
  { value: "collection", label: "Collection" },
  { value: "gallery", label: "Gallery" },
];

export const ALLOWANCE_OPTIONS = [
  { key: "loginRequired", label: "Login gate", hint: "Visitors must sign in as a member" },
  { key: "paywallEnabled", label: "Paywall", hint: "Non-members hit an interactive paywall" },
  { key: "allowHiresDownload", label: "Hi-res downloads", hint: "Tier may download full-resolution files" },
  { key: "watermarkBypass", label: "Watermark bypass", hint: "Tier sees clean, unwatermarked previews" },
  { key: "previewOnly", label: "Preview only", hint: "Tier may view but never download" },
  { key: "metadataVisible", label: "Metadata visible", hint: "Tier may read asset metadata" },
];

export const GALLERY_FEATURE_OPTIONS = [
  { key: "loginRequired", label: "Membership login", hint: "Gallery requires a member sign-in" },
  { key: "memberPricingEnabled", label: "Member-only pricing", hint: "Storefront shows tier pricing" },
  { key: "paywallEnabled", label: "Interactive paywall", hint: "Guests hit a paywall before browsing" },
  { key: "signupFormEnabled", label: "Custom signup form", hint: "Branded signup form on this gallery" },
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

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function parseDollarsToCents(value) {
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
