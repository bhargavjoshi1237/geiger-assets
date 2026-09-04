if (typeof window !== "undefined") {
  throw new Error("lib/s3 is server-only — import lib/storage/client on the browser.");
}

import { S3Client } from "@aws-sdk/client-s3";
import { s3Config, isS3Configured } from "./config.js";

export function s3Client() {
  if (!isS3Configured()) return null;
  const g = globalThis;
  if (g.__geigerS3Client) return g.__geigerS3Client;
  const cfg = s3Config();
  const client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    forcePathStyle: cfg.forcePathStyle,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    maxAttempts: 3,
    retryMode: "adaptive",
  });
  g.__geigerS3Client = client;
  return client;
}

export function resetS3ClientCache() {
  globalThis.__geigerS3Client = undefined;
}
