// Lookups, filter options, and formatters shared by the nine media screens.
// Config only — never row data (rows come from lib/supabase/assets.js and
// lib/supabase/media_screens.js).

export const MEDIA_ASSET_STATUS_MAP = {
  approved: { label: "Approved", variant: "success", dotClass: "bg-emerald-400" },
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  review: { label: "In Review", variant: "warning", dotClass: "bg-amber-400" },
  processing: { label: "Processing", variant: "info", dotClass: "bg-sky-400" },
  archived: { label: "Archived", variant: "neutral", dotClass: "bg-zinc-500" },
};

export const MEDIA_ASSET_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "approved", label: "Approved" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "In Review" },
  { value: "processing", label: "Processing" },
  { value: "archived", label: "Archived" },
];

export const MEDIA_JOB_STATUS_MAP = {
  queued: { label: "Queued", variant: "warning", dotClass: "bg-amber-400" },
  processing: { label: "Processing", variant: "info", dotClass: "bg-sky-400" },
  ready: { label: "Ready", variant: "success", dotClass: "bg-emerald-400" },
  failed: { label: "Failed", variant: "danger", dotClass: "bg-red-400" },
};

export const MEDIA_JOB_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All job states" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
];

export const TRANSCRIPT_STATUS_MAP = {
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  processing: { label: "Processing", variant: "info", dotClass: "bg-sky-400" },
  ready: { label: "Ready", variant: "success", dotClass: "bg-emerald-400" },
  needs_review: { label: "Needs review", variant: "warning", dotClass: "bg-amber-400" },
};

export const TRANSCRIPT_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All transcript states" },
  { value: "draft", label: "Draft" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "needs_review", label: "Needs review" },
];

export const TRANSCRIPT_KIND_MAP = {
  caption: { label: "Caption", variant: "info", dotClass: "bg-sky-400" },
  subtitle: { label: "Subtitle", variant: "purple", dotClass: "bg-violet-400" },
  transcript: { label: "Transcript", variant: "success", dotClass: "bg-emerald-400" },
  ocr: { label: "OCR", variant: "warning", dotClass: "bg-amber-400" },
};

export const ANNOTATION_KIND_MAP = {
  focal_point: { label: "Focal point", variant: "info", dotClass: "bg-sky-400" },
  frame_comment: { label: "Frame comment", variant: "purple", dotClass: "bg-violet-400" },
  annotation: { label: "Annotation", variant: "warning", dotClass: "bg-amber-400" },
  watermark: { label: "Watermark", variant: "neutral", dotClass: "bg-zinc-400" },
  clip: { label: "Clip mark", variant: "success", dotClass: "bg-emerald-400" },
  reference: { label: "Reference", variant: "info", dotClass: "bg-sky-400" },
};

export const ORIENTATION_FILTER_OPTIONS = [
  { value: "all", label: "All orientations" },
  { value: "landscape", label: "Landscape" },
  { value: "portrait", label: "Portrait" },
  { value: "square", label: "Square" },
];

export const DOCUMENT_KIND_FILTER_OPTIONS = [
  { value: "all", label: "All documents" },
  { value: "pdf", label: "PDF" },
  { value: "document", label: "Office docs" },
];

export const DESIGN_KIND_FILTER_OPTIONS = [
  { value: "all", label: "All design files" },
  { value: "design", label: "Design (PSD / AI / Figma)" },
  { value: "raw", label: "Camera RAW" },
  { value: "font", label: "Fonts" },
];

export const MODEL_FORMAT_FILTER_OPTIONS = [
  { value: "all", label: "All formats" },
  { value: "GLB", label: "GLB" },
  { value: "GLTF", label: "glTF" },
  { value: "OBJ", label: "OBJ" },
  { value: "FBX", label: "FBX" },
  { value: "USDZ", label: "USDZ" },
];

export const IMAGE_OPERATION_OPTIONS = [
  { value: "crop", label: "Crop" },
  { value: "resize", label: "Resize" },
  { value: "rotate", label: "Rotate" },
  { value: "color", label: "Colour adjust" },
  { value: "annotate", label: "Annotate" },
  { value: "watermark", label: "Watermark" },
  { value: "smart_crop", label: "Smart crop" },
];

export const VIDEO_OPERATION_OPTIONS = [
  { value: "trim", label: "Trim" },
  { value: "clip", label: "Clip" },
  { value: "transcode", label: "Transcode" },
  { value: "poster", label: "Poster frame" },
  { value: "hls", label: "Adaptive (HLS)" },
  { value: "convert", label: "Format convert" },
];

export const RENDITION_OPERATION_OPTIONS = [
  { value: "preset", label: "Preset rendition" },
  { value: "convert", label: "Format conversion" },
  { value: "compress", label: "Compression" },
  { value: "responsive_set", label: "Responsive set" },
];

export const VIDEO_PRESET_OPTIONS = [
  { value: "1080p", label: "1080p H.264" },
  { value: "720p", label: "720p H.264" },
  { value: "480p", label: "480p H.264" },
  { value: "hevc", label: "HEVC master" },
  { value: "webm", label: "WebM fallback" },
];

// Mirrors VARIANTS in lib/media/derive.js without importing it: derive.js is
// server-only (it throws in the browser), so the client keeps this copy — the
// same reason lib/storage/client.js duplicates VARIANT_NAMES.
export const RENDITION_PRESETS = [
  { name: "thumb", label: "Thumb", width: 256, height: 256, quality: 70, format: "webp", hint: "Grid cells at 2x retina" },
  { name: "preview", label: "Preview", width: 1024, height: 1024, quality: 78, format: "webp", hint: "Detail pane and list preview" },
  { name: "poster", label: "Poster", width: 1920, height: 1920, quality: 80, format: "webp", hint: "Lightbox and social poster" },
];

export const DESIGN_FORMATS = ["PSD", "AI", "FIG", "SKETCH", "SVG", "EPS", "INDD", "XD", "PSB"];
export const FONT_FORMATS = ["TTF", "OTF", "WOFF", "WOFF2", "EOT"];
export const RAW_FORMATS = ["DNG", "ARW", "CR2", "CR3", "NEF", "RAF", "RW2", "ORF"];

export const DOCUMENT_TYPES = ["document", "pdf"];

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDuration(totalSeconds) {
  const n = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatTimestamp(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined || totalSeconds === "") return "—";
  return formatDuration(totalSeconds);
}

export function parseDimensions(dimensions) {
  if (!dimensions || typeof dimensions !== "string") return null;
  const m = dimensions.replace(/,/g, "").match(/(\d+)\s*[×xX]\s*(\d+)/);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

export function orientationOf(asset) {
  const parsed = parseDimensions(asset?.dimensions);
  if (!parsed) return "unknown";
  if (parsed.width === parsed.height) return "square";
  return parsed.width > parsed.height ? "landscape" : "portrait";
}

export function isDesignAsset(asset) {
  if (!asset) return false;
  if (asset.type === "raw") return true;
  const format = String(asset.format || "").toUpperCase();
  return DESIGN_FORMATS.includes(format) || FONT_FORMATS.includes(format) || RAW_FORMATS.includes(format);
}

export function designKindOf(asset) {
  if (!asset) return "design";
  if (asset.type === "raw") return "raw";
  const format = String(asset.format || "").toUpperCase();
  if (FONT_FORMATS.includes(format)) return "font";
  if (RAW_FORMATS.includes(format)) return "raw";
  return "design";
}

// Honest transcode readout: the pipeline has no ffmpeg here, so the screen
// reports whatever the row's metadata recorded and "unknown" otherwise — it
// never invents a progress percentage.
export function transcodeStateOf(asset) {
  const raw = asset?.transcodeStatus || asset?.metadata?.transcodeStatus || asset?.storageStatus || "";
  const value = String(raw || "").toLowerCase();
  if (["ready", "done", "complete", "completed"].includes(value)) return "ready";
  if (["processing", "transcoding", "queued", "pending"].includes(value)) return value === "pending" ? "queued" : value;
  if (["failed", "error"].includes(value)) return "failed";
  return "unknown";
}

export function ocrStateOf(asset, transcripts = []) {
  const hit = (transcripts || []).find((t) => t.assetId === asset?.id && t.kind === "ocr");
  if (hit) return hit.status || "ready";
  const raw = String(asset?.ocrStatus || asset?.metadata?.ocrStatus || "").toLowerCase();
  if (raw) return raw;
  return "unknown";
}
