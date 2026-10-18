import {
  Circle,
  Crop,
  Hand,
  Minus,
  MousePointer2,
  Paintbrush,
  Pipette,
  Square,
  Type,
} from "lucide-react";

// Longest edge the editor works at. Larger sources are downscaled on load so
// WebGL filtering stays inside the GPU texture budget.
export const MAX_WORKING_EDGE = 4096;

export const HISTORY_LIMIT = 60;

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 32;
export const ZOOM_STEPS = [0.05, 0.1, 0.25, 0.33, 0.5, 0.67, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 32];

export const TOOLS = [
  { value: "select", label: "Move", icon: MousePointer2, shortcut: "V", hint: "Select, move, scale and rotate layers." },
  { value: "hand", label: "Hand", icon: Hand, shortcut: "H", hint: "Drag to pan. Hold Space with any tool." },
  { value: "crop", label: "Crop", icon: Crop, shortcut: "C", hint: "Drag the frame, then press Enter to apply." },
  { value: "text", label: "Text", icon: Type, shortcut: "T", hint: "Click the canvas to add text." },
  { value: "shape", label: "Shape", icon: Square, shortcut: "U", hint: "Drag on the canvas to draw a shape." },
  { value: "brush", label: "Brush", icon: Paintbrush, shortcut: "B", hint: "Paint freehand strokes." },
  { value: "eyedropper", label: "Eyedropper", icon: Pipette, shortcut: "I", hint: "Click to sample a color." },
];

export const TOOL_BY_SHORTCUT = Object.fromEntries(
  TOOLS.map((t) => [t.shortcut.toLowerCase(), t.value]),
);

export const SHAPE_KINDS = [
  { value: "rect", label: "Rectangle", icon: Square },
  { value: "ellipse", label: "Ellipse", icon: Circle },
  { value: "line", label: "Line", icon: Minus },
];

export const CROP_RATIOS = [
  { value: "free", label: "Free", ratio: null },
  { value: "original", label: "Original", ratio: "original" },
  { value: "1:1", label: "1:1", ratio: 1 },
  { value: "4:5", label: "4:5", ratio: 4 / 5 },
  { value: "3:2", label: "3:2", ratio: 3 / 2 },
  { value: "16:9", label: "16:9", ratio: 16 / 9 },
  { value: "9:16", label: "9:16", ratio: 9 / 16 },
];

// Slider ranges are UI units; engine.js maps them onto Fabric filter values.
export const ADJUSTMENTS = [
  { group: "Light", key: "exposure", label: "Exposure", min: -100, max: 100 },
  { group: "Light", key: "brightness", label: "Brightness", min: -100, max: 100 },
  { group: "Light", key: "contrast", label: "Contrast", min: -100, max: 100 },
  { group: "Color", key: "saturation", label: "Saturation", min: -100, max: 100 },
  { group: "Color", key: "vibrance", label: "Vibrance", min: -100, max: 100 },
  { group: "Color", key: "warmth", label: "Temperature", min: -100, max: 100 },
  { group: "Color", key: "tint", label: "Tint", min: -100, max: 100 },
  { group: "Color", key: "hue", label: "Hue", min: -180, max: 180, unit: "°" },
  { group: "Detail", key: "sharpen", label: "Sharpen", min: 0, max: 100 },
  { group: "Detail", key: "blur", label: "Blur", min: 0, max: 100 },
  { group: "Detail", key: "grain", label: "Grain", min: 0, max: 100 },
  { group: "Detail", key: "pixelate", label: "Pixelate", min: 0, max: 100 },
  { group: "Detail", key: "vignette", label: "Vignette", min: 0, max: 100 },
];

export const ADJUSTMENT_GROUPS = ["Light", "Color", "Detail"];

export const DEFAULT_ADJUST = Object.fromEntries(ADJUSTMENTS.map((a) => [a.key, 0]));

export const FILTER_PRESETS = [
  { value: "none", label: "Original" },
  { value: "grayscale", label: "Mono" },
  { value: "blackwhite", label: "Noir" },
  { value: "sepia", label: "Sepia" },
  { value: "vintage", label: "Vintage" },
  { value: "kodachrome", label: "Kodachrome" },
  { value: "technicolor", label: "Technicolor" },
  { value: "polaroid", label: "Polaroid" },
  { value: "brownie", label: "Brownie" },
  { value: "invert", label: "Invert" },
];

export const BLEND_MODES = [
  { value: "source-over", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color dodge" },
  { value: "color-burn", label: "Color burn" },
  { value: "hard-light", label: "Hard light" },
  { value: "soft-light", label: "Soft light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue" },
  { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosity" },
];

export const FONT_FAMILIES = [
  { value: "Inter, system-ui, sans-serif", label: "Inter" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times" },
  { value: "'Courier New', monospace", label: "Courier" },
  { value: "Impact, 'Arial Black', sans-serif", label: "Impact" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet" },
  { value: "Verdana, sans-serif", label: "Verdana" },
];

export const WATERMARK_POSITIONS = [
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
  { value: "center", label: "Center" },
];

export const EXPORT_FORMATS = [
  { value: "image/webp", label: "WebP", ext: "webp", lossy: true },
  { value: "image/jpeg", label: "JPEG", ext: "jpg", lossy: true },
  { value: "image/png", label: "PNG", ext: "png", lossy: false },
];

export const SAVE_TARGETS = [
  { value: "asset", label: "New asset" },
  { value: "version", label: "New version" },
  { value: "download", label: "Download" },
];

export const SHORTCUT_GROUPS = [
  {
    group: "Tools",
    items: TOOLS.map((t) => ({ keys: [t.shortcut], label: t.label })),
  },
  {
    group: "Edit",
    items: [
      { keys: ["Ctrl", "Z"], label: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], label: "Redo" },
      { keys: ["Ctrl", "J"], label: "Duplicate layer" },
      { keys: ["Del"], label: "Delete layer" },
      { keys: ["Ctrl", "]"], label: "Bring forward" },
      { keys: ["Ctrl", "["], label: "Send backward" },
      { keys: ["Ctrl", "S"], label: "Save" },
    ],
  },
  {
    group: "View",
    items: [
      { keys: ["Space"], label: "Pan (hold)" },
      { keys: ["\\"], label: "Compare with original (hold)" },
      { keys: ["Ctrl", "0"], label: "Fit to screen" },
      { keys: ["Ctrl", "1"], label: "Actual pixels" },
      { keys: ["Ctrl", "+"], label: "Zoom in" },
      { keys: ["Ctrl", "−"], label: "Zoom out" },
      { keys: ["Enter"], label: "Apply crop" },
      { keys: ["Esc"], label: "Cancel crop / deselect" },
    ],
  },
];

export function formatZoom(zoom) {
  return `${Math.round((zoom || 0) * 100)}%`;
}

export function baseName(name) {
  return String(name || "image").replace(/\.[a-z0-9]{2,5}$/i, "");
}
