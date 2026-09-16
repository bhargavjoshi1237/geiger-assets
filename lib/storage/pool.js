if (typeof window !== "undefined") {
  throw new Error("lib/storage/pool is server-only.");
}

import { createServerSupabase } from "@/lib/supabase/server";
import { cached, cacheDelete } from "@/lib/s3/cache";
import { listPools, listBackends, getBackend } from "@/lib/storage/backends/store";
import { backendFromRecord, envBackend } from "@/lib/storage/backends/registry";

// Storage pooling: several providers joined behind one placement decision.
//
// A pool is an ordered set of backends plus a strategy for choosing among them:
//
//   failover  lowest `priority` wins; the rest are standby. The default,
//             because it is the only strategy whose behaviour is identical to
//             the single-bucket setup when the pool has one member.
//   spread    capacity aggregation -- placement is shared across members in
//             proportion to `weight`, so two half-full pods read as one pool.
//   mirror    redundancy -- the object is written to every member, and a read
//             falls through to whichever copy answers.
//
// Reads never re-run placement. An object is found through the backend id
// recorded on its row, because placement is a decision made once at write time
// and re-deciding it later would point at a bucket the bytes were never in.

const POOL_TTL_MS = 30 * 1000;

function cacheKeyFor(projectId) {
  return `pool:${projectId || "global"}`;
}

export function invalidatePoolCache(projectId) {
  cacheDelete(cacheKeyFor(projectId));
  if (projectId) cacheDelete(cacheKeyFor(null));
}

async function assetsDb() {
  const sb = await createServerSupabase();
  return sb.schema("assets");
}

// Loads the pool that governs a project, together with the backend records its
// members point at, in one cached shot. Upload throughput would otherwise pay
// two round-trips per file just to learn where the file goes.
async function loadPlan(projectId) {
  return cached(cacheKeyFor(projectId), POOL_TTL_MS, async () => {
    try {
      const client = await assetsDb();
      const [pools, backends] = await Promise.all([
        listPools({ projectId, client }),
        listBackends({ projectId, includeSecrets: true, client }),
      ]);
      if (!Array.isArray(backends) || backends.length === 0) return null;

      const byId = new Map(backends.map((b) => [b.id, b]));
      // A project-scoped pool wins over a suite-wide one; without either, every
      // enabled backend forms an implicit failover pool so simply adding a
      // backend is enough to start using it.
      const pool = (Array.isArray(pools) ? pools : [])
        .filter((p) => p.enabled !== false)
        .sort((a, b) => (a.projectId === projectId ? -1 : 1) - (b.projectId === projectId ? -1 : 1))[0] || null;

      const members = pool
        ? (pool.members || [])
            .map((m) => ({ ...m, record: byId.get(m.backendId) }))
            .filter((m) => m.record && m.record.enabled !== false)
        : backends
            .filter((b) => b.enabled !== false)
            .map((b, i) => ({ backendId: b.id, priority: 100 + i, weight: 1, readOnly: false, record: b }));

      return { strategy: pool?.strategy || "failover", members };
    } catch (e) {
      console.error("[storage.pool.load]", e?.message || e);
      return null;
    }
  });
}

// A member can take a write when it is not read-only, not known-unhealthy, and
// large enough for this object. `healthOk === null` means "never probed", which
// stays eligible -- a freshly added backend must be usable before anything has
// had a reason to health-check it.
function writable(member, sizeBytes) {
  if (member.readOnly) return false;
  if (member.record.healthOk === false) return false;
  const cap = Number(member.record.maxUploadBytes) || 0;
  if (cap > 0 && Number(sizeBytes) > cap) return false;
  return true;
}

function byPriority(a, b) {
  return (Number(a.priority) || 0) - (Number(b.priority) || 0);
}

// Weighted pick for `spread`. Proportional rather than round-robin because
// there is no shared counter between serverless instances to round-robin on --
// weight-proportional random converges to the same distribution without one.
function weightedPick(members) {
  const total = members.reduce((sum, m) => sum + Math.max(Number(m.weight) || 1, 1), 0);
  let n = Math.random() * total;
  for (const m of members) {
    n -= Math.max(Number(m.weight) || 1, 1);
    if (n <= 0) return m;
  }
  return members[members.length - 1];
}

function driverOf(member) {
  const driver = backendFromRecord(member.record);
  return driver ? { backendId: member.backendId, driver } : null;
}

// Where a new object should be written.
//
// Returns `{ backendId, driver, mirrors }`. `backendId` is null for the
// env-configured default, which is what gets recorded on the asset row so a
// deployment that never configures a pool behaves exactly as it did before.
export async function writeTarget({ projectId, sizeBytes = 0 } = {}) {
  const plan = await loadPlan(projectId);
  const fallback = () => {
    const driver = envBackend();
    return driver ? { backendId: null, driver, mirrors: [] } : null;
  };
  if (!plan || plan.members.length === 0) return fallback();

  const eligible = plan.members.filter((m) => writable(m, sizeBytes)).sort(byPriority);
  if (eligible.length === 0) {
    console.error("[storage.pool] no eligible backend for", projectId, sizeBytes);
    return fallback();
  }

  if (plan.strategy === "mirror") {
    const targets = eligible.map(driverOf).filter(Boolean);
    if (targets.length === 0) return fallback();
    const [primary, ...mirrors] = targets;
    return { backendId: primary.backendId, driver: primary.driver, mirrors };
  }

  const chosen = plan.strategy === "spread" ? weightedPick(eligible) : eligible[0];
  // A driver that fails to build (bad credentials, missing STORAGE_SECRET_KEY)
  // must not sink the upload while healthy members are standing right there.
  const picked = driverOf(chosen) || eligible.map(driverOf).find(Boolean);
  if (!picked) return fallback();
  return { backendId: picked.backendId, driver: picked.driver, mirrors: [] };
}

// Resolves one backend id to a driver. `null`/`"env"` means the env default.
export async function driverFor(backendId) {
  if (!backendId || backendId === "env") return envBackend();
  try {
    const client = await assetsDb();
    const record = await getBackend(backendId, { includeSecrets: true, client });
    if (!record) {
      console.error("[storage.pool] unknown backend", backendId);
      return null;
    }
    return backendFromRecord(record);
  } catch (e) {
    console.error("[storage.pool.driverFor]", e?.message || e);
    return null;
  }
}

// Read candidates for an object, best first.
//
// The recorded backend always leads. The other pool members follow only as a
// recovery path: under `mirror` a copy genuinely lives on each of them, and
// after a backend is retired its objects are still findable while they are
// being migrated. Callers stop at the first candidate that answers.
export async function readCandidates(row) {
  const recorded = row?.storage_backend ?? null;
  const out = [];
  const seen = new Set();

  const primary = await driverFor(recorded);
  if (primary) {
    out.push({ backendId: recorded, driver: primary });
    seen.add(recorded || "env");
  }

  const plan = await loadPlan(row?.project_id ?? null);
  for (const member of (plan?.members || []).slice().sort(byPriority)) {
    if (seen.has(member.backendId)) continue;
    const entry = driverOf(member);
    if (!entry) continue;
    seen.add(member.backendId);
    out.push(entry);
  }

  if (!seen.has("env")) {
    const fallback = envBackend();
    if (fallback) out.push({ backendId: null, driver: fallback });
  }
  return out;
}

// Convenience for the common read path: the first driver that actually has the
// object. Returns `{ backendId, driver, head }` or null.
export async function locateObject(row, key) {
  if (!key) return null;
  const candidates = await readCandidates(row);
  for (const candidate of candidates) {
    const head = await candidate.driver.head(key);
    if (head) return { ...candidate, head };
  }
  return null;
}

// Clears the cached HEAD/signature for one object.
//
// Backends namespace their cache entries by backend id, because the same key
// can exist on several members of a pool and one shared entry would answer for
// the wrong one. Invalidation therefore has to name the backend too -- and also
// clears the un-namespaced entry lib/s3/objects.js writes, since the legacy
// env-singleton path is still live for callers that have not moved over.
export function invalidateKey(key, backendId) {
  if (!key) return;
  const id = backendId || "env";
  cacheDelete(`head:${id}:${key}`);
  cacheDelete(`sig:get:${id}:${key}`);
  cacheDelete(`head:${key}`);
  cacheDelete(`sig:get:${key}`);
}

// Best-effort fan-out for `mirror`. Never awaited by the commit path: a mirror
// that is down must not fail an upload whose primary copy is already durable.
// The object stays readable through its recorded backend either way.
export function mirrorWrite(mirrors, payload) {
  if (!Array.isArray(mirrors) || mirrors.length === 0) return;
  (async () => {
    for (const { backendId, driver } of mirrors) {
      try {
        const res = await driver.put(payload);
        if (!res) console.error("[storage.pool.mirror] put returned null", backendId, payload.key);
      } catch (e) {
        console.error("[storage.pool.mirror]", backendId, e?.message || e);
      }
    }
  })();
}
