// Shared helpers for the playground seed. Seed rows are raw DB rows (snake_case),
// exactly what Supabase would return, so every normalize*() in lib/supabase/*
// runs over them unchanged. Keep seed files free of "use client" and of React
// imports so the integrity test can load them in plain Node.

import { PLAYGROUND_PROJECT } from "../mode.js";

export const PROJECT_ID = PLAYGROUND_PROJECT.id;

// Stable, valid UUIDs per entity kind so cross-table references line up:
// sid("asset", 3) -> "a55e7004-0000-4000-8000-000000000003". People use the
// shared cast ids instead (personId(n) in ../cast.js).
const APP_PREFIX = 0xa55e7000;
const KIND_CODES = {
  role: 2, grant: 3, asset: 4, folder: 5, collection: 6, version: 7,
  relation: 8, duplicate: 9, request: 10, upload: 11, portal: 12, submission: 13,
  share: 14, pipeline: 15, review: 16, review_item: 17, decision: 18, invite: 19,
  activity: 21, workflow: 22, run: 23, holder: 24, rights: 25,
  licensee: 26, template: 27, price_rule: 28, quote: 29, license: 30,
  license_item: 31, renewal: 32, royalty_rule: 33, statement: 34, royalty_line: 35,
  gallery: 36, gallery_item: 37, gallery_domain: 38, visitor: 39, favorite: 40,
  download_request: 41, gallery_event: 42, dynamic_link: 43, video: 44, embed: 45,
  delivery_key: 46, channel: 47, channel_run: 48, delivery_domain: 49,
  api_key: 50, webhook: 51, webhook_delivery: 52, export: 53, tier: 54,
  member: 55, subscription: 56, ppv: 57, message: 58, tip: 59, payout: 60,
  promo: 61, settings: 62, report: 63, search: 64, delivery_event: 65,
  delivery_daily: 66, delivery_profile: 68, collection_asset: 69,
  duplicate_member: 70, report_run: 71, access_rule: 72, invoice: 73,
  creator_profile: 74, bundle: 75, comment: 76, retention_policy: 77,
  legal_hold: 78, legal_hold_event: 79,
  // commerce (seed/commerce.js)
  store_settings: 80, price_sheet: 81, price_item: 82, product: 83, discount: 84,
  customer: 85, order: 86, order_item: 87, order_event: 88, entitlement: 89,
  download: 90, payment: 91, cart: 92, refund: 93, store_invoice: 94,
  // insights (seed/insights.js)
  rendition: 100, variable: 101,
};

export function sid(kind, n) {
  const code = KIND_CODES[kind];
  if (!code) throw new Error(`Unknown seed kind: ${kind}`);
  const prefix = (APP_PREFIX + code).toString(16).padStart(8, "0");
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Everything is relative to page load so the demo never looks stale.
export function daysAgo(days, hours = 0) {
  return new Date(Date.now() - days * DAY - hours * HOUR).toISOString();
}

export function hoursAgo(hours) {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

export function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

export function daysFromNow(days, hours = 0) {
  return new Date(Date.now() + days * DAY + hours * HOUR).toISOString();
}

export function dateOnly(iso) {
  return iso.slice(0, 10);
}

// Deterministic 0..1 pseudo-random from a number, so seeded data looks organic
// but is identical on every load.
export function noise(n) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// Deterministic integer in [min, max].
export function between(n, min, max) {
  return Math.round(min + noise(n) * (max - min));
}

// Deterministic element of an array.
export function pick(arr, n) {
  return arr[Math.floor(noise(n) * arr.length) % arr.length];
}

// Deterministic weighted choice: weighted(7, [["paid", 8], ["refunded", 1]]).
export function weighted(n, pairs) {
  const total = pairs.reduce((sum, [, w]) => sum + w, 0);
  let roll = noise(n) * total;
  for (const [value, w] of pairs) {
    roll -= w;
    if (roll < 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

// range(3, (i) => i * 2) -> [2, 4, 6]; i is 1-based so it doubles as sid n.
export function range(count, fn = (i) => i) {
  return Array.from({ length: count }, (_, i) => fn(i + 1));
}

// Base columns most project-owned rows carry. Every assets table also has soft
// delete and the metadata bag (SUPABASE_CONVENTIONS.md §6). Drop or override
// what a table doesn't have.
export function base(kind, n, { created = 30, updated, ...rest } = {}) {
  return {
    id: sid(kind, n),
    project_id: PROJECT_ID,
    created_at: daysAgo(created),
    updated_at: daysAgo(updated ?? Math.max(0, created - 1)),
    deleted_at: null,
    metadata: {},
    ...rest,
  };
}
