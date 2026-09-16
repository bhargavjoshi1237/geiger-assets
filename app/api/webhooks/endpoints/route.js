import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { listEndpoints, createEndpoint } from "@/lib/media/webhooks";

export const runtime = "nodejs";

export async function GET(request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const access = await requireProjectAccess({ projectId, action: "write" });
  if (access.response) return access.response;

  const endpoints = await listEndpoints(projectId);
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
  });
  if (!endpoint) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  return NextResponse.json({ endpoint }, { status: 201 });
}
