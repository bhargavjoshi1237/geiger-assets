"use client";

import { FileText, Film, Music, Image as ImageIcon, Boxes, File } from "lucide-react";

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function parseDimensions(dimensions) {
  if (!dimensions || typeof dimensions !== "string") return null;
  const match = dimensions.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function getOrientation(asset) {
  const parsed = parseDimensions(asset?.dimensions);
  if (!parsed) return "unknown";
  if (parsed.width > parsed.height) return "landscape";
  if (parsed.height > parsed.width) return "portrait";
  return "square";
}

export function orientationLabel(value) {
  if (value === "landscape") return "Landscape";
  if (value === "portrait") return "Portrait";
  if (value === "square") return "Square";
  return "Unknown";
}

export function assetExtension(asset) {
  const fromFormat = String(asset?.format || "").toLowerCase().replace(/^\./, "");
  if (fromFormat) return fromFormat;
  const name = String(asset?.name || "");
  const parts = name.split(".");
  if (parts.length > 1) return parts.pop().toLowerCase();
  return "";
}

export function isImageAsset(a) {
  return a?.type === "image";
}

export function isVideoAsset(a) {
  return a?.type === "video";
}

export function isAudioAsset(a) {
  return a?.type === "audio";
}

export function isDocumentAsset(a) {
  return a?.type === "document" || a?.type === "pdf";
}

export function is3DAsset(a) {
  return a?.type === "3d";
}

const DESIGN_EXTENSIONS = new Set([
  "psd", "psb", "ai", "eps", "indd", "fig", "sketch", "xd", "afdesign", "afphoto",
  "dng", "cr2", "cr3", "nef", "arw", "orf", "rw2", "raw", "svg", "otf", "ttf", "woff", "woff2",
]);

const VIDEO_EDITABLE_EXT = new Set(["mp4", "mov", "webm", "mkv", "m4v"]);

export function isDesignAsset(a) {
  if (!a) return false;
  if (a.type === "raw") return true;
  const ext = assetExtension(a);
  if (DESIGN_EXTENSIONS.has(ext)) return true;
  const fmt = String(a.format || "").toLowerCase();
  if (["psd", "ai", "figma", "sketch", "raw", "font"].includes(fmt)) return true;
  return false;
}

export function designToolOf(asset) {
  const ext = assetExtension(asset);
  if (["psd", "psb"].includes(ext)) return "Photoshop";
  if (["ai", "eps"].includes(ext)) return "Illustrator";
  if (["indd"].includes(ext)) return "InDesign";
  if (["fig"].includes(ext) || String(asset?.format || "").toLowerCase() === "figma") return "Figma";
  if (["sketch"].includes(ext)) return "Sketch";
  if (["xd"].includes(ext)) return "Adobe XD";
  if (["svg"].includes(ext)) return "Vector / SVG";
  if (["otf", "ttf", "woff", "woff2"].includes(ext)) return "Font";
  if (["dng", "cr2", "cr3", "nef", "arw", "orf", "rw2", "raw"].includes(ext)) return "Camera RAW";
  if (asset?.type === "raw") return "RAW source";
  return "Design source";
}

export function threeDFormatOf(asset) {
  const ext = assetExtension(asset);
  if (["glb", "gltf", "obj", "fbx", "usdz", "stl", "blend"].includes(ext)) return ext.toUpperCase();
  const fmt = String(asset?.format || "").toUpperCase();
  return fmt || "3D";
}

export function mockDurationSeconds(asset) {
  const id = String(asset?.id || asset?.name || "x");
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 9973;
  if (asset?.type === "audio") return 45 + (hash % 3200);
  return 12 + (hash % 3600);
}

export function mockPageCount(asset) {
  const id = String(asset?.id || asset?.name || "x");
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 17 + id.charCodeAt(i)) % 251;
  return 1 + (hash % 48);
}

export function mockWaveform(asset, bars = 48) {
  const id = String(asset?.id || asset?.name || "wave");
  let seed = 0;
  for (let i = 0; i < id.length; i += 1) seed = (seed * 33 + id.charCodeAt(i)) % 100000;
  const out = [];
  let v = seed % 100;
  for (let i = 0; i < bars; i += 1) {
    v = (v * 1103515245 + 12345) % 100000;
    out.push(12 + (v % 88));
  }
  return out;
}

export function mockTranscript(asset) {
  const duration = mockDurationSeconds(asset);
  const name = asset?.name || "Untitled";
  return [
    { t: 0, speaker: "Speaker 1", text: `Opening segment of ${name}. Overview of the key message and context.` },
    { t: Math.round(duration * 0.25), speaker: "Speaker 2", text: "Main talking points, product details, and supporting narrative for the edit." },
    { t: Math.round(duration * 0.55), speaker: "Speaker 1", text: "Demonstration section with descriptive narration that captions can reuse verbatim." },
    { t: Math.round(duration * 0.8), speaker: "Speaker 2", text: "Closing summary and call to action. Names, dates, and keywords are spelled out here." },
  ];
}

export function mockOcrText(asset) {
  const name = asset?.name || "document";
  return [
    `Document: ${name}`,
    "Extracted text layer with headings, body copy, tables, and captions preserved in reading order.",
    "Keywords: contract, invoice total, effective date, deliverables, payment terms, signatory.",
    "Page 1 holds the title block and summary. Following pages hold clauses, figures, and appendices.",
  ].join("\n\n");
}

export function transcriptStatusOf(asset) {
  const id = String(asset?.id || "");
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 29 + id.charCodeAt(i)) % 7;
  if (hash <= 2) return "ready";
  if (hash === 3) return "processing";
  if (hash === 4) return "draft";
  return "none";
}

export function ocrStatusOf(asset) {
  const id = String(asset?.id || "");
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 5;
  if (hash <= 2) return "ready";
  if (hash === 3) return "processing";
  return "none";
}

export const TRANSCRIPT_META = {
  ready: { label: "Transcribed", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  processing: { label: "Transcribing", className: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  draft: { label: "Draft", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  none: { label: "No transcript", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30" },
};

export const OCR_META = {
  ready: { label: "OCR complete", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  processing: { label: "OCR running", className: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  none: { label: "No OCR", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30" },
};

export const RENDITION_PRESETS = [
  { id: "thumb-sm", label: "Thumbnail S", width: 256, height: 256, format: "WebP", quality: 72, use: "Grids, pickers" },
  { id: "thumb-lg", label: "Preview L", width: 1024, height: 1024, format: "WebP", quality: 78, use: "Quick view" },
  { id: "social-square", label: "Social square", width: 1080, height: 1080, format: "JPEG", quality: 82, use: "Instagram" },
  { id: "social-story", label: "Story 9:16", width: 1080, height: 1920, format: "JPEG", quality: 80, use: "Stories, reels cover" },
  { id: "banner-wide", label: "Banner 21:9", width: 2100, height: 900, format: "WebP", quality: 78, use: "Hero, portal" },
  { id: "print-xl", label: "Print XL", width: 3300, height: 3300, format: "JPEG", quality: 92, use: "High-res export" },
];

export const VIDEO_OUTPUT_PRESETS = [
  { id: "h264-720p", label: "H.264 · 720p", desc: "Fast review and sharing" },
  { id: "h264-1080p", label: "H.264 · 1080p", desc: "Default delivery" },
  { id: "hevc-1080p", label: "HEVC · 1080p", desc: "Smaller file, modern players" },
  { id: "webm-720p", label: "WebM · 720p", desc: "Web embed" },
  { id: "gif-preview", label: "GIF preview", desc: "6s looping teaser" },
];

export const MEDIA_ICON_BY_TYPE = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
  pdf: FileText,
  "3d": Boxes,
  raw: File,
  archive: File,
};

export function isVideoPlayable(asset) {
  return VIDEO_EDITABLE_EXT.has(assetExtension(asset)) || asset?.type === "video";
}

export { formatBytes, formatDate, formatDateTime } from "@/lib/format";
