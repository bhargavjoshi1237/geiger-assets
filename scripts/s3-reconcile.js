require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { Client } = require("pg");

const APPLY = process.argv.includes("--apply");
const TMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SOFT_DELETE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

async function main() {
  const s3 = await import("../lib/s3/index.js");
  console.log(APPLY ? "s3:reconcile --apply (will mutate)" : "s3:reconcile --dry-run (no changes; pass --apply to act)");

  if (!s3.isS3Configured()) {
    console.error("S3 is not configured — nothing to reconcile.");
    process.exit(1);
  }
  const uri = process.env.STRING_URI;
  if (!uri) {
    console.error("ERROR: no STRING_URI in env — cannot read the assets schema.");
    process.exit(1);
  }

  const pg = new Client({ connectionString: uri, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  try {
    let missing = 0;
    const rows = (
      await pg.query(
        `select id, storage_key from assets.assets
         where storage_status = 'stored' and storage_key is not null`
      )
    ).rows;
    console.log(`pass 1: ${rows.length} stored row(s) to verify`);
    for (const row of rows) {
      const head = await s3.headObject(row.storage_key);
      if (!head) {
        missing += 1;
        console.log(`  missing bytes for asset ${row.id} (${row.storage_key})`);
        if (APPLY) {
          await pg.query(`update assets.assets set storage_status = 'missing' where id = $1`, [row.id]);
        }
      }
    }
    console.log(`pass 1: ${missing} row(s) ${APPLY ? "marked missing" : "would be marked missing"}`);

    let orphans = 0;
    let deleted = 0;
    let cursor = undefined;
    for (;;) {
      const page = await s3.listObjects("p/", { limit: 1000, cursor });
      if (!page) break;
      for (const obj of page.objects) {
        if (!obj.key.includes("/tmp/")) continue;
        const ageMs = obj.lastModified ? Date.now() - new Date(obj.lastModified).getTime() : 0;
        if (ageMs < TMP_MAX_AGE_MS) continue;
        const ref = await pg.query(
          `select 1 from assets.upload_jobs where storage_key = $1
           union select 1 from assets.assets where storage_key = $1 limit 1`,
          [obj.key]
        );
        if (ref.rowCount === 0) {
          orphans += 1;
          console.log(`  orphan staging object ${obj.key} (${Math.round(ageMs / 3600000)}h old)`);
          if (APPLY && (await s3.deleteObject(obj.key))) deleted += 1;
        }
      }
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    console.log(`pass 2: ${orphans} orphan(s) ${APPLY ? `(${deleted} deleted)` : "(none deleted in dry-run)"}`);

    const stale = (
      await pg.query(
        `select id, storage_key from assets.assets
         where deleted_at is not null and deleted_at < now() - make_interval(days => 30)
           and storage_key is not null`
      )
    ).rows;
    console.log(`pass 3: ${stale.length} soft-deleted row(s) past the 30-day retention window`);
    if (APPLY) {
      for (const row of stale) {
        if (await s3.deleteObject(row.storage_key)) {
          await pg.query(`update assets.assets set storage_key = null where id = $1`, [row.id]);
          console.log(`  swept bytes for ${row.id}`);
        }
      }
    }
    void SOFT_DELETE_RETENTION_MS;
  } finally {
    await pg.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
});
