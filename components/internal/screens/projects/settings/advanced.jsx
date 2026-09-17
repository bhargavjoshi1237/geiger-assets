"use client";

import React, { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  History,
  Loader2,
  RefreshCw,
  Upload,
  Zap,
} from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  Field,
  ScreenHeader,
  SectionCard,
  SettingRow,
  SettingsList,
} from "@/components/internal/shared/screen_kit";
import {
  SETTINGS_KEYS,
  listCustomFields,
  replaceCustomFields,
  updateProjectSettings,
} from "@/lib/supabase/settings";
import { useProjectSettings } from "./use_project_settings";
import { RECONCILE_SCHEDULE_OPTIONS } from "./constants";

// Advanced — retention policy, soft-delete window, reconciliation schedule,
// cache controls, and export / import of the project configuration.
//
// The reconciler is real (lib/storage/reconcile.js: verify stored rows,
// sweep orphaned tmp/ staging objects, sweep soft-deleted rows past
// retention; scheduled through app/api/cron/reconcile/route.js). Its
// destructive mode is env-gated (RECONCILE_APPLY) — the schedule stored here
// records intent, it cannot escalate a dry run into deletes.

const EXPORT_VERSION = 1;

const IMPORTABLE_KEYS = new Set(
  SETTINGS_KEYS.filter(
    (key) => !["id", "projectId", "createdAt", "updatedAt", "archivedAt"].includes(key),
  ),
);

function NumberDraft({ id, label, hint, value, onChange }) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input
        id={id}
        className="bg-surface-card"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        placeholder="0"
      />
    </Field>
  );
}

export function AdvancedScreen({ projectId }) {
  const { settings, setSettings, loading, save } = useProjectSettings(projectId);
  const [numbers, setNumbers] = useState({
    retentionDays: "",
    softDeleteWindowDays: "",
    cacheTtlSeconds: "",
    staleWhileRevalidateSeconds: "",
  });
  const [seededFor, setSeededFor] = useState(null);
  const [savingRetention, setSavingRetention] = useState(false);
  const [savingCache, setSavingCache] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  // Seed the number forms from the fetched row once per project (render-phase
  // adjustment, not an effect — it runs only until seededFor catches up).
  if (!loading && seededFor !== projectId) {
    setSeededFor(projectId);
    setNumbers({
      retentionDays: String(settings.retentionDays),
      softDeleteWindowDays: String(settings.softDeleteWindowDays),
      cacheTtlSeconds: String(settings.cacheTtlSeconds),
      staleWhileRevalidateSeconds: String(settings.staleWhileRevalidateSeconds),
    });
  }
  const seeded = !loading && seededFor === projectId;

  const setNumber = (key) => (value) => setNumbers((n) => ({ ...n, [key]: value }));

  const parsePositive = (value, label, minimum = 0) => {
    if (value === "") return minimum;
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < minimum) {
      toast.error(`${label} must be a number${minimum > 0 ? ` of at least ${minimum}` : ""}.`);
      return null;
    }
    return n;
  };

  const saveRetention = async () => {
    const retentionDays = parsePositive(numbers.retentionDays, "Retention");
    if (retentionDays == null) return;
    const softDeleteWindowDays = parsePositive(numbers.softDeleteWindowDays, "Soft-delete window", 1);
    if (softDeleteWindowDays == null) return;
    setSavingRetention(true);
    const saved = await save(
      { retentionDays, softDeleteWindowDays },
      { success: "Retention saved.", error: "Couldn't save retention." },
    );
    setSavingRetention(false);
    if (saved) {
      setNumbers((n) => ({
        ...n,
        retentionDays: String(saved.retentionDays),
        softDeleteWindowDays: String(saved.softDeleteWindowDays),
      }));
    }
  };

  const saveCache = async () => {
    const cacheTtlSeconds = parsePositive(numbers.cacheTtlSeconds, "Cache TTL", 1);
    if (cacheTtlSeconds == null) return;
    const staleWhileRevalidateSeconds = parsePositive(
      numbers.staleWhileRevalidateSeconds,
      "Stale-while-revalidate",
    );
    if (staleWhileRevalidateSeconds == null) return;
    setSavingCache(true);
    const saved = await save(
      { cacheTtlSeconds, staleWhileRevalidateSeconds },
      { success: "Cache controls saved.", error: "Couldn't save cache controls." },
    );
    setSavingCache(false);
    if (saved) {
      setNumbers((n) => ({
        ...n,
        cacheTtlSeconds: String(saved.cacheTtlSeconds),
        staleWhileRevalidateSeconds: String(saved.staleWhileRevalidateSeconds),
      }));
    }
  };

  const retentionDirty =
    seeded &&
    (numbers.retentionDays !== String(settings.retentionDays) ||
      numbers.softDeleteWindowDays !== String(settings.softDeleteWindowDays));

  const cacheDirty =
    seeded &&
    (numbers.cacheTtlSeconds !== String(settings.cacheTtlSeconds) ||
      numbers.staleWhileRevalidateSeconds !== String(settings.staleWhileRevalidateSeconds));

  const exportConfig = async () => {
    const fields = await listCustomFields(projectId);
    if (!fields) {
      toast.error("Couldn't read the configuration.");
      return;
    }
    const exportSettings = {};
    for (const key of IMPORTABLE_KEYS) exportSettings[key] = settings[key];
    const payload = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      projectId,
      settings: exportSettings,
      customFields: fields.map((f) => ({
        name: f.name,
        key: f.key,
        type: f.type,
        required: f.required,
        defaultValue: f.defaultValue,
        options: f.options,
        assetTypes: f.assetTypes,
        position: f.position,
        active: f.active,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${settings.slug || projectId}-config.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success("Configuration exported.");
  };

  const importConfig = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || typeof parsed.settings !== "object") {
        toast.error("That file isn't a project configuration export.");
        return;
      }
      const patch = {};
      for (const [key, value] of Object.entries(parsed.settings)) {
        if (IMPORTABLE_KEYS.has(key)) patch[key] = value;
      }
      const saved = await updateProjectSettings(projectId, patch);
      if (!saved) {
        toast.error("Couldn't import settings.");
        return;
      }
      setSettings((current) => ({ ...current, ...saved }));
      if (Array.isArray(parsed.customFields)) {
        const replaced = await replaceCustomFields(projectId, parsed.customFields);
        if (replaced === false) {
          toast.error("Settings imported, but custom fields failed.");
          return;
        }
      }
      setNumbers({
        retentionDays: String(saved.retentionDays),
        softDeleteWindowDays: String(saved.softDeleteWindowDays),
        cacheTtlSeconds: String(saved.cacheTtlSeconds),
        staleWhileRevalidateSeconds: String(saved.staleWhileRevalidateSeconds),
      });
      toast.success("Configuration imported.");
    } catch {
      toast.error("That file couldn't be read as JSON.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Advanced"
        description="Retention, reconciliation, cache behavior, and configuration portability."
      />

      {loading || !seeded ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading advanced settings" />
        </div>
      ) : (
        <>
          <SectionCard
            title="Retention"
            description="Declared policy for raw history and deleted rows."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={saveRetention}
                disabled={savingRetention || !retentionDirty}
              >
                {savingRetention ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save retention"
                )}
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberDraft
                id="advanced-retention"
                label="Raw event retention (days)"
                hint="Delivery and webhook detail older than this may be purged; lifetime totals survive on the rollup."
                value={numbers.retentionDays}
                onChange={setNumber("retentionDays")}
              />
              <NumberDraft
                id="advanced-soft-delete"
                label="Soft-delete window (days)"
                hint="Deleted rows stay restorable for this long before the reconciler sweeps their bytes."
                value={numbers.softDeleteWindowDays}
                onChange={setNumber("softDeleteWindowDays")}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Reconciliation"
            description="The storage reconciler verifies bytes, sweeps orphaned staging objects, and clears swept rows — dry-run unless the environment opts in."
          >
            <SettingsList>
              <SettingRow
                title="Schedule"
                description="How often the cron route runs the three passes. Apply mode stays env-gated either way."
                icon={RefreshCw}
                control={
                  <Select
                    value={settings.reconcileSchedule}
                    onValueChange={(value) =>
                      save({ reconcileSchedule: value }, { error: "Couldn't save the schedule." })
                    }
                  >
                    <SelectTrigger className="w-48 bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECONCILE_SCHEDULE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
              <SettingRow
                title="Passes"
                description="Verify stored rows still have bytes · sweep orphaned tmp/ objects older than a day · sweep soft-deleted rows past the window."
                icon={History}
                control={null}
              />
            </SettingsList>
          </SectionCard>

          <SectionCard
            title="Cache controls"
            description="How long delivered bytes stay warm at the edge."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={saveCache}
                disabled={savingCache || !cacheDirty}
              >
                {savingCache ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save cache"
                )}
              </Button>
            }
          >
            <SettingsList>
              <SettingRow
                title="Edge caching"
                description="Serve approved renditions from the CDN base URL when on."
                icon={Zap}
                checked={settings.cdnEnabled}
                onCheckedChange={(value) =>
                  save(
                    { cdnEnabled: value },
                    {
                      success: value ? "Edge caching on." : "Edge caching off.",
                      error: "Couldn't save cache controls.",
                    },
                  )
                }
              />
            </SettingsList>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <NumberDraft
                id="advanced-cache-ttl"
                label="Cache TTL (seconds)"
                hint="Fresh lifetime of a cached rendition before revalidation."
                value={numbers.cacheTtlSeconds}
                onChange={setNumber("cacheTtlSeconds")}
              />
              <NumberDraft
                id="advanced-cache-swr"
                label="Stale-while-revalidate (seconds)"
                hint="Serve stale bytes while a fresh copy is fetched in the background."
                value={numbers.staleWhileRevalidateSeconds}
                onChange={setNumber("staleWhileRevalidateSeconds")}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Configuration portability"
            description="Export every setting and field definition as JSON, or restore from a previous export."
            action={
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  aria-label="Import configuration file"
                  onChange={(e) => importConfig(e.target.files?.[0])}
                />
                <Button
                  variant="outline"
                  className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                  onClick={() => fileRef.current?.click()}
                  disabled={importing}
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Import
                </Button>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={exportConfig}
                >
                  <Download className="h-4 w-4" /> Export
                </Button>
              </div>
            }
          >
            <p className="text-xs text-text-tertiary">
              Imports overwrite settings with the file&apos;s values and replace the whole custom
              field set. Webhook secrets are never exported — endpoints re-issue them on demand.
            </p>
          </SectionCard>
        </>
      )}
    </SecondaryScreenWrapper>
  );
}

export default AdvancedScreen;
