"use client";

import React, { useMemo, useState } from "react";
import { File } from "lucide-react";

import { TYPE_ICONS, DEFAULT_ASSET_COLOR } from "@/components/internal/shared/asset_meta";
import { assetFileUrl } from "@/lib/storage/client";
import { cn } from "@/lib/utils";

function TypeGlyph({ type, color, className }) {
  const Icon = TYPE_ICONS[type] || File;
  return <Icon className={className} style={{ color: color || DEFAULT_ASSET_COLOR }} />;
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

export function AssetPreview({ asset, className, frameless = false }) {
  const [failed, setFailed] = useState(false);
  const fileUrl = useMemo(
    () => (asset?.id ? assetFileUrl(asset.id) : ""),
    [asset],
  );

  const hasFile = Boolean(asset?.storageKey && fileUrl && !failed);
  const thumb = asset?.thumbnailUrl || "";
  const assetColor = asset?.color || DEFAULT_ASSET_COLOR;

  const frameClass = cn(
    "overflow-hidden",
    !frameless && "rounded-xl border border-border",
    className,
  );
  const frameStyle = frameless
    ? undefined
    : {
        background: `linear-gradient(135deg, ${assetColor}15 0%, ${assetColor}08 100%)`,
        borderColor: `${assetColor}20`,
      };

  const mediaClass = frameless
    ? "h-auto max-h-[26rem] w-full object-contain"
    : "aspect-video w-full object-contain";

  if (!hasFile && !thumb) {
    return (
      <div
        className={cn(
          frameClass,
          "flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center",
          frameless && "bg-surface-card",
        )}
        style={frameStyle}
      >
        <TypeGlyph type={asset?.type} color={asset?.color} className="h-16 w-16" />
        <p className="text-xs text-text-tertiary">
          {failed
            ? "This file couldn't be loaded."
            : asset?.storageStatus === "pending"
              ? "File is still processing…"
              : "No file uploaded yet — no preview available."}
        </p>
      </div>
    );
  }

  if (failed && thumb) {
    return (
      <div className={frameClass} style={frameStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt={asset?.name || "Asset thumbnail"}
          className={mediaClass}
        />
      </div>
    );
  }

  if (isImage(asset) && hasFile) {
    return (
      <div className={frameClass} style={frameStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb || fileUrl}
          alt={asset?.name || "Asset preview"}
          className={mediaClass}
          onError={() => setFailed(true)}
        />
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
          className={cn(mediaClass, "bg-black object-contain")}
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
          frameless && "bg-surface-card",
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
          className={cn("w-full bg-white", frameless ? "h-[26rem]" : "aspect-video")}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  if (thumb) {
    return (
      <div className={frameClass} style={frameStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt={asset?.name || "Asset thumbnail"}
          className={mediaClass}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        frameClass,
        "flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center",
        frameless && "bg-surface-card",
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
