/**
 * Migration runner — applies supabase/sqls/*.sql (filename order) against the
 * direct Postgres connection in STRING_URI.
 *
 *   npm run db:push                 apply every supabase/sqls/*.sql
 *   npm run db:push -- --clean      drop THIS app's tables first, then apply
 *   npm run db:push -- "postgres://..."   use an inline connection string
 *
 * The Supabase project is shared across the whole Geiger suite, so this runner
 * only ever touches Geiger Assets' own `assets` schema. `--clean` drops only the
 * tables in OWNED_TABLES — never another product's schema, never `public`.
 *
 * Each .sql file is expected to be idempotent (create schema/table/index "if not
 * exists", "create or replace function", "drop policy if exists" before create),
 * so the whole file is executed in a single implicit transaction; a re-run is a
 * no-op and a failure rolls the file back cleanly.
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const SQL_DIR = path.join(__dirname, "..", "supabase", "sqls");

// Owned tables, child-first so a CASCADE-free drop order also works.
const OWNED_TABLES = [
  "assets.asset_versions",
  "assets.asset_relationships",
  "assets.assets",
];

// Prefer an inline connection string (first non-flag arg), else STRING_URI.
const inlineUri = process.argv.slice(2).find((a) => !a.startsWith("--"));
const STRING_URI = inlineUri || process.env.STRING_URI;
const CLEAN = process.argv.includes("--clean");

function sqlFiles() {
  if (!fs.existsSync(SQL_DIR)) return [];
  return fs
    .readdirSync(SQL_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(SQL_DIR, f));
}

async function run() {
  if (!STRING_URI) {
    console.error(
      "ERROR: no connection string. Set STRING_URI in .env or pass one inline:\n" +
        '  npm run db:push -- "postgres://..."',
    );
    process.exit(1);
  }

  const files = sqlFiles();
  if (files.length === 0) {
    console.log(`No .sql files in ${SQL_DIR} — nothing to do.`);
    return;
  }

  // Supabase's pooler presents a cert that doesn't verify against system roots;
  // the connection is still TLS-encrypted.
  const client = new Client({
    connectionString: STRING_URI,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Connected.\n");

    if (CLEAN) {
      console.log("--clean: dropping Geiger Assets tables…");
      for (const table of OWNED_TABLES) {
        await client.query(`drop table if exists ${table} cascade;`);
        console.log(`  dropped ${table}`);
      }
      console.log("");
    }

    for (const file of files) {
      const name = path.basename(file);
      const sql = fs.readFileSync(file, "utf-8");
      process.stdout.write(`applying ${name} … `);
      try {
        await client.query(sql);
        console.log("OK");
      } catch (err) {
        console.log("FAILED");
        console.error(`\n${name}: ${err.message}\n`);
        process.exitCode = 1;
        return;
      }
    }

    console.log("\nDone.");
  } catch (err) {
    console.error("Fatal:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
