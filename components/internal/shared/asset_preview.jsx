"use client";

import React, { useMemo, useState } from "react";
import { File } from "lucide-react";

import { TYPE_ICONS, DEFAULT_ASSET_COLOR, fileKind } from "@/components/internal/shared/asset_meta";
import { AudioPlayer } from "@/components/internal/shared/audio_player";
import { assetFileUrl } from "@/lib/storage/client";
import { cn } from "@/lib/utils";

function TypeGlyph({ type, color, className }) {
  const Icon = TYPE_ICONS[type] || File;
  return <Icon className={className} style={{ color: color || DEFAULT_ASSET_COLOR }} />;
}

// The file's own MIME/extension wins over the stored type, so an asset saved
// with the wrong type (e.g. an MP3 uploaded as "image") still previews right.
function previewKind(asset) {
  return fileKind({ mimeType: asset?.mimeType, format: asset?.format, name: asset?.originalFilename }) || asset?.type;
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
  const kind = previewKind(asset);

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

  if (kind === "image" && hasFile) {
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

  if (kind === "video" && hasFile) {
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

  if (kind === "audio" && hasFile) {
    return (
      <div
        className={cn(
          frameClass,
          "flex aspect-video flex-col items-center justify-center gap-5 p-6",
          frameless && "bg-surface-subtle",
        )}
        style={frameStyle}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-card">
          <TypeGlyph type="audio" color={asset?.color} className="h-7 w-7" />
        </div>
        <AudioPlayer src={fileUrl} onError={() => setFailed(true)} className="max-w-md" />
      </div>
    );
  }

  if (kind === "pdf" && hasFile) {
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
