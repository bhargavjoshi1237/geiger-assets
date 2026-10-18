"use client";

import React, { useState } from "react";
import {
  Circle,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  ImagePlus,
  Lock,
  LockOpen,
  Minus,
  Paintbrush,
  Square,
  Trash2,
  Type,
} from "lucide-react";

import { ScrollArea } from "@geiger/ui/scroll-area";
import { SegmentedTabs, StatusPill } from "@/components/internal/shared/screen_kit";
import { STATUS_META } from "@/components/internal/screens/projects/library/constants";
import { cn } from "@/lib/utils";

import { HintIconButton } from "./editor_controls";

const KIND_ICON = {
  base: ImageIcon,
  image: ImageIcon,
  itext: Type,
  rect: Square,
  ellipse: Circle,
  line: Minus,
  path: Paintbrush,
};

function LayerRow({ layer, engine, over, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [renaming, setRenaming] = useState(false);
  const Icon = KIND_ICON[layer.kind] || Square;
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!layer.base && !renaming}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={() => engine.select(layer.base ? null : layer.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !renaming) engine.select(layer.base ? null : layer.id);
      }}
      onDoubleClick={() => !layer.base && setRenaming(true)}
      className={cn(
        "group flex h-9 cursor-default items-center gap-1.5 border-t border-transparent px-2 text-xs outline-none transition-colors focus-visible:bg-surface-hover",
        layer.selected ? "bg-surface-active text-foreground" : "text-text-secondary hover:bg-surface-hover",
        over && "border-foreground/60",
        !layer.visible && "opacity-60",
      )}
    >
      <button
        type="button"
        aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
        onClick={stop(() => engine.toggleVisible(layer.id))}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-tertiary hover:text-foreground"
      >
        {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border bg-surface-card">
        <Icon className="h-3 w-3 text-text-secondary" />
      </span>
      {renaming ? (
        <input
          autoFocus
          defaultValue={layer.name}
          aria-label="Layer name"
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            engine.rename(layer.id, e.target.value);
            setRenaming(false);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setRenaming(false);
          }}
          className="h-6 min-w-0 flex-1 rounded border border-border-strong bg-surface-card px-1.5 text-xs text-foreground outline-none"
        />
      ) : (
        <span className={cn("min-w-0 flex-1 truncate", layer.selected && "font-medium", layer.base && "italic")}>{layer.name}</span>
      )}
      {layer.base ? (
        <Lock aria-label="Background is locked" className="mr-1.5 h-3 w-3 shrink-0 text-text-tertiary" />
      ) : (
        <button
          type="button"
          aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
          onClick={stop(() => engine.toggleLock(layer.id))}
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-tertiary hover:text-foreground",
            !layer.locked && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          )}
        >
          {layer.locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}

function LayersList({ state, engine, onPlace }) {
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const hasSelection = Boolean(state.active);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="py-1">
          {state.layers.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              engine={engine}
              over={overId === layer.id && dragId !== layer.id}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                setDragId(layer.id);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOverId(layer.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) engine.moveLayer(dragId, layer.id);
                setDragId(null);
                setOverId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
            />
          ))}
        </div>
      </ScrollArea>
      <div className="flex h-9 shrink-0 items-center justify-end gap-0.5 border-t border-border px-2">
        <span className="mr-auto text-[11px] text-text-tertiary">
          {state.layers.length} {state.layers.length === 1 ? "layer" : "layers"}
        </span>
        <HintIconButton icon={Type} label="Add text" size="sm" side="top" onClick={() => engine.addText()} />
        <HintIconButton icon={ImagePlus} label="Place image" size="sm" side="top" onClick={onPlace} />
        <HintIconButton icon={Copy} label="Duplicate layer" size="sm" side="top" disabled={!hasSelection} onClick={() => engine.duplicate()} />
        <HintIconButton
          icon={Trash2}
          label="Delete layer"
          size="sm"
          side="top"
          disabled={!hasSelection}
          className="hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          onClick={() => engine.removeActive()}
        />
      </div>
    </div>
  );
}

function HistoryList({ state, engine }) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="py-1">
        {state.history.map((label, i) => (
          <button
            key={`${i}-${label}`}
            type="button"
            onClick={() => engine.jumpTo(i)}
            className={cn(
              "flex h-8 w-full items-center gap-2.5 px-3 text-left text-xs transition-colors",
              i === state.index
                ? "bg-surface-active font-medium text-foreground"
                : i > state.index
                  ? "text-text-tertiary opacity-60 hover:bg-surface-hover"
                  : "text-text-secondary hover:bg-surface-hover hover:text-foreground",
            )}
          >
            <span className="w-5 shrink-0 font-mono text-[10px] tabular-nums text-text-tertiary">{i + 1}</span>
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

function VariantsList({ variants, loading, currentId, onOpen, canHaveVariants }) {
  if (!canHaveVariants) {
    return <p className="p-4 text-xs text-text-tertiary">Local files have no variants. Save as a new asset to add it to the library.</p>;
  }
  if (loading) return <p className="p-4 text-xs text-text-tertiary">Loading variants…</p>;
  if (!variants.length) {
    return (
      <p className="p-4 text-xs text-text-tertiary">
        No saved variants yet. Use Save → New asset to keep an edit alongside the master.
      </p>
    );
  }
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="py-1">
        {variants.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onOpen(v.id)}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-surface-hover",
              v.id === currentId && "bg-surface-active",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-card">
              {v.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.miniThumbnailUrl || v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5 text-text-secondary" />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">{v.name}</span>
            <StatusPill status={v.status} map={STATUS_META} className="text-[10px]" />
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

export function LayersDock({ state, engine, onPlace, variants, variantsLoading, currentId, onOpenVariant, canHaveVariants, className }) {
  const [tab, setTab] = useState("layers");
  if (!state?.ready || !engine) return <div className={className} />;
  const tabs = [
    { value: "layers", label: "Layers" },
    { value: "history", label: "History" },
    { value: "variants", label: variants.length ? `Variants · ${variants.length}` : "Variants" },
  ];
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="shrink-0 border-b border-border px-3 py-2">
        <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} fullWidth buttonClassName="h-7 px-2 text-xs" />
      </div>
      {tab === "layers" ? (
        <LayersList state={state} engine={engine} onPlace={onPlace} />
      ) : tab === "history" ? (
        <HistoryList state={state} engine={engine} />
      ) : (
        <VariantsList
          variants={variants}
          loading={variantsLoading}
          currentId={currentId}
          onOpen={onOpenVariant}
          canHaveVariants={canHaveVariants}
        />
      )}
    </div>
  );
}
