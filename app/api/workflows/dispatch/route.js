import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { resumeDueRuns, runWorkflowEvent } from "@/lib/workflows/engine";

export const runtime = "nodejs";

// Lifecycle events the browser may report. `asset.uploaded` is only accepted
// as a collection landing (`collectionOnly`) — real uploads fire server-side
// from the storage commit, so a client can't double-fire them.
const CLIENT_EVENTS = new Set([
  "asset.uploaded",
  "review.requested",
  "asset.approved",
  "asset.rejected",
  "asset.archived",
  "asset.published",
  "collection.shared",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => UUID_RE.test(String(v ?? ""));

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { type, projectId, assetId, assetIds, collectionId, collectionOnly, context } = body ?? {};
  if (!CLIENT_EVENTS.has(type) || !isUuid(projectId)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (type === "asset.uploaded" && !(collectionOnly && isUuid(collectionId))) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const access = await requireProjectAccess({ projectId, action: "read" });
  if (access.response) return access.response;
  const db = access.supabase.schema("assets");

  const runs = await runWorkflowEvent(db, {
    type,
    projectId,
    assetId: isUuid(assetId) ? assetId : null,
    assetIds: Array.isArray(assetIds) ? assetIds.filter(isUuid).slice(0, 200) : [],
    collectionId: isUuid(collectionId) ? collectionId : null,
    collectionOnly: Boolean(collectionOnly),
    context: context && typeof context === "object" && !Array.isArray(context) ? context : {},
  });
  // Opportunistically continue this project's runs parked on a wait step.
  const resumed = await resumeDueRuns(db, { projectId });

  return NextResponse.json({ runs, resumed });
}
