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

export const FILE_TYPE_COLORS = {
  image: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  video: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  audio: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  document: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "3d": "bg-rose-500/15 text-rose-300 border-rose-500/30",
  raw: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  archive: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
  pdf: "bg-red-500/15 text-red-300 border-red-500/30",
};

export function assetTypeIcon(type) {
  return TYPE_ICONS[type] || File;
}
