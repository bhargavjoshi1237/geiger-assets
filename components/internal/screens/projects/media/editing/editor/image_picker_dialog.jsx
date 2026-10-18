"use client";

import React, { useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Upload } from "lucide-react";

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
import { EmptyState, SearchInput } from "@/components/internal/shared/screen_kit";
import { formatBytes } from "@/components/internal/screens/projects/library/constants";
import { cn } from "@/lib/utils";

const COPY = {
  open: {
    title: "Open image",
    description: "Pick an image from this project to edit. The master is never overwritten.",
    file: "Open from computer",
  },
  place: {
    title: "Place image",
    description: "Add an image from the library as a new layer — logos, overlays, cut-outs.",
    file: "Place from computer",
  },
};

export function ImagePickerDialog({ open, onOpenChange, mode = "open", assets, currentId, onPick, onPickFile, title, description, currentLabel = "Editing" }) {
  const [search, setSearch] = useState("");
  const fileRef = useRef(null);
  const copy = { ...(COPY[mode] ?? COPY.open), ...(title ? { title } : {}), ...(description ? { description } : {}) };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => `${a.name} ${a.format} ${(a.tags || []).join(" ")}`.toLowerCase().includes(q));
  }, [assets, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-4 bg-background sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <SearchInput value={search} onChange={setSearch} placeholder="Search images…" />
        <ScrollArea className="-mx-1 min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:max-h-[52dvh]">
          {filtered.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title={assets.length ? "No matches" : "No images yet"}
              description={assets.length ? "Try a different search." : "Upload images in the Asset Library to edit them here."}
              className="py-10"
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 px-1 pb-1 sm:grid-cols-3 md:grid-cols-4">
              {filtered.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onPick(a)}
                  className="group grid gap-2 rounded-xl p-1.5 text-left transition-colors hover:bg-surface-hover"
                >
                  <span
                    className={cn(
                      "relative block aspect-[4/3] overflow-hidden rounded-lg border bg-surface-card",
                      a.id === currentId ? "border-foreground ring-1 ring-foreground" : "border-border",
                    )}
                  >
                    {a.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    ) : (
                      <ImageIcon className="absolute inset-0 m-auto h-6 w-6 text-text-tertiary" />
                    )}
                    {a.id === currentId ? (
                      <span className="absolute left-1.5 top-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground backdrop-blur">
                        {currentLabel}
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0 px-0.5">
                    <span className="block truncate text-xs font-medium text-foreground">{a.name}</span>
                    <span className="block truncate text-[10px] text-text-tertiary">
                      {[a.dimensions, a.format?.toUpperCase(), a.sizeBytes ? formatBytes(a.sizeBytes) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        <DialogFooter className="sm:justify-between">
          {onPickFile ? (
            <Button variant="outline" className="border-border bg-transparent" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> {copy.file}
            </Button>
          ) : (
            <span />
          )}
          <Button variant="ghost" className="text-text-secondary hover:text-foreground" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onPickFile?.(file);
            }}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
