import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { creatorDb } from "@/lib/creator/server";
import {
  FAN_COOKIE,
  cleanEmail,
  closeSession,
  hashPassword,
  openSession,
  publicFan,
  verifyPassword,
} from "@/lib/creator/fan_auth";

export const runtime = "nodejs";

const MIN_PASSWORD = 8;

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Fan accounts for the public creator pages — one account follows any number
 * of creators. `action` is "signup", "login" or "logout". Successful sign-in
 * sets an httpOnly session cookie; the password never leaves this route.
 */
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return fail("Bad request");
  }
  const db = await creatorDb();
  const jar = await cookies();

  if (body.action === "logout") {
    await closeSession(db, jar.get(FAN_COOKIE)?.value);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(FAN_COOKIE);
    return res;
  }

  const email = cleanEmail(body.email);
  const password = String(body.password || "");
  if (!email) return fail("Enter a valid email.");
  if (password.length < MIN_PASSWORD) return fail(`Passwords are at least ${MIN_PASSWORD} characters.`);

  const { data: existing } = await db.from("fan_accounts").select("*").eq("email", email).is("deleted_at", null).maybeSingle();
  let account = existing;

  if (body.action === "signup") {
    if (existing) return fail("An account with that email already exists — sign in instead.", 409);
    const { data, error } = await db
      .from("fan_accounts")
      .insert({
        email,
        display_name: String(body.displayName || "").trim().slice(0, 60) || email.split("@")[0],
        password_hash: await hashPassword(password),
      })
      .select("*")
      .single();
    if (error) {
      console.error("[fans.signup]", error.message);
      return fail("Couldn't create your account.", 500);
    }
    account = data;
  } else if (body.action === "login") {
    // Same message for an unknown email and a wrong password.
    if (!existing || !(await verifyPassword(password, existing.password_hash))) {
      return fail("Email or password is incorrect.", 401);
    }
  } else {
    return fail("Unknown action.");
  }

  const cookie = await openSession(db, account.id, request.headers.get("user-agent"));
  if (!cookie) return fail("Couldn't sign you in.", 500);
  const res = NextResponse.json({ ok: true, fan: publicFan(account) });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
