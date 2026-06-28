// Lookups, filter options, and formatters for the asset library + edit screens.
// Config only — never row data (that lives in the DB via lib/supabase/assets.js).

import { Image, Film, Music, FileText, Boxes, File } from "lucide-react";

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
  approved: {
    label: "Approved",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  draft: {
    label: "Draft",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
  review: {
    label: "In Review",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  archived: {
    label: "Archived",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-500",
  },
  processing: {
    label: "Processing",
    className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    dotClass: "bg-blue-400",
  },
};

export const RELATION_META = {
  parent: { label: "Parent", className: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  child: { label: "Child", className: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  derived: { label: "Derived", className: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  variant: { label: "Variant", className: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30" },
  source: { label: "Source", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  campaign: { label: "Campaign", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  product: { label: "Product", className: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
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
  { value: "approved", label: "Approved" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "In Review" },
  { value: "processing", label: "Processing" },
  { value: "archived", label: "Archived" },
];

export const RELATION_OPTIONS = [
  { value: "parent", label: "Parent" },
  { value: "child", label: "Child" },
  { value: "derived", label: "Derived" },
  { value: "variant", label: "Variant" },
  { value: "source", label: "Source" },
  { value: "campaign", label: "Campaign" },
  { value: "product", label: "Product" },
];

export const TYPE_FILTER_OPTIONS = [{ value: "all", label: "All Types" }, ...TYPE_OPTIONS];
export const STATUS_FILTER_OPTIONS = [{ value: "all", label: "All Statuses" }, ...STATUS_OPTIONS];

export const SORT_OPTIONS = [
  { value: "modified-desc", label: "Last Modified" },
  { value: "modified-asc", label: "Oldest Modified" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "size-desc", label: "Largest Size" },
  { value: "size-asc", label: "Smallest Size" },
  { value: "downloads-desc", label: "Most Downloaded" },
];

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / Math.pow(1024, i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
