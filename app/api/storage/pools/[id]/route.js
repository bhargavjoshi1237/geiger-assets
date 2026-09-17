import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { throttle } from "@/lib/storage/throttle";
import {
  getPool,
  updatePool,
  softDeletePool,
  setPoolMembers,
} from "@/lib/storage/backends/store";

// The data layer defaults to the browser client, which has no session here.
async function assetsSchema() {
  return (await createServerSupabase()).schema("assets");
}

export const runtime = "nodejs";

const STRATEGIES = new Set(["failover", "spread", "mirror"]);

function isValidMembers(members) {
  if (!Array.isArray(members)) return false;
  return members.every(
    (member) =>
      member !== null &&
      typeof member === "object" &&
      !Array.isArray(member) &&
      Boolean(member.backendId),
  );
}

export async function GET(request, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const client = await assetsSchema();
  const pool = await getPool(id, { client });
  if (!pool) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const access = await requireProjectAccess({ projectId: pool.projectId, action: "read" });
  if (access.response) return access.response;

  const limited = throttle("deliver", access.userId);
  if (limited) return limited;

  return NextResponse.json({ pool });
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
  const current = await getPool(id, { client });
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const access = await requireProjectAccess({ projectId: current.projectId, action: "write" });
  if (access.response) return access.response;

  // No "write" bucket exists in lib/storage/throttle.js (budgets are
  // upload/uploadUrl/commit/sign/deliver), so config writes use "commit",
  // the closest existing bucket for a metadata write.
  const limited = throttle("commit", access.userId);
  if (limited) return limited;

  if (body?.strategy !== undefined && !STRATEGIES.has(body.strategy)) {
    return NextResponse.json({ error: "bad_strategy" }, { status: 400 });
  }
  let name;
  if (body?.name !== undefined) {
    name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const patch = {};
  if (name !== undefined) patch.name = name;
  if (body?.strategy !== undefined) patch.strategy = body.strategy;
  if (body?.enabled !== undefined) patch.enabled = body.enabled;

  const updated = await updatePool(id, patch, { client });
  if (!updated) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ pool: updated });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const client = await assetsSchema();
  const current = await getPool(id, { client });
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const access = await requireProjectAccess({ projectId: current.projectId, action: "write" });
  if (access.response) return access.response;

  // No "write" bucket exists in lib/storage/throttle.js, so config writes use
  // "commit", the closest existing bucket for a metadata write.
  const limited = throttle("commit", access.userId);
  if (limited) return limited;

  const ok = await softDeletePool(id, { client });
  if (!ok) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const client = await assetsSchema();
  const current = await getPool(id, { client });
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const access = await requireProjectAccess({ projectId: current.projectId, action: "write" });
  if (access.response) return access.response;

  // No "write" bucket exists in lib/storage/throttle.js, so config writes use
  // "commit", the closest existing bucket for a metadata write.
  const limited = throttle("commit", access.userId);
  if (limited) return limited;

  if (!isValidMembers(body?.members)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const updated = await setPoolMembers(id, body.members, { client });
  if (!updated) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ pool: updated });
}
