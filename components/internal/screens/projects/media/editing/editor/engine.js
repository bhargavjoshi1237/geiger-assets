// Image editor engine — a framework-free wrapper around a Fabric.js canvas.
//
// The document is a fixed-size artboard (`doc`) in scene coordinates. The
// source image is the locked "Background" layer; adjustments are live WebGL
// filters on it, so the master pixels are never touched. Crop, rotate and flip
// move every layer and resize the artboard. History stores light snapshots
// (artboard, background transform, adjustments, serialized user layers) —
// never pixels. React reads it as an external store (`subscribe`/`getSnapshot`).

import {
  ActiveSelection,
  Canvas,
  Ellipse,
  FabricImage,
  Gradient,
  IText,
  Line,
  PencilBrush,
  Point,
  Rect,
  Shadow,
  filters as F,
  util,
} from "fabric";

import {
  DEFAULT_ADJUST,
  FONT_FAMILIES,
  HISTORY_LIMIT,
  MAX_WORKING_EDGE,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEPS,
} from "../constants";

const LAYER_PROPS = ["id", "name", "layerRole", "locked", "selectable", "evented", "hasControls"];
const BASE_PROPS = ["left", "top", "angle", "flipX", "flipY", "scaleX", "scaleY", "visible", "opacity"];
const FIT_PADDING = 40;

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function cssToken(el, name, fallback) {
  try {
    const value = getComputedStyle(el).getPropertyValue(name).trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

function toHex(r, g, b) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// Decodes an image URL into a canvas at most MAX_WORKING_EDGE on its long
// side (EXIF orientation applied). Returns null when it can't be read.
export async function decodeImage(url, { signal } = {}) {
  try {
    const res = await fetch(url, { signal, credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") && blob.type !== "application/octet-stream") return null;
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    const scale = Math.min(1, MAX_WORKING_EDGE / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return { canvas, sourceWidth, sourceHeight, scale };
  } catch (e) {
    if (e?.name !== "AbortError") console.error("[image-editor.decode]", e);
    return null;
  }
}

function presetFilter(preset) {
  switch (preset) {
    case "grayscale":
      return new F.Grayscale();
    case "blackwhite":
      return new F.BlackWhite();
    case "sepia":
      return new F.Sepia();
    case "vintage":
      return new F.Vintage();
    case "kodachrome":
      return new F.Kodachrome();
    case "technicolor":
      return new F.Technicolor();
    case "polaroid":
      return new F.Polaroid();
    case "brownie":
      return new F.Brownie();
    case "invert":
      return new F.Invert();
    default:
      return null;
  }
}

// Slider units (-100..100 etc.) → Fabric filter chain. Neutral values are
// skipped so an untouched image renders straight from the source.
export function buildFilters(adjust, preset, maxEdge) {
  const a = { ...DEFAULT_ADJUST, ...adjust };
  const out = [];
  const exposure = 2 ** (a.exposure / 100);
  const warm = a.warmth / 100;
  const tint = a.tint / 100;
  if (a.exposure || a.warmth || a.tint) {
    out.push(
      new F.ColorMatrix({
        matrix: [
          exposure, 0, 0, 0, warm * 0.08 + tint * 0.03,
          0, exposure, 0, 0, -tint * 0.06,
          0, 0, exposure, 0, -warm * 0.08 + tint * 0.03,
          0, 0, 0, 1, 0,
        ],
      }),
    );
  }
  if (a.brightness) out.push(new F.Brightness({ brightness: a.brightness / 200 }));
  if (a.contrast) out.push(new F.Contrast({ contrast: a.contrast / 150 }));
  if (a.saturation) out.push(new F.Saturation({ saturation: a.saturation / 100 }));
  if (a.vibrance) out.push(new F.Vibrance({ vibrance: a.vibrance / 100 }));
  if (a.hue) out.push(new F.HueRotation({ rotation: a.hue / 180 }));
  if (a.sharpen) {
    const s = a.sharpen / 100;
    out.push(new F.Convolute({ matrix: [0, -s, 0, -s, 1 + 4 * s, -s, 0, -s, 0] }));
  }
  if (a.blur) out.push(new F.Blur({ blur: (a.blur / 100) * 0.5 }));
  if (a.grain) out.push(new F.Noise({ noise: a.grain * 3 }));
  if (a.pixelate) {
    out.push(new F.Pixelate({ blocksize: Math.max(2, Math.round((a.pixelate / 100) * (maxEdge / 40))) }));
  }
  const look = presetFilter(preset);
  if (look) out.push(look);
  return out;
}

// Paints the pasteboard around the artboard and the crop shade. It runs as
// Fabric's overlay pass so selection controls still draw above it.
class EditorCanvas extends Canvas {
  _renderOverlay(ctx) {
    super._renderOverlay(ctx);
    this.__paintOverlay?.(ctx);
  }
}

export class EditorEngine {
  // `host` is an empty element React never renders into; the engine owns the
  // canvas DOM inside it (Fabric wraps the element) and sizes to it.
  constructor({ host, onPointer }) {
    this.container = host;
    this.onPointer = onPointer;
    this.listeners = new Set();

    this.doc = { width: 1, height: 1 };
    this.source = null;
    this.base = null;
    this.vignette = null;
    this.cropRect = null;
    this.adjust = { ...DEFAULT_ADJUST };
    this.preset = "none";
    this.tool = "select";
    this.shapeKind = "rect";
    this.cropRatio = "free";
    this.color = "#ffffff";
    this.brushSize = 12;
    this.zoom = 1;
    this.autoFit = true;
    this.comparing = false;
    this.spaceHeld = false;
    this.history = [];
    this.index = -1;
    this.savedIndex = 0;
    this.ready = false;
    this.exporting = null;
    this.objectUrls = new Set();

    this.readTheme();

    const canvasEl = document.createElement("canvas");
    host.replaceChildren(canvasEl);
    const canvas = new EditorCanvas(canvasEl, {
      width: host.clientWidth || 800,
      height: host.clientHeight || 600,
      preserveObjectStacking: true,
      controlsAboveOverlay: true,
      stopContextMenu: true,
      selectionColor: "rgba(255,255,255,0.06)",
      selectionBorderColor: this.theme.accent,
      selectionLineWidth: 1,
      backgroundColor: "",
    });
    canvas.__paintOverlay = (ctx) => this.paintOverlay(ctx);
    this.canvas = canvas;
    this.state = this.buildState();

    this.bindEvents();
    this.observeResize();
  }

  // useSyncExternalStore contract: stable snapshot until the next notify.
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  // ---------- plumbing ----------

  readTheme() {
    const el = this.container;
    this.theme = {
      pasteboard: cssToken(el, "--background", "#161616"),
      checkerA: cssToken(el, "--surface-card", "#262626"),
      checkerB: cssToken(el, "--surface-hover", "#2e2e2e"),
      accent: cssToken(el, "--primary", "#ffffff"),
    };
    this.checker = null;
  }

  notify() {
    if (this.notifyQueued) return;
    this.notifyQueued = true;
    queueMicrotask(() => {
      this.notifyQueued = false;
      if (!this.canvas) return;
      this.state = this.buildState();
      this.listeners.forEach((l) => l());
    });
  }

  render() {
    this.canvas?.requestRenderAll();
  }

  observeResize() {
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    }
    // Light/dark switches flip the tokens the pasteboard and checker use.
    if (typeof MutationObserver !== "undefined") {
      this.themeObserver = new MutationObserver(() => {
        this.readTheme();
        this.render();
      });
      this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    }
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h || !this.canvas) return;
    if (w === this.canvas.width && h === this.canvas.height) return;
    this.canvas.setDimensions({ width: w, height: h });
    if (this.autoFit) this.fit({ allowUpscale: false });
    else this.render();
  }

  dispose() {
    this.resizeObserver?.disconnect();
    this.themeObserver?.disconnect();
    clearTimeout(this.commitTimer);
    if (this.filterFrame) cancelAnimationFrame(this.filterFrame);
    this.listeners.clear();
    this.objectUrls.forEach((u) => URL.revokeObjectURL(u));
    this.objectUrls.clear();
    const c = this.canvas;
    this.canvas = null;
    // Detach only this engine's wrapper: under StrictMode a replacement engine
    // may already share the host by the time Fabric's async dispose settles.
    c?.wrapperEl?.remove();
    Promise.resolve(c?.dispose()).catch(() => {});
  }

  trackObjectUrl(url) {
    this.objectUrls.add(url);
    return url;
  }

  // ---------- state for React ----------

  buildState() {
    return {
      ready: this.ready,
      doc: { ...this.doc },
      zoom: this.zoom,
      tool: this.tool,
      shapeKind: this.shapeKind,
      cropRatio: this.cropRatio,
      color: this.color,
      brushSize: this.brushSize,
      adjust: { ...this.adjust },
      preset: this.preset,
      comparing: this.comparing,
      layers: this.getLayers(),
      active: this.getActiveInfo(),
      history: this.history.map((h) => h.label),
      index: this.index,
      canUndo: this.index > 0,
      canRedo: this.index < this.history.length - 1,
      dirty: this.index !== this.savedIndex,
      edited: this.index > 0,
      source: this.source
        ? { width: this.source.sourceWidth, height: this.source.sourceHeight, scale: this.source.scale }
        : null,
    };
  }

  userLayers() {
    return (this.canvas?.getObjects() ?? []).filter((o) => o.layerRole === "layer");
  }

  getLayers() {
    if (!this.canvas) return [];
    const active = new Set(this.canvas.getActiveObjects().map((o) => o.id));
    return this.canvas
      .getObjects()
      .filter((o) => o.layerRole === "layer" || o.layerRole === "base")
      .map((o) => ({
        id: o.id,
        name: o.name || "Layer",
        kind: o.layerRole === "base" ? "base" : o.type,
        visible: o.visible !== false,
        locked: Boolean(o.locked),
        base: o.layerRole === "base",
        selected: active.has(o.id),
        opacity: o.opacity ?? 1,
      }))
      .reverse();
  }

  getActiveInfo() {
    const o = this.canvas?.getActiveObject();
    if (!o) return null;
    if (o instanceof ActiveSelection) {
      return { kind: "multi", count: o.size(), opacity: o.opacity ?? 1 };
    }
    const box = o.getBoundingRect();
    return {
      id: o.id,
      kind: o.type,
      name: o.name || "Layer",
      opacity: o.opacity ?? 1,
      blend: o.globalCompositeOperation || "source-over",
      fill: typeof o.fill === "string" ? o.fill : "",
      stroke: typeof o.stroke === "string" ? o.stroke : "",
      strokeWidth: o.strokeWidth ?? 0,
      radius: o.rx ?? 0,
      text: o.text ?? "",
      fontFamily: o.fontFamily,
      fontSize: o.fontSize,
      bold: o.fontWeight === "bold" || Number(o.fontWeight) >= 600,
      italic: o.fontStyle === "italic",
      underline: Boolean(o.underline),
      textAlign: o.textAlign || "left",
      charSpacing: o.charSpacing ?? 0,
      lineHeight: o.lineHeight ?? 1.16,
      shadow: Boolean(o.shadow),
      x: Math.round(box.left),
      y: Math.round(box.top),
      width: Math.round(o.getScaledWidth()),
      height: Math.round(o.getScaledHeight()),
      angle: Math.round(o.angle || 0),
    };
  }

  // ---------- load ----------

  async load(source) {
    const c = this.canvas;
    if (!c) return;
    this.cancelCrop({ silent: true });
    c.discardActiveObject();
    c.remove(...c.getObjects());
    this.base?.dispose();
    this.vignette = null;

    this.source = source;
    const { width, height } = source.canvas;
    this.doc = { width, height };
    this.adjust = { ...DEFAULT_ADJUST };
    this.preset = "none";
    this.comparing = false;
    this.tool = "select";

    this.base = new FabricImage(source.canvas, {
      left: width / 2,
      top: height / 2,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
      hasControls: false,
      layerRole: "base",
      name: "Background",
      id: "base",
      objectCaching: false,
    });
    c.add(this.base);

    this.history = [];
    this.index = -1;
    this.ready = true;
    this.pushSnapshot("Open");
    this.savedIndex = 0;
    this.fit({ allowUpscale: false });
    this.applyToolMode();
    this.notify();
  }

  // Small filtered previews for the Looks grid.
  presetPreviews(presets, edge = 120) {
    if (!this.source) return {};
    const src = this.source.canvas;
    const scale = edge / Math.max(src.width, src.height);
    const small = document.createElement("canvas");
    small.width = Math.max(1, Math.round(src.width * scale));
    small.height = Math.max(1, Math.round(src.height * scale));
    small.getContext("2d").drawImage(src, 0, 0, small.width, small.height);
    const out = {};
    for (const p of presets) {
      try {
        const look = presetFilter(p);
        if (!look) {
          out[p] = small.toDataURL("image/jpeg", 0.8);
          continue;
        }
        const img = new FabricImage(small, { filters: [look] });
        img.applyFilters();
        out[p] = img.getElement().toDataURL("image/jpeg", 0.8);
        img.dispose();
      } catch {
        out[p] = null;
      }
    }
    return out;
  }

  // ---------- history ----------

  snapshot() {
    const base = {};
    for (const k of BASE_PROPS) base[k] = this.base?.[k];
    return {
      doc: { ...this.doc },
      base,
      adjust: { ...this.adjust },
      preset: this.preset,
      layers: this.userLayers().map((o) => o.toObject(LAYER_PROPS)),
    };
  }

  pushSnapshot(label) {
    this.history = this.history.slice(0, this.index + 1);
    this.history.push({ label, snap: this.snapshot() });
    if (this.history.length > HISTORY_LIMIT) {
      this.history.shift();
      this.savedIndex -= 1;
    }
    this.index = this.history.length - 1;
  }

  commit(label) {
    if (!this.ready || this.restoring) return;
    clearTimeout(this.commitTimer);
    this.commitTimer = null;
    this.pushSnapshot(label);
    this.notify();
  }

  // Coalesces rapid edits (slider drags, color pickers, typing) into one step.
  commitSoon(label, delay = 400) {
    if (!this.ready || this.restoring) return;
    clearTimeout(this.commitTimer);
    this.pendingLabel = label;
    this.commitTimer = setTimeout(() => this.commit(this.pendingLabel), delay);
  }

  flushCommit() {
    if (this.commitTimer) this.commit(this.pendingLabel);
  }

  async restore(i) {
    const entry = this.history[i];
    const c = this.canvas;
    if (!entry || !c || this.restoring) return;
    clearTimeout(this.commitTimer);
    this.commitTimer = null;
    this.restoring = true;
    this.cancelCrop({ silent: true });
    const { snap } = entry;
    try {
      const layers = await util.enlivenObjects(snap.layers);
      if (!this.canvas) return;
      c.discardActiveObject();
      this.userLayers().forEach((o) => c.remove(o));
      layers.forEach((o) => c.add(o));
      this.base.set(snap.base);
      this.base.setCoords();
      this.doc = { ...snap.doc };
      this.adjust = { ...snap.adjust };
      this.preset = snap.preset;
      this.applyFilters();
      this.syncVignette();
      this.index = i;
      if (this.autoFit) this.fit({ allowUpscale: false });
      this.render();
    } catch (e) {
      console.error("[image-editor.restore]", e);
    } finally {
      this.restoring = false;
      this.notify();
    }
  }

  undo() {
    this.flushCommit();
    if (this.index > 0) return this.restore(this.index - 1);
  }

  redo() {
    if (this.index < this.history.length - 1) return this.restore(this.index + 1);
  }

  jumpTo(i) {
    this.flushCommit();
    if (i !== this.index) return this.restore(i);
  }

  // Back to the opened image as a new, undoable step.
  async resetAll() {
    if (this.index <= 0) return;
    const last = this.index;
    await this.restore(0);
    this.index = last;
    this.pushSnapshot("Reset all");
    this.notify();
  }

  markSaved() {
    this.flushCommit();
    this.savedIndex = this.index;
    this.notify();
  }

  // ---------- view ----------

  fit({ allowUpscale = true } = {}) {
    const c = this.canvas;
    if (!c) return;
    const { width: W, height: H } = this.doc;
    const z = clamp(
      Math.min((c.width - FIT_PADDING * 2) / W, (c.height - FIT_PADDING * 2) / H, allowUpscale ? MAX_ZOOM : 1),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    c.setViewportTransform([z, 0, 0, z, (c.width - W * z) / 2, (c.height - H * z) / 2]);
    this.zoom = z;
    this.autoFit = true;
    this.render();
    this.notify();
  }

  zoomTo(value, point) {
    const c = this.canvas;
    if (!c) return;
    const z = clamp(value, MIN_ZOOM, MAX_ZOOM);
    const at = point ?? new Point(c.width / 2, c.height / 2);
    c.zoomToPoint(at, z);
    this.zoom = z;
    this.autoFit = false;
    this.render();
    this.notify();
  }

  zoomStep(dir) {
    const next =
      dir > 0
        ? ZOOM_STEPS.find((s) => s > this.zoom * 1.01) ?? MAX_ZOOM
        : [...ZOOM_STEPS].reverse().find((s) => s < this.zoom * 0.99) ?? MIN_ZOOM;
    this.zoomTo(next);
  }

  // ---------- tools ----------

  setTool(tool) {
    if (!this.ready) return;
    if (this.tool === tool) return;
    this.flushCommit();
    if (this.tool === "crop") this.cancelCrop({ silent: true });
    this.tool = tool;
    this.applyToolMode();
    if (tool === "crop") this.startCrop();
    this.notify();
  }

  setSpaceHeld(held) {
    if (this.spaceHeld === held) return;
    this.spaceHeld = held;
    this.applyToolMode();
  }

  isPanning() {
    return this.tool === "hand" || this.spaceHeld;
  }

  applyToolMode() {
    const c = this.canvas;
    if (!c) return;
    const panning = this.isPanning();
    const tool = this.tool;
    c.isDrawingMode = tool === "brush" && !panning;
    if (c.isDrawingMode) {
      const brush = c.freeDrawingBrush instanceof PencilBrush ? c.freeDrawingBrush : new PencilBrush(c);
      brush.color = this.color;
      brush.width = this.brushSize;
      brush.decimate = 2;
      c.freeDrawingBrush = brush;
    }
    c.selection = tool === "select" && !panning;
    c.skipTargetFind = panning || ["shape", "brush", "eyedropper"].includes(tool);
    c.defaultCursor = panning
      ? "grab"
      : tool === "text"
        ? "text"
        : ["shape", "crop", "eyedropper"].includes(tool)
          ? "crosshair"
          : "default";
    c.hoverCursor = panning ? "grab" : "move";
    c.setCursor?.(c.defaultCursor);
    if (["shape", "brush", "eyedropper", "hand"].includes(tool) && c.getActiveObject()) {
      c.discardActiveObject();
    }
    this.render();
  }

  setShapeKind(kind) {
    this.shapeKind = kind;
    this.notify();
  }

  setColor(color, { apply = false } = {}) {
    this.color = color;
    if (this.canvas?.freeDrawingBrush) this.canvas.freeDrawingBrush.color = color;
    if (apply) {
      const o = this.canvas?.getActiveObject();
      if (o && !(o instanceof ActiveSelection)) {
        if (o.type === "line" || o.type === "path") this.updateActive({ stroke: color });
        else this.updateActive({ fill: color });
      }
    }
    this.notify();
  }

  setBrushSize(size) {
    this.brushSize = size;
    if (this.canvas?.freeDrawingBrush) this.canvas.freeDrawingBrush.width = size;
    this.notify();
  }

  // ---------- adjustments ----------

  applyFilters() {
    if (!this.base) return;
    const maxEdge = Math.max(this.source?.canvas.width ?? 1, this.source?.canvas.height ?? 1);
    this.base.filters = this.comparing ? [] : buildFilters(this.adjust, this.preset, maxEdge);
    this.base.applyFilters();
    this.render();
  }

  setAdjust(patch, { commitLabel } = {}) {
    this.adjust = { ...this.adjust, ...patch };
    if (!this.filterFrame) {
      this.filterFrame = requestAnimationFrame(() => {
        this.filterFrame = null;
        this.applyFilters();
        this.syncVignette();
      });
    }
    if (commitLabel) this.commitSoon(commitLabel);
    this.notify();
  }

  resetAdjust() {
    this.adjust = { ...DEFAULT_ADJUST };
    this.applyFilters();
    this.syncVignette();
    this.commit("Reset adjustments");
  }

  setPreset(preset, label = preset) {
    if (this.preset === preset) return;
    this.preset = preset;
    this.applyFilters();
    this.commit(`Look: ${label}`);
  }

  syncVignette() {
    const c = this.canvas;
    if (!c) return;
    const amount = (this.adjust.vignette || 0) / 100;
    if (!amount || this.comparing) {
      if (this.vignette) c.remove(this.vignette);
      this.vignette = null;
      this.render();
      return;
    }
    const { width: W, height: H } = this.doc;
    const r = Math.hypot(W, H) / 2;
    const fill = new Gradient({
      type: "radial",
      gradientUnits: "pixels",
      coords: { x1: W / 2, y1: H / 2, r1: r * (0.7 - 0.4 * amount), x2: W / 2, y2: H / 2, r2: r },
      colorStops: [
        { offset: 0, color: "rgba(0,0,0,0)" },
        { offset: 1, color: `rgba(0,0,0,${(0.9 * amount).toFixed(3)})` },
      ],
    });
    if (!this.vignette) {
      this.vignette = new Rect({
        originX: "left",
        originY: "top",
        selectable: false,
        evented: false,
        layerRole: "vignette",
        objectCaching: false,
      });
      c.add(this.vignette);
    }
    this.vignette.set({ left: 0, top: 0, width: W, height: H, fill });
    c.moveObjectTo(this.vignette, 1);
    this.render();
  }

  setComparing(on) {
    if (this.comparing === on || !this.ready) return;
    this.comparing = on;
    const layers = this.userLayers();
    if (on) {
      this.hiddenForCompare = layers.filter((o) => o.visible !== false);
      this.hiddenForCompare.forEach((o) => o.set("visible", false));
    } else {
      (this.hiddenForCompare ?? []).forEach((o) => o.set("visible", true));
      this.hiddenForCompare = null;
    }
    this.applyFilters();
    this.syncVignette();
    this.notify();
  }

  // ---------- document transforms ----------

  transformables() {
    return (this.canvas?.getObjects() ?? []).filter((o) => o.layerRole === "layer" || o.layerRole === "base");
  }

  rotate(dir = 1) {
    if (!this.ready) return;
    this.cancelCrop({ silent: true });
    this.canvas.discardActiveObject();
    const { width: W, height: H } = this.doc;
    const oldC = new Point(W / 2, H / 2);
    const shift = new Point(H / 2, W / 2).subtract(oldC);
    const rad = util.degreesToRadians(90 * dir);
    for (const o of this.transformables()) {
      const center = o.getCenterPoint().rotate(rad, oldC).add(shift);
      o.rotate((((o.angle || 0) + 90 * dir) % 360 + 360) % 360);
      o.setPositionByOrigin(center, "center", "center");
      o.setCoords();
    }
    this.doc = { width: H, height: W };
    this.syncVignette();
    this.fit({ allowUpscale: false });
    this.commit(dir > 0 ? "Rotate right" : "Rotate left");
  }

  flip(axis = "x") {
    if (!this.ready) return;
    this.cancelCrop({ silent: true });
    this.canvas.discardActiveObject();
    const { width: W, height: H } = this.doc;
    for (const o of this.transformables()) {
      const c = o.getCenterPoint();
      const next = axis === "x" ? new Point(W - c.x, c.y) : new Point(c.x, H - c.y);
      o.set(axis === "x" ? { flipX: !o.flipX } : { flipY: !o.flipY });
      o.set("angle", (360 - (o.angle || 0)) % 360);
      o.setPositionByOrigin(next, "center", "center");
      o.setCoords();
    }
    this.render();
    this.commit(axis === "x" ? "Flip horizontal" : "Flip vertical");
  }

  // ---------- crop ----------

  ratioValue(key = this.cropRatio) {
    if (key === "free") return null;
    if (key === "original") return this.source ? this.source.canvas.width / this.source.canvas.height : null;
    const [w, h] = String(key).split(":").map(Number);
    return w && h ? w / h : null;
  }

  fitCropRect(ratio) {
    const { width: W, height: H } = this.doc;
    if (!ratio) return { left: 0, top: 0, width: W, height: H };
    let w = W;
    let h = W / ratio;
    if (h > H) {
      h = H;
      w = H * ratio;
    }
    return { left: (W - w) / 2, top: (H - h) / 2, width: w, height: h };
  }

  startCrop() {
    const c = this.canvas;
    if (!c || this.cropRect) return;
    c.discardActiveObject();
    this.cropEvented = new Map();
    c.getObjects().forEach((o) => {
      this.cropEvented.set(o, o.evented);
      o.evented = false;
    });
    const rect = new Rect({
      ...this.fitCropRect(this.ratioValue()),
      originX: "left",
      originY: "top",
      fill: "transparent",
      strokeWidth: 0,
      layerRole: "crop",
      lockRotation: true,
      lockScalingFlip: true,
      hasBorders: false,
      transparentCorners: false,
      cornerColor: "#ffffff",
      cornerStrokeColor: "rgba(0,0,0,0.6)",
      cornerSize: 12,
      objectCaching: false,
    });
    this.cropRect = rect;
    this.configureCropControls();
    c.add(rect);
    c.setActiveObject(rect);
    this.render();
  }

  configureCropControls() {
    const rect = this.cropRect;
    const c = this.canvas;
    if (!rect || !c) return;
    const locked = this.ratioValue() !== null;
    rect.setControlsVisibility({ mtr: false, ml: !locked, mr: !locked, mt: !locked, mb: !locked });
    this.prevUniform ??= { uniformScaling: c.uniformScaling, uniScaleKey: c.uniScaleKey };
    c.uniformScaling = locked;
    c.uniScaleKey = locked ? null : "shiftKey";
  }

  setCropRatio(key) {
    this.cropRatio = key;
    if (this.cropRect) {
      this.cropRect.set({ ...this.fitCropRect(this.ratioValue()), scaleX: 1, scaleY: 1 });
      this.cropRect.setCoords();
      this.configureCropControls();
      this.render();
    }
    this.notify();
  }

  normalizeCrop() {
    const r = this.cropRect;
    if (!r) return;
    const { width: W, height: H } = this.doc;
    let w = Math.min(r.width * r.scaleX, W);
    let h = Math.min(r.height * r.scaleY, H);
    const ratio = this.ratioValue();
    if (ratio) {
      if (w / h > ratio) w = h * ratio;
      else h = w / ratio;
    }
    w = Math.max(8, w);
    h = Math.max(8, h);
    r.set({
      width: w,
      height: h,
      scaleX: 1,
      scaleY: 1,
      left: clamp(r.left, 0, W - w),
      top: clamp(r.top, 0, H - h),
    });
    r.setCoords();
    this.render();
  }

  endCrop() {
    const c = this.canvas;
    if (!c) return;
    const rect = this.cropRect;
    this.cropRect = null;
    if (rect) {
      c.discardActiveObject();
      c.remove(rect);
    }
    this.cropEvented?.forEach((evented, o) => {
      o.evented = evented;
    });
    this.cropEvented = null;
    if (this.prevUniform) {
      c.uniformScaling = this.prevUniform.uniformScaling;
      c.uniScaleKey = this.prevUniform.uniScaleKey;
      this.prevUniform = null;
    }
  }

  cancelCrop({ silent = false } = {}) {
    if (!this.cropRect) return;
    this.endCrop();
    if (!silent) {
      this.tool = "select";
      this.applyToolMode();
      this.notify();
    }
    this.render();
  }

  applyCrop() {
    const r = this.cropRect;
    if (!r) return;
    this.normalizeCrop();
    const left = Math.round(r.left);
    const top = Math.round(r.top);
    const width = Math.round(r.width);
    const height = Math.round(r.height);
    this.endCrop();
    const { width: W, height: H } = this.doc;
    if (left !== 0 || top !== 0 || width !== W || height !== H) {
      for (const o of this.transformables()) {
        o.set({ left: o.left - left, top: o.top - top });
        o.setCoords();
      }
      this.doc = { width, height };
      this.syncVignette();
      this.fit({ allowUpscale: false });
      this.commit(`Crop ${width}×${height}`);
    }
    this.tool = "select";
    this.applyToolMode();
    this.notify();
  }

  // ---------- layers ----------

  find(id) {
    return this.canvas?.getObjects().find((o) => o.id === id) ?? null;
  }

  minLayerIndex() {
    return this.vignette ? 2 : 1;
  }

  addLayer(obj, label) {
    const c = this.canvas;
    obj.set({ id: obj.id || uid(), layerRole: "layer" });
    c.add(obj);
    c.setActiveObject(obj);
    this.render();
    if (label) this.commit(label);
    else this.notify();
    return obj;
  }

  defaultFontSize() {
    return Math.max(12, Math.round(Math.min(this.doc.width, this.doc.height) * 0.06));
  }

  addText(point, text = "Text") {
    const size = this.defaultFontSize();
    const at = point ?? new Point(this.doc.width / 2, this.doc.height / 2);
    const t = new IText(text, {
      left: at.x,
      top: at.y,
      originX: point ? "left" : "center",
      originY: point ? "top" : "center",
      fontFamily: FONT_FAMILIES[0].value,
      fontSize: size,
      fill: this.color,
      name: "Text",
      editingBorderColor: this.theme.accent,
    });
    this.addLayer(t);
    t.enterEditing();
    t.selectAll();
    this.tool = "select";
    this.applyToolMode();
    this.notify();
  }

  addWatermark({ text, position = "bottom-right", opacity = 0.7 }) {
    if (!this.ready || !text) return;
    const { width: W, height: H } = this.doc;
    const size = Math.max(12, Math.round(Math.min(W, H) * 0.045));
    const m = Math.round(Math.min(W, H) * 0.04);
    const place = {
      "bottom-right": { originX: "right", originY: "bottom", left: W - m, top: H - m },
      "bottom-left": { originX: "left", originY: "bottom", left: m, top: H - m },
      "top-right": { originX: "right", originY: "top", left: W - m, top: m },
      "top-left": { originX: "left", originY: "top", left: m, top: m },
      center: { originX: "center", originY: "center", left: W / 2, top: H / 2 },
    }[position];
    const t = new IText(text, {
      ...place,
      fontFamily: FONT_FAMILIES[0].value,
      fontSize: size,
      fontWeight: "bold",
      fill: "#ffffff",
      opacity,
      shadow: new Shadow({ color: "rgba(0,0,0,0.45)", blur: Math.round(size * 0.35), offsetX: 0, offsetY: 1 }),
      name: "Watermark",
    });
    this.addLayer(t, "Add watermark");
  }

  async placeImage(url, name = "Image") {
    if (!this.ready) return false;
    try {
      const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
      const { width: W, height: H } = this.doc;
      const s = Math.min(1, (W * 0.5) / img.width, (H * 0.5) / img.height);
      img.set({ left: W / 2, top: H / 2, originX: "center", originY: "center", scaleX: s, scaleY: s, name });
      this.addLayer(img, `Place ${name}`);
      return true;
    } catch (e) {
      console.error("[image-editor.place]", e);
      return false;
    }
  }

  placeFile(file) {
    if (!file?.type?.startsWith("image/")) return Promise.resolve(false);
    const url = this.trackObjectUrl(URL.createObjectURL(file));
    return this.placeImage(url, file.name ? file.name.replace(/\.[^.]+$/, "") : "Pasted image");
  }

  select(id) {
    const c = this.canvas;
    const o = this.find(id);
    if (!c) return;
    if (!o || o.layerRole === "base") {
      c.discardActiveObject();
    } else if (!o.locked && o.visible !== false) {
      if (this.tool !== "select") this.setTool("select");
      c.setActiveObject(o);
    }
    this.render();
    this.notify();
  }

  toggleVisible(id) {
    const o = this.find(id);
    if (!o) return;
    o.set("visible", o.visible === false);
    if (o.visible === false && this.canvas.getActiveObject() === o) this.canvas.discardActiveObject();
    this.render();
    this.commit(o.visible === false ? `Hide ${o.name}` : `Show ${o.name}`);
  }

  toggleLock(id) {
    const o = this.find(id);
    if (!o || o.layerRole === "base") return;
    const locked = !o.locked;
    o.set({ locked, selectable: !locked, evented: !locked });
    if (locked && this.canvas.getActiveObject() === o) this.canvas.discardActiveObject();
    this.render();
    this.commit(locked ? `Lock ${o.name}` : `Unlock ${o.name}`);
  }

  rename(id, name) {
    const o = this.find(id);
    const next = String(name || "").trim();
    if (!o || !next || o.name === next) return;
    o.set("name", next);
    this.commit(`Rename to ${next}`);
  }

  activeTargets() {
    const c = this.canvas;
    if (!c) return [];
    return c.getActiveObjects().filter((o) => o.layerRole === "layer");
  }

  removeActive() {
    const c = this.canvas;
    const targets = this.activeTargets();
    if (!targets.length) return;
    c.discardActiveObject();
    targets.forEach((o) => c.remove(o));
    this.render();
    this.commit(targets.length > 1 ? `Delete ${targets.length} layers` : `Delete ${targets[0].name}`);
  }

  removeLayer(id) {
    const o = this.find(id);
    if (!o || o.layerRole !== "layer") return;
    if (this.canvas.getActiveObject() === o) this.canvas.discardActiveObject();
    this.canvas.remove(o);
    this.render();
    this.commit(`Delete ${o.name}`);
  }

  async duplicate(id) {
    const c = this.canvas;
    const src = id ? this.find(id) : this.activeTargets()[0];
    if (!c || !src || src.layerRole !== "layer") return;
    const copy = await src.clone(LAYER_PROPS);
    const offset = Math.round(Math.min(this.doc.width, this.doc.height) * 0.02);
    copy.set({ id: uid(), name: `${src.name} copy`, left: src.left + offset, top: src.top + offset, locked: false, selectable: true, evented: true });
    c.discardActiveObject();
    this.addLayer(copy, `Duplicate ${src.name}`);
  }

  reorder(id, dir) {
    const c = this.canvas;
    const o = id ? this.find(id) : this.activeTargets()[0];
    if (!c || !o || o.layerRole !== "layer") return;
    const min = this.minLayerIndex();
    const max = c.getObjects().length - 1;
    const at = c.getObjects().indexOf(o);
    const target = { up: at + 1, down: at - 1, top: max, bottom: min }[dir];
    const next = clamp(target, min, max);
    if (next === at) return;
    c.moveObjectTo(o, next);
    this.render();
    this.commit(`Arrange ${o.name}`);
  }

  // Panel drag-and-drop: move `id` to the stack slot currently held by `overId`.
  moveLayer(id, overId) {
    const c = this.canvas;
    const o = this.find(id);
    const over = this.find(overId);
    if (!c || !o || !over || o === over || o.layerRole !== "layer") return;
    const index = over.layerRole === "base" ? this.minLayerIndex() : c.getObjects().indexOf(over);
    c.moveObjectTo(o, clamp(index, this.minLayerIndex(), c.getObjects().length - 1));
    this.render();
    this.commit(`Arrange ${o.name}`);
  }

  updateActive(patch, { commitLabel } = {}) {
    const c = this.canvas;
    const o = c?.getActiveObject();
    if (!o) return;
    const targets = o instanceof ActiveSelection ? o.getObjects() : [o];
    for (const t of targets) {
      const set = {};
      if ("opacity" in patch) set.opacity = patch.opacity;
      if ("blend" in patch) set.globalCompositeOperation = patch.blend;
      if ("fill" in patch) set.fill = patch.fill || null;
      if ("stroke" in patch) set.stroke = patch.stroke || null;
      if ("strokeWidth" in patch) set.strokeWidth = Math.max(0, Number(patch.strokeWidth) || 0);
      if ("radius" in patch && t.type === "rect") {
        set.rx = Math.max(0, Number(patch.radius) || 0);
        set.ry = set.rx;
      }
      if (t instanceof IText) {
        if ("fontFamily" in patch) set.fontFamily = patch.fontFamily;
        if ("fontSize" in patch) set.fontSize = Math.max(1, Number(patch.fontSize) || 1);
        if ("bold" in patch) set.fontWeight = patch.bold ? "bold" : "normal";
        if ("italic" in patch) set.fontStyle = patch.italic ? "italic" : "normal";
        if ("underline" in patch) set.underline = Boolean(patch.underline);
        if ("textAlign" in patch) set.textAlign = patch.textAlign;
        if ("charSpacing" in patch) set.charSpacing = Number(patch.charSpacing) || 0;
        if ("lineHeight" in patch) set.lineHeight = Number(patch.lineHeight) || 1;
      }
      if ("shadow" in patch) {
        set.shadow = patch.shadow
          ? new Shadow({ color: "rgba(0,0,0,0.45)", blur: Math.round((t.fontSize || 24) * 0.3), offsetX: 2, offsetY: 3 })
          : null;
      }
      t.set(set);
      if ("angle" in patch) t.rotate(Number(patch.angle) || 0);
      if ("x" in patch || "y" in patch) {
        const box = t.getBoundingRect();
        if ("x" in patch) t.set("left", t.left + (Number(patch.x) - box.left));
        if ("y" in patch) t.set("top", t.top + (Number(patch.y) - box.top));
      }
      if ("width" in patch && t.width) t.set("scaleX", Math.max(1, Number(patch.width)) / t.width);
      if ("height" in patch && t.height) t.set("scaleY", Math.max(1, Number(patch.height)) / t.height);
      t.setCoords();
    }
    if (o instanceof ActiveSelection) o.setCoords();
    this.render();
    if (commitLabel) this.commitSoon(commitLabel);
    this.notify();
  }

  align(where) {
    const targets = this.activeTargets();
    if (!targets.length) return;
    const { width: W, height: H } = this.doc;
    for (const t of targets) {
      const b = t.getBoundingRect();
      const dx = { left: -b.left, center: W / 2 - (b.left + b.width / 2), right: W - (b.left + b.width) }[where];
      const dy = { top: -b.top, middle: H / 2 - (b.top + b.height / 2), bottom: H - (b.top + b.height) }[where];
      if (dx !== undefined) t.set("left", t.left + dx);
      if (dy !== undefined) t.set("top", t.top + dy);
      t.setCoords();
    }
    this.canvas.getActiveObject()?.setCoords();
    this.render();
    this.commit(`Align ${where}`);
  }

  nudge(dx, dy) {
    const targets = this.activeTargets();
    if (!targets.length) return false;
    const o = this.canvas.getActiveObject();
    o.set({ left: o.left + dx, top: o.top + dy });
    o.setCoords();
    this.render();
    this.commitSoon("Nudge");
    this.notify();
    return true;
  }

  isEditingText() {
    const o = this.canvas?.getActiveObject();
    return Boolean(o && o.isEditing);
  }

  // ---------- pointer interaction ----------

  bindEvents() {
    const c = this.canvas;

    c.on("before:render", ({ ctx }) => this.paintUnderlay(ctx));

    c.on("mouse:down", (opt) => {
      const e = opt.e;
      if (!this.ready) return;
      const vp = c.getViewportPoint(e);
      if (this.isPanning()) {
        this.panFrom = vp;
        c.setCursor("grabbing");
        return;
      }
      const sp = c.getScenePoint(e);
      if (this.tool === "text") {
        // Created on mouse:up so the click that places it doesn't end editing.
        this.pendingText = opt.target instanceof IText ? null : sp;
      } else if (this.tool === "shape") {
        this.startShape(sp);
      } else if (this.tool === "eyedropper") {
        this.sample(vp);
      }
    });

    c.on("mouse:move", (opt) => {
      const e = opt.e;
      if (this.panFrom) {
        const vp = c.getViewportPoint(e);
        c.relativePan(new Point(vp.x - this.panFrom.x, vp.y - this.panFrom.y));
        this.panFrom = vp;
        this.autoFit = false;
        return;
      }
      const sp = c.getScenePoint(e);
      if (this.drawing) this.updateShape(sp, e.shiftKey);
      this.onPointer?.(sp.x, sp.y);
    });

    c.on("mouse:up", () => {
      if (this.panFrom) {
        this.panFrom = null;
        c.setCursor(this.isPanning() ? "grab" : c.defaultCursor);
      }
      if (this.drawing) this.finishShape();
      if (this.pendingText) {
        const at = this.pendingText;
        this.pendingText = null;
        this.addText(at);
      }
    });

    c.on("mouse:out", () => this.onPointer?.(null, null));

    c.on("mouse:wheel", (opt) => {
      const e = opt.e;
      e.preventDefault();
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        const next = this.zoom * 0.999 ** e.deltaY;
        this.zoomTo(next, c.getViewportPoint(e));
      } else {
        const dx = e.shiftKey && !e.deltaX ? -e.deltaY : -e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : -e.deltaY;
        c.relativePan(new Point(dx, dy));
        this.autoFit = false;
        this.render();
      }
    });

    c.on("path:created", ({ path }) => {
      path.set({ id: uid(), name: "Brush stroke", layerRole: "layer", strokeUniform: true });
      this.commit("Brush stroke");
    });

    c.on("object:modified", (opt) => {
      const t = opt.target;
      if (!t) return;
      if (t.layerRole === "crop") {
        this.normalizeCrop();
        return;
      }
      const verb = String(opt.action || "").startsWith("scale")
        ? "Scale"
        : opt.action === "rotate"
          ? "Rotate"
          : "Move";
      const name = t instanceof ActiveSelection ? `${t.size()} layers` : t.name || "layer";
      this.commit(`${verb} ${name}`);
    });

    c.on("object:moving", (opt) => {
      const t = opt.target;
      if (t?.layerRole !== "crop") return;
      const { width: W, height: H } = this.doc;
      t.set({
        left: clamp(t.left, 0, W - t.width * t.scaleX),
        top: clamp(t.top, 0, H - t.height * t.scaleY),
      });
    });

    c.on("text:editing:exited", ({ target }) => {
      if (!target) return;
      if (!String(target.text || "").trim()) {
        c.remove(target);
        this.render();
        this.notify();
        return;
      }
      const snippet = target.text.trim().slice(0, 24);
      if (target.name === "Text") target.set("name", snippet);
      this.commit(`Text “${snippet}”`);
    });

    const bump = () => this.notify();
    c.on("selection:created", bump);
    c.on("selection:updated", bump);
    c.on("selection:cleared", () => {
      // Keep the crop frame grabbable after a click on the pasteboard.
      if (this.cropRect) c.setActiveObject(this.cropRect);
      bump();
    });
    c.on("object:scaling", bump);
    c.on("object:rotating", bump);
  }

  startShape(p) {
    const color = this.color;
    const common = { originX: "left", originY: "top", strokeUniform: true, name: "Shape" };
    let shape;
    if (this.shapeKind === "ellipse") {
      shape = new Ellipse({ ...common, left: p.x, top: p.y, rx: 0, ry: 0, fill: color, name: "Ellipse" });
    } else if (this.shapeKind === "line") {
      const w = Math.max(2, Math.round(Math.min(this.doc.width, this.doc.height) * 0.006));
      shape = new Line([p.x, p.y, p.x, p.y], { stroke: color, strokeWidth: w, strokeUniform: true, strokeLineCap: "round", name: "Line" });
    } else {
      shape = new Rect({ ...common, left: p.x, top: p.y, width: 0, height: 0, fill: color, name: "Rectangle" });
    }
    shape.set({ id: uid(), layerRole: "layer" });
    this.drawing = { shape, from: p };
    this.canvas.add(shape);
  }

  updateShape(p, square) {
    const { shape, from } = this.drawing;
    let dx = p.x - from.x;
    let dy = p.y - from.y;
    if (shape instanceof Line) {
      if (square) {
        const snapped = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(dx, dy);
        dx = Math.cos(snapped) * len;
        dy = Math.sin(snapped) * len;
      }
      shape.set({ x2: from.x + dx, y2: from.y + dy });
    } else {
      if (square) {
        const s = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * s;
        dy = Math.sign(dy || 1) * s;
      }
      const left = Math.min(from.x, from.x + dx);
      const top = Math.min(from.y, from.y + dy);
      const w = Math.abs(dx);
      const h = Math.abs(dy);
      if (shape instanceof Ellipse) shape.set({ left, top, rx: w / 2, ry: h / 2 });
      else shape.set({ left, top, width: w, height: h });
    }
    shape.setCoords();
    this.render();
  }

  finishShape() {
    const { shape, from } = this.drawing;
    this.drawing = null;
    const tiny = Math.max(shape.getScaledWidth(), shape.getScaledHeight()) < 4;
    if (tiny) {
      const s = Math.round(Math.min(this.doc.width, this.doc.height) * 0.2);
      if (shape instanceof Line) shape.set({ x2: from.x + s, y2: from.y });
      else if (shape instanceof Ellipse) shape.set({ left: from.x - s / 2, top: from.y - s / 2, rx: s / 2, ry: s / 2 });
      else shape.set({ left: from.x - s / 2, top: from.y - s / 2, width: s, height: s });
      shape.setCoords();
    }
    this.tool = "select";
    this.applyToolMode();
    this.canvas.setActiveObject(shape);
    this.render();
    this.commit(`Add ${shape.name.toLowerCase()}`);
  }

  sample(vp) {
    const c = this.canvas;
    const scene = util.transformPoint(vp, util.invertTransform(c.viewportTransform));
    if (scene.x < 0 || scene.y < 0 || scene.x > this.doc.width || scene.y > this.doc.height) return;
    const dpr = c.getRetinaScaling();
    const ctx = c.getContext();
    const [r, g, b] = ctx.getImageData(Math.round(vp.x * dpr), Math.round(vp.y * dpr), 1, 1).data;
    this.setColor(toHex(r, g, b));
  }

  // ---------- painting ----------

  docScreenRect() {
    const v = this.canvas.viewportTransform;
    return { x: v[4], y: v[5], w: this.doc.width * v[0], h: this.doc.height * v[3] };
  }

  paintUnderlay(ctx) {
    if (this.exporting) {
      if (this.exporting.type === "image/jpeg") {
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
      }
      return;
    }
    if (!this.ready) return;
    if (!this.checker) {
      const tile = document.createElement("canvas");
      tile.width = 16;
      tile.height = 16;
      const t = tile.getContext("2d");
      t.fillStyle = this.theme.checkerA;
      t.fillRect(0, 0, 16, 16);
      t.fillStyle = this.theme.checkerB;
      t.fillRect(0, 0, 8, 8);
      t.fillRect(8, 8, 8, 8);
      this.checker = ctx.createPattern(tile, "repeat");
    }
    const r = this.docScreenRect();
    ctx.save();
    ctx.fillStyle = this.checker;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  paintOverlay(ctx) {
    if (this.exporting || !this.ready) return;
    const c = this.canvas;
    const r = this.docScreenRect();
    ctx.save();
    // Pasteboard: everything outside the artboard.
    ctx.beginPath();
    ctx.rect(0, 0, c.width, c.height);
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = this.theme.pasteboard;
    ctx.fill("evenodd");
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(r.x) - 0.5, Math.round(r.y) - 0.5, Math.round(r.w) + 1, Math.round(r.h) + 1);

    const crop = this.cropRect;
    if (crop) {
      const v = c.viewportTransform;
      const x = v[4] + crop.left * v[0];
      const y = v[5] + crop.top * v[3];
      const w = crop.width * crop.scaleX * v[0];
      const h = crop.height * crop.scaleY * v[3];
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.rect(x, y, w, h);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill("evenodd");
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      for (let i = 1; i < 3; i += 1) {
        ctx.moveTo(x + (w * i) / 3, y);
        ctx.lineTo(x + (w * i) / 3, y + h);
        ctx.moveTo(x, y + (h * i) / 3);
        ctx.lineTo(x + w, y + (h * i) / 3);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- export ----------

  async exportBlob({ type = "image/png", quality = 0.92, width, height } = {}) {
    const c = this.canvas;
    if (!c || !this.ready) return null;
    this.flushCommit();
    const { width: W, height: H } = this.doc;
    const outW = Math.max(1, Math.round(width || W));
    const outH = Math.max(1, Math.round(height || H));
    const multiplier = outW / W;
    const wasComparing = this.comparing;
    if (wasComparing) this.setComparing(false);
    const vp = c.viewportTransform;
    this.exporting = { type };
    let rendered;
    try {
      c.viewportTransform = [1, 0, 0, 1, 0, 0];
      rendered = c.toCanvasElement(multiplier, {
        left: 0,
        top: 0,
        width: W,
        height: H,
        filter: (o) => o.layerRole !== "crop",
      });
    } finally {
      c.viewportTransform = vp;
      c.calcViewportBoundaries();
      this.exporting = null;
      this.render();
    }
    let out = rendered;
    if (rendered.width !== outW || rendered.height !== outH) {
      out = document.createElement("canvas");
      out.width = outW;
      out.height = outH;
      const ctx = out.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(rendered, 0, 0, outW, outH);
    }
    return new Promise((resolve) => {
      try {
        out.toBlob((blob) => resolve(blob), type, quality);
      } catch (e) {
        console.error("[image-editor.export]", e);
        resolve(null);
      }
    });
  }
}
