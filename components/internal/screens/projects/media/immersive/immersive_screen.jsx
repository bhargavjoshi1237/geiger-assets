"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Boxes, Rotate3d, ZoomIn, QrCode, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
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
import { STATUS_META, STATUS_FILTER_OPTIONS, formatBytes, formatDate } from "@/components/internal/screens/projects/library/constants";
import { listAssets } from "@/lib/supabase/assets";
import { threeDFormatOf } from "../shared";
import { cn } from "@/lib/utils";

const FORMAT_OPTIONS = [
  { value: "all", label: "All formats" },
  { value: "GLB", label: "GLB / glTF" },
  { value: "OBJ", label: "OBJ" },
  { value: "FBX", label: "FBX" },
  { value: "USDZ", label: "USDZ" },
  { value: "Other", label: "Other" },
];

const AR_OPTIONS = [
  { value: "all", label: "All models" },
  { value: "ready", label: "AR-ready" },
  { value: "not", label: "Not AR-ready" },
];

function isArReady(asset) {
  const fmt = threeDFormatOf(asset);
  if (["GLB", "GLTF", "USDZ"].includes(fmt)) return true;
  return String(asset?.id || "").charCodeAt(0) % 2 === 0;
}

function mockPolyCount(asset) {
  const id = String(asset?.id || asset?.name || "3d");
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 37 + id.charCodeAt(i)) % 900000;
  return 8000 + h;
}

function ViewerMock({ asset, autoRotate, wireframe }) {
  const [angle, setAngle] = useState(18);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.08),transparent_60%)] bg-surface-card">
      <div className="flex h-64 items-center justify-center" style={{ perspective: "800px" }}>
        <div
          className={cn("relative h-32 w-32 transition-transform duration-300", wireframe && "opacity-90")}
          style={{ transform: `rotateY(${angle}deg) rotateX(-12deg)`, transformStyle: "preserve-3d" }}
        >
          <div className={cn("absolute inset-0 rounded-xl border-2", wireframe ? "border-dashed border-primary bg-transparent" : "border-primary/50 bg-primary/15")} style={{ transform: "translateZ(48px)" }} />
          <div className={cn("absolute inset-0 rounded-xl border-2", wireframe ? "border-dashed border-primary/60 bg-transparent" : "border-primary/30 bg-primary/10")} style={{ transform: "rotateY(90deg) translateZ(48px)" }} />
          <div className={cn("absolute inset-0 rounded-xl border-2", wireframe ? "border-dashed border-primary/40 bg-transparent" : "border-primary/20 bg-primary/5")} style={{ transform: "rotateX(90deg) translateZ(48px)" }} />
          <Boxes className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-primary" />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
        <Button variant="outline" size="sm" className="border-border bg-transparent" onClick={() => setAngle((a) => a - 30)}>
          <Rotate3d className="h-3.5 w-3.5" /> Rotate
        </Button>
        <Button variant="outline" size="sm" className="border-border bg-transparent" onClick={() => toast.success("Zoom reset to fit.")}>
          <ZoomIn className="h-3.5 w-3.5" /> Fit
        </Button>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-text-secondary">{angle}°{autoRotate ? " · auto" : ""}</span>
      </div>
    </div>
  );
}

function ImmersiveDetail({ asset, onBack }) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const fmt = threeDFormatOf(asset);
  const ar = isArReady(asset);
  const polys = mockPolyCount(asset);
  const checklist = [
    { label: "PBR materials embedded", done: true },
    { label: "Under 200k triangles for web", done: polys < 200000 },
    { label: "USDZ / GLB for AR Quick Look", done: ar },
    { label: "Poster thumbnail rendered", done: Boolean(asset.thumbnailUrl) },
  ];
  return (
    <MainScreenWrapper>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to 3D models" className="h-8 w-8 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/15">
            <Boxes className="h-5 w-5 text-rose-300" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{asset.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge className="border border-rose-500/30 bg-rose-500/15 px-1.5 py-0 text-[10px] text-rose-300">{fmt}</Badge>
              <StatusPill status={asset.status} map={STATUS_META} className="text-[10px]" />
              <span className="text-xs text-text-secondary">{polys.toLocaleString()} tris · {formatBytes(asset.sizeBytes)}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => setWireframe((w) => !w)}>
            Wireframe {wireframe ? "on" : "off"}
          </Button>
          <Button variant="outline" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => setAutoRotate((v) => !v)}>
            Turntable {autoRotate ? "on" : "off"}
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
        <div className="space-y-4">
          <SectionCard title="Interactive preview" description="Rotate, zoom, and inspect before publishing to AR.">
            <ViewerMock asset={asset} autoRotate={autoRotate} wireframe={wireframe} />
            <p className="mt-2 text-xs text-text-tertiary">Full glTF / USDZ renderer plugs in here — controls, lighting, and material slots stay the same.</p>
          </SectionCard>
          <SectionCard title="Publishing checklist" description="What blocks web and AR delivery.">
            <div className="space-y-2">
              {checklist.map((c) => (
                <div key={c.label} className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5 text-sm">
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border", c.done ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300")}>
                    {c.done ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </span>
                  <span className="text-foreground">{c.label}</span>
                </div>
              ))}
            </div>
            <Button className="mt-3 w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => toast.success("Web + AR renditions queued.")}>
              Generate web & AR renditions
            </Button>
          </SectionCard>
        </div>
        <div className="space-y-4">
          <SectionCard title="Model metadata" description="Geometry and material facts.">
            <div className="space-y-2.5 text-sm">
              {[
                ["Format", fmt],
                ["Triangles", polys.toLocaleString()],
                ["Materials", "3 PBR sets"],
                ["Textures", "4K · PNG"],
                ["Size", formatBytes(asset.sizeBytes)],
                ["AR-ready", ar ? "Yes" : "Needs USDZ/GLB"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">{k}</span>
                  <span className="font-medium text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="AR preview" description="Scan to open on device.">
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-surface-card">
                <QrCode className="h-8 w-8 text-foreground" />
                <span className="text-[9px] text-text-tertiary">AR link</span>
              </div>
              <div className="min-w-0 text-xs leading-5 text-text-secondary">
                {ar ? "Model is AR-ready. Share the signed link for Quick Look and Scene Viewer." : "Convert to USDZ or GLB to enable one-tap AR on phones."}
                <Button variant="outline" size="sm" className="mt-2 border-border bg-transparent" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/ar/${asset.id}`); toast.success("AR link copied."); }}>
                  Copy AR link
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </MainScreenWrapper>
  );
}

export function ImmersiveScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");
  const [arFilter, setArFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    listAssets(projectId).then((rows) => {
      if (!alive) return;
      setAssets((rows ?? []).filter((a) => a.type === "3d"));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [projectId]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      const fmt = threeDFormatOf(a);
      if (formatFilter !== "all") {
        if (formatFilter === "Other") {
          if (["GLB", "GLTF", "OBJ", "FBX", "USDZ"].includes(fmt)) return false;
        } else if (formatFilter === "GLB") {
          if (!["GLB", "GLTF"].includes(fmt)) return false;
        } else if (fmt !== formatFilter) return false;
      }
      if (arFilter === "ready" && !isArReady(a)) return false;
      if (arFilter === "not" && isArReady(a)) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search && !`${a.name} ${a.format} ${fmt} ${(a.tags || []).join(" ")}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [assets, search, formatFilter, arFilter, statusFilter]);

  const pager = usePagination(filtered, { resetKey: `${search}|${formatFilter}|${arFilter}|${statusFilter}` });

  const stats = useMemo(() => {
    const arCount = assets.filter(isArReady).length;
    const tris = assets.reduce((s, a) => s + mockPolyCount(a), 0);
    return [
      { label: "3D models", value: String(assets.length), footer: "in this project" },
      { label: "AR-ready", value: String(arCount), footer: "GLB / USDZ" },
      { label: "Triangles", value: tris > 1000000 ? `${(tris / 1000000).toFixed(1)}M` : `${Math.round(tris / 1000)}k`, footer: "total geometry" },
      { label: "Storage", value: formatBytes(assets.reduce((s, a) => s + (a.sizeBytes || 0), 0)), footer: "source models" },
    ];
  }, [assets]);

  const openAsset = openId ? assets.find((a) => a.id === openId) ?? null : null;
  if (openAsset) return <ImmersiveDetail asset={openAsset} onBack={() => setOpenId(null)} />;

  const columns = [
    {
      key: "name",
      header: "Model",
      render: (a) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/15">
            <Boxes className="h-4 w-4 text-rose-300" />
          </div>
          <div className="min-w-0">
            <p className="max-w-[240px] truncate text-sm font-medium text-foreground">{a.name}</p>
            <p className="text-xs text-text-secondary">{mockPolyCount(a).toLocaleString()} tris · {formatBytes(a.sizeBytes)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "format",
      header: "Format",
      render: (a) => <Badge className="border border-rose-500/30 bg-rose-500/15 px-1.5 py-0 text-[10px] text-rose-300">{threeDFormatOf(a)}</Badge>,
    },
    {
      key: "ar",
      header: "AR",
      render: (a) => (
        isArReady(a)
          ? <Badge className="border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0 text-[10px] text-emerald-300">AR-ready</Badge>
          : <Badge className="border border-border bg-surface-card px-1.5 py-0 text-[10px] text-text-secondary">Convert</Badge>
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

  return (
    <MainScreenWrapper>
      <ScreenHeader title="3D & Immersive" description="Review models, check AR readiness, and publish web + AR renditions." actions={<Loader2 className="hidden h-3 w-3" />} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={formatFilter} onValueChange={setFormatFilter} options={FORMAT_OPTIONS} height="h-9" />
          <FilterDropdown value={arFilter} onValueChange={setArFilter} options={AR_OPTIONS} height="h-9" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search models, formats…" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel size={56} />
      ) : (
        <div className="space-y-5">
          <DataTable columns={columns} data={pager.pageItems} getRowKey={(a) => a.id} onRowClick={(a) => setOpenId(a.id)} empty={<div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={Boxes} title={assets.length ? "No models match" : "No 3D models yet"} description={assets.length ? "Try clearing search or filters." : "Upload GLB, OBJ, FBX, or USDZ from the Asset Library."} /></div>} />
          <ListPagination {...pager} itemLabel="models" />
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default ImmersiveScreen;

