"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link2,
  Plus,
  X,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Copy,
  Trash2,
  Eye,
  Globe,
  Blocks,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Textarea } from "@geiger/ui/textarea";
import { ActionMenu } from "@geiger/ui/action-menu";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SectionCard,
  SegmentedTabs,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import { FolderPicker, folderPath } from "@/components/internal/shared/folder_explorer";
import { TagInput } from "@/components/internal/screens/projects/library/tag_input";
import {
  TYPE_ICONS,
  FILE_TYPE_COLORS,
  STATUS_META,
  QUALITY_PRESETS,
  formatBytes,
  formatDate,
} from "@/components/internal/screens/projects/uploads/constants";
import { UploadJobDetailScreen } from "@/components/internal/screens/projects/uploads/upload_job_detail";
import {
  listUploadJobs,
  createUploadJob,
  updateUploadJob,
  deleteUploadJob,
} from "@/lib/supabase/uploads";
import {
  importAssetFromUrl,
  REMOTE_IMPORT_MAX_BYTES,
  UPLOAD_ERROR_MESSAGES,
} from "@/lib/storage/client";
import {
  REMOTE_STATUS_FILTER_OPTIONS,
  REMOTE_SORT_OPTIONS,
  splitLinkText,
  looksLikeLink,
  normalizeLink,
  hostFromLink,
  filenameFromLink,
  typeFromLink,
} from "./constants";
import { ExternalSourcesSheet } from "./external_sources_sheet";
import { CsvLinkDialog } from "./csv_link_dialog";
import { UploadPortalDetailScreen } from "./upload_portal_detail";

const IMPORT_CONCURRENCY = 2;

const PLACEHOLDER = `https://images.example.com/hero-shot.jpg
https://cdn.example.com/brand/logo.svg
https://files.example.com/deck.pdf`;

function StagedLinkRow({ item, onRemove }) {
  const Icon = TYPE_ICONS[item.fileType] || Link2;
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
        item.valid && !item.duplicate
          ? "border-border bg-surface-card"
          : "border-amber-500/30 bg-amber-500/5",
      )}
    >
      {item.valid ? (
        <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{item.filename}</p>
        <p className="truncate text-xs text-text-tertiary">{item.host || item.url}</p>
      </div>
      {!item.valid ? (
        <Badge className="shrink-0 border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-300">
          Invalid link
        </Badge>
      ) : item.duplicate ? (
        <Badge className="shrink-0 border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-300">
          Already imported
        </Badge>
      ) : null}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${item.filename}`}
        className="shrink-0 text-text-tertiary opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        onClick={() => onRemove(item.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ExternalUploadsScreen({ projectId }) {
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const [text, setText] = useState("");
  const [staged, setStaged] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const [folder, setFolder] = useState(null);
  const [tags, setTags] = useState([]);
  const [quality, setQuality] = useState("original");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortValue, setSortValue] = useState("created-desc");

  const [showSources, setShowSources] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [openJobId, setOpenJobId] = useState(null);
  const [openPortalId, setOpenPortalId] = useState(null);

  const [portalsVersion, setPortalsVersion] = useState(0);

  useEffect(() => {
    listUploadJobs(projectId).then((rows) => {
      setJobs((rows ?? []).filter((j) => j.source === "url"));
      setLoadingJobs(false);
    });
  }, [projectId]);

  const importedUrls = useMemo(
    () => new Set(jobs.map((j) => j.sourceUrl).filter(Boolean)),
    [jobs],
  );

  const addLinks = useCallback(
    (candidates) => {
      if (!candidates.length) return;
      setStaged((prev) => {
        const seen = new Set(prev.map((s) => s.url));
        const next = [...prev];
        for (const candidate of candidates) {
          const url = normalizeLink(candidate);
          if (!url || seen.has(url)) continue;
          seen.add(url);
          next.push({
            id: crypto.randomUUID(),
            url,
            filename: filenameFromLink(url),
            host: hostFromLink(url),
            fileType: typeFromLink(url),
            valid: looksLikeLink(url),
            duplicate: importedUrls.has(url),
          });
        }
        const added = next.length - prev.length;
        if (added === 0) toast.info("Those links are already in the list.");
        return next;
      });
    },
    [importedUrls],
  );

  const addFromText = () => {
    const candidates = splitLinkText(text);
    if (!candidates.length) {
      toast.error("Paste one or more links first.");
      return;
    }
    addLinks(candidates);
    setText("");
  };

  const removeStaged = (id) => setStaged((prev) => prev.filter((s) => s.id !== id));
  const clearStaged = () => setStaged([]);

  const ready = useMemo(() => staged.filter((s) => s.valid && !s.duplicate), [staged]);
  const detected = useMemo(() => (text.trim() ? splitLinkText(text).length : 0), [text]);
  const invalidCount = staged.length - ready.length;

  const runImport = useCallback(
    async ({ id, url, filename, fileType, destination }) => {
      let failure = null;
      const asset = await importAssetFromUrl(url, {
        projectId,
        uploadJobId: id,
        folder: destination,
        tags,
        quality,
        onError: (code) => {
          failure = code;
        },
      });

      if (asset) {
        setJobs((rows) =>
          rows.map((j) =>
            j.id === id
              ? {
                  ...j,
                  status: "completed",
                  progress: 100,
                  error: "",
                  assetId: asset.id,
                  filename: asset.name || filename,
                  fileType: asset.type || fileType,
                  sizeBytes: asset.sizeBytes ?? 0,
                }
              : j,
          ),
        );
        return true;
      }

      const message = UPLOAD_ERROR_MESSAGES[failure] || "Import failed";
      setJobs((rows) =>
        rows.map((j) => (j.id === id ? { ...j, status: "failed", progress: 0, error: message } : j)),
      );

      await updateUploadJob(id, { status: "failed", progress: 0, error: message });
      return false;
    },
    [projectId, quality, tags],
  );

  const handleImportAll = async () => {
    if (!ready.length || importing) return;
    if (!projectId) {
      toast.error("Open a project before importing links.");
      return;
    }

    const destination = folder ? folderPath(folder) : "root";
    const batch = ready.map((item) => ({
      id: crypto.randomUUID(),
      url: item.url,
      filename: item.filename,
      fileType: item.fileType,
      destination,
    }));

    setImporting(true);
    setProgress({ done: 0, total: batch.length });
    setStaged((prev) => prev.filter((s) => !s.valid || s.duplicate));

    let done = 0;
    let failed = 0;
    for (let i = 0; i < batch.length; i += IMPORT_CONCURRENCY) {
      const slice = batch.slice(i, i + IMPORT_CONCURRENCY);
      const results = await Promise.all(
        slice.map(async (item) => {
          const optimistic = {
            id: item.id,
            projectId: projectId ?? null,
            filename: item.filename,
            fileType: item.fileType,
            sizeBytes: 0,
            status: "uploading",
            progress: 0,
            source: "url",
            error: "",
            assetId: null,
            sourceUrl: item.url,
            destination: item.destination,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setJobs((rows) => [optimistic, ...rows]);
          const created = await createUploadJob({
            id: item.id,
            projectId: projectId ?? null,
            filename: item.filename,
            fileType: item.fileType,
            sizeBytes: 0,
            status: "uploading",
            progress: 0,
            source: "url",
            metadata: { sourceUrl: item.url, destination: item.destination },
          });
          if (!created) {
            setJobs((rows) => rows.filter((j) => j.id !== item.id));
            return false;
          }
          return runImport(item);
        }),
      );
      for (const ok of results) {
        if (ok) done += 1;
        else failed += 1;
      }
      setProgress({ done: done + failed, total: batch.length });
    }

    setImporting(false);
    setProgress({ done: 0, total: 0 });
    if (done > 0 && failed === 0) toast.success(`${done} link${done !== 1 ? "s" : ""} imported`);
    else if (done > 0) toast.warning(`${done} imported, ${failed} failed`);
    else toast.error("Couldn't import those links.");
  };

  const handleRetry = async (job) => {
    if (!job.sourceUrl) {
      toast.error("That job has no source link to retry.");
      return;
    }
    setJobs((rows) =>
      rows.map((j) => (j.id === job.id ? { ...j, status: "uploading", progress: 0, error: "" } : j)),
    );
    await updateUploadJob(job.id, { status: "uploading", progress: 0, error: "" });
    const ok = await runImport({
      id: job.id,
      url: job.sourceUrl,
      filename: job.filename,
      fileType: job.fileType,
      destination: job.destination || "root",
    });
    if (ok) toast.success("Import finished.");
  };

  const handleCopyLink = async (job) => {
    try {
      await navigator.clipboard.writeText(job.sourceUrl || "");
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  };

  const handleRemoveJob = async (job) => {
    const prev = jobs;
    setJobs((rows) => rows.filter((j) => j.id !== job.id));
    const ok = await deleteUploadJob(job.id);
    if (!ok) {
      setJobs(prev);
      toast.error("Couldn't remove that row.");
      return;
    }
    toast.success("Removed from the queue.");
  };

  const syncJob = (updated) =>
    setJobs((rows) => rows.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)));

  const filtersActive = statusFilter !== "all" || Boolean(search);

  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
  };

  const filtered = useMemo(() => {
    let result = [...jobs];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (j) =>
          j.filename.toLowerCase().includes(q) ||
          String(j.sourceUrl || "").toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((j) =>
        statusFilter === "completed"
          ? j.status === "completed" || j.status === "complete"
          : j.status === statusFilter,
      );
    }
    const [field, direction] = sortValue.split("-");
    result.sort((a, b) => {
      let cmp = 0;
      if (field === "created") cmp = new Date(a.createdAt) - new Date(b.createdAt);
      else if (field === "name") cmp = a.filename.localeCompare(b.filename);
      else if (field === "size") cmp = a.sizeBytes - b.sizeBytes;
      return direction === "desc" ? -cmp : cmp;
    });
    return result;
  }, [jobs, search, statusFilter, sortValue]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${statusFilter}|${sortValue}`,
  });

  const qualityHint = QUALITY_PRESETS.find((q) => q.value === quality)?.desc || "";

  const columns = [
    {
      key: "filename",
      header: "File",
      render: (j) => {
        const Icon = TYPE_ICONS[j.fileType] || Link2;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
              <Icon className="h-4 w-4 text-text-secondary" />
            </div>
            <div className="min-w-0">
              <p className="max-w-[280px] truncate text-sm font-medium text-foreground">
                {j.filename || "Untitled"}
              </p>
              <p className="mt-0.5 max-w-[280px] truncate text-[11px] text-text-tertiary">
                {j.sourceUrl || "—"}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      render: (j) => (
        <Badge className={cn("border px-1.5 py-0 text-[10px]", FILE_TYPE_COLORS[j.fileType])}>
          {j.fileType}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (j) => (
        <div className="flex items-center gap-2">
          <StatusPill status={j.status} map={STATUS_META} />
          {j.status === "uploading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-text-tertiary" />
          ) : null}
          {j.status === "failed" && j.error ? (
            <span className="max-w-[160px] truncate text-[11px] text-red-400">{j.error}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      className: "tabular-nums text-xs text-text-secondary",
      render: (j) => (j.sizeBytes ? formatBytes(j.sizeBytes) : "—"),
    },
    {
      key: "created",
      header: "Added",
      className: "text-xs text-text-secondary hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (j) => formatDate(j.createdAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (j) => (
        <ActionMenu
          label={`Actions for ${j.filename || "this import"}`}
          contentClassName="border-border bg-surface-subtle text-foreground"
          items={[
            { icon: Eye, label: "View details", onSelect: () => setOpenJobId(j.id) },
            j.status === "failed" && {
              icon: RotateCcw,
              label: "Retry import",
              onSelect: () => handleRetry(j),
            },
            j.sourceUrl && {
              icon: Copy,
              label: "Copy link",
              onSelect: () => handleCopyLink(j),
            },
            j.sourceUrl && {
              icon: ExternalLink,
              label: "Open source",
              href: j.sourceUrl,
            },
            { separator: true },
            {
              icon: Trash2,
              label: "Remove",
              variant: "destructive",
              onSelect: () => handleRemoveJob(j),
            },
          ]}
        />
      ),
    },
  ];

  if (openPortalId) {
    return (
      <UploadPortalDetailScreen
        key={openPortalId}
        id={openPortalId}
        onBack={() => setOpenPortalId(null)}
        onChange={() => setPortalsVersion((v) => v + 1)}
      />
    );
  }

  if (openJobId) {
    return (
      <UploadJobDetailScreen
        key={openJobId}
        id={openJobId}
        onBack={() => setOpenJobId(null)}
        onChange={syncJob}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="External Uploads"
        description="Pull files into the library straight from a public link — paste a batch, or bring a column of URLs in from a CSV."
        actions={
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => setShowSources(true)}
          >
            <Blocks className="h-4 w-4" />
            Sources &amp; Portals
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">

        <div className="flex min-h-[320px] flex-col rounded-xl border border-border bg-surface-subtle p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
                <Globe className="h-3.5 w-3.5 text-text-secondary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Import from links</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  One link per line — up to {formatBytes(REMOTE_IMPORT_MAX_BYTES)} per file.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Import links from CSV"
              title="Import links from CSV"
              className="shrink-0 text-text-tertiary hover:bg-surface-active hover:text-foreground"
              onClick={() => setShowCsv(true)}
            >
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
          </div>

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                addFromText();
              }
            }}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            className={cn(
              "resize-none bg-surface-card text-sm leading-6",
              staged.length ? "min-h-[112px]" : "min-h-[140px] flex-1",
            )}
          />

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <p className="text-xs text-text-tertiary">
              {detected
                ? `${detected} link${detected !== 1 ? "s" : ""} detected`
                : "Paste links, then add them to the queue."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-surface-card text-foreground hover:bg-surface-hover"
              onClick={addFromText}
              disabled={!text.trim()}
            >
              <Plus className="h-4 w-4" />
              Add links
            </Button>
          </div>

          {staged.length ? (
            <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-border pt-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {ready.length} ready
                  {invalidCount > 0 ? (
                    <span className="ml-2 text-xs font-normal text-amber-400">
                      {invalidCount} skipped
                    </span>
                  ) : null}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-text-secondary hover:text-foreground"
                  onClick={clearStaged}
                >
                  Clear all
                </Button>
              </div>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 [max-height:15rem]">
                {staged.map((item) => (
                  <StagedLinkRow key={item.id} item={item} onRemove={removeStaged} />
                ))}
              </div>
              <Button
                className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleImportAll}
                disabled={importing || !ready.length}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing {progress.done}/{progress.total}…
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Import {ready.length} link{ready.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </div>

        <SectionCard title="Import options" description="Applied to every link in this batch.">
          <div className="grid gap-5">
            <Field
              label="Destination folder"
              hint="Browse the project's folders to pick where these land."
            >
              <FolderPicker projectId={projectId} value={folder} onChange={setFolder} />
            </Field>

            <Field label="Tags" hint="Press Enter or comma to add a tag.">
              <TagInput value={tags} onChange={setTags} placeholder="campaign, hero, 2025…" />
            </Field>

            <Field label="Quality preset" hint={qualityHint}>
              <SegmentedTabs
                fullWidth
                tabs={QUALITY_PRESETS.map((q) => ({
                  value: q.value,
                  label: q.label,
                  icon: q.icon,
                }))}
                value={quality}
                onChange={setQuality}
              />
            </Field>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-4">
        <Toolbar>
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={REMOTE_STATUS_FILTER_OPTIONS}
              height="h-9"
            />
            <FilterDropdown
              value={sortValue}
              onValueChange={setSortValue}
              options={REMOTE_SORT_OPTIONS}
              height="h-9"
            />
            {filtersActive ? (
              <Button
                variant="ghost"
                className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                onClick={clearFilters}
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            ) : null}
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search imports…" />
        </Toolbar>

        {loadingJobs ? (
          <LoadingArea panel size={56} />
        ) : (
          <div className="space-y-5">
            <DataTable
              columns={columns}
              data={pager.pageItems}
              getRowKey={(j) => j.id}
              onRowClick={(j) => setOpenJobId(j.id)}
              empty={
                <div className="rounded-xl border border-border bg-surface-subtle">
                  <EmptyState
                    icon={Link2}
                    title={filtersActive ? "No matching imports" : "No remote imports yet"}
                    description={
                      filtersActive
                        ? "Try adjusting your filters."
                        : "Paste a link above to pull your first file in from the web."
                    }
                    action={
                      filtersActive ? (
                        <Button
                          variant="outline"
                          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                          onClick={clearFilters}
                        >
                          Clear filters
                        </Button>
                      ) : null
                    }
                  />
                </div>
              }
            />
            <ListPagination {...pager} itemLabel="imports" />
          </div>
        )}
      </div>

      <CsvLinkDialog open={showCsv} onOpenChange={setShowCsv} onAddLinks={addLinks} />

      <ExternalSourcesSheet
        projectId={projectId}
        open={showSources}
        onOpenChange={setShowSources}
        reloadKey={portalsVersion}
        onOpenPortal={(id) => {
          setShowSources(false);
          setOpenPortalId(id);
        }}
      />
    </MainScreenWrapper>
  );
}

export default ExternalUploadsScreen;
