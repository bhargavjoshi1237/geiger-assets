if (typeof window !== "undefined") {
  throw new Error("lib/creator/fan_hub is server-only.");
}

// The fan's own account area (/fan): every creator they follow or belong to,
// their memberships, new posts from those creators, what they've unlocked and
// saved, what they've paid, and account settings. Plus one-time password reset
// links — issued by a creator's staff until email sending lands.

import { createHash, randomBytes } from "node:crypto";
import { PUBLIC_ASSET_COLUMNS, publicAsset } from "@/lib/supabase/gallery_shape";

const LIVE = ["active", "trialing", "past_due"];
const RESET_HOURS = 24;
const FEED_LIMIT = 12;

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

function postAssetIds(row) {
  return Array.isArray(row.asset_ids) && row.asset_ids.length ? row.asset_ids : row.asset_id ? [row.asset_id] : [];
}

/** A post's cover — the real thumbnail only when the fan can open the post. */
function coverOf(asset, open) {
  if (!asset) return null;
  return { thumbnailUrl: open ? asset.thumbnailUrl : "", miniThumbnailUrl: asset.miniThumbnailUrl, color: asset.color, type: asset.type };
}

/**
 * Everything the fan's profile shows, across every creator they follow or
 * belong to. Post access is resolved with the creator page's own rules
 * (lockReason in lib/creator/server.js), so a locked post never hands out more
 * than its blurred placeholder here either.
 */
export async function loadFanHub(db, fan) {
  const [{ data: members }, { data: follows }, { data: marks }, { count: likeCount }, { count: commentCount }, { data: account }] = await Promise.all([
    db.from("members").select("id, project_id, status, created_at, total_spent_cents").eq("fan_account_id", fan.id).is("deleted_at", null),
    db.from("creator_follows").select("project_id, created_at").eq("fan_account_id", fan.id),
    db.from("post_bookmarks").select("post_id, created_at").eq("fan_account_id", fan.id).order("created_at", { ascending: false }),
    db.from("post_likes").select("id", { count: "exact", head: true }).eq("fan_account_id", fan.id),
    db.from("post_comments").select("id", { count: "exact", head: true }).eq("fan_account_id", fan.id).is("deleted_at", null),
    db.from("fan_accounts").select("created_at").eq("id", fan.id).maybeSingle(),
  ]);
  const memberRows = members || [];
  const followRows = follows || [];
  const projectIds = [...new Set([...memberRows.map((m) => m.project_id), ...followRows.map((f) => f.project_id)])];
  const memberIds = memberRows.map((m) => m.id);

  const [{ data: profiles }, { data: subs }, { data: payments }, { data: unlocks }, { data: tierRows }] = await Promise.all([
    projectIds.length
      ? db.from("creator_profiles").select("*").in("project_id", projectIds).is("deleted_at", null)
      : Promise.resolve({ data: [] }),
    memberIds.length
      ? db
          .from("subscriptions")
          .select("*, tier:tier_id(name, price_cents, currency, interval)")
          .in("member_id", memberIds)
          .in("status", LIVE)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
    db
      .from("fan_payments")
      .select("*")
      .eq("fan_account_id", fan.id)
      .in("status", ["paid", "refunded"])
      .order("paid_at", { ascending: false })
      .limit(200),
    memberIds.length ? db.from("ppv_unlocks").select("ppv_post_id, unlocked_at").in("member_id", memberIds) : Promise.resolve({ data: [] }),
    projectIds.length
      ? db.from("membership_tiers").select("id, project_id, position").in("project_id", projectIds).is("deleted_at", null)
      : Promise.resolve({ data: [] }),
  ]);

  const liveProjectIds = (profiles || []).filter((p) => p.is_published).map((p) => p.project_id);
  const unlockedAt = new Map((unlocks || []).map((u) => [u.ppv_post_id, u.unlocked_at]));
  const markIds = (marks || []).map((m) => m.post_id);
  const ownedIds = [...new Set([...unlockedAt.keys(), ...markIds])];

  // New posts from every live creator, plus whatever the fan unlocked or saved.
  const [{ data: recent }, { data: owned }] = await Promise.all([
    liveProjectIds.length
      ? db
          .from("ppv_posts")
          .select("*")
          .in("project_id", liveProjectIds)
          .eq("status", "published")
          .is("deleted_at", null)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(FEED_LIMIT)
      : Promise.resolve({ data: [] }),
    ownedIds.length
      ? db.from("ppv_posts").select("*").in("id", ownedIds).eq("status", "published").is("deleted_at", null)
      : Promise.resolve({ data: [] }),
  ]);

  const assetIds = [
    ...new Set([
      ...[...(recent || []), ...(owned || [])].map((p) => postAssetIds(p)[0]),
      ...(profiles || []).flatMap((p) => [p.avatar_asset_id, p.banner_asset_id]),
    ]),
  ].filter(Boolean);
  const { data: assetRows } = assetIds.length ? await db.from("assets").select(PUBLIC_ASSET_COLUMNS).in("id", assetIds) : { data: [] };
  const assetById = new Map((assetRows || []).map((a) => [a.id, publicAsset(a)]));
  const profileByProject = new Map((profiles || []).map((p) => [p.project_id, p]));
  const memberByProject = new Map(memberRows.map((m) => [m.project_id, m]));
  const followByProject = new Map(followRows.map((f) => [f.project_id, f]));
  const subByMember = new Map((subs || []).map((s) => [s.member_id, s]));
  const tiersByProject = new Map();
  for (const t of tierRows || []) tiersByProject.set(t.project_id, [...(tiersByProject.get(t.project_id) || []), t]);

  const lockOf = (row) => {
    const member = memberByProject.get(row.project_id);
    const sub = member && member.status !== "blocked" ? subByMember.get(member.id) : null;
    if (row.visibility === "public") return null;
    if (row.visibility === "ppv" || !row.visibility) return unlockedAt.has(row.id) ? null : "ppv";
    if (!sub) return row.visibility === "tier" ? "tier" : "members";
    if (row.visibility === "members") return null;
    const tiers = tiersByProject.get(row.project_id) || [];
    const rank = (id) => tiers.find((t) => t.id === id)?.position ?? -1;
    return rank(sub.tier_id) >= rank(row.min_tier_id) ? null : "tier";
  };

  const creatorOf = (p) => ({
    handle: String(p.handle),
    displayName: p.display_name || String(p.handle),
    accentColor: p.accent_color || "#f97316",
    avatarUrl: assetById.get(p.avatar_asset_id)?.thumbnailUrl || "",
  });

  const shapePost = (row) => {
    const p = profileByProject.get(row.project_id);
    if (!p) return null;
    const locked = lockOf(row);
    const ids = postAssetIds(row);
    return {
      id: row.id,
      title: row.title || "Untitled post",
      teaser: row.teaser_text || "",
      visibility: row.visibility || "ppv",
      priceCents: Number(row.price_cents ?? 0),
      currency: row.currency || "usd",
      publishedAt: row.published_at || row.created_at,
      likeCount: Number(row.like_count ?? 0),
      commentCount: Number(row.comment_count ?? 0),
      mediaCount: ids.length,
      locked,
      cover: coverOf(assetById.get(ids[0]), !locked),
      creator: creatorOf(p),
    };
  };

  const creators = projectIds
    .map((projectId) => {
      const p = profileByProject.get(projectId);
      if (!p) return null;
      const m = memberByProject.get(projectId);
      const sub = m ? subByMember.get(m.id) : null;
      const follow = followByProject.get(projectId);
      return {
        ...creatorOf(p),
        tagline: p.tagline || "",
        bannerUrl: assetById.get(p.banner_asset_id)?.thumbnailUrl || "",
        isPublished: Boolean(p.is_published),
        joinedAt: m?.created_at || follow?.created_at || null,
        following: Boolean(follow),
        wasMember: Boolean(m) && !sub,
        totalSpentCents: Number(m?.total_spent_cents ?? 0),
        membership: sub
          ? {
              tierName: sub.tier?.name || "Tier",
              priceCents: Number(sub.metadata?.priceCents ?? sub.tier?.price_cents ?? 0),
              currency: sub.tier?.currency || "usd",
              interval: sub.metadata?.cycle || sub.tier?.interval || "month",
              status: sub.status,
              currentPeriodEnd: sub.current_period_end,
              cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
            }
          : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(Boolean(b.membership)) - Number(Boolean(a.membership)) || b.totalSpentCents - a.totalSpentCents);

  const ownedById = new Map((owned || []).map((r) => [r.id, r]));
  const library = [...unlockedAt.keys()]
    .map((id) => ownedById.get(id))
    .filter(Boolean)
    .sort((a, b) => new Date(unlockedAt.get(b.id)).getTime() - new Date(unlockedAt.get(a.id)).getTime())
    .map(shapePost)
    .filter(Boolean);
  const saved = markIds.map((id) => ownedById.get(id)).filter(Boolean).map(shapePost).filter(Boolean);

  const creatorName = new Map((profiles || []).map((p) => [p.project_id, p.display_name || String(p.handle)]));
  const paymentRows = (payments || []).map((p) => ({
    id: p.id,
    kind: p.kind,
    status: p.status,
    amountCents: Number(p.amount_cents),
    currency: p.currency,
    paidAt: p.paid_at || p.created_at,
    creatorName: creatorName.get(p.project_id) || "Creator",
    note: p.note || "",
    provider: p.provider,
  }));

  return {
    since: account?.created_at || null,
    creators,
    payments: paymentRows,
    feed: (recent || []).map(shapePost).filter(Boolean),
    library,
    saved,
    stats: {
      memberships: creators.filter((c) => c.membership).length,
      following: creators.filter((c) => c.following).length,
      supportedCents: paymentRows.filter((p) => p.status === "paid").reduce((s, p) => s + p.amountCents, 0),
      unlocked: library.length,
      likes: Number(likeCount) || 0,
      comments: Number(commentCount) || 0,
    },
  };
}

/** A one-time reset link for a fan account; returns the raw token. */
export async function issueResetToken(db, fanAccountId, createdBy) {
  const token = randomBytes(32).toString("hex");
  const { error } = await db.from("fan_password_resets").insert({
    fan_account_id: fanAccountId,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + RESET_HOURS * 3600000).toISOString(),
    created_by: createdBy || null,
  });
  if (error) {
    console.error("[fan_hub.issueResetToken]", error.message);
    return null;
  }
  return token;
}

/** Spend a reset token: returns the fan account id, or null when invalid. */
export async function consumeResetToken(db, token) {
  if (!token) return null;
  const { data } = await db
    .from("fan_password_resets")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hashToken(String(token)))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("fan_account_id")
    .maybeSingle();
  return data?.fan_account_id ?? null;
}
