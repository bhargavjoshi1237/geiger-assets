// Lookups, filter options, and formatters for the asset-requests screens.
// Config only — never row data (that lives in the DB via lib/supabase/requests.js).

export const PRIORITY_META = {
  low: {
    label: "Low",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
  },
  medium: {
    label: "Medium",
    className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  },
  high: {
    label: "High",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  urgent: {
    label: "Urgent",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
  },
};

export const STATUS_META = {
  open: {
    label: "Open",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    dotClass: "bg-blue-400",
  },
  submitted: {
    label: "Submitted",
    className: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    dotClass: "bg-violet-400",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  closed: {
    label: "Closed",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-500",
  },
};

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "closed", label: "Closed" },
];

export const PRIORITY_FILTER_OPTIONS = [
  { value: "all", label: "All Priorities" },
  ...PRIORITY_OPTIONS,
];
export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  ...STATUS_OPTIONS,
];

export const SORT_OPTIONS = [
  { value: "updated-desc", label: "Last Updated" },
  { value: "updated-asc", label: "Oldest Updated" },
  { value: "due-asc", label: "Due Soonest" },
  { value: "due-desc", label: "Due Latest" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
];

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// A request is overdue when its due date is in the past and it isn't yet
// resolved (approved/closed).
export function isOverdue(dueDate, status) {
  if (!dueDate) return false;
  if (status === "approved" || status === "closed") return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}
