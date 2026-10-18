"use client";

// Small controls the page builder's panels share: a segmented choice, a colour
// swatch input, an asset slot and a titled panel group.

import React from "react";
import { ImageIcon, Video } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Field } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";

export function PanelGroup({ title, description, action, children, className }) {
  return (
    <section className={cn("space-y-3 border-b border-border py-5 first:pt-0 last:border-b-0 last:pb-0", className)}>
      {title || action ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
            {description ? <p className="text-xs text-text-secondary">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** A compact one-of-N choice — for enums with 2-5 short options. */
export function ChoiceField({ label, hint, value, onChange, options }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface-card p-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-7 flex-1 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
              value === opt.value ? "bg-surface-hover text-foreground shadow-sm" : "text-text-secondary hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface-card p-1 pr-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-7 w-9 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value.startsWith("#") ? e.target.value.slice(0, 7) : `#${e.target.value.slice(0, 6)}`)}
          className="h-7 border-0 bg-transparent px-1 font-mono text-xs focus-visible:ring-0"
        />
      </div>
    </Field>
  );
}

/** A picked library asset with Change / Remove — the picking dialog lives with the screen. */
export function AssetSlot({ label, hint, asset, wide = false, round = false, onPick, onClear }) {
  const Icon = asset?.type === "video" ? Video : ImageIcon;
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "relative shrink-0 overflow-hidden border border-border bg-surface-card",
            wide ? "h-14 w-24 rounded-lg" : "h-14 w-14",
            round ? "rounded-full" : "rounded-lg",
          )}
          style={asset?.color ? { backgroundColor: asset.color } : undefined}
        >
          {asset?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon className="absolute inset-0 m-auto h-4 w-4 text-text-tertiary" />
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={onPick}>
            {asset ? "Change" : "Choose"}
          </Button>
          {asset ? (
            <Button size="sm" variant="ghost" className="text-text-secondary hover:bg-surface-active hover:text-foreground" onClick={onClear}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </Field>
  );
}
