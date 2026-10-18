// Lookups, option lists and formatters for the gallery store screens
// (Storefront, Products & Pricing, Cart & Checkout, Orders & Invoices,
// Customers, Digital Downloads). Config only — every row comes from
// lib/supabase/store.js.

import {
  BadgeCheck,
  Boxes,
  Download,
  LockOpen,
  Package,
  Printer,
} from "lucide-react";
import { RENDITIONS } from "@/lib/commerce/shape";

export {
  centsToDollarString,
  compactMoney,
  formatMoney,
  optionsFromMeta,
  parseDollarsToCents,
  labelFor,
  CHANNELS,
  TERRITORIES,
  USAGE_TYPE_META,
  EXCLUSIVITY_META,
  DURATION_OPTIONS,
} from "../licensing/constants";
export { formatDate, formatDateTime } from "@/lib/format";

export const PRODUCT_KIND_META = {
  download: {
    label: "Digital download",
    short: "Download",
    icon: Download,
    variant: "info",
    dotClass: "bg-sky-400",
    hint: "A file the buyer downloads — you choose the rendition, limit and link expiry.",
  },
  license: {
    label: "Licence",
    short: "Licence",
    icon: BadgeCheck,
    variant: "purple",
    dotClass: "bg-violet-400",
    hint: "Issues a licence to the buyer (optionally from a template), with the file included.",
  },
  print: {
    label: "Print",
    short: "Print",
    icon: Printer,
    variant: "warning",
    dotClass: "bg-amber-400",
    hint: "A physical print you produce and ship — the order waits until you mark it shipped.",
  },
  physical: {
    label: "Physical product",
    short: "Physical",
    icon: Package,
    variant: "outline",
    dotClass: "bg-orange-400",
    hint: "A shipped item not tied to an asset — a photo book, merch, a USB of files. Sold gallery-wide from a price sheet.",
  },
  bundle: {
    label: "Bundle",
    short: "Bundle",
    icon: Boxes,
    variant: "success",
    dotClass: "bg-emerald-400",
    hint: "Any N assets from the gallery for one price — the buyer picks which.",
  },
  unlock: {
    label: "Gallery unlock",
    short: "Unlock",
    icon: LockOpen,
    variant: "neutral",
    dotClass: "bg-zinc-400",
    hint: "Everything in a gallery for one price. Use it as the template for a gallery's flat price.",
  },
};

export const PRODUCT_STATUS_META = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  archived: { label: "Archived", variant: "neutral", dotClass: "bg-zinc-500" },
};

export const ORDER_STATUS_META = {
  pending: { label: "Awaiting payment", variant: "warning", dotClass: "bg-amber-400" },
  paid: { label: "Paid", variant: "info", dotClass: "bg-sky-400" },
  fulfilled: { label: "Fulfilled", variant: "success", dotClass: "bg-emerald-400" },
  partially_refunded: { label: "Part refunded", variant: "purple", dotClass: "bg-violet-400" },
  refunded: { label: "Refunded", variant: "neutral", dotClass: "bg-zinc-400" },
  cancelled: { label: "Cancelled", variant: "neutral", dotClass: "bg-zinc-500" },
  failed: { label: "Failed", variant: "danger", dotClass: "bg-red-400" },
};

export const FULFILLMENT_META = {
  unfulfilled: { label: "Unfulfilled", variant: "neutral", dotClass: "bg-zinc-400" },
  partial: { label: "Partly fulfilled", variant: "warning", dotClass: "bg-amber-400" },
  fulfilled: { label: "Delivered", variant: "success", dotClass: "bg-emerald-400" },
};

export const PROVIDER_META = {
  stripe: { label: "Stripe", variant: "purple", dotClass: "bg-violet-400" },
  test: { label: "Test checkout", variant: "warning", dotClass: "bg-amber-400" },
  manual: { label: "Manual / invoice", variant: "neutral", dotClass: "bg-zinc-400" },
};

export const PAYMENT_MODE_OPTIONS = [
  { value: "auto", label: "Automatic — Stripe when configured, test checkout otherwise" },
  { value: "stripe", label: "Stripe only" },
  { value: "test", label: "Test checkout (no real payments)" },
  { value: "manual", label: "Invoice / pay later" },
];

export const DISCOUNT_STATUS_META = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", variant: "warning", dotClass: "bg-amber-400" },
  archived: { label: "Archived", variant: "neutral", dotClass: "bg-zinc-500" },
};

export const CUSTOMER_STATUS_META = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  blocked: { label: "Blocked", variant: "danger", dotClass: "bg-red-400" },
};

export const ENTITLEMENT_STATE_META = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  expired: { label: "Expired", variant: "neutral", dotClass: "bg-zinc-400" },
  exhausted: { label: "Limit reached", variant: "warning", dotClass: "bg-amber-400" },
  revoked: { label: "Revoked", variant: "danger", dotClass: "bg-red-400" },
};

export const ENTITLEMENT_SOURCE_META = {
  order: { label: "Order" },
  workflow: { label: "Workflow" },
  manual: { label: "Granted by staff" },
};

export const RENDITION_OPTIONS = Object.entries(RENDITIONS).map(([value, r]) => ({ value, label: r.label }));

export const FORMAT_OPTIONS = [
  { value: "original", label: "Keep original format" },
  { value: "jpg", label: "JPEG" },
  { value: "webp", label: "WebP" },
  { value: "png", label: "PNG" },
];

export const CURRENCY_OPTIONS = [
  { value: "usd", label: "USD — US dollar" },
  { value: "eur", label: "EUR — Euro" },
  { value: "gbp", label: "GBP — British pound" },
  { value: "cad", label: "CAD — Canadian dollar" },
  { value: "aud", label: "AUD — Australian dollar" },
  { value: "inr", label: "INR — Indian rupee" },
  { value: "jpy", label: "JPY — Japanese yen" },
];

export function plural(n, word, pluralWord) {
  return `${n} ${n === 1 ? word : pluralWord || `${word}s`}`;
}

/** "Unlimited" / "3 downloads". */
export function limitLabel(n) {
  return Number(n) > 0 ? plural(Number(n), "download") : "Unlimited";
}

/** "Never" / "30 days". */
export function expiryLabel(days) {
  return Number(days) > 0 ? plural(Number(days), "day") : "Never";
}

/** Human summary of what a product delivers, from its fulfilment config. */
export function fulfillmentSummary(product) {
  const f = product?.fulfillment || {};
  const rendition = RENDITIONS[f.rendition]?.label || "Original file";
  switch (product?.kind) {
    case "license":
      return [
        f.durationMonths > 0 ? `${f.durationMonths}-month licence` : "Perpetual licence",
        f.includeDownload ? rendition : "no file",
      ].join(" · ");
    case "print":
      return [f.size, f.paper, f.finish].filter(Boolean).join(" · ");
    case "physical":
      return [f.variant, f.requiresShipping ? "Shipped" : "Collected", f.productionDays ? `ships in ~${f.productionDays}d` : null]
        .filter(Boolean)
        .join(" · ");
    case "bundle":
      return `Any ${f.size || 0} assets · ${rendition}`;
    case "unlock":
      return `Whole gallery · ${rendition}`;
    default:
      return `${rendition} · ${limitLabel(f.downloadLimit)} · link ${f.expiryDays > 0 ? `expires in ${f.expiryDays}d` : "never expires"}`;
  }
}

/** Entitlement → the ENTITLEMENT_STATE_META key it shows as. */
export function entitlementState(e) {
  return e?.problem || "active";
}
