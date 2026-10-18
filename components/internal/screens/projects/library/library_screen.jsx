"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, Image as ImageIcon, File } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SettingRow,
  SettingsList,
  StatsBar,
  StatusPill,
  Toolbar,
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
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { cn } from "@/lib/utils";
import {
  FILE_TYPE_COLORS,
  STATUS_META,
  TYPE_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  formatBytes,
  formatDate,
} from "./constants";
import { copyAssetLink } from "@/lib/delivery/copy_link";
import { listAssets } from "@/lib/supabase/assets";
import {
  uploadAsset,
  UPLOAD_PHASE_LABELS,
  UPLOAD_ERROR_MESSAGES,
} from "@/lib/storage/client";
import { FileDropzone } from "@/components/internal/shared/file_dropzone";
import { AssetThumbnail } from "@/components/internal/shared/asset_thumbnail";
import { fileKind } from "@/components/internal/shared/asset_meta";
import { FolderPicker, folderPath } from "@/components/internal/shared/folder_explorer";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { AssetEditScreen } from "./asset_detail";
import { AssetQuickViewSheet } from "./asset_quick_view";
import { AssetActionMenu } from "./asset_action_menu";
import { useSearchTracking } from "../analytics/use_search_tracking";
import {
  AddToCollectionDialog,
  DeleteAssetDialog,
  DuplicateAssetDialog,
  RenameAssetDialog,
  useAssetActions,
} from "./use_asset_actions";

const EMPTY_DRAFT = {
  name: "",
  type: "image",

  folder: null,
  status: "draft",
};

export function UploadDialog({ open, onOpenChange, projectId, onUploaded }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState("");
  const [busy, setBusy] = useState(false);
  // Off by default: images are re-encoded to the "web" preset unless the
  // uploader opts into keeping the original bytes.
  const [lossless, setLossless] = useState(false);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const pickFiles = (files) => {
    const next = (files || []).find((f) => f instanceof Blob);
    if (!next) return;
    setFile(next);

    const suggestion = (next.name || "").replace(/\.[^.]+$/, "").trim();
    const kind = fileKind({ mimeType: next.type, name: next.name });
    setDraft((d) => ({
      ...d,
      name: d.name.trim() ? d.name : suggestion,
      type: kind || d.type,
    }));
  };

  const close = () => {
    if (busy) return;
    setDraft(EMPTY_DRAFT);
    setFile(null);
    setProgress(0);
    setPhaseLabel("");
    setLossless(false);
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
    setPhaseLabel(UPLOAD_PHASE_LABELS.hashing);
    let failure = null;
    const asset = await uploadAsset(file, {
      projectId,
      name: draft.name.trim(),
      type: draft.type,
      status: draft.status,
      folder: draft.folder ? folderPath(draft.folder) : "root",
      quality: lossless ? "original" : "web",
      onProgress: setProgress,
      onPhase: (p) => setPhaseLabel(UPLOAD_PHASE_LABELS[p] || ""),
      onError: (code) => {
        failure = code;
      },
    });
    setBusy(false);
    if (!asset) {
      toast.error(UPLOAD_ERROR_MESSAGES[failure] || `Couldn't upload ${file.name || "file"}.`);
      return;
    }
    toast.success(`${asset.name || file.name || "File"} uploaded`);
    setDraft(EMPTY_DRAFT);
    setFile(null);
    setProgress(0);
    setPhaseLabel("");
    setLossless(false);
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

          <Field label="Destination folder">
            <FolderPicker
              projectId={projectId}
              value={draft.folder}
              onChange={set("folder")}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
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

          <SettingsList>
            <SettingRow
              title="Upload lossless"
              description="Store the file exactly as it is. Off re-encodes images to WebP at up to 2048px to save storage and bandwidth. Formats the browser can't decode (PSD, TIFF, RAW) always upload untouched."
              checked={lossless}
              onCheckedChange={setLossless}
            />
          </SettingsList>

          {busy && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-card">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, progress || 0))}%` }}
                />
              </div>
              <span className="whitespace-nowrap tabular-nums text-[11px] text-text-secondary">
                {phaseLabel || UPLOAD_PHASE_LABELS.uploading}{" "}
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

export function LibraryScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showUpload, setShowUpload] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const {
    assetId: openAssetId,
    openAsset,
    closeAsset,
    openFolder,
    setTab,
  } = useWorkspaceUrl();

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

  const trackSearchClick = useSearchTracking({
    projectId, query: search, resultCount: filtered.length,
    filters: { type: typeFilter, status: statusFilter }, loading,
  });

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

  const assetActions = useAssetActions({
    projectId,
    assets,
    setAssets,
    onDeleted: (asset) => {
      if (previewId === asset.id) setPreviewId(null);
    },
  });
  const {
    deleteTarget,
    setDeleteTarget,
    handleDelete,
    duplicateTarget,
    setDuplicateTarget,
    handleDuplicate,
  } = assetActions;

  const rowActions = {
    open: (asset) => { trackSearchClick(asset.id); setPreviewId(asset.id); },
    edit: (asset) => { trackSearchClick(asset.id); openAsset(asset.id); },
    openFolder: openFolder && ((asset) => openFolder(asset.folder)),
    download: assetActions.handleDownload,
    downloadAs: assetActions.handleDownloadAs,
    copyLink: copyAssetLink,
    createShareLink: assetActions.handleCreateShareLink,
    manageShares: () => setTab("Shared Links"),
    rename: assetActions.setRenameTarget,
    replace: assetActions.handleReplace,
    duplicate: setDuplicateTarget,
    addToCollection: assetActions.setCollectionTarget,
    remove: setDeleteTarget,
  };

  const syncAsset = (updated) =>
    setAssets((rows) => rows.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));

  const previewAsset = useMemo(
    () => (previewId ? assets.find((a) => a.id === previewId) ?? null : null),
    [assets, previewId],
  );

  const editFromSheet = (asset) => {
    setPreviewId(null);
    openAsset(asset.id);
  };

  const columns = [
    {
      key: "name",
      header: "Asset",
      render: (a) => (
        <div className="flex items-center gap-3">
          <AssetThumbnail asset={a} />
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
      render: (a) => <AssetActionMenu asset={a} actions={rowActions} />,
    },
  ];

  if (openAssetId) {
    return (
      <AssetEditScreen
        key={openAssetId}
        assetId={openAssetId}
        onBack={closeAsset}
        onUpdate={syncAsset}
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
        <LoadingArea panel size={56} />
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(a) => a.id}
            onRowClick={(a) => { trackSearchClick(a.id); setPreviewId(a.id); }}
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

      <AssetQuickViewSheet
        asset={previewAsset}
        open={!!previewAsset}
        onOpenChange={(open) => !open && setPreviewId(null)}
        onEdit={editFromSheet}
        onDuplicate={setDuplicateTarget}
        onDelete={setDeleteTarget}
        onUpdate={syncAsset}
      />

      <UploadDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        projectId={projectId}
        onUploaded={reload}
      />

      <DeleteAssetDialog
        asset={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <DuplicateAssetDialog
        asset={duplicateTarget}
        onCancel={() => setDuplicateTarget(null)}
        onConfirm={handleDuplicate}
      />

      <RenameAssetDialog
        asset={assetActions.renameTarget}
        onCancel={() => assetActions.setRenameTarget(null)}
        onConfirm={assetActions.handleRename}
      />

      <AddToCollectionDialog
        projectId={projectId}
        asset={assetActions.collectionTarget}
        onCancel={() => assetActions.setCollectionTarget(null)}
        onConfirm={assetActions.handleAddToCollection}
      />
    </MainScreenWrapper>
  );
}

export default LibraryScreen;
