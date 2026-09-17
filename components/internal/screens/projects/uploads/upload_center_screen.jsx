"use client";

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  LogoLoading,
  cn,
} from "@geiger/ui";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UploadCloud,
  File,
  X,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Eye,
  RotateCcw,
  Loader2,
  ArrowUpDown,
  SlidersHorizontal,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  EmptyState,
  DataTable,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
import {
  TYPE_ICONS,
  FILE_TYPE_COLORS,
  STATUS_META,
  STATUS_FILTER_OPTIONS,
  SORT_OPTIONS,
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
    <div className="group relative flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-hover">
        <Icon className="h-3.5 w-3.5 text-text-secondary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{file.name}</p>
        <p className="mt-0.5 text-[10px] text-text-tertiary">{formatBytes(file.size)}</p>
      </div>
      <button
        onClick={() => onRemove(file.id)}
        aria-label="Remove file"
        className="ml-1 rounded p-0.5 text-text-tertiary opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ProgressBar({ progress }) {
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-card">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-[11px] text-text-secondary">{pct}%</span>
    </div>
  );
}

function FilterDropdown({ value, onValueChange, options, placeholder, icon: Icon }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-8 gap-1.5 rounded-md border-border bg-surface-card px-3 text-xs font-medium text-foreground hover:bg-surface-subtle"
        >
          {Icon ? <Icon className="h-3.5 w-3.5 text-text-secondary" /> : null}
          {options.find((o) => o.value === value)?.label || placeholder}
          <ChevronDown className="h-3 w-3 text-text-secondary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="border-border bg-surface-subtle text-foreground" align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="cursor-pointer text-xs focus:bg-surface-hover focus:text-foreground"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QueueRowActions({ job, onView, onRetry, onDelete }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Upload job actions"
            className="h-7 w-7 text-text-secondary hover:bg-surface-hover hover:text-foreground"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="border-border bg-surface-subtle text-foreground" align="end">
          <DropdownMenuItem
            className="cursor-pointer text-xs focus:bg-surface-hover"
            onClick={() => onView(job)}
          >
            <Eye className="mr-2 h-3.5 w-3.5" /> View
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-xs focus:bg-surface-hover"
            onClick={() => onRetry(job)}
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" /> Retry
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-surface-hover" />
          <DropdownMenuItem
            className="cursor-pointer text-xs text-red-400 focus:bg-red-500/10 focus:text-red-400"
            onClick={() => onDelete(job)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function UploadCenterScreen({ projectId }) {
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const [staged, setStaged] = useState([]);
  const [uploading, setUploading] = useState(false);
  // File bytes for staged/failed jobs, keyed by job id — powers real retry.
  const fileRefs = useRef(new Map());

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
        folder: "root",
        tags: [],
        quality: "original",
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
    [projectId, setJobProgress],
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

  const stats = useMemo(() => {
    const completed = jobs.filter(
      (j) => j.status === "completed" || j.status === "complete",
    ).length;
    const inProgress = jobs.filter((j) =>
      ["queued", "uploading", "processing"].includes(j.status),
    ).length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    return [
      { label: "Total uploads", value: String(jobs.length), footer: "in this queue" },
      { label: "Completed", value: String(completed), footer: "Ready in library" },
      { label: "In progress", value: String(inProgress), footer: "Queued or active" },
      { label: "Failed", value: String(failed), footer: "Need attention" },
    ];
  }, [jobs]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${statusFilter}|${sortValue}`,
  });

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const columns = [
    {
      key: "filename",
      header: "File",
      render: (j) => {
        const Icon = TYPE_ICONS[j.fileType] || File;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
              <Icon className="h-3.5 w-3.5 text-text-secondary" />
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
      className: "tabular-nums text-xs text-muted-foreground",
      render: (j) => formatBytes(j.sizeBytes),
    },
    {
      key: "progress",
      header: "Progress",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (j) => <ProgressBar progress={j.progress} />,
    },
    {
      key: "status",
      header: "Status",
      render: (j) => <StatusPill status={j.status} map={STATUS_META} className="text-[10px]" />,
    },
    {
      key: "created",
      header: "Created",
      className: "text-xs text-text-secondary hidden lg:table-cell",
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

      <StatsBar stats={stats} />

      {/* Drop zone + options panel */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Drop zone */}
        <FileDropzone
          onFiles={addFiles}
          className={cn(
            "relative flex min-h-[600px] flex-col rounded-xl border-2 border-dashed transition-colors",
            "border-border bg-surface-subtle hover:border-border-strong",
            staged.length === 0 ? "items-center justify-center" : "",
          )}
        >
          {({ browseId, dragging }) => (
            <div
              className={cn(
                "flex flex-1 flex-col rounded-[10px] transition-colors",
                dragging && "bg-primary/5",
                staged.length === 0 ? "items-center justify-center" : "",
              )}
            >
              {staged.length === 0 ? (
                <label
                  htmlFor={browseId}
                  className="flex cursor-pointer flex-col items-center gap-3 px-6 py-10 text-center"
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
                    <span className="mt-1 block text-xs text-text-tertiary">
                      or{" "}
                      <span className="text-primary underline-offset-2 hover:underline">
                        browse your device
                      </span>
                    </span>
                  </span>
                  <span className="text-[11px] text-text-tertiary">
                    Images, video, audio, documents, 3D models and archives
                  </span>
                </label>
              ) : (
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground">
                      {staged.length} file{staged.length !== 1 ? "s" : ""} staged
                    </p>
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor={browseId}
                        className="cursor-pointer text-[11px] text-primary hover:underline"
                      >
                        + Add more
                      </label>
                      <button
                        onClick={clearStaged}
                        className="text-[11px] text-text-tertiary hover:text-foreground"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {staged.map((f) => (
                      <StagedFileCard key={f.id} file={f} onRemove={removeStaged} />
                    ))}
                  </div>
                  <Button
                    className="mt-4 w-full bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                    onClick={handleUploadAll}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Queuing uploads…
                      </>
                    ) : (
                      <>
                        <UploadCloud className="mr-2 h-3.5 w-3.5" />
                        Upload {staged.length} file{staged.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </FileDropzone>

        {/* Side panel */}
        <div className="rounded-xl border border-border bg-surface-subtle p-4 min-h-[600px]" />
      </div>

      {/* Upload queue */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Upload Queue
        </h2>
        <Toolbar className="mb-3">
            <div className="flex items-center gap-2">
              <FilterDropdown
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={STATUS_FILTER_OPTIONS}
                placeholder="Status"
                icon={SlidersHorizontal}
              />
              <FilterDropdown
                value={sortValue}
                onValueChange={setSortValue}
                options={SORT_OPTIONS}
                placeholder="Sort"
                icon={ArrowUpDown}
              />
              {(statusFilter !== "all" || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
                  onClick={() => {
                    setStatusFilter("all");
                    setSearch("");
                  }}
                >
                  <X className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search files…"
              className="w-44"
            />
        </Toolbar>

        {loadingJobs ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
            <LogoLoading size={40} />
          </div>
        ) : (
          <div className="space-y-5">
            <DataTable
              columns={columns}
              data={pager.pageItems}
              getRowKey={(j) => j.id}
              onRowClick={(j) => setSelected(j.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                {jobs.length === 0 ? (
                  <EmptyState
                    icon={UploadCloud}
                    title="Queue is empty"
                    description="Drop files above to start uploading."
                  />
                ) : (
                  <EmptyState
                    icon={UploadCloud}
                    title="No matching uploads"
                    description="No uploads match the current search and filter."
                    action={
                      <Button variant="ghost" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    }
                  />
                )}
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
