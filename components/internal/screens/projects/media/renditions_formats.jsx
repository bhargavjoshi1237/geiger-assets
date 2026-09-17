"use client";

import { Button, LogoLoading } from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Layers, Loader2, Trash2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
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
import { createMediaJob, listMediaJobs, softDeleteMediaJob } from "@/lib/supabase/media_screens";
import { assetVariantUrl } from "@/lib/storage/client";
import {
  MEDIA_ASSET_STATUS_FILTER_OPTIONS,
  MEDIA_ASSET_STATUS_MAP,
  MEDIA_JOB_STATUS_MAP,
  RENDITION_OPERATION_OPTIONS,
  RENDITION_PRESETS,
  formatBytes,
  formatDate,
} from "./constants";

export function RenditionsFormatsScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [operation, setOperation] = useState("preset");
  const [presetName, setPresetName] = useState("preview");
  const [targetFormat, setTargetFormat] = useState("webp");
  const [quality, setQuality] = useState("78");
  const [queuing, setQueuing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listAssets(projectId), listMediaJobs(projectId)]).then(([rows, jobRows]) => {
      if (!alive) return;
      setAssets(rows ?? []);
      setJobs(jobRows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const sources = useMemo(() => assets.filter((a) => a.type === "image"), [assets]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sources.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (needle && !`${a.name} ${a.format} ${(a.tags || []).join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [sources, search, statusFilter]);

  const selected = useMemo(
    () => filtered.find((a) => a.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  const selectedJobs = useMemo(
    () => jobs.filter((j) => j.assetId === selected?.id && j.jobType === "rendition").slice(0, 12),
    [jobs, selected],
  );

  const presetOptions = useMemo(
    () => RENDITION_PRESETS.map((p) => ({ value: p.name, label: `${p.label} ${p.width}px` })),
    [],
  );

  const stats = useMemo(() => {
    const renditions = jobs.filter((j) => j.jobType === "rendition");
    return [
      { label: "Sources", value: String(sources.length), footer: "rendition-capable images" },
      { label: "Presets", value: String(RENDITION_PRESETS.length), footer: "thumb / preview / poster" },
      { label: "Queued", value: String(renditions.filter((j) => j.status === "queued" || j.status === "processing").length), footer: "in flight" },
      { label: "Ready", value: String(renditions.filter((j) => j.status === "ready").length), footer: "outputs recorded" },
    ];
  }, [sources, jobs]);

  const filtersActive = search.trim() !== "" || statusFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const handleQueue = async () => {
    if (!selected || queuing) return;
    const q = Math.max(1, Math.min(100, Number(quality) || 78));
    setQueuing(true);
    const id = crypto.randomUUID();
    const params = { operation, preset: presetName, format: targetFormat, quality: q };
    const optimistic = { id, projectId, assetId: selected.id, jobType: "rendition", operation, status: "queued", progress: 0, error: "", outputAssetId: null, metadata: { params }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setJobs((prev) => [optimistic, ...prev]);
    const created = await createMediaJob({ id, projectId, assetId: selected.id, jobType: "rendition", operation, status: "queued", progress: 0, metadata: { params } });
    setQueuing(false);
    if (created) {
      setJobs((prev) => prev.map((j) => (j.id === id ? created : j)));
      toast.success("Rendition queued.");
    } else {
      setJobs((prev) => prev.filter((j) => j.id !== id));
      toast.error("Couldn't queue the rendition.");
    }
  };

  const handleCancel = async (job) => {
    const prev = jobs;
    setJobs((rows) => rows.filter((j) => j.id !== job.id));
    const ok = await softDeleteMediaJob(job.id);
    if (!ok) {
      setJobs(prev);
      toast.error("Couldn't cancel the rendition.");
    } else {
      toast.success("Rendition cancelled.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Source",
      render: (a) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">{a.name}</span>
          <span className="truncate text-xs text-text-secondary">{a.format || "Image"} · {a.dimensions || "no dimensions"} · {formatBytes(a.sizeBytes)}</span>
        </div>
      ),
    },
    {
      key: "renditions",
      header: "Jobs",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => String(jobs.filter((j) => j.assetId === a.id && j.jobType === "rendition").length),
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

  const srcset = selected
    ? RENDITION_PRESETS.map((p) => `${assetVariantUrl(selected.id, p.name)} ${p.width}w`).join(", ")
    : "";

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Renditions & Formats"
        description="Automated renditions from the real derive presets, plus conversion, compression, and responsive sets."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleQueue} disabled={!selected || queuing}>
            {queuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />} {queuing ? "Queuing…" : "Queue rendition"}
          </Button>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={operation} onValueChange={setOperation} options={RENDITION_OPERATION_OPTIONS} height="h-9" />
          <FilterDropdown value={presetName} onValueChange={setPresetName} options={presetOptions} height="h-9" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={MEDIA_ASSET_STATUS_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search sources…" />
      </Toolbar>
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading renditions" />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(a) => a.id}
            onRowClick={(a) => setSelectedId(a.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                {sources.length === 0 ? (
                  <EmptyState icon={Layers} title="No rendition sources" description="Upload an image to generate thumb, preview, and poster renditions." />
                ) : (
                  <EmptyState icon={Layers} title="No sources match these filters" description="Try a different status or search term." action={<Button variant="outline" className="border-border bg-surface-card text-foreground hover:bg-surface-active" onClick={clearFilters}>Clear filters</Button>} />
                )}
              </div>
            }
          />
          {selected ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Preset downloads" description="Widths mirror VARIANTS in lib/media/derive.js (server-only, copied here like storage/client.js).">
                <AssetPreview asset={selected} />
                <ul className="mt-3 space-y-2">
                  {RENDITION_PRESETS.map((preset) => (
                    <li key={preset.name} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{preset.label} · {preset.width}px · q{preset.quality}</span>
                        <span className="block truncate text-text-tertiary">{preset.hint}</span>
                      </span>
                      <a href={assetVariantUrl(selected.id, preset.name)} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-surface-subtle px-2.5 text-xs font-medium text-foreground hover:bg-surface-active">
                        <Download className="h-3.5 w-3.5" /> {preset.format.toUpperCase()}
                      </a>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field label="Target format">
                    <FilterDropdown value={targetFormat} onValueChange={setTargetFormat} options={[{ value: "webp", label: "WebP" }, { value: "avif", label: "AVIF" }]} height="h-9" />
                  </Field>
                  <Field label="Quality (1–100)"><input value={quality} onChange={(e) => setQuality(e.target.value)} inputMode="numeric" className="h-9 rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground outline-none" /></Field>
                </div>
              </SectionCard>
              <SectionCard title={`Rendition jobs (${selectedJobs.length})`} description="Responsive sets resolve to the same preset URLs below.">
                {selectedJobs.length === 0 ? (
                  <p className="text-xs text-text-tertiary">No rendition jobs for this source — queue a preset, conversion, or responsive set above.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedJobs.map((job) => (
                      <li key={job.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs">
                        <span className="min-w-0 flex-1 truncate capitalize text-foreground">{job.operation} · {job.metadata?.params?.preset || presetName} · {job.metadata?.params?.format || targetFormat}</span>
                        <StatusPill status={job.status} map={MEDIA_JOB_STATUS_MAP} />
                        <Button variant="ghost" size="icon-sm" aria-label="Cancel rendition" className="h-6 w-6 text-text-tertiary hover:bg-red-500/10 hover:text-red-400" onClick={() => handleCancel(job)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">Responsive srcset</p>
                  <code className="mt-2 block break-all rounded-lg border border-border bg-surface-card p-3 text-[11px] leading-relaxed text-text-secondary">{srcset || "—"}</code>
                </div>
              </SectionCard>
            </div>
          ) : null}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default RenditionsFormatsScreen;
