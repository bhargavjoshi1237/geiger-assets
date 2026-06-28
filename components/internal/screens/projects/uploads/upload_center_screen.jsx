"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UploadCloud,
  FolderOpen,
  Tag,
  Image,
  Film,
  Music,
  FileText,
  Boxes,
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
  Check,
  HardDrive,
  Gauge,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  SearchInput,
  StatusPill,
  EmptyState,
  DataTable,
} from "@/components/internal/shared/screen_kit";
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
import { UploadJobDetailScreen } from "./upload_job_detail";

const FOLDER_OPTIONS = [
  { value: "root", label: "/ Root" },
  { value: "campaigns", label: "Campaigns" },
  { value: "products", label: "Products" },
  { value: "brand", label: "Brand Assets" },
  { value: "archive", label: "Archive" },
];

const QUALITY_OPTIONS = [
  { value: "original", label: "Original", desc: "Lossless, no compression", icon: HardDrive },
  { value: "web", label: "Web Optimized", desc: "Balanced size & quality", icon: Gauge },
  { value: "compressed", label: "Compressed", desc: "Smallest file size", icon: Zap },
];

const TYPE_CHIPS = [
  { value: "image", label: "Images", Icon: Image },
  { value: "video", label: "Video", Icon: Film },
  { value: "audio", label: "Audio", Icon: Music },
  { value: "document", label: "Docs", Icon: FileText },
  { value: "3d", label: "3D", Icon: Boxes },
  { value: "raw", label: "Raw", Icon: File },
];

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
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [folder, setFolder] = useState("root");
  const [tags, setTags] = useState("");
  const [quality, setQuality] = useState("original");
  const [allowedTypes, setAllowedTypes] = useState(
    new Set(["image", "video", "audio", "document", "3d", "raw"]),
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortValue, setSortValue] = useState("created-desc");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    listUploadJobs(projectId).then((rows) => {
      setJobs(rows ?? []);
      setLoadingJobs(false);
    });
  }, []);

  const addFiles = useCallback((files) => {
    const next = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      fileType: guessFileType(f),
      file: f,
    }));
    setStaged((prev) => [...prev, ...next]);
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };
  const handleBrowse = () => fileInputRef.current?.click();
  const handleFileInput = (e) => {
    if (e.target.files.length) addFiles(e.target.files);
    e.target.value = "";
  };
  const removeStaged = (id) => setStaged((prev) => prev.filter((f) => f.id !== id));
  const clearStaged = () => setStaged([]);

  const toggleType = (type) => {
    setAllowedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleUploadAll = async () => {
    if (!staged.length || uploading) return;
    setUploading(true);
    const toUpload = [...staged];
    setStaged([]);
    for (const f of toUpload) {
      const id = crypto.randomUUID();
      const optimistic = {
        id,
        projectId: null,
        filename: f.name,
        fileType: f.fileType,
        sizeBytes: f.size,
        status: "queued",
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
        filename: f.name,
        fileType: f.fileType,
        sizeBytes: f.size,
        status: "queued",
        progress: 0,
        source: "drag-drop",
      });
      if (created) {
        setJobs((prev) => prev.map((j) => (j.id === id ? created : j)));
      } else {
        setJobs((prev) => prev.filter((j) => j.id !== id));
      }
    }
    setUploading(false);
  };

  const handleRetry = async (job) => {
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

  const queueStats = useMemo(
    () => ({
      completed: jobs.filter((j) => j.status === "completed").length,
      processing: jobs.filter(
        (j) => j.status === "uploading" || j.status === "processing",
      ).length,
      failed: jobs.filter((j) => j.status === "failed").length,
    }),
    [jobs],
  );

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
        actions={
          jobs.length > 0 ? (
            <div className="flex items-center gap-3 text-xs text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {queueStats.completed} done
              </span>
              {queueStats.processing > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                  {queueStats.processing} active
                </span>
              )}
              {queueStats.failed > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  {queueStats.failed} failed
                </span>
              )}
            </div>
          ) : null
        }
      />

      {/* Drop zone + options panel */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Drop zone */}
        <div
          className={cn(
            "relative flex min-h-[280px] flex-col rounded-xl border-2 border-dashed transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border bg-surface-subtle hover:border-border-strong",
            staged.length === 0 ? "cursor-pointer items-center justify-center" : "",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={staged.length === 0 ? handleBrowse : undefined}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />

          {staged.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <div
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
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {dragging ? "Drop files here" : "Drag & drop files here"}
                </p>
                <p className="mt-1 text-xs text-text-tertiary">
                  or{" "}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBrowse();
                    }}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    browse your device
                  </button>
                </p>
              </div>
              <p className="text-[11px] text-text-tertiary">
                Images, video, audio, documents, 3D models and archives
              </p>
            </div>
          ) : (
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">
                  {staged.length} file{staged.length !== 1 ? "s" : ""} staged
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBrowse();
                    }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    + Add more
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearStaged();
                    }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleUploadAll();
                }}
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

        {/* Options panel */}
        <div className="flex flex-col gap-3">
          {/* Destination folder */}
          <div className="rounded-xl border border-border bg-surface-subtle p-4">
            <div className="mb-3 flex items-center gap-2">
              <FolderOpen className="h-3.5 w-3.5 text-text-secondary" />
              <span className="text-xs font-semibold text-foreground">Destination Folder</span>
            </div>
            <Select value={folder} onValueChange={setFolder}>
              <SelectTrigger className="h-8 border-border bg-surface-card text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-surface-subtle text-foreground">
                {FOLDER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="rounded-xl border border-border bg-surface-subtle p-4">
            <div className="mb-3 flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-text-secondary" />
              <span className="text-xs font-semibold text-foreground">Tags</span>
            </div>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="campaign, hero, 2025…"
              className="h-8 border-border bg-surface-card text-xs text-foreground placeholder:text-text-tertiary"
            />
            <p className="mt-1.5 text-[11px] text-text-tertiary">
              Comma-separated, applied to all files
            </p>
          </div>

          {/* Quality preset */}
          <div className="rounded-xl border border-border bg-surface-subtle p-4">
            <div className="mb-3 flex items-center gap-2">
              <Gauge className="h-3.5 w-3.5 text-text-secondary" />
              <span className="text-xs font-semibold text-foreground">Quality Preset</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {QUALITY_OPTIONS.map((opt) => {
                const QIcon = opt.icon;
                const isSelected = quality === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setQuality(opt.value)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border bg-surface-card text-text-secondary hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    <QIcon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isSelected ? "text-primary" : "",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{opt.label}</p>
                      <p className="text-[11px] text-text-tertiary">{opt.desc}</p>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accepted types */}
          <div className="rounded-xl border border-border bg-surface-subtle p-4">
            <div className="mb-3 flex items-center gap-2">
              <File className="h-3.5 w-3.5 text-text-secondary" />
              <span className="text-xs font-semibold text-foreground">Accept File Types</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TYPE_CHIPS.map(({ value, label, Icon }) => {
                const active = allowedTypes.has(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleType(value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-surface-card text-text-tertiary hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Upload queue */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            Upload Queue
            {jobs.length > 0 && (
              <span className="ml-2 text-xs font-normal text-text-secondary">
                {jobs.length} total
              </span>
            )}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search files…"
              className="w-44"
            />
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
        </div>

        {loadingJobs ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(j) => j.id}
            onRowClick={(j) => setSelected(j.id)}
            empty={
              <EmptyState
                icon={UploadCloud}
                title={
                  search || statusFilter !== "all" ? "No matching uploads" : "Queue is empty"
                }
                description={
                  search || statusFilter !== "all"
                    ? "Try adjusting your filters."
                    : "Drop files above to start uploading."
                }
                action={
                  search || statusFilter !== "all" ? (
                    <Button
                      variant="outline"
                      className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
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
            }
          />
        )}
      </div>
    </MainScreenWrapper>
  );
}

export default UploadCenterScreen;
