import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { accessProblem, loadGalleryBySlug, unlockCookieName } from "@/lib/supabase/gallery_server";
import { createCheckout, previewCheckout } from "@/lib/commerce/server";

export const runtime = "nodejs";

function originOf(request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return `${(configured || new URL(request.url).origin).replace(/\/+$/, "")}${base}`;
}

/**
 * Start checkout for a gallery cart.
 *
 * The same access check as the page runs first, so a gated gallery can't be
 * bought from. The cart is re-priced server-side from the catalogue — the
 * browser only says *what* it wants, never what it costs. Responds with the
 * URL to send the buyer to: Stripe Checkout, or the order page (test / manual
 * checkout, or a free order that's already complete). With `preview: true`
 * it only prices the cart (and checks the discount code) and creates nothing.
 */
export async function POST(request, { params }) {
  const { slug } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const resolved = await loadGalleryBySlug(slug);
  const gallery = resolved?.gallery;
  if (!gallery) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const jar = await cookies();
  const unlocked = jar.get(unlockCookieName(gallery.id))?.value === "1";
  if (accessProblem(gallery, { unlocked })) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body?.preview) {
    const preview = await previewCheckout({ gallery, body });
    if (preview.error) return NextResponse.json({ error: preview.error }, { status: preview.status || 400 });
    return NextResponse.json(preview);
  }

  const result = await createCheckout({ gallery, body, origin: originOf(request) });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  return NextResponse.json({ url: result.url, orderId: result.orderId });
}
