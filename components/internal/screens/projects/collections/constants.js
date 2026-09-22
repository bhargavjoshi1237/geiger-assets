export const TYPE_META = {
  manual: {
    label: "Manual",
    className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  },
  smart: {
    label: "Smart",
    className: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  },
  album: {
    label: "Album",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  board: {
    label: "Board",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
};

export const VISIBILITY_META = {
  private: {
    variant: "neutral",
    label: "Private",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
  team: {
    variant: "info",
    label: "Team",
    className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    dotClass: "bg-blue-400",
  },
  public: {
    variant: "success",
    label: "Public",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
};

export const TYPE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "smart", label: "Smart" },
  { value: "album", label: "Album" },
  { value: "board", label: "Board" },
];

export const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private" },
  { value: "team", label: "Team" },
  { value: "public", label: "Public" },
];

export const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

export const TYPE_FILTER_OPTIONS = [{ value: "all", label: "All Types" }, ...TYPE_OPTIONS];
export const VISIBILITY_FILTER_OPTIONS = [
  { value: "all", label: "All Visibility" },
  ...VISIBILITY_OPTIONS,
];

export const SORT_OPTIONS = [
  { value: "modified-desc", label: "Last Modified" },
  { value: "modified-asc", label: "Oldest Modified" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "assets-desc", label: "Most Assets" },
  { value: "assets-asc", label: "Fewest Assets" },
];

export { formatDate } from "@/lib/format";
