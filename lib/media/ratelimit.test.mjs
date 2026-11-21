import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { RATE_LIMITS, rateLimit, rateLimitHeaders, resetRateLimits } from "./ratelimit.js";

afterEach(() => resetRateLimits());

test("allows up to the limit in a window, then refuses with a retry hint", () => {
  for (let i = 0; i < 3; i++) assert.equal(rateLimit("u1", { limit: 3, windowMs: 60000 }).ok, true);
  const refused = rateLimit("u1", { limit: 3, windowMs: 60000 });
  assert.equal(refused.ok, false);
  assert.equal(refused.remaining, 0);
  assert.ok(refused.retryAfter >= 1);
  const headers = rateLimitHeaders(refused);
  assert.equal(headers["RateLimit-Limit"], "3");
  assert.ok(Number(headers["Retry-After"]) >= 1);
});

test("keys are independent", () => {
  rateLimit("a", { limit: 1, windowMs: 60000 });
  assert.equal(rateLimit("a", { limit: 1, windowMs: 60000 }).ok, false);
  assert.equal(rateLimit("b", { limit: 1, windowMs: 60000 }).ok, true);
});

test("a new window starts fresh", async () => {
  rateLimit("w", { limit: 1, windowMs: 20 });
  assert.equal(rateLimit("w", { limit: 1, windowMs: 20 }).ok, false);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(rateLimit("w", { limit: 1, windowMs: 20 }).ok, true);
});

test("an unusable key never shares one bucket across callers", () => {
  for (let i = 0; i < 5; i++) assert.equal(rateLimit("", { limit: 1, windowMs: 60000 }).ok, true);
});

test("budgets leave room for a bulk drop of a hundred files a minute", () => {
  for (const bucket of ["upload", "uploadUrl", "commit", "thumbnail"]) {
    assert.ok(RATE_LIMITS[bucket].limit >= 200, bucket);
  }
});
