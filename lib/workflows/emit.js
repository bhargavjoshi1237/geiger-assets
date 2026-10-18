"use client";

// Browser half of the workflow engine: data-layer modules call
// emitWorkflowEvent() after a lifecycle write (approve, archive, share…), the
// same best-effort way they call logActivity(). The event is posted to
// /api/workflows/dispatch, which runs matching workflows server-side. In the
// landing playground the engine runs locally against the in-memory DB.
//
// Fire-and-forget: never throws, never blocks the write that produced it.

import { isPlaygroundActive } from "@/lib/playground/mode";
import { assetsClient, isUuid } from "@/supabase/components/assets-client";
import { runWorkflowEvent } from "./engine";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function emitWorkflowEvent(event) {
  if (!event?.type || !isUuid(event.projectId)) return;
  try {
    if (isPlaygroundActive()) {
      runWorkflowEvent(assetsClient(), event, { allowNetwork: false });
      return;
    }
    fetch(`${BASE}/api/workflows/dispatch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch((e) => console.error("[workflows.emit]", e));
  } catch (e) {
    console.error("[workflows.emit]", e);
  }
}

// Asset status → the trigger it starts when an asset moves into it.
const STATUS_EVENTS = {
  approved: "asset.approved",
  archived: "asset.archived",
  review: "review.requested",
};

/**
 * Emit the triggers implied by an asset edit — a status change or switching
 * CDN delivery on. `before` is the asset as it was; `after` as saved.
 */
export function emitAssetTransitions(before, after) {
  if (!after?.id || !after.projectId) return;
  const base = { projectId: after.projectId, assetId: after.id };
  const type = STATUS_EVENTS[after.status];
  if (type && before?.status !== after.status) emitWorkflowEvent({ ...base, type });
  if (after.cdnEnabled && before && !before.cdnEnabled) {
    emitWorkflowEvent({ ...base, type: "asset.published", context: { channel: "CDN" } });
  }
}
