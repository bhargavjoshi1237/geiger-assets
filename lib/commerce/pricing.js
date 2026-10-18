// Gallery pricing — which offers an asset (or the whole gallery) has, and what
// a cart costs. Pure and isomorphic: the public page uses it to show prices,
// and the checkout route runs the exact same code over freshly loaded rows to
// re-price the cart, so a total sent from the browser is never trusted.
//
// Offer ids are stable strings a cart line can carry:
//   p:<productId>   a price-sheet product sold per asset (download/licence/print)
//   direct          the gallery's own per-asset price
//   b:<productId>   a price-sheet bundle — the buyer picks `size` assets
//   x:<productId>   a price-sheet physical product, not tied to any asset
//   unlock          one price for everything in the gallery

import { deliversFiles, isShippedKind, withCommerceDefaults, withFulfillment } from "./shape";

const PER_ASSET_KINDS = new Set(["download", "license", "print"]);
const MAX_QUANTITY = 99;

/** Whether a cart line's offer is gallery-wide rather than bought per asset. */
export function isGalleryOfferId(offerId) {
  const id = String(offerId || "");
  return id === "unlock" || id.startsWith("b:") || id.startsWith("x:");
}

function sheetLines(sheet, productsById) {
  if (!sheet || sheet.status === "archived") return [];
  return (sheet.lines || [])
    .map((line) => ({ line, product: productsById.get(line.productId) }))
    .filter(({ product }) => product && product.status === "active");
}

function offerFromProduct(product, priceCents, extra = {}) {
  return {
    offerId: `p:${product.id}`,
    productId: product.id,
    kind: product.kind,
    name: product.name,
    description: product.description,
    priceCents: Math.max(0, Math.round(priceCents)),
    compareAtCents: product.compareAtCents > priceCents ? product.compareAtCents : 0,
    fulfillment: product.fulfillment,
    licenseTemplateId: product.licenseTemplateId,
    deliversFiles: deliversFiles(product.kind, product.fulfillment),
    ...extra,
  };
}

/**
 * Everything a single asset can be bought as, cheapest first. Empty when the
 * gallery isn't selling or the asset is marked not-for-sale.
 */
export function assetOffers({ commerce, sheet, productsById, assetId }) {
  const c = withCommerceDefaults(commerce);
  if (!c.enabled || !assetId) return [];
  const pricing = c.assetPrices[assetId] || {};
  if (pricing.notForSale) return [];
  const overrides = pricing.overrides || {};

  const offers = sheetLines(sheet, productsById)
    .filter(({ product }) => PER_ASSET_KINDS.has(product.kind))
    .map(({ line, product }) => {
      const override = overrides[product.id];
      const price =
        override !== undefined && override !== null && override !== ""
          ? Number(override)
          : line.priceCents ?? product.priceCents;
      return offerFromProduct(product, price);
    });

  if (c.perAsset.enabled) {
    const template = c.perAsset.productId ? productsById.get(c.perAsset.productId) : null;
    const own = pricing.priceCents;
    const price = own !== undefined && own !== null && own !== "" ? Number(own) : c.perAsset.defaultPriceCents;
    const kind = template?.kind && PER_ASSET_KINDS.has(template.kind) ? template.kind : "download";
    const fulfillment = template ? template.fulfillment : withFulfillment("download");
    offers.unshift({
      offerId: "direct",
      productId: template?.id ?? null,
      kind,
      name: c.perAsset.label || template?.name || "Digital download",
      description: template?.description || "",
      priceCents: Math.max(0, Math.round(Number(price) || 0)),
      compareAtCents: 0,
      fulfillment,
      licenseTemplateId: template?.licenseTemplateId ?? null,
      deliversFiles: deliversFiles(kind, fulfillment),
    });
  }

  return offers.sort((a, b) => a.priceCents - b.priceCents);
}

/** Gallery-wide offers: bundles and physical products from the price sheet, and the full unlock. */
export function galleryOffers({ commerce, sheet, productsById, assetCount = 0 }) {
  const c = withCommerceDefaults(commerce);
  if (!c.enabled) return [];
  const lines = sheetLines(sheet, productsById);
  const offers = lines
    .filter(({ product }) => product.kind === "bundle")
    .filter(({ product }) => (product.fulfillment.size || 0) > 0)
    .map(({ line, product }) =>
      offerFromProduct(product, line.priceCents ?? product.priceCents, {
        offerId: `b:${product.id}`,
        bundleSize: Math.min(product.fulfillment.size, Math.max(assetCount, 1)),
      }),
    );

  for (const { line, product } of lines) {
    if (product.kind !== "physical") continue;
    offers.push(offerFromProduct(product, line.priceCents ?? product.priceCents, { offerId: `x:${product.id}` }));
  }

  if (c.unlock.enabled) {
    const template = c.unlock.productId ? productsById.get(c.unlock.productId) : null;
    const fulfillment = template?.kind === "unlock" ? template.fulfillment : withFulfillment("unlock");
    offers.push({
      offerId: "unlock",
      productId: template?.id ?? null,
      kind: "unlock",
      name: c.unlock.label || "Unlock the full gallery",
      description: c.unlock.description || `All ${assetCount} asset${assetCount === 1 ? "" : "s"} in this gallery.`,
      priceCents: Math.max(0, Math.round(Number(c.unlock.priceCents) || 0)),
      compareAtCents: 0,
      fulfillment,
      licenseTemplateId: null,
      deliversFiles: true,
    });
  }
  return offers;
}

/** The lowest per-asset price, for a "From $X" tile badge. Null when not for sale. */
export function fromPrice(offers) {
  if (!offers?.length) return null;
  return offers.reduce((min, o) => Math.min(min, o.priceCents), Infinity);
}

/** Why a discount can't apply to this cart, or null when it can. */
export function discountProblem(discount, { subtotalCents, galleryId, now = Date.now() } = {}) {
  if (!discount) return "missing";
  if (discount.status !== "active") return "inactive";
  if (discount.startsAt && new Date(discount.startsAt).getTime() > now) return "not_started";
  if (discount.endsAt && new Date(discount.endsAt).getTime() < now) return "ended";
  if (discount.maxRedemptions > 0 && discount.redemptions >= discount.maxRedemptions) return "used_up";
  if (discount.galleryId && galleryId && discount.galleryId !== galleryId) return "other_gallery";
  if (discount.minSubtotalCents > 0 && subtotalCents < discount.minSubtotalCents) return "minimum";
  return null;
}

export const DISCOUNT_PROBLEM_TEXT = {
  missing: "That code isn't valid.",
  inactive: "That code isn't active.",
  not_started: "That code isn't active yet.",
  ended: "That code has expired.",
  used_up: "That code has been fully redeemed.",
  other_gallery: "That code doesn't apply to this gallery.",
  minimum: "Your order is below this code's minimum.",
};

function discountAmount(discount, subtotalCents) {
  if (!discount) return 0;
  const raw =
    discount.kind === "fixed"
      ? discount.value
      : Math.round((subtotalCents * Math.min(100, Math.max(0, discount.value))) / 100);
  return Math.min(subtotalCents, Math.max(0, raw));
}

function taxAmount(taxes, taxableCents) {
  if (!taxes?.enabled || !(taxes.ratePercent > 0) || taxableCents <= 0) return 0;
  const rate = taxes.ratePercent / 100;
  return taxes.inclusive
    ? Math.round(taxableCents - taxableCents / (1 + rate))
    : Math.round(taxableCents * rate);
}

/**
 * Price a cart. `lines` are `{ key, offerId, assetId?, assetIds?, quantity? }`;
 * `assets` maps asset id -> the gallery's public asset (anything outside it is
 * rejected). Returns priced lines plus totals, and per-line `error`s for
 * anything that can't be bought — the caller refuses checkout when any exist.
 */
export function priceCart({
  lines,
  commerce,
  sheet,
  productsById,
  assets,
  settings,
  discount = null,
  galleryId = null,
}) {
  const assetCount = assets.size;
  const gallery = galleryOffers({ commerce, sheet, productsById, assetCount });
  const priced = [];
  const errors = [];
  const seen = new Set();

  for (const raw of lines || []) {
    const line = {
      key: raw.key || `${raw.offerId}:${raw.assetId || (raw.assetIds || []).join(",")}`,
      offerId: String(raw.offerId || ""),
      assetId: raw.assetId || null,
      assetIds: Array.isArray(raw.assetIds) ? [...new Set(raw.assetIds)] : [],
      quantity: Math.min(MAX_QUANTITY, Math.max(1, Math.round(Number(raw.quantity) || 1))),
    };
    const fail = (error) => {
      priced.push({ ...line, error, unitCents: 0, totalCents: 0 });
      errors.push(error);
    };

    if (seen.has(line.key)) continue;
    seen.add(line.key);

    if (isGalleryOfferId(line.offerId)) {
      const offer = gallery.find((o) => o.offerId === line.offerId);
      if (!offer) {
        fail("This offer is no longer available.");
        continue;
      }
      if (offer.kind === "physical") {
        priced.push({
          ...line,
          assetId: null,
          assetIds: [],
          offer,
          title: offer.name,
          unitCents: offer.priceCents,
          totalCents: offer.priceCents * line.quantity,
        });
        continue;
      }
      let assetIds = [];
      if (offer.kind === "bundle") {
        assetIds = line.assetIds.filter((id) => assets.has(id));
        if (assetIds.length !== offer.bundleSize) {
          fail(`Pick ${offer.bundleSize} asset${offer.bundleSize === 1 ? "" : "s"} for this bundle.`);
          continue;
        }
      } else {
        assetIds = [...assets.keys()];
      }
      priced.push({
        ...line,
        assetIds,
        quantity: 1,
        offer,
        title: offer.kind === "bundle" ? `${offer.name} · ${assetIds.length} assets` : offer.name,
        unitCents: offer.priceCents,
        totalCents: offer.priceCents,
      });
      continue;
    }

    const asset = line.assetId ? assets.get(line.assetId) : null;
    if (!asset) {
      fail("That asset isn't in this gallery.");
      continue;
    }
    const offer = assetOffers({ commerce, sheet, productsById, assetId: asset.id }).find(
      (o) => o.offerId === line.offerId,
    );
    if (!offer) {
      fail(`${asset.name || "This asset"} is no longer offered that way.`);
      continue;
    }
    // Only shipped goods make sense in multiples.
    const quantity = isShippedKind(offer.kind) ? line.quantity : 1;
    priced.push({
      ...line,
      quantity,
      offer,
      title: asset.name || "Untitled asset",
      unitCents: offer.priceCents,
      totalCents: offer.priceCents * quantity,
    });
  }

  const subtotalCents = priced.reduce((sum, l) => sum + (l.totalCents || 0), 0);
  const problem = discount ? discountProblem(discount, { subtotalCents, galleryId }) : null;
  const applied = discount && !problem ? discount : null;
  const discountCents = discountAmount(applied, subtotalCents);
  const taxable = subtotalCents - discountCents;
  const taxCents = taxAmount(settings?.taxes, taxable);
  const totalCents = settings?.taxes?.inclusive ? taxable : taxable + taxCents;

  return {
    lines: priced,
    errors,
    subtotalCents,
    discountCents,
    discount: applied,
    discountProblem: discount ? problem : null,
    taxCents,
    taxLabel: settings?.taxes?.label || "Tax",
    taxInclusive: Boolean(settings?.taxes?.inclusive),
    totalCents,
    currency: settings?.store?.currency || "usd",
  };
}

export function formatPrice(cents, currency = "usd") {
  const n = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}
