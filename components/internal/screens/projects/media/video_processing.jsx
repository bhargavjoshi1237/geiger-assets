"use client";

import { Button, LogoLoading } from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clapperboard, Loader2, Trash2 } from "lucide-react";

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
import {
  createMediaJob,
  listMediaJobs,
  softDeleteMediaJob,
  updateMediaJob,
} from "@/lib/supabase/media_screens";
import {
  MEDIA_ASSET_STATUS_FILTER_OPTIONS,
  MEDIA_ASSET_STATUS_MAP,
  MEDIA_JOB_STATUS_FILTER_OPTIONS,
  MEDIA_JOB_STATUS_MAP,
  VIDEO_OPERATION_OPTIONS,
  VIDEO_PRESET_OPTIONS,
  formatBytes,
  formatDate,
  formatTimestamp,
} from "./constants";

export function VideoProcessingScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [jobFilter, setJobFilter] = useState("all");
  const [operation, setOperation] = useState("transcode");
  const [preset, setPreset] = useState("720p");
  const [trimStart, setTrimStart] = useState("0");
  const [trimEnd, setTrimEnd] = useState("");
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

  const videos = useMemo(() => assets.filter((a) => a.type === "video"), [assets]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return videos.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (jobFilter !== "all") {
        const states = jobs.filter((j) => j.assetId === a.id && j.jobType === "video_process").map((j) => j.status);
        if (!states.includes(jobFilter)) return false;
      }
      if (needle && !`${a.name} ${a.format} ${(a.tags || []).join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [videos, search, statusFilter, jobFilter, jobs]);

  const selected = useMemo(
    () => filtered.find((a) => a.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  const selectedJobs = useMemo(
    () => jobs.filter((j) => j.assetId === selected?.id && j.jobType === "video_process").slice(0, 12),
    [jobs, selected],
  );

  const stats = useMemo(() => {
    const processJobs = jobs.filter((j) => j.jobType === "video_process");
    return [
      { label: "Videos", value: String(videos.length), footer: "sources in scope" },
      { label: "Queued", value: String(processJobs.filter((j) => j.status === "queued").length), footer: "waiting to run" },
      { label: "Processing", value: String(processJobs.filter((j) => j.status === "processing").length), footer: "running now" },
      { label: "Ready", value: String(processJobs.filter((j) => j.status === "ready").length), footer: "outputs available" },
    ];
  }, [videos, jobs]);

  const filtersActive = search.trim() !== "" || statusFilter !== "all" || jobFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setJobFilter("all");
  };

  const handleQueue = async () => {
    if (!selected || queuing) return;
    const start = Number(trimStart) || 0;
    const end = trimEnd.trim() === "" ? null : Number(trimEnd);
    if (start < 0 || (end !== null && (!Number.isFinite(end) || end <= start))) {
      toast.error("Trim range is invalid — end must be after start.");
      return;
    }
    setQueuing(true);
    const id = crypto.randomUUID();
    const params = { operation, preset, trimStart: start, trimEnd: end };
    const optimistic = { id, projectId, assetId: selected.id, jobType: "video_process", operation, status: "queued", progress: 0, error: "", outputAssetId: null, metadata: { params }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setJobs((prev) => [optimistic, ...prev]);
    const created = await createMediaJob({ id, projectId, assetId: selected.id, jobType: "video_process", operation, status: "queued", progress: 0, metadata: { params } });
    setQueuing(false);
    if (created) {
      setJobs((prev) => prev.map((j) => (j.id === id ? created : j)));
      toast.success(`${operation} queued for ${selected.name}.`);
    } else {
      setJobs((prev) => prev.filter((j) => j.id !== id));
      toast.error("Couldn't queue the job.");
    }
  };

  const handleCancel = async (job) => {
    const prev = jobs;
    setJobs((rows) => rows.filter((j) => j.id !== job.id));
    const ok = await softDeleteMediaJob(job.id);
    if (!ok) {
      setJobs(prev);
      toast.error("Couldn't cancel the job.");
    } else {
      toast.success("Job cancelled.");
    }
  };

  const handleRetry = async (job) => {
    const prev = jobs;
    setJobs((rows) => rows.map((j) => (j.id === job.id ? { ...j, status: "queued", error: "" } : j)));
    const saved = await updateMediaJob(job.id, { status: "queued", error: "" });
    if (!saved) {
      setJobs(prev);
      toast.error("Couldn't retry the job.");
    } else {
      setJobs((rows) => rows.map((j) => (j.id === job.id ? saved : j)));
      toast.success("Job re-queued.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Video",
      render: (a) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">{a.name}</span>
          <span className="truncate text-xs text-text-secondary">{a.format || "Video"} · {formatBytes(a.sizeBytes)} · {jobs.filter((j) => j.assetId === a.id && j.jobType === "video_process").length} jobs</span>
        </div>
      ),
    },
    {
      key: "latest",
      header: "Latest job",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => {
        const latest = jobs.find((j) => j.assetId === a.id && j.jobType === "video_process");
        if (!latest) return <span className="text-xs text-text-tertiary">No jobs</span>;
        return <StatusPill status={latest.status} map={MEDIA_JOB_STATUS_MAP} />;
      },
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
        title="Video Processing"
        description="Trimming, clips, transcoding, poster frames, adaptive streaming, and conversion — every output is a queued job with honest status."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleQueue} disabled={!selected || queuing}>
            {queuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />} {queuing ? "Queuing…" : "Queue job"}
          </Button>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={operation} onValueChange={setOperation} options={VIDEO_OPERATION_OPTIONS} height="h-9" />
          <FilterDropdown value={jobFilter} onValueChange={setJobFilter} options={MEDIA_JOB_STATUS_FILTER_OPTIONS} height="h-9" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={MEDIA_ASSET_STATUS_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search videos…" />
      </Toolbar>
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading video processing" />
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
                  <EmptyState icon={Clapperboard} title="No videos to process" description="Upload a video to queue trims, transcodes, and posters." />
                ) : (
                  <EmptyState icon={Clapperboard} title="No videos match these filters" description="Try a different job state, status, or search term." action={<Button variant="outline" className="border-border bg-surface-card text-foreground hover:bg-surface-active" onClick={clearFilters}>Clear filters</Button>} />
                )}
              </div>
            }
          />
          {selected ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Job controls" description="Trim range plus preset — queued, never rendered inline.">
                <AssetPreview asset={selected} />
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <Field label="Trim start (s)"><input value={trimStart} onChange={(e) => setTrimStart(e.target.value)} inputMode="decimal" className="h-9 rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground outline-none" /></Field>
                  <Field label="Trim end (s)"><input value={trimEnd} onChange={(e) => setTrimEnd(e.target.value)} inputMode="decimal" placeholder="End of file" className="h-9 rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground outline-none placeholder:text-text-tertiary" /></Field>
                  <Field label="Preset">
                    <FilterDropdown value={preset} onValueChange={setPreset} options={VIDEO_PRESET_OPTIONS} height="h-9" />
                  </Field>
                </div>
                <p className="mt-3 text-[11px] text-text-tertiary">Poster jobs read the trim start as the frame timestamp ({formatTimestamp(Number(trimStart) || 0)}).</p>
              </SectionCard>
              <SectionCard title={`Processing queue (${selectedJobs.length})`} description="Newest first. Failed jobs can be re-queued.">
                {selectedJobs.length === 0 ? (
                  <p className="text-xs text-text-tertiary">No processing jobs for this video — queue a trim, transcode, or poster above.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedJobs.map((job) => (
                      <li key={job.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs">
                        <span className="min-w-0 flex-1 truncate capitalize text-foreground">{job.operation} · {job.metadata?.params?.preset || "default"}</span>
                        <StatusPill status={job.status} map={MEDIA_JOB_STATUS_MAP} />
                        {job.status === "failed" ? (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-text-secondary hover:text-foreground" onClick={() => handleRetry(job)}>Retry</Button>
                        ) : null}
                        <Button variant="ghost" size="icon-sm" aria-label="Cancel job" className="h-6 w-6 text-text-tertiary hover:bg-red-500/10 hover:text-red-400" onClick={() => handleCancel(job)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          ) : null}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default VideoProcessingScreen;
