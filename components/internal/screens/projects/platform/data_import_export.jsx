"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Download, FileDown, FileUp, Loader2, Trash2, Upload } from "lucide-react";
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
import { ActionMenu } from "@geiger/ui/action-menu";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SectionCard,
  StatsBar,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import { createAsset, listAssets } from "@/lib/supabase/assets";
import {
  createDataJob,
  listDataJobs,
  softDeleteDataJob,
  updateDataJob,
} from "@/lib/supabase/platform";
import {
  ASSET_IMPORT_FIELDS,
  ASSET_IMPORT_FIELD_OPTIONS,
  JOB_FORMAT_OPTIONS,
  JOB_KIND_FILTER_OPTIONS,
  JOB_KIND_MAP,
  JOB_STATUS_FILTER_OPTIONS,
  JOB_STATUS_MAP,
  formatCount,
  formatDateTime,
} from "./constants";

// Data Import and Export — CSV import with a column-mapping step, CSV/JSON
// export of the library, and a run history persisted in assets.data_jobs.
//
// Imports create real assets through lib/supabase/assets.js createAsset (the
// mapping values are its camelCase input keys). Exports are generated
// client-side from the fetched rows and downloaded as a file. Metadata
// mappings pair each source column to one asset field; unmapped columns are
// ignored rather than stored.

// Minimal CSV reader: quoted fields, escaped quotes, CRLF. Anything fancier
// belongs in a library; imports here are small curated files.
function parseCsv(text) {
  const rows = [];
  let current = [];
  let field = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      current.push(field);
      field = "";
    } else if (char === "\n") {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  const nonEmpty = rows.filter((row) => row.some((cell) => String(cell).trim() !== ""));
  if (nonEmpty.length === 0) return { columns: [], rows: [] };
  const columns = nonEmpty[0].map((cell) => String(cell).trim());
  const body = nonEmpty.slice(1).map((row) => {
    const record = {};
    columns.forEach((column, index) => {
      record[column] = String(row[index] ?? "").trim();
    });
    return record;
  });
  return { columns, rows: body };
}

function parseJson(text) {
  const parsed = JSON.parse(String(text || ""));
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const records = list.filter((item) => item && typeof item === "object" && !Array.isArray(item));
  const seen = [];
  const seenSet = new Set();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!seenSet.has(key)) {
        seenSet.add(key);
        seen.push(key);
      }
    }
  }
  return {
    columns: seen,
    rows: records.map((record) => {
      const flat = {};
      for (const column of seen) {
        const value = record[column];
        flat[column] =
          value === null || value === undefined
            ? ""
            : Array.isArray(value)
              ? value.join(", ")
              : String(value);
      }
      return flat;
    }),
  };
}

function autoMap(columns) {
  const mapping = {};
  const byValue = new Map(ASSET_IMPORT_FIELDS.map((field) => [field.value, field.value]));
  const byLabel = new Map(
    ASSET_IMPORT_FIELDS.map((field) => [field.label.toLowerCase(), field.value]),
  );
  for (const column of columns) {
    const key = column.trim().toLowerCase().replace(/[\s_-]+/g, "");
    const compactValues = new Map(
      ASSET_IMPORT_FIELDS.map((field) => [field.value.toLowerCase(), field.value]),
    );
    mapping[column] =
      compactValues.get(key) || byValue.get(column.trim().toLowerCase()) || byLabel.get(column.trim().toLowerCase()) || "ignore";
  }
  return mapping;
}

function toCsvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataImportExportScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobKindFilter, setJobKindFilter] = useState("all");
  const [jobStatusFilter, setJobStatusFilter] = useState("all");
  // Import draft: parsed source file + column mapping.
  const [sourceName, setSourceName] = useState("");
  const [sourceColumns, setSourceColumns] = useState([]);
  const [sourceRows, setSourceRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listAssets(projectId), listDataJobs(projectId)]).then(
      ([assetRows, jobRows]) => {
        if (!alive) return;
        setAssets(assetRows ?? []);
        setJobs(jobRows ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const stats = useMemo(() => {
    const completed = jobs.filter((job) => job.status === "completed");
    const last = jobs[0] || null;
    return [
      { label: "Assets", value: formatCount(assets.length), footer: "in this project" },
      {
        label: "Imports",
        value: String(completed.filter((job) => job.kind === "import").length),
        footer: "completed runs",
      },
      {
        label: "Exports",
        value: String(completed.filter((job) => job.kind === "export").length),
        footer: "completed runs",
      },
      {
        label: "Last run",
        value: last ? last.kind : "—",
        footer: last ? formatDateTime(last.createdAt) : "no runs yet",
      },
    ];
  }, [assets, jobs]);

  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => {
        if (jobKindFilter !== "all" && job.kind !== jobKindFilter) return false;
        if (jobStatusFilter !== "all" && job.status !== jobStatusFilter) return false;
        return true;
      }),
    [jobs, jobKindFilter, jobStatusFilter],
  );

  const mappedPairs = useMemo(
    () =>
      sourceColumns
        .map((column) => ({ source: column, target: mapping[column] || "ignore" }))
        .filter((pair) => pair.target !== "ignore"),
    [sourceColumns, mapping],
  );

  const previewRows = useMemo(() => sourceRows.slice(0, 5), [sourceRows]);

  const pickFile = () => fileRef.current?.click();

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text().catch(() => null);
    if (text === null) {
      toast.error("Couldn't read that file.");
      return;
    }
    try {
      const parsed = file.name.toLowerCase().endsWith(".json") ? parseJson(text) : parseCsv(text);
      if (parsed.columns.length === 0) {
        toast.error("No columns found — the file looks empty.");
        return;
      }
      setSourceName(file.name);
      setSourceColumns(parsed.columns);
      setSourceRows(parsed.rows);
      setMapping(autoMap(parsed.columns));
      toast.success(`Parsed ${formatCount(parsed.rows.length)} rows from ${file.name}.`);
    } catch {
      toast.error("Couldn't parse that file — check it is valid CSV or JSON.");
    }
  };

  const setMappingFor = (column) => (target) =>
    setMapping((prev) => ({ ...prev, [column]: target }));

  const buildAssetInput = (record) => {
    const input = { projectId, status: "draft", folder: "root" };
    for (const { source, target } of mappedPairs) {
      const raw = String(record[source] ?? "").trim();
      if (!raw) continue;
      if (target === "tags") {
        input.tags = raw.split(/[|,;]/).map((tag) => tag.trim()).filter(Boolean);
      } else {
        input[target] = raw;
      }
    }
    if (!String(input.name || "").trim()) return null;
    return input;
  };

  const runImport = async () => {
    if (importing || sourceRows.length === 0) return;
    if (mappedPairs.length === 0) {
      toast.error("Map at least one column to an asset field first.");
      return;
    }
    const jobId = crypto.randomUUID();
    setImporting(true);
    const optimistic = {
      id: jobId,
      projectId,
      kind: "import",
      format: sourceName.toLowerCase().endsWith(".json") ? "json" : "csv",
      status: "running",
      sourceName,
      mapping,
      totalRows: sourceRows.length,
      processedRows: 0,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setJobs((prev) => [optimistic, ...prev]);
    const job = await createDataJob({
      id: jobId,
      projectId,
      kind: "import",
      format: optimistic.format,
      status: "running",
      sourceName,
      mapping,
      totalRows: sourceRows.length,
      processedRows: 0,
    });
    let created = 0;
    let skipped = 0;
    for (const record of sourceRows) {
      const input = buildAssetInput(record);
      if (!input) {
        skipped += 1;
        continue;
      }
      const id = crypto.randomUUID();
      const row = await createAsset({ ...input, id });
      if (row) {
        created += 1;
        setAssets((prev) => [row, ...prev]);
      } else {
        skipped += 1;
      }
    }
    const status = created > 0 ? "completed" : "failed";
    const error = created > 0 ? null : "No rows could be imported — every row failed validation.";
    const saved = job
      ? await updateDataJob(job.id, { status, processedRows: created, error })
      : false;
    setJobs((prev) =>
      prev.map((item) =>
        item.id === jobId
          ? { ...item, status, processedRows: created, error, updatedAt: new Date().toISOString() }
          : item,
      ),
    );
    if (!saved && job) toast.error("Import finished but the run history didn't persist.");
    setImporting(false);
    if (created > 0) {
      toast.success(`Imported ${formatCount(created)} asset${created === 1 ? "" : "s"}${skipped ? `, ${skipped} skipped` : ""}.`);
      setSourceName("");
      setSourceColumns([]);
      setSourceRows([]);
      setMapping({});
    } else {
      toast.error("Nothing imported — map the Name column and try again.");
    }
  };

  const runExport = async () => {
    if (exporting) return;
    if (assets.length === 0) {
      toast.error("Nothing to export — the library is empty.");
      return;
    }
    setExporting(true);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `assets-export-${stamp}.${exportFormat}`;
    try {
      if (exportFormat === "csv") {
        const header = ["name", "type", "folder", "status", "description", "tags", "format", "mimeType", "originalFilename"];
        const lines = [header.join(",")];
        for (const asset of assets) {
          lines.push(
            [
              asset.name,
              asset.type,
              asset.folder,
              asset.status,
              asset.description,
              (asset.tags || []).join("|"),
              asset.format,
              asset.mimeType,
              asset.originalFilename,
            ]
              .map(toCsvCell)
              .join(","),
          );
        }
        downloadFile(filename, lines.join("\n"), "text/csv");
      } else {
        downloadFile(filename, JSON.stringify(assets, null, 2), "application/json");
      }
      const jobId = crypto.randomUUID();
      const optimistic = {
        id: jobId,
        projectId,
        kind: "export",
        format: exportFormat,
        status: "completed",
        sourceName: filename,
        mapping: {},
        totalRows: assets.length,
        processedRows: assets.length,
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setJobs((prev) => [optimistic, ...prev]);
      const recorded = await createDataJob({
        id: jobId,
        projectId,
        kind: "export",
        format: exportFormat,
        status: "completed",
        sourceName: filename,
        totalRows: assets.length,
        processedRows: assets.length,
      });
      if (recorded) {
        setJobs((prev) => prev.map((item) => (item.id === jobId ? recorded : item)));
      }
      toast.success(`Exported ${formatCount(assets.length)} assets to ${filename}.`);
    } catch {
      toast.error("Couldn't generate the export.");
    }
    setExporting(false);
  };

  const removeJob = async (job) => {
    const previous = jobs;
    setJobs((prev) => prev.filter((item) => item.id !== job.id));
    const ok = await softDeleteDataJob(job.id);
    if (!ok) {
      setJobs(previous);
      toast.error("Couldn't delete that run.");
      return;
    }
    toast.success("Run deleted.");
  };

  const previewColumns = useMemo(
    () =>
      mappedPairs.slice(0, 4).map((pair) => ({
        key: pair.source,
        header: pair.source,
        render: (record) => (
          <span className="block max-w-[220px] truncate text-xs text-text-secondary">
            {String(record[pair.source] ?? "") || "—"}
          </span>
        ),
      })),
    [mappedPairs],
  );

  const jobColumns = [
    {
      key: "run",
      header: "Run",
      render: (job) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[280px] truncate font-medium text-foreground">
            {job.sourceName || `${job.kind} ${job.format.toUpperCase()}`}
          </span>
          <span className="text-[11px] text-text-tertiary">
            {formatDateTime(job.createdAt)} · {formatCount(job.processedRows)}/
            {formatCount(job.totalRows)} rows
          </span>
          {job.error ? (
            <span className="max-w-[320px] truncate text-[11px] text-red-400">{job.error}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      className: "hidden sm:table-cell",
      headClassName: "hidden sm:table-cell",
      render: (job) => <StatusPill status={job.kind} map={JOB_KIND_MAP} />,
    },
    {
      key: "status",
      header: "Status",
      render: (job) => <StatusPill status={job.status} map={JOB_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (job) => (
        <div onClick={(event) => event.stopPropagation()}>
          <ActionMenu
            label={`Actions for ${job.sourceName || job.kind}`}
            items={[
              { icon: Trash2, label: "Delete run", destructive: true, onSelect: () => removeJob(job) },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Data Import & Export"
        description="Bulk asset import from CSV or JSON with a column-mapping step, full-library export, and a history of every run."
      />

      <StatsBar stats={stats} />

      <SectionCard
        title="Import"
        description="Pick a CSV or JSON file, pair its columns to asset fields, then run the import. Rows without a name are skipped."
        action={
          <span className="flex items-center gap-2">
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              aria-label="Choose an import file"
              onChange={onFile}
            />
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-surface-card text-foreground hover:bg-surface-active"
              onClick={pickFile}
            >
              <FileUp className="h-3.5 w-3.5" /> Choose file
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={importing || sourceRows.length === 0 || mappedPairs.length === 0}
              onClick={runImport}
            >
              {importing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" /> Run import
                </>
              )}
            </Button>
          </span>
        }
      >
        {sourceColumns.length === 0 ? (
          <EmptyState
            icon={FileUp}
            title="No file selected"
            description="Choose a CSV file (first row as headers) or a JSON array of objects to map its columns."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={pickFile}
              >
                <FileUp className="h-4 w-4" /> Choose file
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-text-secondary">
              {sourceName} · {formatCount(sourceRows.length)} rows · {mappedPairs.length} of{" "}
              {sourceColumns.length} columns mapped
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {sourceColumns.map((column) => (
                <div
                  key={column}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background p-2.5"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                    {column}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                  <Select value={mapping[column] || "ignore"} onValueChange={setMappingFor(column)}>
                    <SelectTrigger className="h-8 w-[180px] shrink-0 bg-surface-card text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-surface-subtle">
                      {ASSET_IMPORT_FIELD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {previewRows.length > 0 && previewColumns.length > 0 ? (
              <DataTable
                columns={previewColumns}
                data={previewRows}
                getRowKey={(_, index) => `preview-${index}`}
              />
            ) : (
              <p className="text-xs text-text-tertiary">
                Map at least one column to preview the first rows.
              </p>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Export"
        description="Download the whole library with its metadata. Scheduled feeds and migration tooling build on this same shape."
        action={
          <span className="flex items-center gap-2">
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger className="h-8 w-[120px] bg-surface-card text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-surface-subtle">
                {JOB_FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={exporting || loading || assets.length === 0}
              onClick={runExport}
            >
              {exporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting…
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" /> Export {formatCount(assets.length)}
                </>
              )}
            </Button>
          </span>
        }
      >
        <div className="grid gap-2 text-xs text-text-secondary sm:grid-cols-3">
          <span>CSV carries name, type, folder, status, description, tags, and file fields.</span>
          <span>JSON carries the full asset record, tags and metadata included.</span>
          <span>Exports never include bytes — only the library metadata.</span>
        </div>
      </SectionCard>

      <SectionCard
        title="Run history"
        description="Every import and export, newest first."
        action={
          <span className="flex items-center gap-2">
            <FilterDropdown
              value={jobKindFilter}
              onValueChange={setJobKindFilter}
              options={JOB_KIND_FILTER_OPTIONS}
              height="h-8"
            />
            <FilterDropdown
              value={jobStatusFilter}
              onValueChange={setJobStatusFilter}
              options={JOB_STATUS_FILTER_OPTIONS}
              height="h-8"
            />
          </span>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <LogoLoading size={40} aria-label="Loading runs" />
          </div>
        ) : (
          <DataTable
            columns={jobColumns}
            data={filteredJobs}
            getRowKey={(job) => job.id}
            empty={
              <EmptyState
                icon={FileDown}
                title={jobs.length === 0 ? "No runs yet" : "No runs match these filters"}
                description={
                  jobs.length === 0
                    ? "Run your first import or export — it will be recorded here."
                    : "Try a different kind or status."
                }
                action={
                  jobs.length === 0 ? null : (
                    <Button
                      variant="outline"
                      className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                      onClick={() => {
                        setJobKindFilter("all");
                        setJobStatusFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  )
                }
              />
            }
          />
        )}
      </SectionCard>
    </MainScreenWrapper>
  );
}

export default DataImportExportScreen;
