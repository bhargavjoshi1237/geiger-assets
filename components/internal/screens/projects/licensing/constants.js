// Licensing lookups, option lists and formatters. Config only — row data always
// comes from lib/supabase/{rights,licensing,royalties}.js.

import { formatDate } from "@/lib/format";

export const RIGHTS_STATUS_META = {
  draft: { variant: "neutral", label: "Draft", dotClass: "bg-zinc-400" },
  active: { variant: "success", label: "Active", dotClass: "bg-emerald-400" },
  expiring: { variant: "warning", label: "Expiring", dotClass: "bg-amber-400" },
  expired: { variant: "neutral", label: "Expired", dotClass: "bg-zinc-500" },
  disputed: { variant: "danger", label: "Disputed", dotClass: "bg-red-400" },
};

export const ACQUISITION_META = {
  owned: { variant: "success", label: "Owned", dotClass: "bg-emerald-400" },
  licensed_in: { variant: "info", label: "Licensed in", dotClass: "bg-sky-400" },
  commissioned: { variant: "purple", label: "Commissioned", dotClass: "bg-violet-400" },
  public_domain: { variant: "neutral", label: "Public domain", dotClass: "bg-zinc-400" },
  unknown: { variant: "warning", label: "Unknown", dotClass: "bg-amber-400" },
};

export const EXCLUSIVITY_META = {
  exclusive: { variant: "purple", label: "Exclusive", dotClass: "bg-violet-400" },
  sole: { variant: "info", label: "Sole", dotClass: "bg-sky-400" },
  non_exclusive: { variant: "neutral", label: "Non-exclusive", dotClass: "bg-zinc-400" },
};

export const HOLDER_KIND_META = {
  creator: { variant: "info", label: "Creator", dotClass: "bg-sky-400" },
  photographer: { variant: "info", label: "Photographer", dotClass: "bg-sky-400" },
  agency: { variant: "purple", label: "Agency", dotClass: "bg-violet-400" },
  label: { variant: "purple", label: "Label", dotClass: "bg-violet-400" },
  publisher: { variant: "purple", label: "Publisher", dotClass: "bg-violet-400" },
  internal: { variant: "neutral", label: "Internal", dotClass: "bg-zinc-400" },
  other: { variant: "neutral", label: "Other", dotClass: "bg-zinc-400" },
};

export const TEMPLATE_STATUS_META = {
  draft: { variant: "neutral", label: "Draft", dotClass: "bg-zinc-400" },
  active: { variant: "success", label: "Active", dotClass: "bg-emerald-400" },
  archived: { variant: "neutral", label: "Archived", dotClass: "bg-zinc-500" },
};

export const LICENSE_STATUS_META = {
  draft: { variant: "neutral", label: "Draft", dotClass: "bg-zinc-400" },
  pending: { variant: "info", label: "Pending", dotClass: "bg-sky-400" },
  active: { variant: "success", label: "Active", dotClass: "bg-emerald-400" },
  expiring: { variant: "warning", label: "Expiring", dotClass: "bg-amber-400" },
  expired: { variant: "neutral", label: "Expired", dotClass: "bg-zinc-500" },
  terminated: { variant: "danger", label: "Terminated", dotClass: "bg-red-400" },
  renewed: { variant: "purple", label: "Renewed", dotClass: "bg-violet-400" },
};

export const QUOTE_STATUS_META = {
  requested: { variant: "info", label: "Requested", dotClass: "bg-sky-400" },
  quoted: { variant: "warning", label: "Quoted", dotClass: "bg-amber-400" },
  accepted: { variant: "success", label: "Accepted", dotClass: "bg-emerald-400" },
  declined: { variant: "neutral", label: "Declined", dotClass: "bg-zinc-500" },
  converted: { variant: "purple", label: "Converted", dotClass: "bg-violet-400" },
};

export const RENEWAL_ACTION_META = {
  renewed: { variant: "success", label: "Renewed", dotClass: "bg-emerald-400" },
  lapsed: { variant: "neutral", label: "Lapsed", dotClass: "bg-zinc-500" },
  terminated: { variant: "danger", label: "Terminated", dotClass: "bg-red-400" },
  grace_extended: { variant: "warning", label: "Grace extended", dotClass: "bg-amber-400" },
  reminded: { variant: "info", label: "Reminder sent", dotClass: "bg-sky-400" },
};

export const ROYALTY_LINE_STATUS_META = {
  accrued: { variant: "info", label: "Accrued", dotClass: "bg-sky-400" },
  statemented: { variant: "warning", label: "On statement", dotClass: "bg-amber-400" },
  paid: { variant: "success", label: "Paid", dotClass: "bg-emerald-400" },
  void: { variant: "neutral", label: "Void", dotClass: "bg-zinc-500" },
};

export const STATEMENT_STATUS_META = {
  draft: { variant: "neutral", label: "Draft", dotClass: "bg-zinc-400" },
  issued: { variant: "warning", label: "Issued", dotClass: "bg-amber-400" },
  paid: { variant: "success", label: "Paid", dotClass: "bg-emerald-400" },
  void: { variant: "neutral", label: "Void", dotClass: "bg-zinc-500" },
};

export const LICENSEE_KIND_META = {
  brand: { variant: "info", label: "Brand", dotClass: "bg-sky-400" },
  agency: { variant: "purple", label: "Agency", dotClass: "bg-violet-400" },
  publisher: { variant: "purple", label: "Publisher", dotClass: "bg-violet-400" },
  broadcaster: { variant: "warning", label: "Broadcaster", dotClass: "bg-amber-400" },
  internal: { variant: "neutral", label: "Internal", dotClass: "bg-zinc-400" },
  individual: { variant: "neutral", label: "Individual", dotClass: "bg-zinc-400" },
  other: { variant: "neutral", label: "Other", dotClass: "bg-zinc-400" },
};

export const USAGE_TYPE_META = {
  advertising: { label: "Advertising" },
  editorial: { label: "Editorial" },
  social: { label: "Social" },
  broadcast: { label: "Broadcast" },
  print: { label: "Print" },
  web: { label: "Web" },
  internal: { label: "Internal" },
  merchandise: { label: "Merchandise" },
  oem: { label: "OEM / Embedded" },
};

export const TERRITORIES = [
  { value: "worldwide", label: "Worldwide" },
  { value: "north_america", label: "North America" },
  { value: "south_america", label: "South America" },
  { value: "europe", label: "Europe" },
  { value: "uk", label: "United Kingdom" },
  { value: "apac", label: "Asia-Pacific" },
  { value: "mena", label: "Middle East & North Africa" },
  { value: "africa", label: "Africa" },
  { value: "domestic", label: "Domestic only" },
];

export const CHANNELS = [
  { value: "web", label: "Web" },
  { value: "social", label: "Social" },
  { value: "print", label: "Print" },
  { value: "ooh", label: "Out of home" },
  { value: "tv", label: "TV" },
  { value: "streaming", label: "Streaming" },
  { value: "packaging", label: "Packaging" },
  { value: "events", label: "Events" },
  { value: "internal", label: "Internal" },
];

export const DURATION_OPTIONS = [
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "1 year" },
  { value: "24", label: "2 years" },
  { value: "36", label: "3 years" },
  { value: "60", label: "5 years" },
  { value: "0", label: "Perpetual" },
];

export const PRICE_RULE_KIND_META = {
  base: { label: "Base fee", hint: "The starting fee before any scope multipliers." },
  territory: { label: "Territory", hint: "Multiplier applied per licensed territory." },
  duration: { label: "Duration", hint: "Multiplier applied for the licence term." },
  channel: { label: "Channel", hint: "Multiplier applied per licensed channel." },
  exclusivity: { label: "Exclusivity", hint: "Premium applied for exclusive or sole grants." },
};

export const SCOPE_KIND_OPTIONS = [
  { value: "global", label: "All licence revenue" },
  { value: "asset", label: "A specific asset" },
  { value: "collection", label: "A collection" },
  { value: "rights_record", label: "A rights record" },
  { value: "template", label: "A licence template" },
];

export const CHART_PRIMARY = "var(--color-foreground)";
// Slice separator: the card surface the chart sits on, so it reads as a gap.
export const CHART_SEPARATOR = "var(--color-surface-subtle)";
// One ink at descending opacity rather than five baked greys, so the ramp keeps
// its contrast when the theme flips instead of going white-on-white.
export const CHART_SERIES_OPACITY = [1, 0.76, 0.56, 0.38, 0.24];

export function optionsFromMeta(meta, allLabel) {
  return [
    ...(allLabel ? [{ value: "all", label: allLabel }] : []),
    ...Object.entries(meta).map(([value, m]) => ({ value, label: m.label })),
  ];
}

export function labelFor(meta, key, fallback = "—") {
  return meta?.[key]?.label ?? (key || fallback);
}

export function labelsFor(options, values) {
  const map = new Map(options.map((o) => [o.value, o.label]));
  return (values || []).map((v) => map.get(v) || v);
}

export function formatMoney(cents, currency = "usd") {
  const n = Number(cents) || 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(n / 100);
  } catch {
    return `$${(n / 100).toFixed(2)}`;
  }
}

export function compactMoney(cents, currency = "usd") {
  const n = (Number(cents) || 0) / 100;
  if (Math.abs(n) < 1000) return formatMoney(cents, currency);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    return `$${(n / 1000).toFixed(1)}k`;
  }
}

export function parseDollarsToCents(value) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function centsToDollarString(cents) {
  return ((Number(cents) || 0) / 100).toFixed(2);
}

export function formatPercent(value) {
  const n = Number(value) || 0;
  return `${Number.isInteger(n) ? n : n.toFixed(2)}%`;
}

// Whole days from today until `date` — negative once the date has passed.
export function daysUntil(date) {
  if (!date) return null;
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((startOfTarget - startOfToday) / 86400000);
}

export function addMonths(date, months) {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + (Number(months) || 0));
  return d.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + (Number(days) || 0));
  return d.toISOString().slice(0, 10);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function formatTerm(license) {
  if (license?.isPerpetual) return "Perpetual";
  if (!license?.startDate && !license?.endDate) return "—";
  const start = license.startDate ? formatDate(license.startDate) : "—";
  const end = license.endDate ? formatDate(license.endDate) : "open-ended";
  return `${start} → ${end}`;
}

// A licence reference like LIC-2026-0007, unique-ish per project by count.
export function nextLicenseReference(existing) {
  const year = new Date().getFullYear();
  const prefix = `LIC-${year}-`;
  const highest = (existing || []).reduce((max, l) => {
    if (!l.reference?.startsWith(prefix)) return max;
    const n = Number(l.reference.slice(prefix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

export { formatDate };
