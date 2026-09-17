// Data-access layer for the galleries domain — owns the `assets` schema tables:
//   assets.galleries, assets.showcases, assets.gallery_domains,
//   assets.storefront_pages, assets.digital_downloads, assets.gallery_products,
//   assets.checkout_configs, assets.gallery_orders, assets.gallery_customers
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

function meta(row) {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

function toRowGeneric(input, map) {
  const row = {};
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

async function listRows(table, projectId, normalize) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    let q = sb.from(table).select("*").is("deleted_at", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) {
      console.error(`[galleries.${table}.list]`, error.message);
      return null;
    }
    return (data || []).map(normalize);
  } catch (err) {
    console.error(`[galleries.${table}.list]`, err?.message);
    return null;
  }
}

async function getRow(table, id, normalize) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(table)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error(`[galleries.${table}.get]`, error.message);
      return null;
    }
    return normalize(data);
  } catch (err) {
    console.error(`[galleries.${table}.get]`, err?.message);
    return null;
  }
}

async function createRow(table, input, normalize) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.from(table).insert(input).select("*").single();
    if (error) {
      console.error(`[galleries.${table}.create]`, error.message);
      return null;
    }
    return normalize ? normalize(data) : data;
  } catch (err) {
    console.error(`[galleries.${table}.create]`, err?.message);
    return null;
  }
}

async function updateRow(table, id, patch, normalize) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(table)
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error(`[galleries.${table}.update]`, error.message);
      return false;
    }
    return normalize ? normalize(data) : true;
  } catch (err) {
    console.error(`[galleries.${table}.update]`, err?.message);
    return false;
  }
}

async function softDeleteRow(table, id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error(`[galleries.${table}.delete]`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[galleries.${table}.delete]`, err?.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Galleries (builder)
// ---------------------------------------------------------------------------

const GALLERY_MAP = {
  projectId: "project_id",
  collectionId: "collection_id",
  name: "name",
  slug: "slug",
  description: "description",
  layout: "layout",
  theme: "theme",
  navigationStyle: "navigation_style",
  status: "status",
  isPublished: "is_published",
  createdBy: "created_by",
};

export function normalizeGallery(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    collectionId: row.collection_id ?? null,
    name: row.name ?? "",
    slug: row.slug ?? "",
    description: row.description ?? "",
    layout: row.layout ?? "grid",
    theme: row.theme ?? "dark",
    navigationStyle: row.navigation_style ?? "topbar",
    status: row.status ?? "draft",
    isPublished: Boolean(row.is_published),
    viewCount: Number(row.view_count ?? 0),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toGalleryRow(input) {
  const row = toRowGeneric(input, GALLERY_MAP);
  if ("viewCount" in input) row.view_count = Number(input.viewCount) || 0;
  if ("collectionId" in input) row.collection_id = input.collectionId || null;
  return row;
}

export const listGalleries = (projectId) =>
  listRows("galleries", projectId, normalizeGallery);
export const getGallery = (id) => getRow("galleries", id, normalizeGallery);
export const createGallery = (input) =>
  createRow(
    "galleries",
    { ...toGalleryRow(input), ...(input.id ? { id: input.id } : {}) },
    normalizeGallery,
  );
export const updateGallery = (id, input) =>
  updateRow("galleries", id, toGalleryRow(input), normalizeGallery);
export const softDeleteGallery = (id) => softDeleteRow("galleries", id);

// ---------------------------------------------------------------------------
// Showcases
// ---------------------------------------------------------------------------

const SHOWCASE_MAP = {
  projectId: "project_id",
  galleryId: "gallery_id",
  name: "name",
  description: "description",
  visibility: "visibility",
  status: "status",
  isPasswordProtected: "is_password_protected",
  proofingEnabled: "proofing_enabled",
  downloadsEnabled: "downloads_enabled",
  createdBy: "created_by",
};

export function normalizeShowcase(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    galleryId: row.gallery_id ?? null,
    name: row.name ?? "",
    description: row.description ?? "",
    visibility: row.visibility ?? "private",
    status: row.status ?? "draft",
    isPasswordProtected: Boolean(row.is_password_protected),
    proofingEnabled: Boolean(row.proofing_enabled),
    downloadsEnabled: Boolean(row.downloads_enabled),
    viewCount: Number(row.view_count ?? 0),
    favoriteCount: Number(row.favorite_count ?? 0),
    downloadRequestCount: Number(row.download_request_count ?? 0),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toShowcaseRow(input) {
  const row = toRowGeneric(input, SHOWCASE_MAP);
  if ("viewCount" in input) row.view_count = Number(input.viewCount) || 0;
  if ("favoriteCount" in input) row.favorite_count = Number(input.favoriteCount) || 0;
  if ("downloadRequestCount" in input)
    row.download_request_count = Number(input.downloadRequestCount) || 0;
  if ("galleryId" in input) row.gallery_id = input.galleryId || null;
  return row;
}

export const listShowcases = (projectId) =>
  listRows("showcases", projectId, normalizeShowcase);
export const getShowcase = (id) => getRow("showcases", id, normalizeShowcase);
export const createShowcase = (input) =>
  createRow(
    "showcases",
    { ...toShowcaseRow(input), ...(input.id ? { id: input.id } : {}) },
    normalizeShowcase,
  );
export const updateShowcase = (id, input) =>
  updateRow("showcases", id, toShowcaseRow(input), normalizeShowcase);
export const softDeleteShowcase = (id) => softDeleteRow("showcases", id);

// ---------------------------------------------------------------------------
// Gallery domains
// ---------------------------------------------------------------------------

const DOMAIN_MAP = {
  projectId: "project_id",
  domain: "domain",
  domainType: "domain_type",
  sslStatus: "ssl_status",
  verificationStatus: "verification_status",
  isPrimary: "is_primary",
  seoTitle: "seo_title",
  seoDescription: "seo_description",
  verifiedAt: "verified_at",
  createdBy: "created_by",
};

export function normalizeGalleryDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    domain: row.domain ?? "",
    domainType: row.domain_type ?? "custom",
    sslStatus: row.ssl_status ?? "pending",
    verificationStatus: row.verification_status ?? "unverified",
    isPrimary: Boolean(row.is_primary),
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
    verifiedAt: row.verified_at ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toDomainRow(input) {
  const row = toRowGeneric(input, DOMAIN_MAP);
  if ("verifiedAt" in input) row.verified_at = input.verifiedAt || null;
  return row;
}

export const listGalleryDomains = (projectId) =>
  listRows("gallery_domains", projectId, normalizeGalleryDomain);
export const getGalleryDomain = (id) =>
  getRow("gallery_domains", id, normalizeGalleryDomain);
export const createGalleryDomain = (input) =>
  createRow(
    "gallery_domains",
    { ...toDomainRow(input), ...(input.id ? { id: input.id } : {}) },
    normalizeGalleryDomain,
  );
export const updateGalleryDomain = (id, input) =>
  updateRow("gallery_domains", id, toDomainRow(input), normalizeGalleryDomain);
export const softDeleteGalleryDomain = (id) => softDeleteRow("gallery_domains", id);

// ---------------------------------------------------------------------------
// Storefront pages
// ---------------------------------------------------------------------------

const STOREFRONT_MAP = {
  projectId: "project_id",
  name: "name",
  slug: "slug",
  pageType: "page_type",
  status: "status",
  cartEnabled: "cart_enabled",
  accountsEnabled: "accounts_enabled",
  isPublished: "is_published",
  createdBy: "created_by",
};

export function normalizeStorefrontPage(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    slug: row.slug ?? "",
    description: row.description ?? "",
    pageType: row.page_type ?? "product",
    status: row.status ?? "draft",
    cartEnabled: Boolean(row.cart_enabled),
    accountsEnabled: Boolean(row.accounts_enabled),
    isPublished: Boolean(row.is_published),
    viewCount: Number(row.view_count ?? 0),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toStorefrontRow(input) {
  const row = toRowGeneric(input, STOREFRONT_MAP);
  if ("description" in input) row.description = input.description ?? "";
  if ("viewCount" in input) row.view_count = Number(input.viewCount) || 0;
  return row;
}

export const listStorefrontPages = (projectId) =>
  listRows("storefront_pages", projectId, normalizeStorefrontPage);
export const getStorefrontPage = (id) =>
  getRow("storefront_pages", id, normalizeStorefrontPage);
export const createStorefrontPage = (input) =>
  createRow(
    "storefront_pages",
    { ...toStorefrontRow(input), ...(input.id ? { id: input.id } : {}) },
    normalizeStorefrontPage,
  );
export const updateStorefrontPage = (id, input) =>
  updateRow("storefront_pages", id, toStorefrontRow(input), normalizeStorefrontPage);
export const softDeleteStorefrontPage = (id) => softDeleteRow("storefront_pages", id);

// ---------------------------------------------------------------------------
// Digital downloads
// ---------------------------------------------------------------------------

const DOWNLOAD_MAP = {
  projectId: "project_id",
  assetId: "asset_id",
  name: "name",
  fileName: "file_name",
  rendition: "rendition",
  status: "status",
  downloadLimit: "download_limit",
  downloadCount: "download_count",
  customerEmail: "customer_email",
  expiresAt: "expires_at",
  lastDeliveredAt: "last_delivered_at",
  createdBy: "created_by",
};

export function normalizeDownload(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    assetId: row.asset_id ?? null,
    name: row.name ?? "",
    fileName: row.file_name ?? "",
    rendition: row.rendition ?? "original",
    status: row.status ?? "active",
    downloadLimit: Number(row.download_limit ?? 5),
    downloadCount: Number(row.download_count ?? 0),
    customerEmail: row.customer_email ?? "",
    expiresAt: row.expires_at ?? "",
    lastDeliveredAt: row.last_delivered_at ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toDownloadRow(input) {
  const row = toRowGeneric(input, DOWNLOAD_MAP);
  if ("assetId" in input) row.asset_id = input.assetId || null;
  if ("expiresAt" in input) row.expires_at = input.expiresAt || null;
  if ("lastDeliveredAt" in input) row.last_delivered_at = input.lastDeliveredAt || null;
  return row;
}

export const listDownloads = (projectId) =>
  listRows("digital_downloads", projectId, normalizeDownload);
export const getDownload = (id) => getRow("digital_downloads", id, normalizeDownload);
export const createDownload = (input) =>
  createRow(
    "digital_downloads",
    { ...toDownloadRow(input), ...(input.id ? { id: input.id } : {}) },
    normalizeDownload,
  );
export const updateDownload = (id, input) =>
  updateRow("digital_downloads", id, toDownloadRow(input), normalizeDownload);
export const softDeleteDownload = (id) => softDeleteRow("digital_downloads", id);

// ---------------------------------------------------------------------------
// Gallery products
// ---------------------------------------------------------------------------

const PRODUCT_MAP = {
  projectId: "project_id",
  name: "name",
  description: "description",
  productType: "product_type",
  status: "status",
  currency: "currency",
  licenseType: "license_type",
  createdBy: "created_by",
};

export function normalizeGalleryProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    description: row.description ?? "",
    productType: row.product_type ?? "digital",
    status: row.status ?? "draft",
    priceCents: Number(row.price_cents ?? 0),
    currency: row.currency ?? "usd",
    licenseType: row.license_type ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toProductRow(input) {
  const row = toRowGeneric(input, PRODUCT_MAP);
  if ("priceCents" in input) row.price_cents = Number(input.priceCents) || 0;
  return row;
}

export const listGalleryProducts = (projectId) =>
  listRows("gallery_products", projectId, normalizeGalleryProduct);
export const getGalleryProduct = (id) =>
  getRow("gallery_products", id, normalizeGalleryProduct);
export const createGalleryProduct = (input) =>
  createRow(
    "gallery_products",
    { ...toProductRow(input), ...(input.id ? { id: input.id } : {}) },
    normalizeGalleryProduct,
  );
export const updateGalleryProduct = (id, input) =>
  updateRow("gallery_products", id, toProductRow(input), normalizeGalleryProduct);
export const softDeleteGalleryProduct = (id) => softDeleteRow("gallery_products", id);

// ---------------------------------------------------------------------------
// Checkout configs
// ---------------------------------------------------------------------------

const CHECKOUT_MAP = {
  projectId: "project_id",
  name: "name",
  description: "description",
  checkoutMode: "checkout_mode",
  paymentProvider: "payment_provider",
  taxEnabled: "tax_enabled",
  termsRequired: "terms_required",
  status: "status",
  isDefault: "is_default",
  createdBy: "created_by",
};

export function normalizeCheckoutConfig(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    description: row.description ?? "",
    checkoutMode: row.checkout_mode ?? "both",
    paymentProvider: row.payment_provider ?? "manual",
    taxEnabled: Boolean(row.tax_enabled),
    termsRequired: row.terms_required !== false,
    status: row.status ?? "draft",
    isDefault: Boolean(row.is_default),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toCheckoutRow(input) {
  return toRowGeneric(input, CHECKOUT_MAP);
}

export const listCheckoutConfigs = (projectId) =>
  listRows("checkout_configs", projectId, normalizeCheckoutConfig);
export const getCheckoutConfig = (id) =>
  getRow("checkout_configs", id, normalizeCheckoutConfig);
export const createCheckoutConfig = (input) =>
  createRow(
    "checkout_configs",
    { ...toCheckoutRow(input), ...(input.id ? { id: input.id } : {}) },
    normalizeCheckoutConfig,
  );
export const updateCheckoutConfig = (id, input) =>
  updateRow("checkout_configs", id, toCheckoutRow(input), normalizeCheckoutConfig);
export const softDeleteCheckoutConfig = (id) => softDeleteRow("checkout_configs", id);

// ---------------------------------------------------------------------------
// Gallery orders
// ---------------------------------------------------------------------------

const ORDER_MAP = {
  projectId: "project_id",
  customerId: "customer_id",
  orderNumber: "order_number",
  customerName: "customer_name",
  customerEmail: "customer_email",
  status: "status",
  invoiceStatus: "invoice_status",
  currency: "currency",
  createdBy: "created_by",
};

export function normalizeGalleryOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    customerId: row.customer_id ?? null,
    orderNumber: row.order_number ?? "",
    customerName: row.customer_name ?? "",
    customerEmail: row.customer_email ?? "",
    status: row.status ?? "pending",
    invoiceStatus: row.invoice_status ?? "draft",
    totalCents: Number(row.total_cents ?? 0),
    taxCents: Number(row.tax_cents ?? 0),
    currency: row.currency ?? "usd",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toOrderRow(input) {
  const row = toRowGeneric(input, ORDER_MAP);
  if ("totalCents" in input) row.total_cents = Number(input.totalCents) || 0;
  if ("taxCents" in input) row.tax_cents = Number(input.taxCents) || 0;
  if ("customerId" in input) row.customer_id = input.customerId || null;
  return row;
}

export const listGalleryOrders = (projectId) =>
  listRows("gallery_orders", projectId, normalizeGalleryOrder);
export const getGalleryOrder = (id) => getRow("gallery_orders", id, normalizeGalleryOrder);
export const createGalleryOrder = (input) =>
  createRow(
    "gallery_orders",
    { ...toOrderRow(input), ...(input.id ? { id: input.id } : {}) },
    normalizeGalleryOrder,
  );
export const updateGalleryOrder = (id, input) =>
  updateRow("gallery_orders", id, toOrderRow(input), normalizeGalleryOrder);
export const softDeleteGalleryOrder = (id) => softDeleteRow("gallery_orders", id);

// ---------------------------------------------------------------------------
// Gallery customers
// ---------------------------------------------------------------------------

const CUSTOMER_MAP = {
  projectId: "project_id",
  name: "name",
  email: "email",
  organization: "organization",
  status: "status",
  notes: "notes",
  lastSeenAt: "last_seen_at",
  createdBy: "created_by",
};

export function normalizeGalleryCustomer(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    email: row.email ?? "",
    organization: row.organization ?? "",
    status: row.status ?? "active",
    totalSpentCents: Number(row.total_spent_cents ?? 0),
    orderCount: Number(row.order_count ?? 0),
    downloadCount: Number(row.download_count ?? 0),
    notes: row.notes ?? "",
    lastSeenAt: row.last_seen_at ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function toCustomerRow(input) {
  const row = toRowGeneric(input, CUSTOMER_MAP);
  if ("totalSpentCents" in input)
    row.total_spent_cents = Number(input.totalSpentCents) || 0;
  if ("orderCount" in input) row.order_count = Number(input.orderCount) || 0;
  if ("downloadCount" in input) row.download_count = Number(input.downloadCount) || 0;
  if ("lastSeenAt" in input) row.last_seen_at = input.lastSeenAt || null;
  return row;
}

export const listGalleryCustomers = (projectId) =>
  listRows("gallery_customers", projectId, normalizeGalleryCustomer);
export const getGalleryCustomer = (id) =>
  getRow("gallery_customers", id, normalizeGalleryCustomer);
export const createGalleryCustomer = (input) =>
  createRow(
    "gallery_customers",
    { ...toCustomerRow(input), ...(input.id ? { id: input.id } : {}) },
    normalizeGalleryCustomer,
  );
export const updateGalleryCustomer = (id, input) =>
  updateRow("gallery_customers", id, toCustomerRow(input), normalizeGalleryCustomer);
export const softDeleteGalleryCustomer = (id) => softDeleteRow("gallery_customers", id);
