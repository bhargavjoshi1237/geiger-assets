"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Film, Captions, Scissors, MessageSquare, Search, Loader2, Play, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
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
import { TRANSCRIPT_META, transcriptStatusOf, mockTranscript, mockDurationSeconds, formatDuration } from "../shared";

const TRANSCRIPT_FILTER = [
  { value: "all", label: "All transcripts" },
  { value: "ready", label: "Transcribed" },
  { value: "processing", label: "Transcribing" },
  { value: "draft", label: "Draft" },
  { value: "none", label: "No transcript" },
];

function VideoThumb({ asset }) {
  return (
    <div className="relative flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-black/50">
      {asset.thumbnailUrl ? (
        <img src={asset.thumbnailUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <Film className="h-4 w-4 text-text-secondary" />
      )}
      <span className="absolute bottom-0.5 right-1 rounded bg-black/70 px-1 text-[9px] tabular-nums text-white">
        {formatDuration(mockDurationSeconds(asset))}
      </span>
    </div>
  );
}

function TranscriptPanel({ asset }) {
  const [q, setQ] = useState("");
  const segments = useMemo(() => mockTranscript(asset), [asset]);
  const filtered = q ? segments.filter((s) => `${s.speaker} ${s.text}`.toLowerCase().includes(q.toLowerCase())) : segments;
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transcript…" className="pl-8 border-border bg-surface-card" />
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {filtered.map((s, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface-card px-3 py-2.5">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-mono tabular-nums text-primary">{formatDuration(s.t)}</span>
              <span className="font-medium text-text-secondary">{s.speaker}</span>
            </div>
            <p className="mt-1 text-sm leading-5 text-foreground">{s.text}</p>
          </div>
        ))}
        {filtered.length === 0 ? <p className="py-6 text-center text-xs text-text-tertiary">No transcript lines match.</p> : null}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => { navigator.clipboard?.writeText(segments.map((s) => `[${formatDuration(s.t)}] ${s.speaker}: ${s.text}`).join("\n")); toast.success("Transcript copied."); }}>
          <Copy className="h-3.5 w-3.5" /> Copy .srt text
        </Button>
        <Button variant="outline" size="sm" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => toast.success("Caption file queued for download.")}>
          <Captions className="h-3.5 w-3.5" /> Export VTT
        </Button>
      </div>
    </div>
  );
}

function FrameComments({ asset }) {
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState([
    { id: "c1", frame: "00:42", author: "Review", text: "Lower-third overlaps the logo here — shift up 40px." },
    { id: "c2", frame: "01:18", author: "Edit", text: "Cut 2s of silence before the demo starts." },
  ]);
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {items.map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-surface-card px-3 py-2.5">
            <div className="flex items-center gap-2 text-[11px]">
              <Badge className="border border-primary/30 bg-primary/10 px-1.5 py-0 font-mono text-primary">{c.frame}</Badge>
              <span className="font-medium text-text-secondary">{c.author}</span>
            </div>
            <p className="mt-1 text-sm text-foreground">{c.text}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Comment at current frame, e.g. 01:24 — trim the pause…" className="min-h-10 border-border bg-surface-card text-sm" />
        <Button className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => { if (!draft.trim()) return; setItems((p) => [...p, { id: crypto.randomUUID(), frame: "00:00", author: "You", text: draft.trim() }]); setDraft(""); toast.success("Frame comment added."); }}>
          Post
        </Button>
      </div>
    </div>
  );
}

function VideoDetail({ asset, onBack }) {
  const [tab, setTab] = useState("transcript");
  const tStatus = transcriptStatusOf(asset);
  const duration = mockDurationSeconds(asset);
  const storyboard = [0.05, 0.22, 0.4, 0.58, 0.76, 0.93];
  const fileUrl = asset.storageKey ? assetFileUrl(asset.id, {}) : "";
  return (
    <MainScreenWrapper>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to videos" className="h-8 w-8 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <VideoThumb asset={asset} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{asset.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusPill status={tStatus} map={TRANSCRIPT_META} className="text-[10px]" />
              <span className="text-xs text-text-secondary">{formatDuration(duration)} · {(asset.format || "MP4").toUpperCase()} · {formatBytes(asset.sizeBytes)}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => toast.success("Poster frame captured from current frame.")}>
            <Film className="h-4 w-4" /> Set poster
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => toast.success("Clip job queued in Video Processing.")}>
            <Scissors className="h-4 w-4" /> New clip
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          <SectionCard title="Preview" description="Streaming master with storyboard and poster control.">
            <div className="overflow-hidden rounded-xl border border-border bg-black">
              {fileUrl ? (
                <video src={fileUrl} controls preload="metadata" className="max-h-[380px] w-full bg-black" />
              ) : (
                <div className="flex h-56 flex-col items-center justify-center gap-2 text-text-tertiary">
                  <Play className="h-8 w-8" />
                  <p className="text-xs">No playable file yet — upload a master to stream.</p>
                </div>
              )}
            </div>
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">Storyboard</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {storyboard.map((f, i) => (
                  <button key={i} type="button" onClick={() => toast.success(`Jumped to ${formatDuration(duration * f)}.`)} className="group overflow-hidden rounded-lg border border-border bg-surface-card text-left">
                    <div className="flex aspect-video items-center justify-center bg-black/50">
                      {asset.thumbnailUrl ? <img src={asset.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-80 group-hover:opacity-100" /> : <Film className="h-4 w-4 text-text-tertiary" />}
                    </div>
                    <p className="px-1.5 py-1 font-mono text-[10px] tabular-nums text-text-secondary">{formatDuration(duration * f)}</p>
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Delivery facts" description="Master specs used by processing presets.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Duration", value: formatDuration(duration) },
                { label: "Resolution", value: asset.dimensions || "1920×1080" },
                { label: "Size", value: formatBytes(asset.sizeBytes) },
                { label: "Captions", value: tStatus === "ready" ? "EN · VTT" : "Missing" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-surface-card px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-text-tertiary">{s.label}</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{s.value}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
        <div className="space-y-4">
          <SectionCard
            title={tab === "transcript" ? "Transcript" : "Frame comments"}
            description={tab === "transcript" ? "Speech-to-text with caption export." : "Time-coded review thread."}
          >
            <div className="mb-3 inline-flex items-center gap-1 rounded-lg border border-border bg-surface-subtle p-1">
              {[{ v: "transcript", label: "Transcript" }, { v: "comments", label: "Comments" }].map((t) => (
                <button key={t.v} type="button" onClick={() => setTab(t.v)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === t.v ? "bg-surface-card text-foreground" : "text-text-secondary hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === "transcript" ? <TranscriptPanel asset={asset} /> : <FrameComments asset={asset} />}
          </SectionCard>
          <SectionCard title="Captions & subtitles" description="Accessibility and localization.">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-3 py-2.5">
                <span className="flex items-center gap-2 text-foreground"><Captions className="h-4 w-4 text-text-secondary" /> English · auto</span>
                <StatusPill status={tStatus} map={TRANSCRIPT_META} className="text-[10px]" />
              </div>
              <Button variant="outline" className="w-full border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => toast.success("Caption upload started.")}>
                Upload caption file
              </Button>
              <Button variant="ghost" className="w-full text-text-secondary hover:text-foreground" onClick={() => toast.success("Transcription re-queued.")}>
                Re-run speech-to-text
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </MainScreenWrapper>
  );
}

export function VideoTranscriptsScreen({ projectId }) {
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
      setAssets((rows ?? []).filter((a) => a.type === "video"));
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
    const processing = assets.filter((a) => transcriptStatusOf(a) === "processing").length;
    return [
      { label: "Videos", value: String(assets.length), footer: "masters & clips" },
      { label: "Footage", value: formatDuration(totalSecs), footer: "total runtime" },
      { label: "Transcribed", value: String(transcribed), footer: "searchable dialogue" },
      { label: "Transcribing", value: String(processing), footer: "in queue" },
    ];
  }, [assets]);

  const openAsset = openId ? assets.find((a) => a.id === openId) ?? null : null;
  if (openAsset) return <VideoDetail asset={openAsset} onBack={() => setOpenId(null)} />;

  const columns = [
    {
      key: "name",
      header: "Video",
      render: (a) => (
        <div className="flex items-center gap-3">
          <VideoThumb asset={a} />
          <div className="min-w-0">
            <p className="max-w-[260px] truncate text-sm font-medium text-foreground">{a.name}</p>
            <p className="text-xs text-text-secondary">{a.dimensions || "HD"} · {formatBytes(a.sizeBytes)}</p>
          </div>
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
      <ScreenHeader
        title="Video & Transcripts"
        description="Masters, clips, storyboards, speech-to-text, captions, and frame-accurate review."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => toast.success("Transcription queued for videos missing transcripts.")}>
            <MessageSquare className="h-4 w-4" /> Transcribe all
          </Button>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={tFilter} onValueChange={setTFilter} options={TRANSCRIPT_FILTER} height="h-9" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search titles, tags, transcript text…" />
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
                <EmptyState icon={Film} title={assets.length ? "No videos match" : "No videos yet"} description={assets.length ? "Try clearing search or filters." : "Upload video masters from the Asset Library."} />
              </div>
            }
          />
          <ListPagination {...pager} itemLabel="videos" />
        </div>
      )}
      {loading ? null : <p className="flex items-center gap-1.5 text-xs text-text-tertiary"><Loader2 className="hidden h-3 w-3" />Search covers transcript text as well as titles.</p>}
    </MainScreenWrapper>
  );
}

export default VideoTranscriptsScreen;


