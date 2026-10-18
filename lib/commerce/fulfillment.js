// Order fulfilment — the writes that turn a paid order into things the buyer
// owns: download entitlements, issued licences, customer history and the
// order timeline.
//
// Isomorphic like the workflow engine: every function takes a schema-scoped
// client (`sb.schema("assets")`), so the checkout core (lib/commerce/server.js)
// and the commerce workflow abilities (lib/workflows/abilities/commerce.js)
// run the exact same code. Functions throw on a failed write; callers decide
// whether that fails the order, a workflow step, or just gets logged.

import {
  RENDITIONS,
  deliversFiles,
  isShippedKind,
  normalizeCustomer,
  normalizeOrder,
  normalizeOrderItem,
  normalizeStoreSettings,
} from "./shape";

const DAY_MS = 86_400_000;

function must({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Everything needed to act on one order, normalized. Null when it's gone. */
export async function loadOrderBundle(db, orderId) {
  const { data: row, error } = await db
    .from("store_orders")
    .select("*")
    .eq("id", orderId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !row) return null;
  const order = normalizeOrder(row);

  const [{ data: items }, { data: customer }, { data: gallery }, { data: settings }] = await Promise.all([
    db.from("store_order_items").select("*").eq("order_id", orderId).is("deleted_at", null).order("created_at"),
    order.customerId
      ? db.from("store_customers").select("*").eq("id", order.customerId).maybeSingle()
      : Promise.resolve({ data: null }),
    order.galleryId
      ? db.from("galleries").select("id, name, slug, commerce").eq("id", order.galleryId).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("store_settings").select("*").eq("project_id", order.projectId).is("deleted_at", null).maybeSingle(),
  ]);

  return {
    order,
    items: (items || []).map(normalizeOrderItem),
    customer: normalizeCustomer(customer),
    gallery: gallery || null,
    settings: normalizeStoreSettings(settings ?? { project_id: order.projectId }),
  };
}

/** Append one line to the order's timeline. Never throws. */
export async function logOrderEvent(db, order, kind, summary, { actor = "", metadata = {} } = {}) {
  const { error } = await db.from("store_order_events").insert({
    project_id: order.projectId,
    order_id: order.id,
    kind,
    summary,
    actor,
    metadata,
  });
  if (error) console.error("[commerce.event]", error.message);
}

/** Asset ids an order item covers: its own asset, or a bundle / unlock set. */
export function itemAssetIds(item) {
  if (item.assetId) return [item.assetId];
  return Array.isArray(item.assetIds) ? item.assetIds.filter(Boolean) : [];
}

/**
 * Download entitlements for `assetIds`. `expiryDays` / `downloadLimit` of 0
 * mean "never expires" / "unlimited".
 */
export async function grantEntitlements(
  db,
  { order, item = null, customerId = null, assetIds, rendition = "original", format = "original", downloadLimit = 0, expiryDays = 0, source = "order", createdBy = null },
) {
  const ids = [...new Set((assetIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const expiresAt = Number(expiryDays) > 0 ? new Date(Date.now() + Number(expiryDays) * DAY_MS).toISOString() : null;
  const rows = ids.map((assetId) => ({
    project_id: order.projectId,
    order_id: order.id,
    order_item_id: item?.id ?? null,
    customer_id: customerId ?? order.customerId ?? null,
    asset_id: assetId,
    rendition: RENDITIONS[rendition] ? rendition : "original",
    max_downloads: Math.max(0, Number(downloadLimit) || 0),
    expires_at: expiresAt,
    source,
    created_by: createdBy,
    metadata: { format: format || "original" },
  }));
  return must(await db.from("store_entitlements").insert(rows).select("*"), "entitlements") || [];
}

/** The licensee a customer's licences are issued to, created on first need. */
export async function ensureLicensee(db, customer) {
  if (!customer) return null;
  if (customer.licenseeId) return customer.licenseeId;
  const licensee = must(
    await db
      .from("licensees")
      .insert({
        project_id: customer.projectId,
        name: customer.company || customer.name || customer.email,
        contact_name: customer.name || "",
        email: customer.email || null,
        kind: customer.company ? "brand" : "individual",
        territory: customer.country || "",
        notes: "Created from a gallery purchase.",
        metadata: { customerId: customer.id },
      })
      .select("id")
      .single(),
    "licensee",
  );
  await db.from("store_customers").update({ licensee_id: licensee.id }).eq("id", customer.id);
  customer.licenseeId = licensee.id;
  return licensee.id;
}

async function nextLicenseReference(db, projectId) {
  const prefix = `LIC-${new Date().getFullYear()}-`;
  const { data } = await db
    .from("licenses")
    .select("reference")
    .eq("project_id", projectId)
    .like("reference", `${prefix}%`);
  const highest = (data || []).reduce((max, row) => {
    const n = Number(String(row.reference).slice(prefix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

/**
 * Issue one licence for an order item, covering the item's assets. Scope comes
 * from the product's fulfilment snapshot, falling back to its licence template;
 * `overrides` (from a workflow step) win over both.
 */
export async function issueLicense(db, { order, item, customer, overrides = {}, title }) {
  const f = { ...(item?.fulfillment || {}), ...overrides };
  const templateId = overrides.templateId || item?.metadata?.licenseTemplateId || item?.licenseTemplateId || null;
  let template = null;
  if (templateId) {
    const { data } = await db.from("license_templates").select("*").eq("id", templateId).maybeSingle();
    template = data || null;
  }

  const months = Number(f.durationMonths ?? template?.default_duration_months ?? 12) || 0;
  const start = new Date().toISOString().slice(0, 10);
  const licenseeId = await ensureLicensee(db, customer);
  const reference = await nextLicenseReference(db, order.projectId);
  const license = must(
    await db
      .from("licenses")
      .insert({
        project_id: order.projectId,
        reference,
        title: title || `${item?.productName || "Licence"} — ${item?.title || order.number}`,
        template_id: template?.id ?? null,
        licensee_id: licenseeId,
        status: f.requiresApproval || template?.requires_approval ? "pending" : "active",
        usage_type: f.usageType || template?.usage_type || "web",
        territories: f.territories?.length ? f.territories : template?.default_territories || [],
        channels: f.channels?.length ? f.channels : template?.default_channels || [],
        exclusivity: f.exclusivity || template?.exclusivity || "non_exclusive",
        start_date: start,
        end_date: months > 0 ? addMonths(start, months) : null,
        is_perpetual: months === 0,
        fee_cents: item?.totalCents ?? 0,
        currency: order.currency,
        restrictions: template?.restrictions || [],
        terms_body: template?.terms_body || "",
        notes: `Sold through order ${order.number}.`,
        issued_at: new Date().toISOString(),
        metadata: { orderId: order.id, orderNumber: order.number, orderItemId: item?.id ?? null },
      })
      .select("*")
      .single(),
    "license",
  );

  const assetIds = item ? itemAssetIds(item) : [];
  if (assetIds.length) {
    must(
      await db.from("license_items").insert(
        assetIds.map((assetId) => ({ project_id: order.projectId, license_id: license.id, asset_id: assetId })),
      ),
      "license items",
    );
  }
  if (item?.id) await db.from("store_order_items").update({ license_id: license.id }).eq("id", item.id);
  return license;
}

/** Roll a paid order into the customer's lifetime numbers. */
export async function recordCustomerPurchase(db, customer, order) {
  if (!customer) return;
  const now = order.paidAt || new Date().toISOString();
  const { error } = await db
    .from("store_customers")
    .update({
      orders_count: customer.ordersCount + 1,
      total_spent_cents: customer.totalSpentCents + order.totalCents,
      first_order_at: customer.firstOrderAt || now,
      last_order_at: now,
    })
    .eq("id", customer.id);
  if (error) console.error("[commerce.customer]", error.message);
}

/**
 * Fulfil every pending item on a paid order: files become entitlements,
 * licence products issue licences (when the store says so), prints wait for
 * a person. Returns what was created; the order's fulfilment status is updated
 * to match.
 */
export async function fulfillOrder(db, bundle, { actor = "Checkout" } = {}) {
  const { order, items, customer, settings } = bundle;
  const created = { entitlements: [], licenses: [] };
  let waiting = 0;

  for (const item of items) {
    if (item.status !== "pending") continue;
    const f = item.fulfillment || {};

    if (deliversFiles(item.kind, f)) {
      const rows = await grantEntitlements(db, {
        order,
        item,
        assetIds: itemAssetIds(item),
        rendition: f.rendition,
        format: f.format,
        downloadLimit: f.downloadLimit ?? settings.fulfillment.downloadLimit,
        expiryDays: f.expiryDays ?? settings.fulfillment.expiryDays,
      });
      created.entitlements.push(...rows);
    }

    if (item.kind === "license" && settings.fulfillment.issueLicenses) {
      created.licenses.push(await issueLicense(db, { order, item, customer }));
    }

    if (isShippedKind(item.kind)) {
      waiting += 1;
      continue;
    }
    await db.from("store_order_items").update({ status: "fulfilled" }).eq("id", item.id);
    item.status = "fulfilled";
  }

  const fulfilled = waiting === 0;
  const now = new Date().toISOString();
  await db
    .from("store_orders")
    .update({
      fulfillment_status: fulfilled ? "fulfilled" : "partial",
      ...(fulfilled ? { status: "fulfilled", fulfilled_at: now } : {}),
    })
    .eq("id", order.id);
  order.fulfillmentStatus = fulfilled ? "fulfilled" : "partial";
  if (fulfilled) {
    order.status = "fulfilled";
    order.fulfilledAt = now;
  }

  const parts = [];
  if (created.entitlements.length) parts.push(`${created.entitlements.length} download${created.entitlements.length === 1 ? "" : "s"}`);
  if (created.licenses.length) parts.push(`${created.licenses.length} licence${created.licenses.length === 1 ? "" : "s"}`);
  if (parts.length) await logOrderEvent(db, order, "fulfilled", `Granted ${parts.join(" and ")}`, { actor });
  if (waiting) await logOrderEvent(db, order, "fulfillment", `${waiting} item${waiting === 1 ? "" : "s"} waiting to ship`, { actor });
  return { ...created, fulfilled };
}

/** Workflow run context for an order — the values the run history shows. */
export function orderContext(bundle) {
  if (!bundle?.order) return {};
  const { order, customer, gallery, items } = bundle;
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: (order.currency || "usd").toUpperCase() });
  return {
    order: order.number,
    total: money.format(order.totalCents / 100),
    customer: customer?.email || order.email || "",
    gallery: gallery?.name || "",
    items: String(items?.length ?? 0),
  };
}
