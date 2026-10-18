"use client";

// The building blocks of a creator's Home tab. Each section type in
// lib/creator/page_config.js renders here from data the server already
// resolved per viewer (locked posts arrive without their media), so a section
// can never reveal more than the feed itself would.

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ExternalLink,
  HandCoins,
  Heart,
  Images,
  Lock,
  MessageCircle,
  Package,
  Play,
  UserPlus,
} from "lucide-react";
import { Button } from "@geiger/ui/button";
import { embedIsAudio, embedSrc, sectionAnimation } from "@/lib/creator/page_config";
import { cn } from "@/lib/utils";
import { PlansGrid } from "./membership";
import { EffectLayer, MediaLayer, Reveal } from "./page_effects";
import { formatMoney } from "./public_kit";

function SectionShell({ title, action, children, className }) {
  return (
    <section className={cn("space-y-4", className)}>
      {title || action ? (
        <div className="flex items-end justify-between gap-3">
          {title ? <h2 className="cp-heading text-xl font-semibold text-foreground sm:text-2xl">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function SeeAll({ label = "See all", onClick }) {
  return (
    <button type="button" onClick={onClick} className="text-sm font-medium text-text-secondary hover:text-foreground">
      {label} →
    </button>
  );
}

/** Run a section's call to action. */
function runCta(ctx, action, url) {
  if (action === "follow") return ctx.onFollow();
  if (action === "tip") return ctx.openTip();
  if (action === "link" && url) return window.open(url, "_blank", "noopener,noreferrer");
  return ctx.openMembership();
}

// ---------------------------------------------------------------------------
// Post tiles (featured, grids, gallery)

function lockLabel(post, tierById) {
  if (post.locked === "ppv") return formatMoney(post.priceCents, post.currency);
  if (post.locked === "tier") return tierById.get(post.minTierId)?.name || "Tier";
  return "Members";
}

export function PostTile({ post, ctx, size = "md" }) {
  const cover = post.media[0];
  const image = !post.locked && cover?.thumbnailUrl ? cover.thumbnailUrl : "";
  return (
    <button
      type="button"
      onClick={() => ctx.openPost(post)}
      className={cn(
        "cp-card cp-hover group relative flex w-full flex-col overflow-hidden text-left",
        size === "lg" ? "aspect-[4/5] sm:aspect-[4/3]" : "aspect-[4/5]",
      )}
    >
      <div className="absolute inset-0 overflow-hidden" style={cover?.color ? { backgroundColor: cover.color } : undefined}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : cover?.miniThumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.miniThumbnailUrl} alt="" aria-hidden className="h-full w-full scale-110 object-cover blur-2xl" />
        ) : (
          <div className="h-full w-full" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--cp-accent) 30%, var(--surface-card)), var(--surface-card))" }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      </div>
      <div className="relative flex items-start justify-between gap-2 p-3">
        {post.locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            <Lock className="h-3 w-3" />
            {lockLabel(post, ctx.tierById)}
          </span>
        ) : (
          <span />
        )}
        {post.mediaCount > 1 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white backdrop-blur">
            <Images className="h-3 w-3" />
            {post.mediaCount}
          </span>
        ) : cover?.type === "video" ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
            <Play className="h-3.5 w-3.5 fill-current" />
          </span>
        ) : null}
      </div>
      <div className="relative mt-auto space-y-1 p-3 text-white">
        {post.title ? <p className={cn("line-clamp-2 font-semibold", size === "lg" ? "text-lg" : "text-sm")}>{post.title}</p> : null}
        {size === "lg" && post.teaser ? <p className="line-clamp-2 text-sm text-white/75">{post.teaser}</p> : null}
        <p className="flex items-center gap-3 text-[11px] text-white/70">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {post.likeCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {post.commentCount}
          </span>
        </p>
      </div>
    </button>
  );
}

function tileGrid(count) {
  return count === 1 ? "grid-cols-1" : count === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-3";
}

// ---------------------------------------------------------------------------
// Sections

function HeroSection({ props, ctx }) {
  const media = props.mediaAssetId ? ctx.pageAssets[props.mediaAssetId] : null;
  const centered = props.align === "center";
  const text = (
    <div className={cn("flex flex-col gap-4", centered ? "items-center text-center" : "items-start")}>
      {props.eyebrow ? <p className="cp-accent-soft rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">{props.eyebrow}</p> : null}
      {props.heading ? <h2 className="cp-heading text-3xl font-semibold leading-[1.1] text-foreground sm:text-5xl">{props.heading}</h2> : null}
      {props.body ? <p className={cn("whitespace-pre-line text-base text-text-secondary sm:text-lg", centered && "max-w-2xl")}>{props.body}</p> : null}
      {props.ctaLabel ? (
        <Button className="cp-accent cp-radius-sm mt-2 h-11 px-6 text-base" onClick={() => runCta(ctx, props.ctaAction, props.ctaUrl)}>
          {props.ctaLabel}
        </Button>
      ) : null}
    </div>
  );
  if (!media) return <section className={cn("py-4 sm:py-8", centered && "flex justify-center")}>{text}</section>;
  return (
    <section className={cn("grid items-center gap-6 py-2 sm:gap-10", centered ? "text-center" : "md:grid-cols-2")}>
      {text}
      <div className="cp-card overflow-hidden" style={{ backgroundColor: media.color }}>
        {media.type === "video" ? (
          <video src={media.url} poster={media.thumbnailUrl || undefined} autoPlay muted loop playsInline className="aspect-[4/3] w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.thumbnailUrl} alt="" className="aspect-[4/3] w-full object-cover" />
        )}
      </div>
    </section>
  );
}

function FeaturedSection({ props, ctx }) {
  const posts = useMemo(() => {
    if (props.mode === "picked") {
      const byId = new Map(ctx.feed.map((p) => [p.id, p]));
      return props.postIds.map((id) => byId.get(id)).filter(Boolean);
    }
    if (props.mode === "popular") return [...ctx.feed].sort((a, b) => b.likeCount + b.commentCount - (a.likeCount + a.commentCount));
    return ctx.feed.filter((p) => p.isPinned);
  }, [ctx.feed, props.mode, props.postIds]).slice(0, props.limit);
  if (!posts.length) return ctx.editing ? <EditorHint text="Featured posts — pin or pick posts to fill this section." /> : null;
  return (
    <SectionShell title={props.title}>
      <div className={cn("grid gap-3 sm:gap-4", tileGrid(posts.length))}>
        {posts.map((post) => (
          <PostTile key={post.id} post={post} ctx={ctx} size={posts.length <= 2 ? "lg" : "md"} />
        ))}
      </div>
    </SectionShell>
  );
}

function TiersSection({ props, ctx }) {
  if (!ctx.tiers.length) return ctx.editing ? <EditorHint text="Membership tiers — add tiers in Tiers to show them here." /> : null;
  return (
    <SectionShell title={props.title}>
      {props.subtitle ? <p className="-mt-2 text-sm text-text-secondary">{props.subtitle}</p> : null}
      <PlansGrid {...ctx.plans} highlightTierId={props.highlightTierId} />
    </SectionShell>
  );
}

function FeedSection({ props, ctx }) {
  const posts = useMemo(
    () => (props.filter === "all" ? ctx.feed : ctx.feed.filter((p) => (props.filter === "members" ? ["members", "tier"].includes(p.visibility) : p.visibility === props.filter))),
    [ctx.feed, props.filter],
  );
  const shown = posts.slice(0, props.limit);
  if (!shown.length) return ctx.editing ? <EditorHint text="Post feed — publish posts to fill this section." /> : null;
  return (
    <SectionShell title={props.title} action={posts.length > shown.length ? <SeeAll label="All posts" onClick={() => ctx.openTab("posts")} /> : null}>
      {props.layout === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {shown.map((post) => (
            <PostTile key={post.id} post={post} ctx={ctx} />
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-4">
          {shown.map((post) => ctx.renderPost(post))}
        </div>
      )}
    </SectionShell>
  );
}

function GallerySection({ props, ctx }) {
  const tiles = useMemo(() => {
    const list = [];
    for (const post of ctx.feed) {
      if (post.locked && !props.includeLocked) continue;
      const media = post.locked ? post.media.slice(0, 1) : post.media;
      media.forEach((m, i) => {
        if (m && (m.type === "image" || m.type === "video")) list.push({ key: `${post.id}:${i}`, post, media: m });
      });
    }
    return list.slice(0, props.limit);
  }, [ctx.feed, props.includeLocked, props.limit]);
  if (!tiles.length) return ctx.editing ? <EditorHint text="Media grid — posts with photos or videos appear here." /> : null;
  const cols = { 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[props.columns];
  const colsMasonry = { 2: "columns-2", 3: "columns-2 sm:columns-3", 4: "columns-2 sm:columns-4" }[props.columns];
  return (
    <SectionShell title={props.title}>
      <div className={props.layout === "masonry" ? cn("gap-2 sm:gap-3", colsMasonry) : cn("grid gap-2 sm:gap-3", cols)}>
        {tiles.map(({ key, post, media }) => {
          const open = !post.locked && media.thumbnailUrl;
          const ratio = props.layout === "masonry" && media.width && media.height ? `${media.width} / ${media.height}` : "1 / 1";
          return (
            <button
              key={key}
              type="button"
              onClick={() => ctx.openPost(post)}
              className={cn("cp-radius-sm cp-hover group relative block w-full overflow-hidden bg-surface-card", props.layout === "masonry" && "mb-2 break-inside-avoid sm:mb-3")}
              style={{ aspectRatio: ratio, backgroundColor: media.color }}
            >
              {open ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : media.miniThumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.miniThumbnailUrl} alt="" aria-hidden className="h-full w-full scale-110 object-cover blur-xl" />
              ) : null}
              {post.locked ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
                    <Lock className="h-4 w-4" />
                  </span>
                </span>
              ) : media.type === "video" ? (
                <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
                  <Play className="h-3.5 w-3.5 fill-current" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </SectionShell>
  );
}

export function BundleCard({ bundle, busy, onBuy }) {
  const saving = bundle.valueCents > bundle.priceCents ? Math.round((1 - bundle.priceCents / bundle.valueCents) * 100) : 0;
  return (
    <div className="cp-card cp-hover flex flex-col overflow-hidden">
      <div className="relative aspect-[16/9] bg-surface-card" style={bundle.cover?.color ? { backgroundColor: bundle.cover.color } : undefined}>
        {bundle.cover?.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bundle.cover.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Package className="absolute inset-0 m-auto h-8 w-8 text-text-tertiary" />
        )}
        {saving > 0 && !bundle.owned ? <span className="cp-accent absolute left-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-semibold">Save {saving}%</span> : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="cp-heading text-base font-semibold text-foreground">{bundle.title}</h3>
          <p className="mt-0.5 text-xs text-text-secondary">
            {bundle.postCount} posts · {bundle.mediaCount} items
          </p>
        </div>
        {bundle.description ? <p className="text-sm text-text-secondary">{bundle.description}</p> : null}
        {bundle.titles.length ? (
          <ul className="space-y-1 text-xs text-text-secondary">
            {bundle.titles.map((t) => (
              <li key={t} className="truncate">
                · {t}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {formatMoney(bundle.priceCents, bundle.currency)}
            {saving > 0 ? <span className="ml-2 text-xs font-normal text-text-tertiary line-through">{formatMoney(bundle.valueCents, bundle.currency)}</span> : null}
          </p>
          {bundle.owned ? (
            <span className="inline-flex items-center gap-1 text-sm text-text-secondary">
              <Check className="h-4 w-4 cp-accent-text" />
              Owned
            </span>
          ) : (
            <Button className="cp-accent cp-radius-sm" disabled={busy === `bundle:${bundle.id}`} onClick={() => onBuy(bundle)}>
              Buy bundle
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function BundlesSection({ props, ctx }) {
  if (!ctx.bundles.length) return ctx.editing ? <EditorHint text="Bundles — create a bundle to sell it here." /> : null;
  return (
    <SectionShell title={props.title}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ctx.bundles.map((bundle) => (
          <BundleCard key={bundle.id} bundle={bundle} busy={ctx.busy} onBuy={ctx.buyBundle} />
        ))}
      </div>
    </SectionShell>
  );
}

function TextSection({ props }) {
  if (!props.heading && !props.body) return null;
  const centered = props.align === "center";
  return (
    <section className={cn("space-y-3", centered && "mx-auto max-w-2xl text-center")}>
      {props.heading ? <h2 className="cp-heading text-xl font-semibold text-foreground sm:text-2xl">{props.heading}</h2> : null}
      {props.body ? <p className="whitespace-pre-line text-base leading-relaxed text-text-secondary">{props.body}</p> : null}
    </section>
  );
}

function LinksSection({ props, ctx }) {
  const links = ctx.creator.profile.links;
  if (!links.length) return ctx.editing ? <EditorHint text="Links — add links in the Profile tab." /> : null;
  return (
    <SectionShell title={props.title}>
      {props.style === "buttons" ? (
        <div className="mx-auto grid w-full max-w-md gap-2.5">
          {links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              className="cp-card cp-hover flex h-12 items-center justify-center px-4 text-sm font-medium text-foreground"
            >
              {link.label || link.url}
            </a>
          ))}
        </div>
      ) : (
        <div className="cp-card p-2">
          {links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              className="cp-radius-sm flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-surface-hover"
            >
              <span className="truncate">{link.label || link.url}</span>
              <ExternalLink className="h-4 w-4 shrink-0 text-text-tertiary" />
            </a>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function FaqSection({ props, ctx }) {
  const items = props.items.filter((i) => i.q);
  if (!items.length) return ctx.editing ? <EditorHint text="FAQ — add questions in the section settings." /> : null;
  return (
    <SectionShell title={props.title}>
      <div className="cp-card divide-y divide-border">
        {items.map((item, i) => (
          <details key={i} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
              {item.q}
              <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary transition-transform group-open:rotate-180" />
            </summary>
            {item.a ? <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">{item.a}</p> : null}
          </details>
        ))}
      </div>
    </SectionShell>
  );
}

function useNow(active) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    if (!active) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

const COUNTDOWN_UNITS = ["Days", "Hours", "Min", "Sec"];

function CountdownUnit({ value, label, display }) {
  const digits = value === null ? "–" : String(value).padStart(2, "0");
  // Keyed on the value so each change remounts and plays the tick.
  const number = (
    <span key={digits} className="cp-tick">
      {digits}
    </span>
  );
  if (display === "minimal") {
    return (
      <div className="flex flex-col items-center">
        <span className="cp-heading text-4xl font-semibold tabular-nums leading-none text-foreground sm:text-6xl">{number}</span>
        <span className="mt-2 text-[10px] uppercase tracking-[0.2em] text-text-tertiary">{label}</span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "cp-radius-sm flex w-16 flex-col items-center overflow-hidden py-3 sm:w-20 sm:py-4",
        display === "outline" ? "border border-[color-mix(in_oklab,var(--cp-accent)_45%,transparent)] bg-background/30 backdrop-blur" : "bg-surface-card",
      )}
    >
      <span className={cn("cp-heading text-2xl font-semibold tabular-nums sm:text-3xl", display === "outline" ? "cp-accent-text" : "text-foreground")}>{number}</span>
      <span className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</span>
    </div>
  );
}

function CountdownSection({ props, ctx, framed }) {
  const target = new Date(props.date).getTime();
  const valid = Number.isFinite(target);
  const now = useNow(valid);
  if (!valid) return ctx.editing ? <EditorHint text="Countdown — set a date in the section settings." /> : null;
  const left = now === null ? null : Math.max(0, target - now);
  const values =
    left === null
      ? [null, null, null, null]
      : [Math.floor(left / 86400000), Math.floor(left / 3600000) % 24, Math.floor(left / 60000) % 60, Math.floor(left / 1000) % 60];
  const minimal = props.display === "minimal";
  return (
    <section className={cn("flex flex-col items-center gap-5 text-center", !framed && "cp-card px-5 py-8 sm:py-10")}>
      {props.title ? <h2 className="cp-heading text-2xl font-semibold text-foreground sm:text-3xl">{props.title}</h2> : null}
      {props.body ? <p className="max-w-xl whitespace-pre-line text-sm text-text-secondary">{props.body}</p> : null}
      {left === 0 ? (
        <p className="cp-accent-soft rounded-full px-4 py-1.5 text-sm font-semibold">It&apos;s live</p>
      ) : (
        <div className={cn("flex items-start", minimal ? "gap-3 sm:gap-6" : "gap-2 sm:gap-3")}>
          {values.map((value, i) => (
            <React.Fragment key={COUNTDOWN_UNITS[i]}>
              {minimal && i > 0 ? <span className="cp-heading text-3xl font-light leading-none text-text-tertiary sm:text-5xl">:</span> : null}
              <CountdownUnit value={value} label={COUNTDOWN_UNITS[i]} display={props.display} />
            </React.Fragment>
          ))}
        </div>
      )}
      {props.ctaLabel ? (
        <Button className="cp-accent cp-radius-sm" onClick={() => runCta(ctx, props.ctaAction, props.ctaUrl)}>
          {props.ctaLabel}
        </Button>
      ) : null}
    </section>
  );
}

function FollowSection({ props, ctx, framed }) {
  const following = ctx.viewer.following;
  return (
    <section className={cn("flex flex-col items-start gap-4 sm:flex-row sm:items-center", !framed && "cp-card p-5 sm:p-6")}>
      <div className="min-w-0 flex-1 space-y-1">
        {props.heading ? <h2 className="cp-heading text-lg font-semibold text-foreground">{props.heading}</h2> : null}
        <p className="text-sm text-text-secondary">
          {props.body || `Follow ${ctx.creator.profile.displayName} for free to see public posts and hear about new drops.`}
        </p>
      </div>
      <Button
        className={cn("cp-radius-sm shrink-0", following ? "border-border bg-transparent hover:bg-surface-hover" : "cp-accent")}
        variant={following ? "outline" : "default"}
        disabled={ctx.busy === "follow" || ctx.busy === "unfollow"}
        onClick={ctx.onFollow}
      >
        {following ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {following ? "Following" : "Follow for free"}
      </Button>
    </section>
  );
}

function TipSection({ props, ctx, framed }) {
  const { profile } = ctx.creator;
  if (!profile.tipsEnabled) return ctx.editing ? <EditorHint text="Tip jar — turn tips on in Settings." /> : null;
  const amounts = (profile.suggestedTips.length ? profile.suggestedTips : [300, 500, 1000, 2500]).slice(0, 4);
  return (
    <section className={cn("flex flex-col items-center gap-4 text-center", !framed && "cp-card px-5 py-8")}>
      <span className="cp-accent-soft flex h-11 w-11 items-center justify-center rounded-full">
        <HandCoins className="h-5 w-5" />
      </span>
      {props.heading ? <h2 className="cp-heading text-xl font-semibold text-foreground">{props.heading}</h2> : null}
      {props.body ? <p className="max-w-md whitespace-pre-line text-sm text-text-secondary">{props.body}</p> : null}
      <div className="flex flex-wrap justify-center gap-2">
        {amounts.map((cents) => (
          <Button key={cents} variant="outline" className="cp-radius-sm min-w-20 border-border bg-transparent hover:bg-surface-hover" onClick={() => ctx.openTip({ type: "profile", amountCents: cents })}>
            {formatMoney(cents)}
          </Button>
        ))}
        <Button className="cp-accent cp-radius-sm" onClick={() => ctx.openTip()}>
          Custom
        </Button>
      </div>
    </section>
  );
}

function EmbedSection({ props, ctx }) {
  const src = embedSrc(props.url);
  if (!src) return ctx.editing ? <EditorHint text="Embed — paste a YouTube, Vimeo, Spotify or SoundCloud link." /> : null;
  const audio = embedIsAudio(src);
  return (
    <SectionShell title={props.title}>
      <div className="cp-card overflow-hidden">
        <iframe
          src={src}
          title={props.title || "Embedded player"}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; clipboard-write; fullscreen"
          className={cn("block w-full border-0", audio ? "h-[232px]" : "aspect-video")}
        />
      </div>
    </SectionShell>
  );
}

/** Shown only in the builder's preview, where an empty section would otherwise vanish. */
function EditorHint({ text }) {
  return <div className="cp-radius flex items-center justify-center border border-dashed border-border px-4 py-8 text-center text-sm text-text-tertiary">{text}</div>;
}

const RENDERERS = {
  hero: HeroSection,
  featured: FeaturedSection,
  tiers: TiersSection,
  feed: FeedSection,
  gallery: GallerySection,
  bundles: BundlesSection,
  text: TextSection,
  links: LinksSection,
  faq: FaqSection,
  countdown: CountdownSection,
  follow: FollowSection,
  tip: TipSection,
  embed: EmbedSection,
};

const FRAME_PADDING = {
  sm: { box: "px-5 py-8 sm:px-8", y: "py-8" },
  md: { box: "px-5 py-12 sm:px-10 sm:py-16", y: "py-12 sm:py-16" },
  lg: { box: "px-6 py-16 sm:px-14 sm:py-24", y: "py-16 sm:py-24" },
};

/** A section's backdrop — background, image treatment, effect layer — around its content. */
function SectionFrame({ style, ctx, children }) {
  const full = style.width === "full";
  const pad = FRAME_PADDING[style.padding] || FRAME_PADDING.md;
  const media = style.background === "image" ? ctx.pageAssets[style.bgAssetId] : null;
  return (
    <div
      className={cn(
        "cp-frame relative isolate overflow-hidden",
        full ? "cp-bleed" : style.background === "surface" ? "cp-card" : "cp-radius",
        `cp-bg-${style.background}`,
      )}
    >
      {media ? <MediaLayer media={media} effect={style.mediaEffect} overlay={style.overlay} /> : null}
      <EffectLayer effect={style.effect} />
      <div className={cn("cp-frame-body relative", full ? cn("cp-container", pad.y) : pad.box)}>{children}</div>
    </div>
  );
}

export function PageSection({ section, ctx }) {
  const Renderer = RENDERERS[section.type];
  if (!Renderer) return null;
  const style = section.style;
  const framed = style.background !== "none";
  const animation = sectionAnimation(section, ctx.theme);
  const content = <Renderer props={section.props} ctx={ctx} framed={framed} />;
  return (
    <Reveal
      id={`section-${section.id}`}
      data-section-id={section.id}
      className="scroll-mt-24"
      animation={animation}
      replayKey={ctx.editing ? JSON.stringify(style) : undefined}
    >
      {framed ? <SectionFrame style={style} ctx={ctx}>{content}</SectionFrame> : content}
    </Reveal>
  );
}
