"use client";

import { normalizeQuality, shouldOptimizeFile, optimizedFilename } from "@/lib/storage/presets";

const CLIENT_PRESET = {
  web: { maxDimension: 2048, quality: 0.82 },
  compressed: { maxDimension: 1600, quality: 0.65 },
};

function drawToCanvas(bitmap, maxDimension) {
  const { width, height } = bitmap;
  const longest = Math.max(width, height);
  const scale =
    Number(maxDimension) > 0 && longest > maxDimension ? maxDimension / longest : 1;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

function canvasToWebpBlob(canvas, quality) {
  if (typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type: "image/webp", quality });
  }
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/webp", quality);
    } catch {
      resolve(null);
    }
  });
}

const THUMBNAIL = { maxDimension: 512, quality: 0.7 };
// Centre-cropped 96px tile for list rows.
const MINI_THUMBNAIL = { size: 96, quality: 0.6 };

// Cover-fit the bitmap into a size×size square, cropping the overflow.
function drawSquareToCanvas(bitmap, size) {
  const { width, height } = bitmap;
  const side = Math.min(width, height);
  const out = Math.max(1, Math.min(size, side));
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, (width - side) / 2, (height - side) / 2, side, side, 0, 0, out, out);
  return canvas;
}

// Skip previews that are larger than their source.
async function encodeSmaller(canvas, quality, sourceSize) {
  if (!canvas) return null;
  const blob = await canvasToWebpBlob(canvas, quality).catch(() => null);
  if (!blob || blob.size <= 0 || blob.size >= sourceSize) return null;
  return blob;
}

// Create WebP intermediates for the server to store as AVIF; unsupported images return null.
export async function makeThumbnails(input) {
  try {
    if (!(input instanceof Blob)) return null;
    if (typeof window === "undefined" || typeof document === "undefined") return null;
    if (typeof createImageBitmap !== "function") return null;
    const contentType = input.type || "";
    if (!contentType.toLowerCase().startsWith("image/")) return null;

    const bitmap = await createImageBitmap(input).catch(() => null);
    if (!bitmap) return null;
    try {
      const preview = await encodeSmaller(
        drawToCanvas(bitmap, THUMBNAIL.maxDimension),
        THUMBNAIL.quality,
        input.size,
      );
      const mini = await encodeSmaller(
        drawSquareToCanvas(bitmap, MINI_THUMBNAIL.size),
        MINI_THUMBNAIL.quality,
        input.size,
      );
      return preview || mini ? { preview, mini } : null;
    } finally {
      try {
        bitmap.close?.();
      } catch {
      }
    }
  } catch {
    return null;
  }
}

export async function optimizeImageForUpload(input, quality) {
  const q = normalizeQuality(quality);
  try {
    if (q === "original") return input;
    if (!(input instanceof Blob)) return input;
    if (typeof window === "undefined" || typeof document === "undefined") return input;
    if (typeof createImageBitmap !== "function") return input;
    const contentType = input.type || "application/octet-stream";
    const name = input.name || "file";
    if (!shouldOptimizeFile({ contentType, filename: name }, q)) return input;

    const preset = CLIENT_PRESET[q] || CLIENT_PRESET.web;
    const bitmap = await createImageBitmap(input).catch(() => null);
    if (!bitmap) return input;
    let blob = null;
    try {
      const canvas = drawToCanvas(bitmap, preset.maxDimension);
      if (!canvas) return input;
      blob = await canvasToWebpBlob(canvas, preset.quality);
    } finally {
      try {
        bitmap.close?.();
      } catch {
      }
    }
    if (!blob || blob.size <= 0) return input;

    if (blob.size >= input.size) return input;
    const filename = optimizedFilename(name, "webp");
    return new File([blob], filename, { type: "image/webp" });
  } catch {
    return input;
  }
}
