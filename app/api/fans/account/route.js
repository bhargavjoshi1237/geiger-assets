import { NextResponse } from "next/server";

import { creatorDb } from "@/lib/creator/server";
import { currentFan, hashPassword, openSession, verifyPassword } from "@/lib/creator/fan_auth";
import { consumeResetToken } from "@/lib/creator/fan_hub";

export const runtime = "nodejs";

const MIN_PASSWORD = 8;

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * The fan's own account. `action`:
 *   profile  { displayName }                 (signed in)
 *   password { current, next }               (signed in)
 *   reset    { token, next }                 one-time link from the creator; signs in
 * Changing or resetting the password signs out every other session.
 */
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return fail("Bad request");
  }
  const db = await creatorDb();
  const next = String(body.next || "");

  if (body.action === "reset") {
    if (next.length < MIN_PASSWORD) return fail(`Passwords are at least ${MIN_PASSWORD} characters.`);
    const fanId = await consumeResetToken(db, body.token);
    if (!fanId) return fail("This reset link is invalid or has expired — ask for a new one.", 410);
    await db.from("fan_accounts").update({ password_hash: await hashPassword(next) }).eq("id", fanId);
    await db.from("fan_sessions").delete().eq("fan_account_id", fanId);
    const cookie = await openSession(db, fanId, request.headers.get("user-agent"));
    const res = NextResponse.json({ ok: true });
    if (cookie) res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  }

  const fan = await currentFan(db);
  if (!fan) return fail("Sign in first.", 401);

  if (body.action === "profile") {
    const displayName = String(body.displayName || "").trim().slice(0, 60);
    if (!displayName) return fail("Display name can't be empty.");
    const { error } = await db.from("fan_accounts").update({ display_name: displayName }).eq("id", fan.id);
    if (error) return fail("Couldn't save your profile.", 500);
    // Keep the name creators see in their member registry in step.
    await db.from("members").update({ fan_name: displayName }).eq("fan_account_id", fan.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "password") {
    if (next.length < MIN_PASSWORD) return fail(`Passwords are at least ${MIN_PASSWORD} characters.`);
    const { data: account } = await db.from("fan_accounts").select("password_hash").eq("id", fan.id).single();
    if (!account || !(await verifyPassword(String(body.current || ""), account.password_hash))) {
      return fail("Your current password is incorrect.", 401);
    }
    await db.from("fan_accounts").update({ password_hash: await hashPassword(next) }).eq("id", fan.id);
    await db.from("fan_sessions").delete().eq("fan_account_id", fan.id);
    const cookie = await openSession(db, fan.id, request.headers.get("user-agent"));
    const res = NextResponse.json({ ok: true });
    if (cookie) res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  }

  return fail("Unknown action.");
}
