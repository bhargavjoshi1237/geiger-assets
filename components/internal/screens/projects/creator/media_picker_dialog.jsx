"use client";

// Pick several library assets for a post, in order — the order picked is the
// order the carousel shows them. Numbers on each tile show that order.

import React, { useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { ScrollArea } from "@geiger/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { AssetThumbnail } from "@/components/internal/shared/asset_thumbnail";
import { EmptyState, SearchInput } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";

export function MediaPickerDialog({ open, onOpenChange, assets, selected, onDone, title = "Choose media", max = 20 }) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(selected || []);

  React.useEffect(() => {
    if (open) {
      setPicked(selected || []);
      setSearch("");
    }
  }, [open, selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => `${a.name} ${a.type} ${(a.tags || []).join(" ")}`.toLowerCase().includes(q));
  }, [assets, search]);

  const toggle = (id) =>
    setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length >= max ? list : [...list, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100vw-2rem)] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Images, video, audio or files — up to {max}. The first one is the cover.</DialogDescription>
        </DialogHeader>
        <SearchInput value={search} onChange={setSearch} placeholder="Search the library…" />
        <ScrollArea className="-mx-1 min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:max-h-[52dvh]">
          {filtered.length === 0 ? (
            <EmptyState icon={ImageIcon} title={assets.length ? "No matches" : "No assets yet"} description={assets.length ? "Try a different search." : "Upload media in the Asset Library first."} className="py-10" />
          ) : (
            <div className="grid grid-cols-2 gap-3 px-1 pb-1 sm:grid-cols-3 md:grid-cols-4">
              {filtered.map((a) => {
                const order = picked.indexOf(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a.id)}
                    aria-pressed={order >= 0}
                    className="group grid gap-2 rounded-xl p-1.5 text-left transition-colors hover:bg-surface-hover"
                  >
                    <span
                      className={cn(
                        "relative block aspect-[4/3] overflow-hidden rounded-lg border",
                        order >= 0 ? "border-foreground ring-1 ring-foreground" : "border-border",
                      )}
                    >
                      <AssetThumbnail asset={a} assetId={a.id} className="h-full w-full" iconClassName="h-6 w-6" />
                      {order >= 0 ? (
                        <span className="absolute left-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-foreground px-1.5 text-[11px] font-semibold text-background">
                          {order + 1}
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate px-0.5 text-xs text-foreground">{a.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-text-secondary">{picked.length} selected</p>
          <div className="flex gap-2">
            <Button variant="ghost" className="text-muted-foreground hover:bg-surface-active" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onDone(picked)}>
              Use {picked.length || ""} {picked.length === 1 ? "item" : "items"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
