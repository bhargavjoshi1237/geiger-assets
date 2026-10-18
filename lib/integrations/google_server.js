if (typeof window !== "undefined") {
  throw new Error("lib/integrations/google_server is server-only.");
}

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Google Drive link — OAuth code flow with an offline refresh token.
//
// The refresh token is the only credential kept, AES-256-GCM encrypted into
// assets.integration_connections (owner-only RLS). The browser never sees it:
// it asks /api/integrations/google/token for a short-lived access token that
// drives the Picker and the file downloads.

export const PROVIDER = "google-drive";
export const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/drive.file"];
export const STATE_COOKIE = "gdrive_oauth";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const TABLE = "integration_connections";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
  );
}

// Must match an "Authorized redirect URI" on the OAuth client exactly. Prod
// uses the public app URL (it carries the /assets basePath); dev uses the
// request origin because .env.local points NEXT_PUBLIC_APP_URL at prod.
export function redirectUri(request) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const base =
    process.env.NODE_ENV === "production" && configured
      ? configured
      : `${new URL(request.url).origin}${BASE}`;
  return `${base}/api/integrations/google/callback`;
}

// Only same-origin paths, so the callback can't be turned into an open redirect.
export function safeReturnTo(value) {
  const path = String(value || "");
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : `${BASE}/`;
}

export function authorizationUrl({ state, redirect }) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirect,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    // Forces a refresh token even when the user linked Drive before.
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

export function newState() {
  return randomBytes(24).toString("base64url");
}

async function tokenRequest(body) {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        ...body,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { error: data?.error || "token_failed" };
    return { data };
  } catch (e) {
    console.error("[google.token]", e?.message || e);
    return { error: "token_failed" };
  }
}

export async function exchangeCode({ code, redirect }) {
  const { data, error } = await tokenRequest({
    code,
    redirect_uri: redirect,
    grant_type: "authorization_code",
  });
  if (error) return { error };
  if (!data?.refresh_token) return { error: "no_refresh_token" };
  return {
    refreshToken: data.refresh_token,
    scopes: data.scope || "",
    email: emailFromIdToken(data.id_token),
  };
}

export async function refreshAccessToken(refreshToken) {
  const { data, error } = await tokenRequest({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  if (error) return { error };
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
}

export async function revokeToken(token) {
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" });
  } catch (e) {
    console.error("[google.revoke]", e?.message || e);
  }
}

// The id_token comes straight from Google's token endpoint over TLS, so its
// payload is trusted without re-verifying the signature.
function emailFromIdToken(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString());
    return payload?.email || "";
  } catch {
    return "";
  }
}

function encryptionKey() {
  return createHash("sha256").update(String(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY)).digest();
}

export function encryptToken(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), body].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(":");
}

export function decryptToken(value) {
  try {
    const [version, iv, tag, body] = String(value).split(":");
    if (version !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// Connection rows go through the caller's user-scoped client, so RLS keeps
// every read and write on the signed-in user's own row.
export async function getConnection(supabase, userId) {
  try {
    const { data, error } = await supabase
      .schema("assets")
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .eq("provider", PROVIDER)
      .maybeSingle();
    if (error) {
      console.error("[google.connection.get]", error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.error("[google.connection.get]", e);
    return null;
  }
}

export async function saveConnection(supabase, { userId, email, refreshToken, scopes }) {
  try {
    const { error } = await supabase
      .schema("assets")
      .from(TABLE)
      .upsert(
        {
          user_id: userId,
          provider: PROVIDER,
          account_email: email || "",
          refresh_token_enc: encryptToken(refreshToken),
          scopes,
        },
        { onConflict: "user_id,provider" },
      );
    if (error) {
      console.error("[google.connection.save]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[google.connection.save]", e);
    return false;
  }
}

export async function deleteConnection(supabase, userId) {
  try {
    const { error } = await supabase
      .schema("assets")
      .from(TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("provider", PROVIDER);
    if (error) {
      console.error("[google.connection.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[google.connection.delete]", e);
    return false;
  }
}
