"use client";

// Browser-side image optimizer for the upload pipeline.
//
// Runs BEFORE the presigned-URL step so the bytes PUT directly to S3 are
// already Web Optimized. Uses createImageBitmap + canvas — universally
// available — and encodes to WebP (AVIF canvas encoding is still spotty
// across browsers; the server proxy path produces true AVIF for the
// `compressed` preset, so small proxy uploads still get the smallest format).
//
// Contract: (File|Blob, quality) -> File. Never throws — returns the
// original on any failure, so uploads always proceed.

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
        /* noop */
      }
    }
    if (!blob || blob.size <= 0) return input;
    // Guard against pathological growth on tiny inputs — keep the original
    // when re-encoding doesn't actually save bytes.
    if (blob.size >= input.size) return input;
    const filename = optimizedFilename(name, "webp");
    return new File([blob], filename, { type: "image/webp" });
  } catch {
    return input;
  }
}
