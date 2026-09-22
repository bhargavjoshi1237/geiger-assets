export {
  DEFAULT_ASSET_COLOR,
  TYPE_ICONS,
  FILE_TYPE_COLORS,
  assetTypeIcon,
} from "@/components/internal/shared/asset_meta";

export const STATUS_META = {
  approved: {
    variant: "success",
    label: "Approved",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  draft: {
    variant: "neutral",
    label: "Draft",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
  review: {
    variant: "warning",
    label: "In Review",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  archived: {
    variant: "neutral",
    label: "Archived",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-500",
  },
  processing: {
    variant: "info",
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

export const STORAGE_STATUS_META = {
  none: { label: "No file", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30" },
  pending: { label: "Pending", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  stored: { label: "Stored", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  failed: { label: "Failed", className: "bg-red-500/15 text-red-300 border-red-500/30" },
};

export function normalizeTag(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export { formatBytes, formatDate, formatDateTime } from "@/lib/format";
