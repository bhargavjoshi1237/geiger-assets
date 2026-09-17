import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { getEndpoint, updateEndpoint, softDeleteEndpoint } from "@/lib/media/webhooks";
import { createServerSupabase } from "@/lib/supabase/server";

// The data layer defaults to the browser client, which has no session here.
async function assetsSchema() {
  return (await createServerSupabase()).schema("assets");
}

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const client = await assetsSchema();
  const current = await getEndpoint(id, { client });
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const access = await requireProjectAccess({ projectId: current.projectId, action: "write" });
  if (access.response) return access.response;

  const patch = {};
  if (body.url !== undefined) patch.url = body.url;
  if (body.events !== undefined) patch.events = body.events;
  if (body.active !== undefined) patch.active = body.active;
  const updated = await updateEndpoint(id, patch, { client });
  if (!updated) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  return NextResponse.json({ endpoint: updated });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const client = await assetsSchema();
  const current = await getEndpoint(id, { client });
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const access = await requireProjectAccess({ projectId: current.projectId, action: "write" });
  if (access.response) return access.response;

  const ok = await softDeleteEndpoint(id, { client });
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
