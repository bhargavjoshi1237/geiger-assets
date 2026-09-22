import {
  Archive,
  BadgeCheck,
  Boxes,
  CircleDollarSign,
  FileInput,
  FolderOpen,
  GalleryHorizontalEnd,
  Gavel,
  HandCoins,
  Landmark,
  Layers,
  Lock,
  Mail,
  MonitorUp,
  Package,
  ReceiptText,
  RefreshCw,
  Scale,
  Send,
  Share2,
  Tags,
  UserCheck,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Subject catalog — everything in this workspace that can be routed for
// approval, shared, or commented on.
//
// `table` names the row this subject points at; `available: false` marks a
// subject whose feature is registered in the sidebar but whose table hasn't
// landed yet. Unavailable subjects still appear in the pipeline builder (so a
// pipeline can be authored ahead of the feature) but are filtered out of the
// review create dialog, which needs real rows to attach.
// ---------------------------------------------------------------------------
export const PIPELINE_SUBJECTS = [
  {
    key: "asset",
    label: "Asset",
    group: "Content",
    icon: FolderOpen,
    table: "assets",
    available: true,
    description: "A single file in the library moving from draft to approved.",
  },
  {
    key: "collection",
    label: "Collection",
    group: "Content",
    icon: Layers,
    table: "collections",
    available: true,
    description: "A curated set signed off before it leaves the workspace.",
  },
  {
    key: "upload_submission",
    label: "External upload",
    group: "Content",
    icon: FileInput,
    table: "upload_submissions",
    available: true,
    description: "Files a client or partner dropped through an upload portal.",
  },
  {
    key: "asset_request",
    label: "Asset request",
    group: "Content",
    icon: Mail,
    table: "asset_requests",
    available: true,
    description: "Approve the ask before anyone starts producing the work.",
  },
  {
    key: "archive_disposition",
    label: "Archive disposition",
    group: "Content",
    icon: Archive,
    table: "assets",
    available: true,
    description: "Sign-off before assets are archived or permanently purged.",
  },
  {
    key: "share_link",
    label: "Shared link",
    group: "Access",
    icon: Share2,
    table: "share_links",
    available: true,
    description: "Approve external exposure before a link goes live.",
  },
  {
    key: "role_grant",
    label: "Role grant",
    group: "Access",
    icon: Lock,
    table: "role_grants",
    available: true,
    description: "Approve who gets which permissions in this workspace.",
  },
  {
    key: "team_invitation",
    label: "Team invitation",
    group: "Access",
    icon: UserCheck,
    table: "team_invitations",
    available: true,
    description: "Vet members, guests, and external reviewers before they join.",
  },
  {
    key: "membership_tier",
    label: "Membership tier",
    group: "Monetization",
    icon: Layers,
    table: "membership_tiers",
    available: true,
    description: "Pricing, perks, and download-limit changes on a paid tier.",
  },
  {
    key: "subscription",
    label: "Subscription",
    group: "Monetization",
    icon: RefreshCw,
    table: "subscriptions",
    available: true,
    description: "Comped, gifted, or manually granted subscriptions.",
  },
  {
    key: "ppv_post",
    label: "Pay-per-view post",
    group: "Monetization",
    icon: Lock,
    table: "ppv_posts",
    available: true,
    description: "Content going behind a paywall.",
  },
  {
    key: "paid_message",
    label: "Paid message",
    group: "Monetization",
    icon: Send,
    table: "paid_messages",
    available: true,
    description: "Mass locked drops reviewed before they send.",
  },
  {
    key: "promo_code",
    label: "Promo code",
    group: "Monetization",
    icon: Tags,
    table: "promo_codes",
    available: true,
    description: "Discounts, trials, and gifted months.",
  },
  {
    key: "payout",
    label: "Payout",
    group: "Monetization",
    icon: Landmark,
    table: "payouts",
    available: true,
    description: "Finance sign-off before money leaves the account.",
  },
  {
    key: "tip",
    label: "Tip payout",
    group: "Monetization",
    icon: HandCoins,
    table: "tips",
    available: true,
    description: "Gratitude revenue reconciled into a payout run.",
  },
  {
    key: "gallery",
    label: "Gallery",
    group: "Delivery",
    icon: GalleryHorizontalEnd,
    table: "galleries",
    available: true,
    description: "A hosted gallery approved before it goes public.",
  },
  // Registered in the sidebar, table not built yet.
  {
    key: "storefront_product",
    label: "Storefront product",
    group: "Delivery",
    icon: Package,
    table: null,
    available: false,
    description: "What a gallery sells, and at what price.",
  },
  {
    key: "order",
    label: "Order & invoice",
    group: "Delivery",
    icon: ReceiptText,
    table: null,
    available: false,
    description: "High-value or manual orders held for review.",
  },
  {
    key: "channel_publish",
    label: "Channel publish",
    group: "Delivery",
    icon: MonitorUp,
    table: null,
    available: false,
    description: "Pushing an asset into a connected business system.",
  },
  {
    key: "license",
    label: "Issued license",
    group: "Governance",
    icon: BadgeCheck,
    table: null,
    available: false,
    description: "Rights granted to a buyer or licensee.",
  },
  {
    key: "license_pricing",
    label: "License pricing",
    group: "Governance",
    icon: CircleDollarSign,
    table: null,
    available: false,
    description: "Non-standard pricing on a requested usage scope.",
  },
  {
    key: "retention_policy",
    label: "Retention policy",
    group: "Governance",
    icon: Scale,
    table: null,
    available: false,
    description: "Lifecycle rules that delete or archive records at scale.",
  },
  {
    key: "legal_hold",
    label: "Legal hold",
    group: "Governance",
    icon: Gavel,
    table: null,
    available: false,
    description: "Preserving records subject to legal or regulatory review.",
  },
  {
    key: "rendition",
    label: "Rendition preset",
    group: "Delivery",
    icon: Boxes,
    table: null,
    available: false,
    description: "Output formats generated from a source asset.",
  },
];

export const SUBJECT_MAP = Object.fromEntries(
  PIPELINE_SUBJECTS.map((s) => [s.key, s]),
);

export function subjectEntry(key) {
  return SUBJECT_MAP[key] || null;
}

export function subjectLabel(key) {
  return SUBJECT_MAP[key]?.label || "—";
}

/** Subjects that have a real table today — the only ones a review can attach to. */
export const AVAILABLE_SUBJECTS = PIPELINE_SUBJECTS.filter((s) => s.available);

/** `[{ group, items: [...] }]` for grouped Select menus. */
export function groupedSubjects(list = PIPELINE_SUBJECTS) {
  const order = [];
  const map = new Map();
  for (const s of list) {
    if (!map.has(s.group)) {
      map.set(s.group, []);
      order.push(s.group);
    }
    map.get(s.group).push(s);
  }
  return order.map((group) => ({ group, items: map.get(group) }));
}

export const SUBJECT_FILTER_OPTIONS = [
  { value: "all", label: "All Subjects" },
  ...PIPELINE_SUBJECTS.filter((s) => s.available).map((s) => ({
    value: s.key,
    label: s.label,
  })),
];

// ---------------------------------------------------------------------------
// Shared links
// ---------------------------------------------------------------------------
export const SHARE_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", variant: "warning", dotClass: "bg-amber-400" },
  expired: { label: "Expired", variant: "neutral", dotClass: "bg-[#737373]" },
  revoked: { label: "Revoked", variant: "danger", dotClass: "bg-red-400" },
};

export const SHARE_VISIBILITY_MAP = {
  public: { label: "Public", variant: "info" },
  private: { label: "Restricted", variant: "purple" },
};

export const SHARE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
];

export const SHARE_VISIBILITY_FILTER_OPTIONS = [
  { value: "all", label: "All Visibility" },
  { value: "public", label: "Public" },
  { value: "private", label: "Restricted" },
];

export const SHARE_TARGET_OPTIONS = [
  { value: "asset", label: "A single asset" },
  { value: "collection", label: "A collection" },
];

export const EXPIRY_PRESETS = [
  { value: "never", label: "Never expires", days: null },
  { value: "7d", label: "In 7 days", days: 7 },
  { value: "30d", label: "In 30 days", days: 30 },
  { value: "90d", label: "In 90 days", days: 90 },
];

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------
export const REVIEW_STATUS_MAP = {
  Pending: { label: "Pending", variant: "neutral", dotClass: "bg-[#737373]" },
  "In Review": { label: "In Review", variant: "info", dotClass: "bg-sky-400" },
  "Changes Requested": {
    label: "Changes Requested",
    variant: "warning",
    dotClass: "bg-amber-400",
  },
  Approved: { label: "Approved", variant: "success", dotClass: "bg-emerald-400" },
  Rejected: { label: "Rejected", variant: "danger", dotClass: "bg-red-400" },
  Cancelled: { label: "Cancelled", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const REVIEW_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "Pending", label: "Pending" },
  { value: "In Review", label: "In Review" },
  { value: "Changes Requested", label: "Changes Requested" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

export const DECISION_MAP = {
  pending: { label: "Pending", variant: "neutral", dotClass: "bg-[#737373]" },
  approved: { label: "Approved", variant: "success", dotClass: "bg-emerald-400" },
  rejected: { label: "Rejected", variant: "danger", dotClass: "bg-red-400" },
  changes: { label: "Changes", variant: "warning", dotClass: "bg-amber-400" },
};

export const PRIORITY_MAP = {
  Low: { label: "Low", variant: "neutral" },
  Normal: { label: "Normal", variant: "info" },
  High: { label: "High", variant: "warning" },
  Urgent: { label: "Urgent", variant: "danger" },
};

export const PRIORITY_OPTIONS = ["Low", "Normal", "High", "Urgent"];

export const PIPELINE_STATUS_MAP = {
  Active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  Paused: { label: "Paused", variant: "warning", dotClass: "bg-amber-400" },
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const PIPELINE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "Active", label: "Active" },
  { value: "Paused", label: "Paused" },
  { value: "Draft", label: "Draft" },
];

export const PIPELINE_MODE_MAP = {
  sequential: {
    label: "Sequential",
    variant: "info",
    description: "Stages run in order — a stage only opens once the one before it clears.",
  },
  anytime: {
    label: "Anytime",
    variant: "purple",
    description: "Every stage is open at once — approvers can act in any order.",
  },
};

export const APPROVER_TYPE_OPTIONS = [
  { value: "role", label: "Anyone with a role" },
  { value: "member", label: "Specific people" },
];

/** A fresh stage for the pipeline builder. */
export function newStage(index = 0) {
  return {
    id: `stage_${
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
    }`,
    name: index === 0 ? "First review" : `Stage ${index + 1}`,
    approverType: "role",
    roleId: "",
    memberIds: [],
    minApprovals: 1,
    advance: "sequential",
    allowChangeRequests: true,
    slaHours: null,
  };
}

/**
 * How many approvals a stage still needs. `decisions` is the review's decision
 * log filtered to this stage.
 */
export function stageProgress(stage, decisions = []) {
  const required = Math.max(1, Number(stage?.minApprovals) || 1);
  const given = decisions.filter((d) => d.decision === "approved").length;
  return { given, required, met: given >= required };
}

/** Pipeline starter templates, offered in the create dialog. */
export const PIPELINE_TEMPLATES = [
  {
    key: "blank",
    label: "Blank pipeline",
    description: "Start with one empty stage and build it yourself.",
    subjectType: "asset",
    mode: "sequential",
    stages: [],
  },
  {
    key: "brand-review",
    label: "Brand review",
    description: "Creative lead signs off, then brand approves.",
    subjectType: "asset",
    mode: "sequential",
    stages: [
      { name: "Creative review", minApprovals: 1, advance: "sequential" },
      { name: "Brand approval", minApprovals: 1, advance: "sequential" },
    ],
  },
  {
    key: "client-delivery",
    label: "Client delivery",
    description: "Internal QA, then account management, then the client.",
    subjectType: "collection",
    mode: "sequential",
    stages: [
      { name: "Internal QA", minApprovals: 1, advance: "sequential" },
      { name: "Account review", minApprovals: 1, advance: "sequential" },
      { name: "Client sign-off", minApprovals: 1, advance: "sequential" },
    ],
  },
  {
    key: "external-access",
    label: "External access",
    description: "Two approvers must agree before a link is exposed publicly.",
    subjectType: "share_link",
    mode: "sequential",
    stages: [
      { name: "Security review", minApprovals: 2, advance: "anytime" },
    ],
  },
  {
    key: "finance-signoff",
    label: "Finance sign-off",
    description: "Finance and a director both approve before money moves.",
    subjectType: "payout",
    mode: "sequential",
    stages: [
      { name: "Finance check", minApprovals: 1, advance: "sequential" },
      { name: "Director approval", minApprovals: 1, advance: "sequential" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
export const INVITE_KIND_MAP = {
  member: {
    label: "Member",
    variant: "info",
    description: "Full workspace access, scoped by their role.",
  },
  guest: {
    label: "Guest",
    variant: "purple",
    description: "Sees only what they're explicitly given.",
  },
  reviewer: {
    label: "External reviewer",
    variant: "warning",
    description: "Can comment and approve, but not browse the library.",
  },
};

export const INVITE_STATUS_MAP = {
  pending: { label: "Pending", variant: "warning", dotClass: "bg-amber-400" },
  accepted: { label: "Accepted", variant: "success", dotClass: "bg-emerald-400" },
  revoked: { label: "Revoked", variant: "danger", dotClass: "bg-red-400" },
  expired: { label: "Expired", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const MEMBER_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  invited: { label: "Invited", variant: "warning", dotClass: "bg-amber-400" },
  suspended: { label: "Suspended", variant: "danger", dotClass: "bg-red-400" },
};

export const INVITE_KIND_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "guest", label: "Guest" },
  { value: "reviewer", label: "External reviewer" },
];

export const INVITE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "revoked", label: "Revoked" },
  { value: "expired", label: "Expired" },
];

// ---------------------------------------------------------------------------
// Comments & activity
// ---------------------------------------------------------------------------
export const COMMENT_STATUS_MAP = {
  open: { label: "Open", variant: "info", dotClass: "bg-sky-400" },
  resolved: { label: "Resolved", variant: "success", dotClass: "bg-emerald-400" },
};

export const COMMENT_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Threads" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
];

/**
 * Activity verbs. `tone` drives the timeline dot colour; `label` is the phrase
 * rendered after the actor's name.
 */
export const ACTIVITY_VERBS = {
  "asset.uploaded": { label: "uploaded", tone: "sky", group: "Assets" },
  "asset.updated": { label: "updated", tone: "slate", group: "Assets" },
  "asset.archived": { label: "archived", tone: "amber", group: "Assets" },
  "asset.deleted": { label: "deleted", tone: "red", group: "Assets" },
  "collection.created": { label: "created the collection", tone: "sky", group: "Assets" },
  "share.created": { label: "shared", tone: "purple", group: "Sharing" },
  "share.revoked": { label: "revoked the link for", tone: "red", group: "Sharing" },
  "share.viewed": { label: "viewed the shared", tone: "slate", group: "Sharing" },
  "review.requested": { label: "requested review of", tone: "sky", group: "Approvals" },
  "review.approved": { label: "approved", tone: "emerald", group: "Approvals" },
  "review.rejected": { label: "rejected", tone: "red", group: "Approvals" },
  "review.changes": { label: "requested changes on", tone: "amber", group: "Approvals" },
  "review.advanced": { label: "advanced", tone: "sky", group: "Approvals" },
  "comment.posted": { label: "commented on", tone: "purple", group: "Comments" },
  "comment.resolved": { label: "resolved a thread on", tone: "emerald", group: "Comments" },
  "member.invited": { label: "invited", tone: "sky", group: "Team" },
  "member.joined": { label: "joined as", tone: "emerald", group: "Team" },
  "member.revoked": { label: "removed", tone: "red", group: "Team" },
  "role.changed": { label: "changed the role of", tone: "amber", group: "Team" },
};

export const ACTIVITY_TONE_CLASS = {
  emerald: "bg-emerald-400",
  red: "bg-red-400",
  amber: "bg-amber-400",
  sky: "bg-sky-400",
  purple: "bg-purple-400",
  slate: "bg-[#737373]",
};

export const ACTIVITY_FILTER_OPTIONS = [
  { value: "all", label: "All Activity" },
  { value: "Assets", label: "Assets" },
  { value: "Sharing", label: "Sharing" },
  { value: "Approvals", label: "Approvals" },
  { value: "Comments", label: "Comments" },
  { value: "Team", label: "Team" },
];

export function activityVerb(verb) {
  return ACTIVITY_VERBS[verb] || { label: verb || "did something", tone: "slate", group: "Assets" };
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "3 days ago" / "in 5 days" — the phrasing used on due dates and feeds. */
export function formatRelative(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return diff < 0 ? `${mins}m ago` : `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return diff < 0 ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return diff < 0 ? `${days}d ago` : `in ${days}d`;
  return formatDate(value);
}

/** Day bucket label used to group the activity timeline. */
export function dayBucket(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const today = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  if (diffDays < 30) return "This month";
  return "Earlier";
}

export const DAY_BUCKET_ORDER = ["Today", "Yesterday", "This week", "This month", "Earlier"];

/** True when a link is past its expiry — drives the "Expiring soon" KPI. */
export function isExpiringSoon(value, withinDays = 7) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const diff = d.getTime() - Date.now();
  return diff > 0 && diff < withinDays * 86400000;
}

export function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

/** Public URL for a share token. Relative so it works on any host. */
export function shareUrl(token) {
  if (!token) return "";
  if (typeof window === "undefined") return `/s/${token}`;
  return `${window.location.origin}/s/${token}`;
}
