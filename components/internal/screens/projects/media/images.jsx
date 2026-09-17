"use client";

import { Button, LogoLoading } from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Crosshair, Image as ImageIcon, Plus, Trash2, ZoomIn } from "lucide-react";

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
  createMediaAnnotation,
  listMediaAnnotations,
  softDeleteMediaAnnotation,
} from "@/lib/supabase/media_screens";
import { assetVariantUrl } from "@/lib/storage/client";
import {
  MEDIA_ASSET_STATUS_FILTER_OPTIONS,
  MEDIA_ASSET_STATUS_MAP,
  ORIENTATION_FILTER_OPTIONS,
  formatBytes,
  formatDate,
  orientationOf,
  parseDimensions,
} from "./constants";

function colorProfileOf(asset) {
  return asset?.colorProfile || asset?.metadata?.colorProfile || asset?.metadata?.icc || "sRGB (assumed)";
}

export function ImagesScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orientationFilter, setOrientationFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([listAssets(projectId), listMediaAnnotations(projectId)]).then(([rows, notes]) => {
      if (!alive) return;
      setAssets(rows ?? []);
      setAnnotations(notes ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const images = useMemo(() => assets.filter((a) => a.type === "image"), [assets]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return images.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (orientationFilter !== "all" && orientationOf(a) !== orientationFilter) return false;
      if (needle && !`${a.name} ${a.format} ${(a.tags || []).join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [images, search, statusFilter, orientationFilter]);

  const selected = useMemo(
    () => filtered.find((a) => a.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  const focalPoints = useMemo(
    () => annotations.filter((n) => n.assetId === selected?.id && n.kind === "focal_point"),
    [annotations, selected],
  );

  const stats = useMemo(() => {
    const bytes = images.reduce((sum, a) => sum + (a.sizeBytes || 0), 0);
    const hires = images.filter((a) => {
      const dims = parseDimensions(a.dimensions);
      return dims && Math.max(dims.width, dims.height) >= 3000;
    }).length;
    return [
      { label: "Images", value: String(images.length), footer: "stills in scope" },
      { label: "Hi-res", value: String(hires), footer: "3000px+ on long edge" },
      { label: "With focal point", value: String(new Set(annotations.filter((n) => n.kind === "focal_point").map((n) => n.assetId)).size), footer: "art-directed crops" },
      { label: "Storage", value: formatBytes(bytes), footer: "across images" },
    ];
  }, [images, annotations]);

  const filtersActive = search.trim() !== "" || statusFilter !== "all" || orientationFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setOrientationFilter("all");
  };

  const handleAddFocalPoint = async () => {
    if (!selected) return;
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      assetId: selected.id,
      kind: "focal_point",
      label: `Point ${focalPoints.length + 1}`,
      body: "",
      positionX: 50,
      positionY: 50,
      timestampSeconds: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAnnotations((prev) => [optimistic, ...prev]);
    const created = await createMediaAnnotation({ id, projectId, assetId: selected.id, kind: "focal_point", label: optimistic.label, positionX: 50, positionY: 50 });
    if (created) {
      setAnnotations((prev) => prev.map((n) => (n.id === id ? created : n)));
      toast.success("Focal point added.");
    } else {
      setAnnotations((prev) => prev.filter((n) => n.id !== id));
      toast.error("Couldn't save the focal point.");
    }
  };

  const handleRemoveFocalPoint = async (note) => {
    const prev = annotations;
    setAnnotations((rows) => rows.filter((n) => n.id !== note.id));
    const ok = await softDeleteMediaAnnotation(note.id);
    if (!ok) {
      setAnnotations(prev);
      toast.error("Couldn't remove the focal point.");
    } else {
      toast.success("Focal point removed.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Image",
      render: (a) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">{a.name}</span>
          <span className="truncate text-xs text-text-secondary">
            {a.format || "Image"} · {a.dimensions || "no dimensions"} · {formatBytes(a.sizeBytes)}
          </span>
        </div>
      ),
    },
    {
      key: "orientation",
      header: "Orientation",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => <span className="capitalize">{orientationOf(a)}</span>,
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

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Images"
        description="Stills with dimensions, colour profile, focal points, and hi-res zoom — RAW-adjacent originals stay listed here when their type is image."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setZoomed((v) => !v)} disabled={!selected}>
            <ZoomIn className="h-4 w-4" /> {zoomed ? "Exit zoom" : "Hi-res zoom"}
          </Button>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={MEDIA_ASSET_STATUS_FILTER_OPTIONS} height="h-9" />
          <FilterDropdown value={orientationFilter} onValueChange={setOrientationFilter} options={ORIENTATION_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search images, formats, tags…" />
      </Toolbar>
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading images" />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(a) => a.id}
            onRowClick={(a) => {
              setSelectedId(a.id);
              setZoomed(false);
            }}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                {images.length === 0 ? (
                  <EmptyState icon={ImageIcon} title="No images yet" description="Upload a still to see dimensions, profiles, and focal points here." />
                ) : (
                  <EmptyState icon={ImageIcon} title="No images match these filters" description="Try a different status, orientation, or search term." action={<Button variant="outline" className="border-border bg-surface-card text-foreground hover:bg-surface-active" onClick={clearFilters}>Clear filters</Button>} />
                )}
              </div>
            }
          />
          {selected ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Preview" description={`${selected.dimensions || "Dimensions unknown"} · ${orientationOf(selected)}`}>
                {zoomed ? (
                  <div className="overflow-auto rounded-xl border border-border bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetVariantUrl(selected.id, "poster")} alt={selected.name} className="w-full origin-top-left scale-150 object-contain" />
                  </div>
                ) : (
                  <AssetPreview asset={selected} />
                )}
                <p className="mt-3 text-xs text-text-secondary">
                  Zoom serves the poster rendition when derived; otherwise the delivery route falls back to the original.
                </p>
              </SectionCard>
              <SectionCard
                title="Image details"
                description={`Colour profile ${colorProfileOf(selected)}`}
                action={
                  <Button size="sm" className="h-7 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={handleAddFocalPoint}>
                    <Plus className="h-3.5 w-3.5" /> Focal point
                  </Button>
                }
              >
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div><dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Dimensions</dt><dd className="mt-1 text-sm font-medium text-foreground">{selected.dimensions || "—"}</dd></div>
                  <div><dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Orientation</dt><dd className="mt-1 text-sm font-medium capitalize text-foreground">{orientationOf(selected)}</dd></div>
                  <div><dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Colour profile</dt><dd className="mt-1 text-sm font-medium text-foreground">{colorProfileOf(selected)}</dd></div>
                  <div><dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">MIME</dt><dd className="mt-1 text-sm font-medium text-foreground">{selected.mimeType || "—"}</dd></div>
                </dl>
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">Focal points ({focalPoints.length})</p>
                  {focalPoints.length === 0 ? (
                    <p className="mt-2 text-xs text-text-tertiary">No focal points — art-directed crops fall back to centre.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {focalPoints.map((point) => (
                        <li key={point.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs">
                          <Crosshair className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                          <span className="min-w-0 flex-1 truncate text-foreground">{point.label || "Focal point"} · {point.positionX ?? 50}% / {point.positionY ?? 50}%</span>
                          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${point.label}`} className="h-6 w-6 text-text-tertiary hover:bg-red-500/10 hover:text-red-400" onClick={() => handleRemoveFocalPoint(point)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </SectionCard>
            </div>
          ) : null}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default ImagesScreen;
