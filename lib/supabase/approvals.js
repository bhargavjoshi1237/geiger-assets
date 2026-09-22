"use client";

// Owns the approval domain — four tables and the routing engine that walks
// between them:
//
//   assets.approval_pipelines    reusable routing (ordered stages per subject type)
//   assets.approval_reviews      one review in flight, pinned to a stage index
//   assets.approval_review_items the things being reviewed, each with its own decision
//   assets.approval_decisions    append-only sign-off log ("approval history")
//
// A pipeline's `stages` array is the canonical logic. A review copies it into
// `stage_snapshot` at creation time, so editing a pipeline never rewrites the
// rules a review in flight is already being judged by.
//
// submitStageDecision() is the engine: it records a decision, re-counts the
// current stage, and either advances, finalizes, or halts the review. Final
// approval triggers the three side effects the pipeline opts into — stamping
// the asset's status, locking the approved version, and logging activity.
//
// DB is snake_case, the UI is camelCase — mapped here at the boundary.

import { assetsClient, isSupabaseConfigured, isUuid } from "@/supabase/components/assets-client";
import { logActivity } from "./activity";

const PIPELINES = "approval_pipelines";
const REVIEWS = "approval_reviews";
const ITEMS = "approval_review_items";
const DECISIONS = "approval_decisions";
const ASSETS = "assets";
const VERSIONS = "asset_versions";

// ---------------------------------------------------------------------------
// Pipelines
// ---------------------------------------------------------------------------

export function normalizePipeline(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    description: row.description ?? "",
    subjectType: row.subject_type ?? "asset",
    status: row.status ?? "Draft",
    mode: row.mode ?? "sequential",
    isDefault: Boolean(row.is_default),
    stages: Array.isArray(row.stages) ? row.stages : [],
    autoLockVersion: row.auto_lock_version !== false,
    autoStampStatus: row.auto_stamp_status !== false,
    reviewCount: Number(row.review_count ?? 0),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    ...meta,
  };
}

function toPipelineRow(input) {
  const row = {};
  const map = {
    name: "name",
    description: "description",
    subjectType: "subject_type",
    status: "status",
    mode: "mode",
    projectId: "project_id",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("isDefault" in input) row.is_default = Boolean(input.isDefault);
  if ("stages" in input) row.stages = Array.isArray(input.stages) ? input.stages : [];
  if ("autoLockVersion" in input) row.auto_lock_version = Boolean(input.autoLockVersion);
  if ("autoStampStatus" in input) row.auto_stamp_status = Boolean(input.autoStampStatus);
  if ("reviewCount" in input) row.review_count = Number(input.reviewCount) || 0;
  return row;
}

export async function listPipelines(projectId) {
  if (!isSupabaseConfigured()) return null;
  if (projectId && !isUuid(projectId)) return [];
  try {
    const sb = assetsClient();
    let q = sb.from(PIPELINES).select("*").is("deleted_at", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) {
      console.error("[approvals.listPipelines]", error.message);
      return null;
    }
    return (data || []).map(normalizePipeline);
  } catch (e) {
    console.error("[approvals.listPipelines]", e);
    return null;
  }
}

export async function getPipeline(id) {
  if (!id || !isSupabaseConfigured() || !isUuid(id)) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(PIPELINES)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error("[approvals.getPipeline]", error.message);
      return null;
    }
    return normalizePipeline(data);
  } catch (e) {
    console.error("[approvals.getPipeline]", e);
    return null;
  }
}

export async function createPipeline(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = toPipelineRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(PIPELINES).insert(payload).select("*").single();
    if (error) {
      console.error("[approvals.createPipeline]", error.message);
      return null;
    }
    return normalizePipeline(data);
  } catch (e) {
    console.error("[approvals.createPipeline]", e);
    return null;
  }
}

export async function updatePipeline(id, patch) {
  if (!id || !isSupabaseConfigured() || !isUuid(id)) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(PIPELINES)
      .update(toPipelineRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[approvals.updatePipeline]", error.message);
      return null;
    }
    return normalizePipeline(data);
  } catch (e) {
    console.error("[approvals.updatePipeline]", e);
    return null;
  }
}

export async function softDeletePipeline(id) {
  if (!id || !isSupabaseConfigured() || !isUuid(id)) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(PIPELINES)
      .update({ deleted_at: new Date().toISOString(), is_default: false })
      .eq("id", id);
    if (error) {
      console.error("[approvals.deletePipeline]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[approvals.deletePipeline]", e);
    return false;
  }
}

/**
 * Make one pipeline the default for its subject type. A partial unique index
 * allows only one default per (project, subject_type), so the previous holder
 * must be cleared first.
 */
export async function setDefaultPipeline(id, projectId, subjectType) {
  if (!id || !isSupabaseConfigured() || !isUuid(id)) return null;
  try {
    const sb = assetsClient();
    let clear = sb
      .from(PIPELINES)
      .update({ is_default: false })
      .eq("subject_type", subjectType)
      .eq("is_default", true)
      .is("deleted_at", null);
    if (projectId && isUuid(projectId)) clear = clear.eq("project_id", projectId);
    const { error: clearError } = await clear;
    if (clearError) {
      console.error("[approvals.setDefaultPipeline]", clearError.message);
      return null;
    }
    return updatePipeline(id, { isDefault: true });
  } catch (e) {
    console.error("[approvals.setDefaultPipeline]", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export function normalizeReview(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    pipelineId: row.pipeline_id ?? null,
    name: row.name ?? "",
    description: row.description ?? "",
    subjectType: row.subject_type ?? "asset",
    subjectId: row.subject_id ?? null,
    status: row.status ?? "Pending",
    priority: row.priority ?? "Normal",
    currentStage: Number(row.current_stage ?? 0),
    stages: Array.isArray(row.stage_snapshot) ? row.stage_snapshot : [],
    dueAt: row.due_at ?? null,
    completedAt: row.completed_at ?? null,
    requestedBy: row.requested_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    itemCount: Number(row.item_count ?? meta.itemCount ?? 0),
    ...meta,
  };
}

function toReviewRow(input) {
  const row = {};
  const map = {
    name: "name",
    description: "description",
    subjectType: "subject_type",
    status: "status",
    priority: "priority",
    projectId: "project_id",
    pipelineId: "pipeline_id",
    requestedBy: "requested_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("subjectId" in input) row.subject_id = input.subjectId || null;
  if ("dueAt" in input) row.due_at = input.dueAt || null;
  if ("completedAt" in input) row.completed_at = input.completedAt || null;
  if ("currentStage" in input) row.current_stage = Number(input.currentStage) || 0;
  if ("stages" in input) {
    row.stage_snapshot = Array.isArray(input.stages) ? input.stages : [];
  }
  return row;
}

export async function listReviews(projectId) {
  if (!isSupabaseConfigured()) return null;
  if (projectId && !isUuid(projectId)) return [];
  try {
    const sb = assetsClient();
    let q = sb
      .from(REVIEWS)
      .select("*, approval_review_items(count)")
      .is("deleted_at", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) {
      console.error("[approvals.listReviews]", error.message);
      return null;
    }
    return (data || []).map((row) =>
      normalizeReview({
        ...row,
        item_count: row.approval_review_items?.[0]?.count ?? 0,
      }),
    );
  } catch (e) {
    console.error("[approvals.listReviews]", e);
    return null;
  }
}

export async function getReview(id) {
  if (!id || !isSupabaseConfigured() || !isUuid(id)) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(REVIEWS)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error("[approvals.getReview]", error.message);
      return null;
    }
    return normalizeReview(data);
  } catch (e) {
    console.error("[approvals.getReview]", e);
    return null;
  }
}

/**
 * Create a review and its items in one go. `items` is an array of
 * `{ id?, assetId, label }`. The pipeline's stages are snapshotted onto the
 * review so a later pipeline edit can't move the goalposts mid-review.
 */
export async function createReview(input, items = []) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = toReviewRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(REVIEWS).insert(payload).select("*").single();
    if (error) {
      console.error("[approvals.createReview]", error.message);
      return null;
    }
    const review = normalizeReview(data);

    if (items.length) {
      const rows = items.map((item, index) => ({
        id: item.id && isUuid(item.id) ? item.id : undefined,
        review_id: review.id,
        asset_id: item.assetId && isUuid(item.assetId) ? item.assetId : null,
        subject_type: item.subjectType || review.subjectType,
        subject_id: item.subjectId && isUuid(item.subjectId) ? item.subjectId : null,
        label: item.label || "",
        position: index,
      }));
      const { error: itemsError } = await sb.from(ITEMS).insert(rows);
      if (itemsError) {
        console.error("[approvals.createReview.items]", itemsError.message);
      }
    }

    logActivity({
      projectId: review.projectId,
      verb: "review.requested",
      subjectType: review.subjectType,
      subjectId: review.subjectId,
      subjectLabel: review.name,
      actorId: review.requestedBy,
      actorName: input.actorName || "",
      summary: review.name,
      metadata: { reviewId: review.id, itemCount: items.length },
    });

    return { ...review, itemCount: items.length };
  } catch (e) {
    console.error("[approvals.createReview]", e);
    return null;
  }
}

export async function updateReview(id, patch) {
  if (!id || !isSupabaseConfigured() || !isUuid(id)) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(REVIEWS)
      .update(toReviewRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[approvals.updateReview]", error.message);
      return null;
    }
    return normalizeReview(data);
  } catch (e) {
    console.error("[approvals.updateReview]", e);
    return null;
  }
}

export async function softDeleteReview(id) {
  if (!id || !isSupabaseConfigured() || !isUuid(id)) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(REVIEWS)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[approvals.deleteReview]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[approvals.deleteReview]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Review items
// ---------------------------------------------------------------------------

export function normalizeReviewItem(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const asset = row.assets || null;
  return {
    id: row.id,
    reviewId: row.review_id,
    assetId: row.asset_id ?? null,
    subjectType: row.subject_type ?? "asset",
    subjectId: row.subject_id ?? null,
    label: row.label || asset?.name || "",
    decision: row.decision ?? "pending",
    note: row.note ?? "",
    decidedBy: row.decided_by ?? null,
    decidedAt: row.decided_at ?? null,
    position: Number(row.position ?? 0),
    assetName: asset?.name ?? "",
    assetType: asset?.type ?? "",
    thumbnailUrl: asset?.thumbnail_url ?? "",
    assetColor: asset?.color ?? "",
    ...meta,
  };
}

export async function listReviewItems(reviewId) {
  if (!reviewId || !isSupabaseConfigured() || !isUuid(reviewId)) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(ITEMS)
      .select("*, assets(name, type, thumbnail_url, color)")
      .eq("review_id", reviewId)
      .order("position", { ascending: true });
    if (error) {
      console.error("[approvals.listItems]", error.message);
      return null;
    }
    return (data || []).map(normalizeReviewItem);
  } catch (e) {
    console.error("[approvals.listItems]", e);
    return null;
  }
}

export async function setItemDecision(itemId, decision, { note = "", actorId = null } = {}) {
  if (!itemId || !isSupabaseConfigured() || !isUuid(itemId)) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(ITEMS)
      .update({
        decision,
        note,
        decided_by: actorId,
        decided_at: decision === "pending" ? null : new Date().toISOString(),
      })
      .eq("id", itemId)
      .select("*, assets(name, type, thumbnail_url, color)")
      .single();
    if (error) {
      console.error("[approvals.setItemDecision]", error.message);
      return null;
    }
    return normalizeReviewItem(data);
  } catch (e) {
    console.error("[approvals.setItemDecision]", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Decision log
// ---------------------------------------------------------------------------

export function normalizeDecision(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    reviewId: row.review_id,
    stageIndex: Number(row.stage_index ?? 0),
    stageName: row.stage_name ?? "",
    decision: row.decision ?? "approved",
    note: row.note ?? "",
    actorId: row.actor_id ?? null,
    actorName: row.actor_name ?? "",
    createdAt: row.created_at ?? null,
    ...meta,
  };
}

export async function listDecisions(reviewId) {
  if (!reviewId || !isSupabaseConfigured() || !isUuid(reviewId)) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(DECISIONS)
      .select("*")
      .eq("review_id", reviewId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[approvals.listDecisions]", error.message);
      return null;
    }
    return (data || []).map(normalizeDecision);
  } catch (e) {
    console.error("[approvals.listDecisions]", e);
    return null;
  }
}

async function recordDecision(sb, { reviewId, stageIndex, stageName, decision, note, actor }) {
  const { data, error } = await sb
    .from(DECISIONS)
    .insert({
      review_id: reviewId,
      stage_index: stageIndex,
      stage_name: stageName,
      decision,
      note,
      actor_id: actor?.id || null,
      actor_name: actor?.name || "",
    })
    .select("*")
    .single();
  if (error) {
    console.error("[approvals.recordDecision]", error.message);
    return null;
  }
  return normalizeDecision(data);
}

// ---------------------------------------------------------------------------
// Final-approval side effects
// ---------------------------------------------------------------------------

/** Stamp `approved` onto every asset the review covered. */
async function stampAssetStatus(sb, assetIds) {
  if (!assetIds.length) return;
  const { error } = await sb.from(ASSETS).update({ status: "approved" }).in("id", assetIds);
  if (error) console.error("[approvals.stampAssetStatus]", error.message);
}

/** Lock the current version of each approved asset so it can't be replaced. */
async function lockApprovedVersions(sb, assetIds, reviewId, actorId) {
  if (!assetIds.length) return;
  const { error } = await sb
    .from(VERSIONS)
    .update({
      is_locked: true,
      approved_at: new Date().toISOString(),
      approved_by: actorId,
      review_id: reviewId,
    })
    .in("asset_id", assetIds)
    .eq("is_current", true);
  if (error) console.error("[approvals.lockApprovedVersions]", error.message);
}

// ---------------------------------------------------------------------------
// The routing engine
// ---------------------------------------------------------------------------

/**
 * Record one approver's decision on the review's current stage and move the
 * review to wherever that decision leaves it.
 *
 *   rejected  → the review stops at Rejected.
 *   changes   → the review halts at Changes Requested, stage index unchanged,
 *               so a re-submission resumes from the same stage.
 *   approved  → counted against the stage's minApprovals. Once met, the review
 *               advances to the next stage, or finalizes as Approved if this
 *               was the last one.
 *
 * Returns `{ review, decision, finalized }`, or null if the write failed.
 */
export async function submitStageDecision(review, decision, { note = "", actor = {}, pipeline = null } = {}) {
  if (!review?.id || !isSupabaseConfigured() || !isUuid(review.id)) return null;
  try {
    const sb = assetsClient();
    const stages = Array.isArray(review.stages) ? review.stages : [];
    const stageIndex = Math.min(review.currentStage || 0, Math.max(0, stages.length - 1));
    const stage = stages[stageIndex] || { name: "Review", minApprovals: 1 };

    const logged = await recordDecision(sb, {
      reviewId: review.id,
      stageIndex,
      stageName: stage.name || `Stage ${stageIndex + 1}`,
      decision,
      note,
      actor,
    });
    if (!logged) return null;

    let patch = null;
    let finalized = false;

    if (decision === "rejected") {
      patch = { status: "Rejected", completedAt: new Date().toISOString() };
    } else if (decision === "changes") {
      patch = { status: "Changes Requested" };
    } else if (decision === "approved") {
      // Re-count this stage from the log so concurrent approvals converge.
      const { data: stageRows, error: countError } = await sb
        .from(DECISIONS)
        .select("id")
        .eq("review_id", review.id)
        .eq("stage_index", stageIndex)
        .eq("decision", "approved");
      if (countError) {
        console.error("[approvals.submitStageDecision]", countError.message);
        return null;
      }
      const given = (stageRows || []).length;
      const required = Math.max(1, Number(stage.minApprovals) || 1);

      if (given < required) {
        patch = { status: "In Review" };
      } else if (stageIndex + 1 < stages.length) {
        patch = { status: "In Review", currentStage: stageIndex + 1 };
      } else {
        patch = { status: "Approved", completedAt: new Date().toISOString() };
        finalized = true;
      }
    } else {
      patch = { status: "In Review" };
    }

    const updated = await updateReview(review.id, patch);
    if (!updated) return null;

    if (finalized) {
      const items = (await listReviewItems(review.id)) || [];
      const assetIds = items.map((i) => i.assetId).filter(Boolean);
      if (pipeline?.autoStampStatus !== false) await stampAssetStatus(sb, assetIds);
      if (pipeline?.autoLockVersion !== false) {
        await lockApprovedVersions(sb, assetIds, review.id, actor.id || null);
      }
    }

    const verb =
      decision === "approved"
        ? finalized
          ? "review.approved"
          : "review.advanced"
        : decision === "rejected"
          ? "review.rejected"
          : "review.changes";

    logActivity({
      projectId: review.projectId,
      verb,
      subjectType: review.subjectType,
      subjectId: review.subjectId,
      subjectLabel: review.name,
      actorId: actor.id || null,
      actorName: actor.name || "",
      summary: review.name,
      metadata: { reviewId: review.id, stageIndex, stageName: stage.name },
    });

    return { review: { ...updated, itemCount: review.itemCount }, decision: logged, finalized };
  } catch (e) {
    console.error("[approvals.submitStageDecision]", e);
    return null;
  }
}

/** Send a halted review back to its current stage for another look. */
export async function reopenReview(review, { actor = {} } = {}) {
  if (!review?.id || !isSupabaseConfigured() || !isUuid(review.id)) return null;
  try {
    const sb = assetsClient();
    await recordDecision(sb, {
      reviewId: review.id,
      stageIndex: review.currentStage || 0,
      stageName: review.stages?.[review.currentStage]?.name || "",
      decision: "reopened",
      note: "",
      actor,
    });
    return updateReview(review.id, { status: "In Review", completedAt: null });
  } catch (e) {
    console.error("[approvals.reopenReview]", e);
    return null;
  }
}
