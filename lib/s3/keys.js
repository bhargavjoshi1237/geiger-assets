if (typeof window !== "undefined") {
  throw new Error("lib/s3 is server-only — import lib/storage/client on the browser.");
}

const MAX_FILENAME_LEN = 180;

export function safeFilename(name) {
  let base = String(name ?? "").normalize("NFC").trim();
  if (!base) return "file";
  base = base.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
  base = base.replace(/[\\/]+/g, "-");
  base = base.replace(/^\.+/, "");
  base = base.replace(/\s+/g, " ").trim();
  if (!base) return "file";

  const dot = base.lastIndexOf(".");
  let stem = base;
  let ext = "";
  if (dot > 0 && dot < base.length - 1 && base.length - dot - 1 <= 12) {
    stem = base.slice(0, dot);
    ext = base.slice(dot);
  }
  ext = ext.replace(/[^A-Za-z0-9.]/g, "");
  stem = stem.replace(/[^A-Za-z0-9 _.\-()[\]{}+~!@#$%^&=',]/g, "").trim();
  stem = stem.replace(/\s+/g, " ");
  if (!stem) stem = "file";

  let out = stem + ext;
  if (out.length > MAX_FILENAME_LEN) {
    const keepExt = ext.slice(0, 12);
    out = stem.slice(0, MAX_FILENAME_LEN - keepExt.length).trimEnd() + keepExt;
  }
  return out || "file";
}

function cleanId(value, label) {
  const v = String(value ?? "").trim();
  if (!v) throw new Error(`keys: missing ${label}`);
  if (v.includes("/") || v.includes("..") || v.includes("\n") || v.includes("\r")) {
    throw new Error(`keys: invalid ${label}`);
  }
  return v;
}

export function assetKey({ projectId, assetId, versionNumber, filename }) {
  const p = cleanId(projectId, "projectId");
  const a = cleanId(assetId, "assetId");
  const v = Number(versionNumber);
  if (!Number.isInteger(v) || v < 1) throw new Error("keys: invalid versionNumber");
  return `p/${p}/a/${a}/v/${v}/${safeFilename(filename)}`;
}

export function stagingKey({ projectId, uploadJobId, filename }) {
  const p = cleanId(projectId, "projectId");
  const j = cleanId(uploadJobId, "uploadJobId");
  return `p/${p}/tmp/${j}/${safeFilename(filename)}`;
}

export function derivativeKey({ projectId, assetId, variant, ext }) {
  const p = cleanId(projectId, "projectId");
  const a = cleanId(assetId, "assetId");
  const v = String(variant ?? "").trim().replace(/[\\/]+/g, "-").replace(/[^A-Za-z0-9_\-]/g, "") || "default";
  const e = String(ext ?? "").trim().replace(/^\.+/, "").replace(/[^A-Za-z0-9]/g, "") || "bin";
  return `p/${p}/a/${a}/derivatives/${v}.${e}`;
}

const ASSET_RE = /^p\/([^/]+)\/a\/([^/]+)\/v\/(\d+)\/(.+)$/;
const STAGING_RE = /^p\/([^/]+)\/tmp\/([^/]+)\/(.+)$/;
const DERIV_RE = /^p\/([^/]+)\/a\/([^/]+)\/derivatives\/([^/]+)$/;

export function parseKey(key) {
  if (typeof key !== "string" || !key) return null;
  let m = ASSET_RE.exec(key);
  if (m) {
    return {
      projectId: m[1],
      assetId: m[2],
      versionNumber: Number(m[3]),
      filename: m[4],
      staging: false,
    };
  }
  m = STAGING_RE.exec(key);
  if (m) {
    return {
      projectId: m[1],
      assetId: null,
      uploadJobId: m[2],
      filename: m[3],
      versionNumber: null,
      staging: true,
    };
  }
  m = DERIV_RE.exec(key);
  if (m) {
    return {
      projectId: m[1],
      assetId: m[2],
      versionNumber: null,
      filename: m[3],
      derivative: true,
      staging: false,
    };
  }
  return null;
}
