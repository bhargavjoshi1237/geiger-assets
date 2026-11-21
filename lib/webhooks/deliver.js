if (typeof window !== "undefined") {
  throw new Error("lib/webhooks/deliver is server-only — it signs and posts to user-supplied URLs.");
}

// The webhook sender for assets.webhook_endpoints / assets.webhook_deliveries
// (owned by lib/supabase/platform.js, which the Webhooks screen reads).
//
// emitWebhookEvent fans an event out to the project's active endpoints that
// subscribe to it: one delivery row per endpoint, then a signed POST. A row
// stays 'queued' while it still has attempts left — the next attempt time
// lives in metadata.next_retry_at — and ends 'delivered' or 'failed'.
// retryDueWebhooks is the sweep over due rows. The stored payload is exactly
// the body that was sent, so the delivery log shows what a receiver got.
//
// Signing: `webhook-signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of
// "<t>.<body>" keyed by the endpoint's signing secret>`. Receivers recompute
// it with a constant-time compare and reject stale timestamps.
//
// Every function takes the caller's schema-scoped client, never throws, and
// returns plain values.

import { createHmac } from "node:crypto";
import { isBlockedHost, resolvesToPublicHost } from "@/lib/storage/ssrf";

const ENDPOINTS = "webhook_endpoints";
const DELIVERIES = "webhook_deliveries";

const TIMEOUT_MS = 10000;
const MAX_URL_LENGTH = 2048;
// Only the status matters — bound what is read so a hostile body can't hold the function.
const MAX_RESPONSE_BYTES = 32 * 1024;
export const MAX_ATTEMPTS = 6;
const BASE_RETRY_MS = 60 * 1000;
const MAX_RETRY_MS = 6 * 60 * 60 * 1000;

export function signPayload(body, secret, timestamp) {
  if (typeof body !== "string" || typeof secret !== "string" || !secret) return null;
  const ts = Math.floor(Number(timestamp));
  if (!Number.isFinite(ts) || ts <= 0) return null;
  const hex = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  return `t=${ts},v1=${hex}`;
}

// 1, 2, 4, 8 … minutes, capped.
export function backoffMs(attempts) {
  const step = Math.min(Math.max(Math.floor(Number(attempts) || 1), 1), 12);
  return Math.min(BASE_RETRY_MS * 2 ** (step - 1), MAX_RETRY_MS);
}

function isLoopbackHost(host) {
  const h = String(host || "").toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h.endsWith(".localhost") || h === "::1" || /^127\./.test(h);
}

// Endpoint URLs are user-supplied and this server fetches them. https only —
// plain http would expose payloads and signatures on the wire — except
// loopback outside production, for testing a local receiver.
export async function checkWebhookUrl(raw) {
  try {
    if (typeof raw !== "string" || !raw || raw.length > MAX_URL_LENGTH) return null;
    const url = new URL(raw.trim());
    if (url.username || url.password) return null;
    if (url.protocol === "http:") {
      return process.env.NODE_ENV !== "production" && isLoopbackHost(url.hostname) ? url : null;
    }
    if (url.protocol !== "https:") return null;
    if (isBlockedHost(url.hostname)) return null;
    if (!(await resolvesToPublicHost(url.hostname))) return null;
    return url;
  } catch {
    return null;
  }
}

async function discardBody(res) {
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
    reader.cancel().catch(() => {});
  } catch {
    // The status is already captured.
  }
}

async function postOnce(endpoint, delivery, body) {
  const started = Date.now();
  const url = await checkWebhookUrl(endpoint.url);
  if (!url) return { ok: false, status: null, error: "Endpoint URL is not a public https address.", durationMs: 0 };
  const signature = signPayload(body, endpoint.signing_secret, Math.floor(Date.now() / 1000));
  if (!signature) return { ok: false, status: null, error: "Endpoint has no signing secret.", durationMs: 0 };
  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Geiger-Assets-Webhooks/1",
        "webhook-id": delivery.id,
        "webhook-event": delivery.event,
        "webhook-signature": signature,
      },
      body,
      // A redirect to a private address would slip past the check above.
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await discardBody(res);
    const durationMs = Date.now() - started;
    if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status, error: "", durationMs };
    return { ok: false, status: res.status, error: `Endpoint answered ${res.status}.`, durationMs };
  } catch (e) {
    const timedOut = e?.name === "TimeoutError" || e?.name === "AbortError";
    return {
      ok: false,
      status: null,
      error: timedOut ? `No response within ${TIMEOUT_MS / 1000}s.` : String(e?.message || e).slice(0, 500),
      durationMs: Date.now() - started,
    };
  }
}

// One attempt against one delivery row, recorded on that row.
async function attempt(db, endpoint, delivery, { retries = true } = {}) {
  const body = JSON.stringify(delivery.payload ?? {});
  const result = await postOnce(endpoint, delivery, body);
  const attempts = Number(delivery.attempt_count || 0) + 1;
  const metadata = { ...(delivery.metadata && typeof delivery.metadata === "object" ? delivery.metadata : {}) };
  delete metadata.next_retry_at;
  let status = "delivered";
  if (!result.ok) {
    status = retries && attempts < MAX_ATTEMPTS ? "queued" : "failed";
    if (status === "queued") metadata.next_retry_at = new Date(Date.now() + backoffMs(attempts)).toISOString();
  }
  const { error } = await db
    .from(DELIVERIES)
    .update({
      status,
      attempt_count: attempts,
      response_code: result.status,
      error: result.error || "",
      duration_ms: result.durationMs,
      metadata,
    })
    .eq("id", delivery.id);
  if (error) console.error("[webhooks.attempt]", error.message);
  return { id: delivery.id, endpointId: endpoint.id, status, responseCode: result.status, error: result.error || "" };
}

// Rows are born with a retry time so that one whose first attempt never
// finishes (the function was killed mid-send) is still picked up by the sweep.
async function recordDelivery(db, endpoint, event, data, { retries = true } = {}) {
  const id = crypto.randomUUID();
  const payload = {
    id,
    event,
    projectId: endpoint.project_id,
    createdAt: new Date().toISOString(),
    data: data ?? {},
  };
  const { data: row, error } = await db
    .from(DELIVERIES)
    .insert({
      id,
      project_id: endpoint.project_id,
      endpoint_id: endpoint.id,
      event,
      payload,
      status: "queued",
      metadata: retries ? { next_retry_at: new Date(Date.now() + 2 * BASE_RETRY_MS).toISOString() } : {},
    })
    .select("*")
    .single();
  if (error) {
    console.error("[webhooks.record]", error.message);
    return null;
  }
  return row;
}

// Fan out to every active endpoint subscribed to `event`. Returns the attempt
// results; [] when nothing subscribes or anything fails before sending.
export async function emitWebhookEvent(db, { projectId, event, data }) {
  if (!db || !projectId || !event) return [];
  try {
    const { data: endpoints, error } = await db
      .from(ENDPOINTS)
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "active")
      .is("deleted_at", null)
      .contains("events", [event]);
    if (error) {
      console.error("[webhooks.emit]", error.message);
      return [];
    }
    const out = [];
    for (const endpoint of endpoints || []) {
      const delivery = await recordDelivery(db, endpoint, event, data);
      if (delivery) out.push(await attempt(db, endpoint, delivery));
    }
    return out;
  } catch (e) {
    console.error("[webhooks.emit]", e);
    return [];
  }
}

// A test send from the Webhooks screen: a real signed POST to one endpoint,
// recorded like any delivery but never retried.
export async function sendTestWebhook(db, endpoint, { event, data }) {
  if (!db || !endpoint?.id || !event) return null;
  try {
    const delivery = await recordDelivery(db, endpoint, event, { ...(data ?? {}), test: true }, { retries: false });
    if (!delivery) return null;
    return await attempt(db, endpoint, delivery, { retries: false });
  } catch (e) {
    console.error("[webhooks.test]", e);
    return null;
  }
}

// Retry queued deliveries whose next attempt is due. Rows without a
// next_retry_at were never sent by this worker and are left alone.
export async function retryDueWebhooks(db, { limit = 25 } = {}) {
  if (!db) return [];
  const n = Math.min(Math.max(Math.floor(Number(limit) || 25), 1), 100);
  try {
    const { data: due, error } = await db
      .from(DELIVERIES)
      .select("*")
      .eq("status", "queued")
      .not("metadata->>next_retry_at", "is", null)
      .lte("metadata->>next_retry_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(n);
    if (error) {
      console.error("[webhooks.retry]", error.message);
      return [];
    }
    const out = [];
    for (const delivery of due || []) {
      const { data: endpoint } = await db
        .from(ENDPOINTS)
        .select("*")
        .eq("id", delivery.endpoint_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (!endpoint || endpoint.status !== "active") {
        const metadata = { ...(delivery.metadata || {}) };
        delete metadata.next_retry_at;
        await db
          .from(DELIVERIES)
          .update({ status: "failed", error: "Endpoint was paused or deleted.", metadata })
          .eq("id", delivery.id);
        continue;
      }
      out.push(await attempt(db, endpoint, delivery));
    }
    return out;
  } catch (e) {
    console.error("[webhooks.retry]", e);
    return [];
  }
}
