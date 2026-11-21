import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { storageAuth } from "@/lib/storage/auth";
import { resumeDueRuns, scanExpiringLicenses } from "@/lib/workflows/engine";
import { retryDueWebhooks } from "@/lib/webhooks/deliver";

export const runtime = "nodejs";

// Time-based work: resumes workflow runs parked on "Wait / delay", fires
// `license.expiring`, and retries webhook deliveries that are due. Meant for a scheduler (e.g. a Vercel cron) calling with
// `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set, any signed-in
// user may trigger it.
async function authorize(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization") || "";
    if (header !== `Bearer ${secret}`) {
      return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
    }
    return { supabase: await createServerSupabase() };
  }
  return storageAuth();
}

async function tick(request) {
  const auth = await authorize(request);
  if (auth.response) return auth.response;
  const db = auth.supabase.schema("assets");

  const resumed = await resumeDueRuns(db, { limit: 50 });
  const licenses = await scanExpiringLicenses(db);
  const webhooks = await retryDueWebhooks(db, { limit: 50 });
  return NextResponse.json({ resumed: resumed.length, licenseRuns: licenses.length, webhookRetries: webhooks.length });
}

export const GET = tick;
export const POST = tick;
