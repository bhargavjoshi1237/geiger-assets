"use client";

// Owns assets.comments — threaded feedback, optionally pinned to a spot on the
// asset it's about.
//
// A thread is a root comment (parent_id null) plus its replies. `anchor`
// carries the pin when there is one: { x, y } as 0–1 fractions for images,
// { t } in seconds for video/audio, { page, x, y } for documents. A null
// anchor is a plain thread comment with no visual position.
//
// listThreads() returns roots with their replies nested, which is what the
// Comments tab renders — one query, no N+1.
//
// DB is snake_case, the UI is camelCase — mapped here at the boundary.

import { assetsClient, isSupabaseConfigured, isUuid } from "@/supabase/components/assets-client";
import { logActivity } from "./activity";

const TABLE = "comments";

export function normalizeComment(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const asset = row.assets || null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    parentId: row.parent_id ?? null,
    subjectType: row.subject_type ?? "asset",
    subjectId: row.subject_id ?? null,
    assetId: row.asset_id ?? null,
    reviewId: row.review_id ?? null,
    body: row.body ?? "",
    anchor: row.anchor && typeof row.anchor === "object" ? row.anchor : null,
    mentions: Array.isArray(row.mentions) ? row.mentions : [],
    status: row.status ?? "open",
    authorId: row.author_id ?? null,
    authorName: row.author_name ?? "",
    resolvedBy: row.resolved_by ?? null,
    resolvedAt: row.resolved_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    assetName: asset?.name ?? "",
    assetType: asset?.type ?? "",
    thumbnailUrl: asset?.thumbnail_url ?? "",
    assetColor: asset?.color ?? "",
    replies: [],
    ...meta,
  };
}

function toRow(input) {
  const row = {};
  const map = {
    body: "body",
    status: "status",
    subjectType: "subject_type",
    projectId: "project_id",
    authorId: "author_id",
    authorName: "author_name",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("parentId" in input) row.parent_id = input.parentId || null;
  if ("subjectId" in input) row.subject_id = input.subjectId || null;
  if ("assetId" in input) row.asset_id = input.assetId || null;
  if ("reviewId" in input) row.review_id = input.reviewId || null;
  if ("anchor" in input) {
    row.anchor = input.anchor && typeof input.anchor === "object" ? input.anchor : null;
  }
  if ("mentions" in input) {
    row.mentions = Array.isArray(input.mentions) ? input.mentions : [];
  }
  if ("resolvedBy" in input) row.resolved_by = input.resolvedBy || null;
  if ("resolvedAt" in input) row.resolved_at = input.resolvedAt || null;
  return row;
}

/** Nest replies under their root, newest thread first, oldest reply first. */
function buildThreads(rows) {
  const byId = new Map();
  const roots = [];
  for (const row of rows) {
    byId.set(row.id, row);
    if (!row.parentId) roots.push(row);
  }
  for (const row of rows) {
    if (!row.parentId) continue;
    const parent = byId.get(row.parentId);
    if (parent) parent.replies.push(row);
  }
  for (const root of roots) {
    root.replies.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }
  return roots;
}

export async function listThreads(projectId, limit = 300) {
  if (!isSupabaseConfigured()) return null;
  if (projectId && !isUuid(projectId)) return [];
  try {
    const sb = assetsClient();
    let q = sb
      .from(TABLE)
      .select("*, assets(name, type, thumbnail_url, color)")
      .is("deleted_at", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[comments.listThreads]", error.message);
      return null;
    }
    return buildThreads((data || []).map(normalizeComment));
  } catch (e) {
    console.error("[comments.listThreads]", e);
    return null;
  }
}

/** Threads on one asset — for the asset detail comment panel. */
export async function listThreadsForAsset(assetId) {
  if (!assetId || !isSupabaseConfigured() || !isUuid(assetId)) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("asset_id", assetId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[comments.listForAsset]", error.message);
      return null;
    }
    return buildThreads((data || []).map(normalizeComment));
  } catch (e) {
    console.error("[comments.listForAsset]", e);
    return null;
  }
}

/** Threads attached to one review — the review editor's Comments tab. */
export async function listThreadsForReview(reviewId) {
  if (!reviewId || !isSupabaseConfigured() || !isUuid(reviewId)) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("review_id", reviewId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[comments.listForReview]", error.message);
      return null;
    }
    return buildThreads((data || []).map(normalizeComment));
  } catch (e) {
    console.error("[comments.listForReview]", e);
    return null;
  }
}

export async function createComment(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = toRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(TABLE)
      .insert(payload)
      .select("*, assets(name, type, thumbnail_url, color)")
      .single();
    if (error) {
      console.error("[comments.create]", error.message);
      return null;
    }
    const comment = normalizeComment(data);
    // Only a new thread is feed-worthy; replies would drown the activity tab.
    if (!comment.parentId) {
      logActivity({
        projectId: comment.projectId,
        verb: "comment.posted",
        subjectType: comment.subjectType,
        subjectId: comment.assetId || comment.subjectId,
        subjectLabel: comment.assetName || input.subjectLabel || "",
        actorId: comment.authorId,
        actorName: comment.authorName,
        summary: comment.body.slice(0, 140),
        metadata: { commentId: comment.id },
      });
    }
    return comment;
  } catch (e) {
    console.error("[comments.create]", e);
    return null;
  }
}

export async function updateComment(id, patch) {
  if (!id || !isSupabaseConfigured() || !isUuid(id)) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(toRow(patch))
      .eq("id", id)
      .select("*, assets(name, type, thumbnail_url, color)")
      .single();
    if (error) {
      console.error("[comments.update]", error.message);
      return null;
    }
    return normalizeComment(data);
  } catch (e) {
    console.error("[comments.update]", e);
    return null;
  }
}

export async function resolveThread(id, { actorId = null, actorName = "", resolved = true } = {}) {
  const updated = await updateComment(id, {
    status: resolved ? "resolved" : "open",
    resolvedBy: resolved ? actorId : null,
    resolvedAt: resolved ? new Date().toISOString() : null,
  });
  if (updated && resolved) {
    logActivity({
      projectId: updated.projectId,
      verb: "comment.resolved",
      subjectType: updated.subjectType,
      subjectId: updated.assetId || updated.subjectId,
      subjectLabel: updated.assetName,
      actorId,
      actorName,
      summary: updated.body.slice(0, 140),
      metadata: { commentId: updated.id },
    });
  }
  return updated;
}

export async function softDeleteComment(id) {
  if (!id || !isSupabaseConfigured() || !isUuid(id)) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[comments.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[comments.delete]", e);
    return false;
  }
}
