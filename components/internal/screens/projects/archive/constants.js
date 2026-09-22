export {
  TYPE_ICONS,
  FILE_TYPE_COLORS,
  STATUS_META,
  formatBytes,
  formatDate,
} from "@/components/internal/screens/projects/library/constants";

export const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Document" },
  { value: "pdf", label: "PDF" },
  { value: "3d", label: "3D Model" },
  { value: "raw", label: "Raw" },
  { value: "archive", label: "Archive" },
];

export const SORT_OPTIONS = [
  { value: "date-desc", label: "Newest First" },
  { value: "date-asc", label: "Oldest First" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "size-desc", label: "Largest Size" },
  { value: "size-asc", label: "Smallest Size" },
];
