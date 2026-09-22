import {
  Image,
  Film,
  Music,
  FileText,
  Boxes,
  File,
  HardDrive,
  Gauge,
  Zap,
} from "lucide-react";

export const TYPE_ICONS = {
  image: Image,
  video: Film,
  audio: Music,
  document: FileText,
  "3d": Boxes,
  raw: File,
  pdf: FileText,
  archive: File,
};

export const FILE_TYPE_COLORS = {
  image: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  video: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  audio: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  document: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "3d": "bg-rose-500/15 text-rose-300 border-rose-500/30",
  raw: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  archive: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
  pdf: "bg-red-500/15 text-red-300 border-red-500/30",
};

export const STATUS_META = {
  queued: {
    variant: "neutral",
    label: "Queued",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
  uploading: {
    variant: "info",
    label: "Uploading",
    className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    dotClass: "bg-blue-400",
  },
  processing: {
    variant: "purple",
    label: "Processing",
    className: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    dotClass: "bg-violet-400",
  },
  completed: {
    variant: "success",
    label: "Completed",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },

  complete: {
    variant: "success",
    label: "Completed",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  failed: {
    variant: "danger",
    label: "Failed",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
    dotClass: "bg-red-400",
  },
};

export const SOURCE_LABELS = {
  "drag-drop": "Drag & Drop",
  folder: "Folder",
  zip: "ZIP Archive",
  cloud: "Cloud Import",
  url: "Remote URL",
};

export const TYPE_OPTIONS = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Document" },
  { value: "pdf", label: "PDF" },
  { value: "3d", label: "3D Model" },
  { value: "raw", label: "Raw" },
  { value: "archive", label: "Archive" },
];

export const STATUS_OPTIONS = [
  { value: "queued", label: "Queued" },
  { value: "uploading", label: "Uploading" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

export const SOURCE_OPTIONS = [
  { value: "drag-drop", label: "Drag & Drop" },
  { value: "folder", label: "Folder" },
  { value: "zip", label: "ZIP Archive" },
  { value: "cloud", label: "Cloud Import" },
  { value: "url", label: "Remote URL" },
];

export const STATUS_FILTER_OPTIONS = [{ value: "all", label: "All Statuses" }, ...STATUS_OPTIONS];
export const SOURCE_FILTER_OPTIONS = [{ value: "all", label: "All Sources" }, ...SOURCE_OPTIONS];

export const SORT_OPTIONS = [
  { value: "created-desc", label: "Newest First" },
  { value: "created-asc", label: "Oldest First" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "size-desc", label: "Largest Size" },
  { value: "size-asc", label: "Smallest Size" },
  { value: "progress-desc", label: "Most Progress" },
];

export const QUALITY_PRESETS = [
  { value: "original", label: "Original", icon: HardDrive, desc: "Lossless — files are stored exactly as uploaded." },
  { value: "web", label: "Web", icon: Gauge, desc: "Re-encodes stills to WebP — balanced size and quality." },
  { value: "compressed", label: "Compressed", icon: Zap, desc: "Smallest files — AVIF with a WebP fallback." },
];

export { formatBytes, formatDate } from "@/lib/format";
