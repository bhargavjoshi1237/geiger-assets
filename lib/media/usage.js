// Data-access layer for storage/bandwidth metering — owns `assets.project_usage`
// (per-project rollup) and `assets.delivery_events` (append-only delivery log).
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
//
// Rollup vs log: the rollup row is the cheap dashboard/quota read (a single row
// by project_id). Delivery events are the billable source of truth —
// recordDelivery appends the event and bumps the rollup's served counters in one
// RPC, while storage-side drift is repaired on demand with recomputeProjectUsage
// (never on the hot path). Raw events are retention-bounded (see the migration);
// lifetime served totals live on the rollup, so a purge never rewrites history.
// Route wiring (including any server-client variant) is a separate task.

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const USAGE_TABLE = "project_usage";
const EVENTS_TABLE = "delivery_events";

// Metering is written from server routes (commit, delivery) and read from
// screens. assetsClient() is the browser client and carries no session off the
// browser, so server callers hand in their own schema-scoped client instead.
// Screen-side calls omit it and keep the original behaviour.
function clientFor(override) {
  return override || assetsClient();
}

// Bounds for a daily-series call: the composite (project_id, served_at) index
// serves the range, but a caller must never fan out into an unbounded scan.
const MAX_SERIES_DAYS = 366;
const SERIES_ROW_LIMIT = 10000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function normalizeUsage(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    storedBytes: Number(row.stored_bytes ?? 0),
    storedObjects: Number(row.stored_objects ?? 0),
    servedBytesTotal: Number(row.served_bytes_total ?? 0),
    servedEventsTotal: Number(row.served_events_total ?? 0),
    lastRecomputedAt: row.last_recomputed_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta,
  };
}

export function normalizeDeliveryEvent(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    assetId: row.asset_id ?? null,
    variant: row.variant ?? "",
    bytesServed: Number(row.bytes_served ?? 0),
    servedAt: row.served_at ?? "",
    createdAt: row.created_at ?? "",
    ...meta,
  };
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}

function toNonNegativeInt(value) {
  const n = Math.floor(Number(value) || 0);
  return n < 0 ? 0 : n;
}

// ---------------------------------------------------------------------------
// Deliveries (append-only log + atomic rollup bump)
// ---------------------------------------------------------------------------

export async function recordDelivery(input, { client } = {}) {
  if (!input?.projectId || !isSupabaseConfigured()) return null;
  const variant = typeof input.variant === "string" ? input.variant : "";
  const bytesServed = toNonNegativeInt(input.bytesServed);
  try {
    const sb = clientFor(client);
    const { data, error } = await sb.rpc("record_delivery_event", {
      p_project_id: input.projectId,
      p_asset_id: input.assetId ?? null,
      p_variant: variant,
      p_bytes_served: bytesServed,
    });
    if (!error) return normalizeDeliveryEvent(firstRow(data));
    // A DB whose tables exist but which predates the RPC still records the
    // billable event; the rollup is repaired later by recomputeProjectUsage.
    console.error("[usage.recordDelivery.rpc]", error.message);
    const fallback = await sb
      .from(EVENTS_TABLE)
      .insert({
        project_id: input.projectId,
        asset_id: input.assetId ?? null,
        variant,
        bytes_served: bytesServed,
      })
      .select("*")
      .single();
    if (fallback.error) {
      console.error("[usage.recordDelivery]", fallback.error.message);
      return null;
    }
    return normalizeDeliveryEvent(fallback.data);
  } catch (e) {
    console.error("[usage.recordDelivery]", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rollup (cheap read, atomic adjust, cold recompute)
// ---------------------------------------------------------------------------

export async function getProjectUsage(projectId, { client } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = clientFor(client);
    // maybeSingle: a project with no metering yet has no row, which is an
    // empty state — not an error worth logging.
    const { data, error } = await sb
      .from(USAGE_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) {
      console.error("[usage.get]", error.message);
      return null;
    }
    return normalizeUsage(data);
  } catch (e) {
    console.error("[usage.get]", e);
    return null;
  }
}

export async function adjustProjectRollup(projectId, deltas = {}, { client } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = clientFor(client);
    const { data, error } = await sb.rpc("adjust_project_usage", {
      p_project_id: projectId,
      // Signed: deletes/shrinks are negative; the SQL clamps totals at zero.
      p_stored_bytes_delta: Math.trunc(Number(deltas.storedBytesDelta) || 0),
      p_stored_objects_delta: Math.trunc(Number(deltas.storedObjectsDelta) || 0),
      p_served_bytes_delta: Math.trunc(Number(deltas.servedBytesDelta) || 0),
      p_served_events_delta: Math.trunc(Number(deltas.servedEventsDelta) || 0),
    });
    if (error) {
      console.error("[usage.adjust]", error.message);
      return null;
    }
    return normalizeUsage(firstRow(data));
  } catch (e) {
    console.error("[usage.adjust]", e);
    return null;
  }
}

export async function recomputeProjectUsage(projectId, { client } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = clientFor(client);
    const { data, error } = await sb.rpc("recompute_project_usage", {
      p_project_id: projectId,
    });
    if (error) {
      console.error("[usage.recompute]", error.message);
      return null;
    }
    return normalizeUsage(firstRow(data));
  } catch (e) {
    console.error("[usage.recompute]", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Daily series (range scan over the composite index, bucketed in JS)
// ---------------------------------------------------------------------------

function startOfUtcDay(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dayKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveSeriesWindow(options = {}) {
  const rawDays = Number(options.days ?? 30);
  const days = Number.isFinite(rawDays)
    ? Math.min(Math.max(Math.floor(rawDays), 1), MAX_SERIES_DAYS)
    : 30;
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  let end = tomorrow;
  if (options.until != null) {
    const untilDay = startOfUtcDay(options.until);
    if (!untilDay) return {};
    end = new Date(untilDay.getTime() + DAY_MS);
  }
  let start;
  if (options.since != null) {
    start = startOfUtcDay(options.since);
    if (!start) return {};
  } else {
    start = new Date(end.getTime() - days * DAY_MS);
  }
  if (!(start < end)) return {};
  // Clamp spans wider than the cap instead of scanning unbounded history.
  if (end.getTime() - start.getTime() > MAX_SERIES_DAYS * DAY_MS) {
    start = new Date(end.getTime() - MAX_SERIES_DAYS * DAY_MS);
  }
  return { start, end };
}

function bucketDailySeries(rows, start, end) {
  const byDay = new Map();
  for (const row of rows) {
    const at = new Date(row.served_at);
    if (Number.isNaN(at.getTime())) continue;
    const key = dayKey(at);
    const point = byDay.get(key) || { date: key, bytesServed: 0, deliveries: 0 };
    point.bytesServed += Number(row.bytes_served) || 0;
    point.deliveries += 1;
    byDay.set(key, point);
  }
  // Zero-fill every day in [start, end) so charts render without gaps.
  const series = [];
  for (let t = start.getTime(); t < end.getTime(); t += DAY_MS) {
    const key = dayKey(new Date(t));
    series.push(byDay.get(key) || { date: key, bytesServed: 0, deliveries: 0 });
  }
  return series;
}

export async function getDailySeries(projectId, options = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const { start, end } = resolveSeriesWindow(options);
    if (!start || !end) return null;
    const sb = clientFor(options.client);
    const { data, error } = await sb
      .from(EVENTS_TABLE)
      .select("bytes_served, served_at")
      .eq("project_id", projectId)
      .gte("served_at", start.toISOString())
      .lt("served_at", end.toISOString())
      .order("served_at", { ascending: true })
      .limit(SERIES_ROW_LIMIT);
    if (error) {
      console.error("[usage.series]", error.message);
      return null;
    }
    return bucketDailySeries(data || [], start, end);
  } catch (e) {
    console.error("[usage.series]", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Quota check (one indexed rollup read — cheap enough for a route per request)
// ---------------------------------------------------------------------------

function quotaCap(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// True when every configured cap holds, false when any cap is exceeded, null
// when usage is unknown (unconfigured DB, missing row, or query failure) so
// the caller — not this layer — decides fail-open vs fail-closed for reads.
export async function checkQuota(projectId, quotas = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const maxStored = quotaCap(quotas.maxStoredBytes);
    const maxServed = quotaCap(quotas.maxServedBytes);
    if (maxStored == null && maxServed == null) return true;
    const usage = await getProjectUsage(projectId);
    if (!usage) return null;
    if (maxStored != null && usage.storedBytes > maxStored) return false;
    if (maxServed != null && usage.servedBytesTotal > maxServed) return false;
    return true;
  } catch (e) {
    console.error("[usage.checkQuota]", e);
    return null;
  }
}
