// Pure shapes for gallery commerce — defaults, snake_case -> camelCase
// normalizers and camelCase -> snake_case column maps for every store table.
//
// Deliberately free of "use client" and of any Supabase client so the browser
// data layer (lib/supabase/store.js), the server checkout core
// (lib/commerce/server.js) and the workflow abilities can all share them.

export const PRODUCT_KINDS = ["download", "license", "print", "physical", "bundle", "unlock"];

// Kinds you produce and ship: they sell in multiples, need a shipping address
// when asked, and hold the order open until staff mark them shipped.
export const SHIPPED_KINDS = new Set(["print", "physical"]);

export function isShippedKind(kind) {
  return SHIPPED_KINDS.has(kind);
}

/** Whether any of these offers ships and asks for a shipping address. */
export function offersNeedShipping(offers) {
  return (offers || []).some((o) => o && isShippedKind(o.kind) && o.fulfillment?.requiresShipping !== false);
}

// Renditions a download can deliver. `maxEdge` null = the untouched original.
export const RENDITIONS = {
  original: { label: "Original file", maxEdge: null },
  xlarge: { label: "Extra large (4096px)", maxEdge: 4096 },
  large: { label: "Large (2048px)", maxEdge: 2048 },
  medium: { label: "Medium (1200px)", maxEdge: 1200 },
  small: { label: "Small web (800px)", maxEdge: 800 },
};

export const RENDITION_FORMATS = ["original", "jpg", "webp", "png"];

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "fulfilled",
  "partially_refunded",
  "refunded",
  "cancelled",
  "failed",
];

// Statuses that count as money actually taken.
export const REVENUE_STATUSES = new Set(["paid", "fulfilled", "partially_refunded"]);

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function int(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function meta(row) {
  return obj(row?.metadata);
}

/** camelCase patch -> snake_case columns, emitting only the keys present. */
export function mapRow(input, map, { numerics = [] } = {}) {
  const row = {};
  for (const [key, col] of Object.entries(map)) {
    if (!(key in input)) continue;
    row[col] = numerics.includes(key) ? int(input[key]) : input[key];
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  if (input.id) row.id = input.id;
  return row;
}

// Product fulfilment ------------------------------------------------------------

const FULFILLMENT_DEFAULTS = {
  download: { rendition: "original", format: "original", downloadLimit: 5, expiryDays: 30, watermarkFree: true },
  license: {
    durationMonths: 12,
    usageType: "web",
    territories: ["worldwide"],
    channels: ["web"],
    exclusivity: "non_exclusive",
    includeDownload: true,
    rendition: "original",
    downloadLimit: 5,
    expiryDays: 30,
    requiresApproval: false,
  },
  print: { size: "8×10 in", paper: "Lustre", finish: "Unframed", requiresShipping: true, productionDays: 5, includeDownload: false, rendition: "small", downloadLimit: 1, expiryDays: 14 },
  physical: { variant: "", requiresShipping: true, productionDays: 3 },
  bundle: { size: 5, rendition: "original", format: "original", downloadLimit: 5, expiryDays: 30 },
  unlock: { rendition: "original", format: "original", downloadLimit: 0, expiryDays: 90, includeFuture: true },
};

export function fulfillmentDefaults(kind) {
  return { ...(FULFILLMENT_DEFAULTS[kind] || FULFILLMENT_DEFAULTS.download) };
}

export function withFulfillment(kind, value) {
  return { ...fulfillmentDefaults(kind), ...obj(value) };
}

/** Whether a product (or order item) of this kind hands the buyer files. */
export function deliversFiles(kind, fulfillment) {
  if (kind === "download" || kind === "bundle" || kind === "unlock") return true;
  return Boolean(fulfillment?.includeDownload);
}

// Settings ----------------------------------------------------------------------

export const SETTINGS_DEFAULTS = {
  store: { name: "", supportEmail: "", currency: "usd" },
  checkout: {
    guestCheckout: true,
    collectName: true,
    collectCompany: false,
    collectPhone: false,
    collectAddress: false,
    allowNotes: true,
    requireTerms: true,
    marketingOptIn: false,
    allowDiscounts: true,
    minimumOrderCents: 0,
    maxItems: 50,
    thankYouMessage: "",
  },
  payments: { mode: "auto", statementDescriptor: "", allowManual: false },
  taxes: { enabled: false, ratePercent: 0, label: "Tax", inclusive: false },
  fulfillment: { autoFulfill: true, issueLicenses: true, downloadLimit: 5, expiryDays: 30, receiptNote: "" },
  policies: { terms: "", refunds: "", privacy: "" },
  invoices: { orderPrefix: "ORD-", invoicePrefix: "INV-", sellerName: "", sellerAddress: "", taxId: "", footer: "" },
};

export const SETTINGS_GROUPS = Object.keys(SETTINGS_DEFAULTS);

export function normalizeStoreSettings(row) {
  const settings = { id: row?.id ?? null, projectId: row?.project_id ?? null };
  for (const group of SETTINGS_GROUPS) {
    settings[group] = { ...SETTINGS_DEFAULTS[group], ...obj(row?.[group]) };
  }
  settings.nextOrderNumber = int(row?.next_order_number, 1);
  settings.updatedAt = row?.updated_at ?? "";
  return settings;
}

export function storeSettingsRow(input) {
  const row = {};
  if ("projectId" in input) row.project_id = input.projectId;
  for (const group of SETTINGS_GROUPS) if (group in input) row[group] = obj(input[group]);
  return row;
}

// Products ----------------------------------------------------------------------

export const PRODUCT_MAP = {
  projectId: "project_id",
  name: "name",
  description: "description",
  kind: "kind",
  priceCents: "price_cents",
  compareAtCents: "compare_at_cents",
  currency: "currency",
  sku: "sku",
  status: "status",
  fulfillment: "fulfillment",
  licenseTemplateId: "license_template_id",
  position: "position",
  createdBy: "created_by",
};

export const PRODUCT_NUMERICS = ["priceCents", "compareAtCents", "position"];

export function normalizeProduct(row) {
  if (!row) return null;
  const kind = PRODUCT_KINDS.includes(row.kind) ? row.kind : "download";
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    description: row.description ?? "",
    kind,
    priceCents: int(row.price_cents),
    compareAtCents: int(row.compare_at_cents),
    currency: row.currency ?? "usd",
    sku: row.sku ?? "",
    status: row.status ?? "active",
    fulfillment: withFulfillment(kind, row.fulfillment),
    licenseTemplateId: row.license_template_id ?? null,
    position: int(row.position),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

// Price sheets ------------------------------------------------------------------

export const SHEET_MAP = {
  projectId: "project_id",
  name: "name",
  description: "description",
  currency: "currency",
  lines: "lines",
  isDefault: "is_default",
  status: "status",
  createdBy: "created_by",
};

export function normalizeSheetLine(line, index = 0) {
  const l = obj(line);
  const price = l.priceCents;
  return {
    productId: l.productId ?? null,
    priceCents: price === null || price === undefined || price === "" ? null : int(price),
    position: int(l.position, index),
  };
}

export function normalizePriceSheet(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    description: row.description ?? "",
    currency: row.currency ?? "usd",
    lines: arr(row.lines)
      .map(normalizeSheetLine)
      .filter((l) => l.productId)
      .sort((a, b) => a.position - b.position),
    isDefault: Boolean(row.is_default),
    status: row.status ?? "active",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

// Discounts ---------------------------------------------------------------------

export const DISCOUNT_MAP = {
  projectId: "project_id",
  code: "code",
  description: "description",
  kind: "kind",
  value: "value",
  minSubtotalCents: "min_subtotal_cents",
  maxRedemptions: "max_redemptions",
  redemptions: "redemptions",
  galleryId: "gallery_id",
  startsAt: "starts_at",
  endsAt: "ends_at",
  status: "status",
  createdBy: "created_by",
};

export const DISCOUNT_NUMERICS = ["value", "minSubtotalCents", "maxRedemptions", "redemptions"];

export function normalizeDiscount(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    code: String(row.code ?? "").toUpperCase(),
    description: row.description ?? "",
    kind: row.kind === "fixed" ? "fixed" : "percent",
    value: int(row.value),
    minSubtotalCents: int(row.min_subtotal_cents),
    maxRedemptions: int(row.max_redemptions),
    redemptions: int(row.redemptions),
    galleryId: row.gallery_id ?? null,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    status: row.status ?? "active",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

// Customers ---------------------------------------------------------------------

export const CUSTOMER_MAP = {
  projectId: "project_id",
  email: "email",
  name: "name",
  company: "company",
  phone: "phone",
  country: "country",
  address: "address",
  tags: "tags",
  notes: "notes",
  licenseeId: "licensee_id",
  status: "status",
  marketingOptIn: "marketing_opt_in",
  ordersCount: "orders_count",
  totalSpentCents: "total_spent_cents",
  firstOrderAt: "first_order_at",
  lastOrderAt: "last_order_at",
  createdBy: "created_by",
};

export const CUSTOMER_NUMERICS = ["ordersCount", "totalSpentCents"];

export function normalizeCustomer(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    email: row.email ?? "",
    name: row.name ?? "",
    company: row.company ?? "",
    phone: row.phone ?? "",
    country: row.country ?? "",
    address: obj(row.address),
    tags: arr(row.tags),
    notes: row.notes ?? "",
    licenseeId: row.licensee_id ?? null,
    status: row.status ?? "active",
    marketingOptIn: Boolean(row.marketing_opt_in),
    ordersCount: int(row.orders_count),
    totalSpentCents: int(row.total_spent_cents),
    firstOrderAt: row.first_order_at ?? null,
    lastOrderAt: row.last_order_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

// Orders ------------------------------------------------------------------------

export const ORDER_MAP = {
  projectId: "project_id",
  number: "number",
  galleryId: "gallery_id",
  customerId: "customer_id",
  email: "email",
  name: "name",
  status: "status",
  fulfillmentStatus: "fulfillment_status",
  subtotalCents: "subtotal_cents",
  discountCents: "discount_cents",
  taxCents: "tax_cents",
  totalCents: "total_cents",
  refundedCents: "refunded_cents",
  currency: "currency",
  discountCode: "discount_code",
  provider: "provider",
  providerRef: "provider_ref",
  billing: "billing",
  customerNote: "customer_note",
  staffNote: "staff_note",
  termsAcceptedAt: "terms_accepted_at",
  paidAt: "paid_at",
  fulfilledAt: "fulfilled_at",
  refundedAt: "refunded_at",
  cancelledAt: "cancelled_at",
  createdBy: "created_by",
};

export const ORDER_NUMERICS = ["subtotalCents", "discountCents", "taxCents", "totalCents", "refundedCents"];

export function normalizeOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    number: row.number ?? "",
    galleryId: row.gallery_id ?? null,
    customerId: row.customer_id ?? null,
    email: row.email ?? "",
    name: row.name ?? "",
    status: row.status ?? "pending",
    fulfillmentStatus: row.fulfillment_status ?? "unfulfilled",
    subtotalCents: int(row.subtotal_cents),
    discountCents: int(row.discount_cents),
    taxCents: int(row.tax_cents),
    totalCents: int(row.total_cents),
    refundedCents: int(row.refunded_cents),
    currency: row.currency ?? "usd",
    discountCode: row.discount_code ?? "",
    provider: row.provider ?? "test",
    providerRef: row.provider_ref ?? "",
    accessToken: row.access_token ?? "",
    billing: obj(row.billing),
    customerNote: row.customer_note ?? "",
    staffNote: row.staff_note ?? "",
    termsAcceptedAt: row.terms_accepted_at ?? null,
    paidAt: row.paid_at ?? null,
    fulfilledAt: row.fulfilled_at ?? null,
    refundedAt: row.refunded_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

export const ORDER_ITEM_MAP = {
  projectId: "project_id",
  orderId: "order_id",
  productId: "product_id",
  assetId: "asset_id",
  kind: "kind",
  title: "title",
  productName: "product_name",
  unitCents: "unit_cents",
  quantity: "quantity",
  totalCents: "total_cents",
  fulfillment: "fulfillment",
  licenseId: "license_id",
  status: "status",
};

export function normalizeOrderItem(row) {
  if (!row) return null;
  const kind = row.kind ?? "download";
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    orderId: row.order_id ?? null,
    productId: row.product_id ?? null,
    assetId: row.asset_id ?? null,
    kind,
    title: row.title ?? "",
    productName: row.product_name ?? "",
    unitCents: int(row.unit_cents),
    quantity: Math.max(1, int(row.quantity, 1)),
    totalCents: int(row.total_cents),
    fulfillment: withFulfillment(kind, row.fulfillment),
    licenseId: row.license_id ?? null,
    status: row.status ?? "pending",
    createdAt: row.created_at ?? "",
    ...meta(row),
  };
}

export function normalizeOrderEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id ?? null,
    kind: row.kind ?? "note",
    summary: row.summary ?? "",
    actor: row.actor ?? "",
    occurredAt: row.occurred_at ?? row.created_at ?? "",
    ...meta(row),
  };
}

// Entitlements ------------------------------------------------------------------

export const ENTITLEMENT_MAP = {
  projectId: "project_id",
  orderId: "order_id",
  orderItemId: "order_item_id",
  customerId: "customer_id",
  assetId: "asset_id",
  rendition: "rendition",
  maxDownloads: "max_downloads",
  downloadsCount: "downloads_count",
  expiresAt: "expires_at",
  revokedAt: "revoked_at",
  lastDownloadedAt: "last_downloaded_at",
  source: "source",
  createdBy: "created_by",
};

export const ENTITLEMENT_NUMERICS = ["maxDownloads", "downloadsCount"];

/** Why an entitlement can't be downloaded right now, or null when it can. */
export function entitlementProblem(e, now = Date.now()) {
  if (!e) return "missing";
  if (e.revokedAt) return "revoked";
  if (e.expiresAt && new Date(e.expiresAt).getTime() < now) return "expired";
  if (e.maxDownloads > 0 && e.downloadsCount >= e.maxDownloads) return "exhausted";
  return null;
}

/** An entitlement with a camelCase patch applied and its state re-derived. */
export function withEntitlementPatch(e, patch) {
  const next = { ...e, ...patch };
  next.problem = entitlementProblem(next);
  return next;
}

export function normalizeEntitlement(row) {
  if (!row) return null;
  const e = {
    id: row.id,
    projectId: row.project_id ?? null,
    orderId: row.order_id ?? null,
    orderItemId: row.order_item_id ?? null,
    customerId: row.customer_id ?? null,
    assetId: row.asset_id ?? null,
    token: row.token ?? "",
    rendition: RENDITIONS[row.rendition] ? row.rendition : "original",
    maxDownloads: int(row.max_downloads),
    downloadsCount: int(row.downloads_count),
    expiresAt: row.expires_at ?? null,
    revokedAt: row.revoked_at ?? null,
    lastDownloadedAt: row.last_downloaded_at ?? null,
    source: row.source ?? "order",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
  e.problem = entitlementProblem(e);
  return e;
}

// Gallery commerce bag -----------------------------------------------------------

export const COMMERCE_DEFAULTS = {
  enabled: false,
  // Products offered on every asset, from a price sheet.
  priceSheetId: null,
  // A direct price per asset, independent of any sheet.
  perAsset: { enabled: false, label: "Digital download", defaultPriceCents: 0, productId: null },
  // { [assetId]: { priceCents: number|null, notForSale: bool, overrides: { [productId]: cents } } }
  assetPrices: {},
  // One price for everything in the gallery.
  unlock: { enabled: false, label: "Unlock the full gallery", description: "", priceCents: 0, productId: null },
  display: { showPrices: true, ctaLabel: "Buy", showCompareAt: true, cartLabel: "Cart" },
  checkout: { thankYouMessage: "", allowDiscounts: true },
};

export function withCommerceDefaults(value) {
  const c = obj(value);
  return {
    ...COMMERCE_DEFAULTS,
    ...c,
    perAsset: { ...COMMERCE_DEFAULTS.perAsset, ...obj(c.perAsset) },
    assetPrices: obj(c.assetPrices),
    unlock: { ...COMMERCE_DEFAULTS.unlock, ...obj(c.unlock) },
    display: { ...COMMERCE_DEFAULTS.display, ...obj(c.display) },
    checkout: { ...COMMERCE_DEFAULTS.checkout, ...obj(c.checkout) },
  };
}

/** "ORD-" + 42 -> "ORD-0042". */
export function formatOrderNumber(prefix, n) {
  return `${prefix || ""}${String(Math.max(1, int(n, 1))).padStart(4, "0")}`;
}
