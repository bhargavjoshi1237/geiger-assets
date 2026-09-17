import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { listBackends } from "@/lib/storage/backends/store";
import { reconcile } from "@/lib/storage/reconcile";

// Scheduled storage reconciliation.
//
// Runs the same three passes as `npm run s3:reconcile`; only the transport
// differs — the CLI reaches Postgres over STRING_URI, this route reaches it
// through Supabase under the request. The pass logic itself lives in
// lib/storage/reconcile.js and is not duplicated here.
//
// Two safety properties this route is built around:
//
//   1. It is never reachable unauthenticated. The endpoint deletes objects, so
//      a missing CRON_SECRET makes it refuse to run rather than quietly run
//      open. There is no unauthenticated mode to fall back to.
//   2. It is dry-run unless the *environment* opts in. The schedule is checked
//      into vercel.json, so gating the destructive mode on a query param would
//      make "start deleting for real" a one-line commit; RECONCILE_APPLY is set
//      per-environment in the Vercel dashboard instead, which also means a
//      leaked or replayed cron URL still cannot escalate to a delete.
//      `?dry=1` can force a dry run even when apply is enabled — the override
//      only ever downgrades.

// NOTE: next.config.mjs sets basePath "/assets" in production, which prefixes
// API routes too -- so the schedule in vercel.json must point at
// /assets/api/cron/reconcile, not /api/cron/reconcile. The latter 404s on a
// deployed build, and a cron that 404s fails silently.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel's default function timeout. The time budget below sits under it.
export const maxDuration = 300;

// Leaves ~60s of headroom: the budget is only checked between units of work, so
// the last unit started still has to finish (and the response still has to be
// written) inside the platform's limit.
const TIME_BUDGET_MS = 240_000;

// Per-invocation caps, so a large deployment makes steady progress across runs
// instead of timing out on the same first pass every night.
const LIMITS = Object.freeze({
  verifyRows: 2000,
  tmpObjects: 5000,
  sweepRows: 200,
  timeBudgetMs: TIME_BUDGET_MS,
});

function secretsMatch(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  // timingSafeEqual throws on a length mismatch, which would itself be a
  // length oracle — compare lengths first and keep the comparison constant.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

// The data layer defaults to the browser client, which has no session here.
async function assetsSchema() {
  return (await createServerSupabase()).schema("assets");
}

// Supabase-backed db adapter, matching the contract in lib/storage/reconcile.js:
// every method returns data, null, or false and never throws.
function createSupabaseAdapter(sb) {
  const fail = (where, e) => {
    console.error(`[reconcile.sb.${where}]`, e?.message || e);
    return null;
  };

  // Backend-agnostic on purpose — see the pass-2 comment in
  // lib/storage/reconcile.js. A key referenced by any row anywhere is never an
  // orphan, on any backend.
  async function keysIn(table, keys) {
    const { data, error } = await sb.from(table).select("storage_key").in("storage_key", keys);
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data || []).map((r) => r.storage_key).filter(Boolean);
  }

  return {
    async listBackendRecords() {
      // No projectId filter: reconciliation is suite-wide, and a row can be
      // pinned to a project-scoped backend.
      return listBackends({ includeSecrets: true, client: sb });
    },

    async listStoredAssets({ limit } = {}) {
      try {
        const { data, error } = await sb
          .from("assets")
          .select("id, storage_key, storage_backend")
          .eq("storage_status", "stored")
          .not("storage_key", "is", null)
          .order("created_at", { ascending: true })
          .limit(Number(limit) || LIMITS.verifyRows);
        if (error) return fail("listStoredAssets", error);
        return (data || []).map((r) => ({
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
        const { error } = await sb.from("assets").update({ storage_status: "missing" }).eq("id", id);
        if (error) {
          fail("markAssetMissing", error);
          return false;
        }
        return true;
      } catch (e) {
        fail("markAssetMissing", e);
        return false;
      }
    },

    async findReferencedKeys(keys) {
      if (!Array.isArray(keys) || keys.length === 0) return [];
      try {
        const found = await Promise.all([
          keysIn("upload_jobs", keys),
          keysIn("assets", keys),
          keysIn("asset_versions", keys),
        ]);
        return [...new Set(found.flat())];
      } catch (e) {
        return fail("findReferencedKeys", e);
      }
    },

    async listStaleDeleted({ retentionDays = 30, limit } = {}) {
      try {
        const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
        const { data, error } = await sb
          .from("assets")
          .select("id, project_id, storage_key, storage_backend")
          .not("deleted_at", "is", null)
          .lt("deleted_at", cutoff)
          .order("deleted_at", { ascending: true })
          .limit(Number(limit) || LIMITS.sweepRows);
        if (error) return fail("listStaleDeleted", error);

        const rows = data || [];
        if (rows.length === 0) return [];

        // Every version of a swept asset has to go, not just the current one,
        // and each version carries its own recorded backend.
        const { data: versions, error: vErr } = await sb
          .from("asset_versions")
          .select("asset_id, storage_key, storage_backend")
          .in("asset_id", rows.map((r) => r.id))
          .not("storage_key", "is", null);
        if (vErr) return fail("listStaleDeleted.versions", vErr);

        const byAsset = new Map();
        for (const v of versions || []) {
          const list = byAsset.get(v.asset_id) || [];
          list.push({ storageKey: v.storage_key, storageBackend: v.storage_backend ?? null });
          byAsset.set(v.asset_id, list);
        }

        return rows.map((r) => ({
          id: r.id,
          projectId: r.project_id ?? null,
          storageKey: r.storage_key ?? null,
          storageBackend: r.storage_backend ?? null,
          versions: byAsset.get(r.id) || [],
        }));
      } catch (e) {
        return fail("listStaleDeleted", e);
      }
    },

    async clearAssetKeys(id) {
      try {
        const a = await sb.from("assets").update({ storage_key: null }).eq("id", id);
        if (a.error) {
          fail("clearAssetKeys", a.error);
          return false;
        }
        const v = await sb.from("asset_versions").update({ storage_key: null }).eq("asset_id", id);
        if (v.error) {
          fail("clearAssetKeys.versions", v.error);
          return false;
        }
        return true;
      } catch (e) {
        fail("clearAssetKeys", e);
        return false;
      }
    },
  };
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Refuse rather than downgrade. An endpoint that deletes objects must not
    // become reachable just because someone forgot to set an env var.
    console.error("[cron.reconcile] CRON_SECRET is not set — refusing to run");
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }

  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !secretsMatch(token, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const forceDry = new URL(request.url).searchParams.get("dry") === "1";
  const apply = process.env.RECONCILE_APPLY === "true" && !forceDry;

  const summary = await reconcile({
    db: createSupabaseAdapter(await assetsSchema()),
    apply,
    limits: LIMITS,
    // Function logs are the only place a scheduled run is observable, so the
    // same lines the CLI prints go to stdout here too.
    log: (line) => console.log("[cron.reconcile]", line),
  });

  return NextResponse.json(summary);
}
