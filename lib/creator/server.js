if (typeof window !== "undefined") {
  throw new Error("lib/creator/server is server-only.");
}

// The public creator platform's server core — everything behind /c/<handle>.
//
//   loadCreator      handle -> published profile, tiers, avatar / banner
//   loadViewer       signed-in fan -> member row, live subscription, unlocks
//   loadFeed         posts with access resolved per viewer (locked media and
//                    bodies never leave the server)
//   loadInbox        the fan's DMs from the creator, locked or unlocked
//   startPayment     subscribe / tip / unlock -> pending fan_payment -> Stripe
//                    Checkout or the built-in test checkout
//   completePayment  payment confirmed -> subscription / tip / unlock recorded,
//                    member spend updated, membership.* workflow event queued
//
// Reads and writes go through the service-role client: fan accounts, sessions
// and payments are never exposed to the anon key.

import { commerceDb } from "@/lib/commerce/server";
import { createPaymentSession, isStripeConfigured } from "@/lib/commerce/stripe";
import { PUBLIC_ASSET_COLUMNS, publicAsset } from "@/lib/supabase/gallery_shape";
import { queueWorkflowEvent } from "@/lib/workflows/server";
import { defaultPageConfig, normalizePageConfig, pageAssetIds } from "@/lib/creator/page_config";

export const creatorDb = commerceDb;

const LIVE = ["active", "trialing", "past_due"];
const MAX_TIP_CENTS = 100000;

export function paymentProviderName() {
  return isStripeConfigured() ? "stripe" : "test";
}

function addInterval(iso, interval) {
  const next = new Date(iso || Date.now());
  if (interval === "year") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}

function invoiceNumber() {
  return `INV-${String(Date.now()).slice(-7)}`;
}

// ---------------------------------------------------------------------------
// Shapes (server copies — lib/supabase/creator.js is a client module)

function normalizeProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    handle: String(row.handle || ""),
    displayName: row.display_name || String(row.handle || ""),
    tagline: row.tagline ?? "",
    bio: row.bio ?? "",
    avatarAssetId: row.avatar_asset_id ?? null,
    bannerAssetId: row.banner_asset_id ?? null,
    accentColor: row.accent_color || "#f97316",
    links: Array.isArray(row.links) ? row.links.filter((l) => l?.url) : [],
    isPublished: Boolean(row.is_published),
    tipsEnabled: row.tips_enabled !== false,
    minTipCents: Number(row.min_tip_cents ?? 100),
    suggestedTips: Array.isArray(row.suggested_tips) ? row.suggested_tips.map(Number).filter((n) => n > 0) : [],
    messagesEnabled: row.messages_enabled !== false,
    welcomeMessage: row.welcome_message ?? "",
    publishedAt: row.page_published_at ?? null,
  };
}

function normalizeTier(row) {
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const interval = row.interval ?? "month";
  const annual = Number(meta.annualPriceCents) || 0;
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    priceCents: Number(row.price_cents ?? 0),
    currency: row.currency ?? "usd",
    interval,
    isFree: Boolean(row.is_free) || !Number(row.price_cents),
    position: Number(row.position ?? 0),
    perks: Array.isArray(row.perks) ? row.perks : [],
    trialDays: Number(meta.trialDays) || 0,
    // A monthly tier may also sell a year up front at its own (discounted) price.
    annualPriceCents: interval === "month" && annual > 0 ? annual : 0,
  };
}

/** What a tier costs for a billing cycle ("month" | "year"). */
function cyclePrice(tier, cycle) {
  if (cycle === "year" && tier.annualPriceCents) return { cycle: "year", priceCents: tier.annualPriceCents };
  return { cycle: tier.interval === "year" ? "year" : "month", priceCents: tier.priceCents };
}

async function loadAsset(db, id) {
  if (!id) return null;
  const { data } = await db.from("assets").select(PUBLIC_ASSET_COLUMNS).eq("id", id).is("deleted_at", null).maybeSingle();
  return publicAsset(data);
}

/** The page layout's own media (hero image / video, backdrop), keyed by asset id. */
async function loadPageAssets(db, profile, page, preview) {
  const ids = pageAssetIds(page);
  if (!ids.length) return {};
  const { data } = await db
    .from("assets")
    .select(`${PUBLIC_ASSET_COLUMNS},project_id`)
    .in("id", ids)
    .eq("project_id", profile.projectId)
    .is("deleted_at", null);
  return Object.fromEntries(
    (data || []).map((row) => {
      const a = publicAsset(row);
      return [a.id, { ...a, url: `${mediaUrl(profile.handle, "page", a.id)}${preview ? "&preview=1" : ""}` }];
    }),
  );
}

/** May the page's media route serve this asset? Only if the layout uses it. */
export function isPageAsset(creator, assetId) {
  const { profile, page } = creator;
  return Boolean(assetId) && (pageAssetIds(page).includes(assetId) || [profile.avatarAssetId, profile.bannerAssetId].includes(assetId));
}

// ---------------------------------------------------------------------------
// Loaders

/**
 * A published creator page by handle. `preview` (workspace only) also opens an
 * unpublished page and renders the builder's draft layout instead of the live one.
 */
export async function loadCreator(db, handle, { preview = false } = {}) {
  if (!handle) return null;
  try {
    const { data, error } = await db
      .from("creator_profiles")
      .select("*")
      .eq("handle", String(handle).toLowerCase())
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[creator.loadCreator]", error.message);
      return null;
    }
    const profile = normalizeProfile(data);
    if (!profile || (!profile.isPublished && !preview)) return null;

    const stored = preview ? data.page_draft || data.page_config : data.page_config;
    const page = stored ? normalizePageConfig(stored) : defaultPageConfig(profile);
    const [{ data: tierRows }, avatar, banner, { count: memberCount }, { count: postCount }, { count: followerCount }, pageAssets] = await Promise.all([
      db
        .from("membership_tiers")
        .select("*")
        .eq("project_id", profile.projectId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("position", { ascending: true }),
      loadAsset(db, profile.avatarAssetId),
      loadAsset(db, profile.bannerAssetId),
      db.from("members").select("id", { count: "exact", head: true }).eq("project_id", profile.projectId).is("deleted_at", null),
      db
        .from("ppv_posts")
        .select("id", { count: "exact", head: true })
        .eq("project_id", profile.projectId)
        .eq("status", "published")
        .is("deleted_at", null),
      db.from("creator_follows").select("id", { count: "exact", head: true }).eq("project_id", profile.projectId),
      loadPageAssets(db, profile, page, preview),
    ]);

    return {
      profile,
      page,
      pageAssets,
      tiers: (tierRows || []).map(normalizeTier),
      avatar,
      banner,
      stats: { members: memberCount || 0, posts: postCount || 0, followers: followerCount || 0 },
    };
  } catch (err) {
    console.error("[creator.loadCreator]", err?.message);
    return null;
  }
}

/** Where the signed-in fan stands with this creator. */
export async function loadViewer(db, profile, fan) {
  const empty = {
    fan,
    member: null,
    subscription: null,
    tierId: null,
    following: false,
    lapsed: false,
    unlockedPosts: [],
    unlockedMessages: [],
    likedPosts: [],
    bookmarkedPosts: [],
  };
  if (!fan || !profile) return empty;
  const [{ data: likes }, { data: marks }, { data: follow }] = await Promise.all([
    db.from("post_likes").select("post_id").eq("fan_account_id", fan.id).eq("project_id", profile.projectId),
    db.from("post_bookmarks").select("post_id").eq("fan_account_id", fan.id).eq("project_id", profile.projectId),
    db.from("creator_follows").select("id").eq("fan_account_id", fan.id).eq("project_id", profile.projectId).maybeSingle(),
  ]);
  empty.likedPosts = (likes || []).map((l) => l.post_id);
  empty.bookmarkedPosts = (marks || []).map((b) => b.post_id);
  empty.following = Boolean(follow);
  const { data: member } = await db
    .from("members")
    .select("*")
    .eq("project_id", profile.projectId)
    .eq("fan_account_id", fan.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!member) return empty;
  const { likedPosts, bookmarkedPosts, following } = empty;

  const [{ data: subs }, { data: postUnlocks }, { data: msgUnlocks }, { count: everSubscribed }] = await Promise.all([
    db
      .from("subscriptions")
      .select("*")
      .eq("member_id", member.id)
      .in("status", LIVE)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    db.from("ppv_unlocks").select("ppv_post_id").eq("member_id", member.id),
    db.from("message_unlocks").select("message_id").eq("member_id", member.id),
    db.from("subscriptions").select("id", { count: "exact", head: true }).eq("member_id", member.id),
  ]);
  const sub = subs?.[0] ?? null;
  const subMeta = sub?.metadata && typeof sub.metadata === "object" ? sub.metadata : {};
  return {
    fan,
    member: {
      id: member.id,
      status: member.status,
      joinedAt: member.created_at,
      totalSpentCents: Number(member.total_spent_cents ?? 0),
      lastSeenAt: member.last_seen_at ?? null,
    },
    subscription: sub
      ? {
          id: sub.id,
          tierId: sub.tier_id,
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
          trialEnd: sub.trial_end,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          cycle: subMeta.cycle || null,
          priceCents: Number(subMeta.priceCents) || null,
        }
      : null,
    tierId: member.status === "blocked" ? null : sub?.tier_id ?? null,
    blocked: member.status === "blocked",
    following,
    // Was a member once, isn't now — the page greets them with a way back in.
    lapsed: !sub && Number(everSubscribed) > 0,
    unlockedPosts: (postUnlocks || []).map((u) => u.ppv_post_id),
    unlockedMessages: (msgUnlocks || []).map((u) => u.message_id),
    likedPosts,
    bookmarkedPosts,
  };
}

/** What the browser gets of the viewer — unlock lists stay on the server. */
export function clientViewer(viewer) {
  return {
    fan: viewer.fan,
    member: viewer.member,
    subscription: viewer.subscription,
    tierId: viewer.tierId,
    blocked: Boolean(viewer.blocked),
    following: Boolean(viewer.following),
    lapsed: Boolean(viewer.lapsed),
    preview: viewer.preview || null,
  };
}

/** Stamp the member's visit so the next one can mark what's new since. */
export async function markSeen(db, viewer) {
  if (!viewer.member?.id || viewer.preview) return;
  await db.from("members").update({ last_seen_at: new Date().toISOString() }).eq("id", viewer.member.id);
}

/**
 * A stand-in viewer for the workspace preview: "guest", "follower", "lapsed" or
 * "tier:<id>". It holds no unlocks, so paid posts render exactly as a fan on
 * that rung would see them.
 */
export function previewViewer(creator, as) {
  const base = {
    fan: null,
    member: null,
    subscription: null,
    tierId: null,
    following: false,
    lapsed: false,
    unlockedPosts: [],
    unlockedMessages: [],
    likedPosts: [],
    bookmarkedPosts: [],
    preview: { as: "guest" },
  };
  const fan = { id: "preview", email: "fan@example.com", displayName: "Preview fan" };
  const member = { id: null, status: "active", joinedAt: new Date().toISOString(), totalSpentCents: 0, lastSeenAt: null };
  if (as === "follower") return { ...base, fan, following: true, preview: { as } };
  if (as === "lapsed") return { ...base, fan, member, lapsed: true, preview: { as } };
  const tierId = String(as || "").startsWith("tier:") ? as.slice(5) : null;
  const tier = creator.tiers.find((t) => t.id === tierId);
  if (tier) {
    const end = new Date(Date.now() + 20 * 86400000).toISOString();
    return {
      ...base,
      fan,
      member,
      following: true,
      tierId: tier.id,
      subscription: { id: null, tierId: tier.id, status: "active", currentPeriodEnd: end, trialEnd: null, cancelAtPeriodEnd: false, cycle: null, priceCents: null },
      preview: { as },
    };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Follows — the free rung below a tier

export async function setFollow(db, creator, fan, on) {
  const { profile } = creator;
  if (on) {
    const { error } = await db
      .from("creator_follows")
      .upsert({ project_id: profile.projectId, fan_account_id: fan.id }, { onConflict: "project_id,fan_account_id", ignoreDuplicates: true });
    if (error) {
      console.error("[creator.follow]", error.message);
      return { error: "Couldn't follow right now." };
    }
    queueWorkflowEvent(
      { type: "membership.followed", projectId: profile.projectId, context: { memberName: fan.displayName, memberEmail: fan.email } },
      db,
    );
    return { ok: true, following: true };
  }
  const { error } = await db.from("creator_follows").delete().eq("project_id", profile.projectId).eq("fan_account_id", fan.id);
  if (error) {
    console.error("[creator.unfollow]", error.message);
    return { error: "Couldn't unfollow right now." };
  }
  return { ok: true, following: false };
}

/**
 * Can this viewer see the post? Returns null when open, otherwise why not:
 * "members" (any subscription), "tier" (a higher tier) or "ppv" (buy it).
 */
export function lockReason(post, viewer, tiers) {
  if (viewer.blocked) return post.visibility === "public" ? null : "members";
  if (post.visibility === "public") return null;
  if (post.visibility === "ppv") return viewer.unlockedPosts.includes(post.id) ? null : "ppv";
  if (!viewer.subscription) return post.visibility === "tier" ? "tier" : "members";
  if (post.visibility === "members") return null;
  const rank = (id) => tiers.find((t) => t.id === id)?.position ?? -1;
  return rank(viewer.subscription.tierId) >= rank(post.min_tier_id) ? null : "tier";
}

function mediaUrl(handle, kind, id) {
  return `/c/${encodeURIComponent(handle)}/media?${kind}=${id}`;
}

/** Locked media keeps only its tiny blurred placeholder — never the real file. */
function mediaFor(asset, open, url) {
  if (!asset) return null;
  return {
    type: asset.type,
    color: asset.color,
    width: asset.width,
    height: asset.height,
    miniThumbnailUrl: asset.miniThumbnailUrl,
    thumbnailUrl: open ? asset.thumbnailUrl : "",
    url: open ? url : "",
  };
}

/** Every asset a post shows, in order — asset_ids, falling back to asset_id. */
function postAssetIds(row) {
  const ids = Array.isArray(row.asset_ids) && row.asset_ids.length ? row.asset_ids : row.asset_id ? [row.asset_id] : [];
  return [...new Set(ids)];
}

async function loadAssetMap(db, ids) {
  if (!ids.length) return new Map();
  const { data } = await db.from("assets").select(PUBLIC_ASSET_COLUMNS).in("id", ids).is("deleted_at", null);
  return new Map((data || []).map((row) => [row.id, publicAsset(row)]));
}

export function shapePost(row, { profile, tiers, viewer, assetMap }) {
  const locked = lockReason(row, viewer, tiers);
  const media = postAssetIds(row)
    .map((id, i) => mediaFor(assetMap.get(id), !locked, `${mediaUrl(profile.handle, "post", row.id)}&i=${i}`))
    .filter(Boolean);
  return {
    id: row.id,
    title: row.title ?? "",
    teaser: row.teaser_text ?? "",
    body: locked ? "" : row.body ?? "",
    visibility: row.visibility || "ppv",
    minTierId: row.min_tier_id ?? null,
    priceCents: Number(row.price_cents ?? 0),
    currency: row.currency ?? "usd",
    isPinned: Boolean(row.is_pinned),
    publishedAt: row.published_at || row.created_at,
    unlockCount: Number(row.unlock_count ?? 0),
    likeCount: Number(row.like_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    liked: viewer.likedPosts.includes(row.id),
    bookmarked: viewer.bookmarkedPosts.includes(row.id),
    locked,
    // A locked post reveals only its cover's blurred placeholder and how many
    // items are inside.
    media: locked ? media.slice(0, 1) : media,
    mediaCount: media.length,
  };
}

export async function loadFeed(db, creator, viewer) {
  const { profile, tiers } = creator;
  try {
    const { data, error } = await db
      .from("ppv_posts")
      .select("*")
      .eq("project_id", profile.projectId)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false, nullsFirst: false });
    if (error) {
      console.error("[creator.loadFeed]", error.message);
      return [];
    }
    const rows = data || [];
    const assetMap = await loadAssetMap(db, [...new Set(rows.flatMap(postAssetIds))]);
    return rows.map((row) => shapePost(row, { profile, tiers, viewer, assetMap }));
  } catch (err) {
    console.error("[creator.loadFeed]", err?.message);
    return [];
  }
}

/** The real asset id behind post media item `index`, when the viewer may see it. */
export async function postAssetFor(db, creator, viewer, postId, index = 0) {
  const { data: row } = await db
    .from("ppv_posts")
    .select("*")
    .eq("id", postId)
    .eq("project_id", creator.profile.projectId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (!row || lockReason(row, viewer, creator.tiers)) return null;
  return postAssetIds(row)[Number(index) || 0] ?? null;
}

/** Active bundles, each with whether the viewer already owns every post in it. */
export async function loadBundles(db, creator, viewer) {
  const { profile } = creator;
  const { data, error } = await db
    .from("post_bundles")
    .select("*")
    .eq("project_id", profile.projectId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[creator.loadBundles]", error.message);
    return [];
  }
  const rows = data || [];
  const postIds = [...new Set(rows.flatMap((b) => b.post_ids || []))];
  const [{ data: posts }, assetMap] = await Promise.all([
    postIds.length
      ? db
          .from("ppv_posts")
          .select("id, title, visibility, price_cents, asset_ids, asset_id")
          .in("id", postIds)
          .eq("status", "published")
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
    loadAssetMap(db, rows.map((b) => b.cover_asset_id).filter(Boolean)),
  ]);
  const postById = new Map((posts || []).map((p) => [p.id, p]));
  return rows
    .map((b) => {
      const items = (b.post_ids || []).map((id) => postById.get(id)).filter(Boolean);
      const paid = items.filter((p) => p.visibility === "ppv");
      const cover = assetMap.get(b.cover_asset_id);
      return {
        id: b.id,
        title: b.title ?? "",
        description: b.description ?? "",
        priceCents: Number(b.price_cents ?? 0),
        currency: b.currency ?? "usd",
        postCount: items.length,
        mediaCount: items.reduce((s, p) => s + postAssetIds(p).length, 0),
        valueCents: paid.reduce((s, p) => s + Number(p.price_cents || 0), 0),
        titles: items.map((p) => p.title).filter(Boolean).slice(0, 5),
        owned: paid.length > 0 && paid.every((p) => viewer.unlockedPosts.includes(p.id)),
        cover: cover ? { thumbnailUrl: cover.thumbnailUrl, color: cover.color } : null,
      };
    })
    .filter((b) => b.postCount);
}

export async function loadInbox(db, creator, viewer) {
  if (!viewer.member) return [];
  const { profile } = creator;
  const { data, error } = await db
    .from("paid_messages")
    .select(`*, asset:attachment_asset_id(${PUBLIC_ASSET_COLUMNS})`)
    .eq("project_id", profile.projectId)
    .neq("status", "draft")
    .is("deleted_at", null)
    .or(`member_id.eq.${viewer.member.id},member_id.is.null`)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[creator.loadInbox]", error.message);
    return [];
  }
  const joined = new Date(viewer.member.joinedAt).getTime();
  return (data || [])
    // Mass DMs reach members who were around when they went out.
    .filter((row) => row.member_id || new Date(row.sent_at || row.created_at).getTime() >= joined)
    .map((row) => {
      const inbound = row.direction === "inbound";
      const price = inbound ? 0 : Number(row.price_cents ?? 0);
      const unlocked =
        !price || viewer.unlockedMessages.includes(row.id) || (row.member_id && row.status === "unlocked");
      const expired = row.status === "expired" && !unlocked;
      const asset = publicAsset(row.asset);
      return {
        id: row.id,
        body: row.body ?? "",
        priceCents: price,
        currency: row.currency ?? "usd",
        sentAt: row.sent_at || row.created_at,
        isBroadcast: !row.member_id,
        fromFan: inbound,
        readAt: row.read_at,
        locked: !unlocked,
        expired,
        media: mediaFor(asset, unlocked, mediaUrl(profile.handle, "message", row.id)),
      };
    });
}

// ---------------------------------------------------------------------------
// Membership

/** The fan's member row for this creator — linked by account, then by email. */
export async function ensureMember(db, profile, fan) {
  const { data: linked } = await db
    .from("members")
    .select("*")
    .eq("project_id", profile.projectId)
    .eq("fan_account_id", fan.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (linked) return linked;

  const { data: byEmail } = await db
    .from("members")
    .select("*")
    .eq("project_id", profile.projectId)
    .eq("fan_email", fan.email)
    .is("fan_account_id", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (byEmail) {
    const { data } = await db.from("members").update({ fan_account_id: fan.id }).eq("id", byEmail.id).select("*").single();
    return data || byEmail;
  }

  const { data, error } = await db
    .from("members")
    .insert({
      project_id: profile.projectId,
      fan_account_id: fan.id,
      fan_name: fan.displayName,
      fan_email: fan.email,
      status: "active",
      last_seen_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) {
    console.error("[creator.ensureMember]", error.message);
    return null;
  }
  return data;
}

async function liveSubscriptions(db, memberId) {
  const { data } = await db
    .from("subscriptions")
    .select("*")
    .eq("member_id", memberId)
    .in("status", LIVE)
    .is("deleted_at", null);
  return data || [];
}

function emit(db, type, profile, member, context) {
  queueWorkflowEvent(
    {
      type,
      projectId: profile.projectId,
      context: { memberId: member?.id, memberName: member?.fan_name, memberEmail: member?.fan_email, ...context },
    },
    db,
  );
}

/**
 * Put the member on a tier. Same tier renews from the current period end;
 * a different tier replaces whatever they were on. `cycle` / `priceCents` record
 * how this subscription bills (a monthly tier can be bought a year at a time)
 * and `extraMeta` carries promo details the renewal run honours.
 */
async function applySubscription(
  db,
  profile,
  member,
  tier,
  { status = "active", trialDays = 0, trialEnd: trialEndAt = null, cycle = null, priceCents = null, extraMeta = {} } = {},
) {
  const now = new Date().toISOString();
  const billing = cycle ? { cycle, priceCents } : cyclePrice(tier, "month");
  const live = await liveSubscriptions(db, member.id);
  const same = live.find((s) => s.tier_id === tier.id);

  if (same && status === "active") {
    const from = new Date(same.current_period_end).getTime() > Date.now() ? same.current_period_end : now;
    const { data } = await db
      .from("subscriptions")
      .update({
        status: "active",
        cancel_at_period_end: false,
        current_period_start: from,
        current_period_end: addInterval(from, billing.cycle),
        metadata: { ...(same.metadata || {}), cycle: billing.cycle, priceCents: billing.priceCents, cancelReason: null, ...extraMeta },
      })
      .eq("id", same.id)
      .select("*")
      .single();
    return data;
  }

  const others = live.filter((s) => s.tier_id !== tier.id).map((s) => s.id);
  if (others.length) {
    await db.from("subscriptions").update({ status: "cancelled", cancel_at_period_end: false, current_period_end: now }).in("id", others);
  }
  const trialEnd = status === "trialing" ? trialEndAt || new Date(Date.now() + trialDays * 86400000).toISOString() : null;
  const { data, error } = await db
    .from("subscriptions")
    .insert({
      project_id: profile.projectId,
      member_id: member.id,
      tier_id: tier.id,
      status,
      current_period_start: now,
      current_period_end: trialEnd || addInterval(now, billing.cycle),
      trial_end: trialEnd,
      metadata: { cycle: billing.cycle, priceCents: billing.priceCents, ...extraMeta },
    })
    .select("*")
    .single();
  if (error) console.error("[creator.applySubscription]", error.message);
  await db.from("members").update({ status: status === "trialing" ? "trialing" : "active" }).eq("id", member.id).neq("status", "blocked");
  return data;
}

async function findTier(db, profile, tierId) {
  const { data } = await db
    .from("membership_tiers")
    .select("*")
    .eq("id", tierId)
    .eq("project_id", profile.projectId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  return data ? normalizeTier(data) : null;
}

// ---------------------------------------------------------------------------
// Promo codes

function addMonths(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + Math.max(1, Number(months) || 1));
  return d.toISOString();
}

/** An active, unexpired, not-used-up promo code for this creator, or null. */
async function findPromo(db, profile, code) {
  const clean = String(code || "").trim().slice(0, 64);
  if (!clean) return null;
  const { data } = await db
    .from("promo_codes")
    .select("*")
    .eq("project_id", profile.projectId)
    .eq("code", clean)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  if (data.max_redemptions && Number(data.redeemed_count) >= Number(data.max_redemptions)) return null;
  return data;
}

async function hasRedeemed(db, promo, memberId) {
  if (!memberId) return false;
  const { count } = await db.from("promo_redemptions").select("id", { count: "exact", head: true }).eq("promo_id", promo.id).eq("member_id", memberId);
  return Number(count) > 0;
}

async function redeemPromo(db, promo, member, subscriptionId) {
  const { error } = await db.from("promo_redemptions").insert({ project_id: promo.project_id, promo_id: promo.id, member_id: member.id, subscription_id: subscriptionId ?? null });
  if (error) return;
  await db.from("promo_codes").update({ redeemed_count: Number(promo.redeemed_count) + 1 }).eq("id", promo.id);
}

/** What a promo does to a tier's first charge: { kind, label, firstCents, months }. */
function promoOffer(promo, tier, cycle) {
  const { priceCents, cycle: billed } = cyclePrice(tier, cycle);
  const months = Math.max(1, Number(promo.duration_months) || 1);
  const span = months === 1 ? "1 month" : `${months} months`;
  if (promo.kind === "trial") return { kind: "trial", months, firstCents: 0, label: `Free trial for ${span}` };
  if (promo.kind === "free_month") return { kind: "free_month", months, firstCents: 0, label: `${span} free` };
  const percent = Number(promo.percent_off) || 0;
  const amountOff = Number(promo.amount_off_cents) || 0;
  const off = percent ? Math.round((priceCents * percent) / 100) : Math.min(priceCents, amountOff);
  // A discount counts in billing periods, so a yearly charge uses one of them.
  const periods = billed === "year" ? 1 : months;
  const scope = billed === "year" ? "your first year" : months === 1 ? "your first month" : `your first ${months} months`;
  return {
    kind: "discount",
    months: periods,
    firstCents: Math.max(0, priceCents - off),
    percentOff: percent || null,
    amountOffCents: percent ? null : amountOff,
    label: `${percent ? `${percent}%` : formatCents(amountOff)} off ${scope}`,
  };
}

function formatCents(cents) {
  const n = (Number(cents) || 0) / 100;
  return `$${n % 1 ? n.toFixed(2) : n}`;
}

/** Check a code against a tier before checkout. */
export async function previewPromo(db, creator, fan, { code, tierId, cycle }) {
  const promo = await findPromo(db, creator.profile, code);
  if (!promo) return { error: "That code isn't valid." };
  const tier = tierId ? await findTier(db, creator.profile, tierId) : creator.tiers.find((t) => !t.isFree);
  if (!tier || tier.isFree) return { error: "Codes apply to paid tiers." };
  if (fan) {
    const { data: member } = await db
      .from("members")
      .select("id")
      .eq("project_id", creator.profile.projectId)
      .eq("fan_account_id", fan.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (await hasRedeemed(db, promo, member?.id)) return { error: "You've already used this code." };
  }
  const offer = promoOffer(promo, tier, cycle);
  // The page prices each tier itself, so the code travels as its terms.
  return {
    ok: true,
    promo: {
      code: promo.code,
      kind: offer.kind,
      label: offer.label,
      percentOff: offer.percentOff ?? null,
      amountOffCents: offer.amountOffCents ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Joining, switching, cancelling

/**
 * Join a tier without paying: free tiers, a trial / free-months promo code, and
 * the first trial on a paid tier. Returns { ok } or { error }; paid joins return
 * { needsPayment: true }.
 */
export async function joinTier(db, creator, fan, tierId, { promoCode = "", skipTrial = false } = {}) {
  const { profile } = creator;
  const tier = await findTier(db, profile, tierId);
  if (!tier) return { error: "That tier isn't available." };
  const member = await ensureMember(db, profile, fan);
  if (!member) return { error: "Couldn't set up your membership." };
  if (member.status === "blocked") return { error: "This account can't join right now." };

  if (tier.isFree) {
    await applySubscription(db, profile, member, tier);
    emit(db, "membership.subscribed", profile, member, { tier: tier.name, amountCents: 0 });
    return { ok: true };
  }

  const promo = promoCode ? await findPromo(db, profile, promoCode) : null;
  if (promoCode && !promo) return { error: "That code isn't valid." };
  if (promo && (promo.kind === "trial" || promo.kind === "free_month")) {
    if (await hasRedeemed(db, promo, member.id)) return { error: "You've already used this code." };
    const offer = promoOffer(promo, tier, "month");
    const sub = await applySubscription(db, profile, member, tier, {
      status: "trialing",
      trialEnd: addMonths(offer.months),
      extraMeta: { promoId: promo.id, promoCode: promo.code },
    });
    await redeemPromo(db, promo, member, sub?.id);
    emit(db, "membership.subscribed", profile, member, { tier: tier.name, amountCents: 0, trial: true, promo: promo.code });
    return { ok: true, trialLabel: offer.label };
  }

  if (tier.trialDays > 0 && !promo && !skipTrial) {
    const { count } = await db.from("subscriptions").select("id", { count: "exact", head: true }).eq("member_id", member.id).eq("tier_id", tier.id);
    if (!count) {
      await applySubscription(db, profile, member, tier, { status: "trialing", trialDays: tier.trialDays });
      emit(db, "membership.subscribed", profile, member, { tier: tier.name, amountCents: 0, trial: true });
      return { ok: true, trial: tier.trialDays };
    }
  }
  return { needsPayment: true };
}

export const CANCEL_REASONS = {
  price: "Too expensive",
  content: "Not enough new content",
  break: "Taking a break",
  value: "Didn't get what I expected",
  other: "Something else",
};

export async function setCancelAtPeriodEnd(db, creator, fan, cancel, { reason = "", note = "" } = {}) {
  const member = await ensureMember(db, creator.profile, fan);
  if (!member) return false;
  const live = await liveSubscriptions(db, member.id);
  if (!live.length) return false;
  const why = CANCEL_REASONS[reason] ? reason : cancel ? "other" : null;
  const detail = cancel ? String(note || "").slice(0, 500) : "";
  const results = await Promise.all(
    live.map((s) =>
      db
        .from("subscriptions")
        .update({ cancel_at_period_end: cancel, metadata: { ...(s.metadata || {}), cancelReason: why, cancelNote: detail || null } })
        .eq("id", s.id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed) {
    console.error("[creator.setCancelAtPeriodEnd]", failed.error.message);
    return false;
  }
  if (cancel) emit(db, "membership.cancelled", creator.profile, member, { reason: CANCEL_REASONS[why], note: detail });
  return true;
}

// ---------------------------------------------------------------------------
// Payments

/**
 * Price the purchase on the server (never trust the client's amount), open a
 * pending fan_payment and hand back where to send the fan.
 */
export async function startPayment(db, creator, fan, input, origin) {
  const { profile } = creator;
  const member = await ensureMember(db, profile, fan);
  if (!member) return { error: "Couldn't set up your membership." };
  if (member.status === "blocked") return { error: "This account can't make purchases here." };
  const viewer = await loadViewer(db, profile, fan);

  let amount = 0;
  let name = "";
  let tierId = null;
  let targetId = null;
  const meta = {};

  switch (input.kind) {
    case "subscription": {
      const tier = await findTier(db, profile, input.tierId);
      if (!tier || tier.isFree) return { error: "That tier isn't available." };
      const billing = cyclePrice(tier, input.cycle);
      amount = billing.priceCents;
      tierId = tier.id;
      meta.cycle = billing.cycle;
      meta.cycle_price_cents = billing.priceCents;
      if (input.promoCode) {
        const promo = await findPromo(db, profile, input.promoCode);
        if (!promo) return { error: "That code isn't valid." };
        if (await hasRedeemed(db, promo, member.id)) return { error: "You've already used this code." };
        if (promo.kind !== "discount") return joinTier(db, creator, fan, tier.id, { promoCode: promo.code });
        const offer = promoOffer(promo, tier, billing.cycle);
        amount = offer.firstCents;
        meta.promo_id = promo.id;
        meta.promo_code = promo.code;
        // Renewals keep the discount for the periods it has left.
        meta.discount = { percentOff: offer.percentOff, amountOffCents: offer.amountOffCents, remaining: Math.max(0, offer.months - 1) };
      }
      name = `${tier.name} — ${profile.displayName} membership (${billing.cycle === "year" ? "1 year" : "1 month"})`;
      break;
    }
    case "tip": {
      if (!profile.tipsEnabled) return { error: "Tips are turned off." };
      amount = Math.round(Number(input.amountCents) || 0);
      if (amount < profile.minTipCents) return { error: "That tip is below the minimum." };
      if (amount > MAX_TIP_CENTS) return { error: "That tip is above the maximum." };
      name = `Tip for ${profile.displayName}`;
      meta.target_type = ["post", "message"].includes(input.targetType) ? input.targetType : "profile";
      targetId = meta.target_type === "profile" ? null : input.targetId || null;
      break;
    }
    case "post_unlock": {
      const { data: post } = await db
        .from("ppv_posts")
        .select("*")
        .eq("id", input.targetId)
        .eq("project_id", profile.projectId)
        .eq("status", "published")
        .is("deleted_at", null)
        .maybeSingle();
      if (!post || post.visibility !== "ppv" || !Number(post.price_cents)) return { error: "That post can't be unlocked." };
      if (viewer.unlockedPosts.includes(post.id)) return { error: "You've already unlocked this post." };
      amount = Number(post.price_cents);
      targetId = post.id;
      name = `Unlock: ${post.title || "post"}`;
      break;
    }
    case "message_unlock": {
      const inbox = await loadInbox(db, creator, viewer);
      const message = inbox.find((m) => m.id === input.targetId);
      if (!message || !message.locked || message.expired) return { error: "That message can't be unlocked." };
      amount = message.priceCents;
      targetId = message.id;
      name = `Unlock message from ${profile.displayName}`;
      break;
    }
    case "bundle_unlock": {
      const bundle = (await loadBundles(db, creator, viewer)).find((b) => b.id === input.targetId);
      if (!bundle || !bundle.priceCents) return { error: "That bundle isn't available." };
      if (bundle.owned) return { error: "You already own everything in this bundle." };
      amount = bundle.priceCents;
      targetId = bundle.id;
      name = `Bundle: ${bundle.title || "posts"}`;
      break;
    }
    default:
      return { error: "Unknown purchase." };
  }

  const provider = paymentProviderName();
  const note = String(input.note || "").slice(0, 280);
  const { data: payment, error } = await db
    .from("fan_payments")
    .insert({
      project_id: profile.projectId,
      fan_account_id: fan.id,
      member_id: member.id,
      kind: input.kind,
      target_id: targetId,
      tier_id: tierId,
      amount_cents: amount,
      provider,
      note,
      metadata: meta,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[creator.startPayment]", error.message);
    return { error: "Couldn't start checkout." };
  }

  // A 100%-off code: nothing to charge, so settle it on the spot.
  if (!amount && input.kind === "subscription") {
    await completePayment(db, payment.id, { provider: "promo" });
    return { ok: true };
  }

  const payPath = `/c/${encodeURIComponent(profile.handle)}/pay/${payment.id}?token=${payment.access_token}`;
  if (provider === "test") return { url: payPath };

  try {
    const session = await createPaymentSession({
      reference: payment.id,
      email: fan.email,
      lines: [{ name, unitCents: amount }],
      successUrl: `${origin}${payPath}`,
      cancelUrl: `${origin}/c/${encodeURIComponent(profile.handle)}`,
      metadata: { fan_payment_id: payment.id, project_id: profile.projectId },
    });
    await db.from("fan_payments").update({ provider_ref: session.id }).eq("id", payment.id);
    return { url: session.url };
  } catch (err) {
    console.error("[creator.startPayment.stripe]", err?.message);
    await db.from("fan_payments").update({ status: "failed" }).eq("id", payment.id);
    return { error: "The payment provider is unavailable — try again shortly." };
  }
}

export async function loadPayment(db, id, token) {
  if (!id || !token) return null;
  const { data } = await db.from("fan_payments").select("*").eq("id", id).maybeSingle();
  if (!data || data.access_token !== token) return null;
  return data;
}

/**
 * Settle a paid fan_payment exactly once: the pending -> paid flip is the lock,
 * so a Stripe retry or a double-clicked test button is harmless.
 */
export async function completePayment(db, paymentId, { provider, providerRef } = {}) {
  const now = new Date().toISOString();
  const { data: payment, error } = await db
    .from("fan_payments")
    .update({ status: "paid", paid_at: now, ...(providerRef ? { provider_ref: providerRef } : {}) })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[creator.completePayment]", error.message);
    return null;
  }
  if (!payment) return (await db.from("fan_payments").select("*").eq("id", paymentId).maybeSingle()).data;

  const [{ data: profileRow }, { data: member }] = await Promise.all([
    db.from("creator_profiles").select("*").eq("project_id", payment.project_id).is("deleted_at", null).maybeSingle(),
    db.from("members").select("*").eq("id", payment.member_id).maybeSingle(),
  ]);
  const profile = normalizeProfile(profileRow) || { projectId: payment.project_id };
  const amount = Number(payment.amount_cents);

  try {
    if (payment.kind === "subscription") {
      const { data: tierRow } = await db.from("membership_tiers").select("*").eq("id", payment.tier_id).maybeSingle();
      if (tierRow && member) {
        const tier = normalizeTier(tierRow);
        const pm = payment.metadata || {};
        const billing = pm.cycle ? { cycle: pm.cycle, priceCents: Number(pm.cycle_price_cents) || tier.priceCents } : cyclePrice(tier, "month");
        const extraMeta = pm.promo_id ? { promoId: pm.promo_id, promoCode: pm.promo_code, discount: pm.discount || null } : {};
        const sub = await applySubscription(db, profile, member, tier, { ...billing, extraMeta });
        if (pm.promo_id) {
          const { data: promo } = await db.from("promo_codes").select("*").eq("id", pm.promo_id).maybeSingle();
          if (promo) await redeemPromo(db, promo, member, sub?.id);
        }
        await db.from("billing_invoices").insert({
          project_id: payment.project_id,
          number: invoiceNumber(),
          member_id: member.id,
          subscription_id: sub?.id ?? null,
          tier_id: tier.id,
          amount_cents: amount,
          currency: payment.currency,
          status: "paid",
          period_start: sub?.current_period_start ?? now,
          period_end: sub?.current_period_end ?? addInterval(now, billing.cycle),
          due_at: now,
          paid_at: now,
          attempt_count: 1,
          metadata: { fan_payment_id: payment.id, provider },
        });
        emit(db, "membership.subscribed", profile, member, { tier: tier.name, amountCents: amount });
      }
    } else if (payment.kind === "tip") {
      await db.from("tips").insert({
        project_id: payment.project_id,
        member_id: payment.member_id,
        target_type: payment.metadata?.target_type || "profile",
        target_id: payment.target_id,
        amount_cents: amount,
        currency: payment.currency,
        note: payment.note,
        status: "succeeded",
      });
      emit(db, "membership.tipped", profile, member, { amountCents: amount, note: payment.note });
    } else if (payment.kind === "post_unlock") {
      const { error: unlockError } = await db
        .from("ppv_unlocks")
        .insert({ project_id: payment.project_id, ppv_post_id: payment.target_id, member_id: payment.member_id, price_cents: amount });
      if (!unlockError) {
        const { data: post } = await db.from("ppv_posts").select("unlock_count, revenue_cents, title").eq("id", payment.target_id).maybeSingle();
        if (post) {
          await db
            .from("ppv_posts")
            .update({ unlock_count: Number(post.unlock_count) + 1, revenue_cents: Number(post.revenue_cents) + amount })
            .eq("id", payment.target_id);
        }
        emit(db, "membership.unlocked", profile, member, { kind: "post", title: post?.title, amountCents: amount });
      }
    } else if (payment.kind === "bundle_unlock") {
      const { data: bundle } = await db.from("post_bundles").select("*").eq("id", payment.target_id).maybeSingle();
      if (bundle) {
        const { data: posts } = await db.from("ppv_posts").select("id, unlock_count").in("id", bundle.post_ids || []).eq("visibility", "ppv");
        for (const post of posts || []) {
          const { error: dup } = await db
            .from("ppv_unlocks")
            .insert({ project_id: payment.project_id, ppv_post_id: post.id, member_id: payment.member_id, price_cents: 0, metadata: { bundle_id: bundle.id } });
          if (!dup) await db.from("ppv_posts").update({ unlock_count: Number(post.unlock_count) + 1 }).eq("id", post.id);
        }
        await db
          .from("post_bundles")
          .update({ sales_count: Number(bundle.sales_count) + 1, revenue_cents: Number(bundle.revenue_cents) + amount })
          .eq("id", bundle.id);
        emit(db, "membership.unlocked", profile, member, { kind: "bundle", title: bundle.title, amountCents: amount });
      }
    } else if (payment.kind === "message_unlock") {
      await db
        .from("message_unlocks")
        .insert({ project_id: payment.project_id, message_id: payment.target_id, member_id: payment.member_id, price_cents: amount });
      await db
        .from("paid_messages")
        .update({ status: "unlocked", unlocked_at: now })
        .eq("id", payment.target_id)
        .eq("member_id", payment.member_id);
      emit(db, "membership.unlocked", profile, member, { kind: "message", amountCents: amount });
    }

    if (member) {
      await db
        .from("members")
        .update({ total_spent_cents: Number(member.total_spent_cents ?? 0) + amount, last_seen_at: now })
        .eq("id", member.id);
    }
  } catch (err) {
    console.error("[creator.completePayment.fulfil]", err?.message);
  }
  return payment;
}

/** Stripe session -> our fan_payment id (from metadata, else provider_ref). */
export async function paymentIdForSession(db, session) {
  if (session?.metadata?.fan_payment_id) return session.metadata.fan_payment_id;
  if (!session?.id) return null;
  const { data } = await db.from("fan_payments").select("id").eq("provider_ref", session.id).maybeSingle();
  return data?.id ?? null;
}
