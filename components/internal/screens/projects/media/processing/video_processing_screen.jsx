"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Clapperboard, Scissors, ImagePlus, Loader2, Play, Plus, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Progress } from "@geiger/ui/progress";
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
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { formatBytes } from "@/components/internal/screens/projects/library/constants";
import { listAssets } from "@/lib/supabase/assets";
import { VIDEO_OUTPUT_PRESETS, mockDurationSeconds, formatDuration } from "../shared";

const JOB_STATUS_META = {
  queued: { label: "Queued", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30" },
  processing: { label: "Processing", className: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  ready: { label: "Ready", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  failed: { label: "Failed", className: "bg-red-500/15 text-red-300 border-red-500/30" },
};

const STATUS_FILTER = [
  { value: "all", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
];

function RangeTrim({ duration, start, end, onChange }) {
  const toPct = (s) => Math.max(0, Math.min(100, (s / Math.max(1, duration)) * 100));
  return (
    <div className="rounded-xl border border-border bg-surface-card p-3">
      <div className="relative h-2 rounded-full bg-surface-subtle">
        <div className="absolute h-full rounded-full bg-primary/70" style={{ left: `${toPct(start)}%`, width: `${Math.max(2, toPct(end) - toPct(start))}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field label="Start (sec)"><Input value={String(start)} onChange={(e) => onChange({ start: Number(e.target.value) || 0, end })} inputMode="numeric" className="border-border bg-surface-subtle font-mono" /></Field>
        <Field label="End (sec)"><Input value={String(end)} onChange={(e) => onChange({ start, end: Number(e.target.value) || 0 })} inputMode="numeric" className="border-border bg-surface-subtle font-mono" /></Field>
      </div>
      <p className="mt-2 font-mono text-[11px] tabular-nums text-text-secondary">Clip {formatDuration(end - start)} · {formatDuration(start)} → {formatDuration(end)} of {formatDuration(duration)}</p>
    </div>
  );
}

export function VideoProcessingScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceId, setSourceId] = useState(null);
  const [trim, setTrim] = useState({ start: 5, end: 35 });
  const [preset, setPreset] = useState("h264-1080p");
  const [posterAt, setPosterAt] = useState(4);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [jobs, setJobs] = useState([]);
  const [queueing, setQueueing] = useState(false);

  useEffect(() => {
    let alive = true;
    listAssets(projectId).then((rows) => {
      if (!alive) return;
      const vids = (rows ?? []).filter((a) => a.type === "video");
      setAssets(vids);
      if (vids.length && !sourceId) {
        setSourceId(vids[0].id);
        const d = mockDurationSeconds(vids[0]);
        setTrim({ start: Math.min(5, Math.floor(d / 4)), end: Math.min(Math.floor(d * 0.6), 120) || 30 });
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [projectId]);

  const source = sourceId ? assets.find((a) => a.id === sourceId) ?? null : null;
  const sourceDuration = source ? mockDurationSeconds(source) : 60;

  const filteredJobs = useMemo(() => {
    let rows = [...jobs];
    if (statusFilter !== "all") rows = rows.filter((j) => j.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((j) => `${j.sourceName} ${j.presetLabel}`.toLowerCase().includes(q));
    }
    return rows;
  }, [jobs, search, statusFilter]);

  const pager = usePagination(filteredJobs, { resetKey: `${search}|${statusFilter}` });

  const stats = useMemo(() => {
    const ready = jobs.filter((j) => j.status === "ready").length;
    const processing = jobs.filter((j) => j.status === "processing").length;
    return [
      { label: "Source videos", value: String(assets.length), footer: "masters" },
      { label: "Jobs", value: String(jobs.length), footer: "this session" },
      { label: "Processing", value: String(processing), footer: "transcoding" },
      { label: "Ready", value: String(ready), footer: "to publish" },
    ];
  }, [assets, jobs]);

  const handleQueue = () => {
    if (!source) { toast.error("Pick a source video first."); return; }
    if (trim.end <= trim.start) { toast.error("End must be after start."); return; }
    const presetMeta = VIDEO_OUTPUT_PRESETS.find((p) => p.id === preset);
    setQueueing(true);
    const id = crypto.randomUUID();
    const job = {
      id,
      sourceId: source.id,
      sourceName: source.name,
      op: `Trim ${formatDuration(trim.start)}–${formatDuration(trim.end)}`,
      preset: presetMeta.id,
      presetLabel: presetMeta.label,
      progress: 4,
      status: "processing",
      createdAt: new Date().toISOString(),
    };
    setJobs((p) => [job, ...p]);
    const timer = setInterval(() => {
      setJobs((prev) =>
        prev.map((j) => {
          if (j.id !== id) return j;
          const next = Math.min(100, j.progress + 17);
          if (next >= 100) {
            clearInterval(timer);
            setQueueing(false);
            toast.success(`"${j.sourceName}" ${j.presetLabel} ready.`);
            return { ...j, progress: 100, status: "ready" };
          }
          return { ...j, progress: next };
        })
      );
    }, 450);
  };

  const columns = [
    {
      key: "source",
      header: "Job",
      render: (j) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/15">
            <Clapperboard className="h-4 w-4 text-violet-300" />
          </div>
          <div className="min-w-0">
            <p className="max-w-[240px] truncate text-sm font-medium text-foreground">{j.sourceName}</p>
            <p className="text-[11px] text-text-tertiary">{j.op} · {j.presetLabel}</p>
          </div>
        </div>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (j) => (
        <div className="flex items-center gap-2">
          <Progress value={j.progress} className="h-1.5 w-24 bg-surface-card" />
          <span className="w-8 tabular-nums text-xs text-text-secondary">{j.progress}%</span>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (j) => <StatusPill status={j.status} map={JOB_STATUS_META} className="text-[10px]" /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (j) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {j.status === "failed" ? (
            <Button variant="ghost" size="icon-sm" aria-label="Retry job" className="h-7 w-7 text-text-secondary hover:text-foreground" onClick={() => { setJobs((p) => p.map((x) => (x.id === j.id ? { ...x, status: "queued", progress: 2 } : x))); toast.success("Job re-queued."); }}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button variant="ghost" size="icon-sm" aria-label="Remove job" className="h-7 w-7 text-text-secondary hover:text-red-400" onClick={() => setJobs((p) => p.filter((x) => x.id !== j.id))}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Video Processing" description="Trim clips, transcode presets, capture posters, and prepare adaptive streams." actions={<Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleQueue} disabled={queueing || !source}>{queueing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Queue job</Button>} />
      <StatsBar stats={stats} />
      {loading ? (
        <LoadingArea panel size={56} />
      ) : assets.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={Clapperboard} title="No videos to process" description="Upload video masters from the Asset Library first." /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <SectionCard title="Source video" description="Pick the master to cut.">
            <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {assets.map((a) => (
                <button key={a.id} type="button" onClick={() => { setSourceId(a.id); const d = mockDurationSeconds(a); setTrim({ start: Math.min(5, Math.floor(d / 4)), end: Math.min(Math.floor(d * 0.6), 120) || 30 }); }} className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${sourceId === a.id ? "border-primary/40 bg-primary/5" : "border-border bg-surface-card hover:bg-surface-hover"}`}>
                  <Play className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-foreground">{a.name}</span>
                    <span className="block font-mono text-[10px] tabular-nums text-text-tertiary">{formatDuration(mockDurationSeconds(a))} · {formatBytes(a.sizeBytes)}</span>
                  </span>
                </button>
              ))}
            </div>
          </SectionCard>
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Trim & clip" description={source ? `${source.name} · ${formatDuration(sourceDuration)}` : "No source"}>
              <RangeTrim duration={sourceDuration} start={trim.start} end={trim.end} onChange={setTrim} />
              <div className="mt-3">
                <Field label="Output preset">
                  <SegmentedTabs fullWidth tabs={VIDEO_OUTPUT_PRESETS.slice(0, 4).map((p) => ({ value: p.id, label: p.label.split("·")[1]?.trim() || p.label }))} value={VIDEO_OUTPUT_PRESETS.slice(0, 4).some((p) => p.id === preset) ? preset : "h264-1080p"} onChange={setPreset} />
                </Field>
                <div className="mt-2 grid gap-1.5">
                  {VIDEO_OUTPUT_PRESETS.map((p) => (
                    <button key={p.id} type="button" onClick={() => setPreset(p.id)} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${preset === p.id ? "border-primary/40 bg-primary/5 text-foreground" : "border-border bg-surface-card text-text-secondary hover:text-foreground"}`}>
                      <Scissors className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium">{p.label}</span>
                      <span className="ml-auto text-text-tertiary">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </SectionCard>
            <SectionCard title="Poster & streaming" description="Thumbnail and adaptive setup.">
              <Field label={`Poster frame · ${formatDuration(posterAt)}`} hint="Drag or type the timestamp.">
                <input type="range" min={0} max={Math.max(1, Math.floor(sourceDuration))} value={Math.min(posterAt, Math.floor(sourceDuration))} onChange={(e) => setPosterAt(Number(e.target.value))} className="w-full accent-primary" aria-label="Poster frame" />
              </Field>
              <div className="mt-3 overflow-hidden rounded-xl border border-border bg-black/50">
                <div className="flex aspect-video items-center justify-center">
                  {source?.thumbnailUrl ? <img src={source.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-80" /> : <ImagePlus className="h-6 w-6 text-text-tertiary" />}
                </div>
                <p className="border-t border-border px-3 py-2 font-mono text-[11px] tabular-nums text-text-secondary">poster.{preset.includes("webm") ? "webm" : "jpg"} @ {formatDuration(posterAt)}</p>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                {[
                  ["Adaptive streaming", "HLS 1080/720/480 — on"],
                  ["Format conversion", preset],
                  ["Captions burn-in", "Off · sidecar VTT kept"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-3 py-2">
                    <span className="text-text-secondary">{k}</span>
                    <Badge className="border border-border bg-surface-subtle px-1.5 py-0 text-[10px] text-foreground">{v}</Badge>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-3 w-full border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => toast.success(`Poster captured at ${formatDuration(posterAt)}.` )}>
                <ImagePlus className="h-4 w-4" /> Capture poster
              </Button>
            </SectionCard>
          </div>
        </div>
      )}
      <div className="space-y-4">
        <Toolbar>
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTER} height="h-9" />
          <SearchInput value={search} onChange={setSearch} placeholder="Search jobs…" />
        </Toolbar>
        <DataTable columns={columns} data={pager.pageItems} getRowKey={(j) => j.id} empty={<div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={Scissors} title="No processing jobs" description="Trim a source and queue your first transcode." /></div>} />
        {pager.pageItems.length > 0 ? <ListPagination {...pager} itemLabel="jobs" /> : null}
      </div>
    </MainScreenWrapper>
  );
}

export default VideoProcessingScreen;

