// Seed integrity: the playground only convinces if its data hangs together.
// Run from the app root:
//   node --import ./lib/playground/__tests__/register.mjs --test lib/playground/__tests__/seed.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

import { getPlaygroundDb } from "../db.js";
import { PLAYGROUND_PROJECT } from "../mode.js";

// EDIT PER APP: tables every seeded screen reads; each must have rows.
const REQUIRED_TABLES = [
  // library
  "assets", "folders", "collections", "collection_assets", "asset_versions", "asset_relationships",
  "duplicate_groups", "duplicate_members", "asset_requests", "upload_jobs", "upload_portals", "upload_submissions",
  // collaboration
  "users", "roles", "role_grants", "team_invitations", "share_links", "approval_pipelines",
  "approval_reviews", "approval_review_items", "approval_decisions", "comments", "activity_events",
  // licensing
  "rights_holders", "rights_records", "licensees", "license_templates", "license_price_rules", "license_quotes",
  "licenses", "license_items", "license_renewals", "royalty_rules", "royalty_statements", "royalty_lines",
  // galleries
  "galleries", "gallery_items", "gallery_domains", "gallery_visitors", "gallery_favorites",
  "gallery_download_requests", "gallery_events",
  // delivery & platform
  "delivery_profiles", "delivery_domains", "dynamic_links", "video_delivery", "embeds", "delivery_keys",
  "channels", "channel_runs", "delivery_daily", "delivery_events", "delivery_settings", "api_keys",
  "webhook_endpoints", "webhook_deliveries", "export_runs",
  // creator
  "membership_tiers", "members", "subscriptions", "ppv_posts", "paid_messages", "tips", "payouts", "promo_codes",
  "access_rules", "billing_invoices", "creator_profiles", "post_bundles", "post_comments",
  // workspace & governance
  "workflows", "workflow_runs", "project_settings", "retention_policies", "legal_holds", "legal_hold_assets",
  "legal_hold_events",
];

// EDIT PER APP: `<column>` -> table, for FK columns whose target isn't the
// plural of the column stem (owner_id -> profiles). `null` skips the column
// (it points outside the seed, e.g. an external provider id).
const FK_TARGETS = {
  actor_id: "users",
  author_id: "users",
  attachment_asset_id: "assets",
  avatar_asset_id: "assets",
  banner_asset_id: "assets",
  cover_asset_id: "assets",
  poster_asset_id: "assets",
  reference_asset_id: "assets",
  related_asset_id: "assets",
  endpoint_id: "webhook_endpoints",
  link_id: "dynamic_links",
  group_id: "duplicate_groups",
  hold_id: "legal_holds",
  pipeline_id: "approval_pipelines",
  portal_id: "upload_portals",
  review_id: "approval_reviews",
  post_id: "ppv_posts",
  tier_id: "membership_tiers",
  min_tier_id: "membership_tiers",
  statement_id: "royalty_statements",
  template_id: "license_templates",
  visitor_id: "gallery_visitors",
  // Self-references (folders, comments) and polymorphic or external ids.
  parent_id: null,
  subject_id: null,
  target_id: null,
  source_id: null,
  scope_id: null,
  batch_id: null,
  fan_account_id: null,
  stripe_price_id: null,
};

// Tables whose rows legitimately belong to no project (lookups, users, ...).
const PROJECTLESS_OK = true;

function plural(word) {
  if (/[^aeiou]y$/.test(word)) return word.replace(/y$/, "ies");
  if (/(s|x|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

const db = getPlaygroundDb();
const tableNames = db.tableNames();

test("required tables are seeded", () => {
  for (const name of REQUIRED_TABLES) {
    assert.ok(db.table(name).length > 0, `${name} has no rows`);
  }
});

test("ids are unique per table", () => {
  for (const name of tableNames) {
    const ids = db.table(name).map((r) => r.id).filter((id) => id != null);
    assert.equal(new Set(ids).size, ids.length, `duplicate ids in ${name}`);
  }
});

test("foreign keys resolve inside the seed", () => {
  const problems = [];
  for (const name of tableNames) {
    for (const row of db.table(name)) {
      for (const [column, value] of Object.entries(row)) {
        if (!column.endsWith("_id") || value == null || column === "project_id") continue;
        const target = column in FK_TARGETS
          ? FK_TARGETS[column]
          : [plural(column.replace(/_id$/, "")), column.replace(/_id$/, "")].find((t) => db.has(t));
        if (!target) continue;
        if (!db.table(target).some((r) => String(r.id) === String(value))) {
          problems.push(`${name}.${column}=${value} -> ${target} (row ${row.id ?? "?"})`);
        }
      }
    }
  }
  assert.deepEqual(problems.slice(0, 20), [], `${problems.length} dangling references`);
});

test("project-owned rows belong to the playground project", () => {
  for (const name of tableNames) {
    for (const row of db.table(name)) {
      if (!("project_id" in row)) continue;
      if (row.project_id == null && PROJECTLESS_OK) continue;
      assert.equal(row.project_id, PLAYGROUND_PROJECT.id, `${name} row ${row.id} has project_id ${row.project_id}`);
    }
  }
});

test("timestamps parse", () => {
  for (const name of tableNames) {
    for (const row of db.table(name)) {
      for (const [column, value] of Object.entries(row)) {
        if (!column.endsWith("_at") || value == null) continue;
        assert.ok(!Number.isNaN(Date.parse(value)), `${name}.${column} is not a date: ${value}`);
      }
    }
  }
});
