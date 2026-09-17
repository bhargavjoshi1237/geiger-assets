import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { throttle } from "@/lib/storage/throttle";
import { listPools, createPool } from "@/lib/storage/backends/store";

// The data layer defaults to the browser client, which has no session here.
async function assetsSchema() {
  return (await createServerSupabase()).schema("assets");
}

export const runtime = "nodejs";

const STRATEGIES = new Set(["failover", "spread", "mirror"]);

export async function GET(request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const access = await requireProjectAccess({ projectId, action: "read" });
  if (access.response) return access.response;

  const limited = throttle("deliver", access.userId);
  if (limited) return limited;

  const pools = await listPools({ projectId, client: await assetsSchema() });
  if (!pools) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ pools });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const projectId = body?.projectId;
  if (!projectId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const access = await requireProjectAccess({ projectId, action: "write" });
  if (access.response) return access.response;

  // No "write" bucket exists in lib/storage/throttle.js (budgets are
  // upload/uploadUrl/commit/sign/deliver), so config writes use "commit",
  // the closest existing bucket for a metadata write.
  const limited = throttle("commit", access.userId);
  if (limited) return limited;

  if (!STRATEGIES.has(body?.strategy)) {
    return NextResponse.json({ error: "bad_strategy" }, { status: 400 });
  }
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const pool = await createPool(
    {
      projectId,
      name,
      strategy: body.strategy,
      enabled: body.enabled,
      members: body.members,
    },
    { client: await assetsSchema() },
  );
  if (!pool) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ pool }, { status: 201 });
}
