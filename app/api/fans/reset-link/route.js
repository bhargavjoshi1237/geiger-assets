import { NextResponse } from "next/server";

import { requireProjectAccess } from "@/lib/storage/auth";
import { creatorDb } from "@/lib/creator/server";
import { issueResetToken } from "@/lib/creator/fan_hub";

export const runtime = "nodejs";

/**
 * Staff issue a one-time password reset link for a member's fan account (valid
 * 24h) and pass it on themselves — there's no email sending yet. Requires a
 * workspace session with access to the member's project.
 */
export async function POST(request) {
  let memberId = "";
  try {
    ({ memberId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const db = await creatorDb();
  const { data: member } = await db.from("members").select("id, project_id, fan_account_id").eq("id", memberId).maybeSingle();
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const access = await requireProjectAccess({ projectId: member.project_id, action: "read" });
  if (access.response) return access.response;
  if (!member.fan_account_id) {
    return NextResponse.json({ error: "This member hasn't created a fan account yet." }, { status: 409 });
  }

  const token = await issueResetToken(db, member.fan_account_id, access.userId);
  if (!token) return NextResponse.json({ error: "Couldn't create the link." }, { status: 500 });
  const origin = new URL(request.url).origin;
  return NextResponse.json({ url: `${origin}/fan/reset?token=${token}` });
}
