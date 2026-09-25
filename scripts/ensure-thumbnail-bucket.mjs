import { createClient } from "@supabase/supabase-js";

const BUCKET = "assets-thumbnails";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

const storage = createClient(url, key).storage;
const { data: buckets, error: listError } = await storage.listBuckets();
if (listError) throw listError;

const existing = buckets.find((bucket) => bucket.id === BUCKET);
if (!existing) {
  const { error } = await storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ["image/avif"],
    fileSizeLimit: 2 * 1024 * 1024,
  });
  if (error) throw error;
  console.log(`Created ${BUCKET} bucket.`);
} else {
  if (!existing.public) throw new Error(`${BUCKET} exists but is private.`);
  console.log(`${BUCKET} bucket is ready.`);
}
