// Lookups, filter options, pricing ladders, and formatters for the licensing
// screens. Config only — never row data (rows come from
// lib/supabase/licensing.js).

// ---------------------------------------------------------------------------
// Rights inventory
// ---------------------------------------------------------------------------

export const RIGHT_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  pending: { label: "Pending", variant: "warning", dotClass: "bg-amber-400" },
  expired: { label: "Expired", variant: "neutral", dotClass: "bg-zinc-400" },
  disputed: { label: "Disputed", variant: "danger", dotClass: "bg-red-400" },
};

export const RIGHT_TYPE_MAP = {
  ownership: { label: "Ownership", variant: "success", dotClass: "bg-emerald-400" },
  exclusive: { label: "Exclusive license", variant: "info", dotClass: "bg-sky-400" },
  non_exclusive: { label: "Non-exclusive", variant: "neutral", dotClass: "bg-zinc-400" },
  administration: { label: "Administration", variant: "purple", dotClass: "bg-violet-400" },
};

export const RIGHT_TYPE_OPTIONS = Object.entries(RIGHT_TYPE_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

// ---------------------------------------------------------------------------
// Templates, usage, scope
// ---------------------------------------------------------------------------

export const TEMPLATE_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  archived: { label: "Archived", variant: "neutral", dotClass: "bg-zinc-400" },
};

export function templateStatusOf(template) {
  return template?.isActive === false ? "archived" : "active";
}

export const USAGE_TYPE_MAP = {
  commercial: { label: "Commercial", variant: "info", dotClass: "bg-sky-400" },
  editorial: { label: "Editorial", variant: "neutral", dotClass: "bg-zinc-400" },
  personal: { label: "Personal", variant: "success", dotClass: "bg-emerald-400" },
  broadcast: { label: "Broadcast", variant: "purple", dotClass: "bg-violet-400" },
  merchandising: { label: "Merchandising", variant: "warning", dotClass: "bg-amber-400" },
};

export const USAGE_TYPE_OPTIONS = Object.entries(USAGE_TYPE_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

export const TERRITORY_OPTIONS = [
  { value: "local", label: "Local · one country" },
  { value: "regional", label: "Regional · multi-country" },
  { value: "worldwide", label: "Worldwide" },
];

export const TERRITORY_MULTIPLIERS = {
  local: 1,
  regional: 1.8,
  worldwide: 3,
};

export const TERRITORY_LABELS = {
  local: "Local",
  regional: "Regional",
  worldwide: "Worldwide",
};

// Duration is a bracket ladder over the grant length in days: longer grants
// cost more, but sub-linearly — a year is not twelve months stacked.
export const DURATION_MULTIPLIER_BRACKETS = [
  { maxDays: 30, mult: 1, label: "Up to 1 month" },
  { maxDays: 90, mult: 1.4, label: "Up to 3 months" },
  { maxDays: 365, mult: 2.2, label: "Up to 1 year" },
  { maxDays: Number.POSITIVE_INFINITY, mult: 3.5, label: "Over 1 year" },
];

export function durationMultiplierFor(days) {
  const d = Math.max(0, Number(days) || 0);
  return (
    DURATION_MULTIPLIER_BRACKETS.find((b) => d <= b.maxDays) ??
    DURATION_MULTIPLIER_BRACKETS[DURATION_MULTIPLIER_BRACKETS.length - 1]
  );
}

export const CHANNEL_OPTIONS = [
  { value: "digital", label: "Digital" },
  { value: "print", label: "Print" },
  { value: "broadcast", label: "Broadcast" },
  { value: "ooh", label: "Out of home" },
  { value: "all", label: "All channels" },
];

export const CHANNEL_MULTIPLIERS = {
  digital: 1,
  print: 1.25,
  broadcast: 2,
  ooh: 1.6,
  all: 2.75,
};

export const CHANNEL_LABELS = {
  digital: "Digital",
  print: "Print",
  broadcast: "Broadcast",
  ooh: "Out of home",
  all: "All channels",
};

export const EXCLUSIVITY_MAP = {
  non_exclusive: { label: "Non-exclusive", variant: "neutral", dotClass: "bg-zinc-400" },
  exclusive: { label: "Exclusive", variant: "warning", dotClass: "bg-amber-400" },
};

export const EXCLUSIVITY_OPTIONS = Object.entries(EXCLUSIVITY_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

export const EXCLUSIVITY_MULTIPLIERS = {
  non_exclusive: 1,
  exclusive: 2.5,
};

// The live calculator: base × territory × duration × channel × exclusivity.
// Every factor is a real lookup above — nothing here is faked.
export function computeLicensePrice(baseCents, scope = {}) {
  const base = Math.max(0, Math.round(Number(baseCents) || 0));
  const territoryMult = TERRITORY_MULTIPLIERS[scope.territory] ?? 1;
  const bracket = durationMultiplierFor(scope.durationDays);
  const channelMult = CHANNEL_MULTIPLIERS[scope.channel] ?? 1;
  const exclusivityMult = EXCLUSIVITY_MULTIPLIERS[scope.exclusivity] ?? 1;
  const totalCents = Math.round(base * territoryMult * bracket.mult * channelMult * exclusivityMult);
  return {
    baseCents: base,
    territoryMult,
    durationMult: bracket.mult,
    durationLabel: bracket.label,
    channelMult,
    exclusivityMult,
    totalCents,
    lines: [
      { label: "Base price", detail: `${TERRITORY_LABELS[scope.territory] ?? scope.territory ?? "—"} scope`, mult: null },
      { label: `Territory × ${territoryMult}`, detail: TERRITORY_LABELS[scope.territory] ?? "—", mult: territoryMult },
      { label: `Duration × ${bracket.mult}`, detail: bracket.label, mult: bracket.mult },
      { label: `Channel × ${channelMult}`, detail: CHANNEL_LABELS[scope.channel] ?? "—", mult: channelMult },
      { label: `Exclusivity × ${exclusivityMult}`, detail: EXCLUSIVITY_MAP[scope.exclusivity]?.label ?? "—", mult: exclusivityMult },
    ],
  };
}

// ---------------------------------------------------------------------------
// Quotes, issued licenses, renewals
// ---------------------------------------------------------------------------

export const QUOTE_STATUS_MAP = {
  pending: { label: "Pending", variant: "warning", dotClass: "bg-amber-400" },
  quoted: { label: "Quoted", variant: "info", dotClass: "bg-sky-400" },
  approved: { label: "Approved", variant: "success", dotClass: "bg-emerald-400" },
  declined: { label: "Declined", variant: "danger", dotClass: "bg-red-400" },
};

export const LICENSE_STATUS_MAP = {
  pending: { label: "Pending", variant: "warning", dotClass: "bg-amber-400" },
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  suspended: { label: "Suspended", variant: "danger", dotClass: "bg-red-400" },
  expired: { label: "Expired", variant: "neutral", dotClass: "bg-zinc-400" },
  revoked: { label: "Revoked", variant: "danger", dotClass: "bg-red-400" },
};

export const EXPIRING_SOON_DAYS = 30;
export const GRACE_PERIOD_DAYS = 30;

// ---------------------------------------------------------------------------
// Revenue and royalties
// ---------------------------------------------------------------------------

export const REVENUE_TYPE_MAP = {
  license: { label: "License fee", variant: "info", dotClass: "bg-sky-400" },
  royalty: { label: "Royalty", variant: "purple", dotClass: "bg-violet-400" },
};

export const REVENUE_STATUS_MAP = {
  pending: { label: "Pending", variant: "warning", dotClass: "bg-amber-400" },
  collected: { label: "Collected", variant: "info", dotClass: "bg-sky-400" },
  distributed: { label: "Distributed", variant: "success", dotClass: "bg-emerald-400" },
};

// Royalty maths, shared by the revenue screen so the table and the stats
// agree: owed = gross × rate, then split by share.
export function royaltyOwedCents(revenue) {
  const gross = Math.max(0, Number(revenue?.grossCents) || 0);
  const rate = Number(revenue?.royaltyRatePercent) || 0;
  return Math.round((gross * rate) / 100);
}

export function orgShareCents(revenue) {
  const owed = royaltyOwedCents(revenue);
  const share = Number(revenue?.sharePercent);
  const pct = Number.isFinite(share) ? share : 100;
  return Math.round((owed * pct) / 100);
}

export function guaranteeRemainingCents(revenue) {
  const remaining =
    Math.max(0, Number(revenue?.minimumGuaranteeCents) || 0) -
    Math.max(0, Number(revenue?.recoupedCents) || 0);
  return Math.max(0, Math.round(remaining));
}

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

export function statusFilterOptions(map, allLabel) {
  return [
    { value: "all", label: allLabel },
    ...Object.entries(map).map(([value, m]) => ({ value, label: m.label })),
  ];
}

export const RIGHT_STATUS_FILTER_OPTIONS = statusFilterOptions(RIGHT_STATUS_MAP, "All statuses");
export const RIGHT_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All right types" },
  ...RIGHT_TYPE_OPTIONS,
];
export const TEMPLATE_STATUS_FILTER_OPTIONS = statusFilterOptions(TEMPLATE_STATUS_MAP, "All statuses");
export const USAGE_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All usage types" },
  ...USAGE_TYPE_OPTIONS,
];
export const QUOTE_STATUS_FILTER_OPTIONS = statusFilterOptions(QUOTE_STATUS_MAP, "All statuses");
export const LICENSE_STATUS_FILTER_OPTIONS = statusFilterOptions(LICENSE_STATUS_MAP, "All statuses");
export const REVENUE_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "license", label: "License fee" },
  { value: "royalty", label: "Royalty" },
];
export const REVENUE_STATUS_FILTER_OPTIONS = statusFilterOptions(REVENUE_STATUS_MAP, "All statuses");

export const RENEWAL_VIEW_OPTIONS = [
  { value: "all", label: "All licenses" },
  { value: "expiring", label: "Expiring soon" },
  { value: "grace", label: "In grace period" },
  { value: "expired", label: "Expired" },
  { value: "healthy", label: "Healthy" },
];

export const SORT_OPTIONS = [
  { value: "updated-desc", label: "Recently updated" },
  { value: "updated-asc", label: "Least recently updated" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
];

// ---------------------------------------------------------------------------
// Formatters, date maths, misc
// ---------------------------------------------------------------------------

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

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${Number(n.toFixed(2))}%`;
}

export function parseDollarsToCents(value) {
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

// Whole days from now until the date: positive = upcoming, negative = past,
// null = no usable date. Ceiled so "tomorrow morning" still reads as 1 day.
export function daysUntil(value) {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.ceil((then - Date.now()) / 86400000);
}

// Expiry bucket driven by real date maths: expiring = ends within
// EXPIRING_SOON_DAYS; grace = ended within GRACE_PERIOD_DAYS; expired = ended
// longer ago; healthy = further out; none = no end date recorded.
export function expiryBucket(endDate) {
  const days = daysUntil(endDate);
  if (days === null) return "none";
  if (days < 0) return Math.abs(days) <= GRACE_PERIOD_DAYS ? "grace" : "expired";
  if (days <= EXPIRING_SOON_DAYS) return "expiring";
  return "healthy";
}

export const EXPIRY_BUCKET_MAP = {
  expiring: { label: "Expiring soon", variant: "warning", dotClass: "bg-amber-400" },
  grace: { label: "Grace period", variant: "info", dotClass: "bg-sky-400" },
  expired: { label: "Expired", variant: "neutral", dotClass: "bg-zinc-400" },
  healthy: { label: "Healthy", variant: "success", dotClass: "bg-emerald-400" },
  none: { label: "No end date", variant: "neutral", dotClass: "bg-zinc-400" },
};

export function describeWindow(days) {
  if (days === null) return "No end date";
  if (days < 0) return days === -1 ? "Ended yesterday" : `Ended ${Math.abs(days)}d ago`;
  if (days === 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  return `Ends in ${days}d`;
}

export function mintCertificateCode() {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X");
  return `LIC-${year}-${rand}`;
}
