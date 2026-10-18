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
  ShoppingCart,
  ReceiptText,
  PackageCheck,
  Undo2,
  UserPlus,
  Download,
  StickyNote,
  Gem,
  Coins,
  FolderPlus,
  Tags,
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
  {
    key: "order.created",
    label: "Order placed",
    icon: ShoppingCart,
    group: "Commerce",
    description: "A buyer starts checkout from a gallery (not yet paid).",
  },
  {
    key: "order.paid",
    label: "Order paid",
    icon: ReceiptText,
    group: "Commerce",
    description: "Payment for a gallery order is confirmed and fulfilment has run.",
  },
  {
    key: "order.fulfilled",
    label: "Order fulfilled",
    icon: PackageCheck,
    group: "Commerce",
    description: "Every item on an order has been delivered.",
  },
  {
    key: "order.refunded",
    label: "Order refunded",
    icon: Undo2,
    group: "Commerce",
    description: "All or part of a paid order is refunded.",
  },
  {
    key: "license.purchased",
    label: "Licence purchased",
    icon: BadgeCheck,
    group: "Commerce",
    description: "A licence product is bought and its licence issued.",
  },
  {
    key: "customer.created",
    label: "New customer",
    icon: UserPlus,
    group: "Commerce",
    description: "Someone buys from a gallery for the first time.",
  },
  {
    key: "membership.subscribed",
    label: "Member joined a tier",
    icon: Gem,
    group: "Membership",
    description: "A fan joins or renews a tier on your creator page (free, trial or paid).",
  },
  {
    key: "membership.followed",
    label: "New follower",
    icon: UserPlus,
    group: "Membership",
    description: "A fan follows your creator page for free.",
  },
  {
    key: "membership.cancelled",
    label: "Membership cancelled",
    icon: XCircle,
    group: "Membership",
    description: "A fan cancels their membership from your creator page, with the reason they gave.",
  },
  {
    key: "membership.tipped",
    label: "Tip received",
    icon: Coins,
    group: "Membership",
    description: "A fan tips you on your profile, a post or a message.",
  },
  {
    key: "membership.unlocked",
    label: "Content unlocked",
    icon: BadgeCheck,
    group: "Membership",
    description: "A fan pays to unlock a pay-per-view post, a bundle or a locked message.",
  },
  {
    key: "membership.messaged",
    label: "Fan sent a message",
    icon: Send,
    group: "Membership",
    description: "A member messages you from their inbox on your creator page.",
  },
];

export const CONDITION_CATALOG = [
  {
    key: "if.asset_type",
    group: "Asset",
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
    group: "Asset",
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
    group: "Asset",
    label: "If has tag",
    icon: GitBranch,
    description: "Branch on whether the asset carries a tag.",
    fields: [{ key: "tag", label: "Tag", type: "text", default: "" }],
  },
  {
    key: "if.status",
    group: "Asset",
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
  {
    key: "if.order_total",
    group: "Commerce",
    label: "If order total",
    icon: GitBranch,
    description: "Branch on the order's total.",
    fields: [
      {
        key: "operator",
        label: "Operator",
        type: "select",
        options: ["greater than", "at least", "less than", "equal to"],
        default: "at least",
      },
      { key: "amount", label: "Amount", type: "number", default: "100" },
    ],
  },
  {
    key: "if.order_contains",
    group: "Commerce",
    label: "If order contains",
    icon: GitBranch,
    description: "Branch on the kind of product bought.",
    fields: [
      {
        key: "kind",
        label: "Product kind",
        type: "select",
        options: ["Download", "Licence", "Print", "Physical product", "Bundle", "Gallery unlock"],
        default: "Licence",
      },
    ],
  },
  {
    key: "if.order_gallery",
    group: "Commerce",
    label: "If from gallery",
    icon: GitBranch,
    description: "Branch on the gallery the order came from (name or slug).",
    fields: [{ key: "gallery", label: "Gallery", type: "text", default: "" }],
  },
  {
    key: "if.repeat_customer",
    group: "Commerce",
    label: "If repeat customer",
    icon: GitBranch,
    description: "Branch on how many orders the buyer has placed.",
    fields: [{ key: "minOrders", label: "At least (orders)", type: "number", default: "2" }],
  },
  {
    key: "if.discount_used",
    group: "Commerce",
    label: "If discount used",
    icon: GitBranch,
    description: "Branch on a discount code — leave empty for any code.",
    fields: [{ key: "code", label: "Code", type: "text", default: "" }],
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
  {
    key: "order.grant_downloads",
    label: "Grant downloads",
    icon: Download,
    group: "Commerce",
    description: "Give the buyer extra download links — a bonus rendition or the whole gallery.",
    fields: [
      {
        key: "scope",
        label: "Assets",
        type: "select",
        options: ["Purchased assets", "Whole gallery"],
        default: "Purchased assets",
      },
      {
        key: "rendition",
        label: "Rendition",
        type: "select",
        options: ["Original file", "Extra large (4096px)", "Large (2048px)", "Medium (1200px)", "Small web (800px)"],
        default: "Original file",
      },
      { key: "downloadLimit", label: "Download limit (0 = unlimited)", type: "number", default: "3" },
      { key: "expiryDays", label: "Expires after days (0 = never)", type: "number", default: "30" },
    ],
  },
  {
    key: "order.issue_license",
    label: "Issue licence",
    icon: BadgeCheck,
    group: "Commerce",
    description: "Issue a licence to the buyer for the order's assets.",
    fields: [
      { key: "template", label: "Licence template (name)", type: "text", default: "" },
      {
        key: "items",
        label: "Items",
        type: "select",
        options: ["Items without a licence", "Every item"],
        default: "Items without a licence",
      },
      { key: "durationMonths", label: "Duration (months, 0 = perpetual)", type: "number", default: "12" },
      {
        key: "usageType",
        label: "Usage",
        type: "select",
        options: ["Web", "Editorial", "Social", "Advertising", "Print", "Broadcast", "Internal"],
        default: "Web",
      },
    ],
  },
  {
    key: "order.mark_fulfilled",
    label: "Mark order fulfilled",
    icon: PackageCheck,
    group: "Commerce",
    description: "Close out every pending item on the order.",
    fields: [],
  },
  {
    key: "order.add_note",
    label: "Add order note",
    icon: StickyNote,
    group: "Commerce",
    description: "Write a line on the order's timeline.",
    fields: [{ key: "note", label: "Note", type: "textarea", default: "" }],
  },
  {
    key: "order.add_to_collection",
    label: "Add to collection",
    icon: FolderPlus,
    group: "Commerce",
    description: "Collect what was sold — the collection is created if it doesn't exist.",
    fields: [{ key: "collection", label: "Collection", type: "text", default: "Sold" }],
  },
  {
    key: "customer.tag",
    label: "Tag customer",
    icon: Tags,
    group: "Commerce",
    description: "Add a tag to the buyer's customer record.",
    fields: [{ key: "tag", label: "Tag", type: "text", default: "" }],
  },
  {
    key: "customer.grant_membership",
    label: "Grant membership",
    icon: Gem,
    group: "Commerce",
    description: "Enrol the buyer in a Membership tier.",
    fields: [
      { key: "tier", label: "Tier (name)", type: "text", default: "" },
      { key: "months", label: "Months (0 = tier interval)", type: "number", default: "1" },
    ],
  },
  {
    key: "royalty.accrue",
    label: "Accrue royalties",
    icon: Coins,
    group: "Commerce",
    description: "Accrue rightsholder royalties on the order's licences from your royalty rules.",
    fields: [],
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
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  Failed: {
    label: "Failed",
    variant: "danger",
    dotClass: "bg-red-400",
    iconClass: "text-red-600 dark:text-red-400",
  },
  Running: {
    label: "Running",
    variant: "info",
    dotClass: "bg-sky-400",
    iconClass: "text-sky-600 dark:text-sky-400",
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
