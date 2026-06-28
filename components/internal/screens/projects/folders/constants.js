// Lookups, filter options, and formatters for the Folders & Storage screens.
// Config only — never row data (that lives in the DB via lib/supabase/folders.js).

export const STORAGE_META = {
  hot: {
    label: "Hot",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  cold: {
    label: "Cold",
    className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    dotClass: "bg-blue-400",
  },
  "cloud-s3": {
    label: "Cloud · S3",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  "cloud-gcs": {
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

// Preset folder accent colors (data-driven hex accents).
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
