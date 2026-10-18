import { Image, Film, Music, FileText, Boxes, File } from "lucide-react";

export const DEFAULT_ASSET_COLOR = "#737373";

export const TYPE_ICONS = {
  image: Image,
  video: Film,
  audio: Music,
  document: FileText,
  "3d": Boxes,
  raw: File,
  pdf: FileText,
  archive: File,
};

// Neutral on purpose: badges carry no per-type colour (see globals.css).
export const FILE_TYPE_COLORS = {
  image: "border-border bg-surface-card text-muted-foreground",
  video: "border-border bg-surface-card text-muted-foreground",
  audio: "border-border bg-surface-card text-muted-foreground",
  document: "border-border bg-surface-card text-muted-foreground",
  "3d": "border-border bg-surface-card text-muted-foreground",
  raw: "border-border bg-surface-card text-muted-foreground",
  archive: "border-border bg-surface-card text-muted-foreground",
  pdf: "border-border bg-surface-card text-muted-foreground",
};

export function assetTypeIcon(type) {
  return TYPE_ICONS[type] || File;
}

// Previewable kinds by extension — mirrors the server's EXTENSION_TO_TYPE for
// the formats a browser can actually render.
const PREVIEW_EXTENSIONS = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "ico", "svg"],
  video: ["mp4", "mov", "webm", "m4v"],
  audio: ["mp3", "wav", "flac", "ogg", "oga", "m4a", "aac", "opus", "weba"],
  pdf: ["pdf"],
};

// The kind of file an asset (or a picked File) really is: MIME first, then the
// extension. Null when neither says — callers fall back to the stored type.
export function fileKind({ mimeType, format, name } = {}) {
  const mime = String(mimeType || "").toLowerCase().split(";")[0].trim();
  if (mime === "application/pdf") return "pdf";
  for (const kind of ["image", "video", "audio"]) {
    if (mime.startsWith(`${kind}/`)) return kind;
  }
  const ext = String(format || String(name || "").split(".").pop() || "").toLowerCase();
  for (const [kind, exts] of Object.entries(PREVIEW_EXTENSIONS)) {
    if (exts.includes(ext)) return kind;
  }
  return null;
}
