import { notFound } from "next/navigation";

import { OrderReceipt } from "@/components/internal/screens/projects/galleries/public/order_receipt";
import { loadBuyerOrder } from "@/lib/commerce/server";
import { normalizeEntitlement } from "@/lib/commerce/shape";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

/**
 * The buyer's order page: receipt, payment state, download links, licences
 * and a printable invoice. The `t` query param is the order's access token —
 * without it (or with the wrong one) the page 404s like any missing order.
 */
export default async function OrderPage({ params, searchParams }) {
  const { slug, orderId } = await params;
  const { t, paid } = await searchParams;
  const data = await loadBuyerOrder(orderId, t);
  if (!data) notFound();

  const { order, items, gallery, settings, customer } = data;
  // Only what the buyer should see: no staff notes, no customer record.
  const buyerOrder = { ...order, staffNote: "" };
  return (
    <OrderReceipt
      slug={gallery?.slug || slug}
      order={buyerOrder}
      items={items}
      galleryName={gallery?.name || ""}
      buyerName={customer?.name || order.name}
      settings={{
        store: settings.store,
        taxes: settings.taxes,
        invoices: settings.invoices,
        policies: { refunds: settings.policies.refunds },
        checkout: { thankYouMessage: settings.checkout.thankYouMessage },
      }}
      thankYou={gallery?.commerce?.checkout?.thankYouMessage || settings.checkout.thankYouMessage || ""}
      entitlements={data.entitlements.map(normalizeEntitlement)}
      licenses={data.licenses}
      assets={data.assets}
      justPaid={paid === "1"}
    />
  );
}
