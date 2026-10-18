import { NextResponse } from "next/server";
import { storageAuth } from "@/lib/storage/auth";
import {
  STATE_COOKIE,
  exchangeCode,
  isGoogleConfigured,
  redirectUri,
  safeReturnTo,
  saveConnection,
} from "@/lib/integrations/google_server";

export const runtime = "nodejs";

function readState(request) {
  try {
    return JSON.parse(request.cookies.get(STATE_COOKIE)?.value || "null");
  } catch {
    return null;
  }
}

// Google sends the user back here with ?code&state. Verify the state against
// the cookie set by /connect, store the refresh token, and return the user to
// the screen they started from with ?drive=<outcome> for the toast.
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const saved = readState(request);
  const returnTo = safeReturnTo(saved?.returnTo);
  const redirect = redirectUri(request);

  const back = (code) => {
    const url = new URL(returnTo, new URL(redirect).origin);
    url.searchParams.set("drive", code);
    const response = NextResponse.redirect(url);
    response.cookies.delete(STATE_COOKIE);
    return response;
  };

  if (!isGoogleConfigured()) return back("not_configured");
  if (params.get("error")) return back(params.get("error") === "access_denied" ? "denied" : "failed");
  if (!saved?.state || saved.state !== params.get("state") || !params.get("code")) {
    return back("failed");
  }

  const auth = await storageAuth();
  if (auth.response) return back("unauthorized");

  const exchanged = await exchangeCode({ code: params.get("code"), redirect });
  if (exchanged.error) {
    console.error("[google.callback]", exchanged.error);
    return back(exchanged.error === "invalid_client" ? "misconfigured" : "failed");
  }

  const ok = await saveConnection(auth.supabase, {
    userId: auth.userId,
    email: exchanged.email,
    refreshToken: exchanged.refreshToken,
    scopes: exchanged.scopes,
  });
  return back(ok ? "connected" : "failed");
}
