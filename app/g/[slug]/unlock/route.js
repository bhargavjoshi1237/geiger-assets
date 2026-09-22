import { NextResponse } from "next/server";

import {
  loadGalleryBySlug,
  passwordMatches,
  unlockCookieName,
} from "@/lib/supabase/gallery_server";

/**
 * Password check for a protected gallery.
 *
 * The compare happens here rather than in the browser, so the stored password
 * never travels to the client. A match sets an httpOnly cookie that the page's
 * server-side access check reads on the next request.
 *
 * Note: passwords are stored in plaintext today (see the galleries migration).
 * Hash them before treating this as real protection.
 */
export async function POST(request, { params }) {
  const { slug } = await params;
  let password = "";
  try {
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const resolved = await loadGalleryBySlug(slug);
  const gallery = resolved?.gallery;
  if (!gallery) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!passwordMatches(resolved.passwordHash, password)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(unlockCookieName(gallery.id), "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
