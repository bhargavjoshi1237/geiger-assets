"use client";

import React, { useEffect, useMemo, useState } from "react";
import { WandSparkles, Image as ImageIcon, RotateCw, FlipHorizontal2, Sun, Contrast, Droplets, Stamp, Eraser, History, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
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
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { STATUS_META, formatBytes } from "@/components/internal/screens/projects/library/constants";
import { assetFileUrl } from "@/lib/storage/client";
import { listAssets } from "@/lib/supabase/assets";
import { getOrientation, orientationLabel } from "../shared";
import { cn } from "@/lib/utils";

const CROP_PRESETS = [
  { value: "original", label: "Original" },
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

const JOB_STATUS_META = {
  queued: { label: "Queued", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30" },
  editing: { label: "Editing", className: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  ready: { label: "Ready", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  saved: { label: "Saved", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
};

function SliderRow({ icon: Icon, label, value, onChange }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-text-secondary"><Icon className="h-3.5 w-3.5" />{label}</span>
        <span className="font-mono tabular-nums text-foreground">{value}</span>
      </div>
      <input type="range" min={-100} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-primary" aria-label={label} />
    </div>
  );
}

export function ImageEditingScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [crop, setCrop] = useState("original");
  const [size, setSize] = useState({ w: "1080", h: "1080", lock: true });
  const [adjust, setAdjust] = useState({ brightness: 0, contrast: 0, saturation: 0 });
  const [watermark, setWatermark] = useState({ enabled: false, text: "© Studio", position: "bottom-right" });
  const [bgRemove, setBgRemove] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    listAssets(projectId).then((rows) => {
      if (!alive) return;
      const imgs = (rows ?? []).filter((a) => a.type === "image");
      setAssets(imgs);
      if (imgs.length && !selectedId) setSelectedId(imgs[0].id);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [projectId]);

  const filtered = useMemo(() => {
    if (!search) return assets;
    const q = search.toLowerCase();
    return assets.filter((a) => `${a.name} ${a.format}`.toLowerCase().includes(q));
  }, [assets, search]);

  const selected = selectedId ? assets.find((a) => a.id === selectedId) ?? null : null;
  const fileUrl = selected?.storageKey ? assetFileUrl(selected.id, {}) : selected?.thumbnailUrl;

  const stats = useMemo(() => {
    const ready = jobs.filter((j) => j.status === "ready" || j.status === "saved").length;
    return [
      { label: "Source images", value: String(assets.length), footer: "editable" },
      { label: "Variations", value: String(jobs.length), footer: "this session" },
      { label: "Ready", value: String(ready), footer: "to save" },
      { label: "Watermark", value: watermark.enabled ? "On" : "Off", footer: watermark.text || "no text" },
    ];
  }, [assets, jobs, watermark]);

  const opsSummary = [
    crop !== "original" ? `Crop ${crop}` : null,
    size.w && size.h ? `${size.w}×${size.h}` : null,
    adjust.brightness !== 0 ? `Bright ${adjust.brightness > 0 ? "+" : ""}${adjust.brightness}` : null,
    adjust.contrast !== 0 ? `Contrast ${adjust.contrast > 0 ? "+" : ""}${adjust.contrast}` : null,
    adjust.saturation !== 0 ? `Sat ${adjust.saturation > 0 ? "+" : ""}${adjust.saturation}` : null,
    watermark.enabled ? "Watermark" : null,
    bgRemove ? "BG remove" : null,
  ].filter(Boolean);

  const handleSaveVariation = () => {
    if (!selected) { toast.error("Pick a source image first."); return; }
    setSaving(true);
    setTimeout(() => {
      const job = {
        id: crypto.randomUUID(),
        sourceName: selected.name,
        sourceId: selected.id,
        ops: opsSummary.length ? opsSummary.join(" · ") : "Original",
        preset: crop,
        size: size.w && size.h ? `${size.w}×${size.h}` : "—",
        status: "ready",
        createdAt: new Date().toISOString(),
      };
      setJobs((p) => [job, ...p]);
      setSaving(false);
      toast.success(`Variation saved for ${selected.name}.`);
    }, 700);
  };

  const jobColumns = [
    {
      key: "source",
      header: "Variation",
      render: (j) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
            <ImageIcon className="h-4 w-4 text-text-secondary" />
          </div>
          <div className="min-w-0">
            <p className="max-w-[240px] truncate text-sm font-medium text-foreground">{j.sourceName}</p>
            <p className="max-w-[320px] truncate text-[11px] text-text-tertiary">{j.ops}</p>
          </div>
        </div>
      ),
    },
    { key: "size", header: "Output", className: "text-xs text-text-secondary hidden md:table-cell", headClassName: "hidden md:table-cell", render: (j) => j.size },
    { key: "status", header: "Status", render: (j) => <StatusPill status={j.status} map={JOB_STATUS_META} className="text-[10px]" /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (j) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon-sm" aria-label="Download variation" className="h-7 w-7 text-text-secondary hover:text-foreground" onClick={() => toast.success("Variation download started.")}>
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-text-secondary hover:text-foreground" onClick={() => { setJobs((p) => p.map((x) => (x.id === j.id ? { ...x, status: "saved" } : x))); toast.success("Saved as new version."); }}>
            Save
          </Button>
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Image Editing" description="Crop, resize, adjust, annotate, and watermark — save delivery-ready variations without touching masters." actions={<Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSaveVariation} disabled={saving || !selected}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />} Save variation</Button>} />
      <StatsBar stats={stats} />
      {loading ? (
        <LoadingArea panel size={56} />
      ) : assets.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={ImageIcon} title="No images to edit" description="Upload images from the Asset Library to start editing." /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
          <SectionCard title="Source" description={`${assets.length} images`} bodyPadding={false}>
            <div className="border-b border-border p-3">
              <SearchInput value={search} onChange={setSearch} placeholder="Search images…" />
            </div>
            <div className="max-h-[420px] divide-y divide-border overflow-y-auto">
              {filtered.map((a) => (
                <button key={a.id} type="button" onClick={() => setSelectedId(a.id)} className={cn("flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover", selectedId === a.id && "bg-surface-hover")}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-card">
                    {a.thumbnailUrl ? <img src={a.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-text-secondary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{a.name}</p>
                    <p className="text-[10px] text-text-tertiary">{orientationLabel(getOrientation(a))} · {formatBytes(a.sizeBytes)}</p>
                  </div>
                </button>
              ))}
              {filtered.length === 0 ? <p className="px-3 py-8 text-center text-xs text-text-tertiary">No matches.</p> : null}
            </div>
          </SectionCard>
          <SectionCard title={selected ? selected.name : "Canvas"} description={opsSummary.length ? opsSummary.join(" · ") : "Original — adjust on the right."} action={selected ? <StatusPill status={selected.status} map={STATUS_META} className="text-[10px]" /> : null}>
            <div className="overflow-hidden rounded-xl border border-border bg-black/40">
              {fileUrl ? (
                <img
                  src={fileUrl}
                  alt={selected?.name || ""}
                  className="max-h-[380px] w-full object-contain"
                  style={{ filter: `brightness(${100 + adjust.brightness}%) contrast(${100 + adjust.contrast}%) saturate(${100 + adjust.saturation}%)` }}
                />
              ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-text-tertiary">
                  <ImageIcon className="h-8 w-8" />
                  <p className="text-xs">No file preview — variations still record settings.</p>
                </div>
              )}
            </div>
            {watermark.enabled && watermark.text ? (
              <div className="relative -mt-10 flex justify-end px-4 pb-2">
                <span className="rounded bg-black/60 px-2 py-1 text-[11px] text-white">{watermark.text}</span>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {opsSummary.length === 0 ? <span className="text-xs text-text-tertiary">No edits yet — pick a crop or move a slider.</span> : opsSummary.map((o) => <Badge key={o} className="border border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] text-primary">{o}</Badge>)}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" className="border-border bg-transparent" onClick={() => toast.success("Rotated 90° clockwise.")}><RotateCw className="h-3.5 w-3.5" /> Rotate</Button>
              <Button variant="outline" size="sm" className="border-border bg-transparent" onClick={() => toast.success("Flipped horizontally.")}><FlipHorizontal2 className="h-3.5 w-3.5" /> Flip</Button>
              <Button variant="outline" size="sm" className="border-border bg-transparent" onClick={() => { setAdjust({ brightness: 0, contrast: 0, saturation: 0 }); setCrop("original"); setBgRemove(false); toast.success("Edits reset."); }}>Reset</Button>
            </div>
          </SectionCard>
          <div className="space-y-4">
            <SectionCard title="Crop & size" description="Delivery geometry.">
              <Field label="Crop preset">
                <SegmentedTabs fullWidth tabs={CROP_PRESETS.map((c) => ({ value: c.value, label: c.label }))} value={crop} onChange={setCrop} />
              </Field>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Field label="Width"><Input value={size.w} onChange={(e) => setSize((s) => ({ ...s, w: e.target.value }))} inputMode="numeric" className="border-border bg-surface-card font-mono" /></Field>
                <Field label="Height"><Input value={size.h} onChange={(e) => setSize((s) => ({ ...s, h: e.target.value }))} inputMode="numeric" className="border-border bg-surface-card font-mono" /></Field>
              </div>
              <button type="button" onClick={() => setSize((s) => ({ ...s, lock: !s.lock }))} className="mt-2 text-xs text-text-secondary hover:text-foreground">
                Aspect lock {size.lock ? "on" : "off"} — smart crop keeps the focal point.
              </button>
            </SectionCard>
            <SectionCard title="Adjust" description="Non-destructive color.">
              <div className="grid gap-3">
                <SliderRow icon={Sun} label="Brightness" value={adjust.brightness} onChange={(v) => setAdjust((a) => ({ ...a, brightness: v }))} />
                <SliderRow icon={Contrast} label="Contrast" value={adjust.contrast} onChange={(v) => setAdjust((a) => ({ ...a, contrast: v }))} />
                <SliderRow icon={Droplets} label="Saturation" value={adjust.saturation} onChange={(v) => setAdjust((a) => ({ ...a, saturation: v }))} />
              </div>
            </SectionCard>
            <SectionCard title="Finish" description="Overlays and cleanup.">
              <div className="grid gap-3">
                <div className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm text-foreground"><Eraser className="h-4 w-4 text-text-secondary" /> Background removal</span>
                  <Switch checked={bgRemove} onCheckedChange={(v) => { setBgRemove(v); if (v) toast.success("Background removal will run on save."); }} />
                </div>
                <div className="rounded-lg border border-border bg-surface-card px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-foreground"><Stamp className="h-4 w-4 text-text-secondary" /> Watermark</span>
                    <Switch checked={watermark.enabled} onCheckedChange={(v) => setWatermark((w) => ({ ...w, enabled: v }))} />
                  </div>
                  {watermark.enabled ? (
                    <div className="mt-2 grid gap-2">
                      <Input value={watermark.text} onChange={(e) => setWatermark((w) => ({ ...w, text: e.target.value }))} placeholder="© Studio" className="border-border bg-surface-subtle" />
                      <FilterDropdown value={watermark.position} onValueChange={(v) => setWatermark((w) => ({ ...w, position: v }))} options={[{ value: "bottom-right", label: "Bottom right" }, { value: "bottom-left", label: "Bottom left" }, { value: "center", label: "Center" }, { value: "top-right", label: "Top right" }]} height="h-8" />
                    </div>
                  ) : null}
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}
      <SectionCard
        title="Variations"
        description="Every save records ops, size, and source — promote to version or rendition."
        action={<span className="flex items-center gap-1.5 text-xs text-text-tertiary"><History className="h-3.5 w-3.5" />{jobs.length} this session</span>}
        bodyPadding={jobs.length === 0}
      >
        {jobs.length === 0 ? (
          <p className="py-2 text-sm text-text-tertiary">No variations yet. Tune the canvas, then Save variation.</p>
        ) : (
          <DataTable columns={jobColumns} data={jobs} getRowKey={(j) => j.id} />
        )}
      </SectionCard>
      <Toolbar>
        <span className="text-xs text-text-tertiary">Masters are never overwritten — variations save as versions or renditions.</span>
      </Toolbar>
    </MainScreenWrapper>
  );
}

export default ImageEditingScreen;

