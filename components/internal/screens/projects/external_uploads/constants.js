export const PORTAL_STATUS_META = {
  active: {
    variant: "success",
    label: "Active",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  paused: {
    variant: "warning",
    label: "Paused",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  expired: {
    variant: "neutral",
    label: "Expired",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
};

export const SUBMISSION_STATUS_META = {
  pending: {
    variant: "warning",
    label: "Pending",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  approved: {
    variant: "success",
    label: "Approved",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  rejected: {
    variant: "danger",
    label: "Rejected",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
    dotClass: "bg-red-400",
  },
};

export const TYPE_LABELS = {
  link: "Upload Link",
  form: "Upload Form",
};

export const TYPE_BADGE_COLORS = {
  link: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  form: "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

export const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "expired", label: "Expired" },
];

export const TYPE_OPTIONS = [
  { value: "link", label: "Upload Link" },
  { value: "form", label: "Upload Form" },
];

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  ...STATUS_OPTIONS,
];

export const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All Types" },
  ...TYPE_OPTIONS,
];

export const SORT_OPTIONS = [
  { value: "updated-desc", label: "Last Updated" },
  { value: "updated-asc", label: "Oldest Updated" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "submissions-desc", label: "Most Submissions" },
];

export function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const REMOTE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "uploading", label: "Importing" },
  { value: "completed", label: "Imported" },
  { value: "failed", label: "Failed" },
];

export const REMOTE_SORT_OPTIONS = [
  { value: "created-desc", label: "Newest First" },
  { value: "created-asc", label: "Oldest First" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "size-desc", label: "Largest Size" },
];

const EXTENSION_TYPES = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image",
  svg: "image", avif: "image", bmp: "image", tif: "image", tiff: "image",
  heic: "image", psd: "image",
  mp4: "video", mov: "video", webm: "video", mkv: "video", avi: "video",
  mp3: "audio", wav: "audio", flac: "audio", ogg: "audio", m4a: "audio",
  pdf: "pdf",
  doc: "document", docx: "document", txt: "document", md: "document",
  csv: "document", xls: "document", xlsx: "document", ppt: "document",
  pptx: "document",
  glb: "3d", gltf: "3d", obj: "3d", fbx: "3d", usdz: "3d", stl: "3d",
  arw: "raw", cr2: "raw", cr3: "raw", nef: "raw", dng: "raw",
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
};

export function normalizeLink(value) {
  let raw = String(value ?? "").trim();
  if (!raw) return "";
  raw = raw.replace(/^["'<(]+/, "").replace(/["'>),.;]+$/, "");
  if (/^\/\//.test(raw)) raw = `https:${raw}`;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(raw) && /^[\w-]+(\.[\w-]+)+\//.test(raw)) {
    raw = `https://${raw}`;
  }
  return raw;
}

export function looksLikeLink(value) {
  try {
    const url = new URL(normalizeLink(value));
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function splitLinkText(text) {
  return String(text || "")
    .split(/[\s,;]+/)
    .map(normalizeLink)
    .filter(Boolean);
}

export function hostFromLink(value) {
  try {
    return new URL(normalizeLink(value)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function filenameFromLink(value) {
  try {
    const url = new URL(normalizeLink(value));
    const last = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    return last || url.hostname;
  } catch {
    return String(value || "").slice(0, 64);
  }
}

export function typeFromLink(value) {
  const name = filenameFromLink(value).toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  return EXTENSION_TYPES[ext] || "image";
}

export { formatDate } from "@/lib/format";
