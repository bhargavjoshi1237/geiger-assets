if (typeof window !== "undefined") {
  throw new Error("lib/storage/meter is server-only.");
}

import { createServerSupabase } from "@/lib/supabase/server";
import { recordDelivery } from "@/lib/media/usage";

// Delivery metering for route handlers.
//
// Always fire-and-forget: the bytes are already on their way to the client by
// the time this runs, so a metering failure must never turn a good response
// into an error. The rollup this feeds is repairable with recomputeProjectUsage.
export async function meterVariantDelivery(row, variant, response) {
  if (!row?.project_id) return;
  // Bill what actually crossed the wire, not the object's nominal size: a 206
  // serves a slice and a 304 serves nothing, so a scrubbing video player would
  // otherwise be charged for the whole file on every seek.
  const bytesServed = Number(response?.headers?.get?.("content-length")) || 0;
  if (bytesServed <= 0) return;
  try {
    const sb = await createServerSupabase();
    await recordDelivery(
      { projectId: row.project_id, assetId: row.id, variant, bytesServed },
      { client: sb.schema("assets") },
    );
  } catch (e) {
    console.error("[storage.meter]", e?.message || e);
  }
}
