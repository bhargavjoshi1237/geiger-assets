"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LogoLoading,
  cn,
} from "@geiger/ui";
import React, { useEffect, useState } from "react";
import {
  Loader2,
  RotateCcw,
  Trash2,
  File,
  Clock,
  ShieldAlert,
  Activity,
} from "lucide-react";

import { EditorShell } from "@/components/internal/shared/editor_shell";
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
import { AssetPreview } from "@/components/internal/shared/asset_preview";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "overview",
        label: "Overview",
        icon: File,
        desc: "Preview and key details for this asset.",
      },
    ],
  },
  {
    group: "Manage",
    items: [
      {
        key: "retention",
        label: "Retention",
        icon: ShieldAlert,
        desc: "Archive and trash retention policy.",
      },
      {
        key: "activity",
        label: "Activity",
        icon: Activity,
        desc: "A timeline of this asset's lifecycle.",
      },
    ],
  },
];

const ARCHIVE_STATUS_MAP = {
  ...STATUS_META,
  trashed: {
    label: "In Trash",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
    dotClass: "bg-red-400",
  },
};

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

export function OverviewSection({ asset }) {
  if (!asset) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
      <SectionCard title="Preview">
        <AssetPreview asset={asset} />
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
  );
}

export function RetentionSection({ asset, isTrash, retentionDate }) {
  if (!asset) return null;
  return (
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
  );
}

export function AssetActivitySection({ asset }) {
  if (!asset) return null;
  return (
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
  );
}

export const SECTIONS = {
  overview: OverviewSection,
  retention: RetentionSection,
  activity: AssetActivitySection,
};

export function ArchiveDetailScreen({ id, mode, onBack, onChange }) {
  const { section: active, setSection: setActive } = useWorkspaceUrl();
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
      <EditorShell
        back={{ label: "Archive", onClick: onBack }}
        title="Loading asset…"
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

  if (!asset) {
    return (
      <EditorShell
        back={{ label: "Archive", onClick: onBack }}
        title="Asset not found"
        nav={NAV_GROUPS}
        subject={null}
        active={active}
        onActiveChange={setActive}
      >
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
      </EditorShell>
    );
  }

  const retentionDate = isTrash ? asset.deletedAt : asset.updatedAt;

  const purgeDialog = (
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
  );

  return (
    <EditorShell
      searchable
      back={{ label: "Archive", onClick: onBack }}
      title={asset.name || "Untitled asset"}
      status={isTrash ? "trashed" : asset.status}
      statusMap={ARCHIVE_STATUS_MAP}
      meta={
        [asset.format || asset.type, formatBytes(asset.sizeBytes), asset.folder]
          .filter(Boolean)
          .join(" · ") || "No details set yet"
      }
      actions={
        <>
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
        </>
      }
      nav={NAV_GROUPS}
      subject={asset}
      active={active}
      onActiveChange={setActive}
      after={purgeDialog}
    >
      {({ active: key }) => {
        const ActiveSection = SECTIONS[key] || SECTIONS.overview;
        return (
          <ActiveSection
            asset={asset}
            isTrash={isTrash}
            retentionDate={retentionDate}
            headerItem={NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === key)}
          />
        );
      }}
    </EditorShell>
  );
}

export default ArchiveDetailScreen;
