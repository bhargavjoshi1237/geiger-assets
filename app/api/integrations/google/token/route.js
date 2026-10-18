import { NextResponse } from "next/server";
import { storageAuth } from "@/lib/storage/auth";
import {
  decryptToken,
  deleteConnection,
  getConnection,
  isGoogleConfigured,
  refreshAccessToken,
} from "@/lib/integrations/google_server";

export const runtime = "nodejs";

// Mints a short-lived, drive.file-scoped access token for the Picker and the
// browser-side downloads. The refresh token itself never leaves the server.
export async function POST() {
  if (!isGoogleConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const auth = await storageAuth();
  if (auth.response) return auth.response;

  const row = await getConnection(auth.supabase, auth.userId);
  const refreshToken = row ? decryptToken(row.refresh_token_enc) : null;
  if (!refreshToken) return NextResponse.json({ error: "not_connected" }, { status: 409 });

  const minted = await refreshAccessToken(refreshToken);
  if (minted.error === "invalid_grant") {
    // Revoked from the Google account side — drop the dead link.
    await deleteConnection(auth.supabase, auth.userId);
    return NextResponse.json({ error: "not_connected" }, { status: 409 });
  }
  if (minted.error) return NextResponse.json({ error: "token_failed" }, { status: 502 });

  return NextResponse.json(
    { accessToken: minted.accessToken, expiresAt: minted.expiresAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
