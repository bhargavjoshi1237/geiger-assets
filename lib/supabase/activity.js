"use client";

// Owns assets.activity_events — the append-only project feed.
//
// Every other collaboration module calls logActivity() after a notable write.
// Logging is best-effort by design: a failed feed insert must never fail or
// roll back the action that produced it, so this module swallows its errors
// after reporting them.
//
// DB is snake_case, the UI is camelCase — mapped here at the boundary.

import { assetsClient, isSupabaseConfigured, isUuid } from "@/supabase/components/assets-client";

const TABLE = "activity_events";

export function normalizeActivity(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    verb: row.verb ?? "",
    summary: row.summary ?? "",
    subjectType: row.subject_type ?? "",
    subjectId: row.subject_id ?? null,
    subjectLabel: row.subject_label ?? "",
    actorId: row.actor_id ?? null,
    actorName: row.actor_name ?? "",
    createdAt: row.created_at ?? null,
    ...meta,
  };
}

export async function listActivity(projectId, limit = 200) {
  if (!isSupabaseConfigured()) return null;
  if (projectId && !isUuid(projectId)) return [];
  try {
    const sb = assetsClient();
    let q = sb.from(TABLE).select("*");
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[activity.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeActivity);
  } catch (e) {
    console.error("[activity.list]", e);
    return null;
  }
}

/** Activity for one subject — powers the per-asset/per-review timeline. */
export async function listActivityForSubject(subjectType, subjectId, limit = 50) {
  if (!subjectType || !subjectId || !isSupabaseConfigured()) return null;
  if (!isUuid(subjectId)) return [];
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("subject_type", subjectType)
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[activity.listForSubject]", error.message);
      return null;
    }
    return (data || []).map(normalizeActivity);
  } catch (e) {
    console.error("[activity.listForSubject]", e);
    return null;
  }
}

/**
 * Append one event. Best-effort — never throws, and a failure here is logged
 * but not surfaced, so it can't break the write that triggered it.
 */
export async function logActivity({
  projectId,
  verb,
  summary = "",
  subjectType = "",
  subjectId = null,
  subjectLabel = "",
  actorId = null,
  actorName = "",
  metadata = {},
} = {}) {
  if (!verb || !isSupabaseConfigured()) return false;
  if (projectId && !isUuid(projectId)) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb.from(TABLE).insert({
      project_id: projectId || null,
      verb,
      summary,
      subject_type: subjectType,
      subject_id: subjectId && isUuid(subjectId) ? subjectId : null,
      subject_label: subjectLabel,
      actor_id: actorId,
      actor_name: actorName,
      metadata,
    });
    if (error) {
      console.error("[activity.log]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[activity.log]", e);
    return false;
  }
}
