"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UploadCloud,
  File,
  X,
  Trash2,
  Eye,
  RotateCcw,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { ActionMenu } from "@geiger/ui/action-menu";
import { Progress } from "@geiger/ui/progress";
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
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
import { TagInput } from "@/components/internal/screens/projects/library/tag_input";
import { FolderPicker, folderPath } from "@/components/internal/shared/folder_explorer";
import {
  TYPE_ICONS,
  FILE_TYPE_COLORS,
  STATUS_META,
  STATUS_FILTER_OPTIONS,
  SORT_OPTIONS,
  QUALITY_PRESETS,
  formatBytes,
  formatDate,
} from "./constants";
import {
  listUploadJobs,
  createUploadJob,
  updateUploadJob,
  deleteUploadJob,
} from "@/lib/supabase/uploads";
import { uploadAsset, UPLOAD_ERROR_MESSAGES } from "@/lib/storage/client";
import { toast } from "sonner";
import { FileDropzone } from "@/components/internal/shared/file_dropzone";
import { uniqueId } from "@/lib/utils";
import { UploadJobDetailScreen } from "./upload_job_detail";

function guessFileType(file) {
  const mime = file.type || "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/zip" || mime === "application/x-zip-compressed") return "archive";
  if (mime.startsWith("model/") || file.name.endsWith(".glb") || file.name.endsWith(".obj"))
    return "3d";
  if (mime.startsWith("text/") || mime.includes("document") || mime.includes("sheet"))
    return "document";
  return "raw";
}

function StagedFileCard({ file, onRemove }) {
  const Icon = TYPE_ICONS[file.fileType] || File;
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-hover">
        <Icon className="h-4 w-4 text-text-secondary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
        <p className="text-xs text-text-tertiary">{formatBytes(file.size)}</p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${file.name}`}
        className="shrink-0 text-text-tertiary opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
        onClick={() => onRemove(file.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function QueueProgress({ progress }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  return (
    <div className="flex items-center gap-2">
      <Progress value={pct} className="h-1.5 w-24 bg-surface-card" />
      <span className="w-8 shrink-0 tabular-nums text-xs text-text-secondary">{pct}%</span>
    </div>
  );
}

function QueueRowActions({ job, onView, onRetry, onDelete }) {
  return (
    <ActionMenu
      label={`Actions for ${job.filename}`}
      items={[
        { icon: Eye, label: "View", onSelect: () => onView(job) },
        { icon: RotateCcw, label: "Retry", onSelect: () => onRetry(job) },
        { separator: true },
        { icon: Trash2, label: "Delete", destructive: true, onSelect: () => onDelete(job) },
      ]}
    />
  );
}

export function UploadCenterScreen({ projectId }) {
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const [staged, setStaged] = useState([]);
  const [uploading, setUploading] = useState(false);

  const fileRefs = useRef(new Map());

  const [folder, setFolder] = useState(null);
  const [tags, setTags] = useState([]);
  const [quality, setQuality] = useState("original");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortValue, setSortValue] = useState("created-desc");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    listUploadJobs(projectId).then((rows) => {
      setJobs(rows ?? []);
      setLoadingJobs(false);
    });
  }, [projectId]);

  const addFiles = useCallback((files) => {
    const next = Array.from(files || [])
      .filter((f) => f instanceof Blob)
      .map((f) => ({
        id: uniqueId(),
        name: f.name || "file",
        size: f.size,
        fileType: guessFileType(f),
        file: f,
      }));
    if (next.length) setStaged((prev) => [...prev, ...next]);
  }, []);

  const removeStaged = (id) => setStaged((prev) => prev.filter((f) => f.id !== id));
  const clearStaged = () => setStaged([]);

  const setJobProgress = useCallback(
    (id, progress) =>
      setJobs((rows) => rows.map((j) => (j.id === id ? { ...j, progress } : j))),
    [],
  );

  const runRealUpload = useCallback(
    async (jobId, file) => {
      setJobs((rows) =>
        rows.map((j) => (j.id === jobId ? { ...j, status: "uploading", progress: 1, error: "" } : j)),
      );
      let failure = null;
      const asset = await uploadAsset(file, {
        projectId,
        folder: folder ? folderPath(folder) : "root",
        tags,
        quality,
        onProgress: (progress) => setJobProgress(jobId, progress),
        onError: (code) => {
          failure = code;
        },
      });
      if (asset) {
        setJobs((rows) =>
          rows.map((j) =>
            j.id === jobId
              ? { ...j, status: "completed", progress: 100, assetId: asset.id, error: "" }
              : j,
          ),
        );
        await updateUploadJob(jobId, { status: "completed", progress: 100, assetId: asset.id });
        fileRefs.current.delete(jobId);
        return true;
      }
      const message = UPLOAD_ERROR_MESSAGES[failure] || "Upload failed";
      setJobs((rows) =>
        rows.map((j) =>
          j.id === jobId ? { ...j, status: "failed", error: message } : j,
        ),
      );
      await updateUploadJob(jobId, { status: "failed", error: message });
      return false;
    },
    [folder, projectId, quality, setJobProgress, tags],
  );

  const handleUploadAll = async () => {
    if (!staged.length || uploading) return;
    setUploading(true);
    const toUpload = [...staged];
    setStaged([]);
    let done = 0;
    let failed = 0;
    const pool = 3;
    for (let i = 0; i < toUpload.length; i += pool) {
      const batch = toUpload.slice(i, i + pool);
      const results = await Promise.all(
        batch.map(async (f) => {
          const id = uniqueId();
          const optimistic = {
            id,
            projectId: projectId ?? null,
            filename: f.name,
            fileType: f.fileType,
            sizeBytes: f.size,
            status: "uploading",
            progress: 0,
            source: "drag-drop",
            error: "",
            assetId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setJobs((prev) => [optimistic, ...prev]);
          const created = await createUploadJob({
            id,
            projectId: projectId ?? null,
            filename: f.name,
            fileType: f.fileType,
            sizeBytes: f.size,
            status: "uploading",
            progress: 0,
            source: "drag-drop",
          });
          if (!created) {
            setJobs((prev) => prev.filter((j) => j.id !== id));
            return false;
          }
          fileRefs.current.set(id, f.file);
          return runRealUpload(id, f.file);
        }),
      );
      for (const ok of results) {
        if (ok) done += 1;
        else failed += 1;
      }
    }
    setUploading(false);
    if (done > 0 && failed === 0) toast.success(`${done} file${done !== 1 ? "s" : ""} uploaded`);
    else if (done > 0) toast.warning(`${done} uploaded, ${failed} failed`);
    else if (failed > 0) toast.error("Upload failed");
  };

  const handleRetry = async (job) => {
    const file = fileRefs.current.get(job.id);
    if (file) {
      setJobs((rows) =>
        rows.map((j) =>
          j.id === job.id ? { ...j, status: "queued", progress: 0, error: "" } : j,
        ),
      );
      await updateUploadJob(job.id, { status: "uploading", progress: 0, error: "" });
      const ok = await runRealUpload(job.id, file);
      if (!ok) toast.error(`Couldn't upload ${job.filename}.`);
      return;
    }
    const prev = jobs;
    setJobs((rows) =>
      rows.map((j) =>
        j.id === job.id ? { ...j, status: "queued", progress: 0, error: "" } : j,
      ),
    );
    const updated = await updateUploadJob(job.id, { status: "queued", progress: 0, error: "" });
    if (!updated) setJobs(prev);
  };

  const handleDelete = async (job) => {
    const prev = jobs;
    setJobs((rows) => rows.filter((j) => j.id !== job.id));
    const ok = await deleteUploadJob(job.id);
    if (!ok) setJobs(prev);
  };

  const syncJob = (updated) =>
    setJobs((rows) => rows.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)));

  const filtered = useMemo(() => {
    let result = [...jobs];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((j) => j.filename.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") result = result.filter((j) => j.status === statusFilter);
    const [field, direction] = sortValue.split("-");
    result.sort((a, b) => {
      let cmp = 0;
      if (field === "created") cmp = new Date(a.createdAt) - new Date(b.createdAt);
      else if (field === "name") cmp = a.filename.localeCompare(b.filename);
      else if (field === "size") cmp = a.sizeBytes - b.sizeBytes;
      else if (field === "progress") cmp = a.progress - b.progress;
      return direction === "desc" ? -cmp : cmp;
    });
    return result;
  }, [jobs, search, statusFilter, sortValue]);

  const stagedBytes = useMemo(
    () => staged.reduce((sum, f) => sum + (f.size || 0), 0),
    [staged],
  );

  const pager = usePagination(filtered, {
    resetKey: `${search}|${statusFilter}|${sortValue}`,
  });

  const qualityHint = QUALITY_PRESETS.find((q) => q.value === quality)?.desc || "";
  const filtersActive = statusFilter !== "all" || Boolean(search);

  const columns = [
    {
      key: "filename",
      header: "File",
      render: (j) => {
        const Icon = TYPE_ICONS[j.fileType] || File;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
              <Icon className="h-4 w-4 text-text-secondary" />
            </div>
            <p className="max-w-[240px] truncate text-sm font-medium text-foreground">
              {j.filename}
            </p>
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
      key: "size",
      header: "Size",
      className: "tabular-nums text-sm text-muted-foreground",
      render: (j) => formatBytes(j.sizeBytes),
    },
    {
      key: "progress",
      header: "Progress",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (j) => <QueueProgress progress={j.progress} />,
    },
    {
      key: "status",
      header: "Status",
      render: (j) => <StatusPill status={j.status} map={STATUS_META} />,
    },
    {
      key: "created",
      header: "Created",
      className: "text-sm text-text-secondary hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (j) => formatDate(j.createdAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (j) => (
        <QueueRowActions
          job={j}
          onView={(x) => setSelected(x.id)}
          onRetry={handleRetry}
          onDelete={handleDelete}
        />
      ),
    },
  ];

  if (selected) {
    return (
      <UploadJobDetailScreen
        key={selected}
        id={selected}
        onBack={() => setSelected(null)}
        onChange={syncJob}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Upload Center"
        description="Bring files into the library from your device or connected sources."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">

        <FileDropzone
          onFiles={addFiles}
          className={cn(
            "flex min-h-[320px] flex-col rounded-xl border-2 border-dashed transition-colors",
            "border-border bg-surface-subtle hover:border-border-strong",
          )}
        >
          {({ browseId, dragging }) => (
            <div
              className={cn(
                "flex flex-1 flex-col rounded-[10px] transition-colors",
                dragging && "bg-primary/5",
                staged.length === 0 && "items-center justify-center",
              )}
            >
              {staged.length === 0 ? (
                <label
                  htmlFor={browseId}
                  className="flex cursor-pointer flex-col items-center gap-3 px-6 py-12 text-center"
                >
                  <span
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-card transition-colors",
                      dragging && "border-primary/40 bg-primary/10",
                    )}
                  >
                    <UploadCloud
                      className={cn(
                        "h-7 w-7 transition-colors",
                        dragging ? "text-primary" : "text-text-secondary",
                      )}
                    />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      {dragging ? "Drop files here" : "Drag & drop files here"}
                    </span>
                    <span className="mt-1 block text-sm text-text-tertiary">
                      or{" "}
                      <span className="text-primary underline-offset-2 hover:underline">
                        browse your device
                      </span>
                    </span>
                  </span>
                  <span className="text-xs text-text-tertiary">
                    Images, video, audio, documents, 3D models and archives
                  </span>
                </label>
              ) : (
                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {staged.length} file{staged.length !== 1 ? "s" : ""} staged
                      <span className="ml-2 text-xs font-normal text-text-tertiary">
                        {formatBytes(stagedBytes)}
                      </span>
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="text-text-secondary hover:text-foreground" asChild>
                        <label htmlFor={browseId} className="cursor-pointer">
                          <Plus className="h-4 w-4" />
                          Add more
                        </label>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-text-secondary hover:text-foreground"
                        onClick={clearStaged}
                      >
                        Clear all
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {staged.map((f) => (
                      <StagedFileCard key={f.id} file={f} onRemove={removeStaged} />
                    ))}
                  </div>
                  <Button
                    className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleUploadAll}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Queuing uploads…
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-4 w-4" />
                        Upload {staged.length} file{staged.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </FileDropzone>

        <SectionCard
          title="Upload options"
          description="Applied to every file in this batch."
        >
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
              options={STATUS_FILTER_OPTIONS}
              height="h-9"
            />
            <FilterDropdown
              value={sortValue}
              onValueChange={setSortValue}
              options={SORT_OPTIONS}
              height="h-9"
            />
            {filtersActive ? (
              <Button
                variant="ghost"
                className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                onClick={() => {
                  setStatusFilter("all");
                  setSearch("");
                }}
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            ) : null}
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search files…" />
        </Toolbar>

        {loadingJobs ? (
          <LoadingArea panel size={56} />
        ) : (
          <div className="space-y-5">
            <DataTable
              columns={columns}
              data={pager.pageItems}
              getRowKey={(j) => j.id}
              onRowClick={(j) => setSelected(j.id)}
              empty={
                <div className="rounded-xl border border-border bg-surface-subtle">
                  <EmptyState
                    icon={UploadCloud}
                    title={filtersActive ? "No matching uploads" : "Queue is empty"}
                    description={
                      filtersActive
                        ? "Try adjusting your filters."
                        : "Drop files above to start uploading."
                    }
                    action={
                      filtersActive ? (
                        <Button
                          variant="outline"
                          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                          onClick={() => {
                            setStatusFilter("all");
                            setSearch("");
                          }}
                        >
                          Clear filters
                        </Button>
                      ) : null
                    }
                  />
                </div>
              }
            />
            <ListPagination {...pager} itemLabel="uploads" />
          </div>
        )}
      </div>
    </MainScreenWrapper>
  );
}

export default UploadCenterScreen;
