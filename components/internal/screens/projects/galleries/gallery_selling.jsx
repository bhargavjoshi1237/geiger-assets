"use client";

// The gallery editor's "Selling" section. Edits the gallery's commerce bag in
// the editor draft (so it saves with everything else) across the three pricing
// layers the public page resolves through lib/commerce/pricing.js:
//
//   price sheet   products offered on every asset, at sheet prices
//   per asset     a direct price per asset, with a gallery-wide default
//   unlock        one flat price for the whole gallery
//
// …plus per-asset overrides (a different price for one product, or not for
// sale at all) and how prices show on the public page.

import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CircleDollarSign,
  Package,
  ShoppingCart,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { Textarea } from "@geiger/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  Field,
  LoadingArea,
  SearchInput,
  SectionCard,
  SettingRow,
  SettingsList,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { AssetThumbnail } from "@/components/internal/shared/asset_thumbnail";
import { withCommerceDefaults } from "@/lib/commerce/shape";
import { assetOffers, formatPrice, fromPrice, galleryOffers } from "@/lib/commerce/pricing";
import { getStoreSettings, listPriceSheets, listProducts } from "@/lib/supabase/store";
import {
  PRODUCT_KIND_META,
  PROVIDER_META,
  centsToDollarString,
  parseDollarsToCents,
} from "../store/constants";

const NONE = "__none__";
const PAGE = 60;

function MoneyInput({ value, onChange, placeholder = "0.00", className, ...props }) {
  return (
    <div className={cn("flex items-center gap-1 rounded-md border border-border bg-surface-card pl-2.5 focus-within:border-border-strong", className)}>
      <span className="text-xs text-text-tertiary">$</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        className="h-9 border-0 bg-transparent px-1 text-sm focus-visible:ring-0"
        {...props}
      />
    </div>
  );
}

/** Controlled dollars field over a cents value; commits on blur so typing stays free. */
function CentsInput({ cents, onCommit, placeholder, ...props }) {
  const shown = cents === null || cents === undefined || cents === "" ? "" : centsToDollarString(cents);
  const [text, setText] = useState(shown);
  // Re-seed when the stored value changes underneath (bulk set, reset).
  const [seen, setSeen] = useState(shown);
  if (seen !== shown) {
    setSeen(shown);
    setText(shown);
  }
  return (
    <MoneyInput
      value={text}
      onChange={setText}
      placeholder={placeholder}
      onBlur={() => {
        if (text.trim() === shown) return;
        onCommit(text.trim() === "" ? null : parseDollarsToCents(text));
      }}
      {...props}
    />
  );
}

function ProductSelect({ value, onChange, products, placeholder, ariaLabel }) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger aria-label={ariaLabel} className="bg-surface-card">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {products.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name} · {PRODUCT_KIND_META[p.kind]?.short}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Per-asset overrides for every sheet product, plus not-for-sale. */
function OverrideDialog({ asset, pricing, sheetProducts, onOpenChange, onSave }) {
  const [draft, setDraft] = useState({});
  // Seed the fields each time the dialog opens on an asset.
  const [seededFor, setSeededFor] = useState(null);
  if ((asset?.id ?? null) !== seededFor) {
    setSeededFor(asset?.id ?? null);
    const overrides = pricing?.overrides || {};
    setDraft(
      Object.fromEntries(
        sheetProducts.map(({ product }) => [
          product.id,
          overrides[product.id] === undefined || overrides[product.id] === null ? "" : centsToDollarString(overrides[product.id]),
        ]),
      ),
    );
  }

  return (
    <Dialog open={Boolean(asset)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Price overrides</DialogTitle>
          <DialogDescription>
            {asset?.name || "This asset"} — leave a price blank to use the sheet price.
          </DialogDescription>
        </DialogHeader>
        {sheetProducts.length ? (
          <div className="divide-y divide-border rounded-lg border border-border bg-surface-card">
            {sheetProducts.map(({ product, priceCents }) => (
              <div key={product.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{product.name}</p>
                  <p className="text-[11px] text-text-tertiary">Sheet price {formatPrice(priceCents)}</p>
                </div>
                <MoneyInput
                  value={draft[product.id] ?? ""}
                  onChange={(v) => setDraft((d) => ({ ...d, [product.id]: v }))}
                  placeholder={centsToDollarString(priceCents)}
                  className="w-32"
                  aria-label={`Override for ${product.name}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-text-tertiary">
            Pick a price sheet first — overrides adjust its products for one asset.
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" className="text-muted-foreground hover:bg-surface-active" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              const overrides = {};
              for (const [id, text] of Object.entries(draft)) {
                if (String(text).trim() !== "") overrides[id] = parseDollarsToCents(text);
              }
              onSave(overrides);
            }}
          >
            Save overrides
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GallerySellingSection({ projectId, commerce: rawCommerce, onChange, items }) {
  const commerce = useMemo(() => withCommerceDefaults(rawCommerce), [rawCommerce]);
  const [products, setProducts] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [overrideFor, setOverrideFor] = useState(null);
  const [bulkPrice, setBulkPrice] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([listProducts(projectId), listPriceSheets(projectId), getStoreSettings(projectId)]).then(
      ([p, s, st]) => {
        if (!alive) return;
        setProducts(p ?? []);
        setSheets(s ?? []);
        setSettings(st);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const patch = (next) => onChange({ ...commerce, ...next });
  const patchPart = (part, next) => patch({ [part]: { ...commerce[part], ...next } });

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const activeSheets = sheets.filter((s) => s.status !== "archived");
  const sheet = sheets.find((s) => s.id === commerce.priceSheetId) || null;
  const sheetProducts = useMemo(
    () =>
      (sheet?.lines || [])
        .map((line) => ({ line, product: productsById.get(line.productId) }))
        .filter(({ product }) => product && product.status === "active" && ["download", "license", "print"].includes(product.kind))
        .map(({ line, product }) => ({ product, priceCents: line.priceCents ?? product.priceCents })),
    [sheet, productsById],
  );

  const assets = useMemo(() => items.map((i) => i.asset).filter(Boolean), [items]);
  const offersFor = (assetId) => assetOffers({ commerce, sheet, productsById, assetId });
  const gallery = galleryOffers({ commerce, sheet, productsById, assetCount: assets.length });
  const forSale = assets.filter((a) => offersFor(a.id).length > 0);
  const lowest = forSale.length ? Math.min(...forSale.map((a) => fromPrice(offersFor(a.id)))) : null;

  const setAssetPricing = (assetId, next) => {
    const current = commerce.assetPrices[assetId] || {};
    const merged = { ...current, ...next };
    const empty =
      !merged.notForSale &&
      (merged.priceCents === null || merged.priceCents === undefined) &&
      !Object.keys(merged.overrides || {}).length;
    const assetPrices = { ...commerce.assetPrices };
    if (empty) delete assetPrices[assetId];
    else assetPrices[assetId] = merged;
    patch({ assetPrices });
  };

  const applyBulk = () => {
    const cents = parseDollarsToCents(bulkPrice);
    const assetPrices = { ...commerce.assetPrices };
    for (const a of assets) assetPrices[a.id] = { ...(assetPrices[a.id] || {}), priceCents: cents };
    patch({ assetPrices });
    setBulkPrice("");
  };

  const clearAssetPrices = () => {
    const assetPrices = {};
    for (const [id, p] of Object.entries(commerce.assetPrices)) {
      if (p.notForSale || Object.keys(p.overrides || {}).length) assetPrices[id] = { ...p, priceCents: null };
    }
    patch({ assetPrices });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? assets.filter((a) => (a.name || "").toLowerCase().includes(q)) : assets;
  }, [assets, query]);

  const perAssetTemplates = products.filter((p) => p.status === "active" && ["download", "license", "print"].includes(p.kind));
  const unlockTemplates = products.filter((p) => p.status === "active" && p.kind === "unlock");
  const provider = settings?.payments?.mode === "manual" ? "manual" : settings?.payments?.mode === "test" ? "test" : null;
  const sellingSomething = Boolean(sheet) || commerce.perAsset.enabled || commerce.unlock.enabled;

  if (loading) return <LoadingArea size={48} label="Loading store settings" />;

  return (
    <div className="space-y-8">
      <SectionCard
        bare
        title="Sell from this gallery"
        description="Let visitors buy downloads, licences, prints, physical products and the whole gallery straight from the page."
        action={<Switch checked={commerce.enabled} onCheckedChange={(enabled) => patch({ enabled })} aria-label="Sell from this gallery" />}
      >
        {commerce.enabled ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-text-secondary" />
              {forSale.length} of {assets.length} asset{assets.length === 1 ? "" : "s"} for sale
              {lowest !== null ? ` · from ${formatPrice(lowest, settings?.store?.currency)}` : ""}
            </span>
            {gallery.length ? (
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-text-secondary" />
                {gallery.length} gallery-wide offer{gallery.length === 1 ? "" : "s"}
              </span>
            ) : null}
            {provider ? <StatusPill status={provider} map={PROVIDER_META} className="text-[10px]" /> : null}
            {!sellingSomething ? (
              <span className="text-amber-700 dark:text-amber-300">Nothing is priced yet — pick a price sheet or turn on a price below.</span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-text-tertiary">
            Off — the gallery is view-only. Turn it on to set prices; nothing goes on sale until you save.
          </p>
        )}
      </SectionCard>

      {commerce.enabled ? (
        <>
          <SectionCard
            bare
            title="Price sheet"
            description="Products offered on every asset — plus bundles and physical products for the whole gallery — from a sheet on Products & Pricing."
            action={
              <Select value={commerce.priceSheetId || NONE} onValueChange={(v) => patch({ priceSheetId: v === NONE ? null : v })}>
                <SelectTrigger aria-label="Price sheet" className="h-9 w-56 bg-surface-card">
                  <SelectValue placeholder="No price sheet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No price sheet</SelectItem>
                  {activeSheets.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.isDefault ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          >
            {sheet ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {(sheet.lines || []).map((line) => {
                  const product = productsById.get(line.productId);
                  if (!product) return null;
                  const meta = PRODUCT_KIND_META[product.kind];
                  const Icon = meta?.icon || Package;
                  return (
                    <div key={line.productId} className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5">
                      <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{product.name}</p>
                        <p className="text-[11px] text-text-tertiary">
                          {meta?.short}
                          {["bundle", "unlock", "physical"].includes(product.kind) ? " · gallery-wide" : " · per asset"}
                          {product.status !== "active" ? " · not active" : ""}
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular-nums text-foreground">
                        {formatPrice(line.priceCents ?? product.priceCents, settings?.store?.currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">
                {activeSheets.length
                  ? "No sheet — assets sell only through the per-asset price and unlock below."
                  : "No price sheets yet. Build one on Products & Pricing to offer a menu of products on every asset."}
              </p>
            )}
          </SectionCard>

          <SectionCard
            bare
            title="Per-asset price"
            description="A direct price on each asset — set a default here and adjust single assets below."
            action={
              <Switch
                checked={commerce.perAsset.enabled}
                onCheckedChange={(enabled) => patchPart("perAsset", { enabled })}
                aria-label="Sell each asset at its own price"
              />
            }
          >
            {commerce.perAsset.enabled ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Label" hint="What the buyer sees on the buy panel.">
                  <Input
                    value={commerce.perAsset.label}
                    onChange={(e) => patchPart("perAsset", { label: e.target.value })}
                    placeholder="Digital download"
                    className="bg-surface-card"
                  />
                </Field>
                <Field label="Default price" hint="For assets without their own price.">
                  <CentsInput
                    cents={commerce.perAsset.defaultPriceCents}
                    onCommit={(cents) => patchPart("perAsset", { defaultPriceCents: cents ?? 0 })}
                    aria-label="Default per-asset price"
                  />
                </Field>
                <Field label="Delivered as" hint="Borrow a product's delivery settings.">
                  <ProductSelect
                    value={commerce.perAsset.productId}
                    onChange={(productId) => patchPart("perAsset", { productId })}
                    products={perAssetTemplates}
                    placeholder="Store default download"
                    ariaLabel="Per-asset delivery template"
                  />
                </Field>
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">Off — assets sell only through the price sheet.</p>
            )}
          </SectionCard>

          <SectionCard
            bare
            title="Whole-gallery unlock"
            description="One flat price for everything in this gallery — ideal for client proofing and event coverage."
            action={
              <Switch
                checked={commerce.unlock.enabled}
                onCheckedChange={(enabled) => patchPart("unlock", { enabled })}
                aria-label="Sell the whole gallery"
              />
            }
          >
            {commerce.unlock.enabled ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Label">
                  <Input
                    value={commerce.unlock.label}
                    onChange={(e) => patchPart("unlock", { label: e.target.value })}
                    placeholder="Unlock the full gallery"
                    className="bg-surface-card"
                  />
                </Field>
                <Field label="Price" hint={assets.length ? `${formatPrice((commerce.unlock.priceCents || 0) / Math.max(1, assets.length))} per asset` : undefined}>
                  <CentsInput
                    cents={commerce.unlock.priceCents}
                    onCommit={(cents) => patchPart("unlock", { priceCents: cents ?? 0 })}
                    aria-label="Unlock price"
                  />
                </Field>
                <Field label="Delivered as">
                  <ProductSelect
                    value={commerce.unlock.productId}
                    onChange={(productId) => patchPart("unlock", { productId })}
                    products={unlockTemplates}
                    placeholder="Originals, 90-day links"
                    ariaLabel="Unlock delivery template"
                  />
                </Field>
                <Field label="Description" className="sm:col-span-3">
                  <Textarea
                    value={commerce.unlock.description}
                    onChange={(e) => patchPart("unlock", { description: e.target.value })}
                    placeholder={`All ${assets.length} assets in full resolution.`}
                    rows={2}
                    className="bg-surface-card"
                  />
                </Field>
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">Off — buyers pay per asset.</p>
            )}
          </SectionCard>

          <SectionCard
            bare
            title="Asset pricing"
            description="Each asset's price, overrides for single products, and anything not for sale."
            bodyPadding={false}
            action={
              assets.length ? (
                <div className="flex items-center gap-2">
                  <SearchInput value={query} onChange={setQuery} placeholder="Filter assets..." className="w-full sm:w-64" />
                  {commerce.perAsset.enabled ? (
                    <>
                      <MoneyInput value={bulkPrice} onChange={setBulkPrice} placeholder="Price" className="w-28" aria-label="Price for every asset" />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
                        disabled={!bulkPrice.trim()}
                        onClick={applyBulk}
                      >
                        Set for all
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null
            }
          >
            {assets.length === 0 ? (
              <EmptyState icon={CircleDollarSign} title="Nothing to price yet" description="Add assets on the Content section first." />
            ) : (
              <>
                {commerce.perAsset.enabled && Object.values(commerce.assetPrices).some((p) => p.priceCents !== null && p.priceCents !== undefined) ? (
                  <div className="flex justify-end py-2">
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-text-secondary" onClick={clearAssetPrices}>
                      Reset to default price
                    </Button>
                  </div>
                ) : null}
                <div className="divide-y divide-border border-t border-border">
                  {filtered.slice(0, shown).map((asset) => {
                    const pricing = commerce.assetPrices[asset.id] || {};
                    const offers = offersFor(asset.id);
                    const overrides = Object.keys(pricing.overrides || {}).length;
                    return (
                      <div key={asset.id} className={cn("flex items-center gap-3 py-2.5", pricing.notForSale && "opacity-60")}>
                        <AssetThumbnail asset={asset} className="h-10 w-10 rounded-md" iconClassName="h-4 w-4" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{asset.name || "Untitled asset"}</p>
                          <p className="truncate text-[11px] text-text-tertiary">
                            {pricing.notForSale
                              ? "Not for sale"
                              : offers.length
                                ? `${offers.length} option${offers.length === 1 ? "" : "s"} · from ${formatPrice(fromPrice(offers), settings?.store?.currency)}`
                                : "No price yet"}
                            {overrides ? ` · ${overrides} override${overrides === 1 ? "" : "s"}` : ""}
                          </p>
                        </div>
                        {commerce.perAsset.enabled ? (
                          <CentsInput
                            cents={pricing.priceCents}
                            onCommit={(priceCents) => setAssetPricing(asset.id, { priceCents })}
                            placeholder={centsToDollarString(commerce.perAsset.defaultPriceCents)}
                            className="hidden w-28 sm:flex"
                            aria-label={`Price for ${asset.name}`}
                          />
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Price overrides for ${asset.name}`}
                          title="Price overrides"
                          disabled={!sheet}
                          className={cn("h-8 w-8 text-text-secondary hover:bg-surface-active hover:text-foreground", overrides && "text-sky-600 dark:text-sky-400")}
                          onClick={() => setOverrideFor(asset)}
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                        </Button>
                        <Switch
                          checked={!pricing.notForSale}
                          onCheckedChange={(on) => setAssetPricing(asset.id, { notForSale: !on })}
                          aria-label={`${asset.name} is for sale`}
                        />
                      </div>
                    );
                  })}
                </div>
                {filtered.length > shown ? (
                  <div className="flex justify-center border-t border-border py-3">
                    <Button variant="ghost" size="sm" className="text-xs text-text-secondary" onClick={() => setShown((n) => n + PAGE)}>
                      Show {Math.min(PAGE, filtered.length - shown)} more of {filtered.length - shown}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </SectionCard>

          <SectionCard bare title="On the page" description="How prices and the cart appear to visitors.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Buy button label">
                <Input
                  value={commerce.display.ctaLabel}
                  onChange={(e) => patchPart("display", { ctaLabel: e.target.value })}
                  placeholder="Buy"
                  className="bg-surface-card"
                />
              </Field>
              <Field label="Thank-you message" hint="Shown on the order page after purchase.">
                <Input
                  value={commerce.checkout.thankYouMessage}
                  onChange={(e) => patchPart("checkout", { thankYouMessage: e.target.value })}
                  placeholder={settings?.checkout?.thankYouMessage || "Thanks for your order!"}
                  className="bg-surface-card"
                />
              </Field>
            </div>
            <SettingsList className="mt-5">
              <SettingRow
                title="Show prices on tiles"
                description="A “from $X” badge on every asset that's for sale."
                checked={commerce.display.showPrices}
                onCheckedChange={(showPrices) => patchPart("display", { showPrices })}
              />
              <SettingRow
                title="Show compare-at prices"
                description="Strike through a product's compare-at price when it's higher."
                checked={commerce.display.showCompareAt}
                onCheckedChange={(showCompareAt) => patchPart("display", { showCompareAt })}
              />
              <SettingRow
                title="Accept discount codes"
                description="Codes from Storefront → Discount codes, when the store allows them."
                checked={commerce.checkout.allowDiscounts}
                onCheckedChange={(allowDiscounts) => patchPart("checkout", { allowDiscounts })}
              />
            </SettingsList>
          </SectionCard>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-card px-4 py-3 text-xs text-text-secondary">
            <BadgeCheck className="h-4 w-4 shrink-0 text-text-tertiary" />
            Payment, taxes, required buyer details and fulfilment defaults are store-wide, on Cart & Checkout. After a sale,
            workflows on the <Badge variant="outline" className="text-[10px]">Order paid</Badge> trigger can take it from there.
          </div>
        </>
      ) : null}

      <OverrideDialog
        asset={overrideFor}
        pricing={overrideFor ? commerce.assetPrices[overrideFor.id] : null}
        sheetProducts={sheetProducts}
        onOpenChange={(open) => !open && setOverrideFor(null)}
        onSave={(overrides) => {
          setAssetPricing(overrideFor.id, { overrides });
          setOverrideFor(null);
        }}
      />
    </div>
  );
}

export default GallerySellingSection;
