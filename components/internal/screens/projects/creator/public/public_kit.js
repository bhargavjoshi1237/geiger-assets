// Shared helpers for the public creator pages (/c/<handle>). Plain functions —
// the components own their JSX.

import { contrastText } from "@/lib/creator/page_config";

/** Inline style for a surface filled with the creator's accent, text kept readable. */
export function accentStyle(color) {
  return { backgroundColor: color, color: contrastText(color) };
}

export function formatMoney(cents, currency = "usd") {
  const n = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
      minimumFractionDigits: n % 1 ? 2 : 0,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function formatDay(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function timeAgo(value) {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return formatDay(value);
}

export function intervalSuffix(interval) {
  return interval === "year" ? "/year" : interval === "one_time" ? "" : "/month";
}

export const VISIBILITY_LABEL = {
  public: "Public",
  members: "Members",
  tier: "Tier",
  ppv: "Pay-per-view",
};

/** POST JSON and return the parsed body, or { error } on any failure. */
export async function postJson(url, body) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "Something went wrong.", ...data };
    return data;
  } catch {
    return { error: "Network error — try again." };
  }
}
