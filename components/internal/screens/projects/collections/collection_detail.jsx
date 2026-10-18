"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  X,
  Layers,
  ImagePlus,
  Link2,
  Copy,
  Check,
  Share2,
  SquarePen,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { Switch } from "@geiger/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import { AssetThumbnail } from "@/components/internal/shared/asset_thumbnail";
import {
  EditorLoading,
  EditorNotFound,
  EditorShell,
} from "@/components/internal/shared/editor_shell";
import { EditorSaveActions, useEditorGuard } from "@/components/internal/shared/unsaved_changes";
import {
  EmptyState,
  Field,
  LoadingArea,
  SearchInput,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import {
  FILE_TYPE_COLORS,
  formatBytes,
} from "@/components/internal/screens/projects/library/constants";
import {
  TYPE_META,
  VISIBILITY_META,
  TYPE_OPTIONS,
  VISIBILITY_OPTIONS,
  STATUS_OPTIONS,
} from "./constants";
import {
  getCollection,
  updateCollection,
  listCollectionAssets,
  addAssetToCollection,
  removeCollectionAsset,
} from "@/lib/supabase/collections";
import { listAssets } from "@/lib/supabase/assets";
import { useCopied } from "@/lib/use-copied";
import { collectionShareUrl } from "@/lib/share";

const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "assets",
        label: "Assets",
        icon: Layers,
        desc: "Members of this collection — removing here doesn't delete the asset.",
      },
    ],
  },
  {
    group: "Manage",
    items: [
      {
        key: "settings",
        label: "Collection details",
        icon: SquarePen,
        desc: "Name, description, type, visibility, status, and favorite.",
      },
      {
        key: "sharing",
        label: "Sharing",
        icon: Share2,
        desc: "Control who can see this collection and share a link.",
      },
    ],
  },
];

function AddAssetsDialog({ open, onOpenChange, existingIds, onAdd, projectId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(null);

  useEffect(() => {
    let alive = true;
    listAssets(projectId).then((rows) => {
      if (!alive) return;
      setAssets(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const available = assets.filter((a) => !existingIds.has(a.id));
    if (!search) return available;
    const q = search.toLowerCase();
    return available.filter(
      (a) => a.name.toLowerCase().includes(q) || a.format.toLowerCase().includes(q),
    );
  }, [assets, existingIds, search]);

  const handleAdd = async (asset) => {
    setPending(asset.id);
    await onAdd(asset);
    setPending(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Add Assets</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Pick assets from the library to add to this collection.
          </DialogDescription>
        </DialogHeader>
        <SearchInput value={search} onChange={setSearch} placeholder="Search library..." />
        <div className="max-h-80 overflow-y-auto rounded-md border border-border bg-surface-card">
          {loading ? (
            <LoadingArea className="h-32 py-0" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ImagePlus}
              title="Nothing to add"
              description={
                search ? "No assets match your search." : "Every asset is already in this collection."
              }
              className="py-10"
            />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => handleAdd(asset)}
                  disabled={pending === asset.id}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover disabled:opacity-50"
                >
                  <AssetThumbnail asset={asset} className="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{asset.name}</p>
                    <p className="text-[11px] text-text-tertiary">
                      {asset.format || asset.type} · {formatBytes(asset.sizeBytes)}
                    </p>
                  </div>
                  {pending === asset.id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-secondary" />
                  ) : (
                    <Plus className="h-4 w-4 shrink-0 text-text-secondary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CollectionDetailScreen({ id, onBack, onChange, projectId }) {
  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState(null);
  const [draft, setDraft] = useState(null);
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [copied, flashCopied] = useCopied();

  useEffect(() => {
    let alive = true;
    Promise.all([getCollection(id), listCollectionAssets(id)]).then(([c, m]) => {
      if (!alive) return;
      setCollection(c);
      setDraft(c);
      setMembers(m ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const dirty = useMemo(() => {
    if (!collection || !draft) return false;
    return (
      collection.name !== draft.name ||
      collection.description !== draft.description ||
      collection.type !== draft.type ||
      collection.visibility !== draft.visibility ||
      collection.status !== draft.status ||
      collection.isFavorite !== draft.isFavorite
    );
  }, [collection, draft]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const save = useCallback(async () => {
    if (!dirty || saving || !draft) return false;
    if (!draft.name?.trim()) {
      toast.error("Give the collection a name before saving.");
      return false;
    }
    setSaving(true);
    const updated = await updateCollection(id, {
      name: draft.name,
      description: draft.description,
      type: draft.type,
      visibility: draft.visibility,
      status: draft.status,
      isFavorite: draft.isFavorite,
    });
    setSaving(false);
    if (updated) {
      const merged = { ...updated, assetCount: members.length };
      setCollection(merged);
      setDraft(merged);
      onChange?.(merged);
      toast.success("Changes saved.");
      return true;
    }
    toast.error("Couldn't save your changes to the server.");
    return false;
  }, [dirty, draft, id, members.length, onChange, saving]);

  const existingIds = useMemo(
    () => new Set(members.map((m) => m.assetId)),
    [members],
  );

  const handleAddAsset = async (asset) => {
    if (existingIds.has(asset.id)) return;
    const rowId = crypto.randomUUID();
    const optimistic = {
      id: rowId,
      collectionId: id,
      assetId: asset.id,
      position: members.length,
      asset: {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        format: asset.format,
        color: asset.color,
        status: asset.status,
        sizeBytes: asset.sizeBytes,
      },
    };
    setMembers((prev) => [...prev, optimistic]);
    onChange?.({ id, assetCount: members.length + 1 });
    const created = await addAssetToCollection(id, asset.id);
    if (created) {
      setMembers((prev) => prev.map((m) => (m.id === rowId ? created : m)));
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== rowId));
      onChange?.({ id, assetCount: members.length });
    }
  };

  const handleRemoveAsset = async (rowId) => {
    const prev = members;
    const next = members.filter((m) => m.id !== rowId);
    setMembers(next);
    onChange?.({ id, assetCount: next.length });
    const ok = await removeCollectionAsset(rowId);
    if (!ok) {
      setMembers(prev);
      onChange?.({ id, assetCount: prev.length });
    }
  };

  const shareLink = collectionShareUrl(id);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      flashCopied();
    } catch (e) {
      console.error("[collections.copyLink]", e);
    }
  };

  const guard = useEditorGuard({
    dirty,
    saving,
    save,
    discard: () => setDraft(collection),
    onBack,
    name: draft?.name || "this collection",
  });
  const back = { label: "Collections", onClick: guard.back };

  if (loading) {
    return <EditorLoading back={back} title="Loading collection…" nav={NAV_GROUPS} />;
  }

  if (!collection || !draft) {
    return (
      <EditorNotFound
        back={back}
        nav={NAV_GROUPS}
        icon={Layers}
        title="Collection not found"
        description="This collection may have been deleted or isn't available."
      />
    );
  }

  return (
    <>
      <EditorShell
        back={back}
        title={draft.name || "Untitled collection"}
        status={draft.visibility}
        statusMap={VISIBILITY_META}
        badges={
          <Badge className={cn("border px-1.5 py-0 text-[10px]", TYPE_META[draft.type]?.className)}>
            {TYPE_META[draft.type]?.label || draft.type}
          </Badge>
        }
        meta={`${members.length} asset${members.length === 1 ? "" : "s"}`}
        actions={
          <EditorSaveActions
            dirty={dirty}
            saving={saving}
            onSave={save}
            onDiscard={() => setDraft(collection)}
          />
        }
        nav={NAV_GROUPS}
        subject={draft}
        active={guard.active}
        onActiveChange={guard.selectSection}
      >
        {({ active }) => (
          <>
            {active === "assets" ? (
              <>
                <SectionCard
                  title="Assets"
                  description="Members of this collection — removing here doesn't delete the asset."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
                      onClick={() => setShowAdd(true)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add assets
                    </Button>
                  }
                  bodyPadding={false}
                >
                  {members.length === 0 ? (
                    <EmptyState
                      icon={ImagePlus}
                      title="No assets yet"
                      description="Add assets from your library to start building this collection."
                      action={
                        <Button
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                          onClick={() => setShowAdd(true)}
                        >
                          <Plus className="h-4 w-4" />
                          Add assets
                        </Button>
                      }
                      className="py-12"
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
                      {members.map((m) => {
                        const asset = m.asset || {};
                        return (
                          <div
                            key={m.id}
                            className="group relative overflow-hidden rounded-xl border border-border bg-surface-card"
                          >
                            <AssetThumbnail
                              asset={asset}
                              large
                              className="aspect-square h-auto w-full rounded-none border-0"
                              iconClassName="h-10 w-10"
                            />
                            <div className="border-t border-border px-3 py-2">
                              <p className="truncate text-xs font-medium text-foreground">
                                {asset.name || "Untitled"}
                              </p>
                              <Badge
                                className={cn(
                                  "mt-1 border px-1.5 py-0 text-[10px]",
                                  FILE_TYPE_COLORS[asset.type],
                                )}
                              >
                                {asset.format || asset.type}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${asset.name || "asset"} from collection`}
                              className="absolute right-1.5 top-1.5 h-7 w-7 bg-surface-subtle/80 text-text-tertiary opacity-0 backdrop-blur transition-opacity hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 group-hover:opacity-100"
                              onClick={() => handleRemoveAsset(m.id)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              </>
            ) : null}

            {active === "settings" ? (
              <>
                <SectionCard title="Details">
                  <div className="grid gap-4">
                    <Field label="Name" htmlFor="settings-name">
                      <Input
                        id="settings-name"
                        value={draft.name}
                        onChange={(e) => set("name")(e.target.value)}
                        className="border-border bg-surface-card text-foreground"
                      />
                    </Field>
                    <Field label="Description" htmlFor="settings-desc">
                      <Textarea
                        id="settings-desc"
                        value={draft.description}
                        onChange={(e) => set("description")(e.target.value)}
                        placeholder="Add a description…"
                        className="min-h-20 border-border bg-surface-card text-foreground"
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Type">
                        <Select value={draft.type} onValueChange={set("type")}>
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
                      <Field label="Visibility">
                        <Select value={draft.visibility} onValueChange={set("visibility")}>
                          <SelectTrigger className="border-border bg-surface-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-surface-subtle text-foreground">
                            {VISIBILITY_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
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
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Favorite</p>
                        <p className="text-xs text-text-secondary">Pin this collection for quick access.</p>
                      </div>
                      <Switch checked={draft.isFavorite} onCheckedChange={set("isFavorite")} />
                    </div>
                  </div>
                </SectionCard>
              </>
            ) : null}

            {active === "sharing" ? (
              <>
                <SectionCard
                  title="Sharing"
                  description="Control who can see this collection and share a link."
                >
                  <div className="grid gap-4">
                    <Field label="Visibility" hint="Save changes to apply the new visibility.">
                      <Select value={draft.visibility} onValueChange={set("visibility")}>
                        <SelectTrigger className="border-border bg-surface-card sm:max-w-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-surface-subtle text-foreground">
                          {VISIBILITY_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value} className="text-xs">
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Share link">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" />
                          <Input
                            readOnly
                            value={shareLink}
                            className="pl-8 border-border bg-surface-card text-foreground"
                          />
                        </div>
                        <Button
                          variant="outline"
                          className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                          onClick={handleCopy}
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </Field>
                  </div>
                </SectionCard>
              </>
            ) : null}
          </>
        )}
      </EditorShell>

      <AddAssetsDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        existingIds={existingIds}
        onAdd={handleAddAsset}
        projectId={projectId}
      />

      {guard.dialog}
    </>
  );
}

export default CollectionDetailScreen;
