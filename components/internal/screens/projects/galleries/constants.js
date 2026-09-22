// Lookups, option lists and formatters for the Galleries area. Config only —
// no row data lives here; galleries come from lib/supabase/galleries.js.

export const STATUS_META = {
  draft: {
    variant: "neutral",
    label: "Draft",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
  published: {
    variant: "success",
    label: "Published",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  unpublished: {
    variant: "warning",
    label: "Unpublished",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
};

// Deliberately not the collections private/team/public set — "team" is
// meaningless on a page whose purpose is to be seen from outside the workspace.
export const VISIBILITY_META = {
  public: {
    variant: "success",
    label: "Public",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  unlisted: {
    variant: "info",
    label: "Unlisted",
    className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    dotClass: "bg-blue-400",
  },
  private: {
    variant: "neutral",
    label: "Private",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
};

export const DOMAIN_STATUS_META = {
  pending: {
    variant: "neutral",
    label: "Pending",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
  verifying: {
    variant: "info",
    label: "Verifying",
    className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    dotClass: "bg-blue-400",
  },
  active: {
    variant: "success",
    label: "Active",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  failed: {
    variant: "destructive",
    label: "Failed",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
    dotClass: "bg-red-400",
  },
};

export const SSL_STATUS_META = {
  none: { label: "No certificate", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30" },
  pending: { label: "Issuing", className: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  issued: { label: "Secured", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  error: { label: "Error", className: "bg-red-500/15 text-red-300 border-red-500/30" },
};

export const REQUEST_STATUS_META = {
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
  denied: {
    variant: "destructive",
    label: "Denied",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
    dotClass: "bg-red-400",
  },
};

export const LAYOUT_META = {
  grid: { label: "Grid", hint: "Even tiles in a fixed column count." },
  masonry: { label: "Masonry", hint: "Columns that keep each image's own height." },
  justified: { label: "Justified rows", hint: "Full-bleed rows of equal height." },
  slideshow: { label: "Slideshow", hint: "One asset at a time, with navigation." },
  single: { label: "Single column", hint: "One large asset per row, editorial style." },
};

export const DOWNLOAD_MODE_META = {
  open: { label: "Open", hint: "Anyone viewing the gallery can download." },
  request: { label: "On request", hint: "Visitors ask; you approve or deny." },
  off: { label: "Disabled", hint: "No downloads offered." },
};

export const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "unpublished", label: "Unpublished" },
];

export const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "unlisted", label: "Unlisted" },
  { value: "private", label: "Private" },
];

export const LAYOUT_OPTIONS = Object.entries(LAYOUT_META).map(([value, m]) => ({
  value,
  label: m.label,
}));

export const DOWNLOAD_MODE_OPTIONS = Object.entries(DOWNLOAD_MODE_META).map(([value, m]) => ({
  value,
  label: m.label,
}));

export const SOURCE_OPTIONS = [
  { value: "collection", label: "Collection (live)" },
  { value: "curated", label: "Curated selection" },
];

export const DOMAIN_KIND_OPTIONS = [
  { value: "subdomain", label: "Geiger subdomain" },
  { value: "custom", label: "Custom domain" },
];

export const STATUS_FILTER_OPTIONS = [{ value: "all", label: "All Statuses" }, ...STATUS_OPTIONS];
export const VISIBILITY_FILTER_OPTIONS = [
  { value: "all", label: "All Visibility" },
  ...VISIBILITY_OPTIONS,
];
export const LAYOUT_FILTER_OPTIONS = [{ value: "all", label: "All Layouts" }, ...LAYOUT_OPTIONS];
export const REQUEST_FILTER_OPTIONS = [
  { value: "all", label: "All Requests" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
];

export const SORT_OPTIONS = [
  { value: "modified-desc", label: "Last Modified" },
  { value: "modified-asc", label: "Oldest Modified" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
];

// Theme defaults applied to a new gallery and used as the fallback wherever a
// stored theme is missing a key.
export const DEFAULT_THEME = {
  accent: "#6366f1",
  ground: "dark",
  typography: "sans",
  gap: "comfortable",
  radius: "rounded",
  caption: "below",
};

export const ACCENT_SWATCHES = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#64748b",
];

export const GROUND_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

export const TYPOGRAPHY_OPTIONS = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
];

export const GAP_OPTIONS = [
  { value: "tight", label: "Tight" },
  { value: "comfortable", label: "Comfortable" },
  { value: "airy", label: "Airy" },
];

export const RADIUS_OPTIONS = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "pill", label: "Soft" },
];

export const CAPTION_OPTIONS = [
  { value: "below", label: "Below" },
  { value: "overlay", label: "Overlay" },
  { value: "none", label: "Hidden" },
];

/** Tailwind classes per theme key, shared by the editor preview and the public page. */
export const GAP_CLASS = { tight: "gap-1", comfortable: "gap-3", airy: "gap-6" };
export const RADIUS_CLASS = { square: "rounded-none", rounded: "rounded-lg", pill: "rounded-2xl" };
export const TYPOGRAPHY_CLASS = { sans: "font-sans", serif: "font-serif", mono: "font-mono" };

export function withThemeDefaults(theme) {
  return { ...DEFAULT_THEME, ...(theme && typeof theme === "object" ? theme : {}) };
}

export { formatDate } from "@/lib/format";
