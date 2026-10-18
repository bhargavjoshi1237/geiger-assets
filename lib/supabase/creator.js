"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

function meta(row) {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

function toRowGeneric(input, map, numerics = []) {
  const row = {};
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  for (const key of numerics) {
    if (key in input) {
      const col = map[key] || key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      row[col] = Number(input[key]) || 0;
    }
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  if (input.id) row.id = input.id;
  return row;
}

async function listRows(table, projectId, order = "updated_at") {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    let q = sb.from(table).select("*");
    if (table !== "ppv_unlocks" && table !== "tips" && table !== "promo_redemptions" && table !== "message_unlocks") {
      q = q.is("deleted_at", null);
    }
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order(order, { ascending: false });
    if (error) {
      console.error(`[creator.${table}.list]`, error.message);
      return null;
    }
    return data ?? [];
  } catch (err) {
    console.error(`[creator.${table}.list]`, err?.message);
    return null;
  }
}

async function createRow(table, input, normalize) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.from(table).insert(input).select("*").single();
    if (error) {
      console.error(`[creator.${table}.create]`, error.message);
      return null;
    }
    return normalize ? normalize(data) : data;
  } catch (err) {
    console.error(`[creator.${table}.create]`, err?.message);
    return null;
  }
}

async function updateRow(table, id, patch, normalize) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.from(table).update(patch).eq("id", id).select("*").single();
    if (error) {
      console.error(`[creator.${table}.update]`, error.message);
      return null;
    }
    return normalize ? normalize(data) : true;
  } catch (err) {
    console.error(`[creator.${table}.update]`, err?.message);
    return null;
  }
}

async function softDeleteRow(table, id) {
  if (!isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      console.error(`[creator.${table}.delete]`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[creator.${table}.delete]`, err?.message);
    return false;
  }
}

const TIER_MAP = {
  projectId: "project_id", name: "name", description: "description",
  currency: "currency", interval: "interval", isFree: "is_free",
  isActive: "is_active", stripePriceId: "stripe_price_id", createdBy: "created_by",
};

export function normalizeTier(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, name: row.name ?? "",
    description: row.description ?? "", priceCents: Number(row.price_cents ?? 0),
    currency: row.currency ?? "usd", interval: row.interval ?? "month",
    isFree: Boolean(row.is_free), isActive: row.is_active !== false,
    position: Number(row.position ?? 0),
    perks: Array.isArray(row.perks) ? row.perks : [],
    stripePriceId: row.stripe_price_id ?? "",
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

export const listTiers = (projectId) => listRows("membership_tiers", projectId).then((r) => (r ? r.map(normalizeTier) : r));
export const createTier = (input) => createRow("membership_tiers", { ...toRowGeneric(input, TIER_MAP), price_cents: Number(input.priceCents) || 0, position: Number(input.position) || 0, perks: input.perks || [] }, normalizeTier);
export const updateTier = (id, input) => updateRow("membership_tiers", id, { ...toRowGeneric(input, TIER_MAP), ...(input.priceCents !== undefined ? { price_cents: Number(input.priceCents) || 0 } : {}), ...(input.perks !== undefined ? { perks: input.perks } : {}), ...(input.position !== undefined ? { position: Number(input.position) || 0 } : {}) }, normalizeTier);
export const deleteTier = (id) => softDeleteRow("membership_tiers", id);

const MEMBER_MAP = {
  projectId: "project_id", fanName: "fan_name", fanEmail: "fan_email",
  status: "status", createdBy: "created_by",
};

export function normalizeMember(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, fanName: row.fan_name ?? "",
    fanEmail: row.fan_email ?? "", status: row.status ?? "active",
    totalSpentCents: Number(row.total_spent_cents ?? 0),
    lastSeenAt: row.last_seen_at ?? "",
    fanAccountId: row.fan_account_id ?? null,
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

export const listMembers = (projectId) => listRows("members", projectId).then((r) => (r ? r.map(normalizeMember) : r));
export const createMember = (input) => createRow("members", toRowGeneric(input, MEMBER_MAP), normalizeMember);
export const updateMember = (id, input) => updateRow("members", id, toRowGeneric(input, MEMBER_MAP), normalizeMember);
export const deleteMember = (id) => softDeleteRow("members", id);

const SUB_MAP = {
  projectId: "project_id", memberId: "member_id", tierId: "tier_id",
  status: "status", currentPeriodStart: "current_period_start",
  currentPeriodEnd: "current_period_end", trialEnd: "trial_end",
  cancelAtPeriodEnd: "cancel_at_period_end", createdBy: "created_by",
};

export function normalizeSubscription(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, memberId: row.member_id ?? null,
    tierId: row.tier_id ?? null, status: row.status ?? "active",
    currentPeriodStart: row.current_period_start ?? "",
    currentPeriodEnd: row.current_period_end ?? "",
    trialEnd: row.trial_end ?? "", cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

export const listSubscriptions = (projectId) => listRows("subscriptions", projectId).then((r) => (r ? r.map(normalizeSubscription) : r));
export const createSubscription = (input) => createRow("subscriptions", toRowGeneric(input, SUB_MAP), normalizeSubscription);
export const updateSubscription = (id, input) => updateRow("subscriptions", id, toRowGeneric(input, SUB_MAP), normalizeSubscription);
export const deleteSubscription = (id) => softDeleteRow("subscriptions", id);

/** Shallow-merge keys into a subscription's metadata without clobbering the rest. */
export async function mergeSubscriptionMeta(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data: row, error: readError } = await sb.from("subscriptions").select("metadata").eq("id", id).single();
    if (readError) {
      console.error("[creator.subscriptions.mergeMeta]", readError.message);
      return null;
    }
    return updateRow("subscriptions", id, { metadata: { ...(row?.metadata || {}), ...patch } }, normalizeSubscription);
  } catch (err) {
    console.error("[creator.subscriptions.mergeMeta]", err?.message);
    return null;
  }
}

const PPV_MAP = {
  projectId: "project_id", title: "title", teaserText: "teaser_text",
  assetId: "asset_id", currency: "currency", status: "status",
  publishedAt: "published_at", createdBy: "created_by",
  visibility: "visibility", minTierId: "min_tier_id", body: "body", isPinned: "is_pinned",
  assetIds: "asset_ids", commentCount: "comment_count",
};

export function normalizePpv(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, title: row.title ?? "",
    teaserText: row.teaser_text ?? "", assetId: row.asset_id ?? null,
    priceCents: Number(row.price_cents ?? 0), currency: row.currency ?? "usd",
    status: row.status ?? "draft", unlockCount: Number(row.unlock_count ?? 0),
    revenueCents: Number(row.revenue_cents ?? 0), publishedAt: row.published_at ?? "",
    visibility: row.visibility ?? "ppv", minTierId: row.min_tier_id ?? null,
    body: row.body ?? "", isPinned: Boolean(row.is_pinned),
    assetIds: Array.isArray(row.asset_ids) && row.asset_ids.length ? row.asset_ids : row.asset_id ? [row.asset_id] : [],
    likeCount: Number(row.like_count ?? 0), commentCount: Number(row.comment_count ?? 0),
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

export const listPpvPosts = (projectId) => listRows("ppv_posts", projectId).then((r) => (r ? r.map(normalizePpv) : r));
export const createPpvPost = (input) => createRow("ppv_posts", { ...toRowGeneric(input, PPV_MAP), price_cents: Number(input.priceCents) || 0 }, normalizePpv);
export const updatePpvPost = (id, input) => updateRow("ppv_posts", id, { ...toRowGeneric(input, PPV_MAP), ...(input.priceCents !== undefined ? { price_cents: Number(input.priceCents) || 0 } : {}) }, normalizePpv);
export const deletePpvPost = (id) => softDeleteRow("ppv_posts", id);
export const recordPpvUnlock = (input) => createRow("ppv_unlocks", {
  ...(input.id ? { id: input.id } : {}),
  project_id: input.projectId ?? null, ppv_post_id: input.ppvPostId,
  member_id: input.memberId, price_cents: Number(input.priceCents) || 0,
}, (r) => r);

const MSG_MAP = {
  projectId: "project_id", memberId: "member_id", batchId: "batch_id",
  body: "body", attachmentAssetId: "attachment_asset_id",
  currency: "currency", status: "status", sentAt: "sent_at",
  unlockedAt: "unlocked_at", createdBy: "created_by",
  direction: "direction", readAt: "read_at",
};

export function normalizeMessage(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, memberId: row.member_id ?? null,
    batchId: row.batch_id ?? null, body: row.body ?? "",
    attachmentAssetId: row.attachment_asset_id ?? null,
    priceCents: Number(row.price_cents ?? 0), currency: row.currency ?? "usd",
    status: row.status ?? "locked", sentAt: row.sent_at ?? "",
    unlockedAt: row.unlocked_at ?? "",
    direction: row.direction ?? "outbound", readAt: row.read_at ?? "",
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

export const listPaidMessages = (projectId) => listRows("paid_messages", projectId).then((r) => (r ? r.map(normalizeMessage) : r));
export const createPaidMessage = (input) => createRow("paid_messages", { ...toRowGeneric(input, MSG_MAP), price_cents: Number(input.priceCents) || 0 }, normalizeMessage);
export const updatePaidMessage = (id, input) => updateRow("paid_messages", id, { ...toRowGeneric(input, MSG_MAP), ...(input.priceCents !== undefined ? { price_cents: Number(input.priceCents) || 0 } : {}) }, normalizeMessage);
export const deletePaidMessage = (id) => softDeleteRow("paid_messages", id);

export function normalizeTip(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, memberId: row.member_id ?? null,
    targetType: row.target_type ?? "profile", targetId: row.target_id ?? null,
    amountCents: Number(row.amount_cents ?? 0), currency: row.currency ?? "usd",
    note: row.note ?? "", status: row.status ?? "succeeded",
    createdAt: row.created_at ?? "", ...meta(row),
  };
}

export const listTips = (projectId) => listRows("tips", projectId, "created_at").then((r) => (r ? r.map(normalizeTip) : r));
export const createTip = (input) => createRow("tips", {
  ...(input.id ? { id: input.id } : {}),
  project_id: input.projectId ?? null, member_id: input.memberId ?? null,
  target_type: input.targetType || "profile", target_id: input.targetId ?? null,
  amount_cents: Number(input.amountCents) || 0, currency: input.currency || "usd",
  note: input.note || "", status: input.status || "succeeded",
}, normalizeTip);

const PAYOUT_MAP = {
  projectId: "project_id", periodStart: "period_start", periodEnd: "period_end",
  status: "status", destination: "destination", paidAt: "paid_at", createdBy: "created_by",
};

export function normalizePayout(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, periodStart: row.period_start ?? "",
    periodEnd: row.period_end ?? "", grossCents: Number(row.gross_cents ?? 0),
    feesCents: Number(row.fees_cents ?? 0), netCents: Number(row.net_cents ?? 0),
    status: row.status ?? "pending", destination: row.destination ?? "",
    paidAt: row.paid_at ?? "",
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

export const listPayouts = (projectId) => listRows("payouts", projectId).then((r) => (r ? r.map(normalizePayout) : r));
export const createPayout = (input) => createRow("payouts", {
  ...toRowGeneric(input, PAYOUT_MAP),
  gross_cents: Number(input.grossCents) || 0, fees_cents: Number(input.feesCents) || 0,
  net_cents: Number(input.netCents) || 0,
}, normalizePayout);
export const updatePayout = (id, input) => updateRow("payouts", id, {
  ...toRowGeneric(input, PAYOUT_MAP),
  ...(input.grossCents !== undefined ? { gross_cents: Number(input.grossCents) || 0 } : {}),
  ...(input.feesCents !== undefined ? { fees_cents: Number(input.feesCents) || 0 } : {}),
  ...(input.netCents !== undefined ? { net_cents: Number(input.netCents) || 0 } : {}),
}, normalizePayout);
export const deletePayout = (id) => softDeleteRow("payouts", id);

const PROMO_MAP = {
  projectId: "project_id", code: "code", kind: "kind",
  durationMonths: "duration_months", expiresAt: "expires_at",
  isActive: "is_active", createdBy: "created_by",
};

export function normalizePromo(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, code: row.code ?? "",
    kind: row.kind ?? "discount", percentOff: row.percent_off ?? null,
    amountOffCents: row.amount_off_cents ?? null,
    durationMonths: Number(row.duration_months ?? 1),
    maxRedemptions: row.max_redemptions ?? null,
    redeemedCount: Number(row.redeemed_count ?? 0),
    expiresAt: row.expires_at ?? "", isActive: row.is_active !== false,
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

export const listPromos = (projectId) => listRows("promo_codes", projectId).then((r) => (r ? r.map(normalizePromo) : r));
export const createPromo = (input) => createRow("promo_codes", {
  ...toRowGeneric(input, PROMO_MAP),
  percent_off: input.percentOff ?? null, amount_off_cents: input.amountOffCents ?? null,
  max_redemptions: input.maxRedemptions ?? null, redeemed_count: 0,
}, normalizePromo);
export const updatePromo = (id, input) => updateRow("promo_codes", id, {
  ...toRowGeneric(input, PROMO_MAP),
  ...(input.percentOff !== undefined ? { percent_off: input.percentOff } : {}),
  ...(input.amountOffCents !== undefined ? { amount_off_cents: input.amountOffCents } : {}),
  ...(input.maxRedemptions !== undefined ? { max_redemptions: input.maxRedemptions } : {}),
}, normalizePromo);
export const deletePromo = (id) => softDeleteRow("promo_codes", id);

const ACCESS_MAP = {
  projectId: "project_id", name: "name", targetType: "target_type",
  targetId: "target_id", targetLabel: "target_label", minTierId: "min_tier_id",
  gate: "gate", accessLevel: "access_level", allowDownload: "allow_download",
  bypassWatermark: "bypass_watermark", showMetadata: "show_metadata",
  welcomeMessage: "welcome_message", isActive: "is_active", createdBy: "created_by",
};

export function normalizeAccessRule(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, name: row.name ?? "",
    targetType: row.target_type ?? "collection", targetId: row.target_id ?? null,
    targetLabel: row.target_label ?? "", minTierId: row.min_tier_id ?? null,
    gate: row.gate ?? "login", accessLevel: row.access_level ?? "standard",
    allowDownload: row.allow_download !== false, bypassWatermark: Boolean(row.bypass_watermark),
    showMetadata: row.show_metadata !== false, welcomeMessage: row.welcome_message ?? "",
    isActive: row.is_active !== false,
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

export const listAccessRules = (projectId) => listRows("access_rules", projectId).then((r) => (r ? r.map(normalizeAccessRule) : r));
export const createAccessRule = (input) => createRow("access_rules", toRowGeneric(input, ACCESS_MAP), normalizeAccessRule);
export const updateAccessRule = (id, input) => updateRow("access_rules", id, toRowGeneric(input, ACCESS_MAP), normalizeAccessRule);
export const deleteAccessRule = (id) => softDeleteRow("access_rules", id);

const INVOICE_MAP = {
  projectId: "project_id", number: "number", memberId: "member_id",
  subscriptionId: "subscription_id", tierId: "tier_id", currency: "currency",
  status: "status", periodStart: "period_start", periodEnd: "period_end",
  dueAt: "due_at", paidAt: "paid_at", nextRetryAt: "next_retry_at", createdBy: "created_by",
};

export function normalizeInvoice(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, number: row.number ?? "",
    memberId: row.member_id ?? null, subscriptionId: row.subscription_id ?? null,
    tierId: row.tier_id ?? null, amountCents: Number(row.amount_cents ?? 0),
    currency: row.currency ?? "usd", status: row.status ?? "open",
    periodStart: row.period_start ?? "", periodEnd: row.period_end ?? "",
    dueAt: row.due_at ?? "", paidAt: row.paid_at ?? "",
    attemptCount: Number(row.attempt_count ?? 0), nextRetryAt: row.next_retry_at ?? "",
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

export const listInvoices = (projectId) => listRows("billing_invoices", projectId, "created_at").then((r) => (r ? r.map(normalizeInvoice) : r));
export const createInvoice = (input) => createRow("billing_invoices", toRowGeneric(input, INVOICE_MAP, ["amountCents", "attemptCount"]), normalizeInvoice);
export const updateInvoice = (id, input) => updateRow("billing_invoices", id, toRowGeneric(input, INVOICE_MAP, ["amountCents", "attemptCount"]), normalizeInvoice);
export const deleteInvoice = (id) => softDeleteRow("billing_invoices", id);

export const listMessageUnlocks = (projectId) => listRows("message_unlocks", projectId, "unlocked_at");

const PROFILE_MAP = {
  projectId: "project_id", handle: "handle", displayName: "display_name",
  tagline: "tagline", bio: "bio", avatarAssetId: "avatar_asset_id",
  bannerAssetId: "banner_asset_id", accentColor: "accent_color", links: "links",
  isPublished: "is_published", tipsEnabled: "tips_enabled", minTipCents: "min_tip_cents",
  suggestedTips: "suggested_tips", messagesEnabled: "messages_enabled",
  welcomeMessage: "welcome_message", createdBy: "created_by",
  pageDraft: "page_draft", pageConfig: "page_config", pagePublishedAt: "page_published_at",
};

export function normalizeCreatorProfile(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, handle: String(row.handle ?? ""),
    displayName: row.display_name ?? "", tagline: row.tagline ?? "", bio: row.bio ?? "",
    avatarAssetId: row.avatar_asset_id ?? null, bannerAssetId: row.banner_asset_id ?? null,
    accentColor: row.accent_color || "#f97316",
    links: Array.isArray(row.links) ? row.links : [],
    isPublished: Boolean(row.is_published), tipsEnabled: row.tips_enabled !== false,
    minTipCents: Number(row.min_tip_cents ?? 100),
    suggestedTips: Array.isArray(row.suggested_tips) ? row.suggested_tips.map(Number) : [],
    messagesEnabled: row.messages_enabled !== false, welcomeMessage: row.welcome_message ?? "",
    // The page builder's layout documents (lib/creator/page_config.js): the
    // working draft and the live copy. null = never saved / never published.
    pageDraft: row.page_draft ?? null, pageConfig: row.page_config ?? null,
    pagePublishedAt: row.page_published_at ?? null,
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

// One profile per project. null = not configured or failed; undefined never.
export async function getCreatorProfile(projectId) {
  const rows = await listRows("creator_profiles", projectId);
  if (rows === null) return null;
  return rows.length ? normalizeCreatorProfile(rows[0]) : { missing: true };
}

export const createCreatorProfile = (input) => createRow("creator_profiles", toRowGeneric(input, PROFILE_MAP), normalizeCreatorProfile);
export const updateCreatorProfile = (id, input) => updateRow("creator_profiles", id, toRowGeneric(input, PROFILE_MAP), normalizeCreatorProfile);

/** Publish a page layout: it becomes both the live copy and the draft, and the page goes live. */
export const publishCreatorPage = (id, input, config) =>
  updateCreatorProfile(id, { ...input, pageDraft: config, pageConfig: config, pagePublishedAt: new Date().toISOString(), isPublished: true });

// Handles are unique across every project; true when `handle` is free (or ours).
export async function isHandleAvailable(handle, profileId) {
  if (!isSupabaseConfigured()) return true;
  try {
    const { data, error } = await assetsClient()
      .from("creator_profiles").select("id").eq("handle", handle).is("deleted_at", null);
    if (error) return true;
    return !(data || []).some((row) => row.id !== profileId);
  } catch {
    return true;
  }
}

const BUNDLE_MAP = {
  projectId: "project_id", title: "title", description: "description",
  currency: "currency", postIds: "post_ids", coverAssetId: "cover_asset_id",
  isActive: "is_active", createdBy: "created_by",
};

export function normalizeBundle(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, title: row.title ?? "",
    description: row.description ?? "", priceCents: Number(row.price_cents ?? 0),
    currency: row.currency ?? "usd", postIds: Array.isArray(row.post_ids) ? row.post_ids : [],
    coverAssetId: row.cover_asset_id ?? null, isActive: row.is_active !== false,
    salesCount: Number(row.sales_count ?? 0), revenueCents: Number(row.revenue_cents ?? 0),
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

export const listBundles = (projectId) => listRows("post_bundles", projectId).then((r) => (r ? r.map(normalizeBundle) : r));
export const createBundle = (input) => createRow("post_bundles", toRowGeneric(input, BUNDLE_MAP, ["priceCents"]), normalizeBundle);
export const updateBundle = (id, input) => updateRow("post_bundles", id, toRowGeneric(input, BUNDLE_MAP, ["priceCents"]), normalizeBundle);
export const deleteBundle = (id) => softDeleteRow("post_bundles", id);

export function normalizeComment(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, postId: row.post_id,
    memberId: row.member_id ?? null, authorName: row.author_name ?? "",
    isCreator: Boolean(row.is_creator), body: row.body ?? "",
    isHidden: Boolean(row.is_hidden), createdAt: row.created_at ?? "",
  };
}

// Every comment on one post, hidden ones included (moderation view).
export async function listPostComments(postId) {
  if (!postId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient()
      .from("post_comments").select("*").eq("post_id", postId).is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[creator.post_comments.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeComment);
  } catch (err) {
    console.error("[creator.post_comments.list]", err?.message);
    return null;
  }
}

export const createPostComment = (input) => createRow("post_comments", {
  ...(input.id ? { id: input.id } : {}),
  project_id: input.projectId, post_id: input.postId, author_name: input.authorName || "",
  is_creator: Boolean(input.isCreator), body: input.body || "",
}, normalizeComment);
export const setCommentHidden = (id, hidden) => updateRow("post_comments", id, { is_hidden: hidden }, normalizeComment);
export const deletePostComment = (id) => softDeleteRow("post_comments", id);
