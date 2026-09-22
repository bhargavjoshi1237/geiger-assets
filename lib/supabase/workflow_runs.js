"use client";

import { assetsClient, isSupabaseConfigured, isUuid } from "@/supabase/components/assets-client";

const TABLE = "workflow_runs";


export function normalizeRun(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    workflowId: row.workflow_id ?? null,
    projectId: row.project_id ?? null,
    trigger: row.trigger ?? "",
    status: row.status ?? "Success",
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
    durationMs: Number(row.duration_ms ?? 0),
    stepsTotal: Number(row.steps_total ?? 0),
    stepsCompleted: Number(row.steps_completed ?? 0),
    error: row.error ?? "",
    context:
      row.context && typeof row.context === "object" && !Array.isArray(row.context)
        ? row.context
        : {},
    stepsLog: Array.isArray(row.steps_log) ? row.steps_log : [],
    createdAt: row.created_at ?? null,
    ...meta,
  };
}

export async function listWorkflowRuns(projectId) {
  if (!isSupabaseConfigured()) return null;
  if (projectId && !isUuid(projectId)) return [];
  try {
    const sb = assetsClient();
    let q = sb.from(TABLE).select("*");
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q
      .order("started_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[workflow_runs.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeRun);
  } catch (e) {
    console.error("[workflow_runs.list]", e);
    return null;
  }
}

export async function getWorkflowRun(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[workflow_runs.get]", error.message);
      return null;
    }
    return normalizeRun(data);
  } catch (e) {
    console.error("[workflow_runs.get]", e);
    return null;
  }
}
