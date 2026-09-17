"use client";

import { Button, LogoLoading } from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, PencilRuler, Trash2 } from "lucide-react";

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
  createMediaAnnotation,
  createMediaJob,
  listMediaAnnotations,
  listMediaJobs,
  softDeleteMediaAnnotation,
} from "@/lib/supabase/media_screens";
import {
  IMAGE_OPERATION_OPTIONS,
  MEDIA_ASSET_STATUS_FILTER_OPTIONS,
  MEDIA_ASSET_STATUS_MAP,
  MEDIA_JOB_STATUS_MAP,
  formatBytes,
  formatDate,
} from "./constants";

// Image edits queue a media_job row; the server fulfils it through
// lib/media/variants.js (buildDerivatives / resolveVariant) and records the
// derivative in metadata.derivatives. This screen never imports that module
// directly — it is server-only — it only writes the job the worker reads.

export function ImageEditingScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [operation, setOperation] = useState("crop");
  const [width, setWidth] = useState("1024");
  const [height, setHeight] = useState("1024");
  const [rotation, setRotation] = useState("0");
  const [brightness, setBrightness] = useState("100");
  const [watermark, setWatermark] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listAssets(projectId), listMediaJobs(projectId), listMediaAnnotations(projectId)]).then(
      ([rows, jobRows, noteRows]) => {
        if (!alive) return;
        setAssets(rows ?? []);
        setJobs(jobRows ?? []);
        setNotes(noteRows ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const images = useMemo(() => assets.filter((a) => a.type === "image"), [assets]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return images.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (needle && !`${a.name} ${a.format} ${(a.tags || []).join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [images, search, statusFilter]);

  const selected = useMemo(
    () => filtered.find((a) => a.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  const selectedJobs = useMemo(
    () => jobs.filter((j) => j.assetId === selected?.id && j.jobType === "image_edit").slice(0, 8),
    [jobs, selected],
  );

  const selectedNotes = useMemo(
    () => notes.filter((n) => n.assetId === selected?.id && (n.kind === "annotation" || n.kind === "watermark")),
    [notes, selected],
  );

  const stats = useMemo(() => {
    const edits = jobs.filter((j) => j.jobType === "image_edit");
    return [
      { label: "Editable", value: String(images.length), footer: "image sources" },
      { label: "Edits queued", value: String(edits.filter((j) => j.status === "queued").length), footer: "awaiting worker" },
      { label: "Edits ready", value: String(edits.filter((j) => j.status === "ready").length), footer: "derivatives written" },
      { label: "Annotations", value: String(notes.filter((n) => n.kind === "annotation" || n.kind === "watermark").length), footer: "notes + marks" },
    ];
  }, [images, jobs, notes]);

  const filtersActive = search.trim() !== "" || statusFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const handleQueueEdit = async () => {
    if (!selected || saving) return;
    setSaving(true);
    const id = crypto.randomUUID();
    const params = { operation, width: Number(width) || null, height: Number(height) || null, rotation: Number(rotation) || 0, brightness: Number(brightness) || 100, watermark: watermark.trim() || null };
    const optimistic = { id, projectId, assetId: selected.id, jobType: "image_edit", operation, status: "queued", progress: 0, error: "", outputAssetId: null, metadata: { params }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setJobs((prev) => [optimistic, ...prev]);
    const created = await createMediaJob({ id, projectId, assetId: selected.id, jobType: "image_edit", operation, status: "queued", progress: 0, metadata: { params } });
    setSaving(false);
    if (created) {
      setJobs((prev) => prev.map((j) => (j.id === id ? created : j)));
      toast.success("Edit queued — the derivative worker picks it up.");
    } else {
      setJobs((prev) => prev.filter((j) => j.id !== id));
      toast.error("Couldn't queue the edit.");
    }
  };

  const handleAddNote = async (kind) => {
    if (!selected || !noteBody.trim()) {
      toast.error("Write the note first.");
      return;
    }
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, assetId: selected.id, kind, label: noteBody.trim().slice(0, 80), body: noteBody.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setNotes((prev) => [optimistic, ...prev]);
    setNoteBody("");
    const created = await createMediaAnnotation({ id, projectId, assetId: selected.id, kind, label: optimistic.label, body: optimistic.body });
    if (created) {
      setNotes((prev) => prev.map((n) => (n.id === id ? created : n)));
      toast.success(kind === "watermark" ? "Watermark note saved." : "Annotation saved.");
    } else {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      toast.error("Couldn't save the note.");
    }
  };

  const handleRemoveNote = async (note) => {
    const prev = notes;
    setNotes((rows) => rows.filter((n) => n.id !== note.id));
    const ok = await softDeleteMediaAnnotation(note.id);
    if (!ok) {
      setNotes(prev);
      toast.error("Couldn't remove the note.");
    } else {
      toast.success("Note removed.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Image",
      render: (a) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">{a.name}</span>
          <span className="truncate text-xs text-text-secondary">{a.format || "Image"} · {a.dimensions || "no dimensions"} · {formatBytes(a.sizeBytes)}</span>
        </div>
      ),
    },
    {
      key: "edits",
      header: "Edits",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => String(jobs.filter((j) => j.assetId === a.id && j.jobType === "image_edit").length),
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
        title="Image Editing"
        description="Crop, resize, rotate, colour, annotations, watermarks, and smart crop — queued as derivative jobs, never applied destructively."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleQueueEdit} disabled={!selected || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilRuler className="h-4 w-4" />} {saving ? "Queuing…" : "Queue edit"}
          </Button>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={operation} onValueChange={setOperation} options={IMAGE_OPERATION_OPTIONS} height="h-9" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={MEDIA_ASSET_STATUS_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search images…" />
      </Toolbar>
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading image editor" />
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
                {images.length === 0 ? (
                  <EmptyState icon={PencilRuler} title="No images to edit" description="Upload a still to queue crops, resizes, and colour passes." />
                ) : (
                  <EmptyState icon={PencilRuler} title="No images match these filters" description="Try a different operation, status, or search term." action={<Button variant="outline" className="border-border bg-surface-card text-foreground hover:bg-surface-active" onClick={clearFilters}>Clear filters</Button>} />
                )}
              </div>
            }
          />
          {selected ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Edit controls" description="Values queue with the job — the worker reads params, not pixels.">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Width (px)"><input value={width} onChange={(e) => setWidth(e.target.value)} inputMode="numeric" className="h-9 rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground outline-none" /></Field>
                  <Field label="Height (px)"><input value={height} onChange={(e) => setHeight(e.target.value)} inputMode="numeric" className="h-9 rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground outline-none" /></Field>
                  <Field label="Rotate (deg)"><input value={rotation} onChange={(e) => setRotation(e.target.value)} inputMode="numeric" className="h-9 rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground outline-none" /></Field>
                  <Field label="Brightness (%)"><input value={brightness} onChange={(e) => setBrightness(e.target.value)} inputMode="numeric" className="h-9 rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground outline-none" /></Field>
                </div>
                <Field label="Watermark text" hint="Stored on the job params for the worker to burn in."><input value={watermark} onChange={(e) => setWatermark(e.target.value)} placeholder="© Studio — do not distribute" className="h-9 rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground outline-none placeholder:text-text-tertiary" /></Field>
                <div className="mt-4"><AssetPreview asset={selected} /></div>
              </SectionCard>
              <SectionCard title="Queued edits & notes" description="Jobs persist via media_jobs; notes via media_annotations.">
                <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">Jobs ({selectedJobs.length})</p>
                <div className="mt-2 space-y-2">
                  {selectedJobs.length === 0 ? (
                    <p className="text-xs text-text-tertiary">No edits queued for this image yet.</p>
                  ) : (
                    selectedJobs.map((job) => (
                      <div key={job.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs">
                        <span className="min-w-0 flex-1 truncate capitalize text-foreground">{job.operation}</span>
                        <StatusPill status={job.status} map={MEDIA_JOB_STATUS_MAP} />
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Annotation or watermark note…" className="h-9 flex-1 rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground outline-none placeholder:text-text-tertiary" />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-9 border-border bg-surface-card text-xs text-foreground hover:bg-surface-active" onClick={() => handleAddNote("annotation")}>Annotate</Button>
                      <Button size="sm" variant="outline" className="h-9 border-border bg-surface-card text-xs text-foreground hover:bg-surface-active" onClick={() => handleAddNote("watermark")}>Watermark</Button>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {selectedNotes.map((note) => (
                      <li key={note.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-foreground">{note.body || note.label} <span className="text-text-tertiary">· {note.kind}</span></span>
                        <Button variant="ghost" size="icon-sm" aria-label="Remove note" className="h-6 w-6 text-text-tertiary hover:bg-red-500/10 hover:text-red-400" onClick={() => handleRemoveNote(note)}>
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

export default ImageEditingScreen;
