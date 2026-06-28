// Lookups, filter options, and formatters for the duplicate-review screens.
// Config only — never row data (that lives in the DB via lib/supabase/duplicates.js).

export const MATCH_META = {
  exact: {
    label: "Exact",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
  },
  near: {
    label: "Near",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  visual: {
    label: "Visual",
    className: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  },
};

export const STATUS_META = {
  open: {
    label: "Open",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  resolved: {
    label: "Resolved",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  ignored: {
    label: "Ignored",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
};

export const MATCH_OPTIONS = [
  { value: "exact", label: "Exact" },
  { value: "near", label: "Near" },
  { value: "visual", label: "Visual" },
];

export const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "ignored", label: "Ignored" },
];

export const MATCH_FILTER_OPTIONS = [{ value: "all", label: "All Matches" }, ...MATCH_OPTIONS];
export const STATUS_FILTER_OPTIONS = [{ value: "all", label: "All Statuses" }, ...STATUS_OPTIONS];

export const SORT_OPTIONS = [
  { value: "created-desc", label: "Newest First" },
  { value: "created-asc", label: "Oldest First" },
  { value: "similarity-desc", label: "Highest Similarity" },
  { value: "similarity-asc", label: "Lowest Similarity" },
  { value: "members-desc", label: "Most Members" },
];

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
