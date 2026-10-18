"use client";

// The buying half of a public gallery: the cart (kept per gallery in the
// visitor's browser), the buy panel for one asset, the cart drawer with its
// checkout form, and the bar shown while picking a bundle.
//
// Prices shown here come from lib/commerce/pricing.js over the store snapshot
// the page was rendered with; the drawer re-prices through the server before
// checkout, and the checkout route prices again — the browser only ever says
// *what* it wants.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Boxes,
  Check,
  Download,
  Loader2,
  LockOpen,
  Minus,
  Package,
  Plus,
  Printer,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Checkbox } from "@geiger/ui/checkbox";
import { Input } from "@geiger/ui/input";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@geiger/ui/sheet";
import { cn } from "@/lib/utils";
import { RENDITIONS, isShippedKind, offersNeedShipping } from "@/lib/commerce/shape";
import { formatPrice } from "@/lib/commerce/pricing";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const CART_PREFIX = "geiger_cart_";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const KIND_ICON = { download: Download, license: BadgeCheck, print: Printer, physical: Package, bundle: Boxes, unlock: LockOpen };

/** What an offer hands over, in one line. */
export function offerSummary(offer) {
  const f = offer?.fulfillment || {};
  const rendition = RENDITIONS[f.rendition]?.label;
  const limit = f.downloadLimit > 0 ? `${f.downloadLimit} download${f.downloadLimit === 1 ? "" : "s"}` : "unlimited downloads";
  const expiry = f.expiryDays > 0 ? `link for ${f.expiryDays} days` : "link never expires";
  switch (offer?.kind) {
    case "license":
      return [
        f.durationMonths > 0 ? `${f.durationMonths}-month licence` : "Perpetual licence",
        f.usageType ? `${f.usageType} use` : null,
        f.includeDownload ? rendition : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "print":
      return [f.size, f.paper, f.finish, f.productionDays ? `ships in ~${f.productionDays} days` : null].filter(Boolean).join(" · ");
    case "physical":
      return [f.variant, f.productionDays ? `ships in ~${f.productionDays} days` : null].filter(Boolean).join(" · ") || "Shipped to you";
    case "bundle":
      return `Pick any ${offer.bundleSize} · ${rendition || "Original file"} · ${limit}`;
    case "unlock":
      return `${rendition || "Original file"} · ${limit} · ${expiry}`;
    default:
      return [rendition, limit, expiry].filter(Boolean).join(" · ");
  }
}

function lineKey(line) {
  if (line.offerId === "unlock" || line.offerId.startsWith("x:")) return line.offerId;
  if (line.offerId.startsWith("b:")) return `${line.offerId}:${[...line.assetIds].sort().join(",")}`;
  return `${line.offerId}:${line.assetId}`;
}

/** The visitor's cart for one gallery, persisted in localStorage when it can be. */
export function useGalleryCart(galleryId) {
  const storageKey = `${CART_PREFIX}${galleryId}`;
  const [lines, setLines] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let saved = [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      saved = raw ? JSON.parse(raw) : [];
    } catch {
      saved = [];
    }
    // Deferred so the first paint matches the server render.
    const id = window.setTimeout(() => {
      setLines(Array.isArray(saved) ? saved.filter((l) => l && l.offerId) : []);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(lines));
    } catch {
      // Private mode or full storage — the cart just won't survive a reload.
    }
  }, [lines, ready, storageKey]);

  const add = useCallback((line) => {
    const next = { assetId: null, assetIds: [], quantity: 1, ...line };
    next.key = lineKey(next);
    setLines((list) => {
      const existing = list.find((l) => l.key === next.key);
      if (existing) {
        return list.map((l) => (l.key === next.key ? { ...l, quantity: Math.min(99, l.quantity + (next.quantity || 1)) } : l));
      }
      return [...list, next];
    });
  }, []);
  const remove = useCallback((key) => setLines((list) => list.filter((l) => l.key !== key)), []);
  const setQuantity = useCallback(
    (key, quantity) => setLines((list) => list.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(99, quantity)) } : l))),
    [],
  );
  const clear = useCallback(() => setLines([]), []);

  return { lines, add, remove, setQuantity, clear, count: lines.reduce((s, l) => s + (l.quantity || 1), 0) };
}

function OfferOption({ offer, selected, onSelect, currency, showCompareAt, inCart }) {
  const Icon = KIND_ICON[offer.kind] || Package;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        selected ? "border-primary bg-primary/10" : "border-border bg-surface-card hover:bg-surface-hover",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
        )}
      >
        {selected ? <Check className="h-2.5 w-2.5" /> : null}
      </span>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-foreground">{offer.name}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
            {showCompareAt && offer.compareAtCents ? (
              <span className="mr-1.5 text-xs font-normal text-text-tertiary line-through">
                {formatPrice(offer.compareAtCents, currency)}
              </span>
            ) : null}
            {formatPrice(offer.priceCents, currency)}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-text-secondary">{offer.description || offerSummary(offer)}</span>
        {offer.description ? <span className="mt-0.5 block text-[11px] text-text-tertiary">{offerSummary(offer)}</span> : null}
        {inCart ? <span className="mt-1 inline-block text-[11px] text-emerald-600 dark:text-emerald-400">In your cart</span> : null}
      </span>
    </button>
  );
}

/** Pick how to buy one asset. */
export function BuyDialog({ asset, offers, currency, showCompareAt, cartKeys, onOpenChange, onAdd, onBuyNow }) {
  const [choice, setChoice] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [seededFor, setSeededFor] = useState(null);
  if ((asset?.id ?? null) !== seededFor) {
    setSeededFor(asset?.id ?? null);
    setChoice(offers?.[0]?.offerId ?? null);
    setQuantity(1);
  }
  const offer = offers?.find((o) => o.offerId === choice) || null;
  const line = offer ? { offerId: offer.offerId, assetId: asset?.id, quantity: isShippedKind(offer.kind) ? quantity : 1 } : null;

  return (
    <Dialog open={Boolean(asset)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {asset?.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.thumbnailUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
            ) : null}
            <span className="min-w-0 truncate">{asset?.name || "Buy"}</span>
          </DialogTitle>
          <DialogDescription>Choose how you’d like it.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Options" className="grid max-h-[50vh] gap-2 overflow-y-auto">
          {(offers || []).map((o) => (
            <OfferOption
              key={o.offerId}
              offer={o}
              selected={o.offerId === choice}
              onSelect={() => setChoice(o.offerId)}
              currency={currency}
              showCompareAt={showCompareAt}
              inCart={cartKeys.has(`${o.offerId}:${asset?.id}`)}
            />
          ))}
        </div>
        {isShippedKind(offer?.kind) ? (
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-3 py-2">
            <span className="text-sm text-text-secondary">Quantity</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Fewer" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-8 text-center text-sm tabular-nums">{quantity}</span>
              <Button variant="ghost" size="icon-sm" aria-label="More" disabled={quantity >= 99} onClick={() => setQuantity((q) => Math.min(99, q + 1))}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:justify-between">
          <span className="self-center text-sm font-semibold tabular-nums text-foreground">
            {offer ? formatPrice(offer.priceCents * (isShippedKind(offer.kind) ? quantity : 1), currency) : ""}
          </span>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" className="border-border bg-transparent" disabled={!line} onClick={() => onAdd(line)}>
              <ShoppingBag className="h-4 w-4" />
              Add to cart
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={!line} onClick={() => onBuyNow(line)}>
              Buy now
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Pinned bar while the visitor picks the assets for a bundle. */
export function BundleBar({ offer, count, currency, onCancel, onClear, onAdd }) {
  const size = offer.bundleSize;
  const full = count === size;
  const remaining = Math.max(0, size - count);

  // Escape leaves bundle mode, like closing any other overlay.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 sm:bottom-6 sm:px-4">
      <div
        role="status"
        className="pointer-events-auto w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950/90 p-3 text-white shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-300 sm:p-4"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Boxes className="h-5 w-5 text-white/80" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{offer.name}</p>
            <p className="truncate text-xs text-white/60">
              {full ? "All picked — add it to your cart." : `Tap ${remaining} more to fill the bundle.`}
            </p>
          </div>
          <span className="shrink-0 text-lg font-semibold tabular-nums">
            {count}
            <span className="text-sm font-normal text-white/50">/{size}</span>
          </span>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <div
            className={cn("h-full rounded-full transition-all duration-300", full ? "bg-emerald-400" : "bg-white")}
            style={{ width: `${size ? (count / size) * 100 : 0}%` }}
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
          {count ? (
            <button
              type="button"
              onClick={onClear}
              className="h-10 rounded-xl px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            disabled={!full}
            onClick={onAdd}
            className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-white/90 disabled:bg-white/20 disabled:text-white/50"
          >
            <ShoppingBag className="h-4 w-4" />
            Add bundle · {formatPrice(offer.priceCents, currency)}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stepper({ value, onChange }) {
  return (
    <div className="flex items-center rounded-md border border-border">
      <button type="button" aria-label="Fewer" disabled={value <= 1} onClick={() => onChange(value - 1)} className="flex h-7 w-7 items-center justify-center text-text-secondary disabled:opacity-40">
        <Minus className="h-3 w-3" />
      </button>
      <span className="w-6 text-center text-xs tabular-nums">{value}</span>
      <button type="button" aria-label="More" disabled={value >= 99} onClick={() => onChange(value + 1)} className="flex h-7 w-7 items-center justify-center text-text-secondary disabled:opacity-40">
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

function TotalLine({ label, value, strong }) {
  return (
    <div className={cn("flex justify-between text-sm", strong ? "font-semibold text-foreground" : "text-text-secondary")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * The cart drawer: lines, discount code, server-priced totals, then the
 * checkout form. Submitting hands off to Stripe or the order page.
 */
export function CartSheet({ open, onOpenChange, gallery, store, cart, assetsById, offerLookup, visitor }) {
  const { lines, remove, setQuantity, clear } = cart;
  const checkout = store.settings.checkout;
  const currency = store.settings.store.currency;
  const [step, setStep] = useState("cart");
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [preview, setPreview] = useState(null);
  const [pricing, setPricing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [buyer, setBuyer] = useState(() => ({
    email: "",
    name: "",
    company: "",
    phone: "",
    note: "",
    address: { line1: "", line2: "", city: "", region: "", postalCode: "", country: "" },
    termsAccepted: false,
    marketingOptIn: false,
  }));

  // Prefill from the visitor identity once it's known.
  const [prefilled, setPrefilled] = useState(false);
  if (!prefilled && visitor?.email) {
    setPrefilled(true);
    setBuyer((b) => ({ ...b, email: b.email || visitor.email, name: b.name || visitor.name || "" }));
  }

  const setField = (key) => (value) => setBuyer((b) => ({ ...b, [key]: value }));
  const setAddress = (key) => (value) => setBuyer((b) => ({ ...b, address: { ...b.address, [key]: value } }));

  const payloadLines = useMemo(
    () => lines.map((l) => ({ key: l.key, offerId: l.offerId, assetId: l.assetId, assetIds: l.assetIds, quantity: l.quantity })),
    [lines],
  );

  // Re-price through the server whenever the cart or the code changes.
  useEffect(() => {
    if (!open || !payloadLines.length) return undefined;
    let alive = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPricing(true);
      try {
        const res = await fetch(`${BASE}/g/${encodeURIComponent(gallery.slug)}/checkout`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ preview: true, lines: payloadLines, discountCode: appliedCode }),
          signal: controller.signal,
        });
        const body = await res.json().catch(() => ({}));
        if (alive) setPreview(res.ok ? body.cart : null);
      } catch {
        if (alive) setPreview(null);
      } finally {
        if (alive) setPricing(false);
      }
    }, 200);
    return () => {
      alive = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, payloadLines, appliedCode, gallery.slug]);

  const priced = preview && preview.lines.length === lines.length ? preview : null;
  const errorFor = (key) => priced?.lines.find((l) => l.key === key)?.error || null;
  const hasErrors = Boolean(priced?.lines.some((l) => l.error));
  const belowMinimum = Boolean(priced && priced.minimumCents > 0 && priced.subtotalCents < priced.minimumCents);

  // Shipped goods need somewhere to go, whatever the store's billing setting.
  const needsShipping = useMemo(() => offersNeedShipping(lines.map(offerLookup)), [lines, offerLookup]);
  const collectAddress = checkout.collectAddress || needsShipping;

  const emailOk = EMAIL_RE.test(buyer.email);
  const formOk =
    emailOk &&
    (!checkout.collectName || buyer.name.trim()) &&
    (!collectAddress || (buyer.address.line1.trim() && buyer.address.city.trim())) &&
    (!checkout.requireTerms || buyer.termsAccepted);

  const provider = store.provider;
  const total = priced?.totalCents ?? 0;
  const payLabel =
    total === 0 && priced
      ? "Get it free"
      : provider === "manual"
        ? `Place order · ${formatPrice(total, currency)}`
        : provider === "test"
          ? `Pay ${formatPrice(total, currency)} (test)`
          : `Pay ${formatPrice(total, currency)}`;

  const submit = async () => {
    if (!formOk || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/g/${encodeURIComponent(gallery.slug)}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines: payloadLines, discountCode: appliedCode, buyer }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        toast.error(body.error || "Couldn't start checkout.");
        setSubmitting(false);
        return;
      }
      clear();
      window.location.assign(body.url);
    } catch {
      toast.error("Couldn't reach the store. Check your connection and try again.");
      setSubmitting(false);
    }
  };

  const close = (next) => {
    if (!next) setStep("cart");
    onOpenChange(next);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={close}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle>{step === "cart" ? "Your cart" : "Checkout"}</SheetTitle>
            <SheetDescription>
              {step === "cart"
                ? `${lines.length} item${lines.length === 1 ? "" : "s"} from ${store.settings.store.name || gallery.name}`
                : provider === "manual"
                  ? "You'll get an invoice to pay; files unlock once it's paid."
                  : provider === "test"
                    ? "Test checkout — no real payment is taken."
                    : "You'll pay securely on the next page."}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <ShoppingBag className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-foreground">Your cart is empty</p>
                <p className="mt-1 text-xs text-text-secondary">Tap a price on anything in the gallery to add it.</p>
              </div>
            ) : step === "cart" ? (
              <div className="space-y-4">
                <ul className="divide-y divide-border">
                  {lines.map((line) => {
                    const offer = offerLookup(line);
                    const asset = line.assetId ? assetsById.get(line.assetId) : null;
                    const Icon = KIND_ICON[offer?.kind] || Package;
                    const pricedLine = priced?.lines.find((l) => l.key === line.key);
                    const error = errorFor(line.key) || (!offer ? "No longer available." : null);
                    return (
                      <li key={line.key} className="flex gap-3 py-3">
                        {asset?.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={asset.thumbnailUrl} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
                        ) : (
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-surface-card text-text-secondary">
                            <Icon className="h-5 w-5" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {pricedLine?.title || asset?.name || offer?.name || "Item"}
                          </p>
                          <p className="truncate text-xs text-text-secondary">{offer?.name}</p>
                          {error ? <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
                          <div className="mt-2 flex items-center gap-2">
                            {isShippedKind(offer?.kind) ? <Stepper value={line.quantity} onChange={(q) => setQuantity(line.key, q)} /> : null}
                            <button
                              type="button"
                              onClick={() => remove(line.key)}
                              className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-red-600 dark:hover:text-red-400"
                            >
                              <Trash2 className="h-3 w-3" />
                              Remove
                            </button>
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                          {pricedLine ? formatPrice(pricedLine.totalCents, currency) : offer ? formatPrice(offer.priceCents * (line.quantity || 1), currency) : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {checkout.allowDiscounts && store.commerce.checkout.allowDiscounts ? (
                  <div>
                    {appliedCode && !priced?.discountError ? (
                      <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
                        <span className="inline-flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5" />
                          {appliedCode}
                        </span>
                        <button type="button" aria-label="Remove code" onClick={() => setAppliedCode("")} className="hover:text-emerald-700 dark:hover:text-emerald-300">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          setAppliedCode(code.trim().toUpperCase());
                        }}
                      >
                        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Discount code" className="bg-surface-card uppercase" aria-label="Discount code" />
                        <Button type="submit" variant="outline" className="border-border bg-transparent" disabled={!code.trim()}>
                          Apply
                        </Button>
                      </form>
                    )}
                    {appliedCode && priced?.discountError ? <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{priced.discountError}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <form
                id="gallery-checkout"
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <label className="grid gap-1 text-sm">
                  <span className="text-text-secondary">Email</span>
                  <Input type="email" autoComplete="email" required value={buyer.email} onChange={(e) => setField("email")(e.target.value)} placeholder="you@example.com" className="bg-surface-card" />
                  <span className="text-[11px] text-text-tertiary">Your receipt and download links are tied to this address.</span>
                </label>
                {checkout.collectName ? (
                  <label className="grid gap-1 text-sm">
                    <span className="text-text-secondary">Full name</span>
                    <Input autoComplete="name" required value={buyer.name} onChange={(e) => setField("name")(e.target.value)} className="bg-surface-card" />
                  </label>
                ) : null}
                {checkout.collectCompany ? (
                  <label className="grid gap-1 text-sm">
                    <span className="text-text-secondary">Company (optional)</span>
                    <Input autoComplete="organization" value={buyer.company} onChange={(e) => setField("company")(e.target.value)} className="bg-surface-card" />
                  </label>
                ) : null}
                {checkout.collectPhone ? (
                  <label className="grid gap-1 text-sm">
                    <span className="text-text-secondary">Phone (optional)</span>
                    <Input type="tel" autoComplete="tel" value={buyer.phone} onChange={(e) => setField("phone")(e.target.value)} className="bg-surface-card" />
                  </label>
                ) : null}
                {collectAddress ? (
                  <fieldset className="grid gap-2">
                    <legend className="mb-1 text-sm text-text-secondary">{needsShipping ? "Shipping address" : "Billing address"}</legend>
                    <Input autoComplete="address-line1" required placeholder="Address" value={buyer.address.line1} onChange={(e) => setAddress("line1")(e.target.value)} className="bg-surface-card" />
                    <Input autoComplete="address-line2" placeholder="Apartment, suite (optional)" value={buyer.address.line2} onChange={(e) => setAddress("line2")(e.target.value)} className="bg-surface-card" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input autoComplete="address-level2" required placeholder="City" value={buyer.address.city} onChange={(e) => setAddress("city")(e.target.value)} className="bg-surface-card" />
                      <Input autoComplete="postal-code" placeholder="Postcode" value={buyer.address.postalCode} onChange={(e) => setAddress("postalCode")(e.target.value)} className="bg-surface-card" />
                      <Input autoComplete="address-level1" placeholder="State / region" value={buyer.address.region} onChange={(e) => setAddress("region")(e.target.value)} className="bg-surface-card" />
                      <Input autoComplete="country-name" placeholder="Country" value={buyer.address.country} onChange={(e) => setAddress("country")(e.target.value)} className="bg-surface-card" />
                    </div>
                  </fieldset>
                ) : null}
                {checkout.allowNotes ? (
                  <label className="grid gap-1 text-sm">
                    <span className="text-text-secondary">Note (optional)</span>
                    <Textarea rows={2} value={buyer.note} onChange={(e) => setField("note")(e.target.value)} placeholder="Anything the seller should know" className="bg-surface-card" />
                  </label>
                ) : null}
                {checkout.marketingOptIn ? (
                  <label className="flex items-start gap-2 text-sm text-text-secondary">
                    <Checkbox checked={buyer.marketingOptIn} onCheckedChange={(v) => setField("marketingOptIn")(Boolean(v))} className="mt-0.5" />
                    Tell me about new work and offers.
                  </label>
                ) : null}
                {checkout.requireTerms ? (
                  <label className="flex items-start gap-2 text-sm text-text-secondary">
                    <Checkbox checked={buyer.termsAccepted} onCheckedChange={(v) => setField("termsAccepted")(Boolean(v))} className="mt-0.5" />
                    <span>
                      I accept the{" "}
                      {store.settings.policies.terms || store.settings.policies.refunds ? (
                        <button type="button" onClick={() => setShowTerms(true)} className="text-foreground underline underline-offset-2">
                          terms of sale
                        </button>
                      ) : (
                        "terms of sale"
                      )}
                      .
                    </span>
                  </label>
                ) : null}
              </form>
            )}
          </div>

          {lines.length ? (
            <SheetFooter className="gap-3 border-t border-border px-5 py-4">
              <div className="grid gap-1">
                {priced ? (
                  <>
                    <TotalLine label="Subtotal" value={formatPrice(priced.subtotalCents, currency)} />
                    {priced.discountCents ? <TotalLine label={`Discount (${priced.discountCode})`} value={`−${formatPrice(priced.discountCents, currency)}`} /> : null}
                    {priced.taxCents ? (
                      <TotalLine label={`${priced.taxLabel}${priced.taxInclusive ? " (included)" : ""}`} value={formatPrice(priced.taxCents, currency)} />
                    ) : null}
                    <TotalLine label="Total" value={formatPrice(priced.totalCents, currency)} strong />
                    {belowMinimum ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">The minimum order is {formatPrice(priced.minimumCents, currency)}.</p>
                    ) : null}
                  </>
                ) : (
                  <p className="flex items-center gap-2 text-xs text-text-tertiary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Working out your total…
                  </p>
                )}
              </div>
              {step === "cart" ? (
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={!priced || pricing || hasErrors || belowMinimum}
                  onClick={() => setStep("details")}
                >
                  Checkout
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" className="border-border bg-transparent" onClick={() => setStep("cart")} disabled={submitting}>
                    Back
                  </Button>
                  <Button
                    type="submit"
                    form="gallery-checkout"
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={!formOk || !priced || pricing || hasErrors || belowMinimum || submitting}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {payLabel}
                  </Button>
                </div>
              )}
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Terms of sale</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto text-sm text-text-secondary">
            {store.settings.policies.terms ? <p className="whitespace-pre-wrap">{store.settings.policies.terms}</p> : null}
            {store.settings.policies.refunds ? (
              <div>
                <p className="mb-1 font-medium text-foreground">Refunds</p>
                <p className="whitespace-pre-wrap">{store.settings.policies.refunds}</p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setField("termsAccepted")(true);
                setShowTerms(false);
              }}
            >
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
