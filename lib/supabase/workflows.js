"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const TABLE = "workflows";

export function normalizeWorkflow(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    status: row.status ?? "Draft",
    trigger: row.trigger ?? "",
    scope: row.scope ?? "workspace",
    projectId: row.project_id ?? null,
    collectionId: row.collection_id ?? null,
    steps: Array.isArray(row.steps) ? row.steps : [],
    graph:
      row.graph && typeof row.graph === "object" && !Array.isArray(row.graph)
        ? row.graph
        : {},
    viewMode: row.view_mode ?? "list",
    runCount: Number(row.run_count ?? 0),
    lastRunAt: row.last_run_at ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    ...meta,
  };
}

function toRow(input) {
  const row = {};
  const map = {
    name: "name",
    description: "description",
    status: "status",
    trigger: "trigger",
    scope: "scope",
    viewMode: "view_mode",
    projectId: "project_id",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("collectionId" in input) row.collection_id = input.collectionId || null;
  if ("steps" in input) {
    row.steps = Array.isArray(input.steps) ? input.steps : [];
  }
  if ("graph" in input) {
    row.graph =
      input.graph && typeof input.graph === "object" ? input.graph : {};
  }
  if ("runCount" in input) row.run_count = Number(input.runCount) || 0;
  if ("lastRunAt" in input) row.last_run_at = input.lastRunAt || null;
  return row;
}

export async function listWorkflows(projectId) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    let q = sb.from(TABLE).select("*").is("deleted_at", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) {
      console.error("[workflows.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeWorkflow);
  } catch (e) {
    console.error("[workflows.list]", e);
    return null;
  }
}

export async function getWorkflow(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[workflows.get]", error.message);
      return null;
    }
    return normalizeWorkflow(data);
  } catch (e) {
    console.error("[workflows.get]", e);
    return null;
  }
}

export async function createWorkflow(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = toRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[workflows.create]", error.message);
      return null;
    }
    return normalizeWorkflow(data);
  } catch (e) {
    console.error("[workflows.create]", e);
    return null;
  }
}

export async function updateWorkflow(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(toRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[workflows.update]", error.message);
      return null;
    }
    return normalizeWorkflow(data);
  } catch (e) {
    console.error("[workflows.update]", e);
    return null;
  }
}

export async function softDeleteWorkflow(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[workflows.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[workflows.delete]", e);
    return false;
  }
}
