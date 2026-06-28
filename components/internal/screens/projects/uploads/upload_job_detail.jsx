"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Save,
  RotateCcw,
  File,
  Package,
  Clock,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  SectionCard,
  StatusPill,
  Field,
  EmptyState,
} from "@/components/internal/shared/screen_kit";
import {
  TYPE_ICONS,
  STATUS_META,
  SOURCE_LABELS,
  TYPE_OPTIONS,
  STATUS_OPTIONS,
  SOURCE_OPTIONS,
  formatBytes,
  formatDate,
} from "./constants";
import { getUploadJob, updateUploadJob } from "@/lib/supabase/uploads";

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

export function UploadJobDetailScreen({ id, onBack, onChange }) {
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
      <MainScreenWrapper className="dark">
        <div className="flex h-64 items-center justify-center text-text-tertiary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </MainScreenWrapper>
    );
  }

  if (!job || !draft) {
    return (
      <MainScreenWrapper className="dark">
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
      </MainScreenWrapper>
    );
  }

  const TypeIcon = TYPE_ICONS[draft.fileType] || File;

  return (
    <MainScreenWrapper className="dark">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to upload center"
            className="h-8 w-8 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
            <TypeIcon className="h-5 w-5 text-text-secondary" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {draft.filename || "Untitled upload"}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusPill status={draft.status} map={STATUS_META} className="text-[10px]" />
              <span className="text-xs text-text-secondary">
                {SOURCE_LABELS[draft.source] || draft.source} · {formatBytes(draft.sizeBytes)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
        </div>
      </div>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList>
          <TabsTrigger value="overview" className="text-xs">
            Overview
          </TabsTrigger>
          <TabsTrigger value="output" className="text-xs">
            Output
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs">
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
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
        </TabsContent>

        <TabsContent value="output">
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
        </TabsContent>

        <TabsContent value="activity">
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
        </TabsContent>
      </Tabs>
    </MainScreenWrapper>
  );
}

export default UploadJobDetailScreen;
