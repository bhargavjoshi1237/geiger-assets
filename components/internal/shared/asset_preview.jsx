"use client";

import { cn } from "@geiger/ui";
import React, { useMemo, useState } from "react";
import Image from "next/image";
import { File } from "lucide-react";

import { TYPE_ICONS } from "@/components/internal/screens/projects/library/constants";
import { assetFileUrl, assetVariantUrl } from "@/lib/storage/client";

// The preview frame is ~full width of a detail pane on desktop and edge-to-edge
// below it; the loader snaps that up to the nearest derived variant.
const PREVIEW_SIZES = "(min-width: 1024px) 60vw, 100vw";

function TypeGlyph({ type, color, className }) {
  const Icon = TYPE_ICONS[type] || File;
  return <Icon className={className} style={{ color: color || "#737373" }} />;
}

function isPdf(asset) {
  const mime = (asset?.mimeType || "").toLowerCase();
  const format = (asset?.format || "").toLowerCase();
  return mime.includes("pdf") || format === "pdf" || asset?.type === "pdf";
}

function isImage(asset) {
  const mime = (asset?.mimeType || "").toLowerCase();
  return asset?.type === "image" || mime.startsWith("image/");
}

function isVideo(asset) {
  const mime = (asset?.mimeType || "").toLowerCase();
  return asset?.type === "video" || mime.startsWith("video/");
}

function isAudio(asset) {
  const mime = (asset?.mimeType || "").toLowerCase();
  return asset?.type === "audio" || mime.startsWith("audio/");
}

export function AssetPreview({ asset, className }) {
  const [failed, setFailed] = useState(false);
  const fileUrl = useMemo(
    () => (asset?.id ? assetFileUrl(asset.id) : ""),
    [asset],
  );
  // Images render from the derived preview, never the original: an underived
  // row still resolves because the route streams the original server-side.
  const previewUrl = useMemo(
    () => (asset?.id ? assetVariantUrl(asset.id, "preview") : ""),
    [asset],
  );

  const hasFile = Boolean(asset?.storageKey && fileUrl && !failed);
  const thumb = asset?.thumbnailUrl || "";

  const frameClass = cn(
    "overflow-hidden rounded-xl border border-border",
    className,
  );
  const frameStyle = {
    background: `linear-gradient(135deg, ${asset?.color || "#737373"}15 0%, ${asset?.color || "#737373"}08 100%)`,
    borderColor: `${asset?.color || "#737373"}20`,
  };

  // No stored object and no thumbnail — show placeholder instead of a broken file URL.
  if (!hasFile && !thumb) {
    return (
      <div
        className={cn(
          frameClass,
          "flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center",
        )}
        style={frameStyle}
      >
        <TypeGlyph type={asset?.type} color={asset?.color} className="h-16 w-16" />
        <p className="text-xs text-text-tertiary">
          {asset?.storageStatus === "pending"
            ? "File is still processing…"
            : "No file uploaded yet — no preview available."}
        </p>
      </div>
    );
  }

  // Stored file failed to load (deleted object, 404) — fall back to thumbnail/icon.
  // Deliberately a plain <img>: this is the last rung of the fallback chain, so
  // it must request the stored thumbnailUrl verbatim rather than let the image
  // loader snap it back up to the variant that just failed.
  if (failed && thumb) {
    return (
      <div className={frameClass} style={frameStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt={asset?.name || "Asset thumbnail"}
          className="aspect-video w-full object-contain"
        />
      </div>
    );
  }

  if (isImage(asset) && hasFile) {
    return (
      <div className={frameClass} style={frameStyle}>
        <div className="relative aspect-video w-full">
          <Image
            src={previewUrl}
            alt={asset?.name || "Asset preview"}
            fill
            sizes={PREVIEW_SIZES}
            className="object-contain"
            onError={() => setFailed(true)}
          />
        </div>
      </div>
    );
  }

  if (isVideo(asset) && hasFile) {
    return (
      <div className={frameClass} style={frameStyle}>
        <video
          src={fileUrl}
          controls
          preload="metadata"
          className="aspect-video w-full bg-black"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  if (isAudio(asset) && hasFile) {
    return (
      <div
        className={cn(
          frameClass,
          "flex aspect-video flex-col items-center justify-center gap-4 p-6",
        )}
        style={frameStyle}
      >
        <TypeGlyph type={asset?.type} color={asset?.color} className="h-16 w-16" />
        <audio
          src={fileUrl}
          controls
          preload="metadata"
          className="w-full max-w-md"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  if (isPdf(asset) && hasFile) {
    return (
      <div className={frameClass} style={frameStyle}>
        <iframe
          src={fileUrl}
          title={asset?.name || "PDF preview"}
          className="aspect-video w-full bg-white"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  // Thumbnail-only, or a non-renderable type with a stored file.
  if (thumb) {
    return (
      <div className={frameClass} style={frameStyle}>
        <div className="relative aspect-video w-full">
          <Image
            src={thumb}
            alt={asset?.name || "Asset thumbnail"}
            fill
            sizes={PREVIEW_SIZES}
            className="object-contain"
            onError={() => setFailed(true)}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        frameClass,
        "flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center",
      )}
      style={frameStyle}
    >
      <TypeGlyph type={asset?.type} color={asset?.color} className="h-16 w-16" />
      <p className="text-xs text-text-tertiary">
        Preview isn&apos;t available for this file type.
      </p>
      {hasFile ? (
        <a
          href={assetFileUrl(asset.id, { download: true })}
          className="text-xs font-medium text-primary hover:underline"
        >
          Download to view
        </a>
      ) : null}
    </div>
  );
}

export default AssetPreview;
