export const ASSET_TYPE_OPTIONS = [
  { value: "all", label: "All asset types" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Documents" },
  { value: "pdf", label: "PDFs" },
  { value: "raw", label: "Raw files" },
  { value: "3d", label: "3D files" },
  { value: "archive", label: "Archives" },
];

export const RETENTION_ACTION_OPTIONS = [
  { value: "archive", label: "Move to archive" },
  { value: "trash", label: "Move to trash" },
];

export const HOLD_STATUS_MAP = {
  active: { label: "Active", variant: "success" },
  released: { label: "Released", variant: "muted" },
};

export function formatGovernanceDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatGovernanceDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
