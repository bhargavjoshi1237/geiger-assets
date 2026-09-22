"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, FileOutput, Loader2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  ClearFiltersButton,
  SelectField,
  useModuleRows,
} from "@/components/internal/shared/module_kit";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Checkbox } from "@geiger/ui/checkbox";
import { Input } from "@geiger/ui/input";
import { Label } from "@geiger/ui/label";
import { cn } from "@/lib/utils";

import { listExportRuns, createExportRun } from "@/lib/supabase/platform";
import { listAssets } from "@/lib/supabase/assets";
import { listCollections, listCollectionAssets } from "@/lib/supabase/collections";
import { listFolders } from "@/lib/supabase/folders";
import { getUser } from "@/lib/supabase/user";

import {
  DEFAULT_EXPORT_FIELDS,
  EXPORT_FIELD_OPTIONS,
  EXPORT_FORMAT_MAP,
  EXPORT_FORMAT_OPTIONS,
  EXPORT_SCOPE_OPTIONS,
  EXPORT_STATUS_MAP,
  EXPORT_ZIP_MAX_BYTES,
  EXPORT_ZIP_MAX_FILES,
  formatBytes,
  formatDateTime,
} from "./constants";

function scopeAssets(assets, scope, scopeId, search, folders, collectionAssetIds) {
  const term = search.trim().toLowerCase();
  return assets.filter((a) => {
    if (scope === "collection" && scopeId) {
      if (!collectionAssetIds) return true;
      if (!collectionAssetIds.has(a.id)) return false;
    }
    if (scope === "folder" && scopeId) {
      const folder = folders.find((f) => f.id === scopeId);
      if (folder && a.folder !== folder.path && a.folder !== folder.name) return false;
    }
    if (scope === "filter" && term) {
      const hay = `${a.name} ${a.format} ${a.type} ${(a.tags || []).join(" ")}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function DataExportScreen({ projectId }) {
  const [runs, setRuns, runsLoading] = useModuleRows(listExportRuns, projectId);
  const [assets, setAssets, assetsLoading] = useModuleRows(listAssets, projectId);
  const [collections, , collectionsLoading] = useModuleRows(listCollections, projectId);
  const [folders, , foldersLoading] = useModuleRows(listFolders, projectId);
  const loading = runsLoading || assetsLoading || collectionsLoading || foldersLoading;

  const [scope, setScope] = useState("project");
  const [scopeId, setScopeId] = useState("");
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState("csv");
  const [includeVersions, setIncludeVersions] = useState(false);
  const [includeComments, setIncludeComments] = useState(false);
  const [includeRights, setIncludeRights] = useState(false);
  const [preserveStructure, setPreserveStructure] = useState(true);
  const [fields, setFields] = useState(DEFAULT_EXPORT_FIELDS);
  const [running, setRunning] = useState(false);

  const [historySearch, setHistorySearch] = useState("");
  const [historyFormat, setHistoryFormat] = useState("all");
  const [collectionAssetIds, setCollectionAssetIds] = useState(null);

  // Reset the picked collection/folder whenever the scope kind changes.
  const [seenScope, setSeenScope] = useState(scope);
  if (seenScope !== scope) {
    setSeenScope(scope);
    setScopeId("");
    setCollectionAssetIds(null);
  }

  // Membership for the picked collection, so the estimate counts real members.
  // The effect is scoped to collection picks; anything else clears the set.
  React.useEffect(() => {
    if (scope !== "collection" || !scopeId) {
      setCollectionAssetIds(null);
      return;
    }
    let alive = true;
    setCollectionAssetIds(null);
    listCollectionAssets(scopeId).then((members) => {
      if (!alive) return;
      setCollectionAssetIds(new Set((members ?? []).map((m) => m.assetId).filter(Boolean)));
    });
    return () => {
      alive = false;
    };
  }, [scope, scopeId]);

  const estimatingCollection = scope === "collection" && scopeId && collectionAssetIds === null;
  const estimate = useMemo(
    () => scopeAssets(assets, scope, scopeId, search, folders, collectionAssetIds),
    [assets, scope, scopeId, search, folders, collectionAssetIds],
  );
  const estimateBytes = useMemo(
    () => estimate.reduce((s, a) => s + (Number(a.sizeBytes) || 0), 0),
    [estimate],
  );

  const overZipCaps =
    format === "zip" &&
    (estimate.length > EXPORT_ZIP_MAX_FILES || estimateBytes > EXPORT_ZIP_MAX_BYTES);

  const scopeLabel = useMemo(() => {
    if (scope === "collection") {
      const c = collections.find((x) => x.id === scopeId);
      return c ? `Collection: ${c.name}` : "Collection";
    }
    if (scope === "folder") {
      const f = folders.find((x) => x.id === scopeId);
      return f ? `Folder: ${f.path || f.name}` : "Folder";
    }
    if (scope === "filter") return search.trim() ? `Filter: "${search.trim()}"` : "Filter";
    return "Whole project";
  }, [scope, scopeId, collections, folders, search]);

  const needsScopePick = (scope === "collection" || scope === "folder") && !scopeId;

  const stats = useMemo(() => {
    const completed = runs.filter((r) => r.status === "completed");
    return [
      { label: "Exports run", value: String(runs.length), footer: `${completed.length} completed` },
      { label: "Files exported", value: completed.reduce((s, r) => s + r.fileCount, 0).toLocaleString("en-US"), footer: "All time" },
      { label: "Bytes exported", value: formatBytes(completed.reduce((s, r) => s + r.totalBytes, 0)), footer: "All time" },
      { label: "In scope now", value: String(estimate.length), footer: formatBytes(estimateBytes) },
    ];
  }, [runs, estimate, estimateBytes]);

  const filteredRuns = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    return runs.filter((r) => {
      if (historyFormat !== "all" && r.format !== historyFormat) return false;
      if (term && !`${r.scopeLabel} ${r.format} ${r.status}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [runs, historySearch, historyFormat]);

  const toggleField = (value, checked) => {
    setFields((prev) => {
      if (checked) {
        if (prev.includes(value)) return prev;
        return [...EXPORT_FIELD_OPTIONS.map((f) => f.value).filter((v) => v === value || prev.includes(v))];
      }
      return prev.filter((v) => v !== value);
    });
  };

  const runExport = async () => {
    if (needsScopePick) {
      toast.error(scope === "collection" ? "Pick a collection to export." : "Pick a folder to export.");
      return;
    }
    setRunning(true);
    const params = new URLSearchParams({
      projectId: projectId || "",
      scope,
      scopeId: scopeId || "",
      search: scope === "filter" ? search.trim() : "",
      fields: fields.join(","),
      versions: includeVersions ? "1" : "0",
      comments: includeComments ? "1" : "0",
      rights: includeRights ? "1" : "0",
      preserve: preserveStructure ? "1" : "0",
    });
    const path = format === "zip" ? `/api/export/zip?${params}` : `/api/export?${params}&format=${format}`;
    const ext = format === "zip" ? "zip" : format;
    const filename = `geiger-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
    const options = {
      scopeType: scope,
      scopeId: scopeId || null,
      includeVersions,
      includeComments,
      includeRights,
      preserveStructure,
      fields,
    };
    try {
      const res = await fetch(path);
      if (!res.ok) {
        let message = `Export failed (${res.status}).`;
        try {
          const body = await res.json();
          if (body?.error === "zip_too_large") {
            message = `ZIP exceeds the hard caps (${EXPORT_ZIP_MAX_FILES} files / ${formatBytes(EXPORT_ZIP_MAX_BYTES)}). Narrow the scope and try again.`;
          } else if (body?.error) {
            message = `Export failed: ${body.error}.`;
          }
        } catch {
          // Non-JSON error body — keep the generic message.
        }
        const failed = await createExportRun({
          projectId, format, scopeType: scope, scopeId: scopeId || null,
          scopeLabel, options, status: "failed", error: message,
          createdBy: (await getUser())?.id || null,
        });
        if (failed) setRuns((prev) => [failed, ...prev]);
        toast.error(message);
        return;
      }
      const fileCount = Number(res.headers.get("X-Export-File-Count")) || 0;
      const totalBytes = Number(res.headers.get("X-Export-Total-Bytes")) || 0;
      const blob = await res.blob();
      downloadBlob(blob, filename);
      const saved = await createExportRun({
        projectId, format, scopeType: scope, scopeId: scopeId || null,
        scopeLabel, options, status: "completed",
        fileCount, totalBytes: totalBytes || blob.size,
        createdBy: (await getUser())?.id || null,
      });
      if (saved) setRuns((prev) => [saved, ...prev]);
      toast.success(`Exported ${fileCount} file${fileCount === 1 ? "" : "s"} (${formatBytes(totalBytes || blob.size)}).`);
    } catch (e) {
      console.error("[export.run]", e);
      toast.error("The export request failed before it finished.");
    } finally {
      setRunning(false);
    }
  };

  const columns = [
    {
      key: "format",
      header: "Format",
      render: (r) => (
        <Badge variant={EXPORT_FORMAT_MAP[r.format]?.variant || "neutral"}>
          {EXPORT_FORMAT_MAP[r.format]?.label || r.format}
        </Badge>
      ),
    },
    {
      key: "scope",
      header: "Scope",
      render: (r) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{r.scopeLabel || "Whole project"}</span>
          <span className="text-xs capitalize text-text-tertiary">{r.scopeType}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} map={EXPORT_STATUS_MAP} />,
    },
    {
      key: "files",
      header: "Files",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (r) => r.fileCount.toLocaleString("en-US"),
    },
    {
      key: "bytes",
      header: "Size",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (r) => formatBytes(r.totalBytes),
    },
    {
      key: "created",
      header: "Ran",
      className: "text-text-secondary",
      render: (r) => formatDateTime(r.createdAt),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Data Export"
        description="Metadata out as CSV or JSON, originals out as a ZIP. Exports run inline — no background jobs — and every run is recorded below."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={runExport}
            disabled={running || loading}
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {running ? "Exporting…" : "Run export"}
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <SectionCard title="What to export" description="Pick a scope, a format, and what rides along.">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid gap-4">
            <Field label="Scope">
              <div className="grid grid-cols-2 gap-2">
                {EXPORT_SCOPE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setScope(o.value)}
                    aria-pressed={scope === o.value}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition-colors",
                      scope === o.value
                        ? "border-primary/60 bg-primary/10"
                        : "border-border bg-surface-card hover:bg-surface-hover",
                    )}
                  >
                    <span className="block text-sm font-medium text-foreground">{o.label}</span>
                    <span className="block text-xs text-text-tertiary">{o.hint}</span>
                  </button>
                ))}
              </div>
            </Field>

            {scope === "collection" ? (
              <SelectField
                label="Collection"
                value={scopeId}
                onChange={setScopeId}
                placeholder="Select a collection…"
                options={collections.map((c) => ({ value: c.id, label: `${c.name} (${c.assetCount})` }))}
              />
            ) : null}
            {scope === "folder" ? (
              <SelectField
                label="Folder"
                value={scopeId}
                onChange={setScopeId}
                placeholder="Select a folder…"
                options={folders.map((f) => ({ value: f.id, label: f.path || f.name }))}
              />
            ) : null}
            {scope === "filter" ? (
              <Field label="Search term" hint="Matches name, format, type, and tags — the same filter the route applies.">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. hero, campaign, jpg…" />
              </Field>
            ) : null}

            <Field label="Format">
              <div className="grid grid-cols-3 gap-2">
                {EXPORT_FORMAT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setFormat(o.value)}
                    aria-pressed={format === o.value}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition-colors",
                      format === o.value
                        ? "border-primary/60 bg-primary/10"
                        : "border-border bg-surface-card hover:bg-surface-hover",
                    )}
                  >
                    <span className="block text-sm font-medium text-foreground">{o.label}</span>
                    <span className="block text-xs text-text-tertiary">{o.hint}</span>
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="grid content-start gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground">Include</Label>
              <div className="grid gap-2 rounded-lg border border-border bg-surface-card p-3">
                {[
                  ["includeVersions", includeVersions, setIncludeVersions, "Versions", "Every version row per asset, not just the current file."],
                  ["includeComments", includeComments, setIncludeComments, "Comments", "Thread bodies with authors and timestamps."],
                  ["includeRights", includeRights, setIncludeRights, "Rights", "Rights records attached to each asset."],
                  ["preserveStructure", preserveStructure, setPreserveStructure, "Preserve folder structure", "ZIP paths mirror library folders; off flattens everything."],
                ].map(([key, checked, set, label, hint]) => (
                  <label key={key} className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1 hover:bg-surface-hover">
                    <Checkbox checked={checked} onCheckedChange={(v) => set(v === true)} className="mt-0.5" aria-label={label} />
                    <span>
                      <span className="block text-sm text-foreground">{label}</span>
                      <span className="block text-xs text-text-tertiary">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {format !== "zip" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    Metadata mappings ({fields.length} of {EXPORT_FIELD_OPTIONS.length} fields)
                  </Label>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-text-secondary hover:text-foreground" onClick={() => setFields(DEFAULT_EXPORT_FIELDS)}>
                      All
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-text-secondary hover:text-foreground" onClick={() => setFields([])}>
                      None
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-card p-3">
                  {EXPORT_FIELD_OPTIONS.map((f) => (
                    <label key={f.value} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-foreground hover:bg-surface-hover">
                      <Checkbox checked={fields.includes(f.value)} onCheckedChange={(v) => toggleField(f.value, v === true)} aria-label={f.label} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-border bg-surface-card px-3 py-2.5 text-sm">
              <span className="text-text-secondary">In scope: </span>
              <span className="font-medium tabular-nums text-foreground">
                {estimatingCollection
                  ? "Counting collection members…"
                  : `${estimate.length.toLocaleString("en-US")} files · ${formatBytes(estimateBytes)}`}
              </span>
            </div>

            {overZipCaps ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <p className="text-amber-200">
                  This ZIP would exceed the hard caps ({EXPORT_ZIP_MAX_FILES.toLocaleString("en-US")} files /{" "}
                  {formatBytes(EXPORT_ZIP_MAX_BYTES)}). The route will refuse it — narrow the scope, or switch to
                  CSV/JSON for the metadata and export originals in batches.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Export history"
        description="Every inline run, newest first — including failed attempts."
        action={
          <Toolbar>
            <div className="flex items-center gap-2">
              <FilterDropdown
                value={historyFormat}
                onValueChange={setHistoryFormat}
                options={[
                  { value: "all", label: "All Formats" },
                  { value: "csv", label: "CSV" },
                  { value: "json", label: "JSON" },
                  { value: "zip", label: "ZIP" },
                ]}
                height="h-9"
              />
              {(historySearch.trim() !== "" || historyFormat !== "all") ? (
                <ClearFiltersButton onClick={() => { setHistorySearch(""); setHistoryFormat("all"); }} />
              ) : null}
            </div>
            <SearchInput value={historySearch} onChange={setHistorySearch} placeholder="Search history…" />
          </Toolbar>
        }
      >
        {loading ? (
          <LoadingArea panel size={40} label="Loading export history…" />
        ) : (
          <DataTable
            columns={columns}
            data={filteredRuns}
            getRowKey={(r) => r.id}
            empty={
              <EmptyState
                icon={FileOutput}
                title={runs.length ? "No runs match your filters" : "No exports yet"}
                description={
                  runs.length
                    ? "Try clearing the search or format filter."
                    : "Configure a scope and format above, then run your first export — it downloads immediately and is recorded here."
                }
                action={
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={runExport} disabled={running}>
                    <Download className="h-4 w-4" /> Run export
                  </Button>
                }
              />
            }
          />
        )}
      </SectionCard>
    </MainScreenWrapper>
  );
}

export default DataExportScreen;
