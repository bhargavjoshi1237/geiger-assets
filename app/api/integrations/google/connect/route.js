import { NextResponse } from "next/server";
import { storageAuth } from "@/lib/storage/auth";
import {
  STATE_COOKIE,
  authorizationUrl,
  isGoogleConfigured,
  newState,
  redirectUri,
  safeReturnTo,
} from "@/lib/integrations/google_server";

export const runtime = "nodejs";

// Starts the link: remember where to come back to, then hand off to Google.
export async function GET(request) {
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
  const redirect = redirectUri(request);
  const back = (code) => {
    const url = new URL(returnTo, new URL(redirect).origin);
    url.searchParams.set("drive", code);
    return NextResponse.redirect(url);
  };

  if (!isGoogleConfigured()) return back("not_configured");
  const auth = await storageAuth();
  if (auth.response) return back("unauthorized");

  const state = newState();
  const response = NextResponse.redirect(authorizationUrl({ state, redirect }));
  response.cookies.set(STATE_COOKIE, JSON.stringify({ state, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
