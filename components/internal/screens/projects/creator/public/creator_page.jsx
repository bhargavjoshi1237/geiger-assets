"use client";

// The fan's view of a creator — the public page at /c/<handle>. Access to every
// post was resolved on the server (see lib/creator/server.js); this component
// is the interactive half. The creator's page document (lib/creator/page_config)
// decides the look — theme, header layout, nav — and the Home tab's sections;
// the Posts, Membership, Shop and About tabs are always-there utilities.
//
// In the workspace preview (?preview=1) the page takes live draft updates from
// the builder over postMessage and every fan action is a no-op.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  CircleUserRound,
  ExternalLink,
  HandCoins,
  Images,
  LogOut,
  MessagesSquare,
  Share2,
  Sparkles,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@geiger/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";
import { EmptyState } from "@/components/internal/shared/screen_kit";
import { PREVIEW_MESSAGE, normalizePageConfig, sectionVisible } from "@/lib/creator/page_config";
import { cn } from "@/lib/utils";
import { FanAuthDialog } from "./fan_auth_dialog";
import { FanInboxDrawer } from "./fan_inbox";
import { TipDialog } from "./tip_dialog";
import { PostCard } from "./post_card";
import { CancelDialog, LifecycleBanner, PlansGrid } from "./membership";
import { BundleCard, PageSection } from "./page_sections";
import { EffectLayer, MediaImage } from "./page_effects";
import { PageTheme } from "./page_theme";
import { formatDay, formatMoney, postJson } from "./public_kit";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Unlocked" },
  { value: "locked", label: "Locked" },
  { value: "saved", label: "Saved" },
];

/** Shared by the page and the inbox: sign-in, checkout hand-off, membership toggles. */
export function useFanActions({ handle, viewer, onNeedsTier }) {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState("");
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(null);
  const preview = Boolean(viewer.preview);

  const run = async (key, body) => {
    if (preview) {
      toast.info("Preview — fans can do this on your live page.");
      return {};
    }
    setBusy(key);
    const result = await postJson(`/api/creator/${encodeURIComponent(handle)}`, body);
    if (result.url) {
      window.location.assign(result.url);
      return result;
    }
    setBusy(null);
    if (result.signIn) {
      setAuthReason("Sign in to continue.");
      setPending(() => () => run(key, body));
      setAuthOpen(true);
      return result;
    }
    if (result.error) toast.error(result.error);
    return result;
  };

  const withFan = (reason, action) => {
    if (viewer.fan || preview) return action();
    setAuthReason(reason);
    setPending(() => action);
    setAuthOpen(true);
    return null;
  };

  const onSignedIn = () => {
    setAuthOpen(false);
    router.refresh();
    const next = pending;
    setPending(null);
    if (next) next();
  };

  return {
    busy,
    preview,
    auth: { open: authOpen, setOpen: setAuthOpen, reason: authReason, onSignedIn },
    signIn: () => {
      setAuthReason("");
      setPending(null);
      setAuthOpen(true);
    },
    signOut: async () => {
      if (preview) return;
      await postJson("/api/fans/auth", { action: "logout" });
      router.refresh();
    },
    join: (tierId, { cycle = "month", promoCode = "" } = {}) => {
      if (!tierId) return onNeedsTier?.();
      return withFan("Create a free account to join.", async () => {
        const result = await run(`join:${tierId}`, { action: "join", tierId, cycle, promoCode: promoCode || undefined });
        if (result.ok) {
          toast.success(result.trialLabel ? `${result.trialLabel} — enjoy!` : result.trial ? `Your ${result.trial}-day trial has started` : "You're in! Welcome aboard");
          router.refresh();
        }
      });
    },
    follow: (on) =>
      withFan("Create a free account to follow.", async () => {
        const result = await run(on ? "follow" : "unfollow", { action: on ? "follow" : "unfollow" });
        if (result.ok) {
          toast.success(on ? "You're following — you'll see new public posts here." : "Unfollowed");
          router.refresh();
        }
      }),
    checkout: (key, body, reason) => withFan(reason || "Sign in to continue.", () => run(key, { action: "checkout", ...body })),
    // Likes, bookmarks, comments and messages: resolves to the API result, or
    // null when the fan still has to sign in.
    engage: (action, payload) => withFan("Sign in to join in.", () => run(action, { action, ...payload })),
    cancel: async ({ reason, note }) => {
      const result = await run("cancel", { action: "cancel", reason, note });
      if (result.ok) {
        toast.success("Your membership will end at the period end");
        router.refresh();
      }
      return Boolean(result.ok);
    },
    toggleCancel: (cancel) =>
      withFan("Sign in to manage your membership.", async () => {
        const result = await run("cancel", { action: cancel ? "cancel" : "resume" });
        if (result.ok) {
          toast.success(cancel ? "Your membership will end at the period end" : "Your membership will renew");
          router.refresh();
        }
      }),
  };
}

// ---------------------------------------------------------------------------
// Header

function Avatar({ creator, className, text = "text-3xl" }) {
  const { profile, avatar } = creator;
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-full bg-surface-card", className)}>
      {avatar?.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar.thumbnailUrl} alt={profile.displayName} className="h-full w-full object-cover" />
      ) : (
        <span className={cn("cp-accent flex h-full w-full items-center justify-center font-semibold", text)}>{profile.displayName.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}

function AccountMenu({ viewer, actions, onMessages }) {
  if (!viewer.fan) {
    return (
      <Button variant="outline" size="sm" className="cp-radius-sm border-border bg-background/70 backdrop-blur hover:bg-surface-hover" onClick={actions.signIn}>
        Sign in
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="cp-radius-sm border-border bg-background/70 backdrop-blur hover:bg-surface-hover">
          <User className="h-4 w-4" />
          <span className="max-w-[10rem] truncate">{viewer.fan.displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-border bg-surface-subtle">
        <DropdownMenuLabel className="truncate text-xs font-normal text-text-secondary">{viewer.fan.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/fan">
            <CircleUserRound className="h-4 w-4" />
            My account
          </Link>
        </DropdownMenuItem>
        {viewer.member && onMessages ? (
          <DropdownMenuItem onSelect={onMessages}>
            <MessagesSquare className="h-4 w-4" />
            Messages
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={actions.signOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function linkHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function HeaderActions({ creator, viewer, actions, currentTier, ctaLabel, onSubscribe, onTip, onFollow, onShare, onMessages, align = "start" }) {
  const { profile } = creator;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", align === "center" && "justify-center")}>
      {currentTier ? (
        <span className="cp-radius-sm inline-flex h-9 items-center gap-1.5 border border-border bg-background/40 px-3 text-sm font-medium text-foreground backdrop-blur-md">
          <Check className="h-4 w-4 cp-accent-text" />
          {currentTier.name}
        </span>
      ) : (
        <Button className="cp-accent cp-radius-sm h-9" onClick={onSubscribe}>
          <Sparkles className="h-4 w-4" />
          {ctaLabel}
        </Button>
      )}
      {!currentTier ? (
        <Button
          variant="outline"
          className="cp-radius-sm border-border bg-background/40 backdrop-blur-md hover:bg-surface-hover"
          disabled={actions.busy === "follow" || actions.busy === "unfollow"}
          onClick={onFollow}
        >
          {viewer.following ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {viewer.following ? "Following" : "Follow"}
        </Button>
      ) : null}
      {profile.tipsEnabled ? (
        <Button variant="outline" className="cp-radius-sm border-border bg-background/40 backdrop-blur-md hover:bg-surface-hover" onClick={onTip}>
          <HandCoins className="h-4 w-4" />
          Tip
        </Button>
      ) : null}
      {viewer.fan && viewer.member && profile.messagesEnabled ? (
        <Button variant="outline" className="cp-radius-sm border-border bg-background/40 backdrop-blur-md hover:bg-surface-hover" onClick={onMessages}>
          <MessagesSquare className="h-4 w-4" />
          Messages
        </Button>
      ) : null}
      <Button variant="ghost" size="icon" aria-label="Share page" className="cp-radius-sm bg-background/30 text-text-secondary backdrop-blur-md hover:bg-surface-hover hover:text-foreground" onClick={onShare}>
        <Share2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function StatsLine({ creator, className }) {
  const { stats } = creator;
  const items = [
    [stats.posts, stats.posts === 1 ? "post" : "posts"],
    [stats.members, stats.members === 1 ? "member" : "members"],
    ...(stats.followers ? [[stats.followers, stats.followers === 1 ? "follower" : "followers"]] : []),
  ];
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary", className)}>
      {items.map(([count, label], i) => (
        <React.Fragment key={label}>
          {i > 0 ? <span aria-hidden className="text-text-tertiary">·</span> : null}
          <span>
            <span className="font-semibold tabular-nums text-foreground">{count}</span> {label}
          </span>
        </React.Fragment>
      ))}
    </p>
  );
}

function SocialChips({ links, className }) {
  if (!links.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {links.slice(0, 6).map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-background/35 px-2.5 text-xs text-text-secondary backdrop-blur-md transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          {link.label || linkHost(link.url)}
          <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </div>
  );
}

/**
 * The page's top bar: see-through over the header, then a solid blurred strip
 * once the fan scrolls — with the creator's mark, the join button (for
 * non-members, once the header's own button is out of view), their inbox and
 * account. `overlay` darkens the top edge when it sits on a header image.
 */
export function PageTopbar({ creator, viewer, actions, currentTier, ctaLabel, onSubscribe, onMessages, overlay = true, alwaysSolid = false }) {
  const { profile } = creator;
  const home = `/c/${encodeURIComponent(profile.handle)}`;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 160);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = alwaysSolid || scrolled;
  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-40 h-14 transition-[background-color,border-color,backdrop-filter] duration-300",
        solid ? "border-b border-border bg-background/80 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      {overlay && !solid ? <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 to-transparent" /> : null}
      <div className="cp-container relative flex h-full items-center gap-3">
        <Link
          href={home}
          aria-label={`${profile.displayName} home`}
          className={cn("flex min-w-0 items-center gap-2.5 transition-opacity duration-300", solid ? "opacity-100" : "pointer-events-none opacity-0")}
        >
          <Avatar creator={creator} className="h-8 w-8" text="text-sm" />
          <span className="cp-heading truncate text-sm font-semibold text-foreground">{profile.displayName}</span>
          {currentTier ? <span className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] text-text-secondary sm:inline">{currentTier.name}</span> : null}
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {!currentTier && onSubscribe && tiersExist(creator) ? (
            <Button
              size="sm"
              className={cn("cp-accent cp-radius-sm hidden transition-opacity duration-300 sm:inline-flex", solid ? "opacity-100" : "pointer-events-none opacity-0")}
              tabIndex={solid ? 0 : -1}
              onClick={onSubscribe}
            >
              <Sparkles className="h-4 w-4" />
              {ctaLabel}
            </Button>
          ) : null}
          {viewer.fan && viewer.member && profile.messagesEnabled ? (
            <Button variant="ghost" size="icon" aria-label="Messages" className="cp-radius-sm h-8 w-8 bg-background/40 text-foreground backdrop-blur hover:bg-surface-hover" onClick={onMessages}>
              <MessagesSquare className="h-4 w-4" />
            </Button>
          ) : null}
          <AccountMenu viewer={viewer} actions={actions} onMessages={profile.messagesEnabled ? onMessages : null} />
        </div>
      </div>
    </div>
  );
}

function tiersExist(creator) {
  return Boolean(creator.tiers?.length);
}

// A flat dim over the banner image, on top of each layout's own fade.
const HEADER_DIM = { light: 0, medium: 18, heavy: 42 };

/** Identity + primary actions. `layout` follows the page's header setting. */
export function CreatorHeader({ creator, viewer, actions, currentTier, page, onSubscribe, onTip, onFollow, onShare, onMessages }) {
  const { profile, banner } = creator;
  const home = `/c/${encodeURIComponent(profile.handle)}`;
  const header = page?.header || { layout: "banner", showStats: true, showSocials: false };
  const { layout } = header;
  const bannerStyle = !banner?.thumbnailUrl ? { background: "linear-gradient(135deg, color-mix(in oklab, var(--cp-accent) 45%, transparent), transparent 70%)" } : undefined;
  const dim = HEADER_DIM[header.overlay] ?? HEADER_DIM.medium;
  // The banner image with its treatment, the decorative layer and the dim — every banner layout draws it.
  const bannerImg = (
    <>
      {banner?.thumbnailUrl ? <MediaImage src={banner.thumbnailUrl} effect={header.mediaEffect} /> : null}
      <EffectLayer effect={header.effect} />
      {dim ? <span aria-hidden className="absolute inset-0" style={{ background: `color-mix(in oklab, var(--background) ${dim}%, transparent)` }} /> : null}
    </>
  );
  const enter = header.animate ? "cp-enter" : "";
  const actionProps = { creator, viewer, actions, currentTier, ctaLabel: page?.cta?.label || "Become a member", onSubscribe, onTip, onFollow, onShare, onMessages };
  const tagline = profile.tagline ? <p className="text-sm text-foreground sm:text-base">{profile.tagline}</p> : null;
  const extras = (
    <>
      {header.showStats ? <StatsLine creator={creator} /> : null}
      {header.showSocials ? <SocialChips links={profile.links} /> : null}
    </>
  );

  if (layout === "hero") {
    return (
      <header className="relative">
        <div className="relative isolate flex min-h-[28rem] w-full items-end overflow-hidden bg-surface-card sm:min-h-[36rem]" style={bannerStyle}>
          {bannerImg}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 via-35% to-background/0" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-background/10 to-transparent" />
          <div className={cn("cp-container relative flex flex-col items-start gap-4 pb-10 sm:pb-14", enter)}>
            <div className="flex items-center gap-3 rounded-full border border-border bg-background/35 py-1 pl-1 pr-4 backdrop-blur-md">
              <Avatar creator={creator} className="h-9 w-9" text="text-sm" />
              <p className="text-sm font-medium text-foreground">@{profile.handle}</p>
            </div>
            <h1 className="cp-heading max-w-4xl text-5xl font-semibold leading-[0.98] tracking-tight text-foreground sm:text-7xl">{profile.displayName}</h1>
            {profile.tagline ? <p className="max-w-2xl text-base text-foreground/85 sm:text-lg">{profile.tagline}</p> : null}
            {header.showStats ? <StatsLine creator={creator} /> : null}
            {header.showSocials ? <SocialChips links={profile.links} /> : null}
            <div className="pt-1">
              <HeaderActions {...actionProps} />
            </div>
          </div>
        </div>
      </header>
    );
  }

  if (layout === "split") {
    const portrait = banner?.thumbnailUrl || creator.avatar?.thumbnailUrl;
    return (
      <header className="relative pt-20 sm:pt-24">
        <div className="cp-container grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className={cn("flex flex-col items-start gap-4", enter)}>
            <div className="flex items-center gap-3">
              <Avatar creator={creator} className="h-12 w-12" text="text-lg" />
              <p className="text-sm text-text-secondary">@{profile.handle}</p>
            </div>
            <h1 className="cp-heading text-4xl font-semibold leading-[1.05] text-foreground sm:text-5xl">{profile.displayName}</h1>
            {tagline}
            {extras}
            <HeaderActions {...actionProps} />
          </div>
          <div className="cp-card relative isolate aspect-[4/5] overflow-hidden sm:aspect-[5/4] md:aspect-[4/5]" style={portrait ? undefined : bannerStyle}>
            {portrait ? <MediaImage src={portrait} effect={header.mediaEffect} /> : null}
            <EffectLayer effect={header.effect} />
          </div>
        </div>
      </header>
    );
  }

  if (layout === "minimal") {
    return (
      <header className="relative pt-20 sm:pt-24">
        <div className={cn("cp-container flex flex-col gap-5 sm:flex-row sm:items-center", enter)}>
          <Avatar creator={creator} className="h-20 w-20" text="text-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <h1 className="cp-heading truncate text-2xl font-semibold text-foreground sm:text-3xl">{profile.displayName}</h1>
              <p className="truncate text-sm text-text-secondary">@{profile.handle}</p>
            </div>
            {tagline}
            {extras}
          </div>
          <HeaderActions {...actionProps} />
        </div>
      </header>
    );
  }

  if (layout === "centered") {
    return (
      <header className="relative">
        <div className="relative isolate h-40 w-full overflow-hidden bg-surface-card sm:h-60" style={bannerStyle}>
          {bannerImg}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className={cn("cp-container relative -mt-14 flex flex-col items-center gap-3 text-center sm:-mt-16", enter)}>
          <Avatar creator={creator} className="h-28 w-28 border-4 border-background sm:h-32 sm:w-32" />
          <div>
            <h1 className="cp-heading text-2xl font-semibold text-foreground sm:text-3xl">{profile.displayName}</h1>
            <p className="text-sm text-text-secondary">@{profile.handle}</p>
          </div>
          {tagline}
          {header.showStats ? <StatsLine creator={creator} className="justify-center" /> : null}
          {header.showSocials ? <SocialChips links={profile.links} className="justify-center" /> : null}
          <HeaderActions {...actionProps} align="center" />
        </div>
      </header>
    );
  }

  // "banner" — the classic layout.
  return (
    <header className="relative">
      <div className="relative isolate h-40 w-full overflow-hidden bg-surface-card sm:h-64" style={bannerStyle}>
        {bannerImg}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </div>
      <div className={cn("cp-container relative", enter)}>
        <div className="-mt-12 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <Link href={home}>
              <Avatar creator={creator} className="h-24 w-24 border-4 border-background sm:h-32 sm:w-32" />
            </Link>
            <div className="min-w-0 pb-1">
              <h1 className="cp-heading truncate text-xl font-semibold text-foreground sm:text-2xl">{profile.displayName}</h1>
              <p className="truncate text-sm text-text-secondary">@{profile.handle}</p>
            </div>
          </div>
          <div className="sm:pb-1">
            <HeaderActions {...actionProps} />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {tagline}
          {extras}
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Nav

function PageNav({ tabs, value, onChange, links, style, sticky }) {
  return (
    <nav className={cn("z-20 border-b border-border", sticky && "sticky top-14 bg-background/80 backdrop-blur-xl")}>
      <div className="cp-container flex items-center gap-4 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div
          className={cn(
            "flex shrink-0 items-center",
            style === "segmented" ? "my-2 gap-1 rounded-full border border-border bg-surface-card p-1" : style === "pills" ? "gap-1 py-2" : "gap-5",
          )}
        >
          {tabs.map((tab) => {
            const active = tab.value === value;
            return (
              <button
                key={tab.value}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onChange(tab.value)}
                className={cn(
                  "shrink-0 text-sm font-medium transition-colors",
                  style === "underline" && cn("border-b-2 py-3.5", active ? "border-[var(--cp-accent)] text-foreground" : "border-transparent text-text-secondary hover:text-foreground"),
                  style === "pills" && cn("cp-radius-sm px-3.5 py-1.5", active ? "cp-accent" : "text-text-secondary hover:bg-surface-hover hover:text-foreground"),
                  style === "segmented" && cn("rounded-full px-4 py-1.5", active ? "cp-accent" : "text-text-secondary hover:text-foreground"),
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {links.length ? (
          <div className="ml-auto flex shrink-0 items-center gap-4">
            {links.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-foreground">
                {link.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Page

function rankOf(tiers, tierId) {
  return tiers.find((t) => t.id === tierId)?.position ?? -1;
}

/** How many posts a tier would open up for this viewer that are locked now. */
function unlocksByTier(tiers, feed) {
  const map = new Map();
  for (const tier of tiers) {
    const count = feed.filter((p) => {
      if (!p.locked || p.locked === "ppv") return false;
      if (p.visibility === "members") return true;
      return p.visibility === "tier" && rankOf(tiers, p.minTierId) <= tier.position;
    }).length;
    map.set(tier.id, count);
  }
  return map;
}

export function CreatorPage({ creator: initialCreator, viewer, feed, bundles = [], provider, initialTab = "home", initialPromo = "", initialPost = "", initialMessages = false, preview = false }) {
  const [draft, setDraft] = useState(null);
  const creator = useMemo(() => {
    const base = draft
      ? {
          ...initialCreator,
          profile: { ...initialCreator.profile, ...draft.profile },
          page: normalizePageConfig(draft.page),
          pageAssets: { ...initialCreator.pageAssets, ...draft.pageAssets },
          avatar: draft.avatar !== undefined ? draft.avatar : initialCreator.avatar,
          banner: draft.banner !== undefined ? draft.banner : initialCreator.banner,
        }
      : initialCreator;
    // The theme's accent is the page's accent everywhere (dialogs, post cards).
    return { ...base, profile: { ...base.profile, accentColor: base.page.theme.accent } };
  }, [initialCreator, draft]);
  const { profile, tiers, page } = creator;

  const tabs = useMemo(
    () =>
      [
        { value: "home", label: "Home" },
        { value: "posts", label: "Posts" },
        { value: "membership", label: "Membership" },
        ...(bundles.length ? [{ value: "shop", label: "Shop" }] : []),
        { value: "about", label: "About" },
      ].filter((t) => page.nav.tabs[t.value] !== false),
    [bundles.length, page.nav.tabs],
  );
  const [tab, setTabState] = useState(() => (["home", "posts", "membership", "shop", "about"].includes(initialTab) ? initialTab : "home"));
  const activeTab = tabs.some((t) => t.value === tab) ? tab : "home";
  const [filter, setFilter] = useState("all");
  const [tipTarget, setTipTarget] = useState(null);
  // ?post=<id> (e.g. from the fan profile) opens that post over the page.
  const [openPost, setOpenPost] = useState(() => (initialPost ? feed.find((p) => p.id === initialPost) || null : null));
  const [cancelOpen, setCancelOpen] = useState(false);
  // ?messages=1 (e.g. from the fan profile or a message-unlock checkout) opens the inbox drawer.
  const [messagesOpen, setMessagesOpenState] = useState(Boolean(initialMessages && profile.messagesEnabled));
  const [cycle, setCycle] = useState("month");
  const [promo, setPromo] = useState(null);
  const mainRef = useRef(null);

  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const currentTier = viewer.tierId ? tierById.get(viewer.tierId) : null;
  const access = useMemo(() => ({ member: Boolean(viewer.subscription) && !viewer.blocked, tierRank: rankOf(tiers, viewer.tierId) }), [viewer, tiers]);

  const setTab = useCallback((value) => {
    setTabState(value);
    try {
      const url = new URL(window.location.href);
      if (value === "home") url.searchParams.delete("tab");
      else url.searchParams.set("tab", value);
      window.history.replaceState(null, "", url);
    } catch {
      // Sandboxed preview frames can refuse history writes — the tab still switches.
    }
    mainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const setMessagesOpen = useCallback((open) => {
    setMessagesOpenState(open);
    try {
      const url = new URL(window.location.href);
      if (open) url.searchParams.set("messages", "1");
      else url.searchParams.delete("messages");
      window.history.replaceState(null, "", url);
    } catch {
      // Sandboxed preview frames can refuse history writes — the drawer still toggles.
    }
  }, []);

  const actions = useFanActions({ handle: profile.handle, viewer, onNeedsTier: () => setTab("membership") });

  // Live draft updates from the workspace builder.
  useEffect(() => {
    if (!preview) return undefined;
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== PREVIEW_MESSAGE) return;
      if (event.data.draft) setDraft(event.data.draft);
      if (event.data.scrollTo) document.getElementById(`section-${event.data.scrollTo}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: `${PREVIEW_MESSAGE}:ready` }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [preview]);

  // A ?promo=CODE link: check it once and carry it into checkout.
  useEffect(() => {
    if (!initialPromo || preview) return;
    let alive = true;
    postJson(`/api/creator/${encodeURIComponent(profile.handle)}`, { action: "promo", code: initialPromo }).then((result) => {
      if (!alive) return;
      if (result.promo) {
        setPromo(result.promo);
        toast.success(`Code ${result.promo.code} applied — ${result.promo.label}`);
      } else if (result.error) toast.error(result.error);
    });
    return () => {
      alive = false;
    };
  }, [initialPromo, preview, profile.handle]);

  const visibleSections = useMemo(() => page.sections.filter((s) => sectionVisible(s, access, tiers)), [page.sections, access, tiers]);
  const tiersSectionId = visibleSections.find((s) => s.type === "tiers")?.id;

  const openMembership = useCallback(() => {
    if (activeTab === "home" && tiersSectionId) {
      document.getElementById(`section-${tiersSectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setTab("membership");
  }, [activeTab, tiersSectionId, setTab]);

  const posts = useMemo(() => {
    if (filter === "open") return feed.filter((p) => !p.locked);
    if (filter === "locked") return feed.filter((p) => p.locked);
    if (filter === "saved") return feed.filter((p) => p.bookmarked);
    return feed;
  }, [feed, filter]);

  const newCount = useMemo(() => {
    const since = new Date(viewer.member?.lastSeenAt || 0).getTime();
    if (!viewer.subscription || !since) return 0;
    return feed.filter((p) => new Date(p.publishedAt).getTime() > since).length;
  }, [feed, viewer]);

  const unlocks = useMemo(() => unlocksByTier(tiers, feed), [tiers, feed]);

  const openTip = (target) => setTipTarget(target || { type: "profile" });
  const sendTip = (input) => actions.checkout("tip", { kind: "tip", ...input }, "Sign in to send a tip.");
  const joinTier = (tierId) => actions.join(tierId, { cycle, promoCode: promo && !tierById.get(tierId)?.isFree ? promo.code : "" });
  const onFollow = () => actions.follow(!viewer.following);
  const unlockPost = (p) => actions.checkout(`unlock:${p.id}`, { kind: "post_unlock", targetId: p.id }, "Sign in to unlock this post.");
  const buyBundle = (b) => actions.checkout(`bundle:${b.id}`, { kind: "bundle_unlock", targetId: b.id }, "Sign in to buy this bundle.");
  const renew = () => (currentTier ? actions.checkout(`join:${currentTier.id}`, { kind: "subscription", tierId: currentTier.id, cycle: viewer.subscription?.cycle || "month" }) : setTab("membership"));
  const manage = () => (viewer.subscription?.cancelAtPeriodEnd ? actions.toggleCancel(false) : setCancelOpen(true));
  const share = async () => {
    const url = `${window.location.origin}/c/${encodeURIComponent(profile.handle)}`;
    try {
      if (navigator.share) await navigator.share({ title: profile.displayName, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      // Share sheet dismissed.
    }
  };

  const renderPost = (post) => (
    <PostCard
      key={post.id}
      post={post}
      creator={creator}
      viewer={viewer}
      engage={actions.engage}
      tierById={tierById}
      onJoin={(tierId) => (tierId ? joinTier(tierId) : openMembership())}
      onUnlock={unlockPost}
      onTip={(p) => openTip({ type: "post", id: p.id, label: p.title })}
    />
  );

  const plans = {
    handle: profile.handle,
    tiers,
    viewer,
    cycle,
    setCycle,
    promo,
    setPromo,
    unlocksByTier: unlocks,
    busy: actions.busy,
    onJoin: joinTier,
    onManage: manage,
  };

  const ctx = {
    creator,
    viewer,
    feed,
    bundles,
    tiers,
    tierById,
    pageAssets: creator.pageAssets || {},
    theme: page.theme,
    busy: actions.busy,
    editing: preview,
    plans,
    renderPost,
    openPost: setOpenPost,
    openTab: setTab,
    openMembership,
    openTip,
    onFollow,
    buyBundle,
  };

  const banner = (
    <LifecycleBanner viewer={viewer} currentTier={currentTier} newCount={newCount} onRenew={renew} onResume={() => actions.toggleCancel(false)} onRejoin={() => setTab("membership")} />
  );
  const backdropUrl = page.theme.backdrop === "image" ? creator.pageAssets?.[page.theme.backdropAssetId]?.thumbnailUrl : "";
  const showMobileBar = page.cta.mobileBar && !currentTier && tiers.length > 0;

  return (
    <div className={cn("cp-root pb-16 text-foreground", showMobileBar && "pb-28 sm:pb-16")}>
      <PageTheme theme={page.theme} backdropUrl={backdropUrl} />
      <PageTopbar
        creator={creator}
        viewer={viewer}
        actions={actions}
        currentTier={currentTier}
        ctaLabel={page.cta.label}
        onSubscribe={openMembership}
        onMessages={() => setMessagesOpen(true)}
        overlay={!["split", "minimal"].includes(page.header.layout)}
      />
      <CreatorHeader
        creator={creator}
        viewer={viewer}
        actions={actions}
        currentTier={currentTier}
        page={page}
        onSubscribe={openMembership}
        onTip={() => openTip()}
        onFollow={onFollow}
        onShare={share}
        onMessages={() => setMessagesOpen(true)}
      />

      <div className="mt-6" ref={mainRef}>
        {tabs.length > 1 ? <PageNav tabs={tabs} value={activeTab} onChange={setTab} links={page.nav.links} style={page.nav.style} sticky={page.nav.sticky} /> : null}
      </div>

      <main className="cp-container mt-8 space-y-10 sm:space-y-14">
        {activeTab === "home" ? (
          <>
            {banner}
            {visibleSections.length ? (
              visibleSections.map((section) => <PageSection key={section.id} section={section} ctx={ctx} />)
            ) : feed.length ? (
              <div className="mx-auto max-w-2xl space-y-4">{feed.slice(0, 10).map(renderPost)}</div>
            ) : (
              <div className="cp-card">
                <EmptyState icon={Images} title="Nothing here yet" description={`${profile.displayName} is just getting started — follow along to see the first post.`} />
              </div>
            )}
          </>
        ) : null}

        {activeTab === "posts" ? (
          <section className="mx-auto max-w-2xl space-y-4">
            {feed.length ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-text-secondary">{feed.length} posts</p>
                <div className="flex gap-1 rounded-full border border-border bg-surface-card p-1">
                  {FILTERS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      aria-pressed={filter === f.value}
                      onClick={() => setFilter(f.value)}
                      className={cn("h-7 rounded-full px-3 text-xs font-medium", filter === f.value ? "cp-accent" : "text-text-secondary hover:text-foreground")}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {posts.length ? (
              posts.map(renderPost)
            ) : (
              <div className="cp-card">
                <EmptyState
                  icon={Images}
                  title={feed.length ? "Nothing here" : "No posts yet"}
                  description={feed.length ? "Try another filter." : `${profile.displayName} hasn't posted yet — join to be the first to see it.`}
                />
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "membership" ? (
          <section className="space-y-6">
            {banner}
            {viewer.blocked ? (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">This account can&apos;t join right now.</p>
            ) : null}
            <div className="space-y-1">
              <h2 className="cp-heading text-2xl font-semibold text-foreground sm:text-3xl">{currentTier ? "Your membership" : `Join ${profile.displayName}`}</h2>
              <p className="text-sm text-text-secondary">
                {currentTier
                  ? `You're on ${currentTier.name}${viewer.member ? ` · member since ${formatDay(viewer.member.joinedAt)}` : ""}.`
                  : "Pick the tier that fits — you can change or cancel any time."}
              </p>
            </div>
            {tiers.length ? (
              <PlansGrid {...plans} />
            ) : (
              <div className="cp-card">
                <EmptyState icon={Sparkles} title="No tiers yet" description="Membership opens soon — follow to hear first." />
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "shop" ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bundles.map((bundle) => (
              <BundleCard key={bundle.id} bundle={bundle} busy={actions.busy} onBuy={buyBundle} />
            ))}
          </section>
        ) : null}

        {activeTab === "about" ? (
          <section className="mx-auto max-w-2xl space-y-6">
            <div className="cp-card p-5 sm:p-6">
              <h2 className="cp-heading text-lg font-semibold text-foreground">About {profile.displayName}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-text-secondary">{profile.bio || profile.tagline || "No bio yet."}</p>
              <StatsLine creator={creator} className="mt-5" />
            </div>
            {profile.links.length ? (
              <div className="cp-card p-2">
                {profile.links.map((link) => (
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
            ) : null}
            {viewer.member ? (
              <p className="text-xs text-text-tertiary">
                Member since {formatDay(viewer.member.joinedAt)} · {formatMoney(viewer.member.totalSpentCents)} supported
              </p>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className="cp-container mt-16 flex flex-col items-center gap-2 border-t border-border pt-8 text-center text-xs text-text-tertiary">
        {page.footer.text ? <p className="max-w-xl whitespace-pre-line">{page.footer.text}</p> : null}
        <p>
          © {profile.displayName}
          {page.footer.showBranding ? " · Powered by Geiger" : ""}
        </p>
      </footer>

      {showMobileBar ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 p-3 backdrop-blur-xl sm:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{profile.displayName}</p>
              <p className="truncate text-xs text-text-secondary">
                {tiers.some((t) => !t.isFree) ? `From ${formatMoney(Math.min(...tiers.filter((t) => !t.isFree).map((t) => t.priceCents)))}/month` : "Free to join"}
              </p>
            </div>
            <Button className="cp-accent cp-radius-sm h-10 shrink-0" onClick={openMembership}>
              {page.cta.label}
            </Button>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="pointer-events-none fixed bottom-3 left-3 z-40 rounded-full border border-border bg-background/90 px-3 py-1 text-[11px] font-medium text-text-secondary backdrop-blur">
          Preview
        </div>
      ) : null}

      <Dialog open={Boolean(openPost)} onOpenChange={(v) => !v && setOpenPost(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-2xl" showCloseButton={false}>
          <DialogTitle className="sr-only">{openPost?.title || "Post"}</DialogTitle>
          {openPost ? renderPost(openPost) : null}
        </DialogContent>
      </Dialog>

      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        tiers={tiers}
        currentTier={currentTier}
        subscription={viewer.subscription}
        busy={actions.busy}
        onCancel={actions.cancel}
        onSwitch={({ tierId, cycle: nextCycle }) => {
          setCancelOpen(false);
          const tier = tierById.get(tierId);
          if (tier?.isFree) return actions.join(tierId);
          return actions.checkout(`join:${tierId}`, { kind: "subscription", tierId, cycle: nextCycle });
        }}
      />

      {profile.messagesEnabled ? (
        <FanInboxDrawer
          open={messagesOpen}
          onOpenChange={setMessagesOpen}
          creator={creator}
          viewer={viewer}
          actions={actions}
          onTip={openTip}
          onMembership={() => {
            setMessagesOpen(false);
            setTab("membership");
          }}
        />
      ) : null}

      <FanAuthDialog
        open={actions.auth.open}
        onOpenChange={actions.auth.setOpen}
        creatorName={profile.displayName}
        accent={profile.accentColor}
        reason={actions.auth.reason}
        onSignedIn={actions.auth.onSignedIn}
      />
      {tipTarget ? (
        <TipDialog open={Boolean(tipTarget)} onOpenChange={(v) => !v && setTipTarget(null)} profile={profile} target={tipTarget} onSubmit={sendTip} />
      ) : null}
    </div>
  );
}

export default CreatorPage;
