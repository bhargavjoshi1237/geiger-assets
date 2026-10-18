// Project governance records for the in-memory workspace. They exercise the
// same snake_case data layer as the connected application.

import { personId } from "../cast";
import { PROJECT_ID, base, daysAgo, sid } from "./helpers";

export function governanceSeed() {
  const policies = [
    { name: "Campaign archive", description: "Archive older campaign images after the active season.", asset_type: "image", age_days: 180, action: "archive" },
    { name: "Expired document cleanup", description: "Review old PDFs before moving them to trash.", asset_type: "pdf", age_days: 90, action: "trash" },
    { name: "Video masters", description: "Keep source video available for one year before archiving.", asset_type: "video", age_days: 365, action: "archive" },
  ].map((policy, index) => ({
    ...base("retention_policy", index + 1, { created: 30 - index * 6 }),
    ...policy,
    created_by: personId(1),
  }));

  const holds = [
    { name: "Usage rights review", matter_reference: "MAT-2026-014", reason: "Preserve original releases and approved brand guidelines during the usage review.", custodian: "Legal operations", status: "active", released_at: null },
    { name: "Holiday campaign request", matter_reference: "MAT-2025-088", reason: "Retain all holiday campaign files while the request was open.", custodian: "Brand team", status: "released", released_at: daysAgo(12) },
  ].map((hold, index) => ({
    ...base("legal_hold", index + 1, { created: index ? 180 : 21 }),
    ...hold,
    created_by: personId(1),
    released_by: index ? personId(1) : null,
  }));

  const links = [
    { hold_id: holds[0].id, asset_id: sid("asset", 25), added_at: daysAgo(20) },
    { hold_id: holds[0].id, asset_id: sid("asset", 28), added_at: daysAgo(19) },
    { hold_id: holds[1].id, asset_id: sid("asset", 9), added_at: daysAgo(175) },
  ].map((link) => ({ ...link, project_id: PROJECT_ID, added_by: personId(1) }));

  const events = [
    { hold_id: holds[0].id, event_type: "created", asset_id: null, created_at: daysAgo(21) },
    { hold_id: holds[0].id, event_type: "asset_added", asset_id: sid("asset", 25), created_at: daysAgo(20) },
    { hold_id: holds[0].id, event_type: "asset_added", asset_id: sid("asset", 28), created_at: daysAgo(19) },
    { hold_id: holds[1].id, event_type: "created", asset_id: null, created_at: daysAgo(180) },
    { hold_id: holds[1].id, event_type: "asset_added", asset_id: sid("asset", 9), created_at: daysAgo(175) },
    { hold_id: holds[1].id, event_type: "released", asset_id: null, created_at: daysAgo(12) },
  ].map((event, index) => ({
    id: sid("legal_hold_event", index + 1),
    project_id: PROJECT_ID,
    actor_id: personId(1),
    ...event,
  }));

  return {
    retention_policies: policies,
    legal_holds: holds,
    legal_hold_assets: links,
    legal_hold_events: events,
  };
}
