"use client";

// The visitor's view of a published gallery. Access was already resolved
// server-side (see app/g/[slug]/page.js) — by the time this renders, the
// visitor is allowed to see the content. What happens here is the interactive
// half: identifying the visitor, favorites, download requests and the event
// trail the Showcase screen reads.
//
// Page anatomy: optional top bar → title, details and poster hero → sticky
// toolbar (filter, share, download state, cart) → the gallery in its layout →
// footer. Opening any asset shows it in the full-screen lightbox. A selling
// gallery also gets price chips, a buy panel, bundles and the cart drawer
// (./gallery_store).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUp,
  Boxes,
  Check,
  ChevronDown,
  Download,
  Heart,
  Images,
  LockOpen,
  Package,
  Send,
  Share2,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@geiger/ui";
import { Button } from "@geiger/ui/button";
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
import { cn } from "@/lib/utils";
import {
  GalleryFooter,
  GalleryGrid,
  GalleryPoster,
  GalleryTopbar,
  completeLinks,
} from "../galleries_kit";
import {
  TITLE_SIZE_CLASS,
  TYPOGRAPHY_CLASS,
  formatDate,
  groundTone,
  pageWidth,
  primaryButton,
  withThemeDefaults,
} from "../constants";
import { GalleryLightbox } from "./gallery_lightbox";
import { GallerySlideshow } from "./gallery_slideshow";
import { BundleBar, BuyDialog, CartSheet, offerSummary, useGalleryCart } from "./gallery_store";
import { Popover, PopoverContent, PopoverTrigger } from "@geiger/ui/popover";
import { assetOffers, formatPrice, fromPrice, galleryOffers, isGalleryOfferId } from "@/lib/commerce/pricing";
import {
  addFavorite,
  createDownloadRequest,
  listFavorites,
  mintVisitorToken,
  recordGalleryEvent,
  removeFavorite,
  resolveVisitor,
} from "@/lib/supabase/gallery_audience";

const TOKEN_KEY = "geiger_gallery_visitor";

const WIDE_OFFER_ICON = { bundle: Boxes, physical: Package, unlock: LockOpen };

/** Per-browser visitor identity, stable across visits to any gallery. */
function readVisitorToken() {
  try {
    const existing = window.localStorage.getItem(TOKEN_KEY);
    if (existing) return existing;
    const minted = mintVisitorToken();
    window.localStorage.setItem(TOKEN_KEY, minted);
    return minted;
  } catch {
    // Private mode or blocked storage — fall back to a per-session identity.
    return mintVisitorToken();
  }
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function IdentityDialog({ open, onSubmit, galleryName }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Welcome</DialogTitle>
          <DialogDescription>
            {galleryName
              ? `Tell us who you are before opening ${galleryName}.`
              : "Tell us who you are before opening this gallery."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) onSubmit({ name: name.trim(), email: email.trim() });
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className="bg-surface-card"
          />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="bg-surface-card"
          />
          <Button
            type="submit"
            className="mt-1 w-full bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!valid}
          >
            Open gallery
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RequestDialog({ open, onOpenChange, onSubmit, count }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const close = (next) => {
    if (!next) setMessage("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Request download</DialogTitle>
          <DialogDescription>
            {count > 0
              ? `Ask for the ${plural(count, "asset")} you favorited.`
              : "Ask for access to the files in this gallery. Favorite items first to request only those."}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What do you need these for? (optional)"
          rows={3}
          className="bg-surface-card"
        />
        <DialogFooter>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => close(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit(message.trim());
              setBusy(false);
              close(false);
            }}
          >
            <Send className="h-4 w-4" />
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function external(href) {
  return /^https?:/.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {};
}

/** The faint backdrop behind the title: grid lines, dots or an accent glow. */
function HeroTexture({ theme, tone }) {
  if (theme.texture === "none") return null;
  if (theme.texture === "glow") {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background: `radial-gradient(55% 60% at 50% 0%, ${theme.accent}38, transparent 72%)`,
        }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 h-[460px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_55%,transparent_100%)]",
        theme.texture === "dots" ? cn("bg-[size:18px_18px]", tone.dots) : cn("bg-[size:24px_24px]", tone.texture),
      )}
    />
  );
}

/**
 * Editorial title block in the suite's own idiom: title with its details strip
 * alongside (or stacked, when centered), then headline and description over the
 * chosen backdrop, then the cover as a styled poster. Header links show here as
 * chips only when the gallery has no top bar to carry them.
 */
function GalleryHero({ gallery, cover, theme, tone, count, links, protect }) {
  const centered = theme.heroAlign === "center";
  // A headline that only repeats the title adds nothing under it.
  const headline =
    gallery.headline && gallery.headline.trim() !== gallery.name.trim() ? gallery.headline : "";
  const stats = theme.showStats
    ? [
        { label: "Items", value: String(count) },
        gallery.publishedAt ? { label: "Published", value: formatDate(gallery.publishedAt) } : null,
        gallery.expiresAt ? { label: "Available until", value: formatDate(gallery.expiresAt) } : null,
      ].filter(Boolean)
    : [];

  return (
    <header className="relative overflow-hidden">
      <HeroTexture theme={theme} tone={tone} />

      <div className={cn("relative mx-auto px-4 pt-12 sm:px-6 sm:pt-16", pageWidth(theme))}>
        <div
          className={cn(
            "flex flex-col gap-5",
            centered ? "items-center text-center" : "lg:flex-row lg:items-end lg:justify-between lg:gap-12",
          )}
        >
          <h1
            className={cn(
              "min-w-0 text-balance font-semibold tracking-tight",
              TITLE_SIZE_CLASS[theme.titleSize] || TITLE_SIZE_CLASS.regular,
            )}
          >
            {gallery.name}
          </h1>

          {stats.length ? (
            <dl className={cn("flex shrink-0 items-stretch pb-1", centered && "order-last mt-2")}>
              {stats.map(({ label, value }, i) => (
                <div
                  key={label}
                  className={cn("flex flex-col-reverse gap-1", i > 0 && cn("ml-6 border-l pl-6", tone.border))}
                >
                  <dt className={cn("text-xs", tone.subtle)}>{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums tracking-tight sm:text-xl">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {centered && (headline || gallery.description) ? (
            <div className="max-w-3xl">
              {headline ? <p className="text-pretty text-base sm:text-lg">{headline}</p> : null}
              {gallery.description ? (
                <p className={cn("mt-3 text-pretty text-sm leading-relaxed sm:text-base", tone.muted)}>
                  {gallery.description}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {!centered && headline ? <p className="mt-4 text-pretty text-base sm:text-lg">{headline}</p> : null}
        {!centered && gallery.description ? (
          <p className={cn("mt-3 text-pretty text-sm leading-relaxed sm:text-base", tone.muted)}>
            {gallery.description}
          </p>
        ) : null}
        {links.length ? (
          <nav
            aria-label="Gallery links"
            className={cn("mt-5 flex flex-wrap gap-2", centered && "justify-center")}
          >
            {links.map((link, i) => (
              <a
                key={`${link.href}-${i}`}
                href={link.href}
                {...external(link.href)}
                className={cn(
                  "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
                  tone.chip,
                )}
              >
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}

        {cover?.thumbnailUrl ? (
          <GalleryPoster asset={cover} theme={theme} tone={tone} protect={protect} className="mt-10" />
        ) : null}
      </div>
    </header>
  );
}

export function GalleryView({ gallery, items, cover = null, store = null }) {
  const theme = useMemo(() => withThemeDefaults(gallery.theme), [gallery.theme]);
  const tone = groundTone(theme);
  const primary = primaryButton(theme, tone);
  const protect = gallery.downloadMode === "off";
  const [visitor, setVisitor] = useState(null);
  const [needsIdentity, setNeedsIdentity] = useState(false);
  const [favorites, setFavorites] = useState(() => new Map());
  const [showRequest, setShowRequest] = useState(false);
  const [requested, setRequested] = useState(false);
  const [view, setView] = useState("all");
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [showTop, setShowTop] = useState(false);
  const [buyAsset, setBuyAsset] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);
  const [bundle, setBundle] = useState(null); // { offer, selected: Set }
  const cart = useGalleryCart(gallery.id);

  // Store ---------------------------------------------------------------------
  const commerce = store?.commerce || null;
  const currency = store?.settings?.store?.currency || "usd";
  const productsById = useMemo(() => new Map((store?.products || []).map((p) => [p.id, p])), [store]);
  const offersByAsset = useMemo(() => {
    const map = new Map();
    if (!store) return map;
    for (const { asset } of items) {
      if (!asset) continue;
      const offers = assetOffers({ commerce, sheet: store.sheet, productsById, assetId: asset.id });
      if (offers.length) map.set(asset.id, offers);
    }
    return map;
  }, [store, commerce, items, productsById]);
  const wideOffers = useMemo(
    () => (store ? galleryOffers({ commerce, sheet: store.sheet, productsById, assetCount: items.length }) : []),
    [store, commerce, productsById, items.length],
  );
  const assetsById = useMemo(() => new Map(items.map((row) => [row.asset?.id, row.asset])), [items]);

  const priceFor = useCallback(
    (asset) => {
      const offers = asset ? offersByAsset.get(asset.id) : null;
      if (!offers) return null;
      if (!commerce.display.showPrices) return commerce.display.ctaLabel || "Buy";
      const low = fromPrice(offers);
      return offers.length === 1 ? formatPrice(low, currency) : `From ${formatPrice(low, currency)}`;
    },
    [offersByAsset, commerce, currency],
  );

  const offerLookup = useCallback(
    (line) =>
      isGalleryOfferId(line.offerId)
        ? wideOffers.find((o) => o.offerId === line.offerId) || null
        : offersByAsset.get(line.assetId)?.find((o) => o.offerId === line.offerId) || null,
    [wideOffers, offersByAsset],
  );

  const cartKeys = useMemo(() => new Set(cart.lines.map((l) => l.key)), [cart.lines]);

  // Coming back from an abandoned Stripe checkout: the cart is still here.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "cancelled") return;
    toast("Checkout cancelled — your cart is saved.");
    params.delete("checkout");
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  // Identify the visitor, record the visit, and pull back what they already
  // favorited here. A gallery that asks for details holds the dialog open until
  // they're given.
  useEffect(() => {
    let alive = true;
    const token = readVisitorToken();
    resolveVisitor({ galleryId: gallery.id, token, projectId: gallery.projectId }).then(
      async (resolved) => {
        if (!alive) return;
        setVisitor(resolved);
        setNeedsIdentity(Boolean(gallery.requireEmail) && !resolved?.email);
        if (resolved) {
          recordGalleryEvent({
            projectId: gallery.projectId,
            galleryId: gallery.id,
            visitorId: resolved.id,
            kind: "view",
          });
          const rows = await listFavorites(gallery.id);
          if (!alive) return;
          setFavorites(
            new Map(
              (rows ?? [])
                .filter((f) => f.visitorId === resolved.id)
                .map((f) => [f.assetId, f.id]),
            ),
          );
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [gallery.id, gallery.projectId, gallery.requireEmail]);

  // "Back to top" shows once the visitor is well into the gallery.
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > window.innerHeight * 1.2);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleIdentity = useCallback(
    async ({ name, email }) => {
      const token = readVisitorToken();
      const updated = await resolveVisitor({
        galleryId: gallery.id,
        token,
        projectId: gallery.projectId,
        name,
        email,
      });
      if (updated) {
        setVisitor(updated);
        setNeedsIdentity(false);
      } else {
        toast.error("Couldn't save your details.");
      }
    },
    [gallery.id, gallery.projectId],
  );

  const favoriteIds = useMemo(() => new Set(favorites.keys()), [favorites]);
  const canFavorite = gallery.allowFavorites && Boolean(visitor);
  const showingFavorites = view === "favorites" && gallery.allowFavorites;

  const visibleItems = useMemo(
    () => (showingFavorites ? items.filter((row) => favoriteIds.has(row.asset?.id)) : items),
    [items, favoriteIds, showingFavorites],
  );

  // Unfavoriting inside the favorites view can shrink the list under the
  // lightbox, so clamp rather than point past the end.
  const activeIndex =
    lightboxIndex == null || visibleItems.length === 0
      ? null
      : Math.min(lightboxIndex, visibleItems.length - 1);

  const handleToggleFavorite = async (asset) => {
    if (!visitor) return;
    const existing = favorites.get(asset.id);
    if (existing) {
      setFavorites((prev) => {
        const next = new Map(prev);
        next.delete(asset.id);
        return next;
      });
      const ok = await removeFavorite(existing);
      if (ok) {
        recordGalleryEvent({
          projectId: gallery.projectId,
          galleryId: gallery.id,
          visitorId: visitor.id,
          assetId: asset.id,
          kind: "unfavorite",
        });
      } else {
        setFavorites((prev) => new Map(prev).set(asset.id, existing));
        toast.error("Couldn't update your favorites.");
      }
      return;
    }

    const optimisticId = crypto.randomUUID();
    setFavorites((prev) => new Map(prev).set(asset.id, optimisticId));
    const created = await addFavorite({
      id: optimisticId,
      projectId: gallery.projectId,
      galleryId: gallery.id,
      visitorId: visitor.id,
      assetId: asset.id,
    });
    if (created) {
      recordGalleryEvent({
        projectId: gallery.projectId,
        galleryId: gallery.id,
        visitorId: visitor.id,
        assetId: asset.id,
        kind: "favorite",
      });
    } else {
      setFavorites((prev) => {
        const next = new Map(prev);
        next.delete(asset.id);
        return next;
      });
      toast.error("Couldn't save that favorite.");
    }
  };

  const handleRequest = async (message) => {
    if (!visitor) return;
    const assetIds = Array.from(favoriteIds);
    const created = await createDownloadRequest({
      id: crypto.randomUUID(),
      projectId: gallery.projectId,
      galleryId: gallery.id,
      visitorId: visitor.id,
      scope: assetIds.length > 0 ? "selection" : "gallery",
      assetIds,
      message,
      status: "pending",
    });
    if (created) {
      setRequested(true);
      recordGalleryEvent({
        projectId: gallery.projectId,
        galleryId: gallery.id,
        visitorId: visitor.id,
        kind: "request",
      });
      toast.success("Request sent.");
    } else {
      toast.error("Couldn't send the request.");
    }
  };

  const handleOpen = (asset) => {
    const at = visibleItems.findIndex((row) => row.asset?.id === asset.id);
    setLightboxIndex(at < 0 ? 0 : at);
    if (!visitor) return;
    recordGalleryEvent({
      projectId: gallery.projectId,
      galleryId: gallery.id,
      visitorId: visitor.id,
      assetId: asset.id,
      kind: "item_view",
    });
  };

  const handleDownload = (asset) => {
    if (!visitor) return;
    recordGalleryEvent({
      projectId: gallery.projectId,
      galleryId: gallery.id,
      visitorId: visitor.id,
      assetId: asset.id,
      kind: "download",
    });
  };

  const handleShare = async () => {
    const url = window.location.href.split("#")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title: gallery.name, text: gallery.headline || undefined, url });
        return;
      } catch (err) {
        // A dismissed share sheet isn't an error worth reporting.
        if (err?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const downloadHref =
    gallery.downloadMode === "open"
      ? (asset) => `/g/${encodeURIComponent(gallery.slug)}/download/${asset.id}`
      : null;
  const handleBuy = (asset) => {
    setLightboxIndex(null);
    setBuyAsset(asset);
  };

  const addLine = (line, { open = false } = {}) => {
    cart.add(line);
    setBuyAsset(null);
    if (open) setCartOpen(true);
    else toast.success("Added to your cart.", { action: { label: "View cart", onClick: () => setCartOpen(true) } });
  };

  const startBundle = (offer) => {
    setView("all");
    setBundle({ offer, selected: new Set() });
    document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
  };

  const cancelBundle = () => setBundle(null);
  const clearBundle = () => setBundle((b) => (b ? { ...b, selected: new Set() } : b));

  const toggleBundlePick = (asset) =>
    setBundle((b) => {
      if (!b) return b;
      const selected = new Set(b.selected);
      if (selected.has(asset.id)) selected.delete(asset.id);
      else if (selected.size >= b.offer.bundleSize) {
        toast(`This bundle holds ${b.offer.bundleSize} — deselect one to swap it.`);
        return b;
      } else selected.add(asset.id);
      return { ...b, selected };
    });

  const navLinks = completeLinks(gallery.nav);
  const showSelectionBar = canFavorite && favoriteIds.size > 0 && activeIndex == null && !bundle;

  return (
    <div
      className={cn(
        "min-h-screen",
        TYPOGRAPHY_CLASS[theme.typography] || TYPOGRAPHY_CLASS.sans,
        tone.page,
        // Keep the footer clear of the floating selection bar and back-to-top.
        (showSelectionBar || showTop || bundle) && "pb-20",
      )}
    >
      {theme.header.show ? (
        <GalleryTopbar gallery={gallery} theme={theme} tone={tone} links={navLinks} />
      ) : null}

      <GalleryHero
        gallery={gallery}
        cover={cover}
        theme={theme}
        tone={tone}
        count={items.length}
        links={theme.header.show ? [] : navLinks}
        protect={protect}
      />

      {/* Divider under the poster: content width, fading out at both ends. */}
      <div aria-hidden="true" className="mt-12 px-4 sm:mt-16 sm:px-6">
        <div
          className={cn(
            "mx-auto h-px bg-gradient-to-r from-transparent to-transparent",
            pageWidth(theme),
            tone.rule,
          )}
        />
      </div>

      {/* Sticky toolbar ------------------------------------------------------ */}
      <div className={cn("sticky top-0 z-30 mt-4 backdrop-blur-xl", tone.bar)}>
        <div className={cn("mx-auto flex h-12 items-center gap-2 px-4 sm:px-6", pageWidth(theme))}>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{gallery.name}</p>

          {bundle ? (
            <span
              className={cn(
                "inline-flex h-9 min-w-0 items-center gap-1.5 rounded-lg border pl-3 pr-1 text-sm font-medium animate-in fade-in duration-200",
                tone.chip,
              )}
            >
              <Boxes className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden max-w-[10rem] truncate sm:inline">{bundle.offer.name}</span>
              <span className={cn("tabular-nums", tone.subtle)}>
                {bundle.selected.size}/{bundle.offer.bundleSize}
              </span>
              <button
                type="button"
                onClick={cancelBundle}
                aria-label="Stop picking for this bundle"
                title="Stop picking (Esc)"
                className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : null}

          {gallery.allowFavorites ? (
            <Tabs value={showingFavorites ? "favorites" : "all"} onValueChange={setView}>
              <TabsList className={tone.tabsList}>
                <TabsTrigger value="all" className={tone.tabsTrigger}>
                  <Images />
                  All
                  <span className={cn("tabular-nums", tone.subtle)}>{items.length}</span>
                </TabsTrigger>
                <TabsTrigger value="favorites" className={tone.tabsTrigger}>
                  <Heart className={cn(favoriteIds.size > 0 && "fill-red-500 text-red-500")} />
                  <span className="hidden sm:inline">Favorites</span>
                  <span className={cn("tabular-nums", tone.subtle)}>{favoriteIds.size}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}

          <button
            type="button"
            onClick={handleShare}
            aria-label="Share gallery"
            title="Share gallery"
            className={cn("flex h-9 w-9 items-center justify-center rounded-lg border transition-colors", tone.chip)}
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>

          {wideOffers.length ? (
            <Popover open={offersOpen} onOpenChange={setOffersOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Gallery offers, ${wideOffers.length} available`}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                    tone.chip,
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Offers</span>
                  <span className={cn("tabular-nums", tone.subtle)}>{wideOffers.length}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", offersOpen && "rotate-180", tone.subtle)} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className={cn("w-80 rounded-xl p-1.5", tone.page, tone.surface, tone.border)}>
                <p className={cn("px-2.5 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider", tone.subtle)}>
                  For the whole gallery
                </p>
                {wideOffers.map((offer) => {
                  const Icon = WIDE_OFFER_ICON[offer.kind] || Package;
                  return (
                    <button
                      key={offer.offerId}
                      type="button"
                      onClick={() => {
                        setOffersOpen(false);
                        if (offer.kind === "bundle") startBundle(offer);
                        else addLine({ offerId: offer.offerId }, { open: true });
                      }}
                      className={cn("flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors", tone.link)}
                    >
                      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border", tone.border, tone.card)}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-medium">{offer.name}</span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{formatPrice(offer.priceCents, currency)}</span>
                        </span>
                        <span className={cn("mt-0.5 line-clamp-2 block text-xs", tone.subtle)}>
                          {offer.description || offerSummary(offer)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          ) : null}

          {store ? (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={`Open cart, ${cart.count} item${cart.count === 1 ? "" : "s"}`}
              className={cn(
                "relative inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition",
                primary.className,
              )}
              style={primary.style}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{commerce.display.cartLabel || "Cart"}</span>
              {cart.count ? (
                <span className="rounded-full bg-black/20 px-1.5 text-[11px] tabular-nums">{cart.count}</span>
              ) : null}
            </button>
          ) : null}

          {gallery.downloadMode === "request" ? (
            <button
              type="button"
              disabled={requested || !visitor}
              onClick={() => setShowRequest(true)}
              title={requested ? "Download Requested" : "Request Download"}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition disabled:opacity-60",
                store ? cn("border", tone.chip) : primary.className,
              )}
              style={store ? undefined : primary.style}
            >
              {requested ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{requested ? "Requested" : "Request Download"}</span>
            </button>
          ) : null}
        </div>
      </div>

      <main
        id="gallery"
        className={cn("mx-auto scroll-mt-12 px-4 py-8 sm:px-6 sm:py-10", pageWidth(theme))}
      >
        {/* Gallery ------------------------------------------------------------ */}
        {items.length === 0 ? (
          <div className={cn("flex flex-col items-center py-28 text-center", tone.subtle)}>
            <Images className="h-8 w-8" aria-hidden="true" />
            <p className="mt-3 text-sm">Nothing has been added to this gallery yet.</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <span className={cn("flex h-12 w-12 items-center justify-center rounded-full border", tone.border, tone.surface)}>
              <Heart className={cn("h-5 w-5", tone.subtle)} />
            </span>
            <p className="mt-4 text-sm font-medium">No favorites yet</p>
            <p className={cn("mt-1 max-w-xs text-sm", tone.muted)}>
              Tap the heart on anything you like to build your selection.
            </p>
            <button
              type="button"
              onClick={() => setView("all")}
              className={cn("mt-5 inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium", tone.chip)}
            >
              Browse all
            </button>
          </div>
        ) : gallery.layout === "slideshow" ? (
          <GallerySlideshow
            items={visibleItems}
            theme={theme}
            favorites={favoriteIds}
            onToggleFavorite={canFavorite ? handleToggleFavorite : undefined}
            onOpen={handleOpen}
            protect={protect}
          />
        ) : (
          <GalleryGrid
            items={visibleItems}
            theme={theme}
            layout={gallery.layout}
            favorites={favoriteIds}
            onToggleFavorite={canFavorite ? handleToggleFavorite : undefined}
            onOpen={handleOpen}
            protect={protect}
            priceFor={store ? priceFor : undefined}
            onBuy={store ? handleBuy : undefined}
            selection={bundle ? bundle.selected : null}
            onSelect={toggleBundlePick}
          />
        )}
      </main>

      <GalleryFooter gallery={gallery} theme={theme} tone={tone} />

      {/* Selection bar: favorites summary + next step ------------------------ */}
      {showSelectionBar ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/90 py-1.5 pl-4 pr-1.5 text-sm text-white shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-300">
            <Heart className="h-4 w-4 fill-red-500 text-red-500" aria-hidden="true" />
            <span className="tabular-nums">{plural(favoriteIds.size, "favorite")}</span>
            {!showingFavorites ? (
              <button
                type="button"
                onClick={() => {
                  setView("favorites");
                  document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="ml-1 h-8 rounded-full px-3 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                View
              </button>
            ) : null}
            {gallery.downloadMode === "request" && !requested ? (
              <button
                type="button"
                onClick={() => setShowRequest(true)}
                className="h-8 rounded-full bg-white px-3 text-xs font-medium text-zinc-900 hover:bg-white/90"
              >
                Request these
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showTop && activeIndex == null ? (
        <button
          type="button"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className={cn(
            "fixed bottom-5 right-5 z-40 flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur-xl transition-colors",
            tone.chip,
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      ) : null}

      {activeIndex != null ? (
        <GalleryLightbox
          items={visibleItems}
          index={activeIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          favorites={favoriteIds}
          onToggleFavorite={canFavorite ? handleToggleFavorite : undefined}
          downloadHref={downloadHref}
          onDownload={handleDownload}
          onShare={handleShare}
          protect={protect}
          priceFor={store ? priceFor : undefined}
          onBuy={store ? handleBuy : undefined}
        />
      ) : null}

      {bundle ? (
        <BundleBar
          offer={bundle.offer}
          count={bundle.selected.size}
          currency={currency}
          onCancel={cancelBundle}
          onClear={clearBundle}
          onAdd={() => {
            addLine({ offerId: bundle.offer.offerId, assetIds: [...bundle.selected] }, { open: true });
            setBundle(null);
          }}
        />
      ) : null}

      {store ? (
        <>
          <BuyDialog
            asset={buyAsset}
            offers={buyAsset ? offersByAsset.get(buyAsset.id) || [] : []}
            currency={currency}
            showCompareAt={commerce.display.showCompareAt}
            cartKeys={cartKeys}
            onOpenChange={(open) => !open && setBuyAsset(null)}
            onAdd={(line) => addLine(line)}
            onBuyNow={(line) => addLine(line, { open: true })}
          />
          <CartSheet
            open={cartOpen}
            onOpenChange={setCartOpen}
            gallery={gallery}
            store={store}
            cart={cart}
            assetsById={assetsById}
            offerLookup={offerLookup}
            visitor={visitor}
          />
        </>
      ) : null}

      <IdentityDialog open={needsIdentity} onSubmit={handleIdentity} galleryName={gallery.name} />
      <RequestDialog
        open={showRequest}
        onOpenChange={setShowRequest}
        onSubmit={handleRequest}
        count={favoriteIds.size}
      />
    </div>
  );
}

export default GalleryView;
