import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { throttle } from "@/lib/storage/throttle";
import { getBackend, updateBackend, softDeleteBackend } from "@/lib/storage/backends/store";

// The data layer defaults to the browser client, which has no session here.
async function assetsSchema() {
  return (await createServerSupabase()).schema("assets");
}

export const runtime = "nodejs";

const KINDS = new Set(["s3", "rest"]);

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const client = await assetsSchema();
  const backend = await getBackend(id, { client });
  if (!backend) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const access = await requireProjectAccess({ projectId: backend.projectId, action: "read" });
  if (access.response) return access.response;

  const limited = throttle("deliver", access.userId);
  if (limited) return limited;

  return NextResponse.json({ backend });
}

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
  const current = await getBackend(id, { client });
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const access = await requireProjectAccess({ projectId: current.projectId, action: "write" });
  if (access.response) return access.response;

  // No "write" bucket exists in lib/storage/throttle.js (budgets are
  // upload/uploadUrl/commit/sign/deliver), so config writes use "commit",
  // the closest existing bucket for a metadata write.
  const limited = throttle("commit", access.userId);
  if (limited) return limited;

  if (body?.kind !== undefined && !KINDS.has(body.kind)) {
    return NextResponse.json({ error: "unsupported_kind" }, { status: 400 });
  }
  if (body?.config !== undefined && !isPlainObject(body.config)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  let label;
  if (body?.label !== undefined) {
    label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const patch = {};
  if (body?.kind !== undefined) patch.kind = body.kind;
  if (label !== undefined) patch.label = label;
  if (body?.enabled !== undefined) patch.enabled = body.enabled;
  if (body?.config !== undefined) patch.config = body.config;
  if (body?.maxUploadBytes !== undefined) patch.maxUploadBytes = body.maxUploadBytes;

  const updated = await updateBackend(id, patch, { client });
  if (!updated) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ backend: updated });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const client = await assetsSchema();
  const current = await getBackend(id, { client });
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const access = await requireProjectAccess({ projectId: current.projectId, action: "write" });
  if (access.response) return access.response;

  // No "write" bucket exists in lib/storage/throttle.js, so config writes use
  // "commit", the closest existing bucket for a metadata write.
  const limited = throttle("commit", access.userId);
  if (limited) return limited;

  const ok = await softDeleteBackend(id, { client });
  if (!ok) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
