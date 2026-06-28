"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Save,
  Folder as FolderIcon,
  FolderOpen,
  HardDrive,
  Database,
  Cloud,
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
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  SectionCard,
  StatusPill,
  Field,
  EmptyState,
} from "@/components/internal/shared/screen_kit";
import {
  STORAGE_META,
  STORAGE_OPTIONS,
  FOLDER_COLORS,
  formatBytes,
  formatDate,
} from "./constants";
import { getFolder, listFolders, updateFolder } from "@/lib/supabase/folders";

const STORAGE_ICONS = {
  hot: HardDrive,
  cold: Database,
  "cloud-s3": Cloud,
  "cloud-gcs": Cloud,
};

// Collect a folder's own id plus every descendant so the parent Select never
// offers a choice that would create a cycle.
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
  }, [id]);

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

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    const patch = {
      name: draft.name,
      parentId: draft.parentId ?? null,
      storageLocation: draft.storageLocation,
      color: draft.color,
    };
    const updated = await updateFolder(id, patch);
    setSaving(false);
    if (updated) {
      setFolder(updated);
      setDraft(updated);
      onChange?.(updated);
    } else {
      setDraft(folder);
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

  if (!folder || !draft) {
    return (
      <MainScreenWrapper className="dark">
        <EmptyState
          icon={FolderIcon}
          title="Folder not found"
          description="This folder may have been deleted or isn't available."
          action={
            <Button
              variant="outline"
              className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
              onClick={onBack}
            >
              Back to Folders
            </Button>
          }
        />
      </MainScreenWrapper>
    );
  }

  const StorageIcon = STORAGE_ICONS[draft.storageLocation] || HardDrive;

  return (
    <MainScreenWrapper className="dark">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to folders"
            className="h-8 w-8 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
            style={{ background: `${draft.color}15`, borderColor: `${draft.color}25` }}
          >
            <FolderOpen className="h-5 w-5" style={{ color: draft.color || "#737373" }} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {draft.name || "Untitled folder"}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusPill status={draft.storageLocation} map={STORAGE_META} className="text-[10px]" />
              <span className="max-w-[280px] truncate text-xs text-text-secondary">
                {draft.path || "/"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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

      <Tabs defaultValue="contents" className="w-full">
        <TabsList>
          <TabsTrigger value="contents">Contents</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
        </TabsList>

        {/* Contents */}
        <TabsContent value="contents" className="mt-4">
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
                      <FolderIcon className="h-4 w-4" style={{ color: c.color || "#737373" }} />
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
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="mt-4">
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
        </TabsContent>

        {/* Storage */}
        <TabsContent value="storage" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SectionCard title="Usage">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold leading-none text-white tabular-nums">
                  {formatBytes(draft.sizeBytes)}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-text-tertiary">Total size of source files</p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-card">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((draft.sizeBytes / (1024 * 1024 * 1024)) * 100))}%`,
                    background: draft.color || "#737373",
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
        </TabsContent>
      </Tabs>
    </MainScreenWrapper>
  );
}

export default FolderDetailScreen;
