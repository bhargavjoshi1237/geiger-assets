if (typeof window !== "undefined") {
  throw new Error("lib/media/ratelimit is server-only.");
}

// Fixed-window rate limiting for the storage routes.
//
// None of the upload or sign routes bound how often an authenticated user may
// call them: /api/storage/upload will accept unlimited 4 MB posts, and
// /api/storage/sign will mint 100 presigned URLs per request as fast as it is
// asked. This is the cheap guard for that.
//
// Scope and caveat: state lives in this process only. Behind several instances
// each enforces its own window, so the effective limit is (limit × instances).
// That is acceptable for abuse-dampening, and deliberately not represented as
// a quota — real quota accounting is durable and lives in lib/media/usage.js.
// Swapping in a shared store means replacing `hit()` alone.

const WINDOWS = new Map();
const MAX_KEYS = 10000;

// Fixed windows, not a sliding log: one counter per key instead of a timestamp
// array, so a hot key costs O(1) memory regardless of request volume.
function bucketFor(key, windowMs, now) {
  const existing = WINDOWS.get(key);
  if (existing && existing.resetAt > now) return existing;
  const fresh = { count: 0, resetAt: now + windowMs };
  WINDOWS.set(key, fresh);
  return fresh;
}

// Called on write, so expiry is amortised and there is no timer holding the
// process awake. Cheap because expired entries are the common case.
function evictExpired(now) {
  if (WINDOWS.size <= MAX_KEYS) return;
  for (const [k, v] of WINDOWS) {
    if (v.resetAt <= now) WINDOWS.delete(k);
  }
  // Still oversized after expiry — drop oldest-inserted keys. Map preserves
  // insertion order, so this sheds the least recently created windows.
  if (WINDOWS.size > MAX_KEYS) {
    const overflow = WINDOWS.size - MAX_KEYS;
    let n = 0;
    for (const k of WINDOWS.keys()) {
      WINDOWS.delete(k);
      if (++n >= overflow) break;
    }
  }
}

export function rateLimit(key, { limit = 60, windowMs = 60000 } = {}) {
  const now = Date.now();
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 60;
  const safeWindow = Number.isFinite(windowMs) && windowMs > 0 ? Math.floor(windowMs) : 60000;

  // An unusable key must not collapse every caller into one shared bucket.
  if (typeof key !== "string" || key === "") {
    return { ok: true, limit: safeLimit, remaining: safeLimit, resetAt: now + safeWindow, retryAfter: 0 };
  }

  const bucket = bucketFor(key, safeWindow, now);
  bucket.count += 1;
  evictExpired(now);

  const ok = bucket.count <= safeLimit;
  return {
    ok,
    limit: safeLimit,
    remaining: Math.max(safeLimit - bucket.count, 0),
    resetAt: bucket.resetAt,
    retryAfter: ok ? 0 : Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1),
  };
}

// The headers a 429 (and a healthy response) should carry, so routes stay
// consistent and clients can back off without guessing.
export function rateLimitHeaders(result) {
  if (!result) return {};
  const headers = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 0)),
  };
  if (!result.ok) headers["Retry-After"] = String(result.retryAfter);
  return headers;
}

// Per-route budgets. Uploads are the expensive path (bytes + a sharp re-encode);
// signing is cheap per call but fans out to 100 keys, so it is capped tighter
// than its cost alone would suggest.
export const RATE_LIMITS = Object.freeze({
  upload: { limit: 60, windowMs: 60000 },
  uploadUrl: { limit: 120, windowMs: 60000 },
  commit: { limit: 120, windowMs: 60000 },
  sign: { limit: 30, windowMs: 60000 },
  deliver: { limit: 600, windowMs: 60000 },
});

export function resetRateLimits() {
  WINDOWS.clear();
}
