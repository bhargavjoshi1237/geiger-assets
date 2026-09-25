import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import {
  THUMBNAIL_BUCKET,
  removeThumbnailUrls,
  storeThumbnailVariants,
  thumbnailPathFromUrl,
} from "./thumbnail-store.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test("stores both preview sizes as AVIF in Supabase instead of the pool", async () => {
  const uploads = [];
  const storage = {
    from(bucket) {
      assert.equal(bucket, THUMBNAIL_BUCKET);
      return {
        async upload(path, body, options) {
          uploads.push({ path, body, options });
          return { error: null };
        },
        getPublicUrl(path) {
          return { data: { publicUrl: `https://storage.test/storage/v1/object/public/${bucket}/${path}` } };
        },
        async remove() {
          return { error: null };
        },
      };
    },
  };

  const result = await storeThumbnailVariants(storage, {
    projectId: "project-1",
    assetId: "asset-1",
    parts: [
      { kind: "preview", body: PNG },
      { kind: "mini", body: PNG },
    ],
  });

  assert.equal(uploads.length, 2);
  for (const upload of uploads) {
    assert.match(upload.path, /^p\/project-1\/thumb\/asset-1\/(preview|mini)-[\w-]+\.avif$/);
    assert.equal(upload.options.contentType, "image/avif");
    assert.equal((await sharp(upload.body).metadata()).format, "heif");
  }
  assert.match(result.urls.preview, /\.avif$/);
  assert.match(result.urls.mini, /\.avif$/);
  assert.equal(thumbnailPathFromUrl(result.urls.preview), result.paths.preview);
  assert.equal(thumbnailPathFromUrl("https://geiger.studio/api/storage/f/legacy"), null);
});

test("cleans up an uploaded preview if a later thumbnail fails", async () => {
  const removed = [];
  let uploads = 0;
  const storage = {
    from() {
      return {
        async upload() {
          uploads += 1;
          return { error: uploads === 2 ? new Error("Storage failed") : null };
        },
        getPublicUrl(path) {
          return { data: { publicUrl: `https://storage.test/storage/v1/object/public/${THUMBNAIL_BUCKET}/${path}` } };
        },
        async remove(paths) {
          removed.push(...paths);
          return { error: null };
        },
      };
    },
  };

  await assert.rejects(
    storeThumbnailVariants(storage, {
      projectId: "project-1",
      assetId: "asset-1",
      parts: [{ kind: "preview", body: PNG }, { kind: "mini", body: PNG }],
    }),
    /Storage failed/,
  );
  assert.equal(removed.length, 1);
  assert.match(removed[0], /\/preview-[\w-]+\.avif$/);
});

test("removes only Supabase thumbnails belonging to the requested asset", async () => {
  const removed = [];
  const storage = {
    from(bucket) {
      assert.equal(bucket, THUMBNAIL_BUCKET);
      return {
        async remove(paths) {
          removed.push(...paths);
          return { error: null };
        },
      };
    },
  };
  const base = `https://storage.test/storage/v1/object/public/${THUMBNAIL_BUCKET}/`;

  await removeThumbnailUrls(storage, [
    `${base}p/project-1/thumb/asset-1/preview-a.avif`,
    `${base}p/project-1/thumb/asset-2/preview-b.avif`,
    "https://geiger.studio/api/storage/f/legacy",
  ], "p/project-1/thumb/asset-1/");

  assert.deepEqual(removed, ["p/project-1/thumb/asset-1/preview-a.avif"]);
});
