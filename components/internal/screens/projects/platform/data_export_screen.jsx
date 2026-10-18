"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Boxes,
  Braces,
  Check,
  Download,
  FileArchive,
  FileOutput,
  FileSpreadsheet,
  Folder,
  History,
  Library,
  Loader2,
  Search,
} from "lucide-react";

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
import { ActionMenu } from "@geiger/ui/action-menu";
import { Button } from "@geiger/ui/button";
import { Checkbox } from "@geiger/ui/checkbox";
import { Input } from "@geiger/ui/input";
import { Progress } from "@geiger/ui/progress";
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
  formatDate,
  formatDateTime,
} from "./constants";
import { DetailList, IconTile, Notice, OUTLINE_BUTTON, PRIMARY_BUTTON, SectionHeading } from "./platform_kit";

const SCOPE_ICONS = { project: Boxes, collection: Library, folder: Folder, filter: Search };
const FORMAT_ICONS = { csv: FileSpreadsheet, json: Braces, zip: FileArchive };

const INCLUDE_OPTIONS = [
  { key: "includeVersions", label: "Versions", hint: "Every version row per asset, not just the current file." },
  { key: "includeComments", label: "Comments", hint: "Thread bodies with authors and timestamps." },
  { key: "includeRights", label: "Rights", hint: "Rights records attached to each asset." },
];

const DEFAULT_INCLUDES = {
  includeVersions: false,
  includeComments: false,
  includeRights: false,
  preserveStructure: true,
};

const HISTORY_FORMAT_OPTIONS = [
  { value: "all", label: "All Formats" },
  ...EXPORT_FORMAT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
];

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

function Step({ index, title, action, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-card text-[11px] font-semibold tabular-nums text-text-secondary">
            {index}
          </span>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function OptionCard({ icon: Icon, label, hint, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative flex h-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        selected
          ? "border-primary/60 bg-primary/10"
          : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-hover",
      )}
    >
      <Icon className={cn("h-4 w-4", selected ? "text-foreground" : "text-text-secondary")} />
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs leading-5 text-text-tertiary">{hint}</span>
      </span>
      {selected ? (
        <span className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-2.5 w-2.5" />
        </span>
      ) : null}
    </button>
  );
}

function CapMeter({ label, used, max, format }) {
  const pct = Math.min(100, max ? (used / max) * 100 : 0);
  const over = used > max;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className={cn("tabular-nums", over ? "text-red-600 dark:text-red-400" : "text-text-tertiary")}>
          {format(used)} / {format(max)}
        </span>
      </div>
      <Progress value={pct} className={cn("h-1.5 bg-surface-active", over && "[&>div]:bg-red-400")} />
    </div>
  );
}

export function DataExportScreen({ projectId }) {
  const [runs, setRuns, runsLoading] = useModuleRows(listExportRuns, projectId);
  const [assets, , assetsLoading] = useModuleRows(listAssets, projectId);
  const [collections, , collectionsLoading] = useModuleRows(listCollections, projectId);
  const [folders, , foldersLoading] = useModuleRows(listFolders, projectId);
  const loading = runsLoading || assetsLoading || collectionsLoading || foldersLoading;

  const builderRef = useRef(null);
  const [scope, setScope] = useState("project");
  const [scopeId, setScopeId] = useState("");
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState("csv");
  const [includes, setIncludes] = useState(DEFAULT_INCLUDES);
  const [fields, setFields] = useState(DEFAULT_EXPORT_FIELDS);
  const [running, setRunning] = useState(false);

  const [historySearch, setHistorySearch] = useState("");
  const [historyFormat, setHistoryFormat] = useState("all");
  const [collectionAssetIds, setCollectionAssetIds] = useState(null);

  // Membership for the picked collection, so the estimate counts real members.
  // The effect is scoped to collection picks; anything else clears the set.
  useEffect(() => {
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

  const chooseScope = (value) => {
    setScope(value);
    setScopeId("");
  };

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
  const needsFields = format !== "zip" && fields.length === 0;
  const blockedReason = needsScopePick
    ? scope === "collection"
      ? "Pick a collection to export."
      : "Pick a folder to export."
    : needsFields
      ? "Pick at least one field."
      : "";

  const stats = useMemo(() => {
    const completed = runs.filter((r) => r.status === "completed");
    return [
      { label: "Exports run", value: String(runs.length), footer: `${completed.length} completed` },
      { label: "Files exported", value: completed.reduce((s, r) => s + r.fileCount, 0).toLocaleString("en-US"), footer: "All time" },
      { label: "Data exported", value: formatBytes(completed.reduce((s, r) => s + r.totalBytes, 0)), footer: "All time" },
      { label: "Last export", value: runs[0] ? formatDate(runs[0].createdAt) : "Never", footer: runs[0] ? EXPORT_FORMAT_MAP[runs[0].format]?.label || runs[0].format : "No runs yet" },
    ];
  }, [runs]);

  const filteredRuns = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    return runs.filter((r) => {
      if (historyFormat !== "all" && r.format !== historyFormat) return false;
      if (term && !`${r.scopeLabel} ${r.format} ${r.status}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [runs, historySearch, historyFormat]);

  const historyFiltersActive = historySearch.trim() !== "" || historyFormat !== "all";

  const toggleField = (value, checked) => {
    setFields((prev) => {
      const next = new Set(prev);
      if (checked) next.add(value);
      else next.delete(value);
      return EXPORT_FIELD_OPTIONS.map((f) => f.value).filter((v) => next.has(v));
    });
  };

  const includedLabels = [
    ...INCLUDE_OPTIONS.filter((o) => includes[o.key]).map((o) => o.label),
    ...(format === "zip" && includes.preserveStructure ? ["Folder structure"] : []),
  ];

  // Load a past run's configuration back into the builder.
  const reuseRun = (r) => {
    const o = r.options || {};
    const legacySearch = /^Filter: "(.*)"$/.exec(r.scopeLabel || "")?.[1] || "";
    setScope(r.scopeType || "project");
    setScopeId(r.scopeId || "");
    setSearch(o.search ?? legacySearch);
    setFormat(r.format || "csv");
    setIncludes({
      includeVersions: Boolean(o.includeVersions),
      includeComments: Boolean(o.includeComments),
      includeRights: Boolean(o.includeRights),
      preserveStructure: o.preserveStructure !== false,
    });
    setFields(Array.isArray(o.fields) && o.fields.length ? o.fields : DEFAULT_EXPORT_FIELDS);
    builderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast.success("Loaded the settings from that export.");
  };

  const runExport = async () => {
    if (blockedReason) {
      toast.error(blockedReason);
      return;
    }
    setRunning(true);
    const params = new URLSearchParams({
      projectId: projectId || "",
      scope,
      scopeId: scopeId || "",
      search: scope === "filter" ? search.trim() : "",
      fields: fields.join(","),
      versions: includes.includeVersions ? "1" : "0",
      comments: includes.includeComments ? "1" : "0",
      rights: includes.includeRights ? "1" : "0",
      preserve: includes.preserveStructure ? "1" : "0",
    });
    const path = format === "zip" ? `/api/export/zip?${params}` : `/api/export?${params}&format=${format}`;
    const filename = `geiger-export-${new Date().toISOString().slice(0, 10)}.${format}`;
    const options = {
      scopeType: scope,
      scopeId: scopeId || null,
      search: scope === "filter" ? search.trim() : "",
      ...includes,
      fields,
    };
    const record = async (extra) =>
      createExportRun({
        projectId,
        format,
        scopeType: scope,
        scopeId: scopeId || null,
        scopeLabel,
        options,
        createdBy: (await getUser())?.id || null,
        ...extra,
      });
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
        const failed = await record({ status: "failed", error: message });
        if (failed) setRuns((prev) => [failed, ...prev]);
        toast.error(message);
        return;
      }
      const fileCount = Number(res.headers.get("X-Export-File-Count")) || 0;
      const totalBytes = Number(res.headers.get("X-Export-Total-Bytes")) || 0;
      const blob = await res.blob();
      downloadBlob(blob, filename);
      const saved = await record({ status: "completed", fileCount, totalBytes: totalBytes || blob.size });
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
      key: "export",
      header: "Export",
      render: (r) => (
        <div className="flex items-center gap-3">
          <IconTile icon={FORMAT_ICONS[r.format] || FileOutput} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{r.scopeLabel || "Whole project"}</p>
            {r.status === "failed" && r.error ? (
              <p className="max-w-80 truncate text-xs text-red-600 dark:text-red-400" title={r.error}>
                {r.error}
              </p>
            ) : (
              <p className="text-xs text-text-tertiary">
                {EXPORT_FORMAT_MAP[r.format]?.label || r.format} · <span className="capitalize">{r.scopeType}</span>
              </p>
            )}
          </div>
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
      className: "tabular-nums text-sm text-text-secondary",
      render: (r) => r.fileCount.toLocaleString("en-US"),
    },
    {
      key: "bytes",
      header: "Size",
      align: "right",
      className: "hidden sm:table-cell tabular-nums text-sm text-text-secondary",
      headClassName: "hidden sm:table-cell",
      render: (r) => formatBytes(r.totalBytes),
    },
    {
      key: "created",
      header: "Ran",
      className: "hidden md:table-cell text-xs text-text-secondary",
      headClassName: "hidden md:table-cell",
      render: (r) => formatDateTime(r.createdAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <ActionMenu
          label="Export actions"
          items={[{ icon: History, label: "Use these settings", onSelect: () => reuseRun(r) }]}
        />
      ),
    },
  ];

  const runButton = (
    <Button className={cn(PRIMARY_BUTTON, "w-full")} onClick={runExport} disabled={running || Boolean(blockedReason)}>
      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {running ? "Exporting…" : "Run export"}
    </Button>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Data Export"
        description="Take metadata out as CSV or JSON, or originals as a ZIP. Exports download straight away and every run is logged."
      />

      {loading ? (
        <LoadingArea panel size={56} label="Loading export data" />
      ) : (
        <>
          <StatsBar stats={stats} />

          <div ref={builderRef} className="grid scroll-mt-4 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <SectionCard title="Configure export" description="Choose what goes in, the file format, and what rides along.">
              <div className="space-y-7">
                <Step index={1} title="Scope">
                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                    {EXPORT_SCOPE_OPTIONS.map((o) => (
                      <OptionCard
                        key={o.value}
                        icon={SCOPE_ICONS[o.value]}
                        label={o.label}
                        hint={o.hint}
                        selected={scope === o.value}
                        onSelect={() => chooseScope(o.value)}
                      />
                    ))}
                  </div>
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
                    <Field label="Search term" hint="Matches name, format, type and tags.">
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. hero, campaign, jpg…" />
                    </Field>
                  ) : null}
                </Step>

                <Step index={2} title="Format">
                  <div className="grid grid-cols-3 gap-2">
                    {EXPORT_FORMAT_OPTIONS.map((o) => (
                      <OptionCard
                        key={o.value}
                        icon={FORMAT_ICONS[o.value]}
                        label={o.label}
                        hint={o.hint}
                        selected={format === o.value}
                        onSelect={() => setFormat(o.value)}
                      />
                    ))}
                  </div>
                </Step>

                <Step
                  index={3}
                  title={format === "zip" ? "Contents" : `Fields · ${fields.length} of ${EXPORT_FIELD_OPTIONS.length}`}
                  action={
                    format !== "zip" ? (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
                          onClick={() => setFields(DEFAULT_EXPORT_FIELDS)}
                        >
                          All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
                          onClick={() => setFields([])}
                        >
                          None
                        </Button>
                      </div>
                    ) : null
                  }
                >
                  {format !== "zip" ? (
                    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-card p-2 sm:grid-cols-3">
                      {EXPORT_FIELD_OPTIONS.map((f) => (
                        <label
                          key={f.value}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-surface-hover"
                        >
                          <Checkbox
                            checked={fields.includes(f.value)}
                            onCheckedChange={(v) => toggleField(f.value, v === true)}
                            aria-label={f.label}
                          />
                          {f.label}
                        </label>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ...INCLUDE_OPTIONS,
                      ...(format === "zip"
                        ? [{ key: "preserveStructure", label: "Folder structure", cardLabel: "Preserve folder structure", hint: "ZIP paths mirror library folders; off flattens everything." }]
                        : []),
                    ].map((o) => (
                      <label
                        key={o.key}
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors",
                          includes[o.key]
                            ? "border-border-strong bg-surface-hover"
                            : "border-border bg-surface-card hover:bg-surface-hover",
                        )}
                      >
                        <Checkbox
                          checked={includes[o.key]}
                          onCheckedChange={(v) => setIncludes((prev) => ({ ...prev, [o.key]: v === true }))}
                          className="mt-0.5"
                          aria-label={o.label}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm text-foreground">{o.cardLabel || `Include ${o.label.toLowerCase()}`}</span>
                          <span className="block text-xs leading-5 text-text-tertiary">{o.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </Step>
              </div>
            </SectionCard>

            <SectionCard title="Summary" className="lg:sticky lg:top-4">
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">In scope</p>
                  {estimatingCollection ? (
                    <p className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Counting members…
                    </p>
                  ) : (
                    <p className="mt-1 text-2xl font-bold tabular-nums leading-tight text-foreground">
                      {estimate.length.toLocaleString("en-US")}
                      <span className="ml-1.5 text-sm font-medium text-text-secondary">
                        file{estimate.length === 1 ? "" : "s"} · {formatBytes(estimateBytes)}
                      </span>
                    </p>
                  )}
                </div>

                <DetailList
                  items={[
                    { label: "Scope", value: scopeLabel },
                    { label: "Format", value: EXPORT_FORMAT_MAP[format]?.label || format },
                    format === "zip"
                      ? { label: "Contents", value: "Originals + metadata" }
                      : { label: "Fields", value: `${fields.length} of ${EXPORT_FIELD_OPTIONS.length}` },
                    { label: "Includes", value: includedLabels.length ? includedLabels.join(", ") : "Nothing extra" },
                  ]}
                />

                {format === "zip" ? (
                  <div className="space-y-3">
                    <CapMeter label="Files" used={estimate.length} max={EXPORT_ZIP_MAX_FILES} format={(n) => n.toLocaleString("en-US")} />
                    <CapMeter label="Size" used={estimateBytes} max={EXPORT_ZIP_MAX_BYTES} format={formatBytes} />
                  </div>
                ) : null}

                {overZipCaps ? (
                  <Notice tone="warning">
                    Over the ZIP limits, so the export will be refused. Narrow the scope, or export metadata as
                    CSV/JSON and originals in batches.
                  </Notice>
                ) : null}

                <div className="space-y-2">
                  {runButton}
                  <p className="text-center text-xs text-text-tertiary">
                    {blockedReason || "Downloads right away and is logged below."}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-4">
            <SectionHeading title="Export history" description="Every run, newest first, including failed attempts." />
            <Toolbar>
              <div className="flex items-center gap-2">
                <FilterDropdown value={historyFormat} onValueChange={setHistoryFormat} options={HISTORY_FORMAT_OPTIONS} />
                {historyFiltersActive ? (
                  <ClearFiltersButton onClick={() => { setHistorySearch(""); setHistoryFormat("all"); }} />
                ) : null}
              </div>
              <SearchInput value={historySearch} onChange={setHistorySearch} placeholder="Search history…" />
            </Toolbar>
            <DataTable
              columns={columns}
              data={filteredRuns}
              getRowKey={(r) => r.id}
              empty={
                <div className="rounded-xl border border-border bg-surface-subtle">
                  <EmptyState
                    icon={FileOutput}
                    title={runs.length ? "No runs match your filters" : "No exports yet"}
                    description={
                      runs.length
                        ? "Try clearing the search or format filter."
                        : "Configure an export above and run it — it downloads immediately and shows up here."
                    }
                    action={
                      runs.length ? (
                        <Button
                          variant="outline"
                          className={OUTLINE_BUTTON}
                          onClick={() => { setHistorySearch(""); setHistoryFormat("all"); }}
                        >
                          Clear filters
                        </Button>
                      ) : null
                    }
                  />
                </div>
              }
            />
          </div>
        </>
      )}
    </MainScreenWrapper>
  );
}

export default DataExportScreen;
