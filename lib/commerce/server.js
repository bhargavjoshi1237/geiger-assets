if (typeof window !== "undefined") {
  throw new Error("lib/commerce/server is server-only.");
}

// The checkout core. Everything that moves money or hands a buyer something
// runs here, server-side, exactly once per order:
//
//   createCheckout  cart -> re-priced order (pending) -> provider session
//   completeOrder   payment confirmed -> paid -> fulfilled -> order.paid
//   refundOrder     provider refund -> refunded -> access revoked -> order.refunded
//   cancelOrder     pending order abandoned -> cancelled
//
// Payment providers: Stripe Checkout when STRIPE_SECRET_KEY is set (and the
// store's payment mode allows it), otherwise the built-in test checkout, or
// "manual" (invoice / pay later) where staff mark the order paid by hand.
//
// Everything past fulfilment — emails, tags, royalties, memberships, webhooks —
// is left to workflows listening on the order.* triggers.

import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { publicAsset, PUBLIC_ASSET_COLUMNS } from "@/lib/supabase/gallery_shape";
import { queueWorkflowEvent } from "@/lib/workflows/server";
import {
  formatOrderNumber,
  normalizeCustomer,
  normalizeDiscount,
  normalizeOrder,
  normalizePriceSheet,
  normalizeProduct,
  normalizeStoreSettings,
  isShippedKind,
  offersNeedShipping,
  withCommerceDefaults,
} from "./shape";
import { DISCOUNT_PROBLEM_TEXT, priceCart } from "./pricing";
import {
  fulfillOrder,
  loadOrderBundle,
  logOrderEvent,
  orderContext,
  recordCustomerPurchase,
} from "./fulfillment";
import { createCheckoutSession, createRefund, isStripeConfigured } from "./stripe";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Schema-scoped client for commerce writes. The public checkout, the Stripe
 * webhook and the buyer's order page all run without a staff session, so the
 * service role is used when it's configured; otherwise the cookie-bound anon
 * client (which the demo RLS policies admit).
 */
export async function commerceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).schema("assets");
  }
  return (await createServerSupabase()).schema("assets");
}

/** "stripe" | "test" | "manual" — how this store takes money right now. */
export function paymentProvider(settings) {
  const mode = settings?.payments?.mode || "auto";
  if (mode === "manual") return "manual";
  if (mode === "test") return "test";
  return isStripeConfigured() ? "stripe" : "test";
}

/** Settings, catalogue and the gallery's price sheet. */
export async function loadStoreContext(db, projectId, gallery) {
  const commerce = withCommerceDefaults(gallery?.commerce);
  const [{ data: settingsRow }, { data: productRows }, sheetResult] = await Promise.all([
    db.from("store_settings").select("*").eq("project_id", projectId).is("deleted_at", null).maybeSingle(),
    db.from("store_products").select("*").eq("project_id", projectId).is("deleted_at", null),
    commerce.priceSheetId
      ? db.from("store_price_sheets").select("*").eq("id", commerce.priceSheetId).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const products = (productRows || []).map(normalizeProduct);
  return {
    commerce,
    settings: normalizeStoreSettings(settingsRow ?? { project_id: projectId }),
    products,
    productsById: new Map(products.map((p) => [p.id, p])),
    sheet: normalizePriceSheet(sheetResult?.data),
  };
}

/** The public store view the gallery page renders prices from. */
export async function loadGalleryStore(gallery) {
  const commerce = withCommerceDefaults(gallery?.commerce);
  if (!gallery || !commerce.enabled) return null;
  try {
    const db = await commerceDb();
    const store = await loadStoreContext(db, gallery.projectId, gallery);
    const sheetProductIds = new Set((store.sheet?.lines || []).map((l) => l.productId));
    const extra = [commerce.perAsset.productId, commerce.unlock.productId].filter(Boolean);
    const products = store.products.filter(
      (p) => p.status === "active" && (sheetProductIds.has(p.id) || extra.includes(p.id)),
    );
    const { checkout, taxes, store: identity, policies } = store.settings;
    return {
      commerce,
      sheet: store.sheet,
      products,
      settings: {
        store: identity,
        taxes,
        policies: { terms: policies.terms, refunds: policies.refunds },
        checkout,
      },
      provider: paymentProvider(store.settings),
    };
  } catch (err) {
    console.error("[commerce.loadGalleryStore]", err?.message);
    return null;
  }
}

async function findDiscount(db, projectId, code) {
  const clean = String(code || "").trim();
  if (!clean) return null;
  const { data } = await db
    .from("store_discounts")
    .select("*")
    .eq("project_id", projectId)
    // citext: equality is already case-insensitive, and unlike ilike a "_" in
    // the code can't act as a wildcard.
    .eq("code", clean.toUpperCase())
    .is("deleted_at", null)
    .maybeSingle();
  return normalizeDiscount(data);
}

/** The gallery's sellable assets, keyed by id. */
async function galleryAssetMap(db, gallery) {
  let rows = [];
  if (gallery.sourceKind === "collection") {
    if (gallery.collectionId) {
      const { data } = await db
        .from("collection_assets")
        .select(`asset:asset_id(${PUBLIC_ASSET_COLUMNS})`)
        .eq("collection_id", gallery.collectionId);
      rows = (data || []).map((r) => r.asset);
    }
  } else {
    const { data } = await db
      .from("gallery_items")
      .select(`asset:asset_id(${PUBLIC_ASSET_COLUMNS})`)
      .eq("gallery_id", gallery.id)
      .eq("is_hidden", false)
      .is("deleted_at", null);
    rows = (data || []).map((r) => r.asset);
  }
  return new Map(rows.map(publicAsset).filter(Boolean).map((a) => [a.id, a]));
}

async function upsertCustomer(db, projectId, buyer) {
  const email = buyer.email.toLowerCase();
  const { data: existing } = await db
    .from("store_customers")
    .select("*")
    .eq("project_id", projectId)
    .eq("email", email)
    .is("deleted_at", null)
    .maybeSingle();
  const details = {
    ...(buyer.name ? { name: buyer.name } : {}),
    ...(buyer.company ? { company: buyer.company } : {}),
    ...(buyer.phone ? { phone: buyer.phone } : {}),
    ...(buyer.country ? { country: buyer.country } : {}),
    ...(buyer.address && Object.values(buyer.address).some(Boolean) ? { address: buyer.address } : {}),
    ...(buyer.marketingOptIn ? { marketing_opt_in: true } : {}),
  };
  if (existing) {
    if (Object.keys(details).length) {
      const { data } = await db.from("store_customers").update(details).eq("id", existing.id).select("*").single();
      return { customer: normalizeCustomer(data || existing), isNew: false };
    }
    return { customer: normalizeCustomer(existing), isNew: false };
  }
  const { data, error } = await db
    .from("store_customers")
    .insert({ project_id: projectId, email, ...details })
    .select("*")
    .single();
  if (error) throw new Error(`customer: ${error.message}`);
  return { customer: normalizeCustomer(data), isNew: true };
}

function cleanBuyer(input) {
  const b = input && typeof input === "object" ? input : {};
  const str = (v, max = 200) => String(v ?? "").trim().slice(0, max);
  const address = b.address && typeof b.address === "object" ? b.address : {};
  return {
    email: str(b.email, 254),
    name: str(b.name),
    company: str(b.company),
    phone: str(b.phone, 40),
    country: str(b.country, 80),
    address: {
      line1: str(address.line1),
      line2: str(address.line2),
      city: str(address.city, 120),
      region: str(address.region, 120),
      postalCode: str(address.postalCode, 20),
      country: str(address.country, 80),
    },
    note: str(b.note, 1000),
    termsAccepted: Boolean(b.termsAccepted),
    marketingOptIn: Boolean(b.marketingOptIn),
  };
}

/** Fire an order.* trigger with the order's context. Never throws. */
export async function emitOrderEvent(db, type, bundle, extra = {}) {
  if (!bundle?.order) return;
  await queueWorkflowEvent(
    {
      type,
      projectId: bundle.order.projectId,
      orderId: bundle.order.id,
      context: { ...orderContext(bundle), ...extra },
    },
    db,
  );
}

/**
 * Price a cart exactly as checkout would — catalogue re-read, discount code
 * checked — without creating anything. The cart drawer calls this so the total
 * the buyer sees is the total they'll be charged.
 */
export async function previewCheckout({ gallery, body }) {
  const db = await commerceDb();
  const store = await loadStoreContext(db, gallery.projectId, gallery);
  if (!store.commerce.enabled) return { error: "This gallery isn't selling right now.", status: 403 };
  const lines = Array.isArray(body?.lines) ? body.lines.slice(0, 200) : [];
  const allowDiscounts = store.settings.checkout.allowDiscounts && store.commerce.checkout.allowDiscounts;
  const code = allowDiscounts ? String(body?.discountCode || "").trim() : "";
  const discount = code ? await findDiscount(db, gallery.projectId, code) : null;
  const assets = await galleryAssetMap(db, gallery);
  const cart = priceCart({
    lines,
    commerce: store.commerce,
    sheet: store.sheet,
    productsById: store.productsById,
    assets,
    settings: store.settings,
    discount,
    galleryId: gallery.id,
  });
  const problem = code ? (discount ? cart.discountProblem : "missing") : null;
  return {
    cart: {
      lines: cart.lines.map((l) => ({
        key: l.key,
        title: l.title || "",
        offer: l.offer ? { name: l.offer.name, kind: l.offer.kind } : null,
        quantity: l.quantity,
        unitCents: l.unitCents,
        totalCents: l.totalCents,
        error: l.error || null,
      })),
      subtotalCents: cart.subtotalCents,
      discountCents: cart.discountCents,
      discountCode: cart.discount?.code || "",
      discountError: problem ? DISCOUNT_PROBLEM_TEXT[problem] : null,
      taxCents: cart.taxCents,
      taxLabel: cart.taxLabel,
      taxInclusive: cart.taxInclusive,
      totalCents: cart.totalCents,
      currency: cart.currency,
      minimumCents: store.settings.checkout.minimumOrderCents,
    },
  };
}

/**
 * Turn a cart into a pending order and hand back where the buyer goes next.
 * Returns `{ url, orderId }` or `{ error, status }`.
 */
export async function createCheckout({ gallery, body, origin }) {
  const db = await commerceDb();
  const store = await loadStoreContext(db, gallery.projectId, gallery);
  if (!store.commerce.enabled) return { error: "This gallery isn't selling right now.", status: 403 };

  const { checkout } = store.settings;
  const buyer = cleanBuyer(body?.buyer);
  if (!EMAIL_RE.test(buyer.email)) return { error: "Enter a valid email address.", status: 400 };
  if (checkout.collectName && !buyer.name) return { error: "Enter your name.", status: 400 };
  if (checkout.collectAddress && (!buyer.address.line1 || !buyer.address.city)) {
    return { error: "Enter your billing address.", status: 400 };
  }
  if (checkout.requireTerms && !buyer.termsAccepted) {
    return { error: "Accept the terms to continue.", status: 400 };
  }

  const lines = Array.isArray(body?.lines) ? body.lines.slice(0, 200) : [];
  if (!lines.length) return { error: "Your cart is empty.", status: 400 };
  if (checkout.maxItems > 0 && lines.length > checkout.maxItems) {
    return { error: `A single order can hold at most ${checkout.maxItems} items.`, status: 400 };
  }

  const allowDiscounts = checkout.allowDiscounts && store.commerce.checkout.allowDiscounts;
  const discount = allowDiscounts && body?.discountCode ? await findDiscount(db, gallery.projectId, body.discountCode) : null;
  if (body?.discountCode && allowDiscounts && !discount) return { error: DISCOUNT_PROBLEM_TEXT.missing, status: 400 };

  const assets = await galleryAssetMap(db, gallery);
  const cart = priceCart({
    lines,
    commerce: store.commerce,
    sheet: store.sheet,
    productsById: store.productsById,
    assets,
    settings: store.settings,
    discount,
    galleryId: gallery.id,
  });
  if (cart.errors.length) return { error: cart.errors[0], status: 409 };
  if (offersNeedShipping(cart.lines.map((l) => l.offer)) && (!buyer.address.line1 || !buyer.address.city)) {
    return { error: "Enter a shipping address.", status: 400 };
  }
  if (cart.discountProblem) return { error: DISCOUNT_PROBLEM_TEXT[cart.discountProblem], status: 400 };
  if (checkout.minimumOrderCents > 0 && cart.subtotalCents < checkout.minimumOrderCents) {
    return { error: "Your order is below the store's minimum.", status: 400 };
  }

  const { customer, isNew } = await upsertCustomer(db, gallery.projectId, buyer);
  if (customer.status === "blocked") return { error: "This store can't take your order.", status: 403 };

  const { data: seq } = await db.rpc("store_next_order_number", { p_project_id: gallery.projectId });
  const number = formatOrderNumber(store.settings.invoices.orderPrefix, seq);
  const provider = cart.totalCents === 0 ? "manual" : paymentProvider(store.settings);

  const { data: orderRow, error: orderError } = await db
    .from("store_orders")
    .insert({
      project_id: gallery.projectId,
      number,
      gallery_id: gallery.id,
      customer_id: customer.id,
      email: buyer.email.toLowerCase(),
      name: buyer.name,
      status: "pending",
      subtotal_cents: cart.subtotalCents,
      discount_cents: cart.discountCents,
      tax_cents: cart.taxCents,
      total_cents: cart.totalCents,
      currency: cart.currency,
      discount_code: cart.discount?.code || "",
      provider,
      billing: {
        company: buyer.company,
        phone: buyer.phone,
        country: buyer.country,
        address: buyer.address,
        taxLabel: cart.taxLabel,
        taxInclusive: cart.taxInclusive,
      },
      customer_note: buyer.note,
      terms_accepted_at: buyer.termsAccepted ? new Date().toISOString() : null,
      metadata: { gallerySlug: gallery.slug, discountId: cart.discount?.id ?? null },
    })
    .select("*")
    .single();
  if (orderError) {
    console.error("[commerce.checkout.order]", orderError.message);
    return { error: "Couldn't start checkout.", status: 500 };
  }
  const order = normalizeOrder(orderRow);

  const { error: itemsError } = await db.from("store_order_items").insert(
    cart.lines.map((line) => ({
      project_id: gallery.projectId,
      order_id: order.id,
      product_id: line.offer.productId,
      asset_id: line.offer.kind === "bundle" || line.offer.kind === "unlock" ? null : line.assetId,
      kind: line.offer.kind,
      title: line.title,
      product_name: line.offer.name,
      unit_cents: line.unitCents,
      quantity: line.quantity,
      total_cents: line.totalCents,
      fulfillment: line.offer.fulfillment,
      metadata: {
        offerId: line.offerId,
        assetIds: line.offer.kind === "bundle" || line.offer.kind === "unlock" ? line.assetIds : [],
        licenseTemplateId: line.offer.licenseTemplateId ?? null,
      },
    })),
  );
  if (itemsError) {
    console.error("[commerce.checkout.items]", itemsError.message);
    await db.from("store_orders").update({ status: "failed" }).eq("id", order.id);
    return { error: "Couldn't start checkout.", status: 500 };
  }

  await logOrderEvent(db, order, "created", `Order placed from ${gallery.name || "a gallery"}`, {
    actor: buyer.email,
    metadata: { provider },
  });
  const bundle = { order, items: cart.lines, customer, gallery, settings: store.settings };
  if (isNew) {
    await queueWorkflowEvent(
      { type: "customer.created", projectId: gallery.projectId, orderId: order.id, context: orderContext(bundle) },
      db,
    );
  }
  await emitOrderEvent(db, "order.created", bundle);

  const orderUrl = `${origin}/g/${encodeURIComponent(gallery.slug)}/order/${order.id}?t=${order.accessToken}`;

  // Free orders complete on the spot.
  if (cart.totalCents === 0) {
    await completeOrder(db, order.id, { provider: "manual", actor: "Checkout", note: "No payment due" });
    return { url: orderUrl, orderId: order.id };
  }

  // The built-in test checkout stands in for Stripe: no money moves, so the
  // payment "succeeds" straight away and the buyer lands on the paid order.
  if (provider === "test") {
    await completeOrder(db, order.id, { provider: "test", actor: "Checkout", note: "Test payment — no money charged" });
    return { url: `${orderUrl}&paid=1`, orderId: order.id };
  }

  if (provider === "stripe") {
    try {
      // With a discount or exclusive tax the line prices no longer add up to
      // the total, so Stripe gets one line for the whole order instead.
      const itemized = cart.discountCents === 0 && (cart.taxCents === 0 || cart.taxInclusive);
      const session = await createCheckoutSession({
        order,
        lines: itemized
          ? cart.lines.map((l) => ({ name: `${l.offer.name} — ${l.title}`, unitCents: l.unitCents, quantity: l.quantity }))
          : [{ name: `Order ${number}`, description: `${cart.lines.length} item${cart.lines.length === 1 ? "" : "s"}`, unitCents: cart.totalCents, quantity: 1 }],
        successUrl: `${orderUrl}&paid=1`,
        cancelUrl: `${origin}/g/${encodeURIComponent(gallery.slug)}?checkout=cancelled`,
        descriptor: store.settings.payments.statementDescriptor,
      });
      await db.from("store_orders").update({ provider_ref: session.id }).eq("id", order.id);
      return { url: session.url, orderId: order.id };
    } catch (err) {
      console.error("[commerce.checkout.stripe]", err?.message);
      await db.from("store_orders").update({ status: "failed" }).eq("id", order.id);
      await logOrderEvent(db, order, "payment", `Stripe checkout failed: ${err?.message || "unknown error"}`);
      return { error: "The payment provider couldn't start checkout.", status: 502 };
    }
  }

  return { url: orderUrl, orderId: order.id };
}

/**
 * Payment confirmed: mark paid, fulfil, update the customer and discount, then
 * fire order.paid (and license.purchased per licence). Idempotent — an order
 * that's already past pending is returned untouched.
 */
export async function completeOrder(db, orderId, { provider, providerRef, actor = "Checkout", note } = {}) {
  const bundle = await loadOrderBundle(db, orderId);
  if (!bundle) return null;
  const { order } = bundle;
  if (order.status !== "pending" && order.status !== "failed") return bundle;

  const now = new Date().toISOString();
  const { data: claimed } = await db
    .from("store_orders")
    .update({
      status: "paid",
      paid_at: now,
      ...(provider ? { provider } : {}),
      ...(providerRef ? { provider_ref: providerRef } : {}),
    })
    .eq("id", order.id)
    .in("status", ["pending", "failed"])
    .select("id");
  // Someone else (a retried webhook) got here first.
  if (!claimed?.length) return loadOrderBundle(db, orderId);

  order.status = "paid";
  order.paidAt = now;
  await logOrderEvent(db, order, "paid", note || `Payment received via ${provider || order.provider}`, { actor });
  await recordCustomerPurchase(db, bundle.customer, order);

  const discountId = order.discountId;
  if (discountId) {
    const { data: d } = await db.from("store_discounts").select("redemptions").eq("id", discountId).maybeSingle();
    if (d) await db.from("store_discounts").update({ redemptions: (Number(d.redemptions) || 0) + 1 }).eq("id", discountId);
  }

  let created = { entitlements: [], licenses: [] };
  if (bundle.settings.fulfillment.autoFulfill) {
    try {
      created = await fulfillOrder(db, bundle, { actor });
    } catch (err) {
      console.error("[commerce.fulfill]", err?.message);
      await logOrderEvent(db, order, "fulfillment", `Fulfilment failed: ${err?.message || "unknown error"}`, { actor });
    }
  }

  await emitOrderEvent(db, "order.paid", bundle);
  for (const license of created.licenses) {
    await emitOrderEvent(db, "license.purchased", bundle, { license: license.reference || license.title });
  }
  if (order.status === "fulfilled") await emitOrderEvent(db, "order.fulfilled", bundle);
  return bundle;
}

/** Staff re-run of fulfilment (after an edit, or once prints ship). */
export async function refulfillOrder(db, orderId, { actor, markPrintsShipped = false } = {}) {
  const bundle = await loadOrderBundle(db, orderId);
  if (!bundle) return null;
  if (!["paid", "fulfilled", "partially_refunded"].includes(bundle.order.status)) return bundle;
  if (markPrintsShipped) {
    for (const item of bundle.items) {
      if (isShippedKind(item.kind) && item.status === "pending") {
        await db.from("store_order_items").update({ status: "fulfilled" }).eq("id", item.id);
        item.status = "fulfilled";
      }
    }
    await logOrderEvent(db, bundle.order, "fulfillment", "Physical items marked as shipped", { actor });
  }
  await fulfillOrder(db, bundle, { actor });
  if (bundle.order.status === "fulfilled") await emitOrderEvent(db, "order.fulfilled", bundle);
  return bundle;
}

/**
 * Refund all or part of a paid order. A full refund revokes the order's
 * downloads (and, when asked, terminates its licences).
 */
export async function refundOrder(db, orderId, { amountCents, reason = "", revokeAccess = true, terminateLicenses = false, actor } = {}) {
  const bundle = await loadOrderBundle(db, orderId);
  if (!bundle) return { error: "not_found" };
  const { order } = bundle;
  if (!["paid", "fulfilled", "partially_refunded"].includes(order.status)) return { error: "not_refundable" };

  const remaining = order.totalCents - order.refundedCents;
  const amount = Math.min(remaining, Math.max(0, Math.round(Number(amountCents ?? remaining))));
  if (amount <= 0) return { error: "nothing_to_refund" };

  if (order.provider === "stripe") {
    // The webhook swaps the session id for the payment intent once paid.
    const paymentIntent = order.providerRef.startsWith("pi_") ? order.providerRef : null;
    if (!paymentIntent) return { error: "missing_payment_reference" };
    try {
      await createRefund({ paymentIntent, amountCents: amount, reason, orderId: order.id });
    } catch (err) {
      console.error("[commerce.refund.stripe]", err?.message);
      return { error: err?.message || "provider_refund_failed" };
    }
  }

  const refunded = order.refundedCents + amount;
  const full = refunded >= order.totalCents;
  const now = new Date().toISOString();
  await db
    .from("store_orders")
    .update({ refunded_cents: refunded, refunded_at: now, status: full ? "refunded" : "partially_refunded" })
    .eq("id", order.id);
  order.refundedCents = refunded;
  order.status = full ? "refunded" : "partially_refunded";

  if (full) {
    await db.from("store_order_items").update({ status: "refunded" }).eq("order_id", order.id);
    if (revokeAccess) {
      await db.from("store_entitlements").update({ revoked_at: now }).eq("order_id", order.id).is("revoked_at", null);
    }
    if (terminateLicenses) {
      const licenseIds = bundle.items.map((i) => i.licenseId).filter(Boolean);
      if (licenseIds.length) await db.from("licenses").update({ status: "terminated" }).in("id", licenseIds);
    }
  }
  if (bundle.customer) {
    await db
      .from("store_customers")
      .update({ total_spent_cents: Math.max(0, bundle.customer.totalSpentCents - amount) })
      .eq("id", bundle.customer.id);
  }

  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency.toUpperCase() });
  await logOrderEvent(
    db,
    order,
    "refund",
    `${full ? "Refunded" : "Partially refunded"} ${money.format(amount / 100)}${reason ? ` — ${reason}` : ""}`,
    { actor, metadata: { amountCents: amount } },
  );
  await emitOrderEvent(db, "order.refunded", bundle, { refunded: money.format(amount / 100) });
  return { bundle };
}

/** Abandon a pending order. */
export async function cancelOrder(db, orderId, { actor, reason = "" } = {}) {
  const bundle = await loadOrderBundle(db, orderId);
  if (!bundle) return { error: "not_found" };
  if (!["pending", "failed"].includes(bundle.order.status)) return { error: "not_cancellable" };
  await db
    .from("store_orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", orderId);
  bundle.order.status = "cancelled";
  await db.from("store_order_items").update({ status: "cancelled" }).eq("order_id", orderId);
  await logOrderEvent(db, bundle.order, "cancelled", reason ? `Cancelled — ${reason}` : "Cancelled", { actor });
  return { bundle };
}

/** Resolve an order for the buyer's page, checking its access token. */
export async function loadBuyerOrder(orderId, token) {
  if (!orderId || !token) return null;
  try {
    const db = await commerceDb();
    const bundle = await loadOrderBundle(db, orderId);
    if (!bundle || bundle.order.accessToken !== token) return null;

    const [{ data: entitlements }, licensesResult] = await Promise.all([
      db.from("store_entitlements").select("*").eq("order_id", orderId).is("deleted_at", null),
      (() => {
        const ids = bundle.items.map((i) => i.licenseId).filter(Boolean);
        return ids.length
          ? db.from("licenses").select("id, reference, title, status, usage_type, territories, channels, start_date, end_date, is_perpetual").in("id", ids)
          : Promise.resolve({ data: [] });
      })(),
    ]);
    const assetIds = [...new Set((entitlements || []).map((e) => e.asset_id).concat(bundle.items.map((i) => i.assetId)).filter(Boolean))];
    const { data: assetRows } = assetIds.length
      ? await db.from("assets").select(PUBLIC_ASSET_COLUMNS).in("id", assetIds)
      : { data: [] };
    return {
      ...bundle,
      entitlements: entitlements || [],
      licenses: licensesResult.data || [],
      assets: (assetRows || []).map(publicAsset),
      provider: bundle.order.provider,
    };
  } catch (err) {
    console.error("[commerce.buyerOrder]", err?.message);
    return null;
  }
}

/** The order a Stripe Checkout Session belongs to. */
export async function orderIdForSession(db, session) {
  const fromMeta = session?.metadata?.order_id || session?.client_reference_id;
  if (fromMeta) return fromMeta;
  if (!session?.id) return null;
  const { data } = await db.from("store_orders").select("id").eq("provider_ref", session.id).maybeSingle();
  return data?.id ?? null;
}
