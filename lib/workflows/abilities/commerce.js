// Commerce abilities — what a workflow can test and do once a gallery order
// exists. Registered with the engine through ./index.js; the engine loads the
// order into `run.order` (a fulfilment bundle: order, items, customer, gallery,
// settings) for any event carrying an `orderId`.
//
// These are building blocks, not a fixed pipeline: the checkout core only
// records the order and delivers what was bought. Everything else — bonus
// downloads, extra licences, tagging buyers, memberships, royalties, sold
// collections — is a workflow someone assembles from the steps below.

import {
  grantEntitlements,
  issueLicense,
  itemAssetIds,
  loadOrderBundle,
  logOrderEvent,
  orderContext,
} from "@/lib/commerce/fulfillment";
import { RENDITIONS } from "@/lib/commerce/shape";

export class AbilitySkip extends Error {}

const KIND_LABELS = {
  Download: "download",
  Licence: "license",
  License: "license",
  Print: "print",
  "Physical product": "physical",
  Bundle: "bundle",
  "Gallery unlock": "unlock",
};

const RENDITION_BY_LABEL = Object.fromEntries(
  Object.entries(RENDITIONS).map(([key, r]) => [r.label, key]),
);

// Case-insensitive exact match for ilike: escape its % and _ wildcards.
function exactly(value) {
  return String(value).replace(/[\\%_]/g, (c) => `\\${c}`);
}

function requireOrder(run) {
  if (!run.order?.order) throw new AbilitySkip("No order in this event");
  return run.order;
}

function dollarsToCents(value) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

function money(bundle, cents) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (bundle.order.currency || "usd").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function purchasedAssetIds(bundle) {
  return [...new Set(bundle.items.flatMap(itemAssetIds))];
}

// Subjects -----------------------------------------------------------------------

/** Extra run fields for an event: the order bundle, when it names one. */
export async function loadCommerceSubject(db, event) {
  if (!event?.orderId) return {};
  const bundle = await loadOrderBundle(db, event.orderId);
  return bundle ? { order: bundle } : {};
}

export function commerceContext(run) {
  return run.order ? orderContext(run.order) : {};
}

/** The order slice of an http.webhook payload. */
export function commercePayload(run) {
  const bundle = run.order;
  if (!bundle?.order) return {};
  const { order, items, customer, gallery } = bundle;
  return {
    order: {
      id: order.id,
      number: order.number,
      status: order.status,
      totalCents: order.totalCents,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      taxCents: order.taxCents,
      refundedCents: order.refundedCents,
      currency: order.currency,
      provider: order.provider,
      paidAt: order.paidAt,
      items: items.map((i) => ({
        kind: i.kind,
        title: i.title,
        product: i.productName,
        assetId: i.assetId,
        assetIds: itemAssetIds(i),
        quantity: i.quantity,
        totalCents: i.totalCents,
        licenseId: i.licenseId,
      })),
    },
    customer: customer
      ? { id: customer.id, email: customer.email, name: customer.name, company: customer.company, ordersCount: customer.ordersCount }
      : null,
    gallery: gallery ? { id: gallery.id, name: gallery.name, slug: gallery.slug } : null,
  };
}

// Conditions ---------------------------------------------------------------------

function compare(op, left, right) {
  if (op === "less than") return left < right;
  if (op === "equal to") return left === right;
  if (op === "at least") return left >= right;
  return left > right;
}

export const commerceConditions = {
  "if.order_total": (step, run) => {
    if (!run.order) return { pass: false, note: "No order in this event" };
    const cents = dollarsToCents(step.config?.amount);
    if (!Number.isFinite(cents)) return { pass: false, note: "Amount isn't a number" };
    const total = run.order.order.totalCents;
    const op = step.config?.operator || "greater than";
    const pass = compare(op, total, cents);
    return { pass, note: pass ? "" : `Order total is ${money(run.order, total)}` };
  },
  "if.order_contains": (step, run) => {
    if (!run.order) return { pass: false, note: "No order in this event" };
    const want = KIND_LABELS[step.config?.kind] || String(step.config?.kind || "").toLowerCase();
    const pass = run.order.items.some((i) => i.kind === want);
    return { pass, note: pass ? "" : `Order has no ${step.config?.kind || want} items` };
  },
  "if.order_gallery": (step, run) => {
    if (!run.order) return { pass: false, note: "No order in this event" };
    const want = String(step.config?.gallery || "").trim().toLowerCase();
    if (!want) return { pass: false, note: "No gallery configured" };
    const g = run.order.gallery;
    const pass = Boolean(g) && [g.name, g.slug].some((v) => String(v || "").toLowerCase() === want);
    return { pass, note: pass ? "" : `Order came from ${g?.name || "another gallery"}` };
  },
  "if.repeat_customer": (step, run) => {
    if (!run.order) return { pass: false, note: "No order in this event" };
    const min = Math.max(1, Number(step.config?.minOrders) || 2);
    const count = run.order.customer?.ordersCount ?? 0;
    const pass = count >= min;
    return { pass, note: pass ? "" : `Customer has ${count} order${count === 1 ? "" : "s"}` };
  },
  "if.discount_used": (step, run) => {
    if (!run.order) return { pass: false, note: "No order in this event" };
    const used = run.order.order.discountCode;
    const want = String(step.config?.code || "").trim().toUpperCase();
    const pass = want ? used.toUpperCase() === want : Boolean(used);
    return { pass, note: pass ? "" : used ? `Order used ${used}` : "No discount on this order" };
  },
};

// Actions ------------------------------------------------------------------------

async function galleryAssetIds(db, bundle) {
  const gallery = bundle.gallery;
  if (!gallery) return [];
  const { data: g } = await db.from("galleries").select("source_kind, collection_id").eq("id", gallery.id).maybeSingle();
  if (g?.source_kind === "collection" && g.collection_id) {
    const { data } = await db.from("collection_assets").select("asset_id").eq("collection_id", g.collection_id);
    return (data || []).map((r) => r.asset_id);
  }
  const { data } = await db
    .from("gallery_items")
    .select("asset_id")
    .eq("gallery_id", gallery.id)
    .eq("is_hidden", false)
    .is("deleted_at", null);
  return (data || []).map((r) => r.asset_id);
}

async function grantDownloads(db, step, run) {
  const bundle = requireOrder(run);
  const config = step.config || {};
  const assetIds = config.scope === "Whole gallery" ? await galleryAssetIds(db, bundle) : purchasedAssetIds(bundle);
  if (!assetIds.length) throw new AbilitySkip("The order has no assets to grant");
  const rows = await grantEntitlements(db, {
    order: bundle.order,
    assetIds,
    rendition: RENDITION_BY_LABEL[config.rendition] || config.rendition || "original",
    downloadLimit: Number(config.downloadLimit) || 0,
    expiryDays: Number(config.expiryDays) || 0,
    source: "workflow",
  });
  await logOrderEvent(db, bundle.order, "entitlement", `Workflow granted ${rows.length} download${rows.length === 1 ? "" : "s"}`, {
    actor: `Workflow · ${run.workflow.name}`,
  });
  return `Granted ${rows.length} download${rows.length === 1 ? "" : "s"}`;
}

async function issueOrderLicense(db, step, run) {
  const bundle = requireOrder(run);
  const config = step.config || {};
  let templateId = null;
  const name = String(config.template || "").trim();
  if (name) {
    const { data } = await db
      .from("license_templates")
      .select("id")
      .eq("project_id", bundle.order.projectId)
      .ilike("name", exactly(name))
      .is("deleted_at", null)
      .limit(1);
    templateId = data?.[0]?.id ?? null;
    if (!templateId) throw new Error(`No licence template named "${name}"`);
  }
  const items = config.items === "Every item" ? bundle.items : bundle.items.filter((i) => !i.licenseId);
  if (!items.length) throw new AbilitySkip("Every item already carries a licence");
  const overrides = {
    ...(templateId ? { templateId } : {}),
    ...(config.durationMonths !== "" && config.durationMonths !== undefined ? { durationMonths: Number(config.durationMonths) || 0 } : {}),
    ...(config.usageType ? { usageType: String(config.usageType).toLowerCase() } : {}),
  };
  const issued = [];
  for (const item of items) {
    issued.push(await issueLicense(db, { order: bundle.order, item, customer: bundle.customer, overrides }));
  }
  await logOrderEvent(db, bundle.order, "license", `Workflow issued ${issued.map((l) => l.reference).join(", ")}`, {
    actor: `Workflow · ${run.workflow.name}`,
  });
  return `Issued ${issued.length} licence${issued.length === 1 ? "" : "s"}`;
}

async function markFulfilled(db, step, run) {
  const bundle = requireOrder(run);
  const { order } = bundle;
  if (!["paid", "fulfilled", "partially_refunded"].includes(order.status)) {
    throw new AbilitySkip(`Order is ${order.status}`);
  }
  const now = new Date().toISOString();
  await db.from("store_order_items").update({ status: "fulfilled" }).eq("order_id", order.id).eq("status", "pending");
  const { error } = await db
    .from("store_orders")
    .update({ fulfillment_status: "fulfilled", fulfilled_at: now, ...(order.status === "paid" ? { status: "fulfilled" } : {}) })
    .eq("id", order.id);
  if (error) throw new Error(error.message);
  await logOrderEvent(db, order, "fulfillment", "Marked fulfilled by a workflow", { actor: `Workflow · ${run.workflow.name}` });
  return "Order marked fulfilled";
}

async function addNote(db, step, run) {
  const bundle = requireOrder(run);
  const note = String(step.config?.note || "").trim();
  if (!note) throw new Error("No note configured");
  await logOrderEvent(db, bundle.order, "note", note, { actor: `Workflow · ${run.workflow.name}` });
  return "Note added to the order";
}

async function tagCustomer(db, step, run) {
  const bundle = requireOrder(run);
  const customer = bundle.customer;
  if (!customer) throw new AbilitySkip("The order has no customer");
  const tag = String(step.config?.tag || "").trim();
  if (!tag) throw new Error("No tag configured");
  if (customer.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return `Already tagged "${tag}"`;
  const tags = [...customer.tags, tag];
  const { error } = await db.from("store_customers").update({ tags }).eq("id", customer.id);
  if (error) throw new Error(error.message);
  customer.tags = tags;
  return `Customer tagged "${tag}"`;
}

async function grantMembership(db, step, run) {
  const bundle = requireOrder(run);
  const customer = bundle.customer;
  if (!customer?.email) throw new AbilitySkip("The order has no customer email");
  const tierName = String(step.config?.tier || "").trim();
  if (!tierName) throw new Error("No tier configured");
  const projectId = bundle.order.projectId;

  const { data: tiers } = await db
    .from("membership_tiers")
    .select("id, name, interval")
    .eq("project_id", projectId)
    .ilike("name", exactly(tierName))
    .is("deleted_at", null)
    .limit(1);
  const tier = tiers?.[0];
  if (!tier) throw new Error(`No membership tier named "${tierName}"`);

  const { data: existing } = await db
    .from("members")
    .select("id")
    .eq("project_id", projectId)
    .eq("fan_email", customer.email)
    .is("deleted_at", null)
    .maybeSingle();
  let memberId = existing?.id;
  if (!memberId) {
    const { data: member, error } = await db
      .from("members")
      .insert({
        project_id: projectId,
        fan_name: customer.name || customer.email,
        fan_email: customer.email,
        status: "active",
        metadata: { customerId: customer.id, source: "gallery_order" },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    memberId = member.id;
  }

  const months = Math.max(0, Number(step.config?.months) || 0) || (tier.interval === "year" ? 12 : 1);
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  const { error } = await db.from("subscriptions").insert({
    project_id: projectId,
    member_id: memberId,
    tier_id: tier.id,
    status: "active",
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    cancel_at_period_end: true,
    metadata: { orderId: bundle.order.id, source: "gallery_order" },
  });
  if (error) throw new Error(error.message);
  return `${customer.email} joined ${tier.name} for ${months} month${months === 1 ? "" : "s"}`;
}

async function accrueRoyalties(db, step, run) {
  const bundle = requireOrder(run);
  const licenseIds = bundle.items.map((i) => i.licenseId).filter(Boolean);
  if (!licenseIds.length) throw new AbilitySkip("No licences on this order to accrue against");

  const projectId = bundle.order.projectId;
  const [{ data: rules }, { data: licenses }, { data: items }] = await Promise.all([
    db.from("royalty_rules").select("*").eq("project_id", projectId).eq("is_active", true).is("deleted_at", null),
    db.from("licenses").select("id, template_id, fee_cents, currency").in("id", licenseIds),
    db.from("license_items").select("license_id, asset_id, collection_id, rights_record_id").in("license_id", licenseIds),
  ]);
  if (!rules?.length) throw new AbilitySkip("No active royalty rules");

  const lines = [];
  for (const license of licenses || []) {
    const own = (items || []).filter((i) => i.license_id === license.id);
    const matches = (rule) => {
      switch (rule.scope_kind) {
        case "global":
          return true;
        case "template":
          return rule.scope_id === license.template_id;
        case "asset":
          return own.some((i) => i.asset_id === rule.scope_id);
        case "collection":
          return own.some((i) => i.collection_id === rule.scope_id);
        case "rights_record":
          return own.some((i) => i.rights_record_id === rule.scope_id);
        default:
          return false;
      }
    };
    for (const rule of rules.filter(matches)) {
      const basis = Number(license.fee_cents) || 0;
      const amount = Math.round((basis * Number(rule.rate_percent || 0)) / 100) + (Number(rule.flat_cents) || 0);
      if (amount <= 0) continue;
      lines.push({
        project_id: projectId,
        license_id: license.id,
        rights_holder_id: rule.rights_holder_id,
        royalty_rule_id: rule.id,
        basis_cents: basis,
        rate_percent: rule.rate_percent,
        amount_cents: amount,
        currency: license.currency || bundle.order.currency,
        period_start: new Date().toISOString().slice(0, 10),
        status: "accrued",
        note: `Order ${bundle.order.number}`,
        metadata: { orderId: bundle.order.id, workflowId: run.workflow.id },
      });
    }
  }
  if (!lines.length) throw new AbilitySkip("No royalty rule matched this order's licences");
  const { error } = await db.from("royalty_lines").insert(lines);
  if (error) throw new Error(error.message);
  const total = lines.reduce((s, l) => s + l.amount_cents, 0);
  return `Accrued ${lines.length} royalty line${lines.length === 1 ? "" : "s"} (${money(bundle, total)})`;
}

async function addToCollection(db, step, run) {
  const bundle = requireOrder(run);
  const name = String(step.config?.collection || "").trim();
  if (!name) throw new Error("No collection configured");
  const projectId = bundle.order.projectId;
  const { data: found } = await db
    .from("collections")
    .select("id, name")
    .eq("project_id", projectId)
    .ilike("name", exactly(name))
    .is("deleted_at", null)
    .limit(1);
  let collection = found?.[0];
  if (!collection) {
    const { data, error } = await db
      .from("collections")
      .insert({ project_id: projectId, name })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    collection = data;
  }
  const assetIds = purchasedAssetIds(bundle);
  if (!assetIds.length) throw new AbilitySkip("The order has no assets");
  const { data: present } = await db
    .from("collection_assets")
    .select("asset_id")
    .eq("collection_id", collection.id)
    .in("asset_id", assetIds);
  const have = new Set((present || []).map((r) => r.asset_id));
  const fresh = assetIds.filter((id) => !have.has(id));
  if (fresh.length) {
    const { error } = await db
      .from("collection_assets")
      .insert(fresh.map((assetId, i) => ({ collection_id: collection.id, asset_id: assetId, position: i })));
    if (error) throw new Error(error.message);
  }
  return fresh.length ? `Added ${fresh.length} asset${fresh.length === 1 ? "" : "s"} to ${collection.name}` : `Already in ${collection.name}`;
}

export const commerceActions = {
  "order.grant_downloads": grantDownloads,
  "order.issue_license": issueOrderLicense,
  "order.mark_fulfilled": markFulfilled,
  "order.add_note": addNote,
  "customer.tag": tagCustomer,
  "customer.grant_membership": grantMembership,
  "royalty.accrue": accrueRoyalties,
  "order.add_to_collection": addToCollection,
};
