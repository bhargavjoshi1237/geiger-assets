"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  RotateCcw,
  Trash2,
  File,
  Clock,
  ShieldAlert,
  Activity,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  SectionCard,
  StatusPill,
  Field,
  EmptyState,
} from "@/components/internal/shared/screen_kit";
import {
  TYPE_ICONS,
  FILE_TYPE_COLORS,
  STATUS_META,
  formatBytes,
  formatDate,
} from "./constants";
import {
  getArchivedOrTrashed,
  restoreFromArchive,
  trashAsset,
  restoreFromTrash,
  purgeAsset,
} from "@/lib/supabase/archive";

function TypeGlyph({ type, color, className }) {
  const Icon = TYPE_ICONS[type] || File;
  return <Icon className={className} style={{ color: color || "#737373" }} />;
}

function ReadField({ label, value }) {
  return (
    <Field label={label}>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </Field>
  );
}

function TimelineRow({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
          accent || "border-border bg-surface-card text-text-secondary",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-text-secondary">{value || "—"}</p>
      </div>
    </div>
  );
}

export function ArchiveDetailScreen({ id, mode, onBack, onChange }) {
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const isTrash = mode === "trash";

  useEffect(() => {
    let alive = true;
    getArchivedOrTrashed(id).then((a) => {
      if (!alive) return;
      setAsset(a);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const finish = () => {
    onChange?.(id);
    onBack?.();
  };

  const handleRestore = async () => {
    setBusy(true);
    const ok = isTrash ? await restoreFromTrash(id) : await restoreFromArchive(id);
    setBusy(false);
    if (ok) finish();
  };

  const handleTrash = async () => {
    setBusy(true);
    const ok = await trashAsset(id);
    setBusy(false);
    if (ok) finish();
  };

  const handlePurge = async () => {
    setBusy(true);
    const ok = await purgeAsset(id);
    setBusy(false);
    setConfirmPurge(false);
    if (ok) finish();
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

  if (!asset) {
    return (
      <MainScreenWrapper className="dark">
        <EmptyState
          icon={File}
          title="Asset not found"
          description="This asset may have been permanently removed or isn't available."
          action={
            <Button
              variant="outline"
              className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
              onClick={onBack}
            >
              Back to Archive
            </Button>
          }
        />
      </MainScreenWrapper>
    );
  }

  const retentionDate = isTrash ? asset.deletedAt : asset.updatedAt;

  return (
    <MainScreenWrapper className="dark">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to archive"
            className="h-8 w-8 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
            style={{ background: `${asset.color}15`, borderColor: `${asset.color}25` }}
          >
            <TypeGlyph type={asset.type} color={asset.color} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {asset.name || "Untitled asset"}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusPill
                status={isTrash ? "trashed" : asset.status}
                map={{
                  ...STATUS_META,
                  trashed: {
                    label: "In Trash",
                    className: "bg-red-500/15 text-red-300 border-red-500/30",
                    dotClass: "bg-red-400",
                  },
                }}
                className="text-[10px]"
              />
              <span className="text-xs text-text-secondary">
                {asset.format || asset.type} · {formatBytes(asset.sizeBytes)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="h-9 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={handleRestore}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-1.5 h-4 w-4" />
            )}
            Restore
          </Button>
          {isTrash ? (
            <Button
              className="h-9 bg-red-500/90 text-xs text-white hover:bg-red-500"
              onClick={() => setConfirmPurge(true)}
              disabled={busy}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete permanently
            </Button>
          ) : (
            <Button
              variant="outline"
              className="h-9 border-red-500/30 bg-transparent text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={handleTrash}
              disabled={busy}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Move to Trash
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
            <SectionCard title="Preview">
              <div
                className="flex aspect-video items-center justify-center rounded-xl border border-border"
                style={{
                  background: `linear-gradient(135deg, ${asset.color}15 0%, ${asset.color}08 100%)`,
                  borderColor: `${asset.color}20`,
                }}
              >
                <TypeGlyph type={asset.type} color={asset.color} className="h-16 w-16" />
              </div>
            </SectionCard>

            <SectionCard title="Details">
              <div className="grid gap-4">
                <ReadField label="Name" value={asset.name} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Type">
                    <Badge
                      className={cn(
                        "border px-1.5 py-0 text-[10px]",
                        FILE_TYPE_COLORS[asset.type],
                      )}
                    >
                      {asset.format || asset.type}
                    </Badge>
                  </Field>
                  <ReadField label="Format" value={asset.format} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ReadField label="Size" value={formatBytes(asset.sizeBytes)} />
                  <ReadField label="Folder" value={asset.folder} />
                </div>
                <Field label="Tags">
                  {asset.tags.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {asset.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="border-border bg-surface-subtle text-[11px] text-muted-foreground"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-tertiary">No tags</p>
                  )}
                </Field>
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="retention">
          <SectionCard
            title={isTrash ? "Trash retention" : "Archive retention"}
            description={
              isTrash
                ? "Items in Trash can be restored or permanently deleted."
                : "Archived items are retired from the active library but kept intact."
            }
          >
            <div className="space-y-5">
              <TimelineRow
                icon={isTrash ? Trash2 : ShieldAlert}
                label={isTrash ? "Moved to Trash" : "Archived"}
                value={formatDate(retentionDate)}
                accent={
                  isTrash
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                }
              />
              <div className="rounded-lg border border-border bg-surface-card p-4">
                <p className="text-sm font-medium text-foreground">
                  {isTrash ? "Auto-delete policy" : "Retention policy"}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {isTrash
                    ? "Trashed assets are retained until you permanently delete them. Restoring returns the asset to its previous state."
                    : "Archived assets remain stored indefinitely and never count against active library limits. Restore one to return it to a draft state."}
                </p>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="activity">
          <SectionCard title="Activity" description="A timeline of this asset's lifecycle.">
            <div className="space-y-5">
              <TimelineRow
                icon={Activity}
                label="Created"
                value={formatDate(asset.createdAt)}
              />
              <TimelineRow
                icon={Clock}
                label="Last updated"
                value={formatDate(asset.updatedAt)}
              />
              {asset.deletedAt ? (
                <TimelineRow
                  icon={Trash2}
                  label="Moved to Trash"
                  value={formatDate(asset.deletedAt)}
                  accent="border-red-500/30 bg-red-500/10 text-red-400"
                />
              ) : null}
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={confirmPurge} onOpenChange={setConfirmPurge}>
        <DialogContent className="max-w-md border-border bg-surface-subtle text-foreground">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Delete permanently?</DialogTitle>
            <DialogDescription className="text-sm text-text-secondary">
              This will permanently remove{" "}
              <span className="font-medium text-foreground">{asset.name}</span>. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
              onClick={() => setConfirmPurge(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-xs text-white hover:bg-red-500"
              onClick={handlePurge}
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default ArchiveDetailScreen;
