import { NextResponse } from "next/server";
import { storageAuth } from "@/lib/storage/auth";
import {
  decryptToken,
  deleteConnection,
  getConnection,
  isGoogleConfigured,
  revokeToken,
} from "@/lib/integrations/google_server";

export const runtime = "nodejs";

// Link status for the signed-in user — drives the Google Drive source card.
export async function GET() {
  if (!isGoogleConfigured()) return NextResponse.json({ configured: false, connected: false });
  const auth = await storageAuth();
  if (auth.response) return auth.response;

  const row = await getConnection(auth.supabase, auth.userId);
  return NextResponse.json({
    configured: true,
    connected: Boolean(row),
    email: row?.account_email || "",
    connectedAt: row?.created_at || null,
  });
}

// Disconnect: revoke the grant at Google, then drop the stored token.
export async function DELETE() {
  if (!isGoogleConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const auth = await storageAuth();
  if (auth.response) return auth.response;

  const row = await getConnection(auth.supabase, auth.userId);
  const refreshToken = row ? decryptToken(row.refresh_token_enc) : null;
  if (refreshToken) await revokeToken(refreshToken);

  const ok = await deleteConnection(auth.supabase, auth.userId);
  if (!ok) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ connected: false });
}
