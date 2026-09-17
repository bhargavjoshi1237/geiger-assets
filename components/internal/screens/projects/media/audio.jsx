"use client";

import { Button, LogoLoading } from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AudioLines, Scissors, Trash2 } from "lucide-react";

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
  listMediaTranscripts,
  softDeleteMediaAnnotation,
} from "@/lib/supabase/media_screens";
import {
  MEDIA_ASSET_STATUS_FILTER_OPTIONS,
  MEDIA_ASSET_STATUS_MAP,
  formatBytes,
  formatDate,
  formatTimestamp,
} from "./constants";

function waveformBars(assetId, count = 48) {
  let seed = 0;
  for (const ch of String(assetId || "wave")) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
  return Array.from({ length: count }, (_, i) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const v = (seed % 70) + 12 + Math.round(14 * Math.abs(Math.sin(i / 4)));
    return Math.min(96, v);
  });
}

export function AudioScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listAssets(projectId), listMediaTranscripts(projectId), listMediaAnnotations(projectId)]).then(
      ([rows, subs, notes]) => {
        if (!alive) return;
        setAssets(rows ?? []);
        setTranscripts(subs ?? []);
        setMarks(notes ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const tracks = useMemo(() => assets.filter((a) => a.type === "audio"), [assets]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tracks.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (needle && !`${a.name} ${a.format} ${(a.tags || []).join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [tracks, search, statusFilter]);

  const selected = useMemo(
    () => filtered.find((a) => a.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  const selectedTranscript = useMemo(
    () => transcripts.find((t) => t.assetId === selected?.id && t.kind === "transcript") || null,
    [transcripts, selected],
  );

  const transcriptHits = useMemo(() => {
    if (!selectedTranscript) return [];
    const q = transcriptQuery.trim().toLowerCase();
    if (!q) return [selectedTranscript.text];
    return selectedTranscript.text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.toLowerCase().includes(q));
  }, [selectedTranscript, transcriptQuery]);

  const clips = useMemo(
    () => marks.filter((m) => m.assetId === selected?.id && m.kind === "clip").sort((a, b) => (a.timestampSeconds ?? 0) - (b.timestampSeconds ?? 0)),
    [marks, selected],
  );

  const bars = useMemo(() => (selected ? waveformBars(selected.id) : []), [selected]);

  const stats = useMemo(() => {
    const bytes = tracks.reduce((sum, a) => sum + (a.sizeBytes || 0), 0);
    const transcribed = new Set(transcripts.filter((t) => t.kind === "transcript").map((t) => t.assetId)).size;
    return [
      { label: "Tracks", value: String(tracks.length), footer: "audio in scope" },
      { label: "Transcribed", value: String(transcribed), footer: "with transcript rows" },
      { label: "Clip marks", value: String(marks.filter((m) => m.kind === "clip").length), footer: "in / out ranges" },
      { label: "Storage", value: formatBytes(bytes), footer: "across audio" },
    ];
  }, [tracks, transcripts, marks]);

  const filtersActive = search.trim() !== "" || statusFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const handleAddClip = async () => {
    if (!selected) return;
    const start = Number(clipStart);
    const end = clipEnd.trim() === "" ? null : Number(clipEnd);
    if (!Number.isFinite(start) || start < 0) {
      toast.error("Clip start must be seconds from 0.");
      return;
    }
    if (end !== null && (!Number.isFinite(end) || end <= start)) {
      toast.error("Clip end must be after the start.");
      return;
    }
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, assetId: selected.id, kind: "clip", label: end === null ? `From ${start}s` : `${start}s – ${end}s`, body: "", positionX: null, positionY: null, timestampSeconds: start, metadata: { endSeconds: end }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setMarks((prev) => [optimistic, ...prev]);
    setClipStart("");
    setClipEnd("");
    const created = await createMediaAnnotation({ id, projectId, assetId: selected.id, kind: "clip", label: optimistic.label, timestampSeconds: start, metadata: { endSeconds: end } });
    if (created) {
      setMarks((prev) => prev.map((m) => (m.id === id ? created : m)));
      toast.success("Clip mark saved.");
    } else {
      setMarks((prev) => prev.filter((m) => m.id !== id));
      toast.error("Couldn't save the clip mark.");
    }
  };

  const handleRemoveClip = async (clip) => {
    const prev = marks;
    setMarks((rows) => rows.filter((m) => m.id !== clip.id));
    const ok = await softDeleteMediaAnnotation(clip.id);
    if (!ok) {
      setMarks(prev);
      toast.error("Couldn't remove the clip mark.");
    } else {
      toast.success("Clip mark removed.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Track",
      render: (a) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">{a.name}</span>
          <span className="truncate text-xs text-text-secondary">{a.format || "Audio"} · {formatBytes(a.sizeBytes)}</span>
        </div>
      ),
    },
    {
      key: "transcript",
      header: "Transcript",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => (transcripts.some((t) => t.assetId === a.id && t.kind === "transcript") ? "Available" : "Missing"),
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
      <ScreenHeader title="Audio" description="Playback, waveform preview, clip ranges, and searchable transcripts for every track." />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={MEDIA_ASSET_STATUS_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tracks, formats, tags…" />
      </Toolbar>
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading audio" />
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
                {tracks.length === 0 ? (
                  <EmptyState icon={AudioLines} title="No audio yet" description="Upload a track to get playback, waveforms, and transcripts." />
                ) : (
                  <EmptyState icon={AudioLines} title="No tracks match these filters" description="Try a different status or search term." action={<Button variant="outline" className="border-border bg-surface-card text-foreground hover:bg-surface-active" onClick={clearFilters}>Clear filters</Button>} />
                )}
              </div>
            }
          />
          {selected ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Playback" description={`${selected.format || "Audio"} · ${selected.mimeType || "unknown codec"}`}>
                <AssetPreview asset={selected} />
                <div className="mt-4" aria-label="Waveform preview">
                  <div className="flex h-16 items-end gap-0.5 rounded-lg border border-border bg-surface-card p-3">
                    {bars.map((h, i) => (
                      <span key={i} className="flex-1 rounded-sm bg-primary/60" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-text-tertiary">Stylised preview only — bar heights are deterministic placeholders, not decoded peaks.</p>
                </div>
              </SectionCard>
              <SectionCard title="Transcript & clipping" description="Search the transcript, then mark the keep-range.">
                <SearchInput value={transcriptQuery} onChange={setTranscriptQuery} placeholder="Search transcript…" />
                <div className="mt-3 max-h-44 overflow-auto rounded-lg border border-border bg-surface-card p-3 text-xs text-text-secondary">
                  {!selectedTranscript ? (
                    <p className="text-text-tertiary">No transcript row for this track yet — ingest writes one when speech is detected.</p>
                  ) : transcriptHits.length === 0 ? (
                    <p className="text-text-tertiary">No transcript lines match this search.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {transcriptHits.slice(0, 30).map((line, i) => (
                        <li key={i} className="leading-relaxed">{line || "—"}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">Clip marks ({clips.length})</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input value={clipStart} onChange={(e) => setClipStart(e.target.value)} placeholder="Start (s)" inputMode="decimal" className="h-9 w-full rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground outline-none placeholder:text-text-tertiary sm:w-24" />
                    <input value={clipEnd} onChange={(e) => setClipEnd(e.target.value)} placeholder="End (s, optional)" inputMode="decimal" className="h-9 w-full rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground outline-none placeholder:text-text-tertiary sm:w-32" />
                    <Button size="sm" className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={handleAddClip}>
                      <Scissors className="h-3.5 w-3.5" /> Mark clip
                    </Button>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {clips.map((clip) => (
                      <li key={clip.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-foreground">{clip.label || `From ${formatTimestamp(clip.timestampSeconds)}`}</span>
                        <Button variant="ghost" size="icon-sm" aria-label="Remove clip mark" className="h-6 w-6 text-text-tertiary hover:bg-red-500/10 hover:text-red-400" onClick={() => handleRemoveClip(clip)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </SectionCard>
            </div>
          ) : null}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default AudioScreen;
