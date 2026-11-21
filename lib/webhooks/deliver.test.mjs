import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import {
  MAX_ATTEMPTS,
  backoffMs,
  checkWebhookUrl,
  emitWebhookEvent,
  retryDueWebhooks,
  sendTestWebhook,
  signPayload,
} from "./deliver.js";

// --- a local receiver -------------------------------------------------------

let server;
let base;
let nextStatus = 200;
const received = [];

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push({ headers: req.headers, body });
      res.statusCode = nextStatus;
      res.end("ok");
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

// --- a fake of the slice of the Supabase query builder the module uses -------

function fakeDb({ endpoints = [], deliveries = [] } = {}) {
  const tables = { webhook_endpoints: endpoints, webhook_deliveries: deliveries };
  const jsonPath = (row, col) => {
    const [c, key] = col.split("->>");
    return key ? row[c]?.[key] ?? null : row[c];
  };
  function query(table) {
    const filters = [];
    let op = "select";
    let payload = null;
    let single = false;
    const q = {
      select: () => q,
      insert: (row) => ((op = "insert"), (payload = row), q),
      update: (row) => ((op = "update"), (payload = row), q),
      eq: (c, v) => (filters.push((r) => jsonPath(r, c) === v), q),
      is: (c, v) => (filters.push((r) => (jsonPath(r, c) ?? null) === v), q),
      not: (c, _op, v) => (filters.push((r) => (jsonPath(r, c) ?? null) !== v), q),
      lte: (c, v) => (filters.push((r) => jsonPath(r, c) != null && jsonPath(r, c) <= v), q),
      contains: (c, vals) => (filters.push((r) => vals.every((v) => (r[c] || []).includes(v))), q),
      order: () => q,
      limit: () => q,
      single: () => ((single = true), q),
      maybeSingle: () => ((single = true), q),
      then(resolve) {
        const rows = tables[table];
        if (op === "insert") {
          const row = { attempt_count: 0, metadata: {}, created_at: new Date().toISOString(), ...payload };
          rows.push(row);
          return resolve({ data: row, error: null });
        }
        const hit = rows.filter((r) => filters.every((f) => f(r)));
        if (op === "update") {
          for (const r of hit) Object.assign(r, payload);
          return resolve({ data: null, error: null });
        }
        return resolve({ data: single ? hit[0] ?? null : hit, error: null });
      },
    };
    return q;
  }
  return { from: query, tables };
}

function endpoint(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    project_id: "p1",
    url: `${base}/hook`,
    events: ["upload.completed"],
    status: "active",
    signing_secret: "s3cret",
    deleted_at: null,
    ...overrides,
  };
}

// --- tests -------------------------------------------------------------------

test("signs t.body with HMAC-SHA256 so a receiver can verify it", () => {
  const sig = signPayload('{"a":1}', "k", 1700000000);
  const hex = createHmac("sha256", "k").update('1700000000.{"a":1}').digest("hex");
  assert.equal(sig, `t=1700000000,v1=${hex}`);
  assert.equal(signPayload("{}", "", 1), null);
});

test("backoff doubles from a minute and caps at six hours", () => {
  assert.equal(backoffMs(1), 60000);
  assert.equal(backoffMs(2), 120000);
  assert.equal(backoffMs(50), 6 * 60 * 60 * 1000);
});

test("refuses private, metadata, credentialed and plain-http targets", async () => {
  for (const url of [
    "https://10.0.0.5/x",
    "https://169.254.169.254/latest/meta-data",
    "https://192.168.1.1/",
    "https://[::1]/",
    "https://user:pw@example.com/",
    "http://example.com/",
    "ftp://example.com/",
    "https://localhost/",
    "https://2130706433/",
  ]) {
    assert.equal(await checkWebhookUrl(url), null, url);
  }
});

test("allows http loopback only outside production", async () => {
  assert.ok(await checkWebhookUrl(`${base}/hook`));
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.equal(await checkWebhookUrl(`${base}/hook`), null);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("delivers a signed event to subscribed active endpoints only", async () => {
  received.length = 0;
  nextStatus = 204;
  const sub = endpoint();
  const db = fakeDb({
    endpoints: [
      sub,
      endpoint({ events: ["asset.created"] }),
      endpoint({ status: "paused" }),
      endpoint({ deleted_at: "2026-01-01" }),
      endpoint({ project_id: "other" }),
    ],
  });
  const out = await emitWebhookEvent(db, { projectId: "p1", event: "upload.completed", data: { assetId: "a1" } });
  assert.equal(out.length, 1);
  assert.equal(out[0].status, "delivered");
  assert.equal(received.length, 1);

  const { headers, body } = received[0];
  const [t, v1] = headers["webhook-signature"].split(",").map((p) => p.split("=")[1]);
  assert.equal(v1, createHmac("sha256", "s3cret").update(`${t}.${body}`).digest("hex"));
  assert.equal(headers["webhook-event"], "upload.completed");
  const sent = JSON.parse(body);
  assert.equal(sent.id, headers["webhook-id"]);
  assert.deepEqual(sent.data, { assetId: "a1" });

  const row = db.tables.webhook_deliveries[0];
  assert.equal(row.status, "delivered");
  assert.equal(row.attempt_count, 1);
  assert.equal(row.response_code, 204);
  assert.equal(row.endpoint_id, sub.id);
  assert.deepEqual(row.payload, sent, "the log keeps exactly what was sent");
  assert.equal(row.metadata.next_retry_at, undefined);
});

test("a failed send stays queued with a retry time, and the sweep retries it", async () => {
  nextStatus = 500;
  const ep = endpoint();
  const db = fakeDb({ endpoints: [ep] });
  await emitWebhookEvent(db, { projectId: "p1", event: "upload.completed", data: {} });
  const row = db.tables.webhook_deliveries[0];
  assert.equal(row.status, "queued");
  assert.equal(row.response_code, 500);
  assert.ok(row.metadata.next_retry_at > new Date().toISOString());

  // Not due yet: the sweep leaves it alone.
  assert.equal((await retryDueWebhooks(db)).length, 0);

  row.metadata.next_retry_at = new Date(Date.now() - 1000).toISOString();
  nextStatus = 200;
  const retried = await retryDueWebhooks(db);
  assert.equal(retried.length, 1);
  assert.equal(row.status, "delivered");
  assert.equal(row.attempt_count, 2);
});

test("gives up after the last attempt", async () => {
  nextStatus = 503;
  const ep = endpoint();
  const db = fakeDb({
    endpoints: [ep],
    deliveries: [{
      id: crypto.randomUUID(),
      project_id: "p1",
      endpoint_id: ep.id,
      event: "upload.completed",
      payload: { id: "d" },
      status: "queued",
      attempt_count: MAX_ATTEMPTS - 1,
      metadata: { next_retry_at: new Date(Date.now() - 1000).toISOString() },
    }],
  });
  await retryDueWebhooks(db);
  const row = db.tables.webhook_deliveries[0];
  assert.equal(row.status, "failed");
  assert.equal(row.attempt_count, MAX_ATTEMPTS);
  assert.equal(row.metadata.next_retry_at, undefined);
});

test("a queued delivery whose endpoint was paused is failed, not sent", async () => {
  received.length = 0;
  const ep = endpoint({ status: "paused" });
  const db = fakeDb({
    endpoints: [ep],
    deliveries: [{
      id: "d1",
      endpoint_id: ep.id,
      event: "upload.completed",
      payload: {},
      status: "queued",
      attempt_count: 1,
      metadata: { next_retry_at: new Date(Date.now() - 1000).toISOString() },
    }],
  });
  await retryDueWebhooks(db);
  assert.equal(db.tables.webhook_deliveries[0].status, "failed");
  assert.equal(received.length, 0);
});

test("a test send is a real delivery that is never retried", async () => {
  nextStatus = 500;
  const db = fakeDb();
  const result = await sendTestWebhook(db, endpoint(), { event: "asset.created", data: { id: "x" } });
  assert.equal(result.status, "failed");
  const row = db.tables.webhook_deliveries[0];
  assert.equal(row.status, "failed");
  assert.equal(row.payload.data.test, true);
  assert.equal(row.metadata.next_retry_at, undefined);
});

test("an unsafe endpoint URL is recorded as a failure without a request", async () => {
  received.length = 0;
  const db = fakeDb();
  const result = await sendTestWebhook(db, endpoint({ url: "https://10.1.2.3/hook" }), { event: "asset.created" });
  assert.equal(result.status, "failed");
  assert.match(result.error, /public https/);
  assert.equal(received.length, 0);
});

test("never throws on a broken client", async () => {
  const broken = { from: () => { throw new Error("down"); } };
  assert.deepEqual(await emitWebhookEvent(broken, { projectId: "p1", event: "upload.completed" }), []);
  assert.deepEqual(await retryDueWebhooks(broken), []);
  assert.equal(await sendTestWebhook(broken, endpoint(), { event: "x" }), null);
});
