import {
  UploadCloud,
  ClipboardCheck,
  BadgeCheck,
  RotateCcw,
  Archive,
  CalendarClock,
  Mail,
  Share2,
  CopyCheck,
  HardDrive,
  Mail as MailIcon,
  MessageSquare,
  Tag,
  Layers,
  CheckCircle2,
  Box,
  Bell,
  Timer,
  Webhook,
  PencilLine,
  CheckSquare,
  GitBranch,
} from "lucide-react";

export const CANVAS_FIT_VIEW = { padding: 0.35, maxZoom: 0.75 };

export const SNAP_SIZES = [8, 16, 24];

export const WORKFLOW_STATUS_MAP = {
  Active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  Paused: { label: "Paused", variant: "warning", dotClass: "bg-amber-400" },
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const SCOPE_MAP = {
  workspace: { label: "Workspace", variant: "info" },
  collection: { label: "Collection", variant: "purple" },
};

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "Active", label: "Active" },
  { value: "Paused", label: "Paused" },
  { value: "Draft", label: "Draft" },
];

export const TRIGGER_CATALOG = [
  {
    key: "asset.uploaded",
    label: "Asset uploaded",
    icon: UploadCloud,
    group: "Ingest & library",
    description: "A file finishes uploading to the library.",
  },
  {
    key: "asset.submitted",
    label: "Asset submitted",
    icon: ClipboardCheck,
    group: "Ingest & library",
    description: "An asset is submitted for review.",
  },
  {
    key: "asset.approved",
    label: "Asset approved",
    icon: BadgeCheck,
    group: "Review & approval",
    description: "A reviewer approves an asset.",
  },
  {
    key: "asset.rejected",
    label: "Asset rejected",
    icon: RotateCcw,
    group: "Review & approval",
    description: "A reviewer sends an asset back for changes.",
  },
  {
    key: "asset.archived",
    label: "Asset archived",
    icon: Archive,
    group: "Lifecycle & retention",
    description: "An asset is moved to archive.",
  },
  {
    key: "license.expiring",
    label: "License expiring",
    icon: CalendarClock,
    group: "Lifecycle & retention",
    description: "A licensed asset approaches its expiry date.",
  },
  {
    key: "asset.requested",
    label: "Asset requested",
    icon: Mail,
    group: "Requests & collaboration",
    description: "Someone requests a missing asset.",
  },
  {
    key: "collection.published",
    label: "Collection published",
    icon: Share2,
    group: "Sharing & publishing",
    description: "A collection is shared or published.",
  },
  {
    key: "duplicate.detected",
    label: "Duplicate detected",
    icon: CopyCheck,
    group: "Quality & governance",
    description: "A possible duplicate asset is found.",
  },
  {
    key: "storage.quota_reached",
    label: "Storage quota reached",
    icon: HardDrive,
    group: "Storage & operations",
    description: "Project storage crosses a usage threshold.",
  },
];

export const CONDITION_CATALOG = [
  {
    key: "if.asset_type",
    label: "If asset type",
    icon: GitBranch,
    description: "Branch on the asset type (image, video, audio…).",
    fields: [
      {
        key: "assetType",
        label: "Asset type",
        type: "select",
        options: ["image", "video", "audio", "document", "3d", "raw"],
        default: "image",
      },
    ],
  },
  {
    key: "if.file_size",
    label: "If file size",
    icon: GitBranch,
    description: "Branch on the file size in MB.",
    fields: [
      {
        key: "operator",
        label: "Operator",
        type: "select",
        options: ["greater than", "less than", "equal to"],
        default: "greater than",
      },
      { key: "sizeMB", label: "Size (MB)", type: "number", default: "100" },
    ],
  },
  {
    key: "if.has_tag",
    label: "If has tag",
    icon: GitBranch,
    description: "Branch on whether the asset has a tag.",
    fields: [{ key: "tag", label: "Tag", type: "text", default: "" }],
  },
  {
    key: "if.status",
    label: "If status",
    icon: GitBranch,
    description: "Branch on the asset status.",
    fields: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["draft", "review", "approved", "archived", "processing"],
        default: "review",
      },
    ],
  },
];

export const ACTION_CATALOG = [
  {
    key: "send.email",
    label: "Send email",
    icon: MailIcon,
    group: "Messaging & tagging",
    description: "Send a templated email to the stakeholder.",
    fields: [
      { key: "subject", label: "Subject", type: "text", default: "" },
      {
        key: "template",
        label: "Template",
        type: "select",
        options: ["Approval", "Reminder", "Thank you", "Custom"],
        default: "Approval",
      },
    ],
  },
  {
    key: "send.sms",
    label: "Send SMS",
    icon: MessageSquare,
    group: "Messaging & tagging",
    description: "Send a text message to the stakeholder.",
    fields: [{ key: "message", label: "Message", type: "textarea", default: "" }],
  },
  {
    key: "tag.add",
    label: "Add tag",
    icon: Tag,
    group: "Messaging & tagging",
    description: "Add a tag to the asset.",
    fields: [{ key: "tag", label: "Tag", type: "text", default: "" }],
  },
  {
    key: "tag.remove",
    label: "Remove tag",
    icon: Tag,
    group: "Messaging & tagging",
    description: "Remove a tag from the asset.",
    fields: [{ key: "tag", label: "Tag", type: "text", default: "" }],
  },
  {
    key: "collection.add",
    label: "Add to collection",
    icon: Layers,
    group: "Messaging & tagging",
    description: "Add the asset to a collection.",
    fields: [{ key: "collection", label: "Collection", type: "text", default: "" }],
  },
  {
    key: "asset.approve",
    label: "Approve asset",
    icon: CheckCircle2,
    group: "Messaging & tagging",
    description: "Mark the asset as approved.",
    fields: [{ key: "note", label: "Note", type: "text", default: "" }],
  },
  {
    key: "asset.archive",
    label: "Archive asset",
    icon: Box,
    group: "Messaging & tagging",
    description: "Move the asset to archive.",
    fields: [{ key: "reason", label: "Reason", type: "text", default: "" }],
  },
  {
    key: "staff.notify",
    label: "Notify staff",
    icon: Bell,
    group: "Messaging & tagging",
    description: "Send an internal notification to your team.",
    fields: [
      { key: "channel", label: "Channel", type: "text", default: "#content" },
      { key: "message", label: "Message", type: "textarea", default: "" },
    ],
  },
  {
    key: "flow.wait",
    label: "Wait / delay",
    icon: Timer,
    group: "Advanced",
    description: "Pause the workflow before the next step.",
    fields: [
      { key: "amount", label: "Amount", type: "number", default: "1" },
      {
        key: "unit",
        label: "Unit",
        type: "select",
        options: ["minutes", "hours", "days"],
        default: "hours",
      },
    ],
  },
  {
    key: "http.webhook",
    label: "Webhook",
    icon: Webhook,
    group: "Advanced",
    description: "Make an HTTP request to an external URL.",
    fields: [
      {
        key: "method",
        label: "Method",
        type: "select",
        options: ["POST", "GET", "PUT"],
        default: "POST",
      },
      { key: "url", label: "URL", type: "text", default: "https://" },
    ],
  },
  {
    key: "field.update",
    label: "Update field",
    icon: PencilLine,
    group: "Advanced",
    description: "Update a metadata field on the asset.",
    fields: [
      { key: "field", label: "Field", type: "text", default: "" },
      { key: "value", label: "Value", type: "text", default: "" },
    ],
  },
  {
    key: "task.create",
    label: "Create task",
    icon: CheckSquare,
    group: "Advanced",
    description: "Create a follow-up task for your team.",
    fields: [
      { key: "title", label: "Task title", type: "text", default: "" },
      { key: "assignee", label: "Assignee", type: "text", default: "" },
    ],
  },
];

const ALL_ENTRIES = [
  ...TRIGGER_CATALOG,
  ...CONDITION_CATALOG,
  ...ACTION_CATALOG,
];
const ENTRY_BY_KEY = Object.fromEntries(ALL_ENTRIES.map((e) => [e.key, e]));

export function catalogEntry(key) {
  return ENTRY_BY_KEY[key] || null;
}

export const TRIGGER_FILTER_OPTIONS = [
  { value: "all", label: "All triggers" },
  ...TRIGGER_CATALOG.map((t) => ({ value: t.key, label: t.label })),
];

export function groupByGroup(entries) {
  const groups = [];
  const index = new Map();
  for (const entry of entries) {
    const name = entry.group || "Other";
    if (!index.has(name)) {
      index.set(name, { group: name, items: [] });
      groups.push(index.get(name));
    }
    index.get(name).items.push(entry);
  }
  return groups;
}

export function defaultConfig(entry) {
  const config = {};
  for (const field of entry?.fields || []) {
    config[field.key] = field.default ?? "";
  }
  return config;
}

export function summarizeConfig(entry, config) {
  if (!entry?.fields?.length) return entry?.description || "";
  const parts = entry.fields
    .map((f) => {
      const v = config?.[f.key];
      if (v === undefined || v === null || v === "") return null;
      return `${f.label}: ${v}`;
    })
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : entry?.description || "Not configured";
}

export const WORKFLOW_TEMPLATE_CATEGORY_MAP = {
  Ingest: { label: "Ingest", variant: "info" },
  Approval: { label: "Approval", variant: "purple" },
  Publishing: { label: "Publishing", variant: "neutral" },
  Governance: { label: "Governance", variant: "warning" },
};

export const WORKFLOW_TEMPLATE_CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "Ingest", label: "Ingest" },
  { value: "Approval", label: "Approval" },
  { value: "Publishing", label: "Publishing" },
  { value: "Governance", label: "Governance" },
];

export const WORKFLOW_TEMPLATES = [
  {
    id: "tmpl_autotag_upload",
    name: "Auto-tag on upload",
    description:
      "When a file lands in the library, tag it for triage and flag RAW files for review.",
    category: "Ingest",
    trigger: "asset.uploaded",
    steps: [
      { kind: "trigger", type: "asset.uploaded", config: {} },
      {
        kind: "condition",
        type: "if.asset_type",
        config: { assetType: "raw" },
      },
      {
        kind: "action",
        type: "tag.add",
        config: { tag: "needs-review" },
      },
    ],
  },
  {
    id: "tmpl_review_request",
    name: "Review request on submit",
    description:
      "Notify reviewers the moment an asset is submitted, with a link to approve.",
    category: "Approval",
    trigger: "asset.submitted",
    steps: [
      { kind: "trigger", type: "asset.submitted", config: {} },
      {
        kind: "action",
        type: "staff.notify",
        config: { channel: "#content", message: "An asset needs review." },
      },
      {
        kind: "action",
        type: "task.create",
        config: { title: "Review submitted asset", assignee: "" },
      },
    ],
  },
  {
    id: "tmpl_approval_notify",
    name: "Approval notification",
    description:
      "Email the requester when their asset is approved and file it in the release collection.",
    category: "Approval",
    trigger: "asset.approved",
    steps: [
      { kind: "trigger", type: "asset.approved", config: {} },
      {
        kind: "action",
        type: "send.email",
        config: { subject: "Your asset was approved", template: "Approval" },
      },
      { kind: "action", type: "collection.add", config: { collection: "Approved" } },
    ],
  },
  {
    id: "tmpl_expiry_reminder",
    name: "License expiry reminder",
    description:
      "Warn the team before licensed assets expire so renewals never lapse.",
    category: "Governance",
    trigger: "license.expiring",
    steps: [
      { kind: "trigger", type: "license.expiring", config: {} },
      {
        kind: "action",
        type: "staff.notify",
        config: { channel: "#content", message: "Licenses expiring soon — review renewals." },
      },
    ],
  },
  {
    id: "tmpl_duplicate_triage",
    name: "Duplicate triage",
    description:
      "Tag suspected duplicates and open a review task for the librarian.",
    category: "Governance",
    trigger: "duplicate.detected",
    steps: [
      { kind: "trigger", type: "duplicate.detected", config: {} },
      { kind: "action", type: "tag.add", config: { tag: "possible-duplicate" } },
      {
        kind: "action",
        type: "task.create",
        config: { title: "Triage duplicate group", assignee: "" },
      },
    ],
  },
  {
    id: "tmpl_big_file",
    name: "Large-file cold storage",
    description:
      "Archive oversized uploads after a delay and notify the storage owner.",
    category: "Publishing",
    trigger: "asset.uploaded",
    steps: [
      { kind: "trigger", type: "asset.uploaded", config: {} },
      {
        kind: "condition",
        type: "if.file_size",
        config: { operator: "greater than", sizeMB: "500" },
      },
      {
        kind: "action",
        type: "asset.archive",
        config: { reason: "Oversized — moved to cold storage" },
      },
    ],
  },
];

export const RUN_STATUS_MAP = {
  Success: {
    label: "Success",
    variant: "success",
    dotClass: "bg-emerald-400",
    iconClass: "text-emerald-400",
  },
  Failed: {
    label: "Failed",
    variant: "danger",
    dotClass: "bg-red-400",
    iconClass: "text-red-400",
  },
  Running: {
    label: "Running",
    variant: "info",
    dotClass: "bg-sky-400",
    iconClass: "text-sky-400",
  },
  Skipped: {
    label: "Skipped",
    variant: "neutral",
    dotClass: "bg-[#737373]",
    iconClass: "text-[#737373]",
  },
};

export const RUN_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "Success", label: "Success" },
  { value: "Failed", label: "Failed" },
  { value: "Running", label: "Running" },
  { value: "Skipped", label: "Skipped" },
];

export function formatRelativeDate(value) {
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

export function formatDuration(ms) {
  const n = Number(ms);
  if (!n || Number.isNaN(n) || n < 0) return "—";
  if (n < 1000) return `${Math.round(n)}ms`;
  const s = n / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}
