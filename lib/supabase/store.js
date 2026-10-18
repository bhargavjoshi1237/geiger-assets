"use client";

// Gallery commerce — owns assets.store_settings, assets.store_products,
// assets.store_price_sheets, assets.store_discounts, assets.store_customers,
// assets.store_orders, assets.store_order_items, assets.store_order_events and
// assets.store_entitlements.
//
// Plain edits (catalogue, customers, notes, entitlement tweaks) write straight
// through here. Anything that moves money or fulfils an order — marking paid,
// refunding, cancelling, re-running fulfilment — goes through the server route
// (/api/store/orders/<id>) so fulfilment and the order.* workflow triggers run
// in exactly one place, with the provider secret.
//
// DB is snake_case, the UI is camelCase; the shapes live in lib/commerce/shape.
// Reads return null (no DB / failure) or [] (configured, empty); writes return
// the normalized row, or null/false on failure. Nothing here throws or toasts.

import {
  createRow,
  createRows,
  getRow,
  listRows,
  softDeleteRow,
  updateRow,
} from "./row_helpers";
import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";
import {
  CUSTOMER_MAP,
  CUSTOMER_NUMERICS,
  DISCOUNT_MAP,
  DISCOUNT_NUMERICS,
  ENTITLEMENT_MAP,
  ENTITLEMENT_NUMERICS,
  ORDER_MAP,
  ORDER_NUMERICS,
  PRODUCT_MAP,
  PRODUCT_NUMERICS,
  SHEET_MAP,
  mapRow,
  normalizeCustomer,
  normalizeDiscount,
  normalizeEntitlement,
  normalizeOrder,
  normalizeOrderEvent,
  normalizeOrderItem,
  normalizePriceSheet,
  normalizeProduct,
  normalizeStoreSettings,
  storeSettingsRow,
} from "@/lib/commerce/shape";

const SETTINGS = "store_settings";
const PRODUCTS = "store_products";
const SHEETS = "store_price_sheets";
const DISCOUNTS = "store_discounts";
const CUSTOMERS = "store_customers";
const ORDERS = "store_orders";
const ORDER_ITEMS = "store_order_items";
const ORDER_EVENTS = "store_order_events";
const ENTITLEMENTS = "store_entitlements";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

const mapList = (normalize) => (rows) => (rows ? rows.map(normalize) : rows);

// Settings ----------------------------------------------------------------------

/** The project's store settings, with defaults filled in. Null only on failure. */
export async function getStoreSettings(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient()
      .from(SETTINGS)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[store.settings.get]", error.message);
      return null;
    }
    return normalizeStoreSettings(data ?? { project_id: projectId });
  } catch (err) {
    console.error("[store.settings.get]", err?.message);
    return null;
  }
}

/** Save one or more settings groups, creating the row on first save. */
export async function saveStoreSettings(projectId, patch) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data: existing } = await sb
      .from(SETTINGS)
      .select("id")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    const row = storeSettingsRow(patch);
    const query = existing?.id
      ? sb.from(SETTINGS).update(row).eq("id", existing.id)
      : sb.from(SETTINGS).insert({ ...row, project_id: projectId });
    const { data, error } = await query.select("*").single();
    if (error) {
      console.error("[store.settings.save]", error.message);
      return null;
    }
    return normalizeStoreSettings(data);
  } catch (err) {
    console.error("[store.settings.save]", err?.message);
    return null;
  }
}

// Products ----------------------------------------------------------------------

const productRow = (input) => mapRow(input, PRODUCT_MAP, { numerics: PRODUCT_NUMERICS });

export const listProducts = (projectId) =>
  listRows(PRODUCTS, projectId, { order: "position", ascending: true }).then(mapList(normalizeProduct));
export const createProduct = (input) => createRow(PRODUCTS, productRow(input)).then(normalizeProduct);
export const updateProduct = (id, patch) => updateRow(PRODUCTS, id, productRow(patch)).then(normalizeProduct);
export const deleteProduct = (id) => softDeleteRow(PRODUCTS, id);

// Price sheets ------------------------------------------------------------------

const sheetRow = (input) => mapRow(input, SHEET_MAP);

export const listPriceSheets = (projectId) =>
  listRows(SHEETS, projectId, { order: "created_at", ascending: true }).then(mapList(normalizePriceSheet));
export const createPriceSheet = (input) => createRow(SHEETS, sheetRow(input)).then(normalizePriceSheet);
export const updatePriceSheet = (id, patch) => updateRow(SHEETS, id, sheetRow(patch)).then(normalizePriceSheet);
export const deletePriceSheet = (id) => softDeleteRow(SHEETS, id);

/** Make one sheet the project default and clear the flag on every other. */
export async function setDefaultPriceSheet(projectId, id) {
  if (!projectId || !id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error: clearError } = await sb
      .from(SHEETS)
      .update({ is_default: false })
      .eq("project_id", projectId)
      .neq("id", id);
    if (clearError) {
      console.error("[store.sheets.default]", clearError.message);
      return false;
    }
    const { error } = await sb.from(SHEETS).update({ is_default: true }).eq("id", id);
    if (error) {
      console.error("[store.sheets.default]", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[store.sheets.default]", err?.message);
    return false;
  }
}

// Discounts ---------------------------------------------------------------------

function discountRow(input) {
  const row = mapRow(input, DISCOUNT_MAP, { numerics: DISCOUNT_NUMERICS });
  if ("code" in input) row.code = String(input.code || "").trim().toUpperCase();
  if ("startsAt" in input) row.starts_at = input.startsAt || null;
  if ("endsAt" in input) row.ends_at = input.endsAt || null;
  if ("galleryId" in input) row.gallery_id = input.galleryId || null;
  return row;
}

export const listDiscounts = (projectId) => listRows(DISCOUNTS, projectId).then(mapList(normalizeDiscount));
export const createDiscount = (input) => createRow(DISCOUNTS, discountRow(input)).then(normalizeDiscount);
export const updateDiscount = (id, patch) => updateRow(DISCOUNTS, id, discountRow(patch)).then(normalizeDiscount);
export const deleteDiscount = (id) => softDeleteRow(DISCOUNTS, id);

// Customers ---------------------------------------------------------------------

function customerRow(input) {
  const row = mapRow(input, CUSTOMER_MAP, { numerics: CUSTOMER_NUMERICS });
  if ("email" in input) row.email = String(input.email || "").trim().toLowerCase();
  return row;
}

export const listCustomers = (projectId) => listRows(CUSTOMERS, projectId).then(mapList(normalizeCustomer));
export const createCustomer = (input) => createRow(CUSTOMERS, customerRow(input)).then(normalizeCustomer);
export const updateCustomer = (id, patch) => updateRow(CUSTOMERS, id, customerRow(patch)).then(normalizeCustomer);
export const deleteCustomer = (id) => softDeleteRow(CUSTOMERS, id);

// Orders ------------------------------------------------------------------------

const orderRow = (input) => mapRow(input, ORDER_MAP, { numerics: ORDER_NUMERICS });

export const listOrders = (projectId) =>
  listRows(ORDERS, projectId, { order: "created_at" }).then(mapList(normalizeOrder));
export const getOrder = (id) => getRow(ORDERS, id).then(normalizeOrder);
export const updateOrder = (id, patch) => updateRow(ORDERS, id, orderRow(patch)).then(normalizeOrder);

export const listOrderItems = (projectId) =>
  listRows(ORDER_ITEMS, projectId, { order: "created_at", ascending: true }).then(mapList(normalizeOrderItem));

export async function listOrderEvents(orderId) {
  if (!orderId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient()
      .from(ORDER_EVENTS)
      .select("*")
      .eq("order_id", orderId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false });
    if (error) {
      console.error("[store.orderEvents.list]", error.message);
      return null;
    }
    return (data ?? []).map(normalizeOrderEvent);
  } catch (err) {
    console.error("[store.orderEvents.list]", err?.message);
    return null;
  }
}

export const addOrderEvent = (input) =>
  createRow(ORDER_EVENTS, {
    project_id: input.projectId,
    order_id: input.orderId,
    kind: input.kind || "note",
    summary: input.summary || "",
    actor: input.actor || "",
    metadata: input.metadata || {},
  }).then(normalizeOrderEvent);

/**
 * Run a money-moving order action on the server: "mark_paid", "refund"
 * ({ amountCents, reason }), "cancel", or "fulfill" (re-run fulfilment).
 * Returns `{ order }` on success, null on failure.
 */
export async function runOrderAction(orderId, action, payload = {}) {
  if (!orderId) return null;
  try {
    const res = await fetch(`${BASE}/api/store/orders/${orderId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[store.orderAction]", body?.error || res.status);
      return { error: body?.error || "failed" };
    }
    return { order: normalizeOrder(body.order) };
  } catch (err) {
    console.error("[store.orderAction]", err?.message);
    return null;
  }
}

// Entitlements ------------------------------------------------------------------

function entitlementRow(input) {
  const row = mapRow(input, ENTITLEMENT_MAP, { numerics: ENTITLEMENT_NUMERICS });
  if ("expiresAt" in input) row.expires_at = input.expiresAt || null;
  if ("revokedAt" in input) row.revoked_at = input.revokedAt || null;
  return row;
}

export const listEntitlements = (projectId) =>
  listRows(ENTITLEMENTS, projectId, { order: "created_at" }).then(mapList(normalizeEntitlement));
export const createEntitlements = (inputs) =>
  createRows(ENTITLEMENTS, inputs.map(entitlementRow)).then(mapList(normalizeEntitlement));
export const updateEntitlement = (id, patch) =>
  updateRow(ENTITLEMENTS, id, entitlementRow(patch)).then(normalizeEntitlement);
export const deleteEntitlement = (id) => softDeleteRow(ENTITLEMENTS, id);

// Links -------------------------------------------------------------------------

function origin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return typeof window === "undefined" ? "" : window.location.origin;
}

/** Public download link for one entitlement. */
export function entitlementUrl(token) {
  return token ? `${origin()}${BASE}/api/store/download/${token}` : "";
}

/** The buyer's order page — receipt, downloads and licences. */
export function orderPageUrl(order, gallerySlug) {
  if (!order?.id || !order.accessToken) return "";
  const slug = gallerySlug || "store";
  return `${origin()}${BASE}/g/${encodeURIComponent(slug)}/order/${order.id}?t=${order.accessToken}`;
}
