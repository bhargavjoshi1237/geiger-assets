// Settings — config only, never row data.
//
// Option lists, frozen section-bag defaults (mirroring the
// assets.project_settings metadata bag), and formatters for the five settings
// screens. Fetched rows live in lib/supabase/project_settings.js; this file
// only describes the shape around them.

import { PAGE_SIZE_OPTIONS as PAGE_SIZE_VALUES } from "@/components/internal/shared/pagination";

export const PROJECT_VISIBILITY_OPTIONS = [
  { value: "private", label: "Private" },
  { value: "internal", label: "Internal" },
  { value: "public", label: "Public" },
];

export const PROJECT_REGION_OPTIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "eu-west-1", label: "EU West (Ireland)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
];

export const PAGE_SIZE_OPTIONS = PAGE_SIZE_VALUES.map((size) => ({
  value: String(size),
  label: `${size} per page`,
}));

export const FILE_TYPE_OPTIONS = [
  { value: "jpg", label: "JPEG images" },
  { value: "png", label: "PNG images" },
  { value: "gif", label: "GIF images" },
  { value: "webp", label: "WebP images" },
  { value: "svg", label: "SVG vectors" },
  { value: "heic", label: "HEIC photos" },
  { value: "mp4", label: "MP4 video" },
  { value: "mov", label: "MOV video" },
  { value: "webm", label: "WebM video" },
  { value: "mp3", label: "MP3 audio" },
  { value: "wav", label: "WAV audio" },
  { value: "pdf", label: "PDF documents" },
  { value: "docx", label: "Word documents" },
  { value: "pptx", label: "Presentations" },
  { value: "xlsx", label: "Spreadsheets" },
  { value: "txt", label: "Text files" },
  { value: "csv", label: "CSV data" },
  { value: "psd", label: "Photoshop files" },
  { value: "ai", label: "Illustrator files" },
  { value: "zip", label: "ZIP archives" },
];

export const SESSION_TIMEOUT_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "240", label: "4 hours" },
  { value: "480", label: "8 hours" },
  { value: "720", label: "12 hours" },
  { value: "1440", label: "24 hours" },
];

export const SHARE_EXPIRY_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "never", label: "Never" },
];

export const ROLE_COLOR_OPTIONS = [
  { value: "slate", label: "Slate" },
  { value: "red", label: "Red" },
  { value: "orange", label: "Orange" },
  { value: "amber", label: "Amber" },
  { value: "emerald", label: "Emerald" },
  { value: "sky", label: "Sky" },
  { value: "violet", label: "Violet" },
  { value: "pink", label: "Pink" },
];

// Security policy behind Permissions & Security → Security. Keys are the
// metadata.security bag.
export const DEFAULT_SECURITY_SETTINGS = Object.freeze({
  requireSignedUrls: false,
  shareRequirePassword: false,
  shareDefaultExpiry: "7",
  shareAllowDownloads: true,
  shareApplyWatermark: false,
  allowPublicGalleries: false,
  sessionTimeout: "480",
  enforceTwoFactor: false,
  ipAllowlist: [],
  virusScanUploads: true,
  blockExpiredRedownload: true,
});

// Operational toggles behind Advanced → Operations. Keys are the
// metadata.advanced bag.
export const DEFAULT_ADVANCED_SETTINGS = Object.freeze({
  readOnly: false,
  maintenanceMode: false,
  auditLogging: false,
  rateLimiting: false,
  requestSigning: false,
  webhookRetries: false,
});

// Add-on prefs behind Add-ons. Keys are the metadata.addons bag:
// { enabled: string[], navPositions: Record<string, number|null>, colors:
// Record<string, string|null> }.
export const DEFAULT_ADDON_PREFS = Object.freeze({
  enabled: ["brand-kit"],
  navPositions: {},
  colors: {},
});

// Usage & Storage: the promoted-column defaults plus the one bag value
// (metadata.usage = { allowedFileTypes }).
export const DEFAULT_USAGE_LIMITS = Object.freeze({
  storageQuotaGb: 500,
  maxUploadMb: 2048,
  trashRetentionDays: 30,
  autoArchiveDays: 0,
  quotaAlertPercent: 80,
  allowedFileTypes: FILE_TYPE_OPTIONS.map((o) => o.value),
});

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const value = n / 1024 ** i;
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
