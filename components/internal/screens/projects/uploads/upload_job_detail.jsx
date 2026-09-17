"use client";

import {
  Button,
  Input,
  LogoLoading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Save,
  RotateCcw,
  File,
  Package,
  Clock,
  CheckCircle2,
} from "lucide-react";

import { EditorShell } from "@/components/internal/shared/editor_shell";
import {
  SectionCard,
  Field,
  EmptyState,
} from "@/components/internal/shared/screen_kit";
import {
  STATUS_META,
  SOURCE_LABELS,
  TYPE_OPTIONS,
  STATUS_OPTIONS,
  SOURCE_OPTIONS,
  formatBytes,
  formatDate,
} from "./constants";
import { getUploadJob, updateUploadJob } from "@/lib/supabase/uploads";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

function ProgressBar({ progress }) {
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-card">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-xs text-text-secondary">{pct}%</span>
    </div>
  );
}

function TimelineEntry({ icon: Icon, title, timestamp, last }) {
  return (
    <div className="relative flex gap-3 pb-5 last:pb-0">
      {!last ? (
        <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-border" />
      ) : null}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-text-secondary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 pt-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-text-tertiary">{formatDate(timestamp)}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor sections
// ---------------------------------------------------------------------------

const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "overview",
        label: "Overview",
        icon: File,
        desc: "Filename, type, source, status, and progress.",
      },
    ],
  },
  {
    group: "Manage",
    items: [
      {
        key: "output",
        label: "Output",
        icon: Package,
        desc: "The asset produced by this upload.",
      },
      {
        key: "activity",
        label: "Activity",
        icon: Clock,
        desc: "When this upload was created and last updated.",
      },
    ],
  },
];

function OverviewSection({ draft, set }) {
  return (
    <SectionCard title="Details">
      <div className="grid gap-4">
        <Field label="Filename" htmlFor="job-filename">
          <Input
            id="job-filename"
            value={draft.filename}
            onChange={(e) => set("filename")(e.target.value)}
            className="border-border bg-surface-card text-foreground"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="File Type">
            <Select value={draft.fileType} onValueChange={set("fileType")}>
              <SelectTrigger className="border-border bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-surface-subtle text-foreground">
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Source">
            <Select value={draft.source} onValueChange={set("source")}>
              <SelectTrigger className="border-border bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-surface-subtle text-foreground">
                {SOURCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={draft.status} onValueChange={set("status")}>
              <SelectTrigger className="border-border bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-surface-subtle text-foreground">
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Size">
            <div className="flex h-9 items-center rounded-md border border-border bg-surface-card px-3 text-sm text-muted-foreground">
              {formatBytes(draft.sizeBytes)}
            </div>
          </Field>
        </div>
        <Field label="Progress">
          <div className="rounded-md border border-border bg-surface-card px-3 py-3">
            <ProgressBar progress={draft.progress} />
          </div>
        </Field>
        {draft.error ? (
          <Field label="Error">
            <p className="rounded-md border border-red-500/30 bg-red-500/15 px-3 py-2 text-xs text-red-300">
              {draft.error}
            </p>
          </Field>
        ) : null}
      </div>
    </SectionCard>
  );
}

function OutputSection({ draft }) {
  return (
    <SectionCard title="Output">
      {draft.assetId ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Asset created</p>
            <p className="truncate font-mono text-[11px] text-text-secondary">
              {draft.assetId}
            </p>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title="No asset produced yet"
          description="Once this upload completes processing, the resulting asset will appear here."
          className="py-10"
        />
      )}
    </SectionCard>
  );
}

function ActivitySection({ draft }) {
  return (
    <SectionCard title="Activity">
      <div className="px-1">
        <TimelineEntry
          icon={Clock}
          title="Upload job created"
          timestamp={draft.createdAt}
        />
        <TimelineEntry
          icon={CheckCircle2}
          title="Last updated"
          timestamp={draft.updatedAt}
          last
        />
      </div>
    </SectionCard>
  );
}

const SECTIONS = {
  overview: OverviewSection,
  output: OutputSection,
  activity: ActivitySection,
};

export function UploadJobDetailScreen({ id, onBack, onChange }) {
  const { section: active, setSection: setActive } = useWorkspaceUrl();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getUploadJob(id).then((j) => {
      if (!alive) return;
      setJob(j);
      setDraft(j);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const dirty = useMemo(() => {
    if (!job || !draft) return false;
    return (
      job.filename !== draft.filename ||
      job.fileType !== draft.fileType ||
      job.source !== draft.source ||
      job.status !== draft.status
    );
  }, [job, draft]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    const patch = {
      filename: draft.filename,
      fileType: draft.fileType,
      source: draft.source,
      status: draft.status,
    };
    const updated = await updateUploadJob(id, patch);
    setSaving(false);
    if (updated) {
      setJob(updated);
      setDraft(updated);
      onChange?.(updated);
    } else {
      setDraft(job);
    }
  };

  const handleRetry = async () => {
    if (!job) return;
    const prev = job;
    const next = { ...job, status: "queued", progress: 0, error: "" };
    setJob(next);
    setDraft(next);
    const updated = await updateUploadJob(id, { status: "queued", progress: 0, error: "" });
    if (updated) {
      setJob(updated);
      setDraft(updated);
      onChange?.(updated);
    } else {
      setJob(prev);
      setDraft(prev);
    }
  };

  if (loading) {
    return (
      <EditorShell
        back={{ label: "Upload Center", onClick: onBack }}
        title="Loading upload…"
        nav={NAV_GROUPS}
        subject={null}
        active={active}
        onActiveChange={setActive}
      >
        <div className="flex h-64 items-center justify-center text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      </EditorShell>
    );
  }

  if (!job || !draft) {
    return (
      <EditorShell
        back={{ label: "Upload Center", onClick: onBack }}
        title="Upload not found"
        nav={NAV_GROUPS}
        subject={null}
        active={active}
        onActiveChange={setActive}
      >
        <EmptyState
          icon={File}
          title="Upload not found"
          description="This upload job may have been deleted or isn't available."
          action={
            <Button
              variant="outline"
              className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
              onClick={onBack}
            >
              Back to Upload Center
            </Button>
          }
        />
      </EditorShell>
    );
  }

  return (
    <EditorShell
      searchable
      back={{ label: "Upload Center", onClick: onBack }}
      title={draft.filename || "Untitled upload"}
      status={draft.status}
      statusMap={STATUS_META}
      meta={`${SOURCE_LABELS[draft.source] || draft.source} · ${formatBytes(draft.sizeBytes)}`}
      actions={
        <>
          <Button
            variant="outline"
            className="h-9 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={handleRetry}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Retry
          </Button>
          <Button
            className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            {dirty ? "Save changes" : "Saved"}
          </Button>
        </>
      }
      nav={NAV_GROUPS}
      subject={draft}
      active={active}
      onActiveChange={setActive}
    >
      {({ active: key }) => {
        const ActiveSection = SECTIONS[key] || SECTIONS.overview;
        return (
          <ActiveSection
            draft={draft}
            set={set}
            headerItem={NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === key)}
          />
        );
      }}
    </EditorShell>
  );
}

export default UploadJobDetailScreen;
