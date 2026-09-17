// Lookups, filter options, and formatters for the analytics screens.
// Config only — never row data (rows come from lib/supabase/analytics.js,
// lib/media/usage.js, lib/supabase/assets.js, and lib/supabase/duplicates.js).
//
// Chart colours reference the suite theme tokens (var(--chart-*)) so charts
// follow the dark theme without a hardcoded hex anywhere.

// Time ranges every analytics screen offers in its Toolbar. Values are day
// counts so they feed getDailySeries({ days }) and the in-range useMemo
// filters directly.
export const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export function rangeDays(value) {
  const n = Math.floor(Number(value));
  return n === 7 || n === 30 || n === 90 ? n : 30;
}

// Clock read behind a helper so derivations stay stable per render instead of
// scattering Date.now() through components.
export function nowMs() {
  return Date.now();
}

export function rangeCutoff(value, now = Date.now()) {
  return new Date(now - rangeDays(value) * 24 * 60 * 60 * 1000).toISOString();
}

export function inRange(iso, value, now = Date.now()) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= now - rangeDays(value) * 24 * 60 * 60 * 1000;
}

// Recharts series colours — theme tokens, never hex.
export const CHART_SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export const ASSET_EVENT_KIND_MAP = {
  view: { label: "Views", variant: "info", dotClass: "bg-sky-400" },
  download: { label: "Downloads", variant: "success", dotClass: "bg-emerald-400" },
  share: { label: "Shares", variant: "purple", dotClass: "bg-violet-400" },
  embed: { label: "Embeds", variant: "warning", dotClass: "bg-amber-400" },
};

export const ASSET_EVENT_KIND_OPTIONS = Object.entries(ASSET_EVENT_KIND_MAP).map(
  ([value, kind]) => ({ value, label: kind.label }),
);

export const ASSET_EVENT_KIND_FILTER_OPTIONS = [
  { value: "all", label: "All events" },
  ...ASSET_EVENT_KIND_OPTIONS,
];

export const PORTAL_KIND_MAP = {
  visit: { label: "Visits", variant: "info", dotClass: "bg-sky-400" },
  download: { label: "Downloads", variant: "success", dotClass: "bg-emerald-400" },
  signup: { label: "Signups", variant: "purple", dotClass: "bg-violet-400" },
};

export const ORDER_STATUS_MAP = {
  pending: { label: "Pending", variant: "warning", dotClass: "bg-amber-400" },
  paid: { label: "Paid", variant: "success", dotClass: "bg-emerald-400" },
  refunded: { label: "Refunded", variant: "neutral", dotClass: "bg-zinc-400" },
  cancelled: { label: "Cancelled", variant: "danger", dotClass: "bg-red-400" },
};

export const ORDER_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.entries(ORDER_STATUS_MAP).map(([value, meta]) => ({ value, label: meta.label })),
];

export const LICENSE_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  pending: { label: "Pending", variant: "warning", dotClass: "bg-amber-400" },
  expired: { label: "Expired", variant: "neutral", dotClass: "bg-zinc-400" },
  revoked: { label: "Revoked", variant: "danger", dotClass: "bg-red-400" },
};

export const LICENSE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.entries(LICENSE_STATUS_MAP).map(([value, meta]) => ({ value, label: meta.label })),
];

export const LICENSE_KIND_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "extended", label: "Extended" },
  { value: "editorial", label: "Editorial" },
  { value: "exclusive", label: "Exclusive" },
];

export const REPORT_KIND_MAP = {
  dashboard: { label: "Dashboard", variant: "info", dotClass: "bg-sky-400" },
  report: { label: "Report", variant: "purple", dotClass: "bg-violet-400" },
};

export const REPORT_KIND_OPTIONS = Object.entries(REPORT_KIND_MAP).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export const REPORT_SCHEDULE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const EXPORT_FORMAT_MAP = {
  csv: { label: "CSV", variant: "neutral", dotClass: "bg-zinc-400" },
  pdf: { label: "PDF", variant: "danger", dotClass: "bg-red-400" },
};

export const EXPORT_STATUS_MAP = {
  queued: { label: "Queued", variant: "warning", dotClass: "bg-amber-400" },
  running: { label: "Running", variant: "info", dotClass: "bg-sky-400" },
  completed: { label: "Completed", variant: "success", dotClass: "bg-emerald-400" },
  failed: { label: "Failed", variant: "danger", dotClass: "bg-red-400" },
};

// Bucket rows with a createdAt/created_at timestamp into zero-filled daily
// buckets ending today (UTC), so trend charts render without gaps. `pick`
// maps a row to the numeric value it contributes to its day.
export function bucketByDay(rows, days, pick) {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * dayMs;
  const buckets = new Map();
  for (let i = 0; i < days; i += 1) {
    const key = new Date(start + i * dayMs).toISOString().slice(0, 10);
    buckets.set(key, { date: key, value: 0 });
  }
  for (const row of rows) {
    const at = row?.createdAt ?? row?.servedAt ?? row?.created_at ?? row?.served_at;
    if (!at) continue;
    const t = new Date(at).getTime();
    if (!Number.isFinite(t)) continue;
    const key = new Date(t).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) bucket.value += Number(pick(row)) || 0;
  }
  return [...buckets.values()];
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return "0 B";
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

export function formatCount(n) {
  const value = Number(n) || 0;
  try {
    return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
  } catch {
    return String(Math.round(value));
  }
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

export function formatPercent(ratio) {
  const n = Number(ratio);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
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
