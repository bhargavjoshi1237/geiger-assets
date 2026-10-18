"use client";

// A fan's own profile (/fan): one account across every creator page. A cover
// header with their totals, then Overview (their creators, new posts from them,
// recent activity), Memberships, Library (everything they've unlocked), Saved,
// Payments and Account settings.

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  CircleUserRound,
  CreditCard,
  Heart,
  Images,
  LibraryBig,
  Loader2,
  Lock,
  LogOut,
  MessageCircle,
  MessagesSquare,
  Settings,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@geiger/ui/avatar";
import { Button } from "@geiger/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";
import { Input } from "@geiger/ui/input";
import { EmptyState, Field, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { FanAuthDialog } from "./fan_auth_dialog";
import { accentStyle, formatDay, formatMoney, intervalSuffix, postJson, timeAgo } from "./public_kit";

const KIND_LABEL = {
  subscription: "Membership",
  tip: "Tip",
  post_unlock: "Post unlock",
  message_unlock: "Message unlock",
  bundle_unlock: "Bundle",
};

const LOCK_LABEL = { ppv: "Pay-per-view", tier: "Higher tier", members: "Members" };

function postHref(post) {
  return `/c/${encodeURIComponent(post.creator.handle)}?post=${post.id}`;
}

function CreatorAvatar({ creator, className, text = "text-sm" }) {
  return (
    <span className={cn("block shrink-0 overflow-hidden rounded-full border border-border bg-surface-card", className)}>
      {creator.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={creator.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={cn("flex h-full w-full items-center justify-center font-semibold", text)} style={accentStyle(creator.accentColor)}>
          {creator.displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function statusOf(creator) {
  const m = creator.membership;
  if (m?.status === "past_due") return { label: "Payment due", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" };
  if (m?.status === "trialing") return { label: `${m.tierName} · trial`, className: "border-sky-500/30 bg-sky-500/10 text-sky-300" };
  if (m?.cancelAtPeriodEnd) return { label: `${m.tierName} · ending`, className: "border-border bg-surface-card text-text-secondary" };
  if (m) return { label: m.tierName, className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" };
  if (creator.wasMember) return { label: "Former member", className: "border-border bg-surface-card text-text-secondary" };
  if (creator.following) return { label: "Following", className: "border-border bg-surface-card text-text-secondary" };
  return { label: "Supporter", className: "border-border bg-surface-card text-text-secondary" };
}

/** A creator as a card with their banner — the Overview's "Your creators" rail. */
function CreatorTile({ creator }) {
  const status = statusOf(creator);
  return (
    <Link
      href={`/c/${encodeURIComponent(creator.handle)}`}
      className="group flex w-60 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface-subtle transition-colors hover:border-border-strong"
    >
      <span
        className="relative block h-20 overflow-hidden"
        style={!creator.bannerUrl ? { background: `linear-gradient(135deg, ${creator.accentColor}66, transparent 75%)` } : undefined}
      >
        {creator.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.bannerUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : null}
      </span>
      <span className="relative z-10 -mt-6 flex flex-col gap-2 px-4 pb-4">
        <CreatorAvatar creator={creator} className="h-12 w-12 border-2 border-surface-subtle" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{creator.displayName}</span>
          <span className="block truncate text-xs text-text-secondary">{creator.tagline || `@${creator.handle}`}</span>
        </span>
        <span className={cn("self-start rounded-full border px-2 py-0.5 text-[11px] font-medium", status.className)}>{status.label}</span>
      </span>
    </Link>
  );
}

/** A post from one of the fan's creators — cover, title, who and when. */
function PostTile({ post }) {
  const cover = post.cover;
  return (
    <Link href={postHref(post)} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-subtle transition-colors hover:border-border-strong">
      <span className="relative block aspect-[4/3] overflow-hidden bg-surface-card" style={cover?.color ? { backgroundColor: cover.color } : undefined}>
        {cover?.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : cover?.miniThumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.miniThumbnailUrl} alt="" aria-hidden className="h-full w-full scale-110 object-cover blur-2xl" />
        ) : (
          <span className="flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${post.creator.accentColor}40, transparent)` }}>
            <Sparkles className="h-6 w-6 text-text-tertiary" />
          </span>
        )}
        {post.locked ? (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            <Lock className="h-3 w-3" />
            {post.locked === "ppv" && post.priceCents ? formatMoney(post.priceCents, post.currency) : LOCK_LABEL[post.locked]}
          </span>
        ) : null}
        {post.mediaCount > 1 ? (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white backdrop-blur">
            <Images className="h-3 w-3" />
            {post.mediaCount}
          </span>
        ) : null}
      </span>
      <span className="flex flex-1 flex-col gap-2 p-3.5">
        <span className="line-clamp-2 text-sm font-semibold text-foreground">{post.title}</span>
        <span className="mt-auto flex items-center gap-2 text-xs text-text-secondary">
          <CreatorAvatar creator={post.creator} className="h-5 w-5" text="text-[10px]" />
          <span className="truncate">{post.creator.displayName}</span>
          <span className="text-text-tertiary">· {timeAgo(post.publishedAt)}</span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-2.5 text-text-tertiary">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {post.likeCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {post.commentCount}
            </span>
          </span>
        </span>
      </span>
    </Link>
  );
}

function PostGrid({ posts, empty }) {
  if (!posts.length) return <div className="rounded-2xl border border-border bg-surface-subtle">{empty}</div>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <PostTile key={post.id} post={post} />
      ))}
    </div>
  );
}

function CreatorCard({ creator }) {
  const home = `/c/${encodeURIComponent(creator.handle)}`;
  const m = creator.membership;
  const status = statusOf(creator);
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-subtle p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CreatorAvatar creator={creator} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{creator.displayName}</span>
            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium", status.className)}>{status.label}</span>
          </p>
          <p className="truncate text-xs text-text-secondary">
            {m
              ? `${m.priceCents ? `${formatMoney(m.priceCents, m.currency)}${intervalSuffix(m.interval)}` : "Free"} · ${
                  m.cancelAtPeriodEnd ? "ends" : m.status === "trialing" ? "trial ends" : "renews"
                } ${formatDay(m.currentPeriodEnd)}`
              : `${creator.joinedAt ? `Since ${formatDay(creator.joinedAt)} · ` : ""}${formatMoney(creator.totalSpentCents)} supported`}
          </p>
          {m?.status === "past_due" ? <p className="text-xs text-amber-300">Payment overdue — renew to keep access.</p> : null}
        </div>
      </div>
      {creator.isPublished ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          {m || creator.wasMember ? (
            <Button asChild variant="outline" size="sm" className="border-border bg-transparent hover:bg-surface-hover">
              <Link href={`${home}?messages=1`}>
                <MessagesSquare className="h-4 w-4" />
                Messages
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm" className="hover:opacity-90" style={accentStyle(creator.accentColor)}>
            <Link href={`${home}?tab=membership`}>{m ? "Manage" : creator.wasMember ? "Rejoin" : "Join"}</Link>
          </Button>
        </div>
      ) : (
        <span className="text-xs text-text-tertiary">Page offline</span>
      )}
    </div>
  );
}

function PaymentList({ payments }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface-subtle">
      {payments.map((p) => (
        <li key={p.id} className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-text-secondary">
            <CreditCard className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground">
              {KIND_LABEL[p.kind] || "Payment"} · {p.creatorName}
            </p>
            <p className="truncate text-xs text-text-tertiary">
              {formatDay(p.paidAt)}
              {p.note ? ` · “${p.note}”` : ""}
              {p.provider === "test" ? " · test payment" : ""}
            </p>
          </div>
          {p.status === "refunded" ? <span className="text-xs text-amber-300">Refunded</span> : null}
          <span className={cn("text-sm tabular-nums", p.status === "refunded" ? "text-text-tertiary line-through" : "text-foreground")}>
            {formatMoney(p.amountCents, p.currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SectionTitle({ title, action }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {action}
    </div>
  );
}

function AccountForms({ fan }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(fan.displayName);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(null);

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy("profile");
    const result = await postJson("/api/fans/account", { action: "profile", displayName });
    setBusy(null);
    if (result.error) return toast.error(result.error);
    toast.success("Profile saved");
    router.refresh();
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setBusy("password");
    const result = await postJson("/api/fans/account", { action: "password", current, next });
    setBusy(null);
    if (result.error) return toast.error(result.error);
    setCurrent("");
    setNext("");
    toast.success("Password changed — other devices were signed out");
  };

  const signOut = async () => {
    await postJson("/api/fans/auth", { action: "logout" });
    router.refresh();
  };

  return (
    <div className="grid gap-4">
      <form onSubmit={saveProfile} className="grid gap-4 rounded-2xl border border-border bg-surface-subtle p-5">
        <h2 className="text-sm font-semibold text-foreground">Profile</h2>
        <Field label="Email">
          <Input value={fan.email} readOnly disabled className="bg-surface-card" />
        </Field>
        <Field label="Display name" hint="What creators see in their member list and comments.">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-surface-card" />
        </Field>
        <Button type="submit" className="justify-self-start bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy === "profile" || displayName.trim() === fan.displayName}>
          {busy === "profile" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save profile
        </Button>
      </form>
      <form onSubmit={savePassword} className="grid gap-4 rounded-2xl border border-border bg-surface-subtle p-5">
        <h2 className="text-sm font-semibold text-foreground">Password</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password">
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className="bg-surface-card" />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className="bg-surface-card" />
          </Field>
        </div>
        <Button type="submit" className="justify-self-start bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy === "password" || !current || next.length < 8}>
          {busy === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Change password
        </Button>
      </form>
      <Button variant="outline" className="justify-self-start border-border bg-transparent hover:bg-surface-hover" onClick={signOut}>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}

export function FanHub({ fan, hub }) {
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [authOpen, setAuthOpen] = useState(!fan);

  if (!fan) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface-subtle">
          <EmptyState
            icon={CircleUserRound}
            title="Your fan account"
            description="Sign in to see your creators, your library, memberships and payments."
            action={
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAuthOpen(true)}>
                Sign in
              </Button>
            }
          />
        </div>
        <FanAuthDialog
          open={authOpen}
          onOpenChange={setAuthOpen}
          title="Your fan account"
          creatorName="Geiger"
          onSignedIn={() => {
            setAuthOpen(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  const { creators, payments, feed, library, saved, stats } = hub;
  const top = creators[0];
  const overdue = creators.filter((c) => c.membership?.status === "past_due");
  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "memberships", label: `Creators${creators.length ? ` · ${creators.length}` : ""}` },
    { value: "library", label: `Library${library.length ? ` · ${library.length}` : ""}` },
    { value: "saved", label: `Saved${saved.length ? ` · ${saved.length}` : ""}` },
    { value: "payments", label: "Payments" },
    { value: "account", label: "Account" },
  ];
  const figures = [
    { label: stats.memberships === 1 ? "Membership" : "Memberships", value: String(stats.memberships) },
    { label: "Supported", value: formatMoney(stats.supportedCents) },
    { label: "Unlocked", value: String(stats.unlocked) },
  ];

  const signOut = async () => {
    await postJson("/api/fans/auth", { action: "logout" });
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-background pb-16 text-foreground">
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
          {top ? (
            <Button asChild variant="ghost" size="sm" className="-ml-2 min-w-0 gap-2 text-text-secondary hover:bg-surface-hover hover:text-foreground">
              <Link href={`/c/${encodeURIComponent(top.handle)}`}>
                <ChevronLeft className="h-4 w-4" />
                <CreatorAvatar creator={top} className="h-5 w-5" text="text-[10px]" />
                <span className="truncate">{top.displayName}</span>
              </Link>
            </Button>
          ) : (
            <span className="text-sm font-medium text-foreground">Your account</span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="-mr-2 ml-auto gap-2 px-1.5 hover:bg-surface-hover" aria-label="Account menu">
                <Avatar size="sm">
                  {fan.avatarUrl ? <AvatarImage src={fan.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="bg-surface-strong text-foreground">{fan.displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-border bg-surface-subtle">
              <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
                <span className="truncate text-sm font-medium text-foreground">{fan.displayName}</span>
                <span className="truncate text-xs text-text-secondary">{fan.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => setTab("account")}>
                  <Settings className="h-4 w-4" />
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTab("payments")}>
                  <CreditCard className="h-4 w-4" />
                  Payments
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut}>
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl px-4 pt-10 sm:px-6">
        <header className="flex flex-col gap-5 rounded-xl p-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Avatar className="size-14">
              {fan.avatarUrl ? <AvatarImage src={fan.avatarUrl} alt="" /> : null}
              <AvatarFallback className="bg-surface-strong text-lg font-medium text-foreground">{fan.displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{fan.displayName}</h1>
              <p className="truncate text-sm text-text-secondary">
                {fan.email}
                {hub.since ? ` · Fan since ${formatDay(hub.since)}` : ""}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-3 border-t border-border pt-4 sm:flex sm:border-t-0 sm:pt-0">
            {figures.map((f) => (
              <div key={f.label} className="flex flex-col-reverse items-center gap-0.5 border-border text-center sm:min-w-28 sm:px-6 sm:[&:not(:first-child)]:border-l">
                <dt className="text-xs text-text-secondary">{f.label}</dt>
                <dd className="text-lg font-semibold tabular-nums text-foreground">{f.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        {overdue.map((c) => (
          <div key={c.handle} className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <p className="flex-1 text-sm text-foreground">
              Your {c.membership.tierName} payment to {c.displayName} didn&apos;t go through. Renew to keep access.
            </p>
            <Button asChild size="sm" className="self-start hover:opacity-90 sm:self-auto" style={accentStyle(c.accentColor)}>
              <Link href={`/c/${encodeURIComponent(c.handle)}?tab=membership`}>Renew</Link>
            </Button>
          </div>
        ))}

        <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} fullWidth buttonClassName="basis-0" className="mt-8" />

        <section className="mt-6">
          {tab === "overview" ? (
            creators.length ? (
              <div className="space-y-10">
                <div>
                  <SectionTitle
                    title="Your creators"
                    action={
                      <button type="button" onClick={() => setTab("memberships")} className="text-sm text-text-secondary hover:text-foreground">
                        Manage →
                      </button>
                    }
                  />
                  <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                    {creators.map((c) => (
                      <CreatorTile key={c.handle} creator={c} />
                    ))}
                  </div>
                </div>
                <div>
                  <SectionTitle title="New from your creators" />
                  <PostGrid
                    posts={feed.slice(0, 6)}
                    empty={<EmptyState icon={Images} title="Nothing new yet" description="New posts from creators you follow show up here." />}
                  />
                </div>
                {library.length ? (
                  <div>
                    <SectionTitle
                      title="Recently unlocked"
                      action={
                        <button type="button" onClick={() => setTab("library")} className="text-sm text-text-secondary hover:text-foreground">
                          Library →
                        </button>
                      }
                    />
                    <PostGrid posts={library.slice(0, 3)} />
                  </div>
                ) : null}
                {payments.length ? (
                  <div>
                    <SectionTitle
                      title="Recent payments"
                      action={
                        <button type="button" onClick={() => setTab("payments")} className="text-sm text-text-secondary hover:text-foreground">
                          All payments →
                        </button>
                      }
                    />
                    <PaymentList payments={payments.slice(0, 4)} />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-surface-subtle">
                <EmptyState icon={Sparkles} title="No creators yet" description="Follow or join a creator from their page and your feed, library and memberships fill in here." />
              </div>
            )
          ) : null}

          {tab === "memberships" ? (
            creators.length ? (
              <div className="grid gap-3">
                {creators.map((c) => (
                  <CreatorCard key={c.handle} creator={c} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-surface-subtle">
                <EmptyState icon={Sparkles} title="No creators yet" description="Join or follow a creator from their page and they'll show up here." />
              </div>
            )
          ) : null}

          {tab === "library" ? (
            <PostGrid
              posts={library}
              empty={<EmptyState icon={LibraryBig} title="Your library is empty" description="Pay-per-view posts and bundles you unlock are yours to keep — they collect here." />}
            />
          ) : null}

          {tab === "saved" ? (
            <PostGrid posts={saved} empty={<EmptyState icon={Bookmark} title="Nothing saved" description="Tap the bookmark on any post to save it for later." />} />
          ) : null}

          {tab === "payments" ? (
            payments.length ? (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">
                  {payments.length} payment{payments.length === 1 ? "" : "s"} · {formatMoney(stats.supportedCents)} in total
                </p>
                <PaymentList payments={payments} />
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-surface-subtle">
                <EmptyState icon={CreditCard} title="No payments yet" description="Memberships, tips and unlocks you pay for show here." />
              </div>
            )
          ) : null}

          {tab === "account" ? <AccountForms fan={fan} /> : null}
        </section>
      </main>
    </div>
  );
}

export function FanReset({ token }) {
  const router = useRouter();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (next !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    setError("");
    const result = await postJson("/api/fans/account", { action: "reset", token, next });
    setBusy(false);
    if (result.error) return setError(result.error);
    toast.success("Password updated — you're signed in");
    router.push("/fan");
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <form onSubmit={submit} className="grid w-full max-w-sm gap-4 rounded-2xl border border-border bg-surface-subtle p-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Set a new password</h1>
          <p className="mt-1 text-sm text-text-secondary">This link works once and expires after 24 hours.</p>
        </div>
        <Field label="New password" hint="At least 8 characters.">
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className="bg-surface-card" />
        </Field>
        <Field label="Confirm password">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className="bg-surface-card" />
        </Field>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <Button type="submit" className="h-10 bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy || next.length < 8 || !token}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Update password
        </Button>
      </form>
    </div>
  );
}

export default FanHub;
