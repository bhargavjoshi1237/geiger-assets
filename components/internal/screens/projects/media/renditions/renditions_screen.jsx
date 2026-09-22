"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FileOutput, Image as ImageIcon, Copy, Download, RefreshCw, Loader2, Code2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Switch } from "@geiger/ui/switch";
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
import { formatBytes } from "@/components/internal/screens/projects/library/constants";
import { listAssets } from "@/lib/supabase/assets";
import { RENDITION_PRESETS, formatDuration, mockDurationSeconds } from "../shared";
import { cn } from "@/lib/utils";

const RENDITION_STATUS = {
  ready: { label: "Ready", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  queued: { label: "Queued", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30" },
  processing: { label: "Processing", className: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  failed: { label: "Failed", className: "bg-red-500/15 text-red-300 border-red-500/30" },
};

const FORMAT_FILTER = [
  { value: "all", label: "All formats" },
  { value: "WebP", label: "WebP" },
  { value: "JPEG", label: "JPEG" },
  { value: "PNG", label: "PNG" },
];

function savingsFor(preset, asset) {
  const id = String(asset?.id || preset.id);
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 13 + id.charCodeAt(i)) % 60;
  return 25 + h;
}

export function RenditionsScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState({ "thumb-sm": true, "thumb-lg": true, "social-square": true, "social-story": false, "banner-wide": true, "print-xl": false });
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const [renditions, setRenditions] = useState([]);
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let alive = true;
    listAssets(projectId).then((rows) => {
      if (!alive) return;
      const usable = (rows ?? []).filter((a) => ["image", "video"].includes(a.type));
      setAssets(usable);
      if (usable.length) setSelectedSourceId(usable[0].id);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [projectId]);

  const selected = selectedSourceId ? assets.find((a) => a.id === selectedSourceId) ?? null : null;

  const filtered = useMemo(() => {
    return renditions.filter((r) => {
      if (formatFilter !== "all" && r.format !== formatFilter) return false;
      if (search && !`${r.sourceName} ${r.presetLabel} ${r.format}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [renditions, search, formatFilter]);

  const pager = usePagination(filtered, { resetKey: `${search}|${formatFilter}` });

  const stats = useMemo(() => {
    const ready = renditions.filter((r) => r.status === "ready").length;
    const bytes = renditions.reduce((s, r) => s + (r.sizeBytes || 0), 0);
    return [
      { label: "Sources", value: String(assets.length), footer: "images + video" },
      { label: "Presets on", value: String(Object.values(enabled).filter(Boolean).length), footer: `of ${RENDITION_PRESETS.length}` },
      { label: "Renditions", value: String(ready), footer: "ready to download" },
      { label: "Output size", value: formatBytes(bytes), footer: "generated files" },
    ];
  }, [assets, renditions, enabled]);

  const handleGenerate = () => {
    if (!selected) { toast.error("Pick a source first."); return; }
    const active = RENDITION_PRESETS.filter((p) => enabled[p.id]);
    if (!active.length) { toast.error("Enable at least one preset."); return; }
    setGenerating(true);
    const batch = active.map((p) => ({
      id: crypto.randomUUID(),
      sourceId: selected.id,
      sourceName: selected.name,
      preset: p.id,
      presetLabel: p.label,
      format: p.format,
      dims: `${p.width}×${p.height}`,
      quality: p.quality,
      sizeBytes: Math.max(8000, Math.round((selected.sizeBytes || 400000) * (p.width / 2400) * (p.quality / 100))),
      savings: savingsFor(p, selected),
      status: "processing",
    }));
    setRenditions((prev) => [...batch, ...prev]);
    setTimeout(() => {
      setRenditions((prev) => prev.map((r) => (batch.some((b) => b.id === r.id) ? { ...r, status: "ready" } : r)));
      setGenerating(false);
      toast.success(`${batch.length} renditions ready for ${selected.name}.`);
    }, 900);
  };

  const srcset = useMemo(() => {
    if (!selected) return "";
    return RENDITION_PRESETS.filter((p) => enabled[p.id])
      .map((p) => `/cdn/${selected.id}/${p.id}.${p.format.toLowerCase()} ${p.width}w`)
      .join(",\n");
  }, [selected, enabled]);

  const columns = [
    {
      key: "rendition",
      header: "Rendition",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-card">
            <ImageIcon className="h-4 w-4 text-text-secondary" />
          </div>
          <div className="min-w-0">
            <p className="max-w-[240px] truncate text-sm font-medium text-foreground">{r.sourceName} · {r.presetLabel}</p>
            <p className="text-[11px] text-text-tertiary">{r.dims} · q{r.quality} · {formatBytes(r.sizeBytes)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "format",
      header: "Format",
      render: (r) => <Badge className="border border-border bg-surface-card px-1.5 py-0 text-[10px] text-text-secondary">{r.format}</Badge>,
    },
    {
      key: "savings",
      header: "Savings",
      className: "tabular-nums text-xs text-emerald-300 hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (r) => `−${r.savings}%`,
    },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} map={RENDITION_STATUS} className="text-[10px]" /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon-sm" aria-label="Copy URL" className="h-7 w-7 text-text-secondary hover:text-foreground" onClick={() => { navigator.clipboard?.writeText(`/cdn/${r.sourceId}/${r.preset}.${r.format.toLowerCase()}`); toast.success("Rendition URL copied."); }}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Download rendition" className="h-7 w-7 text-text-secondary hover:text-foreground" onClick={() => toast.success("Rendition download started.")}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Renditions & Formats" description="Preset outputs, compression, and responsive sets — generated from masters, never overwriting them." actions={<Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleGenerate} disabled={generating || !selected}>{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Generate renditions</Button>} />
      <StatsBar stats={stats} />
      {loading ? (
        <LoadingArea panel size={56} />
      ) : assets.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={FileOutput} title="No sources yet" description="Upload images or video to generate renditions." /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
          <SectionCard title="Rendition presets" description="Toggle what auto-generates on publish.">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {RENDITION_PRESETS.map((p) => (
                <div key={p.id} className={cn("rounded-xl border p-3 transition-colors", enabled[p.id] ? "border-primary/30 bg-primary/5" : "border-border bg-surface-card")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{p.label}</p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-text-secondary">{p.width}×{p.height} · {p.format} q{p.quality}</p>
                      <p className="mt-0.5 text-[11px] text-text-tertiary">{p.use}</p>
                    </div>
                    <Switch checked={!!enabled[p.id]} onCheckedChange={(v) => setEnabled((e) => ({ ...e, [p.id]: v }))} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
          <div className="space-y-4">
            <SectionCard title="Source" description="Renditions generate from this master.">
              <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                {assets.slice(0, 12).map((a) => (
                  <button key={a.id} type="button" onClick={() => setSelectedSourceId(a.id)} className={cn("flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors", selectedSourceId === a.id ? "border-primary/40 bg-primary/5 text-foreground" : "border-border bg-surface-card text-text-secondary hover:text-foreground")}>
                    <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums">{a.type === "video" ? formatDuration(mockDurationSeconds(a)) : formatBytes(a.sizeBytes)}</span>
                  </button>
                ))}
              </div>
              {selected ? <p className="mt-2 text-[11px] text-text-tertiary">~{savingsFor(RENDITION_PRESETS[0], selected)}% average savings at default quality.</p> : null}
            </SectionCard>
            <SectionCard title="Responsive set" description="Drop-in srcset for the web." action={<Code2 className="h-4 w-4 text-text-tertiary" />}>
              <pre className="overflow-x-auto rounded-lg border border-border bg-black/40 p-3 font-mono text-[11px] leading-5 text-text-secondary">{srcset || "Enable a preset to build the set."}</pre>
              <Button variant="outline" size="sm" className="mt-2 w-full border-border bg-transparent" onClick={() => { if (!srcset) return; navigator.clipboard?.writeText(`<img srcset="${srcset}" alt="${selected?.name || ""}" />`); toast.success("Snippet copied."); }}>
                <Copy className="h-3.5 w-3.5" /> Copy snippet
              </Button>
            </SectionCard>
          </div>
        </div>
      )}
      <div className="space-y-4">
        <Toolbar>
          <FilterDropdown value={formatFilter} onValueChange={setFormatFilter} options={FORMAT_FILTER} height="h-9" />
          <SearchInput value={search} onChange={setSearch} placeholder="Search renditions…" />
        </Toolbar>
        <DataTable columns={columns} data={pager.pageItems} getRowKey={(r) => r.id} empty={<div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={FileOutput} title="No renditions yet" description="Enable presets, pick a source, and Generate renditions." /></div>} />
        {pager.pageItems.length > 0 ? <ListPagination {...pager} itemLabel="renditions" /> : null}
      </div>
    </MainScreenWrapper>
  );
}

export default RenditionsScreen;

