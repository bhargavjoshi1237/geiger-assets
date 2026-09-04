if (typeof window !== "undefined") {
  throw new Error("lib/s3 is server-only — import lib/storage/client on the browser.");
}

const MAX_ENTRIES = 1000;

function store() {
  const g = globalThis;
  if (!g.__geigerS3Cache) g.__geigerS3Cache = new Map();
  if (!g.__geigerS3Inflight) g.__geigerS3Inflight = new Map();
  return { map: g.__geigerS3Cache, inflight: g.__geigerS3Inflight };
}

function evictIfNeeded(map) {
  if (map.size <= MAX_ENTRIES) return;
  const overflow = map.size - MAX_ENTRIES;
  let n = 0;
  for (const k of map.keys()) {
    map.delete(k);
    if (++n >= overflow) break;
  }
}

export function cacheGet(key) {
  const { map } = store();
  const entry = map.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    map.delete(key);
    return undefined;
  }
  map.delete(key);
  map.set(key, entry);
  return entry.value;
}

export function cacheSet(key, value, ttlMs) {
  const { map } = store();
  const ttl = Number(ttlMs);
  if (!Number.isFinite(ttl) || ttl <= 0) return;
  map.set(key, { value, expiresAt: Date.now() + ttl });
  evictIfNeeded(map);
}

export function cacheDelete(keyOrPrefix) {
  const { map, inflight } = store();
  if (map.has(keyOrPrefix)) map.delete(keyOrPrefix);
  for (const k of [...map.keys()]) {
    if (k.startsWith(keyOrPrefix)) map.delete(k);
  }
  for (const k of [...inflight.keys()]) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) inflight.delete(k);
  }
}

export async function cached(key, ttlMs, producer) {
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  const { inflight } = store();
  const pending = inflight.get(key);
  if (pending) return pending;
  const run = (async () => {
    try {
      const value = await producer();
      if (value !== null && value !== undefined) cacheSet(key, value, ttlMs);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, run);
  return run;
}

export function resetS3Cache() {
  const g = globalThis;
  g.__geigerS3Cache = new Map();
  g.__geigerS3Inflight = new Map();
}
