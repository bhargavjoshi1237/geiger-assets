"use client";

import { Button, LogoLoading } from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Boxes, Rotate3d, ZoomIn } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import { AssetPreview } from "@/components/internal/shared/asset_preview";
import { listAssets } from "@/lib/supabase/assets";
import {
  MEDIA_ASSET_STATUS_FILTER_OPTIONS,
  MEDIA_ASSET_STATUS_MAP,
  MODEL_FORMAT_FILTER_OPTIONS,
  formatBytes,
  formatDate,
} from "./constants";

export function ThreeDScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [selectedId, setSelectedId] = useState(null);

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

  const models = useMemo(() => assets.filter((a) => a.type === "3d"), [assets]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return models.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (formatFilter !== "all" && String(a.format || "").toUpperCase() !== formatFilter) return false;
      if (needle && !`${a.name} ${a.format} ${(a.tags || []).join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [models, search, statusFilter, formatFilter]);

  const selected = useMemo(
    () => filtered.find((a) => a.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  const stats = useMemo(() => {
    const bytes = models.reduce((sum, a) => sum + (a.sizeBytes || 0), 0);
    const arReady = models.filter((a) => {
      const format = String(a.format || "").toUpperCase();
      return format === "USDZ" || format === "GLB";
    }).length;
    return [
      { label: "Models", value: String(models.length), footer: "immersive assets" },
      { label: "AR-ready", value: String(arReady), footer: "USDZ or GLB" },
      { label: "Formats", value: String(new Set(models.map((a) => String(a.format || "unknown").toUpperCase())).size), footer: "distinct containers" },
      { label: "Storage", value: formatBytes(bytes), footer: "across models" },
    ];
  }, [models]);

  const filtersActive = search.trim() !== "" || statusFilter !== "all" || formatFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setFormatFilter("all");
  };

  const handleArPreview = () => {
    if (!selected) return;
    const format = String(selected.format || "").toUpperCase();
    if (format === "USDZ" || format === "GLB") {
      toast.success("AR preview handed to the device viewer.");
    } else {
      toast.error("AR preview needs a USDZ or GLB container — convert first.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Model",
      render: (a) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">{a.name}</span>
          <span className="truncate text-xs text-text-secondary">{a.format || "3D"} · {formatBytes(a.sizeBytes)}</span>
        </div>
      ),
    },
    {
      key: "format",
      header: "Format",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => a.format || "—",
    },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusPill status={a.status} map={MEDIA_ASSET_STATUS_MAP} />,
    },
    {
      key: "modified",
      header: "Modified",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (a) => formatDate(a.updatedAt),
    },
  ];

  const polyCount = selected?.polyCount || selected?.metadata?.polyCount || null;
  const arCapable = selected ? ["USDZ", "GLB"].includes(String(selected.format || "").toUpperCase()) : false;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="3D & Immersive"
        description="Interactive model placeholder with rotate and zoom, honest metadata, and device AR handoff."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleArPreview} disabled={!selected}>
            <Boxes className="h-4 w-4" /> AR preview
          </Button>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={formatFilter} onValueChange={setFormatFilter} options={MODEL_FORMAT_FILTER_OPTIONS} height="h-9" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={MEDIA_ASSET_STATUS_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search models, formats, tags…" />
      </Toolbar>
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading 3D models" />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(a) => a.id}
            onRowClick={(a) => {
              setSelectedId(a.id);
              setRotation(0);
              setZoom(100);
            }}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                {models.length === 0 ? (
                  <EmptyState icon={Boxes} title="No 3D models yet" description="Upload a GLB, USDZ, OBJ, or FBX to preview it here." />
                ) : (
                  <EmptyState icon={Boxes} title="No models match these filters" description="Try a different format, status, or search term." action={<Button variant="outline" className="border-border bg-surface-card text-foreground hover:bg-surface-active" onClick={clearFilters}>Clear filters</Button>} />
                )}
              </div>
            }
          />
          {selected ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Interactive preview" description="Placeholder turntable — drag the sliders, not the model.">
                <div className="overflow-hidden rounded-xl border border-border bg-surface-card">
                  <div className="flex aspect-video items-center justify-center" style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)` }}>
                    <AssetPreview asset={selected} className="w-3/4 border-0" />
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-xs text-text-secondary">
                    <span className="inline-flex items-center gap-1.5"><Rotate3d className="h-3.5 w-3.5" /> Rotate ({rotation}°)</span>
                    <input type="range" min={-180} max={180} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full" aria-label="Rotate preview" />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs text-text-secondary">
                    <span className="inline-flex items-center gap-1.5"><ZoomIn className="h-3.5 w-3.5" /> Zoom ({zoom}%)</span>
                    <input type="range" min={50} max={200} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" aria-label="Zoom preview" />
                  </label>
                </div>
                <p className="mt-3 text-[11px] text-text-tertiary">A full WebGL viewer is out of scope — this placeholder keeps lighting and framing honest until one lands.</p>
              </SectionCard>
              <SectionCard title="Model metadata" description={arCapable ? "AR-capable container." : "Not AR-capable — convert to USDZ or GLB."}>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div><dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Format</dt><dd className="mt-1 text-sm font-medium text-foreground">{selected.format || "—"}</dd></div>
                  <div><dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Size</dt><dd className="mt-1 text-sm font-medium text-foreground">{formatBytes(selected.sizeBytes)}</dd></div>
                  <div><dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Polygons</dt><dd className="mt-1 text-sm font-medium text-foreground">{polyCount ? Number(polyCount).toLocaleString("en-US") : "Not probed"}</dd></div>
                  <div><dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">MIME</dt><dd className="mt-1 text-sm font-medium text-foreground">{selected.mimeType || "—"}</dd></div>
                </dl>
                <div className="mt-4 rounded-lg border border-border bg-surface-card p-3 text-xs text-text-secondary">
                  AR handoff checks the container first: USDZ and GLB open on-device, everything else is refused with guidance instead of a broken viewer.
                </div>
              </SectionCard>
            </div>
          ) : null}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default ThreeDScreen;
