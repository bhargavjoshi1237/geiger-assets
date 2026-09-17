// Lookups, filter options, and formatters for the Governance screens.
// Config only — never row data (that lives in the DB via lib/supabase/governance.js).

// Mirrors SOFT_DELETE_RETENTION_DAYS in lib/storage/reconcile.js. That module
// is server-only (it throws when imported in the browser), so the window is
// repeated here rather than imported — keep the two in lockstep.
export const RETENTION_SWEEP_DAYS = 30;
export const TMP_OBJECT_MAX_AGE_HOURS = 24;

export const OVERRIDE_SCOPE_MAP = {
  workspace: { label: "Workspace", className: "bg-violet-500/15 text-violet-300 border-violet-500/30", dotClass: "bg-violet-400" },
  folder: { label: "Folder", className: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  collection: { label: "Collection", className: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  asset: { label: "Asset", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-400" },
  portal: { label: "Portal", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  field: { label: "Field-level", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-400" },
};

export const OVERRIDE_EFFECT_MAP = {
  allow: { label: "Allow", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  deny: { label: "Deny", className: "bg-red-500/15 text-red-300 border-red-500/30", dotClass: "bg-red-400" },
};

export const SCOPE_FILTER_OPTIONS = [
  { value: "all", label: "All scopes" },
  { value: "workspace", label: "Workspace" },
  { value: "folder", label: "Folder" },
  { value: "collection", label: "Collection" },
  { value: "asset", label: "Asset" },
  { value: "portal", label: "Portal" },
  { value: "field", label: "Field-level" },
];

export const EFFECT_FILTER_OPTIONS = [
  { value: "all", label: "Allow + deny" },
  { value: "allow", label: "Allow" },
  { value: "deny", label: "Deny" },
];

export const PROTOCOL_MAP = {
  saml: { label: "SAML 2.0", className: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  oidc: { label: "OIDC", className: "bg-violet-500/15 text-violet-300 border-violet-500/30", dotClass: "bg-violet-400" },
  scim: { label: "SCIM 2.0", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
};

export const PROVIDER_STATUS_MAP = {
  active: { label: "Active", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  pending: { label: "Pending", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  disabled: { label: "Disabled", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const PROTOCOL_FILTER_OPTIONS = [
  { value: "all", label: "All protocols" },
  { value: "saml", label: "SAML 2.0" },
  { value: "oidc", label: "OIDC" },
  { value: "scim", label: "SCIM 2.0" },
];

export const PROVIDER_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "disabled", label: "Disabled" },
];

export const POLICY_SCOPE_MAP = {
  workspace: { label: "Workspace", className: "bg-violet-500/15 text-violet-300 border-violet-500/30", dotClass: "bg-violet-400" },
  folder: { label: "Folder", className: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  collection: { label: "Collection", className: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  asset_type: { label: "Asset type", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-400" },
};

export const POLICY_SCOPE_FILTER_OPTIONS = [
  { value: "all", label: "All scopes" },
  { value: "workspace", label: "Workspace" },
  { value: "folder", label: "Folder" },
  { value: "collection", label: "Collection" },
  { value: "asset_type", label: "Asset type" },
];

export const DISPOSITION_MAP = {
  retain: { label: "Retain", className: "bg-sky-500/15 text-sky-300 border-sky-500/30", dotClass: "bg-sky-400" },
  archive: { label: "Auto-archive", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  delete: { label: "Auto-delete", className: "bg-red-500/15 text-red-300 border-red-500/30", dotClass: "bg-red-400" },
};

export const DISPOSITION_FILTER_OPTIONS = [
  { value: "all", label: "All outcomes" },
  { value: "retain", label: "Retain" },
  { value: "archive", label: "Auto-archive" },
  { value: "delete", label: "Auto-delete" },
];

export const POLICY_STATE_MAP = {
  active: { label: "Active", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const HOLD_STATUS_MAP = {
  active: { label: "On hold", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", dotClass: "bg-amber-400" },
  released: { label: "Released", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", dotClass: "bg-zinc-500" },
};

export const HOLD_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All holds" },
  { value: "active", label: "On hold" },
  { value: "released", label: "Released" },
];

// Audit-trail verbs for legal_hold_events. Labels only — the rows themselves
// are written by lib/supabase/governance.js logLegalHoldEvent.
export const HOLD_EVENT_LABELS = {
  created: "Hold created",
  assets_added: "Assets added",
  assets_removed: "Assets removed",
  custodian_added: "Custodian added",
  custodian_removed: "Custodian removed",
  notified: "Notification sent",
  updated: "Hold updated",
  released: "Hold released",
};

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDays(n) {
  if (n === null || n === undefined || n === "") return "—";
  const days = Math.floor(Number(n));
  if (!Number.isFinite(days) || days < 0) return "—";
  if (days === 0) return "Off";
  return days === 1 ? "1 day" : `${days} days`;
}
