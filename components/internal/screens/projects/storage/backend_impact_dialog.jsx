"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { getStorageBackend } from "@/lib/storage/backends_client";

// Impact warning shown before a backend is disabled or deleted.
//
// Two numbers matter, and they come from different places: how many pools name
// this backend (countable from the pools the screen already fetched) and how
// many assets are pinned to it (a server count — a browser can't count rows it
// is paging through). The asset count can legitimately fail, and when it does
// the dialog says so rather than showing a confident zero: "0 assets affected"
// is exactly the sentence that would talk someone into deleting live storage.

const MODE_COPY = {
  disable: {
    title: "Disable this backend?",
    description:
      "Placement skips a disabled backend, so new uploads stop landing here. Objects already stored stay readable.",
    confirm: "Disable",
  },
  delete: {
    title: "Delete this backend?",
    description:
      "The record is soft-deleted and placement stops using it. Objects already written to it stay where they are — nothing is copied or removed for you.",
    confirm: "Delete",
  },
};

export function BackendImpactDialog({ open, backend, mode = "disable", pools = [], onCancel, onConfirm }) {
  const [assetCount, setAssetCount] = useState(undefined); // undefined = loading
  const [busy, setBusy] = useState(false);

  const copy = MODE_COPY[mode] || MODE_COPY.disable;
  const referencing = pools.filter((pool) =>
    (pool.members || []).some((member) => member.backendId === backend?.id),
  );

  // Remounted per target by the caller's key, so the count starts unresolved
  // without the effect having to reset it.
  useEffect(() => {
    if (!open || !backend?.id) return undefined;
    let alive = true;
    getStorageBackend(backend.id).then((result) => {
      if (!alive) return;
      // null usage (or a null count inside it) means the count could not be
      // taken — keep it null so the UI says "couldn't determine".
      setAssetCount(result?.usage?.assetCount ?? null);
    });
    return () => {
      alive = false;
    };
  }, [open, backend?.id]);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    await onConfirm();
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : (next) => (next ? null : onCancel())}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="rounded-xl border border-border bg-surface-subtle p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
              Impact of “{backend?.label || "this backend"}”
            </p>

            {assetCount === undefined ? (
              <div className="flex items-center justify-center py-6">
                <LogoLoading size={40} aria-label="Counting affected assets" />
              </div>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  {assetCount === null ? (
                    <span className="text-text-secondary">
                      Couldn’t determine how many assets are pinned to this backend.
                    </span>
                  ) : (
                    <span>
                      <span className="font-medium tabular-nums">{assetCount.toLocaleString("en-US")}</span>{" "}
                      {assetCount === 1 ? "asset is" : "assets are"} pinned to this backend.
                    </span>
                  )}
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    <span className="font-medium tabular-nums">{referencing.length}</span>{" "}
                    {referencing.length === 1 ? "pool references" : "pools reference"} it
                    {referencing.length
                      ? ` — ${referencing.map((pool) => pool.name).join(", ")}.`
                      : "."}
                  </span>
                </li>
              </ul>
            )}
          </div>

          <p className="text-xs text-text-secondary">
            Reads for those assets fall back to the other pool members and then to the
            env-configured default, so an object is only unreachable if no other member holds a
            copy.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant={mode === "delete" ? "destructive" : "default"}
            className={mode === "delete" ? undefined : "bg-primary text-primary-foreground hover:bg-primary/90"}
            onClick={confirm}
            disabled={busy || assetCount === undefined}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Working…
              </>
            ) : (
              copy.confirm
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BackendImpactDialog;
