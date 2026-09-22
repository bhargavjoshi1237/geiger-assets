export const STORAGE_META = {
  hot: {
    variant: "success",
    label: "Hot",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  cold: {
    variant: "info",
    label: "Cold",
    className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    dotClass: "bg-blue-400",
  },
  "cloud-s3": {
    variant: "warning",
    label: "Cloud · S3",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  "cloud-gcs": {
    variant: "purple",
    label: "Cloud · GCS",
    className: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    dotClass: "bg-violet-400",
  },
};

export const STORAGE_OPTIONS = [
  { value: "hot", label: "Hot" },
  { value: "cold", label: "Cold" },
  { value: "cloud-s3", label: "Cloud · S3" },
  { value: "cloud-gcs", label: "Cloud · GCS" },
];

export const STORAGE_FILTER_OPTIONS = [
  { value: "all", label: "All Storage" },
  ...STORAGE_OPTIONS,
];

export const FOLDER_COLORS = [
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#737373",
];

export { formatBytes, formatDate } from "@/lib/format";
