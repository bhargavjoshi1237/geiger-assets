"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Layers, Trash2 } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { EmptyState, Field, LoadingArea } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { appOrigin } from "@/lib/share";
import { deliveryHref, filenameFor } from "@/lib/delivery/url";
import { createAsset, getAsset, updateAsset } from "@/lib/supabase/assets";
import { addAssetToCollection, listCollections } from "@/lib/supabase/collections";
import { createShareLink, mintToken } from "@/lib/supabase/shares";
import { getUser } from "@/lib/supabase/user";
import {
  assetFileUrl,
  deleteAssetFile,
  uploadAsset,
  UPLOAD_ERROR_MESSAGES,
} from "@/lib/storage/client";

// Matches the Shared Links screen's create-dialog default.
const SHARE_LINK_DAYS = 30;

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pickFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// Every asset action a list surface offers (Asset Library, All Media). Writes
// are optimistic against the caller's `assets` state and roll back with a
// toast when they fail.
export function useAssetActions({ projectId, assets, setAssets, onDeleted }) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [duplicateTarget, setDuplicateTarget] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [collectionTarget, setCollectionTarget] = useState(null);

  const patchRow = (id, patch) =>
    setAssets((rows) => rows.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const handleDelete = async (asset) => {
    setDeleteTarget(null);
    onDeleted?.(asset);
    const previous = assets;
    setAssets((rows) => rows.filter((a) => a.id !== asset.id));
    const ok = await deleteAssetFile(asset.id);
    if (ok) {
      toast.success(`Deleted "${asset.name}".`);
    } else {
      setAssets(previous);
      toast.error("Couldn't delete the asset on the server.");
    }
  };

  const handleDuplicate = async (asset) => {
    setDuplicateTarget(null);
    const id = crypto.randomUUID();
    const copy = {
      ...asset,
      id,
      name: asset.name.replace(/(\.[^.]+)?$/, " (copy)$1"),
      status: "draft",
      downloads: 0,
    };
    setAssets((prev) => [copy, ...prev]);
    const user = await getUser();
    const created = await createAsset({
      id,
      projectId,
      createdBy: user?.id || null,
      name: copy.name,
      type: copy.type,
      format: copy.format,
      sizeBytes: copy.sizeBytes,
      dimensions: copy.dimensions,
      folder: copy.folder,
      status: "draft",
      tags: copy.tags,
      color: copy.color,
    });
    if (created) {
      setAssets((prev) => prev.map((a) => (a.id === id ? created : a)));
      toast.success(`Duplicated "${asset.name}".`);
    } else {
      setAssets((prev) => prev.filter((a) => a.id !== id));
      toast.error("Couldn't save the copy to the server.");
    }
  };

  const handleRename = async (asset, name) => {
    setRenameTarget(null);
    if (name === asset.name) return;
    patchRow(asset.id, { name });
    const updated = await updateAsset(asset.id, { name });
    if (updated) {
      toast.success(`Renamed to "${name}".`);
    } else {
      patchRow(asset.id, { name: asset.name });
      toast.error("Couldn't rename the asset on the server.");
    }
  };

  // Same upload path as the editor's Versions section: the new file becomes the
  // current version and the previous one stays restorable.
  const handleReplace = async (asset) => {
    const file = await pickFile();
    if (!file) return;
    const toastId = toast.loading(`Replacing "${asset.name}"…`);
    let failure = null;
    const result = await uploadAsset(file, {
      projectId,
      assetId: asset.id,
      folder: asset.folder,
      onError: (code) => {
        failure = code;
      },
    });
    if (!result) {
      toast.error(
        UPLOAD_ERROR_MESSAGES[failure] || `Couldn't replace ${file.name || "the file"}.`,
        { id: toastId },
      );
      return;
    }
    const fresh = await getAsset(asset.id);
    if (fresh) patchRow(asset.id, fresh);
    toast.success("File replaced — a new version was recorded.", { id: toastId });
  };

  const handleDownload = (asset) => {
    if (!asset.storageKey) {
      toast.error("No file uploaded yet for this asset.");
      return;
    }
    window.open(assetFileUrl(asset.id, { download: true }), "_blank");
  };

  // A converted copy comes from the delivery route, so it needs Delivery on
  // (and transforms enabled for the project — the route refuses otherwise).
  const handleDownloadAs = async (asset, transform, ext) => {
    if (!asset.deliveryEnabled) {
      toast.error("Turn on Delivery for this asset to download other formats.");
      return;
    }
    const toastId = toast.loading("Preparing download…");
    const filename = filenameFor(asset).replace(/(\.[^.]+)?$/, `.${ext}`);
    try {
      const res = await fetch(deliveryHref(asset, transform));
      if (!res.ok) {
        toast.error("Couldn't convert this asset. Check that transforms are enabled.", {
          id: toastId,
        });
        return;
      }
      saveBlob(await res.blob(), filename);
      toast.dismiss(toastId);
    } catch {
      toast.error("Couldn't download the converted file.", { id: toastId });
    }
  };

  const handleCreateShareLink = async (asset) => {
    const user = await getUser();
    const link = await createShareLink({
      id: crypto.randomUUID(),
      projectId,
      name: asset.name,
      token: mintToken(),
      subjectType: "asset",
      subjectId: asset.id,
      visibility: "private",
      expiresAt: new Date(Date.now() + SHARE_LINK_DAYS * 86400000).toISOString(),
      allowDownload: true,
      allowComments: false,
      status: "active",
      createdBy: user?.id || null,
      actorName: user?.name || "",
    });
    if (!link) {
      toast.error("Couldn't create the share link.");
      return;
    }
    try {
      await navigator.clipboard.writeText(`${appOrigin()}/s/${link.token}`);
      toast.success(`Share link created and copied — expires in ${SHARE_LINK_DAYS} days.`);
    } catch {
      toast.success("Share link created. Find it under Shared Links.");
    }
  };

  const handleAddToCollection = async (asset, collection) => {
    setCollectionTarget(null);
    const added = await addAssetToCollection(collection.id, asset.id);
    if (added) {
      toast.success(`Added to "${collection.name}".`);
    } else {
      toast.error(`Couldn't add to "${collection.name}" — it may already be there.`);
    }
  };

  return {
    deleteTarget,
    setDeleteTarget,
    handleDelete,
    handleDuplicate,
    duplicateTarget,
    setDuplicateTarget,
    renameTarget,
    setRenameTarget,
    handleRename,
    collectionTarget,
    setCollectionTarget,
    handleAddToCollection,
    handleReplace,
    handleDownload,
    handleDownloadAs,
    handleCreateShareLink,
  };
}

export function DeleteAssetDialog({ asset, onCancel, onConfirm }) {
  return (
    <Dialog open={!!asset} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete asset</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">{asset?.name}</span>?
            This action can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="bg-red-500/90 text-white hover:bg-red-500"
            onClick={() => onConfirm(asset)}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Duplicating copies the asset's details into a new row — the stored file is
// not copied, so the copy starts without a file until one is uploaded.
export function DuplicateAssetDialog({ asset, onCancel, onConfirm }) {
  return (
    <Dialog open={!!asset} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate asset</DialogTitle>
          <DialogDescription>
            Create a draft copy of{" "}
            <span className="font-medium text-foreground">{asset?.name}</span>? Its name,
            tags, and details are copied — the file itself isn&apos;t, so upload one to the
            copy with Replace.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onConfirm(asset)}
          >
            <Copy className="h-4 w-4" /> Duplicate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({ asset, onCancel, onConfirm }) {
  const [name, setName] = useState(asset.name || "");

  const submit = () => {
    const next = name.trim();
    if (!next) {
      toast.error("Give the asset a name.");
      return;
    }
    onConfirm(asset, next);
  };

  return (
    <>
      <div className="grid gap-4">
        <Field label="Asset name" htmlFor="rename-asset">
          <Input
            id="rename-asset"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            onFocus={(e) => e.target.select()}
            autoFocus
          />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={submit}
        >
          Rename
        </Button>
      </DialogFooter>
    </>
  );
}

export function RenameAssetDialog({ asset, onCancel, onConfirm }) {
  return (
    <Dialog open={!!asset} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename asset</DialogTitle>
          <DialogDescription>
            The file itself is untouched — only the name shown across the workspace changes.
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so the field reseeds with each asset's current name. */}
        {asset && (
          <RenameForm key={asset.id} asset={asset} onCancel={onCancel} onConfirm={onConfirm} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CollectionList({ projectId, asset, onPick }) {
  const [collections, setCollections] = useState(null);

  useEffect(() => {
    let alive = true;
    listCollections(projectId).then((rows) => {
      if (alive) setCollections(rows ?? []);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (!collections) {
    return <LoadingArea panel size={36} className="py-10" />;
  }

  if (!collections.length) {
    return (
      <div className="rounded-xl border border-border bg-surface-subtle">
        <EmptyState
          icon={Layers}
          title="No collections yet"
          description="Create a collection from the Collections screen, then add assets to it here."
        />
      </div>
    );
  }

  return (
    <div className="max-h-80 overflow-y-auto rounded-xl border border-border bg-surface-subtle p-1">
      {collections.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(asset, c)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
            "hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none",
          )}
        >
          <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            {c.name || "Untitled collection"}
          </span>
          <span className="text-xs tabular-nums text-text-tertiary">
            {c.assetCount} {c.assetCount === 1 ? "asset" : "assets"}
          </span>
        </button>
      ))}
    </div>
  );
}

export function AddToCollectionDialog({ projectId, asset, onCancel, onConfirm }) {
  return (
    <Dialog open={!!asset} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to collection</DialogTitle>
          <DialogDescription>
            Pick a collection for{" "}
            <span className="font-medium text-foreground">{asset?.name}</span>. The asset
            stays where it is in the library.
          </DialogDescription>
        </DialogHeader>
        {asset && <CollectionList projectId={projectId} asset={asset} onPick={onConfirm} />}
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
