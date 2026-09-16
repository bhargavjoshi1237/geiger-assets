import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { throttle } from "@/lib/storage/throttle";
import { getBackend, recordBackendHealth } from "@/lib/storage/backends/store";
import { backendFromRecord } from "@/lib/storage/backends/registry";

// The data layer defaults to the browser client, which has no session here.
async function assetsSchema() {
  return (await createServerSupabase()).schema("assets");
}

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const client = await assetsSchema();
  const record = await getBackend(id, { includeSecrets: true, client });
  if (!record) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const access = await requireProjectAccess({ projectId: record.projectId, action: "write" });
  if (access.response) return access.response;

  // No "write" bucket exists in lib/storage/throttle.js (budgets are
  // upload/uploadUrl/commit/sign/deliver), so config writes use "commit",
  // the closest existing bucket for a metadata write.
  const limited = throttle("commit", access.userId);
  if (limited) return limited;

  const driver = backendFromRecord(record);
  if (!driver) return NextResponse.json({ ok: false, detail: "driver_unavailable" });

  const result = await driver.health();
  await recordBackendHealth(id, result, { client });
  return NextResponse.json({
    ok: result.ok,
    detail: result.detail,
    latencyMs: result.latencyMs,
    capabilities: driver.capabilities,
  });
}
