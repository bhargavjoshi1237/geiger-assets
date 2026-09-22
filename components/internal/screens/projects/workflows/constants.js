import {
  UploadCloud,
  ListChecks,
  BadgeCheck,
  XCircle,
  CalendarClock,
  CopyCheck,
  Archive,
  Gauge,
  Send,
  Share2,
  GitBranch,
  Mail,
  Tag,
  Bell,
  Timer,
  Webhook,
  PencilLine,
  CheckSquare,
  UserCheck,
  FolderInput,
  FileOutput,
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
    group: "Ingest & review",
    description: "A file lands in the library via upload or import.",
  },
  {
    key: "review.requested",
    label: "Review requested",
    icon: ListChecks,
    group: "Ingest & review",
    description: "An asset is submitted for review.",
  },
  {
    key: "asset.approved",
    label: "Asset approved",
    icon: BadgeCheck,
    group: "Ingest & review",
    description: "An asset passes review and is approved.",
  },
  {
    key: "asset.rejected",
    label: "Asset rejected",
    icon: XCircle,
    group: "Ingest & review",
    description: "An asset is sent back with change requests.",
  },
  {
    key: "license.expiring",
    label: "License expiring",
    icon: CalendarClock,
    group: "Lifecycle & rights",
    description: "A licensed asset approaches its expiry date.",
  },
  {
    key: "duplicate.detected",
    label: "Duplicate detected",
    icon: CopyCheck,
    group: "Lifecycle & rights",
    description: "A duplicate or near-duplicate group is detected.",
  },
  {
    key: "asset.archived",
    label: "Asset archived",
    icon: Archive,
    group: "Lifecycle & rights",
    description: "An asset is moved to the archive.",
  },
  {
    key: "storage.quota",
    label: "Storage threshold crossed",
    icon: Gauge,
    group: "Lifecycle & rights",
    description: "Project storage crosses a usage threshold.",
  },
  {
    key: "asset.published",
    label: "Asset published",
    icon: Send,
    group: "Delivery",
    description: "An approved asset is published to a channel.",
  },
  {
    key: "collection.shared",
    label: "Collection shared",
    icon: Share2,
    group: "Delivery",
    description: "A collection is shared with external stakeholders.",
  },
];

export const CONDITION_CATALOG = [
  {
    key: "if.asset_type",
    label: "If asset type",
    icon: GitBranch,
    description: "Branch on the asset's media type.",
    fields: [
      {
        key: "assetType",
        label: "Asset type",
        type: "select",
        options: ["Image", "Video", "Audio", "Document", "3D model", "Design source"],
        default: "Image",
      },
    ],
  },
  {
    key: "if.file_size",
    label: "If file size",
    icon: GitBranch,
    description: "Branch on the file size in megabytes.",
    fields: [
      {
        key: "operator",
        label: "Operator",
        type: "select",
        options: ["greater than", "less than", "equal to"],
        default: "greater than",
      },
      { key: "sizeMb", label: "Size (MB)", type: "number", default: "500" },
    ],
  },
  {
    key: "if.has_tag",
    label: "If has tag",
    icon: GitBranch,
    description: "Branch on whether the asset carries a tag.",
    fields: [{ key: "tag", label: "Tag", type: "text", default: "" }],
  },
  {
    key: "if.status",
    label: "If status",
    icon: GitBranch,
    description: "Branch on the asset's review status.",
    fields: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["draft", "review", "approved", "archived"],
        default: "review",
      },
    ],
  },
];

export const ACTION_CATALOG = [
  {
    key: "review.request",
    label: "Request approval",
    icon: UserCheck,
    group: "Review & routing",
    description: "Route the asset to a reviewer for approval.",
    fields: [{ key: "assignee", label: "Assignee", type: "text", default: "" }],
  },
  {
    key: "asset.move",
    label: "Move asset",
    icon: FolderInput,
    group: "Review & routing",
    description: "Move the asset to a destination folder.",
    fields: [{ key: "folder", label: "Folder", type: "text", default: "review" }],
  },
  {
    key: "asset.set_status",
    label: "Set status",
    icon: PencilLine,
    group: "Review & routing",
    description: "Change the asset's review status.",
    fields: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["draft", "review", "approved", "archived"],
        default: "review",
      },
    ],
  },
  {
    key: "tag.add",
    label: "Add tag",
    icon: Tag,
    group: "Review & routing",
    description: "Add a tag to the asset.",
    fields: [{ key: "tag", label: "Tag", type: "text", default: "" }],
  },
  {
    key: "tag.remove",
    label: "Remove tag",
    icon: Tag,
    group: "Review & routing",
    description: "Remove a tag from the asset.",
    fields: [{ key: "tag", label: "Tag", type: "text", default: "" }],
  },
  {
    key: "rendition.generate",
    label: "Generate rendition",
    icon: FileOutput,
    group: "Delivery & processing",
    description: "Generate a preset output from the source asset.",
    fields: [
      {
        key: "preset",
        label: "Preset",
        type: "select",
        options: ["Thumbnail S", "Preview L", "Social square", "Story 9:16", "Banner 21:9", "Print XL"],
        default: "Preview L",
      },
    ],
  },
  {
    key: "asset.publish",
    label: "Publish asset",
    icon: Send,
    group: "Delivery & processing",
    description: "Publish the asset to a delivery channel.",
    fields: [
      {
        key: "channel",
        label: "Channel",
        type: "select",
        options: ["CDN", "Brand portal", "Showcase gallery", "CMS"],
        default: "CDN",
      },
    ],
  },
  {
    key: "send.email",
    label: "Send email",
    icon: Mail,
    group: "Messaging",
    description: "Send a templated email to the stakeholder.",
    fields: [
      { key: "subject", label: "Subject", type: "text", default: "" },
      {
        key: "template",
        label: "Template",
        type: "select",
        options: ["Review request", "Approved", "Changes requested", "License expiring", "Custom"],
        default: "Review request",
      },
    ],
  },
  {
    key: "staff.notify",
    label: "Notify staff",
    icon: Bell,
    group: "Messaging",
    description: "Send an internal notification to your team.",
    fields: [
      { key: "channel", label: "Channel", type: "text", default: "#assets" },
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
  Review: { label: "Review", variant: "purple" },
  Rights: { label: "Rights", variant: "warning" },
  Delivery: { label: "Delivery", variant: "success" },
};

export const WORKFLOW_TEMPLATE_CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "Ingest", label: "Ingest" },
  { value: "Review", label: "Review" },
  { value: "Rights", label: "Rights" },
  { value: "Delivery", label: "Delivery" },
];

export const WORKFLOW_TEMPLATES = [
  {
    id: "tmpl_review_on_upload",
    name: "Review on upload",
    description:
      "Route every fresh upload to a reviewer and tag it so nothing slips through untagged.",
    category: "Review",
    trigger: "asset.uploaded",
    steps: [
      { kind: "trigger", type: "asset.uploaded", config: {} },
      {
        kind: "action",
        type: "review.request",
        config: { assignee: "editors" },
      },
      { kind: "action", type: "tag.add", config: { tag: "needs-review" } },
    ],
  },
  {
    id: "tmpl_photo_auto_tag",
    name: "Auto-tag incoming photos",
    description:
      "When an image lands in the library, tag it as a photo for smart collections.",
    category: "Ingest",
    trigger: "asset.uploaded",
    steps: [
      { kind: "trigger", type: "asset.uploaded", config: {} },
      {
        kind: "condition",
        type: "if.asset_type",
        config: { assetType: "Image" },
      },
      { kind: "action", type: "tag.add", config: { tag: "photo" } },
    ],
  },
  {
    id: "tmpl_publish_on_approval",
    name: "Publish when approved",
    description:
      "Generate a preview rendition the moment an asset is approved, then publish it to the CDN.",
    category: "Delivery",
    trigger: "asset.approved",
    steps: [
      { kind: "trigger", type: "asset.approved", config: {} },
      {
        kind: "action",
        type: "rendition.generate",
        config: { preset: "Preview L" },
      },
      {
        kind: "action",
        type: "asset.publish",
        config: { channel: "CDN" },
      },
    ],
  },
  {
    id: "tmpl_license_renewal",
    name: "License expiry nudge",
    description:
      "Email the stakeholder and alert your team before a licensed asset expires.",
    category: "Rights",
    trigger: "license.expiring",
    steps: [
      { kind: "trigger", type: "license.expiring", config: {} },
      {
        kind: "action",
        type: "send.email",
        config: { subject: "License expiring soon", template: "License expiring" },
      },
      {
        kind: "action",
        type: "staff.notify",
        config: { channel: "#assets", message: "A license is about to expire — check renewals." },
      },
    ],
  },
  {
    id: "tmpl_large_file_gate",
    name: "Large-file approval gate",
    description:
      "Flag uploads over 500 MB for approval and tag them so producers can triage.",
    category: "Review",
    trigger: "asset.uploaded",
    steps: [
      { kind: "trigger", type: "asset.uploaded", config: {} },
      {
        kind: "condition",
        type: "if.file_size",
        config: { operator: "greater than", sizeMb: "500" },
      },
      {
        kind: "action",
        type: "review.request",
        config: { assignee: "producers" },
      },
      { kind: "action", type: "tag.add", config: { tag: "large-file" } },
    ],
  },
  {
    id: "tmpl_duplicate_triage",
    name: "Duplicate triage",
    description:
      "Open a follow-up task and tag the asset when a duplicate group is detected.",
    category: "Ingest",
    trigger: "duplicate.detected",
    steps: [
      { kind: "trigger", type: "duplicate.detected", config: {} },
      {
        kind: "action",
        type: "task.create",
        config: { title: "Review duplicate group", assignee: "" },
      },
      { kind: "action", type: "tag.add", config: { tag: "possible-duplicate" } },
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
