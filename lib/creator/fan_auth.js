if (typeof window !== "undefined") {
  throw new Error("lib/creator/fan_auth is server-only.");
}

// Fan sign-in for the public creator pages. Fans are not workspace users, so
// they live in assets.fan_accounts (not auth.users): an email + scrypt password
// hash, and opaque session tokens whose SHA-256 is stored in assets.fan_sessions.
// The raw token only ever exists in the fan's httpOnly cookie.

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";

const scrypt = promisify(scryptCb);

export const FAN_COOKIE = "geiger_fan_session";
const SESSION_DAYS = 30;
const KEY_LEN = 64;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function cleanEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : "";
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(String(password), salt, KEY_LEN);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, hex] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  const key = await scrypt(String(password), salt, expected.length);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

/** The subset of a fan account that's safe to hand to a page. */
export function publicFan(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email ?? "",
    displayName: row.display_name || String(row.email || "").split("@")[0],
    avatarUrl: row.avatar_url ?? "",
  };
}

/** Opens a session and returns the cookie the route should set. */
export async function openSession(db, fanId, userAgent = "") {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  const { error } = await db.from("fan_sessions").insert({
    fan_account_id: fanId,
    token_hash: hashToken(token),
    user_agent: String(userAgent).slice(0, 300),
    expires_at: expires.toISOString(),
  });
  if (error) {
    console.error("[fan_auth.openSession]", error.message);
    return null;
  }
  await db.from("fan_accounts").update({ last_login_at: new Date().toISOString() }).eq("id", fanId);
  return {
    name: FAN_COOKIE,
    value: token,
    options: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires },
  };
}

export async function closeSession(db, token) {
  if (!token) return;
  await db.from("fan_sessions").delete().eq("token_hash", hashToken(token));
}

/** The signed-in fan for this request, or null. */
export async function currentFan(db) {
  const jar = await cookies();
  const token = jar.get(FAN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { data, error } = await db
      .from("fan_sessions")
      .select("id, expires_at, account:fan_account_id(*)")
      .eq("token_hash", hashToken(token))
      .maybeSingle();
    if (error || !data?.account || data.account.deleted_at) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    return publicFan(data.account);
  } catch (err) {
    console.error("[fan_auth.currentFan]", err?.message);
    return null;
  }
}
