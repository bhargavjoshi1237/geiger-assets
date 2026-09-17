if (typeof window !== "undefined") {
  throw new Error("lib/storage/reconcile is server-only.");
}

import { backendFromRecord, envBackend } from "./backends/registry.js";

// Storage reconciliation: the three passes, written once.
//
// Two entry points run these: scripts/s3-reconcile.js (pg over STRING_URI, run
// by hand) and app/api/cron/reconcile/route.js (Supabase under the request
// session, run on a schedule). Everything transport-specific arrives through
// the `db` adapter below, so neither entry point carries a copy of the pass
// logic and a fix lands in both at once.
//
// Like the data layer, nothing in here throws, toasts, or exits: failures are
// console.error'd, pushed onto `summary.errors`, and the pass returns what it
// managed to do. Exit codes and HTTP statuses belong to the callers.
//
// Placement is never re-run here. A row's bytes are found through the backend
// id recorded on the row (`storage_backend`), and a null there means "the
// env-configured default backend" — every row written before pooling existed
// carries null, so treating it as the env backend is what keeps a deployment
// with no pool behaving exactly as it did before.
//
// ---------------------------------------------------------------------------
// The db adapter contract (all async, all tri-state, never throwing)
// ---------------------------------------------------------------------------
//   listBackendRecords()
//       -> [normalized storage_backends record] | null
//   listStoredAssets({ limit })
//       -> [{ id, storageKey, storageBackend }] | null
//   markAssetMissing(id)                       -> boolean
//   findReferencedKeys(keys)
//       -> string[] (the subset of `keys` some row points at) | null
//   listStaleDeleted({ retentionDays, limit })
//       -> [{ id, projectId, storageKey, storageBackend,
//             versions: [{ storageKey, storageBackend }] }] | null
//   clearAssetKeys(id)                         -> boolean
//
// A `null` from any read is "the read failed" and is always handled by doing
// less, never by deleting more.

export const TMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const SOFT_DELETE_RETENTION_DAYS = 30;

// Unbounded by default, which is the manual CLI's behaviour. The cron route
// overrides all four so a run cannot walk into the function timeout.
export const DEFAULT_LIMITS = Object.freeze({
  verifyRows: 0, // 0 = no cap
  tmpObjects: 0,
  sweepRows: 0,
  timeBudgetMs: 0,
});

// ---------------------------------------------------------------------------
// Driver resolution
// ---------------------------------------------------------------------------

// Builds every driver once per run and indexes it by the id that appears in a
// `storage_backend` column. The env default is keyed "env" because that column
// holds null for it, and a Map cannot distinguish "null key" from "absent".
export function createResolver(records) {
  const byId = new Map();
  const list = [];

  const env = envBackend();
  if (env) {
    const entry = { backendId: null, label: "env default", driver: env };
    byId.set("env", entry);
    list.push(entry);
  }

  for (const record of Array.isArray(records) ? records : []) {
    if (!record?.id) continue;
    // A disabled backend deliberately yields no driver. Rows pinned to it are
    // then reported as unresolved rather than treated as missing bytes.
    const driver = backendFromRecord(record);
    if (!driver) {
      if (record.enabled !== false) {
        console.error("[storage.reconcile] could not build driver for", record.id);
      }
      continue;
    }
    const entry = { backendId: record.id, label: record.label || record.id, driver };
    byId.set(record.id, entry);
    list.push(entry);
  }

  return {
    // null / "env" -> the env-configured default backend.
    forBackend(backendId) {
      return byId.get(backendId || "env") || null;
    },
    enabled() {
      return list;
    },
    get count() {
      return list.length;
    },
  };
}

// ---------------------------------------------------------------------------
// Work budget
// ---------------------------------------------------------------------------

// Checked only *between* units of work, never inside one. A run that stops
// halfway through deleting an asset's objects would leave the DB claiming keys
// whose bytes are already gone, which is precisely the inconsistency a
// hard function timeout would produce.
function createBudget(limits) {
  const startedAt = Date.now();
  const ms = Number(limits.timeBudgetMs) || 0;
  return {
    startedAt,
    elapsed() {
      return Date.now() - startedAt;
    },
    spent() {
      return ms > 0 && Date.now() - startedAt >= ms;
    },
  };
}

function capped(limit, count) {
  const max = Number(limit) || 0;
  return max > 0 && count >= max;
}

function ageMsOf(obj) {
  if (!obj?.lastModified) return 0;
  const t = new Date(obj.lastModified).getTime();
  return Number.isFinite(t) ? Date.now() - t : 0;
}

function dedupeKeys(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    if (!entry?.key || seen.has(entry.key)) continue;
    seen.add(entry.key);
    out.push(entry);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pass 1 — every `stored` row still has its bytes
// ---------------------------------------------------------------------------

async function passVerify(ctx) {
  const { db, apply, drivers, log, budget, limits, summary } = ctx;
  const out = { checked: 0, missing: 0, marked: 0, unresolved: 0, foundElsewhere: 0 };

  const rows = await db.listStoredAssets({ limit: limits.verifyRows });
  if (!rows) {
    summary.errors.push("pass1_read_failed");
    log("pass 1: could not read stored rows — skipped");
    return out;
  }
  log(`pass 1: ${rows.length} stored row(s) to verify`);

  for (const row of rows) {
    if (budget.spent() || capped(limits.verifyRows, out.checked)) {
      summary.truncated = true;
      break;
    }
    if (!row?.storageKey) continue;
    out.checked += 1;

    const target = drivers.forBackend(row.storageBackend);
    if (!target) {
      // A row pinned to a backend that was deleted or disabled is a config
      // problem, not absent bytes — the object is very probably still sitting
      // there. Marking it `missing` would be a lie the UI acts on, so it is
      // reported and left alone.
      out.unresolved += 1;
      log(
        `  unresolved backend ${row.storageBackend || "env"} for asset ${row.id} ` +
          `(${row.storageKey}) — not marked missing`,
      );
      continue;
    }

    if (await target.driver.head(row.storageKey)) continue;

    // Before calling it missing, look on the other enabled backends. Under a
    // mirror pool a copy genuinely lives on each member and lib/storage/pool.js
    // readCandidates() falls through to it, so the asset is still servable and
    // must not be flagged. Only runs for rows that would otherwise be marked,
    // so the extra HEADs are rare.
    let elsewhere = null;
    for (const other of drivers.enabled()) {
      if (other.backendId === target.backendId) continue;
      if (await other.driver.head(row.storageKey)) {
        elsewhere = other;
        break;
      }
    }
    if (elsewhere) {
      out.foundElsewhere += 1;
      log(
        `  asset ${row.id} (${row.storageKey}) absent on ${target.label} ` +
          `but present on ${elsewhere.label} — not marked missing`,
      );
      continue;
    }

    out.missing += 1;
    log(`  missing bytes for asset ${row.id} (${row.storageKey}) on ${target.label}`);
    if (apply && (await db.markAssetMissing(row.id))) out.marked += 1;
  }

  log(`pass 1: ${out.missing} row(s) ${apply ? "marked missing" : "would be marked missing"}`);
  if (out.unresolved) log(`pass 1: ${out.unresolved} row(s) on an unavailable backend (untouched)`);
  if (out.foundElsewhere) log(`pass 1: ${out.foundElsewhere} row(s) found on another pool member`);
  return out;
}

// ---------------------------------------------------------------------------
// Pass 2 — orphaned `tmp/` staging objects
// ---------------------------------------------------------------------------

// Cross-backend ambiguity, and how it is resolved.
//
// With one bucket, "no row points at this key" meant "delete it". With a pool,
// the same key can exist on several backends while the row that owns it is
// pinned to exactly one of them, so a naive per-backend check would delete a
// mirror copy the moment it looked at the non-pinned backend.
//
// The reference check here is therefore **key-only and backend-agnostic**: a
// key any row anywhere points at is never an orphan, on any backend. That is
// deliberately conservative — it can leave a stray duplicate behind — and it is
// the right trade, because the alternative failure mode is deleting live bytes.
//
// It is also safe from false negatives: a staging key is
// `p/<projectId>/tmp/<uploadJobId>/<filename>` with a UUID job id, so the same
// key on two backends is always the same object, never an unrelated collision.
async function passOrphans(ctx) {
  const { db, apply, drivers, log, budget, limits, summary } = ctx;
  const out = { scanned: 0, orphans: 0, deleted: 0, backends: 0 };

  const targets = drivers.enabled();
  log(`pass 2: scanning tmp/ across ${targets.length} backend(s)`);
  let stop = false;

  for (const target of targets) {
    if (stop) break;
    if (!target.driver.capabilities?.list) {
      log(`pass 2: ${target.label} cannot list — skipped`);
      continue;
    }
    out.backends += 1;

    const top = await target.driver.list("p/", { limit: 1000, delimiter: "/" });
    const projectPrefixes = top ? top.prefixes.filter((p) => p !== "p/_health/") : [];
    log(`pass 2: ${target.label} — ${projectPrefixes.length} project prefix(es)`);

    for (const projectPrefix of projectPrefixes) {
      if (stop) break;
      let cursor;
      for (;;) {
        const page = await target.driver.list(`${projectPrefix}tmp/`, { limit: 1000, cursor });
        if (!page) break;
        out.scanned += page.objects.length;

        const aged = page.objects.filter((o) => o.key && ageMsOf(o) >= TMP_MAX_AGE_MS);
        if (aged.length) {
          // One reference lookup per page rather than per object: the old
          // per-object query made a 1000-object page cost 1000 round-trips,
          // which no longer fits inside a scheduled invocation.
          const referenced = await db.findReferencedKeys(aged.map((o) => o.key));
          if (referenced === null) {
            // Fail closed. Without a trustworthy reference list every object
            // looks like an orphan, and acting on that would delete the bucket.
            summary.errors.push("pass2_reference_read_failed");
            log("pass 2: reference lookup failed — aborting the sweep without deleting");
            return out;
          }
          const refs = new Set(referenced);
          for (const obj of aged) {
            if (refs.has(obj.key)) continue;
            out.orphans += 1;
            log(
              `  orphan staging object ${obj.key} ` +
                `(${Math.round(ageMsOf(obj) / 3600000)}h old) on ${target.label}`,
            );
            if (apply && (await target.driver.remove(obj.key))) out.deleted += 1;
          }
        }

        if (budget.spent() || capped(limits.tmpObjects, out.scanned)) {
          summary.truncated = true;
          stop = true;
          break;
        }
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
    }
  }

  log(
    `pass 2: ${out.orphans} orphan(s) ` +
      `${apply ? `(${out.deleted} deleted)` : "(none deleted in dry-run)"}`,
  );
  return out;
}

// ---------------------------------------------------------------------------
// Pass 3 — soft-deleted rows past retention
// ---------------------------------------------------------------------------

async function passRetention(ctx) {
  const { db, apply, drivers, log, budget, limits, summary } = ctx;
  const out = { candidates: 0, sweptRows: 0, objects: 0, mirrored: 0, unresolved: 0 };

  const stale = await db.listStaleDeleted({
    retentionDays: SOFT_DELETE_RETENTION_DAYS,
    limit: limits.sweepRows,
  });
  if (!stale) {
    summary.errors.push("pass3_read_failed");
    log("pass 3: could not read soft-deleted rows — skipped");
    return out;
  }

  const sweepable = stale.filter((r) => r.storageKey || (r.versions || []).length);
  out.candidates = sweepable.length;
  log(
    `pass 3: ${sweepable.length} soft-deleted row(s) past the ` +
      `${SOFT_DELETE_RETENTION_DAYS}-day retention window`,
  );
  if (!apply) return out;

  for (const row of sweepable) {
    // Budget is checked here and nowhere inside the row: once a row's objects
    // start being deleted the DB update at the end has to happen, or the row
    // keeps pointing at bytes that no longer exist.
    if (budget.spent() || capped(limits.sweepRows, out.sweptRows)) {
      summary.truncated = true;
      break;
    }

    // Every version of a swept asset has to go, not just the current one.
    // Sweeping assets.storage_key alone left each superseded v/1..n-1 object
    // orphaned in the bucket permanently, so storage only ever grew. Each key
    // carries its own recorded backend — a version can predate a pool change.
    const entries = dedupeKeys([
      { key: row.storageKey, backendId: row.storageBackend ?? null },
      ...(row.versions || []).map((v) => ({
        key: v.storageKey,
        backendId: v.storageBackend ?? null,
      })),
    ]);

    let pinnedOk = true;
    let swept = 0;
    let mirrored = 0;

    for (const { key, backendId } of entries) {
      const pinned = drivers.forBackend(backendId);
      if (!pinned) {
        // The bytes are on a backend this run cannot reach. Clearing the row's
        // keys now would strand them permanently, so the whole row is skipped
        // and retried on the next run.
        pinnedOk = false;
        out.unresolved += 1;
        log(`  skipping ${row.id}: backend ${backendId || "env"} unavailable for ${key}`);
        break;
      }
      if (await pinned.driver.remove(key)) {
        swept += 1;
      } else {
        // The row keeps its keys and is retried next run. Clearing them after a
        // failed delete is how bytes become unreachable garbage forever.
        pinnedOk = false;
        log(`  could not delete ${key} from ${pinned.label} — leaving ${row.id} for the next run`);
        break;
      }

      // Mirror copies. Under a mirror pool the same key is durable on several
      // members, and retention has to remove all of them or the "deleted" bytes
      // survive on a standby. On a non-mirrored pool these are no-ops: asset
      // keys embed the project and asset UUIDs, so a key on another backend is
      // never an unrelated object. Best-effort — they do not gate the DB write.
      for (const other of drivers.enabled()) {
        if (other.backendId === pinned.backendId) continue;
        if (await other.driver.remove(key)) mirrored += 1;
      }
    }

    if (!pinnedOk) continue;

    // Derivatives hang off the asset prefix and are regenerable, so they go
    // wholesale rather than key by key — on every backend that can do it, for
    // the same mirror reason as above.
    if (row.projectId) {
      const prefix = `p/${row.projectId}/a/${row.id}/derivatives/`;
      for (const target of drivers.enabled()) {
        if (!target.driver.capabilities?.removePrefix) continue;
        const removed = await target.driver.removePrefix(prefix);
        if (Number.isFinite(removed)) swept += Number(removed);
      }
    }

    if (swept > 0) {
      if (await db.clearAssetKeys(row.id)) {
        out.sweptRows += 1;
        out.objects += swept;
        out.mirrored += mirrored;
        log(`  swept ${swept} object(s) for ${row.id}`);
      } else {
        summary.errors.push(`pass3_clear_failed:${row.id}`);
        log(`  swept ${swept} object(s) for ${row.id} but could not clear its keys`);
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

// Runs all three passes and returns a JSON-serialisable summary. `apply`
// defaults to false: nothing mutates unless a caller opts in explicitly.
export async function reconcile({ db, apply = false, limits = {}, log } = {}) {
  const emit = typeof log === "function" ? log : () => {};
  const merged = { ...DEFAULT_LIMITS, ...limits };
  const budget = createBudget(merged);

  const summary = {
    apply: Boolean(apply),
    truncated: false,
    startedAt: new Date(budget.startedAt).toISOString(),
    durationMs: 0,
    backends: [],
    pass1: null,
    pass2: null,
    pass3: null,
    errors: [],
  };

  if (!db) {
    summary.errors.push("no_db_adapter");
    summary.durationMs = budget.elapsed();
    return summary;
  }

  const records = await db.listBackendRecords();
  if (records === null) {
    // No backend table (or an unreadable one) is not fatal: a deployment that
    // never configured a pool has none, and the env default still applies.
    summary.errors.push("backend_records_unavailable");
  }
  const drivers = createResolver(records);
  summary.backends = drivers.enabled().map((b) => ({ backendId: b.backendId, label: b.label }));

  if (drivers.count === 0) {
    summary.errors.push("no_backends");
    emit("no usable storage backend — nothing to reconcile.");
    summary.durationMs = budget.elapsed();
    return summary;
  }

  const ctx = { db, apply: Boolean(apply), drivers, log: emit, budget, limits: merged, summary };
  summary.pass1 = await passVerify(ctx);
  summary.pass2 = await passOrphans(ctx);
  summary.pass3 = await passRetention(ctx);
  summary.durationMs = budget.elapsed();
  return summary;
}
