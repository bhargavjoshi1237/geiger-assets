"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Folder as FolderIcon,
  FolderTree,
  HardDrive,
  Database,
  Cloud,
  SquarePen,
} from "lucide-react";

import { Input } from "@geiger/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { cn } from "@/lib/utils";
import {
  EditorLoading,
  EditorNotFound,
  EditorShell,
} from "@/components/internal/shared/editor_shell";
import { EditorSaveActions, useEditorGuard } from "@/components/internal/shared/unsaved_changes";
import {
  EmptyState,
  Field,
  SectionCard,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import {
  STORAGE_META,
  STORAGE_OPTIONS,
  FOLDER_COLORS,
  formatBytes,
  formatDate,
} from "./constants";
import { getFolder, listFolders, updateFolder } from "@/lib/supabase/folders";

const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "contents",
        label: "Contents",
        icon: FolderTree,
        desc: "Subfolders nested inside this folder.",
      },
    ],
  },
  {
    group: "Manage",
    items: [
      {
        key: "settings",
        label: "Folder settings",
        icon: SquarePen,
        desc: "Rename, move, re-tier, and recolor this folder.",
      },
      {
        key: "storage",
        label: "Storage",
        icon: HardDrive,
        desc: "Usage and storage tier for this folder.",
      },
    ],
  },
];

const STORAGE_ICONS = {
  hot: HardDrive,
  cold: Database,
  "cloud-s3": Cloud,
  "cloud-gcs": Cloud,
};

function collectInvalidParents(id, allFolders) {
  const invalid = new Set([id]);
  let added = true;
  while (added) {
    added = false;
    for (const f of allFolders) {
      if (f.parentId && invalid.has(f.parentId) && !invalid.has(f.id)) {
        invalid.add(f.id);
        added = true;
      }
    }
  }
  return invalid;
}

export function FolderDetailScreen({ id, onBack, onChange, projectId }) {
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState(null);
  const [draft, setDraft] = useState(null);
  const [allFolders, setAllFolders] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getFolder(id), listFolders(projectId)]).then(([f, all]) => {
      if (!alive) return;
      setFolder(f);
      setDraft(f);
      setAllFolders(all ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id, projectId]);

  const dirty = useMemo(() => {
    if (!folder || !draft) return false;
    return (
      folder.name !== draft.name ||
      (folder.parentId ?? null) !== (draft.parentId ?? null) ||
      folder.storageLocation !== draft.storageLocation ||
      folder.color !== draft.color
    );
  }, [folder, draft]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const children = useMemo(
    () => allFolders.filter((f) => f.parentId === id),
    [allFolders, id],
  );

  const parentOptions = useMemo(() => {
    const invalid = collectInvalidParents(id, allFolders);
    return allFolders.filter((f) => !invalid.has(f.id));
  }, [allFolders, id]);

  const save = useCallback(async () => {
    if (!dirty || saving || !draft) return false;
    if (!draft.name?.trim()) {
      toast.error("Give the folder a name before saving.");
      return false;
    }
    setSaving(true);
    const updated = await updateFolder(id, {
      name: draft.name,
      parentId: draft.parentId ?? null,
      storageLocation: draft.storageLocation,
      color: draft.color,
    });
    setSaving(false);
    if (updated) {
      setFolder(updated);
      setDraft(updated);
      onChange?.(updated);
      toast.success("Changes saved.");
      return true;
    }
    toast.error("Couldn't save your changes to the server.");
    return false;
  }, [dirty, draft, id, onChange, saving]);

  const guard = useEditorGuard({
    dirty,
    saving,
    save,
    discard: () => setDraft(folder),
    onBack,
    name: draft?.name || "this folder",
  });
  const back = { label: "Folders", onClick: guard.back };

  if (loading) {
    return <EditorLoading back={back} title="Loading folder…" nav={NAV_GROUPS} />;
  }

  if (!folder || !draft) {
    return (
      <EditorNotFound
        back={back}
        nav={NAV_GROUPS}
        icon={FolderIcon}
        title="Folder not found"
        description="This folder may have been deleted or isn't available."
      />
    );
  }

  const StorageIcon = STORAGE_ICONS[draft.storageLocation] || HardDrive;

  return (
    <>
      <EditorShell
        back={back}
        title={draft.name || "Untitled folder"}
        status={draft.storageLocation}
        statusMap={STORAGE_META}
        meta={[draft.path || "/", formatBytes(draft.sizeBytes)].join(" · ")}
        actions={
          <EditorSaveActions
            dirty={dirty}
            saving={saving}
            onSave={save}
            onDiscard={() => setDraft(folder)}
          />
        }
        nav={NAV_GROUPS}
        subject={draft}
        active={guard.active}
        onActiveChange={guard.selectSection}
      >
        {({ active }) => (
          <>
            {active === "contents" ? (
              <>
                <SectionCard
                  title="Subfolders"
                  description={`${children.length} folder${children.length === 1 ? "" : "s"} nested here.`}
                  bodyPadding={false}
                >
                  {children.length === 0 ? (
                    <EmptyState
                      icon={FolderIcon}
                      title="No subfolders"
                      description="This folder has no nested folders yet."
                      className="py-10"
                    />
                  ) : (
                    <div className="divide-y divide-border">
                      {children.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                            style={{ background: `${c.color}15`, borderColor: `${c.color}25` }}
                          >
                            <FolderIcon className="h-4 w-4" style={{ color: c.color || "var(--color-text-secondary)" }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                            <p className="text-[11px] text-text-tertiary">{formatBytes(c.sizeBytes)}</p>
                          </div>
                          <StatusPill status={c.storageLocation} map={STORAGE_META} className="text-[10px]" />
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
                <p className="mt-3 text-xs text-text-secondary">
                  Assets in this folder are managed in the Asset Library.
                </p>
              </>
            ) : null}

            {active === "settings" ? (
              <>
                <SectionCard title="Folder Settings" description="Rename, move, and re-tier this folder.">
                  <div className="grid gap-4">
                    <Field label="Name" htmlFor="folder-name">
                      <Input
                        id="folder-name"
                        value={draft.name}
                        onChange={(e) => set("name")(e.target.value)}
                        className="border-border bg-surface-card text-foreground"
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Parent">
                        <Select
                          value={draft.parentId ?? "root"}
                          onValueChange={(v) => set("parentId")(v === "root" ? null : v)}
                        >
                          <SelectTrigger className="border-border bg-surface-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-surface-subtle text-foreground">
                            <SelectItem value="root" className="text-xs">
                              Root
                            </SelectItem>
                            {parentOptions.map((f) => (
                              <SelectItem key={f.id} value={f.id} className="text-xs">
                                {f.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Storage Location">
                        <Select value={draft.storageLocation} onValueChange={set("storageLocation")}>
                          <SelectTrigger className="border-border bg-surface-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-surface-subtle text-foreground">
                            {STORAGE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Field label="Color">
                      <div className="flex flex-wrap gap-2">
                        {FOLDER_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            aria-label={`Use color ${c}`}
                            onClick={() => set("color")(c)}
                            className={cn(
                              "h-7 w-7 rounded-md border transition-transform hover:scale-105",
                              draft.color === c
                                ? "border-border-strong ring-2 ring-border"
                                : "border-border",
                            )}
                            style={{ background: `${c}25`, borderColor: `${c}40` }}
                          >
                            <span className="mx-auto block h-3 w-3 rounded-full" style={{ background: c }} />
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>
                </SectionCard>
              </>
            ) : null}

            {active === "storage" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SectionCard title="Usage">
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold leading-none text-foreground tabular-nums">
                        {formatBytes(draft.sizeBytes)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-text-tertiary">Total size of source files</p>
                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-card">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.round((draft.sizeBytes / (1024 * 1024 * 1024)) * 100))}%`,
                          background: draft.color || "var(--color-text-secondary)",
                        }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-text-tertiary">Relative to a 1 GB reference</p>
                  </SectionCard>

                  <SectionCard title="Storage Tier">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground"
                      >
                        <StorageIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <StatusPill status={draft.storageLocation} map={STORAGE_META} className="text-[10px]" />
                        <p className="mt-1 text-xs text-text-secondary">
                          Updated {formatDate(draft.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-text-secondary">Subfolders</span>
                        <span className="tabular-nums text-foreground">{children.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-text-secondary">Path</span>
                        <span className="max-w-[180px] truncate text-foreground">{draft.path || "/"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-text-secondary">Created</span>
                        <span className="text-foreground">{formatDate(draft.createdAt)}</span>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </>
            ) : null}
          </>
        )}
      </EditorShell>

      {guard.dialog}
    </>
  );
}

export default FolderDetailScreen;
