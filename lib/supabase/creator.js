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
  return row;
}

async function listRows(table, projectId, order = "updated_at") {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    let q = sb.from(table).select("*");
    if (table !== "ppv_unlocks" && table !== "tips" && table !== "promo_redemptions") {
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
  if (!isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { data, error } = await sb.from(table).update(patch).eq("id", id).select("*").single();
    if (error) {
      console.error(`[creator.${table}.update]`, error.message);
      return false;
    }
    return normalize ? normalize(data) : true;
  } catch (err) {
    console.error(`[creator.${table}.update]`, err?.message);
    return false;
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
export const updateTier = (id, input) => updateRow("membership_tiers", id, { ...toRowGeneric(input, TIER_MAP), ...(input.priceCents !== undefined ? { price_cents: Number(input.priceCents) || 0 } : {}), ...(input.perks !== undefined ? { perks: input.perks } : {}) }, normalizeTier);
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

const PPV_MAP = {
  projectId: "project_id", title: "title", teaserText: "teaser_text",
  assetId: "asset_id", currency: "currency", status: "status",
  publishedAt: "published_at", createdBy: "created_by",
};

export function normalizePpv(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id ?? null, title: row.title ?? "",
    teaserText: row.teaser_text ?? "", assetId: row.asset_id ?? null,
    priceCents: Number(row.price_cents ?? 0), currency: row.currency ?? "usd",
    status: row.status ?? "draft", unlockCount: Number(row.unlock_count ?? 0),
    revenueCents: Number(row.revenue_cents ?? 0), publishedAt: row.published_at ?? "",
    createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "", ...meta(row),
  };
}

export const listPpvPosts = (projectId) => listRows("ppv_posts", projectId).then((r) => (r ? r.map(normalizePpv) : r));
export const createPpvPost = (input) => createRow("ppv_posts", { ...toRowGeneric(input, PPV_MAP), price_cents: Number(input.priceCents) || 0 }, normalizePpv);
export const updatePpvPost = (id, input) => updateRow("ppv_posts", id, { ...toRowGeneric(input, PPV_MAP), ...(input.priceCents !== undefined ? { price_cents: Number(input.priceCents) || 0 } : {}) }, normalizePpv);
export const deletePpvPost = (id) => softDeleteRow("ppv_posts", id);
export const recordPpvUnlock = (input) => createRow("ppv_unlocks", {
  project_id: input.projectId ?? null, ppv_post_id: input.ppvPostId,
  member_id: input.memberId, price_cents: Number(input.priceCents) || 0,
}, (r) => r);

const MSG_MAP = {
  projectId: "project_id", memberId: "member_id", batchId: "batch_id",
  body: "body", attachmentAssetId: "attachment_asset_id",
  currency: "currency", status: "status", sentAt: "sent_at",
  unlockedAt: "unlocked_at", createdBy: "created_by",
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
