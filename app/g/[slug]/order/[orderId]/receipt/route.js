import { NextResponse } from "next/server";

import { commerceDb } from "@/lib/commerce/server";
import { loadOrderBundle } from "@/lib/commerce/fulfillment";
import { buildReceiptPdf, receiptFilename } from "@/lib/commerce/receipt_pdf";

export const runtime = "nodejs";

/**
 * The order's receipt (or, while unpaid, its invoice) as a downloadable PDF.
 * Guarded by the same access token as the order page itself.
 */
export async function GET(request, { params }) {
  const { orderId } = await params;
  const token = request.nextUrl.searchParams.get("t") || "";

  const db = await commerceDb();
  const bundle = await loadOrderBundle(db, orderId);
  if (!bundle || !token || bundle.order.accessToken !== token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const bytes = await buildReceiptPdf({
      order: bundle.order,
      items: bundle.items,
      settings: bundle.settings,
      galleryName: bundle.gallery?.name || "",
    });
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${receiptFilename(bundle.order, bundle.settings)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[commerce.receipt.pdf]", err?.message);
    return NextResponse.json({ error: "Couldn't build the receipt." }, { status: 500 });
  }
}
