"use client";

// Project settings — owns assets.project_settings (one row per project) plus
// name/slug/description writes to the shared public.projects table.
//
// DB is snake_case, the UI is camelCase; the mapping happens here. Promoted
// columns (visibility, region, default page size/tab, usage limits) update via
// updateProjectSettingsColumns; everything else lives in the metadata
// expansion bag ({ addons, security, advanced, usage, variables, brandKit,
// watermarks, contactSheets }) and merges via the atomic
// assets.project_merge_settings() RPC so one settings tab never clobbers
// another. Reads return null (no DB / failure); writes return the normalized
// row, or null on failure. Nothing here throws or toasts.

import { createClient } from "@/lib/supabase/client";
import {
  assetsClient,
  isSupabaseConfigured,
  isUuid,
} from "@/supabase/components/assets-client";
import {
  DEFAULT_ADDON_PREFS,
  DEFAULT_ADVANCED_SETTINGS,
  DEFAULT_SECURITY_SETTINGS,
  DEFAULT_USAGE_LIMITS,
  FILE_TYPE_OPTIONS,
} from "@/components/internal/screens/projects/settings/constants";

const TABLE = "project_settings";

const KNOWN_FILE_TYPES = new Set(FILE_TYPE_OPTIONS.map((o) => o.value));

function addonPrefs(bag) {
  const source = bag && typeof bag === "object" ? bag : {};
  return {
    enabled: Array.isArray(source.enabled)
      ? source.enabled
      : [...DEFAULT_ADDON_PREFS.enabled],
    navPositions:
      source.navPositions && typeof source.navPositions === "object"
        ? source.navPositions
        : {},
    colors:
      source.colors && typeof source.colors === "object" ? source.colors : {},
  };
}

export function normalizeProjectSettings(row) {
  if (!row) return null;
  const metadata =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const usageBag =
    metadata.usage && typeof metadata.usage === "object" ? metadata.usage : {};
  const brandKit =
    metadata.brandKit && typeof metadata.brandKit === "object"
      ? metadata.brandKit
      : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    visibility: row.visibility ?? "private",
    region: row.region ?? "us-east-1",
    defaultPageSize: Number(row.default_page_size ?? 25),
    defaultTab: row.default_tab ?? "Overview",
    storageQuotaGb: Number(row.storage_quota_gb ?? DEFAULT_USAGE_LIMITS.storageQuotaGb),
    maxUploadMb: Number(row.max_upload_mb ?? DEFAULT_USAGE_LIMITS.maxUploadMb),
    trashRetentionDays: Number(
      row.trash_retention_days ?? DEFAULT_USAGE_LIMITS.trashRetentionDays,
    ),
    autoArchiveDays: Number(
      row.auto_archive_days ?? DEFAULT_USAGE_LIMITS.autoArchiveDays,
    ),
    quotaAlertPercent: Number(
      row.quota_alert_percent ?? DEFAULT_USAGE_LIMITS.quotaAlertPercent,
    ),
    addons: addonPrefs(metadata.addons),
    security: { ...DEFAULT_SECURITY_SETTINGS, ...(metadata.security ?? {}) },
    advanced: { ...DEFAULT_ADVANCED_SETTINGS, ...(metadata.advanced ?? {}) },
    usage: {
      allowedFileTypes: Array.isArray(usageBag.allowedFileTypes)
        ? usageBag.allowedFileTypes.filter((t) => KNOWN_FILE_TYPES.has(t))
        : [...DEFAULT_USAGE_LIMITS.allowedFileTypes],
    },
    variables: Array.isArray(metadata.variables) ? metadata.variables : [],
    brandKit: {
      logos: Array.isArray(brandKit.logos) ? brandKit.logos : [],
      palette: Array.isArray(brandKit.palette) ? brandKit.palette : [],
      typography: Array.isArray(brandKit.typography) ? brandKit.typography : [],
      dos: Array.isArray(brandKit.dos) ? brandKit.dos : [],
      donts: Array.isArray(brandKit.donts) ? brandKit.donts : [],
    },
    watermarks: Array.isArray(metadata.watermarks) ? metadata.watermarks : [],
    contactSheets: Array.isArray(metadata.contactSheets)
      ? metadata.contactSheets
      : [],
    metadata,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function defaultProjectSettings(projectId) {
  return {
    id: null,
    projectId,
    visibility: "private",
    region: "us-east-1",
    defaultPageSize: 25,
    defaultTab: "Overview",
    storageQuotaGb: DEFAULT_USAGE_LIMITS.storageQuotaGb,
    maxUploadMb: DEFAULT_USAGE_LIMITS.maxUploadMb,
    trashRetentionDays: DEFAULT_USAGE_LIMITS.trashRetentionDays,
    autoArchiveDays: DEFAULT_USAGE_LIMITS.autoArchiveDays,
    quotaAlertPercent: DEFAULT_USAGE_LIMITS.quotaAlertPercent,
    addons: { enabled: [...DEFAULT_ADDON_PREFS.enabled], navPositions: {}, colors: {} },
    security: { ...DEFAULT_SECURITY_SETTINGS },
    advanced: { ...DEFAULT_ADVANCED_SETTINGS },
    usage: { allowedFileTypes: [...DEFAULT_USAGE_LIMITS.allowedFileTypes] },
    variables: [],
    brandKit: { logos: [], palette: [], typography: [], dos: [], donts: [] },
    watermarks: [],
    contactSheets: [],
    metadata: {},
    createdAt: null,
    updatedAt: null,
  };
}

// The project's settings row, or null when absent/unreadable. Callers fall
// back to defaultProjectSettings(projectId) for rendering.
export async function getProjectSettings(projectId) {
  if (!projectId || !isUuid(projectId) || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient()
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[project_settings.get]", error.message);
      return null;
    }
    return normalizeProjectSettings(data);
  } catch (err) {
    console.error("[project_settings.get]", err?.message);
    return null;
  }
}

// Shallow-merge a metadata patch ({ addons, security, advanced, usage,
// variables, brandKit, watermarks, contactSheets }) via the atomic RPC. Falls
// back to a read-modify-write upsert when the RPC is unavailable.
export async function mergeProjectSettings(projectId, patch) {
  if (!projectId || !isUuid(projectId) || !patch || typeof patch !== "object") {
    return null;
  }
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient().rpc("project_merge_settings", {
      p_project_id: projectId,
      p_patch: patch,
    });
    if (!error && data) return normalizeProjectSettings(data);
    if (error) console.error("[project_settings.merge]", error.message);
  } catch (err) {
    console.error("[project_settings.merge]", err?.message);
  }
  return mergeProjectSettingsFallback(projectId, patch);
}

async function mergeProjectSettingsFallback(projectId, patch) {
  try {
    const sb = assetsClient();
    const { data: current } = await sb
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    const currentMeta =
      current?.metadata && typeof current.metadata === "object"
        ? current.metadata
        : {};
    const { data, error } = await sb
      .from(TABLE)
      .upsert(
        { project_id: projectId, metadata: { ...currentMeta, ...patch } },
        { onConflict: "project_id" },
      )
      .select()
      .single();
    if (error) {
      console.error("[project_settings.merge.fallback]", error.message);
      return null;
    }
    return normalizeProjectSettings(data);
  } catch (err) {
    console.error("[project_settings.merge.fallback]", err?.message);
    return null;
  }
}

const COLUMN_MAP = {
  visibility: "visibility",
  region: "region",
  defaultTab: "default_tab",
};

function columnsRow(patch) {
  const row = {};
  for (const [key, col] of Object.entries(COLUMN_MAP)) {
    if (key in patch) row[col] = patch[key];
  }
  if ("defaultPageSize" in patch) {
    row.default_page_size = Number(patch.defaultPageSize) || 25;
  }
  if ("storageQuotaGb" in patch) {
    row.storage_quota_gb = Number(patch.storageQuotaGb) || 0;
  }
  if ("maxUploadMb" in patch) {
    row.max_upload_mb = Number(patch.maxUploadMb) || 0;
  }
  if ("trashRetentionDays" in patch) {
    row.trash_retention_days = Number(patch.trashRetentionDays) || 0;
  }
  if ("autoArchiveDays" in patch) {
    row.auto_archive_days = Number(patch.autoArchiveDays) || 0;
  }
  if ("quotaAlertPercent" in patch) {
    row.quota_alert_percent = Number(patch.quotaAlertPercent) || 0;
  }
  return row;
}

// Partial update for the promoted columns. Emits a column only when its key
// is present in the patch, then updates (or inserts when no row exists yet).
export async function updateProjectSettingsColumns(projectId, patch) {
  if (!projectId || !isUuid(projectId) || !patch) return null;
  const row = columnsRow(patch);
  if (Object.keys(row).length === 0) return null;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = assetsClient();
    const { data: existing } = await sb
      .from(TABLE)
      .select("id")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    const query = existing
      ? sb.from(TABLE).update(row).eq("project_id", projectId)
      : sb.from(TABLE).insert({ project_id: projectId, ...row });
    const { data, error } = await query.select().single();
    if (error) {
      console.error("[project_settings.columns]", error.message);
      return null;
    }
    return normalizeProjectSettings(data);
  } catch (err) {
    console.error("[project_settings.columns]", err?.message);
    return null;
  }
}

// Name/slug/description/organization live on the shared public.projects
// table, so they go through a plain createClient() — never assetsClient(). A
// taken slug fails the unique constraint and returns null; the screen rolls
// back.
export async function updateProjectRecord(projectId, patch) {
  if (!projectId || !isUuid(projectId) || !patch) return null;
  const row = {};
  if ("name" in patch) row.name = patch.name;
  if ("slug" in patch) row.slug = patch.slug;
  if ("description" in patch) row.description = patch.description || null;
  if ("organizationId" in patch) row.organization_id = patch.organizationId;
  if (Object.keys(row).length === 0) return null;
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from("projects")
      .update(row)
      .eq("id", projectId)
      .select("id, name, slug, description, organization_id")
      .single();
    if (error) {
      console.error("[project_settings.project]", error.message);
      return null;
    }
    return data
      ? {
          id: data.id,
          name: data.name ?? "",
          slug: data.slug ?? "",
          description: data.description ?? "",
          organizationId: data.organization_id ?? null,
        }
      : null;
  } catch (err) {
    console.error("[project_settings.project]", err?.message);
    return null;
  }
}

// Soft-delete the project row. Returns true on success, false otherwise.
export async function softDeleteProjectRecord(projectId) {
  if (!projectId || !isUuid(projectId)) return false;
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await createClient()
      .from("projects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", projectId);
    if (error) {
      console.error("[project_settings.project.delete]", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[project_settings.project.delete]", err?.message);
    return false;
  }
}
