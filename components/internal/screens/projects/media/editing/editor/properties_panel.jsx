"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  Copy,
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  Italic,
  Layers,
  RotateCcw,
  RotateCw,
  Stamp,
  Trash2,
  Underline,
  Upload,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { ScrollArea } from "@geiger/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui/select";
import { SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";

import {
  ADJUSTMENT_GROUPS,
  ADJUSTMENTS,
  BLEND_MODES,
  FILTER_PRESETS,
  FONT_FAMILIES,
  WATERMARK_POSITIONS,
} from "../constants";
import { AlignButtons } from "./options_bar";
import {
  ChoiceGroup,
  ColorField,
  HintIconButton,
  IconButton,
  NumberField,
  PanelLink,
  PanelSection,
  SliderRow,
} from "./editor_controls";

const IMAGE_TABS = [
  { value: "adjust", label: "Adjust" },
  { value: "looks", label: "Looks" },
  { value: "canvas", label: "Canvas" },
];

const TEXT_ALIGN = [
  { value: "left", label: "Align left", icon: AlignLeft },
  { value: "center", label: "Align center", icon: AlignCenter },
  { value: "right", label: "Align right", icon: AlignRight },
];

const TEXT_STYLES = [
  { key: "bold", label: "Bold", icon: Bold },
  { key: "italic", label: "Italic", icon: Italic },
  { key: "underline", label: "Underline", icon: Underline },
];

const KIND_LABEL = {
  itext: "Text",
  rect: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  path: "Brush stroke",
  image: "Image",
  multi: "Selection",
};

const selectTrigger = "h-8 w-full border-border bg-surface-card text-xs";
const selectContent = "border-border bg-surface-subtle";

function AdjustTab({ state, engine }) {
  const changed = ADJUSTMENTS.some((a) => state.adjust[a.key] !== 0);
  return (
    <>
      {ADJUSTMENT_GROUPS.map((group, i) => (
        <PanelSection
          key={group}
          title={group}
          action={
            i === 0 ? (
              <PanelLink disabled={!changed} onClick={() => engine.resetAdjust()}>
                Reset all
              </PanelLink>
            ) : null
          }
        >
          <div className="grid gap-4">
            {ADJUSTMENTS.filter((a) => a.group === group).map((a) => (
              <SliderRow
                key={a.key}
                label={a.label}
                min={a.min}
                max={a.max}
                unit={a.unit}
                value={state.adjust[a.key]}
                onChange={(v) => engine.setAdjust({ [a.key]: v }, { commitLabel: a.label })}
              />
            ))}
          </div>
        </PanelSection>
      ))}
      <p className="px-4 pb-4 text-[11px] text-text-tertiary">Double-click a slider to reset it. Adjustments are non-destructive.</p>
    </>
  );
}

function LooksTab({ state, engine, sourceKey }) {
  const previews = useMemo(
    () => (engine && sourceKey ? engine.presetPreviews(FILTER_PRESETS.map((p) => p.value)) : {}),
    [engine, sourceKey],
  );
  return (
    <PanelSection title="Looks">
      <div className="grid grid-cols-3 gap-2">
        {FILTER_PRESETS.map((p) => {
          const active = state.preset === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => engine.setPreset(p.value, p.label)}
              className="group grid gap-1.5 text-left"
            >
              <span
                className={cn(
                  "block aspect-square overflow-hidden rounded-lg border bg-surface-card transition-all",
                  active ? "border-foreground ring-1 ring-foreground" : "border-border group-hover:border-border-strong",
                )}
              >
                {previews[p.value] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[p.value]} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
              <span className={cn("truncate text-[11px]", active ? "font-medium text-foreground" : "text-text-secondary")}>{p.label}</span>
            </button>
          );
        })}
      </div>
    </PanelSection>
  );
}

function CanvasTab({ state, engine, onPlaceFromLibrary }) {
  const [mark, setMark] = useState({ text: "© Studio", position: "bottom-right", opacity: 70 });
  const fileRef = useRef(null);
  const { doc, source } = state;
  return (
    <>
      <PanelSection title="Artboard">
        <p className="font-mono text-sm tabular-nums text-foreground">
          {doc.width} × {doc.height} <span className="text-text-tertiary">px</span>
        </p>
        {source && source.scale < 1 ? (
          <p className="mt-1 text-[11px] text-text-tertiary">
            Editing a downscaled working copy — the source is {source.width} × {source.height}.
          </p>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="border-border bg-transparent text-xs" onClick={() => engine.rotate(-1)}>
            <RotateCcw className="h-3.5 w-3.5" /> Rotate left
          </Button>
          <Button variant="outline" size="sm" className="border-border bg-transparent text-xs" onClick={() => engine.rotate(1)}>
            <RotateCw className="h-3.5 w-3.5" /> Rotate right
          </Button>
          <Button variant="outline" size="sm" className="border-border bg-transparent text-xs" onClick={() => engine.flip("x")}>
            <FlipHorizontal2 className="h-3.5 w-3.5" /> Flip H
          </Button>
          <Button variant="outline" size="sm" className="border-border bg-transparent text-xs" onClick={() => engine.flip("y")}>
            <FlipVertical2 className="h-3.5 w-3.5" /> Flip V
          </Button>
          <Button variant="outline" size="sm" className="col-span-2 border-border bg-transparent text-xs" onClick={() => engine.setTool("crop")}>
            <Crop className="h-3.5 w-3.5" /> Crop
          </Button>
        </div>
      </PanelSection>

      <PanelSection title="Watermark">
        <div className="grid gap-3">
          <Input
            value={mark.text}
            onChange={(e) => setMark((m) => ({ ...m, text: e.target.value }))}
            placeholder="© Studio"
            className="h-8 border-border bg-surface-card text-xs"
          />
          <Select value={mark.position} onValueChange={(v) => setMark((m) => ({ ...m, position: v }))}>
            <SelectTrigger className={selectTrigger}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContent}>
              {WATERMARK_POSITIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SliderRow label="Opacity" min={5} max={100} unit="%" resetTo={70} value={mark.opacity} onChange={(v) => setMark((m) => ({ ...m, opacity: v }))} />
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-transparent text-xs"
            disabled={!mark.text.trim()}
            onClick={() => engine.addWatermark({ text: mark.text.trim(), position: mark.position, opacity: mark.opacity / 100 })}
          >
            <Stamp className="h-3.5 w-3.5" /> Add watermark layer
          </Button>
        </div>
      </PanelSection>

      <PanelSection title="Place image">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="border-border bg-transparent text-xs" onClick={onPlaceFromLibrary}>
            <ImagePlus className="h-3.5 w-3.5" /> Library
          </Button>
          <Button variant="outline" size="sm" className="border-border bg-transparent text-xs" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Computer
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) engine.placeFile(file);
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-text-tertiary">Logos and overlays land as their own layers. You can also paste or drop images onto the canvas.</p>
      </PanelSection>
    </>
  );
}

function LayerProperties({ state, engine }) {
  const a = state.active;
  const set = (patch, label) => engine.updateActive(patch, { commitLabel: label });
  const isText = a.kind === "itext";
  const strokeOnly = a.kind === "line" || a.kind === "path";
  const hasFill = !strokeOnly && a.kind !== "image" && a.kind !== "multi";
  const hasStroke = a.kind !== "image" && a.kind !== "multi";

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-card">
          <Layers className="h-4 w-4 text-text-secondary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{a.kind === "multi" ? `${a.count} layers` : a.name}</p>
          <p className="text-[11px] text-text-tertiary">{KIND_LABEL[a.kind] || "Layer"}</p>
        </div>
        <IconButton icon={Copy} label="Duplicate" size="sm" onClick={() => engine.duplicate()} disabled={a.kind === "multi"} />
        <IconButton
          icon={Trash2}
          label="Delete"
          size="sm"
          className="hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          onClick={() => engine.removeActive()}
        />
      </div>

      {a.kind !== "multi" ? (
        <PanelSection title="Transform">
          <div className="grid grid-cols-2 gap-2">
            <NumberField prefix="X" value={a.x} onCommit={(v) => set({ x: v }, "Move")} />
            <NumberField prefix="Y" value={a.y} onCommit={(v) => set({ y: v }, "Move")} />
            <NumberField prefix="W" value={a.width} min={1} onCommit={(v) => set({ width: v }, "Resize")} />
            <NumberField prefix="H" value={a.height} min={1} onCommit={(v) => set({ height: v }, "Resize")} />
            <NumberField prefix="∠" value={a.angle} suffix="°" label="Rotation" onCommit={(v) => set({ angle: v }, "Rotate")} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-text-secondary">Align to canvas</span>
            <AlignButtons engine={engine} />
          </div>
        </PanelSection>
      ) : (
        <PanelSection title="Align">
          <AlignButtons engine={engine} />
        </PanelSection>
      )}

      <PanelSection title="Layer">
        <div className="grid gap-4">
          <SliderRow
            label="Opacity"
            min={0}
            max={100}
            unit="%"
            resetTo={100}
            value={Math.round(a.opacity * 100)}
            onChange={(v) => set({ opacity: v / 100 }, "Opacity")}
          />
          {a.kind !== "multi" ? (
            <div className="grid gap-1.5">
              <span className="text-xs text-text-secondary">Blend mode</span>
              <Select value={a.blend} onValueChange={(v) => set({ blend: v }, "Blend mode")}>
                <SelectTrigger className={selectTrigger}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContent}>
                  {BLEND_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </PanelSection>

      {isText ? (
        <PanelSection title="Type">
          <div className="grid gap-3">
            <Select value={a.fontFamily} onValueChange={(v) => set({ fontFamily: v }, "Font")}>
              <SelectTrigger className={selectTrigger}>
                <SelectValue placeholder="Font" />
              </SelectTrigger>
              <SelectContent className={selectContent}>
                {FONT_FAMILIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    <span style={{ fontFamily: f.value }}>{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <NumberField prefix="pt" value={Math.round(a.fontSize)} min={1} max={2000} label="Font size" className="w-24" onCommit={(v) => set({ fontSize: v }, "Font size")} />
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-card p-0.5">
                {TEXT_STYLES.map((t) => (
                  <HintIconButton
                    key={t.key}
                    icon={t.icon}
                    label={t.label}
                    size="sm"
                    active={a[t.key]}
                    onClick={() => set({ [t.key]: !a[t.key] }, t.label)}
                  />
                ))}
              </div>
            </div>
            <ChoiceGroup options={TEXT_ALIGN} value={a.textAlign} onChange={(v) => set({ textAlign: v }, "Text align")} />
            <SliderRow label="Letter spacing" min={-200} max={800} step={10} value={a.charSpacing} onChange={(v) => set({ charSpacing: v }, "Letter spacing")} />
            <SliderRow
              label="Line height"
              min={0.6}
              max={3}
              step={0.05}
              resetTo={1.16}
              value={Number(a.lineHeight.toFixed(2))}
              format={(v) => v.toFixed(2)}
              onChange={(v) => set({ lineHeight: v }, "Line height")}
            />
            <label className="flex items-center justify-between text-xs text-text-secondary">
              Drop shadow
              <Switch checked={a.shadow} onCheckedChange={(v) => set({ shadow: v }, "Shadow")} />
            </label>
          </div>
        </PanelSection>
      ) : null}

      {hasFill || hasStroke ? (
        <PanelSection title="Appearance">
          <div className="grid gap-3">
            {hasFill ? <ColorField label="Fill" value={a.fill} allowNone={!isText} onChange={(c) => set({ fill: c }, "Fill")} /> : null}
            {hasStroke ? (
              <div className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-2">
                <ColorField label="Stroke" value={a.stroke} allowNone={!strokeOnly} onChange={(c) => set({ stroke: c, ...(c && !a.strokeWidth ? { strokeWidth: 2 } : {}) }, "Stroke")} />
                <NumberField prefix="px" value={a.strokeWidth} min={0} max={500} label="Stroke width" onCommit={(v) => set({ strokeWidth: v }, "Stroke width")} />
              </div>
            ) : null}
            {a.kind === "rect" ? (
              <SliderRow label="Corner radius" min={0} max={Math.max(50, Math.round(Math.min(a.width, a.height) / 2))} value={Math.round(a.radius)} onChange={(v) => set({ radius: v }, "Corner radius")} />
            ) : null}
          </div>
        </PanelSection>
      ) : null}

      <PanelSection title="Arrange">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="border-border bg-transparent text-xs" onClick={() => engine.reorder(null, "up")}>
            <ArrowUpToLine className="h-3.5 w-3.5" /> Forward
          </Button>
          <Button variant="outline" size="sm" className="border-border bg-transparent text-xs" onClick={() => engine.reorder(null, "down")}>
            <ArrowDownToLine className="h-3.5 w-3.5" /> Backward
          </Button>
        </div>
      </PanelSection>
    </>
  );
}

export function PropertiesPanel({ state, engine, sourceKey, onPlaceFromLibrary }) {
  const [tab, setTab] = useState("adjust");
  if (!state?.ready || !engine) {
    return <div className="flex-1 p-4 text-xs text-text-tertiary">Open an image to see its properties.</div>;
  }
  const layerMode = Boolean(state.active) && state.tool !== "crop";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-xs font-medium text-foreground">Properties</h2>
        {layerMode ? (
          <PanelLink onClick={() => engine.select(null)}>Back to image</PanelLink>
        ) : null}
      </div>
      {layerMode ? null : (
        <div className="shrink-0 border-b border-border px-3 py-2">
          <SegmentedTabs tabs={IMAGE_TABS} value={tab} onChange={setTab} fullWidth buttonClassName="h-7 text-xs" />
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1">
        {layerMode ? (
          <LayerProperties state={state} engine={engine} />
        ) : tab === "adjust" ? (
          <AdjustTab state={state} engine={engine} />
        ) : tab === "looks" ? (
          <LooksTab state={state} engine={engine} sourceKey={sourceKey} />
        ) : (
          <CanvasTab state={state} engine={engine} onPlaceFromLibrary={onPlaceFromLibrary} />
        )}
      </ScrollArea>
    </div>
  );
}
