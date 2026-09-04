"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  Copy,
  Pencil,
  Trash2,
  Loader2,
  Image as ImageIcon,
  File,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { ActionMenu } from "@geiger/ui/action-menu";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import { cn } from "@/lib/utils";
import {
  TYPE_ICONS,
  FILE_TYPE_COLORS,
  STATUS_META,
  TYPE_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  formatBytes,
  formatDate,
} from "./constants";
import { listAssets, softDeleteAsset, createAsset } from "@/lib/supabase/assets";
import { uploadAsset } from "@/lib/storage/client";
import { FileDropzone } from "@/components/internal/shared/file_dropzone";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { AssetEditScreen } from "./asset_detail";

const EMPTY_DRAFT = {
  name: "",
  type: "image",
  folder: "root",
  status: "draft",
};

function UploadDialog({ open, onOpenChange, projectId, onUploaded }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const pickFiles = (files) => {
    const next = (files || []).find((f) => f instanceof Blob);
    if (!next) return;
    setFile(next);
    setDraft((d) => (d.name.trim() ? d : { ...d, name: next.name || "" }));
  };

  const close = () => {
    if (busy) return;
    setDraft(EMPTY_DRAFT);
    setFile(null);
    setProgress(0);
    onOpenChange(false);
  };

  const submit = async () => {
    if (busy) return;
    if (!file) {
      toast.error("Choose a file first.");
      return;
    }
    setBusy(true);
    setProgress(1);
    const asset = await uploadAsset(file, {
      projectId,
      folder: draft.folder || "root",
      onProgress: setProgress,
    });
    setBusy(false);
    if (!asset) {
      toast.error(`Couldn't upload ${file.name || "file"}.`);
      return;
    }
    toast.success(`${asset.name || file.name || "File"} uploaded`);
    setDraft(EMPTY_DRAFT);
    setFile(null);
    setProgress(0);
    onOpenChange(false);
    if (typeof onUploaded === "function") onUploaded(asset);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-background">
        <DialogHeader>
          <DialogTitle>Upload assets</DialogTitle>
          <DialogDescription>
            Set the essentials now — you can flesh out details, relationships,
            and versions in the Asset Editor.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Asset name" htmlFor="asset-name">
            <Input
              id="asset-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="e.g. Hero banner Q3"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select value={draft.type} onValueChange={set("type")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_FILTER_OPTIONS.filter((o) => o.value !== "all").map(
                    (o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={draft.status} onValueChange={set("status")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_OPTIONS.filter((o) => o.value !== "all").map(
                    (o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <FileDropzone
            onFiles={pickFiles}
            multiple={false}
            className="rounded-xl border-2 border-dashed border-border p-10 text-center transition-colors hover:border-border-strong"
          >
            {({ browseId, dragging }) => (
              <label htmlFor={browseId} className="block cursor-pointer">
                {file ? (
                  <span className="block">
                    <File className="mx-auto mb-3 h-10 w-10 text-primary" />
                    <span className="block truncate text-sm font-medium text-foreground">
                      {file.name || "Selected file"}
                    </span>
                    <span className="mt-1 block text-xs text-text-secondary">
                      {formatBytes(file.size)} — click to choose a different file
                    </span>
                  </span>
                ) : (
                  <span className="block">
                    <Upload
                      className={cn(
                        "mx-auto mb-3 h-10 w-10 transition-colors",
                        dragging ? "text-primary" : "text-text-tertiary",
                      )}
                    />
                    <span className="block text-sm font-medium text-foreground">
                      {dragging ? "Drop files here" : "Drop files here or click to upload"}
                    </span>
                    <span className="mt-1 block text-xs text-text-secondary">
                      Supports images, videos, audio, documents, and more
                    </span>
                  </span>
                )}
              </label>
            )}
          </FileDropzone>
          {busy && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-card">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, progress || 0))}%` }}
                />
              </div>
              <span className="tabular-nums text-[11px] text-text-secondary">
                {Math.max(0, Math.min(100, Math.round(progress || 0)))}%
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={close}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssetThumb({ asset }) {
  const Icon = TYPE_ICONS[asset.type] || File;
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
      style={{ background: `${asset.color}15`, borderColor: `${asset.color}25` }}
    >
      <Icon className="h-4 w-4" style={{ color: asset.color || "#737373" }} />
    </div>
  );
}

export function LibraryScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showUpload, setShowUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { assetId: openAssetId, openAsset, closeAsset } = useWorkspaceUrl();

  useEffect(() => {
    let alive = true;
    listAssets(projectId).then((rows) => {
      if (!alive) return;
      setAssets(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const reload = () => {
    setLoading(true);
    listAssets(projectId).then((rows) => {
      setAssets(rows ?? []);
      setLoading(false);
    });
  };

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (
        search &&
        !`${a.name} ${a.format} ${(a.tags || []).join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [assets, search, typeFilter, statusFilter]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${typeFilter}|${statusFilter}`,
  });

  const stats = useMemo(() => {
    const totalBytes = assets.reduce((sum, a) => sum + (a.sizeBytes || 0), 0);
    const processing = assets.filter((a) => a.status === "processing").length;
    const approved = assets.filter((a) => a.status === "approved").length;
    return [
      { label: "Total assets", value: String(assets.length), footer: "in this library" },
      { label: "Storage used", value: formatBytes(totalBytes), footer: "Across all assets" },
      { label: "Approved", value: String(approved), footer: "Ready to use" },
      { label: "Processing", value: String(processing), footer: "In queue" },
    ];
  }, [assets]);

  const handleDelete = (asset) => {
    setDeleteTarget(null);
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    toast.success(`Deleted "${asset.name}".`);
    softDeleteAsset(asset.id).then((ok) => {
      if (!ok) toast.error("Couldn't delete the asset on the server.");
    });
  };

  const handleDuplicate = async (asset) => {
    const id = crypto.randomUUID();
    const copy = {
      ...asset,
      id,
      name: asset.name.replace(/(\.[^.]+)?$/, " (copy)$1"),
      status: "draft",
      downloads: 0,
    };
    setAssets((prev) => [copy, ...prev]);
    toast.success(`Duplicated "${asset.name}".`);
    const created = await createAsset({
      id,
      name: copy.name,
      type: copy.type,
      format: copy.format,
      sizeBytes: copy.sizeBytes,
      dimensions: copy.dimensions,
      folder: copy.folder,
      status: "draft",
      tags: copy.tags,
      color: copy.color,
    });
    if (created) {
      setAssets((prev) => prev.map((a) => (a.id === id ? created : a)));
    } else {
      toast.error("Couldn't save the copy to the server.");
    }
  };

  const syncAsset = (updated) =>
    setAssets((rows) => rows.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));

  const columns = [
    {
      key: "name",
      header: "Asset",
      render: (a) => (
        <div className="flex items-center gap-3">
          <AssetThumb asset={a} />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="max-w-[260px] truncate font-medium text-foreground">
              {a.name}
            </span>
            <span className="text-xs text-text-secondary">
              {a.format || a.type} · {formatBytes(a.sizeBytes)} · {a.folder}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusPill status={a.status} map={STATUS_META} />,
    },
    {
      key: "type",
      header: "Type",
      render: (a) => (
        <Badge className={cn("border px-1.5 py-0 text-[10px]", FILE_TYPE_COLORS[a.type])}>
          {a.format || a.type}
        </Badge>
      ),
    },
    {
      key: "modified",
      header: "Modified",
      className: "text-xs text-text-secondary hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (a) => formatDate(a.updatedAt),
    },
    {
      key: "downloads",
      header: "Downloads",
      align: "right",
      className: "text-right tabular-nums text-text-secondary hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => (a.downloads ?? 0).toLocaleString("en-US"),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (a) => (
        <ActionMenu
          label={`Actions for ${a.name}`}
          items={[
            { icon: Pencil, label: "Edit", onSelect: () => openAsset(a.id) },
            { icon: Copy, label: "Duplicate", onSelect: () => handleDuplicate(a) },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              variant: "destructive",
              onSelect: () => setDeleteTarget(a),
            },
          ]}
        />
      ),
    },
  ];

  if (openAssetId) {
    return (
      <AssetEditScreen
        key={openAssetId}
        assetId={openAssetId}
        onBack={closeAsset}
        onChange={syncAsset}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Asset Library"
        description="Every asset in your workspace — drafts, in review, and approved. Search, filter, and manage them all from here."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowUpload(true)}
          >
            <Upload className="h-4 w-4" /> Upload
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={TYPE_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search assets, formats, tags…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading assets…
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(a) => a.id}
            onRowClick={(a) => openAsset(a.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={ImageIcon}
                  title={
                    assets.length
                      ? "No assets match your filters"
                      : "No assets yet"
                  }
                  description={
                    assets.length
                      ? "Try clearing the search or filters, or upload a new asset to get started."
                      : "Upload your first asset to start organizing your library."
                  }
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => setShowUpload(true)}
                    >
                      <Upload className="h-4 w-4" /> Upload assets
                    </Button>
                  }
                />
              </div>
            }
          />
          <ListPagination {...pager} itemLabel="assets" />
        </div>
      )}

      <UploadDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        projectId={projectId}
        onUploaded={reload}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? This action can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => handleDelete(deleteTarget)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default LibraryScreen;
