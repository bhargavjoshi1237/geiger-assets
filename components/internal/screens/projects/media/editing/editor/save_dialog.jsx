"use client";

import React, { useState } from "react";
import { Link2, Link2Off, Loader2 } from "lucide-react";

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
import { Field, SegmentedTabs } from "@/components/internal/shared/screen_kit";

import { EXPORT_FORMATS, SAVE_TARGETS, baseName } from "../constants";
import { HintIconButton, SliderRow } from "./editor_controls";

const TARGET_NOTE = {
  asset: (src) => `Creates a new draft asset${src ? ` linked to “${src}” as a variant` : ""}. The master stays untouched.`,
  version: (src) => `Uploads this edit as the current version of “${src}”. The previous file stays in its version history.`,
  download: () => "Saves the file to your computer. Nothing is uploaded.",
};

function SaveForm({ initialTarget, doc, source, sourceName, canVersion, busy, onCancel, onConfirm }) {
  const targets = SAVE_TARGETS.filter((t) => t.value !== "version" || canVersion);
  const [target, setTarget] = useState(targets.some((t) => t.value === initialTarget) ? initialTarget : targets[0].value);
  const [name, setName] = useState(`${baseName(sourceName)} (edited)`);
  const [format, setFormat] = useState("image/webp");
  const [quality, setQuality] = useState(90);
  const [size, setSize] = useState({ w: doc.width, h: doc.height });
  const [lock, setLock] = useState(true);
  const fmt = EXPORT_FORMATS.find((f) => f.value === format);
  const ratio = doc.width / doc.height;
  const upscale = source && source.scale < 1 ? 1 / source.scale : null;

  const setW = (w) => setSize((s) => ({ w, h: lock ? Math.max(1, Math.round(w / ratio)) : s.h }));
  const setH = (h) => setSize((s) => ({ h, w: lock ? Math.max(1, Math.round(h * ratio)) : s.w }));
  const scaleTo = (k) => setSize({ w: Math.max(1, Math.round(doc.width * k)), h: Math.max(1, Math.round(doc.height * k)) });

  const valid = size.w > 0 && size.h > 0 && size.w <= 16384 && size.h <= 16384 && (target !== "asset" || name.trim());

  const submit = (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    onConfirm({ target, name: name.trim(), type: format, ext: fmt.ext, quality: quality / 100, width: size.w, height: size.h });
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Save image</DialogTitle>
        <DialogDescription>Export the edit as a delivery-ready file.</DialogDescription>
      </DialogHeader>

      <Field label="Save as">
        <SegmentedTabs tabs={targets} value={target} onChange={setTarget} fullWidth />
      </Field>

      {target === "asset" ? (
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="border-border bg-surface-card" autoFocus />
        </Field>
      ) : null}

      <Field label="Format">
        <SegmentedTabs tabs={EXPORT_FORMATS.map((f) => ({ value: f.value, label: f.label }))} value={format} onChange={setFormat} fullWidth />
      </Field>

      {fmt.lossy ? (
        <SliderRow label="Quality" min={10} max={100} unit="%" resetTo={90} value={quality} onChange={setQuality} format={(v) => `${v}%`} />
      ) : null}

      <Field label="Size">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={size.w}
            onChange={(e) => setW(Number(e.target.value) || 0)}
            aria-label="Width"
            className="border-border bg-surface-card font-mono"
          />
          <HintIconButton
            icon={lock ? Link2 : Link2Off}
            label={lock ? "Unlock aspect ratio" : "Lock aspect ratio"}
            active={lock}
            onClick={() => setLock((v) => !v)}
          />
          <Input
            type="number"
            min={1}
            value={size.h}
            onChange={(e) => setH(Number(e.target.value) || 0)}
            aria-label="Height"
            className="border-border bg-surface-card font-mono"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[0.25, 0.5, 1].map((k) => (
            <Button key={k} type="button" variant="outline" size="sm" className="h-7 border-border bg-transparent text-xs" onClick={() => scaleTo(k)}>
              {k * 100}%
            </Button>
          ))}
          {upscale ? (
            <Button type="button" variant="outline" size="sm" className="h-7 border-border bg-transparent text-xs" onClick={() => scaleTo(upscale)}>
              Source size
            </Button>
          ) : null}
        </div>
      </Field>

      <p className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs text-text-secondary">
        {TARGET_NOTE[target](sourceName)}
      </p>

      <DialogFooter>
        <Button type="button" variant="ghost" className="text-text-secondary hover:text-foreground" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={!valid || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {target === "download" ? "Download" : target === "version" ? "Save version" : "Save asset"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SaveDialog({ open, onOpenChange, busy, ...props }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="bg-background sm:max-w-md">
        {open ? <SaveForm {...props} busy={busy} onCancel={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
