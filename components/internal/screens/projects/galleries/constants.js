// Lookups, filter options, and formatters for the galleries domain screens.
// Config only — never row data (rows come from lib/supabase/galleries.js).

export const GALLERY_STATUS_MAP = {
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  published: { label: "Published", variant: "success", dotClass: "bg-emerald-400" },
  archived: { label: "Archived", variant: "neutral", dotClass: "bg-zinc-500" },
};

export const GALLERY_LAYOUT_MAP = {
  grid: { label: "Grid", variant: "info", dotClass: "bg-sky-400" },
  masonry: { label: "Masonry", variant: "purple", dotClass: "bg-violet-400" },
  carousel: { label: "Carousel", variant: "warning", dotClass: "bg-amber-400" },
  editorial: { label: "Editorial", variant: "success", dotClass: "bg-emerald-400" },
  slideshow: { label: "Slideshow", variant: "neutral", dotClass: "bg-zinc-400" },
};

export const GALLERY_THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto" },
  { value: "custom", label: "Custom" },
];

export const GALLERY_NAV_OPTIONS = [
  { value: "topbar", label: "Top bar" },
  { value: "sidebar", label: "Sidebar" },
  { value: "minimal", label: "Minimal" },
  { value: "custom", label: "Custom" },
];

export const GALLERY_LAYOUT_OPTIONS = Object.entries(GALLERY_LAYOUT_MAP).map(
  ([value, meta]) => ({ value, label: meta.label }),
);

export const GALLERY_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.entries(GALLERY_STATUS_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const GALLERY_LAYOUT_FILTER_OPTIONS = [
  { value: "all", label: "All layouts" },
  ...GALLERY_LAYOUT_OPTIONS,
];

export const SHOWCASE_VISIBILITY_MAP = {
  public: { label: "Public", variant: "success", dotClass: "bg-emerald-400" },
  private: { label: "Private", variant: "neutral", dotClass: "bg-zinc-400" },
  password: { label: "Password", variant: "warning", dotClass: "bg-amber-400" },
};

export const SHOWCASE_STATUS_MAP = {
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  live: { label: "Live", variant: "success", dotClass: "bg-emerald-400" },
  archived: { label: "Archived", variant: "neutral", dotClass: "bg-zinc-500" },
};

export const SHOWCASE_VISIBILITY_FILTER_OPTIONS = [
  { value: "all", label: "All visibility" },
  ...Object.entries(SHOWCASE_VISIBILITY_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const SHOWCASE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.entries(SHOWCASE_STATUS_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const DOMAIN_TYPE_MAP = {
  custom: { label: "Custom", variant: "info", dotClass: "bg-sky-400" },
  subdomain: { label: "Subdomain", variant: "purple", dotClass: "bg-violet-400" },
};

export const DOMAIN_SSL_MAP = {
  pending: { label: "SSL pending", variant: "warning", dotClass: "bg-amber-400" },
  active: { label: "SSL active", variant: "success", dotClass: "bg-emerald-400" },
  error: { label: "SSL error", variant: "danger", dotClass: "bg-red-400" },
};

export const DOMAIN_VERIFICATION_MAP = {
  unverified: { label: "Unverified", variant: "neutral", dotClass: "bg-zinc-400" },
  pending: { label: "Pending DNS", variant: "warning", dotClass: "bg-amber-400" },
  verified: { label: "Verified", variant: "success", dotClass: "bg-emerald-400" },
};

export const DOMAIN_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  ...Object.entries(DOMAIN_TYPE_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const DOMAIN_VERIFICATION_FILTER_OPTIONS = [
  { value: "all", label: "All verification" },
  ...Object.entries(DOMAIN_VERIFICATION_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const DOMAIN_SSL_FILTER_OPTIONS = [
  { value: "all", label: "All SSL states" },
  ...Object.entries(DOMAIN_SSL_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const STOREFRONT_PAGE_TYPE_MAP = {
  product: { label: "Product page", variant: "info", dotClass: "bg-sky-400" },
  cart: { label: "Cart", variant: "purple", dotClass: "bg-violet-400" },
  checkout: { label: "Checkout", variant: "success", dotClass: "bg-emerald-400" },
  policy: { label: "Policy", variant: "neutral", dotClass: "bg-zinc-400" },
  custom: { label: "Custom", variant: "warning", dotClass: "bg-amber-400" },
};

export const STOREFRONT_STATUS_MAP = {
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  live: { label: "Live", variant: "success", dotClass: "bg-emerald-400" },
  archived: { label: "Archived", variant: "neutral", dotClass: "bg-zinc-500" },
};

export const STOREFRONT_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All page types" },
  ...Object.entries(STOREFRONT_PAGE_TYPE_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const STOREFRONT_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.entries(STOREFRONT_STATUS_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const DOWNLOAD_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  fulfilled: { label: "Fulfilled", variant: "info", dotClass: "bg-sky-400" },
  expired: { label: "Expired", variant: "neutral", dotClass: "bg-zinc-400" },
  revoked: { label: "Revoked", variant: "danger", dotClass: "bg-red-400" },
};

export const DOWNLOAD_RENDITION_MAP = {
  original: { label: "Original", variant: "info", dotClass: "bg-sky-400" },
  preview: { label: "Preview", variant: "purple", dotClass: "bg-violet-400" },
  thumb: { label: "Thumb", variant: "neutral", dotClass: "bg-zinc-400" },
  poster: { label: "Poster", variant: "success", dotClass: "bg-emerald-400" },
};

export const DOWNLOAD_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.entries(DOWNLOAD_STATUS_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const DOWNLOAD_RENDITION_FILTER_OPTIONS = [
  { value: "all", label: "All renditions" },
  ...Object.entries(DOWNLOAD_RENDITION_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const DOWNLOAD_RENDITION_OPTIONS = Object.entries(DOWNLOAD_RENDITION_MAP).map(
  ([value, meta]) => ({ value, label: meta.label }),
);

export const PRODUCT_TYPE_MAP = {
  digital: { label: "Digital", variant: "info", dotClass: "bg-sky-400" },
  license: { label: "License", variant: "purple", dotClass: "bg-violet-400" },
  bundle: { label: "Bundle", variant: "success", dotClass: "bg-emerald-400" },
  package: { label: "Package", variant: "warning", dotClass: "bg-amber-400" },
};

export const PRODUCT_STATUS_MAP = {
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  archived: { label: "Archived", variant: "neutral", dotClass: "bg-zinc-500" },
};

export const PRODUCT_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All product types" },
  ...Object.entries(PRODUCT_TYPE_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const PRODUCT_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.entries(PRODUCT_STATUS_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const PRODUCT_TYPE_OPTIONS = Object.entries(PRODUCT_TYPE_MAP).map(
  ([value, meta]) => ({ value, label: meta.label }),
);

export const CHECKOUT_MODE_MAP = {
  guest: { label: "Guest", variant: "info", dotClass: "bg-sky-400" },
  account: { label: "Account", variant: "purple", dotClass: "bg-violet-400" },
  both: { label: "Guest + account", variant: "success", dotClass: "bg-emerald-400" },
};

// Payment providers are configuration only: selecting one records which
// provider the checkout should route to. Credentials live outside this
// screen and are never collected here.
export const CHECKOUT_PROVIDER_MAP = {
  manual: { label: "Manual", variant: "neutral", dotClass: "bg-zinc-400" },
  stripe: { label: "Stripe", variant: "info", dotClass: "bg-sky-400" },
  paypal: { label: "PayPal", variant: "warning", dotClass: "bg-amber-400" },
  bank: { label: "Bank transfer", variant: "purple", dotClass: "bg-violet-400" },
};

export const CHECKOUT_STATUS_MAP = {
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  live: { label: "Live", variant: "success", dotClass: "bg-emerald-400" },
  archived: { label: "Archived", variant: "neutral", dotClass: "bg-zinc-500" },
};

export const CHECKOUT_MODE_FILTER_OPTIONS = [
  { value: "all", label: "All modes" },
  ...Object.entries(CHECKOUT_MODE_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const CHECKOUT_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.entries(CHECKOUT_STATUS_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const CHECKOUT_MODE_OPTIONS = Object.entries(CHECKOUT_MODE_MAP).map(
  ([value, meta]) => ({ value, label: meta.label }),
);

export const CHECKOUT_PROVIDER_OPTIONS = Object.entries(CHECKOUT_PROVIDER_MAP).map(
  ([value, meta]) => ({ value, label: meta.label }),
);

export const ORDER_STATUS_MAP = {
  pending: { label: "Pending", variant: "warning", dotClass: "bg-amber-400" },
  paid: { label: "Paid", variant: "success", dotClass: "bg-emerald-400" },
  refunded: { label: "Refunded", variant: "neutral", dotClass: "bg-zinc-400" },
  failed: { label: "Failed", variant: "danger", dotClass: "bg-red-400" },
  cancelled: { label: "Cancelled", variant: "neutral", dotClass: "bg-zinc-500" },
};

export const INVOICE_STATUS_MAP = {
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  sent: { label: "Sent", variant: "info", dotClass: "bg-sky-400" },
  paid: { label: "Paid", variant: "success", dotClass: "bg-emerald-400" },
  overdue: { label: "Overdue", variant: "warning", dotClass: "bg-amber-400" },
  void: { label: "Void", variant: "danger", dotClass: "bg-red-400" },
};

export const ORDER_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All order states" },
  ...Object.entries(ORDER_STATUS_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const INVOICE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All invoice states" },
  ...Object.entries(INVOICE_STATUS_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const CUSTOMER_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  inactive: { label: "Inactive", variant: "neutral", dotClass: "bg-zinc-400" },
  blocked: { label: "Blocked", variant: "danger", dotClass: "bg-red-400" },
};

export const CUSTOMER_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.entries(CUSTOMER_STATUS_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const CURRENCY_OPTIONS = [
  { value: "usd", label: "USD" },
  { value: "eur", label: "EUR" },
  { value: "gbp", label: "GBP" },
  { value: "inr", label: "INR" },
  { value: "aud", label: "AUD" },
  { value: "cad", label: "CAD" },
];

export function statusFilterOptions(meta, allLabel) {
  return [
    { value: "all", label: allLabel },
    ...Object.entries(meta).map(([value, m]) => ({ value, label: m.label })),
  ];
}

export function formatMoney(cents, currency = "usd") {
  const n = Number(cents) || 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
    }).format(n / 100);
  } catch {
    return `$${(n / 100).toFixed(2)}`;
  }
}

export function parseDollarsToCents(value) {
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatCount(n) {
  const value = Number(n) || 0;
  try {
    return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
  } catch {
    return String(Math.round(value));
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
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
