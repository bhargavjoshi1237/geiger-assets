// Lookups, filter options, and formatters for the collaboration screens.
// Config only — never row data (that lives in the DB via
// lib/supabase/collaboration.js, with members and roles via
// lib/supabase/rbac.js).

export const SHARE_KIND_MAP = {
  asset: { label: "Asset", variant: "info", dotClass: "bg-sky-400" },
  collection: { label: "Collection", variant: "purple", dotClass: "bg-violet-400" },
};

export const SHARE_VISIBILITY_MAP = {
  public: { label: "Public", variant: "success", dotClass: "bg-emerald-400" },
  private: { label: "Private", variant: "neutral", dotClass: "bg-zinc-400" },
};

export const SHARE_SCOPE_MAP = {
  view: { label: "View only", variant: "info", dotClass: "bg-sky-400" },
  download: { label: "Can download", variant: "success", dotClass: "bg-emerald-400" },
};

export const SHARE_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  expired: { label: "Expired", variant: "warning", dotClass: "bg-amber-400" },
  revoked: { label: "Revoked", variant: "neutral", dotClass: "bg-zinc-500" },
};

export const APPROVAL_STATUS_MAP = {
  pending: { label: "Pending review", variant: "warning", dotClass: "bg-amber-400" },
  approved: { label: "Approved", variant: "success", dotClass: "bg-emerald-400" },
  rejected: { label: "Rejected", variant: "danger", dotClass: "bg-red-400" },
  changes_requested: { label: "Changes requested", variant: "info", dotClass: "bg-sky-400" },
};

export const INVITE_TYPE_MAP = {
  member: { label: "Member", variant: "info", dotClass: "bg-sky-400" },
  guest: { label: "Guest", variant: "neutral", dotClass: "bg-zinc-400" },
  reviewer: { label: "External reviewer", variant: "purple", dotClass: "bg-violet-400" },
};

export const INVITE_STATUS_MAP = {
  pending: { label: "Pending", variant: "warning", dotClass: "bg-amber-400" },
  accepted: { label: "Accepted", variant: "success", dotClass: "bg-emerald-400" },
  expired: { label: "Expired", variant: "neutral", dotClass: "bg-zinc-500" },
  revoked: { label: "Revoked", variant: "danger", dotClass: "bg-red-400" },
};

export const TEAM_MEMBER_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  invited: { label: "Invited", variant: "warning", dotClass: "bg-amber-400" },
  suspended: { label: "Suspended", variant: "danger", dotClass: "bg-red-400" },
  revoked: { label: "Revoked", variant: "neutral", dotClass: "bg-zinc-500" },
};

function withAll(options, allLabel) {
  return [{ value: "all", label: allLabel }, ...options];
}

export const SHARE_KIND_FILTER_OPTIONS = withAll(
  Object.entries(SHARE_KIND_MAP).map(([value, m]) => ({ value, label: m.label })),
  "All kinds",
);

export const SHARE_VISIBILITY_FILTER_OPTIONS = withAll(
  Object.entries(SHARE_VISIBILITY_MAP).map(([value, m]) => ({ value, label: m.label })),
  "All visibility",
);

export const SHARE_STATUS_FILTER_OPTIONS = withAll(
  Object.entries(SHARE_STATUS_MAP).map(([value, m]) => ({ value, label: m.label })),
  "All statuses",
);

export const APPROVAL_STATUS_FILTER_OPTIONS = withAll(
  Object.entries(APPROVAL_STATUS_MAP).map(([value, m]) => ({ value, label: m.label })),
  "All statuses",
);

export const INVITE_TYPE_FILTER_OPTIONS = withAll(
  Object.entries(INVITE_TYPE_MAP).map(([value, m]) => ({ value, label: m.label })),
  "All types",
);

export const INVITE_STATUS_FILTER_OPTIONS = withAll(
  Object.entries(INVITE_STATUS_MAP).map(([value, m]) => ({ value, label: m.label })),
  "All statuses",
);

export const SORT_OPTIONS = [
  { value: "updated-desc", label: "Last updated" },
  { value: "updated-asc", label: "Oldest updated" },
  { value: "created-desc", label: "Newest first" },
  { value: "title-asc", label: "Title A–Z" },
];

// Expiry presets for the share dialog and the invite dialog. The value is
// seconds for the /api/media/share token mint; "none" means no expiry.
export const SHARE_EXPIRY_OPTIONS = [
  { value: "86400", label: "Expires in 24 hours" },
  { value: "604800", label: "Expires in 7 days" },
  { value: "2592000", label: "Expires in 30 days" },
  { value: "none", label: "No expiry" },
];

export const SHARE_SCOPE_OPTIONS = [
  { value: "view", label: "View only" },
  { value: "download", label: "View + download" },
];

export const SHARE_KIND_OPTIONS = [
  { value: "asset", label: "Single asset" },
  { value: "collection", label: "Collection" },
];

export const SHARE_VISIBILITY_OPTIONS = [
  { value: "private", label: "Private — token only" },
  { value: "public", label: "Public — anyone with the link" },
];

export const APPROVAL_STATUS_OPTIONS = Object.entries(APPROVAL_STATUS_MAP).map(
  ([value, m]) => ({ value, label: m.label }),
);

export const INVITE_TYPE_OPTIONS = Object.entries(INVITE_TYPE_MAP).map(
  ([value, m]) => ({ value, label: m.label }),
);

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isExpired(iso) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t < Date.now();
}

// A link is revoked once it is deactivated, expired once its expiry passes,
// and active otherwise.
export function shareStatus(link) {
  if (!link) return "revoked";
  if (link.isActive === false || link.revokedAt) return "revoked";
  if (isExpired(link.expiresAt)) return "expired";
  return "active";
}

// Invites carry their own status, but expiry is derived so a stale pending
// row reads as expired without a write.
export function inviteStatus(invite) {
  if (!invite) return "revoked";
  if (invite.status === "accepted" || invite.status === "revoked") return invite.status;
  if (isExpired(invite.expiresAt)) return "expired";
  return "pending";
}

export function expiryTtlToIso(ttlSeconds) {
  if (!ttlSeconds || ttlSeconds === "none") return "";
  const ttl = Number(ttlSeconds);
  if (!Number.isFinite(ttl) || ttl <= 0) return "";
  return new Date(Date.now() + ttl * 1000).toISOString();
}
