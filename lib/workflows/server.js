if (typeof window !== "undefined") {
  throw new Error("lib/workflows/server is server-only — use lib/workflows/emit on the browser.");
}

// Server-side entry points into the workflow engine. Events are run after the
// response is sent (next/server `after`), so an upload or a review decision
// never waits on — or fails because of — the automations it triggers.

import { after } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkStorageThreshold, runWorkflowEvent } from "./engine";

export async function workflowDb() {
  return (await createServerSupabase()).schema("assets");
}

function defer(job) {
  const run = () => job().catch((e) => console.error("[workflows.queue]", e));
  try {
    after(run);
  } catch {
    // Outside a request scope (scripts, tests) — run inline instead.
    run();
  }
}

/** Queue one event against the project's Active workflows. Never throws. */
export async function queueWorkflowEvent(event, db) {
  try {
    const client = db || (await workflowDb());
    defer(() => runWorkflowEvent(client, event));
  } catch (e) {
    console.error("[workflows.queue]", e);
  }
}

/** A new asset landed: fire `asset.uploaded`, then check the storage threshold. */
export async function queueUploadEvents({ projectId, assetId, sizeBytes }, db) {
  try {
    const client = db || (await workflowDb());
    defer(async () => {
      await runWorkflowEvent(client, { type: "asset.uploaded", projectId, assetId });
      await checkStorageThreshold(client, { projectId, assetId, addedBytes: sizeBytes });
    });
  } catch (e) {
    console.error("[workflows.queue]", e);
  }
}
