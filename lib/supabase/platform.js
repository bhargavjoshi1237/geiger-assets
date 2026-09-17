// Data-access layer for the Platform domain — owns `assets.integrations`
// (per-project third-party connections) and `assets.data_jobs` (import/export
// run history), plus read-only access to `assets.webhook_deliveries` (the
// append-only log the server-side dispatcher in lib/media/webhooks.js writes).
//
// Webhook endpoint CRUD is NOT duplicated here: endpoints live behind
// /api/webhooks/endpoints and the browser boundary for them is
// lib/supabase/settings.js (that server module throws when imported in the
// browser — it signs and delivers to attacker-controlled URLs).
//
// DB is snake_case, the UI is camelCase — map at this boundary and return
// view-model objects the screen can render directly. Pure data access: validate,
// console.error on failure, return null/false/[]. Never throw, never toast — the
// screen owns UX.
"use client";

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const INTEGRATIONS_TABLE = "integrations";
const JOBS_TABLE = "data_jobs";
const DELIVERIES_TABLE = "webhook_deliveries";

function meta(row) {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export function normalizeIntegration(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    key: row.key ?? "",
    category: row.category ?? "",
    status: row.status ?? "disconnected",
    config: row.config && typeof row.config === "object" ? row.config : {},
    lastSyncAt: row.last_sync_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

export function toIntegrationRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    key: "key",
    category: "category",
    status: "status",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("config" in input) {
    row.config = input.config && typeof input.config === "object" ? input.config : {};
  }
  if ("lastSyncAt" in input) row.last_sync_at = input.lastSyncAt || null;
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export async function listIntegrations(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(INTEGRATIONS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[platform.integrations.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeIntegration);
  } catch (e) {
    console.error("[platform.integrations.list]", e);
    return null;
  }
}

export async function getIntegration(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(INTEGRATIONS_TABLE)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error("[platform.integrations.get]", error.message);
      return null;
    }
    return normalizeIntegration(data);
  } catch (e) {
    console.error("[platform.integrations.get]", e);
    return null;
  }
}

export async function createIntegration(input) {
  if (!input?.projectId || !input?.key || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = toIntegrationRow(input);
    if (input.id) payload.id = input.id; // honor optimistic UUID
    const { data, error } = await sb.from(INTEGRATIONS_TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[platform.integrations.create]", error.message);
      return null;
    }
    return normalizeIntegration(data);
  } catch (e) {
    console.error("[platform.integrations.create]", e);
    return null;
  }
}

export async function updateIntegration(id, patch) {
  if (!id || !patch || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(INTEGRATIONS_TABLE)
      .update(toIntegrationRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[platform.integrations.update]", error.message);
      return false;
    }
    return normalizeIntegration(data);
  } catch (e) {
    console.error("[platform.integrations.update]", e);
    return false;
  }
}

export async function softDeleteIntegration(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(INTEGRATIONS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[platform.integrations.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[platform.integrations.delete]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Data jobs (import/export run history)
// ---------------------------------------------------------------------------

export function normalizeDataJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    kind: row.kind ?? "import",
    format: row.format ?? "csv",
    status: row.status ?? "pending",
    sourceName: row.source_name ?? "",
    mapping: row.mapping && typeof row.mapping === "object" ? row.mapping : {},
    totalRows: Number(row.total_rows ?? 0),
    processedRows: Number(row.processed_rows ?? 0),
    error: row.error ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

export function toDataJobRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    kind: "kind",
    format: "format",
    status: "status",
    sourceName: "source_name",
    error: "error",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("mapping" in input) {
    row.mapping = input.mapping && typeof input.mapping === "object" ? input.mapping : {};
  }
  if ("totalRows" in input) row.total_rows = Math.max(0, Math.floor(Number(input.totalRows) || 0));
  if ("processedRows" in input) {
    row.processed_rows = Math.max(0, Math.floor(Number(input.processedRows) || 0));
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  return row;
}

export async function listDataJobs(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(JOBS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error("[platform.jobs.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeDataJob);
  } catch (e) {
    console.error("[platform.jobs.list]", e);
    return null;
  }
}

export async function getDataJob(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(JOBS_TABLE)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error("[platform.jobs.get]", error.message);
      return null;
    }
    return normalizeDataJob(data);
  } catch (e) {
    console.error("[platform.jobs.get]", e);
    return null;
  }
}

export async function createDataJob(input) {
  if (!input?.projectId || !input?.kind || !isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const payload = toDataJobRow(input);
    if (input.id) payload.id = input.id; // honor optimistic UUID
    const { data, error } = await sb.from(JOBS_TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[platform.jobs.create]", error.message);
      return null;
    }
    return normalizeDataJob(data);
  } catch (e) {
    console.error("[platform.jobs.create]", e);
    return null;
  }
}

export async function updateDataJob(id, patch) {
  if (!id || !patch || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(JOBS_TABLE)
      .update(toDataJobRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[platform.jobs.update]", error.message);
      return false;
    }
    return normalizeDataJob(data);
  } catch (e) {
    console.error("[platform.jobs.update]", e);
    return false;
  }
}

export async function softDeleteDataJob(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = assetsClient();
    const { error } = await sb
      .from(JOBS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[platform.jobs.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[platform.jobs.delete]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Webhook deliveries (read-only — writes belong to the server dispatcher)
// ---------------------------------------------------------------------------

export function normalizeDelivery(row) {
  if (!row) return null;
  return {
    id: row.id,
    endpointId: row.endpoint_id ?? null,
    event: row.event ?? "",
    status: row.status ?? "pending",
    attempts: Number(row.attempts ?? 0),
    responseCode: row.response_code ?? null,
    error: row.error ?? null,
    nextRetryAt: row.next_retry_at ?? null,
    createdAt: row.created_at ?? "",
    deliveredAt: row.delivered_at ?? null,
  };
}

// Recent deliveries for one endpoint, newest first. The payload envelope is
// intentionally not selected — it can carry asset metadata the log view does
// not need.
export async function listWebhookDeliveries(endpointId, limit = 25) {
  if (!endpointId || !isSupabaseConfigured()) return null;
  const n = Number.isFinite(Number(limit))
    ? Math.min(Math.max(Math.floor(Number(limit)), 1), 100)
    : 25;
  try {
    const sb = assetsClient();
    const { data, error } = await sb
      .from(DELIVERIES_TABLE)
      .select("id,endpoint_id,event,status,attempts,response_code,error,next_retry_at,created_at,delivered_at")
      .eq("endpoint_id", endpointId)
      .order("created_at", { ascending: false })
      .limit(n);
    if (error) {
      console.error("[platform.deliveries.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeDelivery);
  } catch (e) {
    console.error("[platform.deliveries.list]", e);
    return null;
  }
}
