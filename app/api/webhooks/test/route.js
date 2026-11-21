import { NextResponse } from "next/server";
import { storageAuth, requireProjectAccess } from "@/lib/storage/auth";
import { throttle } from "@/lib/storage/throttle";
import { sendTestWebhook } from "@/lib/webhooks/deliver";

export const runtime = "nodejs";

// POST { endpointId, event } — a real signed delivery of a sample payload to
// one endpoint, recorded in the delivery log and never retried.
export async function POST(request) {
  const auth = await storageAuth();
  if (auth.response) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const endpointId = String(body?.endpointId || "");
  const event = String(body?.event || "");
  if (!endpointId || !event) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const db = auth.supabase.schema("assets");
  const { data: endpoint, error } = await db
    .from("webhook_endpoints")
    .select("*")
    .eq("id", endpointId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) console.error("[webhooks.test.endpoint]", error.message);
  if (!endpoint?.project_id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const access = await requireProjectAccess({ projectId: endpoint.project_id, action: "platform" });
  if (access.response) return access.response;

  const limited = throttle("webhookTest", access.userId);
  if (limited) return limited;

  const delivery = await sendTestWebhook(access.supabase.schema("assets"), endpoint, {
    event,
    data: { id: "00000000-0000-4000-8000-000000000000", projectId: endpoint.project_id },
  });
  if (!delivery) return NextResponse.json({ error: "record_failed" }, { status: 500 });
  return NextResponse.json({ delivery });
}
