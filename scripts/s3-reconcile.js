require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

// The `@/` alias has to resolve before anything under lib/ is imported.
require("node:module").register("./alias-loader.mjs", require("node:url").pathToFileURL(__filename));

const { Client } = require("pg");

// Manual storage reconciler.
//
// The three passes live in lib/storage/reconcile.js so the scheduled route
// (app/api/cron/reconcile) runs exactly the same logic. This file only supplies
// the pg-over-STRING_URI half of the db adapter, because a CLI run has no
// Supabase session to borrow.
//
// Dry-run by default; --apply is the only thing that mutates.

const APPLY = process.argv.includes("--apply");

// A staging key is p/<projectId>/tmp/<uploadJobId>/<filename> with a UUID job
// id, so a key is globally unique across every backend — which is what lets the
// orphan check in the shared module be backend-agnostic. asset_versions is
// included here purely as extra conservatism: it should only ever hold v/ keys,
// but a row that points at a key is a row, and not deleting is always the safe
// side of this call.
const REFERENCE_SQL = `
  select storage_key from assets.upload_jobs   where storage_key = any($1::text[])
  union
  select storage_key from assets.assets        where storage_key = any($1::text[])
  union
  select storage_key from assets.asset_versions where storage_key = any($1::text[])
`;

// pg-backed db adapter. Mirrors the contract documented in
// lib/storage/reconcile.js: every method returns data, null, or false — it
// never throws, so a transient query failure degrades one pass instead of
// taking the whole run down.
function createPgAdapter(pg, normalizeBackend) {
  const fail = (where, e) => {
    console.error(`[reconcile.pg.${where}]`, e?.message || e);
    return null;
  };
  return {
    async listBackendRecords() {
      try {
        const { rows } = await pg.query(
          `select * from assets.storage_backends where deleted_at is null order by created_at asc`,
        );
        return rows.map((row) => normalizeBackend(row, { includeSecrets: true })).filter(Boolean);
      } catch (e) {
        return fail("listBackendRecords", e);
      }
    },

    async listStoredAssets({ limit } = {}) {
      try {
        const max = Number(limit) || 0;
        const { rows } = await pg.query(
          `select id, storage_key, storage_backend
             from assets.assets
            where storage_status = 'stored' and storage_key is not null
            order by created_at asc
            ${max > 0 ? "limit $1" : ""}`,
          max > 0 ? [max] : [],
        );
        return rows.map((r) => ({
          id: r.id,
          storageKey: r.storage_key,
          storageBackend: r.storage_backend ?? null,
        }));
      } catch (e) {
        return fail("listStoredAssets", e);
      }
    },

    async markAssetMissing(id) {
      try {
        const res = await pg.query(
          `update assets.assets set storage_status = 'missing' where id = $1`,
          [id],
        );
        return res.rowCount > 0;
      } catch (e) {
        fail("markAssetMissing", e);
        return false;
      }
    },

    async findReferencedKeys(keys) {
      if (!Array.isArray(keys) || keys.length === 0) return [];
      try {
        const { rows } = await pg.query(REFERENCE_SQL, [keys]);
        return rows.map((r) => r.storage_key).filter(Boolean);
      } catch (e) {
        return fail("findReferencedKeys", e);
      }
    },

    async listStaleDeleted({ retentionDays = 30, limit } = {}) {
      try {
        const max = Number(limit) || 0;
        const params = [retentionDays];
        if (max > 0) params.push(max);
        const { rows } = await pg.query(
          `select a.id,
                  a.project_id,
                  a.storage_key,
                  a.storage_backend,
                  coalesce(
                    json_agg(
                      json_build_object(
                        'storageKey', v.storage_key,
                        'storageBackend', v.storage_backend
                      )
                    ) filter (where v.storage_key is not null),
                    '[]'::json
                  ) as versions
             from assets.assets a
             left join assets.asset_versions v on v.asset_id = a.id
            where a.deleted_at is not null
              and a.deleted_at < now() - make_interval(days => $1)
            group by a.id, a.project_id, a.storage_key, a.storage_backend
            order by a.deleted_at asc
            ${max > 0 ? "limit $2" : ""}`,
          params,
        );
        return rows.map((r) => ({
          id: r.id,
          projectId: r.project_id ?? null,
          storageKey: r.storage_key ?? null,
          storageBackend: r.storage_backend ?? null,
          versions: Array.isArray(r.versions) ? r.versions : [],
        }));
      } catch (e) {
        return fail("listStaleDeleted", e);
      }
    },

    async clearAssetKeys(id) {
      try {
        await pg.query(`update assets.assets set storage_key = null where id = $1`, [id]);
        await pg.query(`update assets.asset_versions set storage_key = null where asset_id = $1`, [id]);
        return true;
      } catch (e) {
        fail("clearAssetKeys", e);
        return false;
      }
    },
  };
}

async function main() {
  const { reconcile } = await import("../lib/storage/reconcile.js");
  const { normalizeBackend } = await import("../lib/storage/backends/store.js");

  console.log(
    APPLY
      ? "s3:reconcile --apply (will mutate)"
      : "s3:reconcile --dry-run (no changes; pass --apply to act)",
  );

  const uri = process.env.STRING_URI;
  if (!uri) {
    console.error("ERROR: no STRING_URI in env — cannot read the assets schema.");
    process.exit(1);
  }

  const pg = new Client({ connectionString: uri, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  let summary;
  try {
    summary = await reconcile({
      db: createPgAdapter(pg, normalizeBackend),
      apply: APPLY,
      // A manual run is unbounded on purpose: the operator is watching it, and
      // the caps exist for the scheduled route's function timeout, not here.
      log: (line) => console.log(line),
    });
  } finally {
    await pg.end();
  }

  console.log(
    `backends: ${summary.backends.map((b) => b.label).join(", ") || "none"} ` +
      `(${Math.round(summary.durationMs / 1000)}s)`,
  );
  if (summary.errors.length) {
    console.error(`errors: ${summary.errors.join(", ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
});
