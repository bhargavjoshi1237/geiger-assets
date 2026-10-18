"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Upload } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
import {
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { GalleryGrid } from "@/components/internal/screens/projects/galleries/galleries_kit";
import { parseDimensions } from "@/lib/supabase/gallery_shape";
import { listAssets } from "@/lib/supabase/assets";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { SORT_OPTIONS, TYPE_FILTER_OPTIONS } from "./constants";
import { UploadDialog } from "./library_screen";
import { AssetEditScreen } from "./asset_detail";
import { AssetQuickViewSheet } from "./asset_quick_view";
import { DeleteAssetDialog, DuplicateAssetDialog, useAssetActions } from "./use_asset_actions";
import { useSearchTracking } from "../analytics/use_search_tracking";

// A grid of media is scanned by eye, so this screen is content-first: no stats
// bar, and tiles keep each asset's own shape in justified rows.
const GRID_PAGE_SIZE = 50;

function sortAssets(rows, sortValue) {
  const [field, direction] = sortValue.split("-");
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (field === "modified") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
    else if (field === "name") cmp = a.name.localeCompare(b.name);
    else if (field === "size") cmp = (a.sizeBytes || 0) - (b.sizeBytes || 0);
    else if (field === "downloads") cmp = (a.downloads || 0) - (b.downloads || 0);
    return direction === "desc" ? -cmp : cmp;
  });
}

export function AllMediaScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortValue, setSortValue] = useState("modified-desc");
  const [showUpload, setShowUpload] = useState(false);
  const [previewId, setPreviewId] = useState(null);
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

  const {
    deleteTarget,
    setDeleteTarget,
    handleDelete,
    duplicateTarget,
    setDuplicateTarget,
    handleDuplicate,
  } = useAssetActions({
      projectId,
      assets,
      setAssets,
      onDeleted: (asset) => {
        if (previewId === asset.id) setPreviewId(null);
      },
    });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = assets.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (
        q &&
        !`${a.name} ${a.format} ${(a.tags || []).join(" ")}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
    return sortAssets(rows, sortValue);
  }, [assets, search, typeFilter, sortValue]);

  const trackSearchClick = useSearchTracking({
    projectId, query: search, resultCount: filtered.length,
    filters: { type: typeFilter }, loading,
  });

  const pager = usePagination(filtered, {
    pageSize: GRID_PAGE_SIZE,
    resetKey: `${search}|${typeFilter}|${sortValue}`,
  });

  // The justified layout sizes each tile from its width/height.
  const items = useMemo(
    () =>
      pager.pageItems.map((asset) => ({
        asset: { ...asset, ...parseDimensions(asset.dimensions) },
      })),
    [pager.pageItems],
  );

  const previewAsset = useMemo(
    () => (previewId ? assets.find((a) => a.id === previewId) ?? null : null),
    [assets, previewId],
  );

  const syncAsset = (updated) =>
    setAssets((rows) => rows.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));

  const editFromSheet = (asset) => {
    setPreviewId(null);
    openAsset(asset.id);
  };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
  };

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
        title="All Media"
        description="Every asset in this project, at a glance."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowUpload(true)}
          >
            <Upload className="h-4 w-4" /> Upload
          </Button>
        }
      />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={TYPE_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={sortValue}
            onValueChange={setSortValue}
            options={SORT_OPTIONS}
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
      ) : items.length ? (
        <div className="space-y-5">
          <GalleryGrid
            items={items}
            layout="justified"
            onOpen={(asset) => { trackSearchClick(asset.id); setPreviewId(asset.id); }}
          />
          <ListPagination {...pager} itemLabel="assets" />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={ImageIcon}
            title={assets.length ? "No media matches your filters" : "No media yet"}
            description={
              assets.length
                ? "Try a different search or type, or clear the filters."
                : "Upload your first asset and it will show up here."
            }
            action={
              assets.length ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setShowUpload(true)}
                >
                  <Upload className="h-4 w-4" /> Upload assets
                </Button>
              )
            }
          />
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
    </MainScreenWrapper>
  );
}

export default AllMediaScreen;
