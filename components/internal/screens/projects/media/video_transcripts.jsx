"use client";

import { Button, LogoLoading } from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Captions, Clapperboard, MessageSquarePlus, Trash2 } from "lucide-react";

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
  createMediaTranscript,
  listMediaAnnotations,
  listMediaTranscripts,
  softDeleteMediaAnnotation,
} from "@/lib/supabase/media_screens";
import {
  ANNOTATION_KIND_MAP,
  MEDIA_ASSET_STATUS_FILTER_OPTIONS,
  MEDIA_ASSET_STATUS_MAP,
  TRANSCRIPT_KIND_MAP,
  TRANSCRIPT_STATUS_MAP,
  formatBytes,
  formatDate,
  formatTimestamp,
  transcodeStateOf,
} from "./constants";

export function VideoTranscriptsScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [captionFilter, setCaptionFilter] = useState("all");
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentAt, setCommentAt] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listAssets(projectId), listMediaTranscripts(projectId), listMediaAnnotations(projectId)]).then(
      ([rows, subs, notes]) => {
        if (!alive) return;
        setAssets(rows ?? []);
        setTranscripts(subs ?? []);
        setComments(notes ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const videos = useMemo(() => assets.filter((a) => a.type === "video"), [assets]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return videos.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (captionFilter !== "all") {
        const has = transcripts.some((t) => t.assetId === a.id && (captionFilter === "captioned" ? t.kind !== "transcript" : true));
        if (captionFilter === "captioned" && !has) return false;
        if (captionFilter === "uncaptioned" && has) return false;
      }
      if (needle && !`${a.name} ${a.format} ${(a.tags || []).join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [videos, search, statusFilter, captionFilter, transcripts]);

  const selected = useMemo(
    () => filtered.find((a) => a.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  const selectedTranscripts = useMemo(
    () => transcripts.filter((t) => t.assetId === selected?.id),
    [transcripts, selected],
  );

  const visibleTranscripts = useMemo(() => {
    const q = transcriptQuery.trim().toLowerCase();
    if (!q) return selectedTranscripts;
    return selectedTranscripts.filter((t) => `${t.text} ${t.kind} ${t.language}`.toLowerCase().includes(q));
  }, [selectedTranscripts, transcriptQuery]);

  const frameComments = useMemo(
    () => comments.filter((c) => c.assetId === selected?.id && c.kind === "frame_comment").sort((a, b) => (a.timestampSeconds ?? 0) - (b.timestampSeconds ?? 0)),
    [comments, selected],
  );

  const stats = useMemo(() => {
    const captioned = new Set(transcripts.filter((t) => t.kind !== "transcript").map((t) => t.assetId)).size;
    const review = transcripts.filter((t) => t.status === "needs_review").length;
    return [
      { label: "Videos", value: String(videos.length), footer: "in scope" },
      { label: "Captioned", value: String(captioned), footer: "caption or subtitle rows" },
      { label: "Needs review", value: String(review), footer: "transcript rows" },
      { label: "Frame comments", value: String(comments.filter((c) => c.kind === "frame_comment").length), footer: "time-coded notes" },
    ];
  }, [videos, transcripts, comments]);

  const filtersActive = search.trim() !== "" || statusFilter !== "all" || captionFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCaptionFilter("all");
  };

  const handleAddCaption = async () => {
    if (!selected) return;
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, assetId: selected.id, kind: "caption", language: "en", text: "New caption track — edit the text after ingest.", status: "draft", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setTranscripts((prev) => [optimistic, ...prev]);
    const created = await createMediaTranscript({ id, projectId, assetId: selected.id, kind: "caption", language: "en", text: optimistic.text, status: "draft" });
    if (created) {
      setTranscripts((prev) => prev.map((t) => (t.id === id ? created : t)));
      toast.success("Caption track added.");
    } else {
      setTranscripts((prev) => prev.filter((t) => t.id !== id));
      toast.error("Couldn't save the caption track.");
    }
  };

  const handleAddComment = async () => {
    if (!selected || !commentBody.trim()) {
      toast.error("Write a comment first.");
      return;
    }
    const at = commentAt.trim() === "" ? null : Number(commentAt);
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, assetId: selected.id, kind: "frame_comment", label: "", body: commentBody.trim(), positionX: null, positionY: null, timestampSeconds: Number.isFinite(at) ? at : null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setComments((prev) => [optimistic, ...prev]);
    setCommentBody("");
    setCommentAt("");
    const created = await createMediaAnnotation({ id, projectId, assetId: selected.id, kind: "frame_comment", body: optimistic.body, timestampSeconds: optimistic.timestampSeconds });
    if (created) {
      setComments((prev) => prev.map((c) => (c.id === id ? created : c)));
      toast.success("Frame comment added.");
    } else {
      setComments((prev) => prev.filter((c) => c.id !== id));
      toast.error("Couldn't save the comment.");
    }
  };

  const handleRemoveComment = async (comment) => {
    const prev = comments;
    setComments((rows) => rows.filter((c) => c.id !== comment.id));
    const ok = await softDeleteMediaAnnotation(comment.id);
    if (!ok) {
      setComments(prev);
      toast.error("Couldn't remove the comment.");
    } else {
      toast.success("Comment removed.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Video",
      render: (a) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">{a.name}</span>
          <span className="truncate text-xs text-text-secondary">{a.format || "Video"} · {formatBytes(a.sizeBytes)} · {transcodeStateOf(a)}</span>
        </div>
      ),
    },
    {
      key: "captions",
      header: "Tracks",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => String(transcripts.filter((t) => t.assetId === a.id).length),
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
        title="Video & Transcripts"
        description="Streaming previews, storyboard thumbnails, captions, and time-coded frame comments. Transcode state is reported, never simulated — no ffmpeg runs here."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleAddCaption} disabled={!selected}>
            <Captions className="h-4 w-4" /> Add caption track
          </Button>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={MEDIA_ASSET_STATUS_FILTER_OPTIONS} height="h-9" />
          <FilterDropdown value={captionFilter} onValueChange={setCaptionFilter} options={[{ value: "all", label: "All caption states" }, { value: "captioned", label: "Captioned" }, { value: "uncaptioned", label: "Uncaptioned" }]} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search videos, formats, tags…" />
      </Toolbar>
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading videos" />
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
                {videos.length === 0 ? (
                  <EmptyState icon={Clapperboard} title="No videos yet" description="Upload a video to get streaming preview, captions, and frame comments." />
                ) : (
                  <EmptyState icon={Clapperboard} title="No videos match these filters" description="Try a different status or search term." action={<Button variant="outline" className="border-border bg-surface-card text-foreground hover:bg-surface-active" onClick={clearFilters}>Clear filters</Button>} />
                )}
              </div>
            }
          />
          {selected ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Streaming preview" description={`Transcode: ${transcodeStateOf(selected)}`}>
                <AssetPreview asset={selected} />
                <div className="mt-3 rounded-lg border border-border bg-surface-card p-3 text-xs text-text-secondary">
                  Storyboard and thumbnails derive after transcode. Until the pipeline reports ready, this screen shows the source preview only.
                </div>
              </SectionCard>
              <SectionCard title="Captions & frame comments" description="Search tracks, then pin notes to a timestamp.">
                <SearchInput value={transcriptQuery} onChange={setTranscriptQuery} placeholder="Search captions and transcripts…" />
                <div className="mt-3 space-y-2">
                  {visibleTranscripts.length === 0 ? (
                    <p className="text-xs text-text-tertiary">No caption, subtitle, or transcript rows for this video yet.</p>
                  ) : (
                    visibleTranscripts.map((t) => (
                      <div key={t.id} className="rounded-lg border border-border bg-surface-card p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={t.kind} map={TRANSCRIPT_KIND_MAP} />
                          <StatusPill status={t.status} map={TRANSCRIPT_STATUS_MAP} />
                          <span className="text-[11px] uppercase tracking-wider text-text-tertiary">{t.language}</span>
                        </div>
                        <p className="mt-2 line-clamp-3 text-xs text-text-secondary">{t.text || "—"}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">Frame comments ({frameComments.length})</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input value={commentAt} onChange={(e) => setCommentAt(e.target.value)} placeholder="Time (s)" inputMode="decimal" className="h-9 w-24 rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground outline-none placeholder:text-text-tertiary" />
                    <input value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Note at this frame…" className="h-9 flex-1 rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground outline-none placeholder:text-text-tertiary" />
                    <Button size="sm" className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={handleAddComment}>
                      <MessageSquarePlus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {frameComments.map((c) => (
                      <li key={c.id} className="flex items-start gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs">
                        <span className="shrink-0 rounded border border-border bg-surface-subtle px-1.5 py-0.5 tabular-nums text-text-secondary">{formatTimestamp(c.timestampSeconds)}</span>
                        <span className="min-w-0 flex-1 text-foreground">{c.body}</span>
                        <StatusPill status={c.kind} map={ANNOTATION_KIND_MAP} className="hidden sm:inline-flex" />
                        <Button variant="ghost" size="icon-sm" aria-label="Remove comment" className="h-6 w-6 shrink-0 text-text-tertiary hover:bg-red-500/10 hover:text-red-400" onClick={() => handleRemoveComment(c)}>
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

export default VideoTranscriptsScreen;
