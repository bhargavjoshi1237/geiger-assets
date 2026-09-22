// Lookups, option lists and formatters for the Analytics domain. Config only —
// no row data lives here; rows come from lib/supabase/{analytics,
// search_analytics, reports}.js.

export const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export const DEFAULT_RANGE = "30";

export const REPORT_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", variant: "warning", dotClass: "bg-amber-400" },
};

export const RUN_STATUS_MAP = {
  queued: { label: "Queued", variant: "neutral", dotClass: "bg-zinc-400" },
  running: { label: "Running", variant: "info", dotClass: "bg-blue-400" },
  succeeded: { label: "Succeeded", variant: "success", dotClass: "bg-emerald-400" },
  failed: { label: "Failed", variant: "destructive", dotClass: "bg-red-400" },
};

export const HEALTH_ISSUE_MAP = {
  missing_metadata: { label: "Missing metadata", variant: "warning", dotClass: "bg-amber-400" },
  duplicate: { label: "Duplicate", variant: "info", dotClass: "bg-blue-400" },
  expired_rights: { label: "Expired rights", variant: "destructive", dotClass: "bg-red-400" },
  unapproved: { label: "Unapproved", variant: "neutral", dotClass: "bg-zinc-400" },
  unused: { label: "Unused", variant: "purple", dotClass: "bg-violet-400" },
};

export const SCHEDULE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const SOURCE_OPTIONS = [
  { value: "asset", label: "Asset" },
  { value: "search", label: "Search" },
  { value: "portal", label: "Portal" },
  { value: "health", label: "Library health" },
  { value: "storage", label: "Storage" },
  { value: "commerce", label: "Commerce" },
  { value: "license", label: "License" },
];

export function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

export function formatCurrency(cents, currency = "usd") {
  const amount = Number(cents || 0) / 100;
  try {
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    });
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function formatPercent(ratio) {
  return `${(Number(ratio || 0) * 100).toFixed(1)}%`;
}

export function dayKey(value) {
  return String(value || "").slice(0, 10);
}

export function lastDays(n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export { formatBytes, formatDate, formatDateTime } from "@/lib/format";
