"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Music, Scissors, Copy, Play, Pause, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
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
import { STATUS_META, STATUS_FILTER_OPTIONS, formatBytes, formatDate } from "@/components/internal/screens/projects/library/constants";
import { assetFileUrl } from "@/lib/storage/client";
import { listAssets } from "@/lib/supabase/assets";
import { TRANSCRIPT_META, transcriptStatusOf, mockTranscript, mockWaveform, mockDurationSeconds, formatDuration } from "../shared";

const TRANSCRIPT_FILTER = [
  { value: "all", label: "All transcripts" },
  { value: "ready", label: "Transcribed" },
  { value: "processing", label: "Transcribing" },
  { value: "none", label: "No transcript" },
];

function Waveform({ values, progress = 0, onSeek }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek?.((e.clientX - rect.left) / rect.width);
      }}
      className="flex h-20 w-full items-center gap-[3px] rounded-xl border border-border bg-surface-card px-3"
      aria-label="Seek audio"
    >
      {values.map((v, i) => {
        const active = i / values.length <= progress;
        return <span key={i} className={`w-full rounded-full ${active ? "bg-primary" : "bg-border"}`} style={{ height: `${v}%` }} />;
      })}
    </button>
  );
}

function AudioDetail({ asset, onBack }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0.18);
  const [clip, setClip] = useState({ start: "0:15", end: "0:45", name: `${asset.name} (clip)` });
  const [q, setQ] = useState("");
  const bars = useMemo(() => mockWaveform(asset, 56), [asset]);
  const duration = mockDurationSeconds(asset);
  const tStatus = transcriptStatusOf(asset);
  const segments = useMemo(() => mockTranscript(asset), [asset]);
  const shown = q ? segments.filter((s) => `${s.speaker} ${s.text}`.toLowerCase().includes(q.toLowerCase())) : segments;
  const fileUrl = asset.storageKey ? assetFileUrl(asset.id, {}) : "";
  return (
    <MainScreenWrapper>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to audio" className="h-8 w-8 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15">
            <Music className="h-5 w-5 text-amber-300" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{asset.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusPill status={tStatus} map={TRANSCRIPT_META} className="text-[10px]" />
              <span className="text-xs text-text-secondary">{formatDuration(duration)} · {formatBytes(asset.sizeBytes)} · {(asset.format || "MP3").toUpperCase()}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => { if (!asset.storageKey) { toast.error("No audio file yet."); return; } window.open(assetFileUrl(asset.id, { download: true }), "_blank"); }}>
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => toast.success(`Clip "${clip.name}" queued (${clip.start} → ${clip.end}).`)}>
            <Scissors className="h-4 w-4" /> Save clip
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
        <div className="space-y-4">
          <SectionCard title="Playback" description="Waveform preview with seek and clip range.">
            {fileUrl ? <audio ref={audioRef} src={fileUrl} preload="metadata" className="w-full" controls onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : null}
            <Waveform values={bars} progress={progress} onSeek={(f) => setProgress(f)} />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="border-border bg-surface-card" onClick={() => { if (fileUrl && audioRef.current) { if (playing) audioRef.current.pause(); else audioRef.current.play(); } else { setPlaying((p) => !p); setProgress((p) => Math.min(0.98, p + 0.05)); } }}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {playing ? "Pause" : "Play"}
              </Button>
              <span className="font-mono text-xs tabular-nums text-text-secondary">{formatDuration(duration * progress)} / {formatDuration(duration)}</span>
              <Badge className="ml-auto border border-border bg-surface-card px-2 py-0.5 text-[11px] text-text-secondary">{asset.mimeType || "audio"}</Badge>
            </div>
          </SectionCard>
          <SectionCard title="Transcript" description="Speech-to-text with transcript search.">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transcript…" className="border-border bg-surface-card" />
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {shown.map((s, i) => (
                <button key={i} type="button" onClick={() => setProgress(s.t / Math.max(1, duration))} className="block w-full rounded-lg border border-border bg-surface-card px-3 py-2.5 text-left hover:bg-surface-hover">
                  <span className="font-mono text-[11px] tabular-nums text-primary">{formatDuration(s.t)}</span>
                  <span className="ml-2 text-[11px] font-medium text-text-secondary">{s.speaker}</span>
                  <p className="mt-1 text-sm text-foreground">{s.text}</p>
                </button>
              ))}
              {shown.length === 0 ? <p className="py-6 text-center text-xs text-text-tertiary">No lines match.</p> : null}
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => { navigator.clipboard?.writeText(shown.map((s) => `[${formatDuration(s.t)}] ${s.text}`).join("\n")); toast.success("Transcript copied."); }}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
              <Button variant="ghost" size="sm" className="text-text-secondary hover:text-foreground" onClick={() => toast.success("Transcription re-queued.")}>
                Re-run speech-to-text
              </Button>
            </div>
          </SectionCard>
        </div>
        <div className="space-y-4">
          <SectionCard title="Clip editor" description="Trim a highlight without touching the master.">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start"><Input value={clip.start} onChange={(e) => setClip((c) => ({ ...c, start: e.target.value }))} className="border-border bg-surface-card font-mono" /></Field>
                <Field label="End"><Input value={clip.end} onChange={(e) => setClip((c) => ({ ...c, end: e.target.value }))} className="border-border bg-surface-card font-mono" /></Field>
              </div>
              <Field label="Clip name"><Input value={clip.name} onChange={(e) => setClip((c) => ({ ...c, name: e.target.value }))} className="border-border bg-surface-card" /></Field>
              <div className="rounded-lg border border-border bg-surface-card px-3 py-2.5 text-xs text-text-secondary">
                Output: MP3 · 192kbps · keeps source tags. Saved as a rendition on this asset.
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Audio metadata" description="Technical facts for delivery.">
            <div className="space-y-2.5 text-sm">
              {[
                ["Duration", formatDuration(duration)],
                ["Size", formatBytes(asset.sizeBytes)],
                ["Folder", asset.folder || "root"],
                ["Updated", formatDate(asset.updatedAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">{k}</span>
                  <span className="font-medium text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </MainScreenWrapper>
  );
}

export function AudioScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tFilter, setTFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    listAssets(projectId).then((rows) => {
      if (!alive) return;
      setAssets((rows ?? []).filter((a) => a.type === "audio"));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [projectId]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (tFilter !== "all" && transcriptStatusOf(a) !== tFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search) {
        const hay = `${a.name} ${a.format} ${(a.tags || []).join(" ")} ${mockTranscript(a).map((s) => s.text).join(" ")}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [assets, search, tFilter, statusFilter]);

  const pager = usePagination(filtered, { resetKey: `${search}|${tFilter}|${statusFilter}` });

  const stats = useMemo(() => {
    const totalSecs = assets.reduce((s, a) => s + mockDurationSeconds(a), 0);
    const transcribed = assets.filter((a) => transcriptStatusOf(a) === "ready").length;
    return [
      { label: "Tracks", value: String(assets.length), footer: "music & spoken" },
      { label: "Runtime", value: formatDuration(totalSecs), footer: "total audio" },
      { label: "Transcribed", value: String(transcribed), footer: "searchable" },
      { label: "Storage", value: formatBytes(assets.reduce((s, a) => s + (a.sizeBytes || 0), 0)), footer: "across tracks" },
    ];
  }, [assets]);

  const openAsset = openId ? assets.find((a) => a.id === openId) ?? null : null;
  if (openAsset) return <AudioDetail asset={openAsset} onBack={() => setOpenId(null)} />;

  const columns = [
    {
      key: "name",
      header: "Track",
      render: (a) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15">
            <Music className="h-4 w-4 text-amber-300" />
          </div>
          <div className="min-w-0">
            <p className="max-w-[240px] truncate text-sm font-medium text-foreground">{a.name}</p>
            <p className="text-xs text-text-secondary">{(a.format || "audio").toUpperCase()} · {formatBytes(a.sizeBytes)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "wave",
      header: "Waveform",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => (
        <div className="flex h-7 w-36 items-center gap-[2px]">
          {mockWaveform(a, 28).map((v, i) => (
            <span key={i} className="w-full rounded-full bg-border" style={{ height: `${Math.max(12, v * 0.5)}%` }} />
          ))}
        </div>
      ),
    },
    {
      key: "duration",
      header: "Duration",
      className: "tabular-nums text-xs text-muted-foreground",
      render: (a) => formatDuration(mockDurationSeconds(a)),
    },
    {
      key: "transcript",
      header: "Transcript",
      render: (a) => <StatusPill status={transcriptStatusOf(a)} map={TRANSCRIPT_META} className="text-[10px]" />,
    },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusPill status={a.status} map={STATUS_META} />,
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Audio" description="Music, recordings, and spoken media — waveform preview, clipping, and transcript search." actions={<Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => toast.success("Transcription queued for audio missing transcripts.")}><Music className="h-4 w-4" /> Transcribe all</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={tFilter} onValueChange={setTFilter} options={TRANSCRIPT_FILTER} height="h-9" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tracks, tags, transcript…" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel size={56} />
      ) : (
        <div className="space-y-5">
          <DataTable columns={columns} data={pager.pageItems} getRowKey={(a) => a.id} onRowClick={(a) => setOpenId(a.id)} empty={<div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={Music} title={assets.length ? "No tracks match" : "No audio yet"} description={assets.length ? "Try clearing search or filters." : "Upload audio from the Asset Library."} /></div>} />
          <ListPagination {...pager} itemLabel="tracks" />
        </div>
      )}
      {loading ? null : <p className="flex items-center gap-1.5 text-xs text-text-tertiary"><Loader2 className="hidden h-3 w-3" />Click a transcript line in the detail view to seek.</p>}
    </MainScreenWrapper>
  );
}

export default AudioScreen;


