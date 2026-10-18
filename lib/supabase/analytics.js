"use client";

// Read-only analytics sources. Keep snake_case at the database boundary.
import { listRows } from "./row_helpers";
import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

export async function logSearchEvent({ projectId, query, resultCount, filters, clickedAssetId }) {
  if (!projectId || !query?.trim() || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient().from("search_events").insert({
      project_id: projectId,
      query: query.trim(),
      normalized_query: query.trim().toLowerCase().replace(/\s+/g, " "),
      result_count: Math.max(0, Number(resultCount) || 0),
      filters: filters || {},
      clicked_asset_id: clickedAssetId || null,
    }).select("id").single();
    if (error) { console.error("[analytics.search.log]", error.message); return null; }
    return data?.id ?? null;
  } catch (error) {
    console.error("[analytics.search.log]", error);
    return null;
  }
}

export async function markSearchClick(eventId, assetId) {
  if (!eventId || !assetId || !isSupabaseConfigured()) return false;
  try {
    const { error } = await assetsClient().from("search_events")
      .update({ clicked_asset_id: assetId }).eq("id", eventId);
    if (error) { console.error("[analytics.search.click]", error.message); return false; }
    return true;
  } catch (error) {
    console.error("[analytics.search.click]", error);
    return false;
  }
}

export const listSearchEvents = (projectId) =>
  listRows("search_events", projectId, { order: "occurred_at" }).then((rows) =>
    rows?.map((row) => ({
      id: row.id,
      query: row.query ?? "",
      normalizedQuery: row.normalized_query ?? "",
      resultCount: Number(row.result_count ?? 0),
      filters: row.filters && typeof row.filters === "object" ? row.filters : {},
      clickedAssetId: row.clicked_asset_id ?? null,
      occurredAt: row.occurred_at ?? "",
    })) ?? rows,
  );

export const listReports = (projectId) =>
  listRows("reports", projectId, { order: "created_at" }).then((rows) =>
    rows?.map((row) => ({
      id: row.id,
      name: row.name ?? "",
      source: row.source ?? "asset",
      schedule: row.schedule ?? "manual",
      status: row.status ?? "active",
      lastRunAt: row.last_run_at ?? null,
      createdAt: row.created_at ?? "",
    })) ?? rows,
  );

export const listReportRuns = (projectId) =>
  listRows("report_runs", projectId, { order: "started_at" }).then((rows) =>
    rows?.map((row) => ({
      id: row.id,
      reportId: row.report_id,
      status: row.status ?? "queued",
      format: row.format ?? "csv",
      rowCount: Number(row.row_count ?? 0),
      startedAt: row.started_at ?? "",
      finishedAt: row.finished_at ?? null,
    })) ?? rows,
  );
