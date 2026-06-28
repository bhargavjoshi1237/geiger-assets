// Lookups, filter options, and formatters for the External Uploads screens.
// Config only — never row data (that lives in the DB via
// lib/supabase/external_uploads.js).

export const PORTAL_STATUS_META = {
  active: {
    label: "Active",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  paused: {
    label: "Paused",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  expired: {
    label: "Expired",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
};

export const SUBMISSION_STATUS_META = {
  pending: {
    label: "Pending",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  rejected: {
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

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Slugify a portal name into a URL-safe, dash-separated identifier.
export function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
