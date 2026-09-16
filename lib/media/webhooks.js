if (typeof window !== "undefined") {
  throw new Error("lib/media/webhooks is server-only — it signs and delivers to attacker-controlled URLs.");
}

// Outbound webhooks for asset lifecycle events.
//
// Dispatch fans out to the project's active endpoints subscribed to the event,
// records one delivery row per endpoint, and POSTs a signed JSON envelope.
// Delivery runs after the asset write commits — callers fire and forget
// (void dispatchEvent(...)) so a slow receiver never blocks the commit.
// Failures reschedule with exponential backoff; retryDueDeliveries is the
// scheduled sweep over due rows. Pure data access otherwise: validate,
// console.error on failure, return null/[]/false. Never throw, never toast.

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";
import { createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const EVENTS = Object.freeze([
  "asset.created",
  "asset.updated",
  "asset.deleted",
  "asset.version.created",
  "upload.completed",
  "upload.failed",
]);

const ENDPOINTS_TABLE = "webhook_endpoints";
const DELIVERIES_TABLE = "webhook_deliveries";

// dispatchEvent runs from server routes (commit, retry sweep); assetsClient()
// is the browser client and carries no session there, so server callers hand in
// their own schema-scoped client. Screen-side reads omit it and are unchanged.
function clientFor(override) {
  return override || assetsClient();
}

const MAX_URL_LENGTH = 2048;
const DELIVERY_TIMEOUT_MS = 10000;
// Only the status code matters — bound what is read so a hostile body cannot grow the route.
const MAX_RESPONSE_BYTES = 32 * 1024;
const MAX_ATTEMPTS = 8;
const BASE_RETRY_MS = 60 * 1000;
const MAX_RETRY_MS = 6 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function normalizeEndpoint(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  // secret stays server-side — create returns it once, reads never do.
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    url: row.url ?? "",
    events: Array.isArray(row.events) ? [...row.events] : [],
    active: Boolean(row.active),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta,
  };
}

export function normalizeDelivery(row) {
  if (!row) return null;
  return {
    id: row.id,
    endpointId: row.endpoint_id ?? null,
    event: row.event ?? "",
    payload: row.payload ?? {},
    status: row.status ?? "pending",
    attempts: Number(row.attempts ?? 0),
    responseCode: row.response_code ?? null,
    error: row.error ?? null,
    nextRetryAt: row.next_retry_at ?? null,
    createdAt: row.created_at ?? "",
    deliveredAt: row.delivered_at ?? null,
  };
}

function cleanEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return null;
  const seen = new Set();
  for (const e of events) {
    if (typeof e !== "string" || !EVENTS.includes(e)) return null;
    seen.add(e);
  }
  return [...seen];
}

// Stripe-style signature over `${timestamp}.${body}` so receivers verify with
// their stored secret and a constant-time compare.
export function signPayload(body, secret, timestamp) {
  try {
    if (typeof body !== "string" || typeof secret !== "string" || secret === "") return null;
    const ts = typeof timestamp === "number" ? Math.floor(timestamp) : Math.floor(Number(timestamp));
    if (!Number.isFinite(ts) || ts <= 0) return null;
    const hex = createHmac("sha256", Buffer.from(secret, "utf8")).update(`${ts}.${body}`).digest("hex");
    return `t=${ts},v1=${hex}`;
  } catch (e) {
    console.error("[webhooks.sign]", e?.message || e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// SSRF guard — endpoint URLs are attacker-controlled and the server fetches them.
// ---------------------------------------------------------------------------

function ipv4Blocked(a, b) {
  if (a === 127 || a === 0) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  // Link-local, including the cloud metadata address a hostname can resolve to.
  if (a === 169 && b === 254) return true;
  // Carrier-grade NAT (100.64/10). Routable-looking, but on many hosted
  // networks it addresses other tenants rather than the public internet.
  if (a === 100 && b >= 64 && b <= 127) return true;
  // IETF protocol assignments (192.0.0/24) and benchmarking (198.18/15).
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  // Multicast (224/4) and reserved (240/4, which includes 255.255.255.255).
  if (a >= 224) return true;
  return false;
}

function isBlockedIp(ip) {
  try {
    if (typeof ip !== "string" || ip === "") return true;
    const clean = ip.split("%")[0].trim().toLowerCase().replace(/^\[|\]$/g, "");
    const kind = isIP(clean);
    if (kind === 4) {
      const parts = clean.split(".").map(Number);
      if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
      return ipv4Blocked(parts[0], parts[1]);
    }
    if (kind === 6) {
      if (clean === "::1" || clean === "::") return true;
      // ::1 also has a fully-expanded spelling (0:0:0:0:0:0:0:1) that the
      // literal comparison above misses. Collapse all-zero groups before the
      // prefix tests so loopback cannot be written past this check.
      const groups = clean.split(":");
      if (groups.length === 8 && groups.slice(0, 7).every((g) => Number.parseInt(g || "0", 16) === 0)) {
        const last = Number.parseInt(groups[7] || "0", 16);
        if (last === 0 || last === 1) return true;
      }
      if (clean.includes(".")) {
        const tail = clean.slice(clean.lastIndexOf(":") + 1);
        return isBlockedIp(tail);
      }
      const first = clean.split(":")[0];
      const n = Number.parseInt(first || "0", 16);
      if (!Number.isFinite(n)) return true;
      // fe80::/10 link-local and fc00::/7 unique-local.
      if ((n & 0xffc0) === 0xfe80) return true;
      if ((n & 0xfe00) === 0xfc00) return true;
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

function stripBrackets(host) {
  return String(host || "").toLowerCase().replace(/^\[|\]$/g, "");
}

function isLoopbackHost(host) {
  const h = stripBrackets(host);
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (isIP(h) === 4) return h === "127.0.0.1" || h.startsWith("127.");
  if (h === "::1") return true;
  return false;
}

async function urlPassesSsrf(raw) {
  try {
    if (typeof raw !== "string" || raw === "" || raw.length > MAX_URL_LENGTH) return null;
    const parsed = new URL(raw);
    // Embedded credentials would be sent to (and logged by) the attacker's server.
    if (parsed.username || parsed.password) return null;
    // https only — plain http would leak payloads and HMAC material on the wire.
    // Sole exception is http loopback in development for local receiver testing.
    if (parsed.protocol === "http:") {
      if (process.env.NODE_ENV === "production" || !isLoopbackHost(parsed.hostname)) return null;
      return parsed;
    }
    if (parsed.protocol !== "https:") return null;
    const host = stripBrackets(parsed.hostname);
    if (isIP(host)) {
      if (isBlockedIp(host)) return null;
      return parsed;
    }
    // Hostnames must be re-checked after resolution — a name resolving to
    // 169.254.169.254 or a private range would otherwise reach cloud metadata.
    let addrs;
    try {
      addrs = await lookup(host, { all: true });
    } catch {
      return null;
    }
    if (!addrs || addrs.length === 0) return null;
    for (const a of addrs) {
      if (isBlockedIp(a.address)) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export async function listEndpoints(projectId, { client } = {}) {
  if (!projectId) return [];
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = clientFor(client);
    const { data, error } = await sb
      .from(ENDPOINTS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[webhooks.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeEndpoint);
  } catch (e) {
    console.error("[webhooks.list]", e);
    return null;
  }
}

export async function getEndpoint(id, { client } = {}) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = clientFor(client);
    const { data, error } = await sb
      .from(ENDPOINTS_TABLE)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error("[webhooks.get]", error.message);
      return null;
    }
    return normalizeEndpoint(data);
  } catch (e) {
    console.error("[webhooks.get]", e);
    return null;
  }
}

export async function createEndpoint(input, { client } = {}) {
  if (!input?.projectId || typeof input.url !== "string" || !isSupabaseConfigured()) return null;
  try {
    const events = cleanEvents(input.events);
    if (!events) return null;
    const safe = await urlPassesSsrf(input.url);
    if (!safe) return null;
    const sb = clientFor(client);
    const secret = randomBytes(32).toString("hex");
    const payload = {
      project_id: input.projectId,
      url: input.url.trim(),
      secret,
      events,
      active: input.active === undefined ? true : Boolean(input.active),
      created_by: input.createdBy ?? null,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    };
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(ENDPOINTS_TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[webhooks.create]", error.message);
      return null;
    }
    const pub = normalizeEndpoint(data);
    if (!pub) return null;
    return { ...pub, secret };
  } catch (e) {
    console.error("[webhooks.create]", e);
    return null;
  }
}

export async function updateEndpoint(id, patch = {}, { client } = {}) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const row = {};
    if (patch.url !== undefined) {
      if (typeof patch.url !== "string") return null;
      const safe = await urlPassesSsrf(patch.url);
      if (!safe) return null;
      row.url = patch.url.trim();
    }
    if (patch.events !== undefined) {
      const events = cleanEvents(patch.events);
      if (!events) return null;
      row.events = events;
    }
    if (patch.active !== undefined) row.active = Boolean(patch.active);
    if (patch.metadata !== undefined && patch.metadata && typeof patch.metadata === "object") {
      row.metadata = patch.metadata;
    }
    if (Object.keys(row).length === 0) return getEndpoint(id);
    const sb = clientFor(client);
    const { data, error } = await sb
      .from(ENDPOINTS_TABLE)
      .update(row)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) {
      console.error("[webhooks.update]", error.message);
      return null;
    }
    return normalizeEndpoint(data);
  } catch (e) {
    console.error("[webhooks.update]", e);
    return null;
  }
}

export async function softDeleteEndpoint(id, { client } = {}) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = clientFor(client);
    const { error } = await sb
      .from(ENDPOINTS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[webhooks.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[webhooks.delete]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

function backoffMs(attempts) {
  const step = Math.min(Math.max(Math.floor(Number(attempts) || 1), 1), 6);
  return Math.min(BASE_RETRY_MS * 2 ** (step - 1), MAX_RETRY_MS);
}

function safeStringify(value) {
  try {
    const s = JSON.stringify(value);
    return typeof s === "string" ? s : null;
  } catch {
    return null;
  }
}

async function discardCapped(res) {
  try {
    const reader = res.body?.getReader?.();
    if (!reader) return;
    let seen = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      seen += value?.length || 0;
      if (seen > MAX_RESPONSE_BYTES) break;
    }
    try {
      await reader.cancel();
    } catch {
      // Reader already closed — nothing to release.
    }
  } catch {
    // Body shape varies by runtime — the status is already captured.
  }
}

async function postOnce(url, secret, event, deliveryId, bodyString) {
  const safe = await urlPassesSsrf(url);
  if (!safe) return { ok: false, status: null, error: "blocked_url" };
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(bodyString, secret, timestamp);
  if (!signature) return { ok: false, status: null, error: "sign_failed" };
  let res;
  try {
    res = await fetch(safe.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "webhook-signature": signature,
        "webhook-event": event,
        "webhook-id": deliveryId,
      },
      body: bodyString,
      // A 302 to a private address would bypass the check above, so never follow it.
      redirect: "manual",
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
  } catch (e) {
    return { ok: false, status: null, error: String(e?.message || e).slice(0, 500) };
  }
  const status = res?.status ?? null;
  await discardCapped(res);
  if (status >= 200 && status < 300) return { ok: true, status, error: null };
  return { ok: false, status, error: `bad_status_${status}` };
}

// Fan out without ever throwing — callers invoke without await after commit.
export async function dispatchEvent(projectId, event, payload, { client } = {}) {
  if (!projectId || !EVENTS.includes(event) || !isSupabaseConfigured()) return [];
  try {
    const sb = clientFor(client);
    const { data: endpoints, error } = await sb
      .from(ENDPOINTS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .eq("active", true)
      .is("deleted_at", null)
      .contains("events", [event]);
    if (error) {
      console.error("[webhooks.dispatch]", error.message);
      return [];
    }
    if (!endpoints || endpoints.length === 0) return [];
    const out = [];
    const data = payload === undefined ? {} : payload;
    for (const ep of endpoints) {
      try {
        const envelope = { projectId, event, data };
        const inserted = await sb
          .from(DELIVERIES_TABLE)
          .insert({
            endpoint_id: ep.id,
            event,
            payload: envelope,
            next_retry_at: new Date(Date.now() + BASE_RETRY_MS).toISOString(),
          })
          .select("*")
          .single();
        if (inserted.error || !inserted.data) {
          console.error("[webhooks.dispatch.record]", inserted.error?.message);
          continue;
        }
        const delivery = inserted.data;
        const bodyString = safeStringify({
          id: delivery.id,
          event,
          projectId,
          createdAt: delivery.created_at,
          data,
        });
        if (!bodyString) {
          await sb.from(DELIVERIES_TABLE).update({ status: "failed", error: "bad_payload" }).eq("id", delivery.id);
          continue;
        }
        const result = await postOnce(ep.url, ep.secret, event, delivery.id, bodyString);
        if (result.ok) {
          await sb
            .from(DELIVERIES_TABLE)
            .update({
              status: "delivered",
              attempts: 1,
              response_code: result.status,
              error: null,
              next_retry_at: null,
              delivered_at: new Date().toISOString(),
            })
            .eq("id", delivery.id);
          out.push({ ...normalizeDelivery({ ...delivery, status: "delivered", attempts: 1 }), ok: true });
        } else {
          await sb
            .from(DELIVERIES_TABLE)
            .update({
              status: "pending",
              attempts: 1,
              response_code: result.status,
              error: String(result.error || "delivery_failed").slice(0, 1000),
              next_retry_at: new Date(Date.now() + backoffMs(1)).toISOString(),
            })
            .eq("id", delivery.id);
          out.push({ ...normalizeDelivery({ ...delivery, attempts: 1 }), ok: false });
        }
      } catch (e) {
        console.error("[webhooks.dispatch.endpoint]", e);
      }
    }
    return out;
  } catch (e) {
    console.error("[webhooks.dispatch]", e);
    return [];
  }
}

export async function retryDueDeliveries(limit = 25, { client } = {}) {
  if (!isSupabaseConfigured()) return [];
  const n = Number.isFinite(Number(limit)) ? Math.min(Math.max(Math.floor(Number(limit)), 1), 100) : 25;
  try {
    const sb = clientFor(client);
    const { data: due, error } = await sb
      .from(DELIVERIES_TABLE)
      .select("*")
      .eq("status", "pending")
      .lte("next_retry_at", new Date().toISOString())
      .order("next_retry_at", { ascending: true })
      .limit(n);
    if (error) {
      console.error("[webhooks.retry]", error.message);
      return [];
    }
    if (!due || due.length === 0) return [];
    const out = [];
    for (const d of due) {
      try {
        const epRes = await sb.from(ENDPOINTS_TABLE).select("*").eq("id", d.endpoint_id).is("deleted_at", null).single();
        const ep = epRes.data;
        if (epRes.error || !ep || !ep.active) {
          await sb.from(DELIVERIES_TABLE).update({ status: "failed", error: "endpoint_unavailable" }).eq("id", d.id);
          continue;
        }
        const stored = d.payload && typeof d.payload === "object" ? d.payload : {};
        const storedProject = stored.projectId ?? null;
        const storedData = Object.hasOwn(stored, "data") ? stored.data : stored;
        const bodyString = safeStringify({
          id: d.id,
          event: d.event,
          projectId: storedProject,
          createdAt: d.created_at,
          data: storedData,
        });
        if (!bodyString) {
          await sb.from(DELIVERIES_TABLE).update({ status: "failed", error: "bad_payload" }).eq("id", d.id);
          continue;
        }
        const result = await postOnce(ep.url, ep.secret, d.event, d.id, bodyString);
        const attempts = Number(d.attempts || 0) + 1;
        if (result.ok) {
          await sb
            .from(DELIVERIES_TABLE)
            .update({
              status: "delivered",
              attempts,
              response_code: result.status,
              error: null,
              next_retry_at: null,
              delivered_at: new Date().toISOString(),
            })
            .eq("id", d.id);
          out.push({ ...normalizeDelivery({ ...d, status: "delivered", attempts }), ok: true });
        } else {
          const exhausted = attempts >= MAX_ATTEMPTS;
          await sb
            .from(DELIVERIES_TABLE)
            .update({
              status: exhausted ? "failed" : "pending",
              attempts,
              response_code: result.status,
              error: String(result.error || "delivery_failed").slice(0, 1000),
              next_retry_at: exhausted ? null : new Date(Date.now() + backoffMs(attempts)).toISOString(),
            })
            .eq("id", d.id);
          out.push({ ...normalizeDelivery({ ...d, attempts }), ok: false });
        }
      } catch (e) {
        console.error("[webhooks.retry.one]", e);
      }
    }
    return out;
  } catch (e) {
    console.error("[webhooks.retry]", e);
    return [];
  }
}
