import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { listEndpoints, createEndpoint } from "@/lib/media/webhooks";
import { createServerSupabase } from "@/lib/supabase/server";

// The data layer defaults to the browser client, which has no session here.
async function assetsSchema() {
  return (await createServerSupabase()).schema("assets");
}

export const runtime = "nodejs";

export async function GET(request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const access = await requireProjectAccess({ projectId, action: "write" });
  if (access.response) return access.response;

  const endpoints = await listEndpoints(projectId, { client: await assetsSchema() });
  if (!endpoints) return NextResponse.json({ error: "store_failed" }, { status: 500 });
  return NextResponse.json({ endpoints });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const projectId = body?.projectId;
  if (!projectId || !body?.url || !body?.events) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const access = await requireProjectAccess({ projectId, action: "write" });
  if (access.response) return access.response;

  const endpoint = await createEndpoint({
    projectId,
    url: body.url,
    events: body.events,
    active: body.active,
    createdBy: access.userId,
  }, { client: await assetsSchema() });
  if (!endpoint) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  return NextResponse.json({ endpoint }, { status: 201 });
}
