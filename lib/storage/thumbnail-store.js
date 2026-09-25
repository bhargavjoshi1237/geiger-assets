import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

export const THUMBNAIL_BUCKET = "assets-thumbnails";
const PUBLIC_PATH = `/storage/v1/object/public/${THUMBNAIL_BUCKET}/`;

export function thumbnailAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase thumbnail storage is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function thumbnailPathFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    if (!pathname.startsWith(PUBLIC_PATH)) return null;
    const path = decodeURIComponent(pathname.slice(PUBLIC_PATH.length));
    return path.startsWith("p/") && !path.includes("..") ? path : null;
  } catch {
    return null;
  }
}

export async function removeThumbnailUrls(storage, urls, assetPrefix) {
  const paths = [...new Set(urls.map(thumbnailPathFromUrl).filter(
    (path) => path?.startsWith(assetPrefix),
  ))];
  if (!paths.length) return;
  const { error } = await storage.from(THUMBNAIL_BUCKET).remove(paths);
  if (error) throw error;
}

export async function storeThumbnailVariants(storage, { projectId, assetId, parts }) {
  const bucket = storage.from(THUMBNAIL_BUCKET);
  const paths = {};
  const urls = {};
  const folder = `p/${projectId}/thumb/${assetId}/`;

  const outcomes = await Promise.allSettled(parts.map(async ({ kind, body }) => {
    if (kind !== "preview" && kind !== "mini") throw new Error("Unknown thumbnail kind.");
    const dimension = kind === "mini" ? 96 : 512;
    const image = await sharp(body, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize(dimension, dimension, {
        fit: kind === "mini" ? "cover" : "inside",
        withoutEnlargement: kind !== "mini",
      })
      .avif({ quality: kind === "mini" ? 55 : 65, effort: 4 })
      .toBuffer();
    const path = `${folder}${kind}-${randomUUID()}.avif`;
    const { error } = await bucket.upload(path, image, {
      contentType: "image/avif",
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw error;
    paths[kind] = path;
    const url = bucket.getPublicUrl(path).data?.publicUrl;
    if (!url) throw new Error("Supabase returned no thumbnail URL.");
    urls[kind] = url;
  }));
  const failed = outcomes.find((outcome) => outcome.status === "rejected");
  if (failed) {
    const uploaded = Object.values(paths);
    if (uploaded.length) {
      const cleanup = await bucket.remove(uploaded);
      if (cleanup.error) console.error("[storage.thumbnail.cleanup]", cleanup.error.message);
    }
    throw failed.reason;
  }
  return { paths, urls };
}
