if (typeof window !== "undefined") {
  throw new Error("lib/s3 is server-only — import lib/storage/client on the browser.");
}

function readEnv(name) {
  const direct = process.env[name];
  if (direct != null && String(direct).trim() !== "") return String(direct).trim();
  return "";
}

function readInt(name, def) {
  const raw = readEnv(name);
  if (!raw) return def;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

const REQUIRED = [
  ["endpoint", "S3_ENDPOINT"],
  ["region", "S3_REGION"],
  ["bucket", "S3_BUCKET"],
  ["accessKeyId", "S3_ACCESS_KEY_ID"],
  ["secretAccessKey", "S3_SECRET_ACCESS_KEY"],
];

export function isS3Configured() {
  return REQUIRED.every(([, name]) => readEnv(name) !== "");
}

let memo = null;

export function s3Config() {
  if (memo) return memo;
  const out = {};
  for (const [key, name] of REQUIRED) {
    out[key] = readEnv(name);
  }
  out.forcePathStyle = readEnv("S3_FORCE_PATH_STYLE") === ""
    ? true
    : !["false", "0", "no", "off"].includes(readEnv("S3_FORCE_PATH_STYLE").toLowerCase());
  out.signedUrlTtl = readInt("S3_SIGNED_URL_TTL", 3600);
  out.uploadUrlTtl = readInt("S3_UPLOAD_URL_TTL", 900);
  out.maxUploadBytes = readInt("S3_MAX_UPLOAD_BYTES", 524288000);
  out.presignedUploads = readEnv("S3_PRESIGNED_UPLOADS") === ""
    ? true
    : !["false", "0", "no", "off"].includes(readEnv("S3_PRESIGNED_UPLOADS").toLowerCase());
  out.presignedReads = readEnv("S3_PRESIGNED_READS") === ""
    ? true
    : !["false", "0", "no", "off"].includes(readEnv("S3_PRESIGNED_READS").toLowerCase());
  memo = Object.freeze(out);
  return memo;
}

export function resetS3ConfigCache() {
  memo = null;
}

const IMAGE_PREFIX = "image/";
const VIDEO_PREFIX = "video/";
const AUDIO_PREFIX = "audio/";

const EXPLICIT_ALLOWED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  "model/gltf-binary",
  "model/gltf+json",
  "model/obj",
  "model/mtl",
  "model/fbx",
]);

// Browsers report "" or application/octet-stream for types they cannot sniff
// (.arw, .blend, .glb, …). Only for those generic signals may the filename
// extension stand in — a concrete content type must allowlist on its own.
const GENERIC_CONTENT_TYPES = new Set(["", "application/octet-stream"]);

const EXTENSION_TO_TYPE = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image",
  svg: "image", avif: "image", bmp: "image", ico: "image", tif: "image",
  tiff: "image", heic: "image", heif: "image", psd: "image", ai: "image",
  fig: "image", sketch: "image",
  mp4: "video", mov: "video", webm: "video", mkv: "video", avi: "video",
  mp3: "audio", wav: "audio", flac: "audio", ogg: "audio", m4a: "audio",
  aac: "audio", opus: "audio",
  pdf: "pdf",
  doc: "document", docx: "document", txt: "document", md: "document",
  csv: "document", xls: "document", xlsx: "document", ppt: "document",
  pptx: "document",
  glb: "3d", gltf: "3d", obj: "3d", fbx: "3d", blend: "3d", usdz: "3d",
  stl: "3d",
  arw: "raw", cr2: "raw", cr3: "raw", nef: "raw", dng: "raw", raf: "raw",
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
};

export function assetTypeForContentType(contentType, filename = "") {
  const ct = String(contentType || "").toLowerCase().split(";")[0].trim();
  if (ct.startsWith(IMAGE_PREFIX)) return "image";
  if (ct.startsWith(VIDEO_PREFIX)) return "video";
  if (ct.startsWith(AUDIO_PREFIX)) return "audio";
  if (ct === "application/pdf") return "pdf";
  const ext = String(filename || "").split(".").pop().toLowerCase();
  if (ext && EXTENSION_TO_TYPE[ext]) return EXTENSION_TO_TYPE[ext];
  if (ct.startsWith("model/")) return "3d";
  if (ct.startsWith("text/")) return "document";
  return null;
}

export function isAllowedContentType(contentType, filename = "") {
  const ct = String(contentType || "").toLowerCase().split(";")[0].trim();
  if (ct.includes("\n") || ct.includes("\r")) return false;
  if (ct.startsWith(IMAGE_PREFIX) || ct.startsWith(VIDEO_PREFIX) || ct.startsWith(AUDIO_PREFIX)) return true;
  if (EXPLICIT_ALLOWED.has(ct)) return true;
  if (!GENERIC_CONTENT_TYPES.has(ct)) return false;
  const ext = String(filename || "").split(".").pop().toLowerCase();
  return Boolean(ext && EXTENSION_TO_TYPE[ext]);
}
