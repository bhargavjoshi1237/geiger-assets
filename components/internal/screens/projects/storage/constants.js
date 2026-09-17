// Lookups, filter options, and formatters for the storage backends screen.
// Config only — never row data (that comes from the API via
// lib/storage/backends_client.js).

// Health is a tri-state: probed-good, probed-bad, and never probed. The third
// is not a failure — pool placement treats an unprobed backend as eligible, so
// the pill must not read as an alarm.
export const BACKEND_HEALTH_MAP = {
  healthy: { label: "Healthy", variant: "success", dotClass: "bg-emerald-400" },
  failing: { label: "Failing", variant: "danger", dotClass: "bg-red-400" },
  unchecked: { label: "Not checked", variant: "neutral", dotClass: "bg-zinc-400" },
};

export function backendHealthState(backend) {
  if (backend?.healthOk === true) return "healthy";
  if (backend?.healthOk === false) return "failing";
  return "unchecked";
}

export const BACKEND_KIND_MAP = {
  s3: {
    label: "S3",
    description: "Any S3-compatible endpoint — AWS, Cloudflare R2, MinIO, Appwrite.",
  },
  rest: {
    label: "REST",
    description: "A generic HTTP file service that speaks PUT or multipart POST.",
  },
};

export const KIND_FILTER_OPTIONS = [
  { value: "all", label: "All kinds" },
  { value: "s3", label: "S3" },
  { value: "rest", label: "REST" },
];

export const HEALTH_FILTER_OPTIONS = [
  { value: "all", label: "All health" },
  { value: "healthy", label: "Healthy" },
  { value: "failing", label: "Failing" },
  { value: "unchecked", label: "Not checked" },
];

export const SCOPE_FILTER_OPTIONS = [
  { value: "all", label: "All scopes" },
  { value: "project", label: "This project" },
  { value: "suite", label: "Suite-wide" },
];

// Wording taken from lib/storage/pool.js, which is where placement actually
// happens — the hints have to describe the code, not a paraphrase of it.
export const POOL_STRATEGY_MAP = {
  failover: {
    label: "Failover",
    hint: "Lowest priority number wins; the rest are standby.",
  },
  spread: {
    label: "Spread",
    hint: "Capacity aggregation — placement is shared across members in proportion to weight.",
  },
  mirror: {
    label: "Mirror",
    hint: "Redundancy — the object is written to every member, and a read falls through to whichever copy answers.",
  },
};

export const POOL_STRATEGY_OPTIONS = Object.entries(POOL_STRATEGY_MAP).map(
  ([value, meta]) => ({ value, label: meta.label }),
);

// Weight is only consulted by the weighted pick that `spread` uses; under
// failover and mirror it is dead config, so the UI hides the control.
export const WEIGHTED_STRATEGIES = ["spread"];

export const CAPABILITY_LABELS = {
  presignedReads: "Presigned reads",
  presignedWrites: "Presigned writes",
  multipart: "Multipart",
  range: "Range requests",
  list: "Listing",
  copy: "Copy",
  removePrefix: "Prefix delete",
};

// Suite-wide rows carry no project, and every write path (edit, disable, delete,
// and the health probe, which records its result on the row) is authorized
// against a project. The API therefore refuses all of them by design, so the
// screen disables them rather than offering an action that always 403s.
export const SUITE_WIDE_HINT =
  "Suite-wide backends are shared by every Geiger product and seeded in SQL. They're read-only here — editing, disabling, deleting, and health probes all need project-scoped write access the API withholds for them.";

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return "—";
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

export function formatWhen(iso) {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "never";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
