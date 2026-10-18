"use client";

import React from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
  Copy,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Slider } from "@geiger/ui/slider";

import { CROP_RATIOS, SHAPE_KINDS, TOOLS } from "../constants";
import { BarDivider, ChoiceGroup, ColorField, HintIconButton } from "./editor_controls";

const ALIGN_ACTIONS = [
  { value: "left", label: "Align left", icon: AlignStartVertical },
  { value: "center", label: "Align horizontal centers", icon: AlignCenterVertical },
  { value: "right", label: "Align right", icon: AlignEndVertical },
  { value: "top", label: "Align top", icon: AlignStartHorizontal },
  { value: "middle", label: "Align vertical centers", icon: AlignCenterHorizontal },
  { value: "bottom", label: "Align bottom", icon: AlignEndHorizontal },
];

function HintText({ children }) {
  return <p className="truncate text-xs text-text-tertiary">{children}</p>;
}

export function AlignButtons({ engine, size = "sm" }) {
  return (
    <div className="flex items-center gap-0.5">
      {ALIGN_ACTIONS.map((a) => (
        <HintIconButton key={a.value} icon={a.icon} label={`${a.label} to canvas`} size={size} onClick={() => engine.align(a.value)} />
      ))}
    </div>
  );
}

function SelectOptions({ state, engine }) {
  const active = state.active;
  if (!active) {
    return <HintText>Click a layer to select it · Shift-click to add · drag on empty canvas to marquee-select · arrows nudge</HintText>;
  }
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="mr-1 max-w-[160px] truncate text-xs font-medium text-foreground">
        {active.kind === "multi" ? `${active.count} layers` : active.name}
      </span>
      <AlignButtons engine={engine} />
      <BarDivider />
      <HintIconButton icon={ArrowUpToLine} label="Bring forward" shortcut="Ctrl ]" size="sm" onClick={() => engine.reorder(null, "up")} />
      <HintIconButton icon={ArrowDownToLine} label="Send backward" shortcut="Ctrl [" size="sm" onClick={() => engine.reorder(null, "down")} />
      <HintIconButton icon={Copy} label="Duplicate" shortcut="Ctrl J" size="sm" onClick={() => engine.duplicate()} />
      <HintIconButton
        icon={Trash2}
        label="Delete"
        shortcut="Del"
        size="sm"
        className="hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
        onClick={() => engine.removeActive()}
      />
    </div>
  );
}

function CropOptions({ state, engine }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <ChoiceGroup
        options={CROP_RATIOS.map((r) => ({ value: r.value, label: r.label }))}
        value={state.cropRatio}
        onChange={(v) => engine.setCropRatio(v)}
        className="max-w-full overflow-x-auto [scrollbar-width:none]"
      />
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Button variant="ghost" size="sm" className="h-7 text-xs text-text-secondary hover:text-foreground" onClick={() => engine.cancelCrop()}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
        <Button size="sm" className="h-7 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => engine.applyCrop()}>
          <Check className="h-3.5 w-3.5" /> Apply
        </Button>
      </div>
    </div>
  );
}

export function OptionsBar({ state, engine }) {
  if (!state?.ready || !engine) {
    return <div className="h-10 shrink-0 border-b border-border" />;
  }
  const tool = TOOLS.find((t) => t.value === state.tool);
  const ToolIcon = tool?.icon;

  let body = null;
  switch (state.tool) {
    case "select":
      body = <SelectOptions state={state} engine={engine} />;
      break;
    case "crop":
      body = <CropOptions state={state} engine={engine} />;
      break;
    case "shape":
      body = (
        <>
          <ChoiceGroup options={SHAPE_KINDS} value={state.shapeKind} onChange={(v) => engine.setShapeKind(v)} />
          <BarDivider />
          <ColorField label="Fill" value={state.color} onChange={(c) => engine.setColor(c)} className="w-32" />
          <HintText>Drag to draw · Shift keeps it square</HintText>
        </>
      );
      break;
    case "brush":
      body = (
        <>
          <span className="text-xs text-text-secondary">Size</span>
          <Slider
            value={[state.brushSize]}
            min={1}
            max={200}
            onValueChange={([v]) => engine.setBrushSize(v)}
            aria-label="Brush size"
            className="w-36 [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-track]]:h-1"
          />
          <span className="w-12 font-mono text-xs tabular-nums text-text-secondary">{state.brushSize}px</span>
          <BarDivider />
          <ColorField label="Color" value={state.color} onChange={(c) => engine.setColor(c)} className="w-32" />
        </>
      );
      break;
    case "text":
      body = (
        <>
          <ColorField label="Color" value={state.color} onChange={(c) => engine.setColor(c)} className="w-32" />
          <HintText>Click the canvas to place text · double-click text to edit it</HintText>
        </>
      );
      break;
    case "eyedropper":
      body = (
        <>
          <ColorField label="Sampled" value={state.color} onChange={(c) => engine.setColor(c)} className="w-32" />
          <HintText>Click anywhere on the image to sample a color</HintText>
        </>
      );
      break;
    default:
      body = <HintText>{tool?.hint}</HintText>;
  }

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 overflow-hidden border-b border-border px-3">
      {ToolIcon ? (
        <span className="flex shrink-0 items-center gap-1.5 pr-1 text-xs font-medium text-foreground">
          <ToolIcon className="h-3.5 w-3.5 text-text-secondary" />
          {tool.label}
        </span>
      ) : null}
      <BarDivider />
      <div className="flex min-w-0 flex-1 items-center gap-2">{body}</div>
    </div>
  );
}
