"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Image as ImageIcon, Download, Link2, Maximize2, Crosshair, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import {
  TYPE_ICONS,
  FILE_TYPE_COLORS,
  STATUS_META,
  STATUS_FILTER_OPTIONS,
  formatBytes,
  formatDate,
} from "@/components/internal/screens/projects/library/constants";
import { assetFileUrl } from "@/lib/storage/client";
import { copyAssetLink } from "@/lib/delivery/copy_link";
import { listAssets } from "@/lib/supabase/assets";
import {
  getOrientation,
  orientationLabel,
  parseDimensions,
  assetExtension,
  formatDateTime,
} from "../shared";

const ORIENTATION_OPTIONS = [
  { value: "all", label: "All orientations" },
  { value: "landscape", label: "Landscape" },
  { value: "portrait", label: "Portrait" },
  { value: "square", label: "Square" },
  { value: "unknown", label: "Unknown" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "raw", label: "RAW only" },
  { value: "edited", label: "Non-RAW" },
];

function isRawAsset(a) {
  const ext = assetExtension(a);
  return ["dng", "cr2", "cr3", "nef", "arw", "orf", "rw2", "raw"].includes(ext) || a?.type === "raw";
}

function ImageThumb({ asset }) {
  const Icon = TYPE_ICONS[asset.type] || ImageIcon;
  if (asset.thumbnailUrl) {
    return <img src={asset.thumbnailUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover" />;
  }
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
      style={{ background: `${asset.color}15`, borderColor: `${asset.color}25` }}
    >
      <Icon className="h-4 w-4" style={{ color: asset.color || "#737373" }} />
    </div>
  );
}

function FocalPointPicker({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
        onChange({ x, y });
      }}
      className="relative block aspect-video w-full overflow-hidden rounded-xl border border-border bg-surface-card"
      aria-label="Set focal point"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_0%,transparent_60%)]" />
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="border border-border/40" />
        ))}
      </div>
      <div
        className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-primary/80 shadow"
        style={{ left: `${value.x}%`, top: `${value.y}%` }}
      >
        <Crosshair className="h-3 w-3 text-white" />
      </div>
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
        {value.x}% · {value.y}%
      </span>
    </button>
  );
}

function ImageDetail({ asset, onBack, focalPoints, onFocalChange }) {
  const parsed = parseDimensions(asset.dimensions);
  const orientation = getOrientation(asset);
  const raw = isRawAsset(asset);
  const focal = focalPoints[asset.id] || { x: 50, y: 50 };
  const fileUrl = asset.storageKey ? assetFileUrl(asset.id, {}) : asset.thumbnailUrl;
  const meta = [
    { label: "Dimensions", value: asset.dimensions || "—" },
    { label: "Orientation", value: orientationLabel(orientation) },
    { label: "Format", value: (asset.format || asset.type || "—").toUpperCase() },
    { label: "Size", value: formatBytes(asset.sizeBytes) },
    { label: "Folder", value: asset.folder || "root" },
    { label: "Updated", value: formatDateTime(asset.updatedAt) },
  ];
  return (
    <MainScreenWrapper>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to images" className="h-8 w-8 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <ImageThumb asset={asset} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{asset.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusPill status={asset.status} map={STATUS_META} className="text-[10px]" />
              {raw ? <Badge className="border border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-300">RAW</Badge> : null}
              <span className="text-xs text-text-secondary">{orientationLabel(orientation)}{parsed ? ` · ${parsed.width}×${parsed.height}` : ""}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => copyAssetLink(asset)}>
            <Link2 className="h-4 w-4" /> Copy link
          </Button>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => {
              if (!asset.storageKey) { toast.error("No file uploaded yet for this asset."); return; }
              window.open(assetFileUrl(asset.id, { download: true }), "_blank");
            }}
          >
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
        <SectionCard title="Preview" description="High-resolution zoom and focal point for smart crops." action={<Badge className="border border-border bg-surface-card px-2 py-0.5 text-[11px] text-text-secondary"><Maximize2 className="mr-1 h-3 w-3" />{parsed ? `${parsed.width}×${parsed.height}` : "Preview"}</Badge>}>
          <div className="overflow-hidden rounded-xl border border-border bg-black/40">
            {fileUrl ? (
              <img src={fileUrl} alt={asset.name} className="max-h-[420px] w-full cursor-zoom-in object-contain transition-transform hover:scale-[1.02]" />
            ) : (
              <div className="flex h-64 items-center justify-center text-text-tertiary">
                <ImageIcon className="h-10 w-10" />
              </div>
            )}
          </div>
          <div className="mt-4">
            <Field label="Focal point" hint="Click to place. Renditions and smart crops keep this subject.">
              <FocalPointPicker value={focal} onChange={(v) => onFocalChange(asset.id, v)} />
            </Field>
          </div>
        </SectionCard>
        <div className="space-y-4">
          <SectionCard title="Image metadata" description="Dimensions, color, and file facts.">
            <dl className="grid grid-cols-2 gap-3">
              {meta.map((m) => (
                <div key={m.label} className="rounded-lg border border-border bg-surface-card px-3 py-2.5">
                  <dt className="text-[11px] uppercase tracking-wide text-text-tertiary">{m.label}</dt>
                  <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{m.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(asset.tags || []).map((t) => (
                <Badge key={t} className="border border-border bg-surface-card px-1.5 py-0 text-[10px] text-text-secondary">#{t}</Badge>
              ))}
              {(asset.tags || []).length === 0 ? <span className="text-xs text-text-tertiary">No tags yet.</span> : null}
            </div>
          </SectionCard>
          <SectionCard title="Color & source" description="Profile and capture facts.">
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Color profile</span>
                <span className="font-medium text-foreground">{asset.colorProfile || "sRGB"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Source</span>
                <span className="font-medium text-foreground">{raw ? "Camera RAW" : "Processed image"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">MIME</span>
                <span className="font-medium text-foreground">{asset.mimeType || "—"}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className="h-6 w-6 rounded border border-border" style={{ background: asset.color || "#737373" }} />
                <span className="text-xs text-text-secondary">{asset.color || "#737373"}</span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </MainScreenWrapper>
  );
}

export function ImagesScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [orientationFilter, setOrientationFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [focalPoints, setFocalPoints] = useState({});

  useEffect(() => {
    let alive = true;
    listAssets(projectId).then((rows) => {
      if (!alive) return;
      setAssets((rows ?? []).filter((a) => a.type === "image" || isRawAsset(a)));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [projectId]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (orientationFilter !== "all" && getOrientation(a) !== orientationFilter) return false;
      if (sourceFilter === "raw" && !isRawAsset(a)) return false;
      if (sourceFilter === "edited" && isRawAsset(a)) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search && !`${a.name} ${a.format} ${(a.tags || []).join(" ")} ${a.dimensions}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [assets, search, orientationFilter, sourceFilter, statusFilter]);

  const pager = usePagination(filtered, { resetKey: `${search}|${orientationFilter}|${sourceFilter}|${statusFilter}` });

  const stats = useMemo(() => {
    const totalBytes = assets.reduce((s, a) => s + (a.sizeBytes || 0), 0);
    const rawCount = assets.filter(isRawAsset).length;
    const noDims = assets.filter((a) => !a.dimensions).length;
    return [
      { label: "Images", value: String(assets.length), footer: "in this project" },
      { label: "RAW sources", value: String(rawCount), footer: "unprocessed captures" },
      { label: "Storage", value: formatBytes(totalBytes), footer: "across images" },
      { label: "Missing dims", value: String(noDims), footer: "needs inspection" },
    ];
  }, [assets]);

  const openAsset = openId ? assets.find((a) => a.id === openId) ?? null : null;

  const columns = [
    {
      key: "name",
      header: "Image",
      render: (a) => (
        <div className="flex items-center gap-3">
          <ImageThumb asset={a} />
          <div className="min-w-0">
            <p className="max-w-[260px] truncate text-sm font-medium text-foreground">{a.name}</p>
            <p className="text-xs text-text-secondary">{(a.format || a.type || "").toUpperCase()} · {formatBytes(a.sizeBytes)} · {a.folder}</p>
          </div>
        </div>
      ),
    },
    {
      key: "dims",
      header: "Dimensions",
      className: "text-xs text-text-secondary hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => a.dimensions || "—",
    },
    {
      key: "orientation",
      header: "Orientation",
      render: (a) => (
        <Badge className="border border-border bg-surface-card px-1.5 py-0 text-[10px] text-text-secondary">{orientationLabel(getOrientation(a))}</Badge>
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (a) => (
        isRawAsset(a)
          ? <Badge className="border border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-300">RAW</Badge>
          : <Badge className={FILE_TYPE_COLORS[a.type] ? `border px-1.5 py-0 text-[10px] ${FILE_TYPE_COLORS[a.type]}` : "border border-border bg-surface-card px-1.5 py-0 text-[10px] text-text-secondary"}>{a.format || a.type}</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusPill status={a.status} map={STATUS_META} />,
    },
    {
      key: "modified",
      header: "Modified",
      className: "text-xs text-text-secondary hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (a) => formatDate(a.updatedAt),
    },
  ];

  if (openAsset) {
    return (
      <ImageDetail
        asset={openAsset}
        onBack={() => setOpenId(null)}
        focalPoints={focalPoints}
        onFocalChange={(id, v) => {
          setFocalPoints((p) => ({ ...p, [id]: v }));
          toast.success(`Focal point set to ${v.x}%, ${v.y}%.`);
        }}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Images"
        description="Photography, graphics, and raster media — inspect dimensions, orientation, color, and focal points."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => toast.info("Upload from Asset Library to add images." )}>
            <Upload className="h-4 w-4" /> Upload images
          </Button>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={orientationFilter} onValueChange={setOrientationFilter} options={ORIENTATION_OPTIONS} height="h-9" />
          <FilterDropdown value={sourceFilter} onValueChange={setSourceFilter} options={SOURCE_OPTIONS} height="h-9" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search images, formats, tags…" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel size={56} />
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(a) => a.id}
            onRowClick={(a) => setOpenId(a.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState icon={ImageIcon} title={assets.length ? "No images match your filters" : "No images yet"} description={assets.length ? "Try clearing search or filters." : "Upload images from the Asset Library to see them here."} />
              </div>
            }
          />
          <ListPagination {...pager} itemLabel="images" />
        </div>
      )}
      {loading ? null : <p className="flex items-center gap-1.5 text-xs text-text-tertiary"><Loader2 className="hidden h-3 w-3" />Showing {filtered.length} of {assets.length} images</p>}
    </MainScreenWrapper>
  );
}

export default ImagesScreen;
