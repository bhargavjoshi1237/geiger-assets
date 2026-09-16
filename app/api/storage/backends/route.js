import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { throttle } from "@/lib/storage/throttle";
import { listBackends, createBackend } from "@/lib/storage/backends/store";

// The data layer defaults to the browser client, which has no session here.
async function assetsSchema() {
  return (await createServerSupabase()).schema("assets");
}

export const runtime = "nodejs";

const KINDS = new Set(["s3", "rest"]);

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const access = await requireProjectAccess({ projectId, action: "read" });
  if (access.response) return access.response;

  const limited = throttle("deliver", access.userId);
  if (limited) return limited;

  const backends = await listBackends({ projectId, client: await assetsSchema() });
  if (!backends) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ backends });
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

  if (!KINDS.has(body?.kind)) {
    return NextResponse.json({ error: "unsupported_kind" }, { status: 400 });
  }
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!label) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (body?.config !== undefined && !isPlainObject(body.config)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const backend = await createBackend(
    {
      projectId,
      kind: body.kind,
      label,
      enabled: body.enabled,
      config: body.config,
      maxUploadBytes: body.maxUploadBytes,
    },
    { client: await assetsSchema() },
  );
  if (!backend) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ backend }, { status: 201 });
}
