if (typeof window !== "undefined") {
  throw new Error("lib/media/probe is server-only — probing reads raw upload bytes in Node.");
}

// Ingest-time inspection for uploads: what the bytes actually are, not what
// the uploader claimed. Detection here never trusts the caller-supplied
// content type or filename — those are only compared later in typeMismatch,
// which is the anti-spoofing check.
//
// Contract: probeFile never throws (null on any failure) so a probing bug can
// never block an upload. Only raster stills go through sharp; everything else
// is signature + byte parsing so video/audio/archives never pay decode cost.

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod?.default || mod;
  } catch (e) {
    console.error("[media.probe] sharp unavailable", e?.message || e);
    return null;
  }
}

// Only the head is ever sniffed: every covered signature lives in the first
// bytes, so a small window keeps large-video uploads from being scanned fully.
const HEAD_BYTES = 64 * 1024;

// Browsers report these when they cannot sniff a type — a missing signal, not
// a claim, so it must never count as a mismatch in typeMismatch.
const GENERIC_TYPES = new Set(["", "application/octet-stream"]);

// Equivalent spellings of one format. Compared canonically so an uploader
// declaring image/jpg for real image/jpeg bytes is not flagged as hostile.
const MIME_ALIASES = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/vnd.microsoft.icon": "image/x-icon",
  "image/x-tiff": "image/tiff",
  "image/heif": "image/heic",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/vnd.wave": "audio/wav",
  "audio/x-flac": "audio/flac",
  "audio/mp3": "audio/mpeg",
  "audio/x-mp3": "audio/mpeg",
  "audio/x-m4a": "audio/mp4",
  "application/x-zip-compressed": "application/zip",
  "application/x-gzip": "application/gzip",
  "application/tar": "application/x-tar",
  "video/mkv": "video/x-matroska",
  "audio/3gpp": "video/3gpp",
};

function normMime(value) {
  return String(value || "").toLowerCase().split(";")[0].trim();
}

function canonMime(value) {
  const n = normMime(value);
  return MIME_ALIASES[n] || n;
}

// Expected type per filename extension. Kinds mirror EXTENSION_TO_TYPE in
// lib/s3/config.js so the two agree; the exe row exists only so a renamed
// executable is a comparable claim (its kind is null — outside the asset
// vocabulary — which is exactly what makes it mismatch an image probe).
const EXT_EXPECTED = {
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  png: { mime: "image/png", kind: "image" },
  gif: { mime: "image/gif", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
  svg: { mime: "image/svg+xml", kind: "image" },
  avif: { mime: "image/avif", kind: "image" },
  bmp: { mime: "image/bmp", kind: "image" },
  ico: { mime: "image/x-icon", kind: "image" },
  tif: { mime: "image/tiff", kind: "image" },
  tiff: { mime: "image/tiff", kind: "image" },
  heic: { mime: "image/heic", kind: "image" },
  heif: { mime: "image/heif", kind: "image" },
  psd: { mime: "image/vnd.adobe.photoshop", kind: "image" },
  ai: { mime: "application/postscript", kind: "image" },
  fig: { mime: "application/x-fig", kind: "image" },
  sketch: { mime: "application/x-sketch", kind: "image" },
  mp4: { mime: "video/mp4", kind: "video" },
  mov: { mime: "video/quicktime", kind: "video" },
  webm: { mime: "video/webm", kind: "video" },
  mkv: { mime: "video/x-matroska", kind: "video" },
  avi: { mime: "video/x-msvideo", kind: "video" },
  mp3: { mime: "audio/mpeg", kind: "audio" },
  wav: { mime: "audio/wav", kind: "audio" },
  flac: { mime: "audio/flac", kind: "audio" },
  ogg: { mime: "audio/ogg", kind: "audio" },
  ogv: { mime: "video/ogg", kind: "video" },
  m4a: { mime: "audio/mp4", kind: "audio" },
  aac: { mime: "audio/aac", kind: "audio" },
  opus: { mime: "audio/opus", kind: "audio" },
  pdf: { mime: "application/pdf", kind: "pdf" },
  doc: { mime: "application/msword", kind: "document" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "document" },
  txt: { mime: "text/plain", kind: "document" },
  md: { mime: "text/markdown", kind: "document" },
  csv: { mime: "text/csv", kind: "document" },
  xls: { mime: "application/vnd.ms-excel", kind: "document" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "document" },
  ppt: { mime: "application/vnd.ms-powerpoint", kind: "document" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kind: "document" },
  glb: { mime: "model/gltf-binary", kind: "3d" },
  gltf: { mime: "model/gltf+json", kind: "3d" },
  obj: { mime: "model/obj", kind: "3d" },
  fbx: { mime: "model/fbx", kind: "3d" },
  blend: { mime: "application/x-blender", kind: "3d" },
  usdz: { mime: "model/vnd.usdz+zip", kind: "3d" },
  stl: { mime: "model/stl", kind: "3d" },
  arw: { mime: "image/x-sony-arw", kind: "raw" },
  cr2: { mime: "image/x-canon-cr2", kind: "raw" },
  cr3: { mime: "image/x-canon-cr3", kind: "raw" },
  nef: { mime: "image/x-nikon-nef", kind: "raw" },
  dng: { mime: "image/x-adobe-dng", kind: "raw" },
  raf: { mime: "image/x-fuji-raf", kind: "raw" },
  zip: { mime: "application/zip", kind: "archive" },
  rar: { mime: "application/x-rar-compressed", kind: "archive" },
  "7z": { mime: "application/x-7z-compressed", kind: "archive" },
  tar: { mime: "application/x-tar", kind: "archive" },
  gz: { mime: "application/gzip", kind: "archive" },
  tgz: { mime: "application/gzip", kind: "archive" },
  exe: { mime: "application/x-msdownload", kind: null },
};

const OOXML_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function isOoxmlMime(mime) {
  return OOXML_MIMES.has(canonMime(mime));
}

function expectedForFilename(filename) {
  try {
    const name = String(filename || "");
    if (!name) return null;
    const base = name.split("/").pop().split("\\").pop();
    const dot = base.lastIndexOf(".");
    // Dotfiles and trailing dots carry no type signal.
    if (dot <= 0 || dot === base.length - 1) return null;
    const ext = base.slice(dot + 1).toLowerCase();
    // Garbage extensions are not a type claim worth flagging.
    if (!ext || ext.length > 10 || /[^a-z0-9]/.test(ext)) return null;
    const found = EXT_EXPECTED[ext];
    if (!found) return null;
    return { ext, base, mime: found.mime, kind: found.kind };
  } catch {
    return null;
  }
}

function emptyExif() {
  return {
    capturedAt: null,
    cameraMake: null,
    cameraModel: null,
    lens: null,
    iso: null,
    fNumber: null,
    exposureTime: null,
    focalLength: null,
    gps: null,
  };
}

// EXIF and camera RAW share the TIFF IFD layout, so one bounds-checked reader
// serves both the DNG check and the metadata parse below.
const TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function tiffCursor(buf, tiffStart) {
  try {
    if (!buf || buf.length < tiffStart + 8) return null;
    const b0 = buf[tiffStart];
    const b1 = buf[tiffStart + 1];
    let le;
    if (b0 === 0x49 && b1 === 0x49) le = true;
    else if (b0 === 0x4d && b1 === 0x4d) le = false;
    else return null;
    const magic = le ? buf.readUInt16LE(tiffStart + 2) : buf.readUInt16BE(tiffStart + 2);
    if (magic !== 42) return null;
    const ifd0 = le ? buf.readUInt32LE(tiffStart + 4) : buf.readUInt32BE(tiffStart + 4);
    if (ifd0 > buf.length) return null;
    return { le, ifd0 };
  } catch {
    return null;
  }
}

function readIfdEntries(buf, tiffStart, ifdOffset, le) {
  const out = [];
  try {
    const base = tiffStart + ifdOffset;
    if (base + 2 > buf.length) return out;
    const count = le ? buf.readUInt16LE(base) : buf.readUInt16BE(base);
    // Corrupt EXIF can claim millions of entries — cap before looping.
    if (count > 300) return out;
    let pos = base + 2;
    for (let i = 0; i < count; i++) {
      if (pos + 12 > buf.length) break;
      const tag = le ? buf.readUInt16LE(pos) : buf.readUInt16BE(pos);
      const type = le ? buf.readUInt16LE(pos + 2) : buf.readUInt16BE(pos + 2);
      const n = le ? buf.readUInt32LE(pos + 4) : buf.readUInt32BE(pos + 4);
      const size = TYPE_SIZES[type];
      if (!size || n === 0 || n > 100000) {
        pos += 12;
        continue;
      }
      const total = size * n;
      let valPos;
      if (total <= 4) {
        valPos = pos + 8;
      } else {
        const off = le ? buf.readUInt32LE(pos + 8) : buf.readUInt32BE(pos + 8);
        if (off > buf.length) {
          pos += 12;
          continue;
        }
        valPos = tiffStart + off;
        if (valPos + total > buf.length) {
          pos += 12;
          continue;
        }
      }
      out.push({ tag, type, count: n, valPos });
      pos += 12;
    }
  } catch {
    // Malformed directories degrade to "no entries", never a throw.
  }
  return out;
}

// DNG keeps any maker's name, so the version tag is the only definitive
// signal — check it before falling back to make-string sniffing.
function hasDngVersion(head) {
  try {
    const cur = tiffCursor(head, 0);
    if (!cur) return false;
    return readIfdEntries(head, 0, cur.ifd0, cur.le).some((e) => e.tag === 0xc612);
  } catch {
    return false;
  }
}

function readAscii(buf, valPos, count) {
  try {
    if (valPos + count > buf.length) return null;
    const raw = buf.toString("latin1", valPos, valPos + count);
    const s = raw.split("\0")[0].trim().replace(/\s+/g, " ");
    // Free-form EXIF text lands in the DB — cap it so a corrupt count cannot
    // stuff kilobytes into a row.
    return s ? s.slice(0, 128) : null;
  } catch {
    return null;
  }
}

function readFirstNumber(buf, entry, le) {
  try {
    if (entry.type === 3) return le ? buf.readUInt16LE(entry.valPos) : buf.readUInt16BE(entry.valPos);
    if (entry.type === 4) return le ? buf.readUInt32LE(entry.valPos) : buf.readUInt32BE(entry.valPos);
    if (entry.type === 9) return le ? buf.readInt32LE(entry.valPos) : buf.readInt32BE(entry.valPos);
    if (entry.type === 1 || entry.type === 7) return buf[entry.valPos];
    return null;
  } catch {
    return null;
  }
}

function readRational(buf, valPos, le, signed) {
  try {
    if (valPos + 8 > buf.length) return null;
    const num = signed
      ? (le ? buf.readInt32LE(valPos) : buf.readInt32BE(valPos))
      : (le ? buf.readUInt32LE(valPos) : buf.readUInt32BE(valPos));
    const den = signed
      ? (le ? buf.readInt32LE(valPos + 4) : buf.readInt32BE(valPos + 4))
      : (le ? buf.readUInt32LE(valPos + 4) : buf.readUInt32BE(valPos + 4));
    if (!den) return null;
    const v = num / den;
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function readRationalTag(buf, entry, le) {
  try {
    if (entry.type === 5 || entry.type === 10) {
      return readRational(buf, entry.valPos, le, entry.type === 10);
    }
    // Some writers store these as SHORT/LONG — accept the first value.
    if (entry.type === 3 || entry.type === 4 || entry.type === 9) {
      return readFirstNumber(buf, entry, le);
    }
    return null;
  } catch {
    return null;
  }
}

function parseExifDate(value) {
  try {
    if (!value || typeof value !== "string") return null;
    const m = value.trim().match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    if (!Number.isFinite(t)) return null;
    const d = new Date(t);
    // Reject overflow normalisation (month 13 becoming next January, …).
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    // EXIF carries no zone — treat wall-clock as UTC so the stored value is
    // stable regardless of server timezone.
    return d.toISOString();
  } catch {
    return null;
  }
}

function dmsToDecimal(dms, ref, isLat) {
  try {
    if (!Array.isArray(dms) || dms.length < 3) return null;
    const [d, m, s] = dms;
    if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(s)) return null;
    let v = Math.abs(d) + Math.abs(m) / 60 + Math.abs(s) / 3600;
    const r = String(ref || "").toUpperCase();
    if (r === "S" || r === "W") v = -v;
    else if ((isLat && r !== "N") || (!isLat && r !== "E")) return null;
    if (!Number.isFinite(v)) return null;
    if (isLat && (v < -90 || v > 90)) return null;
    if (!isLat && (v < -180 || v > 180)) return null;
    return v;
  } catch {
    return null;
  }
}

// Parses sharp's EXIF payload. Malformed directories yield null fields — a
// corrupt metadata block must never fail the upload.
function readExif(exifBuf) {
  const exif = emptyExif();
  let orientation = null;
  try {
    let buf = null;
    if (Buffer.isBuffer(exifBuf)) buf = exifBuf;
    else if (exifBuf instanceof Uint8Array) buf = Buffer.from(exifBuf);
    if (!buf || buf.length < 12) return { exif, orientation };
    // Sharp hands back the JPEG APP1 payload including its Exif header.
    let tiffStart = 0;
    if (
      buf.length >= 6 &&
      buf[0] === 0x45 && buf[1] === 0x78 && buf[2] === 0x69 &&
      buf[3] === 0x66 && buf[4] === 0x00 && buf[5] === 0x00
    ) {
      tiffStart = 6;
    }
    const cur = tiffCursor(buf, tiffStart);
    if (!cur) return { exif, orientation };
    const ifd0 = readIfdEntries(buf, tiffStart, cur.ifd0, cur.le);
    const find = (tag) => ifd0.find((e) => e.tag === tag) || null;

    const orientEntry = find(0x0112);
    if (orientEntry) {
      const v = readFirstNumber(buf, orientEntry, cur.le);
      if (Number.isInteger(v) && v >= 1 && v <= 8) orientation = v;
    }
    const makeEntry = find(0x010f);
    if (makeEntry && (makeEntry.type === 2 || makeEntry.type === 7)) {
      exif.cameraMake = readAscii(buf, makeEntry.valPos, makeEntry.count);
    }
    const modelEntry = find(0x0110);
    if (modelEntry && (modelEntry.type === 2 || modelEntry.type === 7)) {
      exif.cameraModel = readAscii(buf, modelEntry.valPos, modelEntry.count);
    }

    const exifPtr = find(0x8769);
    if (exifPtr) {
      const off = readFirstNumber(buf, exifPtr, cur.le);
      if (Number.isInteger(off) && off >= 0) {
        const entries = readIfdEntries(buf, tiffStart, off, cur.le);
        const sub = (tag) => entries.find((e) => e.tag === tag) || null;
        const dto = sub(0x9003);
        const dtd = sub(0x9004);
        const dt = dto || dtd;
        if (dt && (dt.type === 2 || dt.type === 7)) {
          exif.capturedAt = parseExifDate(readAscii(buf, dt.valPos, dt.count));
        }
        if (!exif.capturedAt) {
          const top = find(0x0132);
          if (top && (top.type === 2 || top.type === 7)) {
            exif.capturedAt = parseExifDate(readAscii(buf, top.valPos, top.count));
          }
        }
        const isoEntry = sub(0x8827);
        if (isoEntry) {
          const v = readFirstNumber(buf, isoEntry, cur.le);
          exif.iso = Number.isFinite(v) && v > 0 ? v : null;
        }
        const fEntry = sub(0x829d);
        if (fEntry) exif.fNumber = readRationalTag(buf, fEntry, cur.le);
        const eEntry = sub(0x829a);
        if (eEntry) exif.exposureTime = readRationalTag(buf, eEntry, cur.le);
        const flEntry = sub(0x920a);
        if (flEntry) exif.focalLength = readRationalTag(buf, flEntry, cur.le);
        const lensEntry = sub(0xa434) || sub(0xa433);
        if (lensEntry && (lensEntry.type === 2 || lensEntry.type === 7)) {
          exif.lens = readAscii(buf, lensEntry.valPos, lensEntry.count);
        }
      }
    }

    const gpsPtr = find(0x8825);
    if (gpsPtr) {
      const off = readFirstNumber(buf, gpsPtr, cur.le);
      if (Number.isInteger(off) && off >= 0) {
        const entries = readIfdEntries(buf, tiffStart, off, cur.le);
        const sub = (tag) => entries.find((e) => e.tag === tag) || null;
        const latRef = sub(0x0001);
        const lat = sub(0x0002);
        const lonRef = sub(0x0003);
        const lon = sub(0x0004);
        if (lat && lon && lat.count >= 3 && lon.count >= 3) {
          const latVals = [
            readRational(buf, lat.valPos, cur.le, lat.type === 10),
            readRational(buf, lat.valPos + 8, cur.le, lat.type === 10),
            readRational(buf, lat.valPos + 16, cur.le, lat.type === 10),
          ];
          const lonVals = [
            readRational(buf, lon.valPos, cur.le, lon.type === 10),
            readRational(buf, lon.valPos + 8, cur.le, lon.type === 10),
            readRational(buf, lon.valPos + 16, cur.le, lon.type === 10),
          ];
          const latR = latRef ? readAscii(buf, latRef.valPos, latRef.count) : null;
          const lonR = lonRef ? readAscii(buf, lonRef.valPos, lonRef.count) : null;
          const la = dmsToDecimal(latVals, latR, true);
          const lo = dmsToDecimal(lonVals, lonR, false);
          if (la !== null && lo !== null) exif.gps = { lat: la, lon: lo };
        }
      }
    }
  } catch {
    // Keep whatever parsed before the corrupt entry.
  }
  return { exif, orientation };
}

// ISO-BMFF covers video, audio, pictures and Canon RAW under one box, so the
// major brand plus the compatible-brand list decides — never the extension.
function detectFtyp(head) {
  try {
    const major = head.toString("latin1", 8, 12).trim().toLowerCase();
    const compat = head.toString("latin1", 16, Math.min(head.length, 256)).toLowerCase();
    if (major === "avif" || major === "avis") {
      return { detectedMime: "image/avif", detectedExt: "avif", kind: "image" };
    }
    if (
      major === "heic" || major === "heix" || major === "hevc" ||
      major === "hevx" || major === "heim" || major === "heis" ||
      major === "hevm" || major === "hevs"
    ) {
      return { detectedMime: "image/heic", detectedExt: "heic", kind: "image" };
    }
    // mif1/msf1 wrap either AVIF or HEIF stills — the compat list disambiguates.
    if (major === "mif1" || major === "msf1" || major === "heif") {
      if (compat.includes("avif") || compat.includes("avis")) {
        return { detectedMime: "image/avif", detectedExt: "avif", kind: "image" };
      }
      return { detectedMime: "image/heif", detectedExt: "heif", kind: "image" };
    }
    // Canon CR3 RAW rides the same container as video — brand crx is the tell.
    if (major === "crx") {
      return { detectedMime: "image/x-canon-cr3", detectedExt: "cr3", kind: "raw" };
    }
    if (major === "qt") {
      return { detectedMime: "video/quicktime", detectedExt: "mov", kind: "video" };
    }
    if (major === "m4a" || major === "m4b" || major === "m4p") {
      return { detectedMime: "audio/mp4", detectedExt: "m4a", kind: "audio" };
    }
    if (
      major.startsWith("3gp") || major.startsWith("3g2") ||
      major.startsWith("3ge") || major.startsWith("3gg")
    ) {
      return { detectedMime: "video/3gpp", detectedExt: "3gp", kind: "video" };
    }
    return { detectedMime: "video/mp4", detectedExt: "mp4", kind: "video" };
  } catch {
    return null;
  }
}

// TIFF doubles as three RAW containers, so refine before calling it a plain
// still: the CR marker is definitive for Canon, the DNG tag beats any maker
// string, and maker names are the cheap fallback for Nikon/Sony.
function detectTiff(head, text) {
  const le = head.length >= 4 && head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a && head[3] === 0x00;
  const be = head.length >= 4 && head[0] === 0x4d && head[1] === 0x4d && head[2] === 0x00 && head[3] === 0x2a;
  if (!le && !be) return null;
  try {
    if (head.length >= 12 && head[8] === 0x43 && head[9] === 0x52) {
      return { detectedMime: "image/x-canon-cr2", detectedExt: "cr2", kind: "raw" };
    }
    if (hasDngVersion(head)) {
      return { detectedMime: "image/x-adobe-dng", detectedExt: "dng", kind: "raw" };
    }
    const lower = text.toLowerCase();
    if (lower.includes("canon")) {
      return { detectedMime: "image/x-canon-cr2", detectedExt: "cr2", kind: "raw" };
    }
    if (lower.includes("nikon")) {
      return { detectedMime: "image/x-nikon-nef", detectedExt: "nef", kind: "raw" };
    }
    if (lower.includes("sony")) {
      return { detectedMime: "image/x-sony-arw", detectedExt: "arw", kind: "raw" };
    }
  } catch {
    // Fall through to plain TIFF on any parse failure.
  }
  return { detectedMime: "image/tiff", detectedExt: "tif", kind: "image" };
}

// SVGs are text, so sniff the decoded head instead of bytes. Editors prepend
// BOMs and comments, hence the skip loop — the bytes are still SVG.
function detectSvg(head) {
  try {
    if (head.length < 4) return null;
    let s = head.toString("utf8").replace(/^\uFEFF/, "");
    for (let guard = 0; guard < 6; guard++) {
      const t = s.trimStart();
      if (!t.startsWith("<!--")) {
        s = t;
        break;
      }
      const end = t.indexOf("-->");
      if (end === -1) return null;
      s = t.slice(end + 3);
    }
    const start = s.slice(0, 4096).toLowerCase();
    if (start.startsWith("<svg")) return { detectedMime: "image/svg+xml", detectedExt: "svg", kind: "image" };
    if (start.startsWith("<?xml") && start.includes("<svg")) {
      return { detectedMime: "image/svg+xml", detectedExt: "svg", kind: "image" };
    }
    if (start.startsWith("<!doctype svg")) {
      return { detectedMime: "image/svg+xml", detectedExt: "svg", kind: "image" };
    }
    return null;
  } catch {
    return null;
  }
}

function detectSignature(head) {
  try {
    if (!head || head.length < 2) return null;
    // JPEG must precede the MP3 frame-sync check — both start with 0xFF.
    if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
      return { detectedMime: "image/jpeg", detectedExt: "jpg", kind: "image" };
    }
    if (
      head.length >= 8 &&
      head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 &&
      head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a
    ) {
      return { detectedMime: "image/png", detectedExt: "png", kind: "image" };
    }
    if (head.length >= 6) {
      const gif = head.toString("latin1", 0, 6);
      if (gif === "GIF87a" || gif === "GIF89a") {
        return { detectedMime: "image/gif", detectedExt: "gif", kind: "image" };
      }
    }
    if (head[0] === 0x42 && head[1] === 0x4d) {
      return { detectedMime: "image/bmp", detectedExt: "bmp", kind: "image" };
    }
    if (
      head.length >= 4 && head[0] === 0x00 && head[1] === 0x00 &&
      (head[2] === 0x01 || head[2] === 0x02) && head[3] === 0x00
    ) {
      return { detectedMime: "image/x-icon", detectedExt: "ico", kind: "image" };
    }
    const text = head.toString("latin1");
    const tiff = detectTiff(head, text);
    if (tiff) return tiff;
    // RIFF multiplexes three formats — the fourcc at offset 8 decides.
    if (head.length >= 12 && head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) {
      const fourcc = head.toString("latin1", 8, 12);
      if (fourcc === "WEBP") return { detectedMime: "image/webp", detectedExt: "webp", kind: "image" };
      if (fourcc === "AVI ") return { detectedMime: "video/x-msvideo", detectedExt: "avi", kind: "video" };
      if (fourcc === "WAVE") return { detectedMime: "audio/wav", detectedExt: "wav", kind: "audio" };
      return null;
    }
    if (
      head.length >= 12 && head[4] === 0x66 && head[5] === 0x74 &&
      head[6] === 0x79 && head[7] === 0x70
    ) {
      return detectFtyp(head);
    }
    if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
      // EBML has no magic for the DocType — the header names webm/matroska.
      const lower = text.toLowerCase();
      if (lower.includes("webm")) return { detectedMime: "video/webm", detectedExt: "webm", kind: "video" };
      return { detectedMime: "video/x-matroska", detectedExt: "mkv", kind: "video" };
    }
    if (head.length >= 5 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) {
      return { detectedMime: "application/pdf", detectedExt: "pdf", kind: "pdf" };
    }
    if (
      head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b &&
      ((head[2] === 0x03 && head[3] === 0x04) ||
        (head[2] === 0x05 && head[3] === 0x06) ||
        (head[2] === 0x07 && head[3] === 0x08))
    ) {
      // OOXML (docx/xlsx/pptx) is a plain zip — the central names reveal it.
      const isOoxml = text.includes("[Content_Types].xml") || text.includes("_rels/.rels");
      if (isOoxml) {
        if (text.includes("word/")) {
          return {
            detectedMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            detectedExt: "docx",
            kind: "document",
          };
        }
        if (text.includes("xl/")) {
          return {
            detectedMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            detectedExt: "xlsx",
            kind: "document",
          };
        }
        if (text.includes("ppt/")) {
          return {
            detectedMime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            detectedExt: "pptx",
            kind: "document",
          };
        }
      }
      return { detectedMime: "application/zip", detectedExt: "zip", kind: "archive" };
    }
    if (
      head.length >= 7 && head[0] === 0x52 && head[1] === 0x61 && head[2] === 0x72 &&
      head[3] === 0x21 && head[4] === 0x1a && head[5] === 0x07
    ) {
      return { detectedMime: "application/x-rar-compressed", detectedExt: "rar", kind: "archive" };
    }
    if (
      head.length >= 6 && head[0] === 0x37 && head[1] === 0x7a && head[2] === 0xbc &&
      head[3] === 0xaf && head[4] === 0x27 && head[5] === 0x1c
    ) {
      return { detectedMime: "application/x-7z-compressed", detectedExt: "7z", kind: "archive" };
    }
    if (head[0] === 0x1f && head[1] === 0x8b) {
      return { detectedMime: "application/gzip", detectedExt: "gz", kind: "archive" };
    }
    if (head.length >= 262 && head.toString("latin1", 257, 262) === "ustar") {
      return { detectedMime: "application/x-tar", detectedExt: "tar", kind: "archive" };
    }
    if (head.length >= 3 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
      return { detectedMime: "audio/mpeg", detectedExt: "mp3", kind: "audio" };
    }
    if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0) {
      // Bare MPEG frame sync — version/layer must not be the reserved pattern.
      const v = (head[1] >> 3) & 0x03;
      const layer = (head[1] >> 1) & 0x03;
      if (v !== 0 && layer !== 0) return { detectedMime: "audio/mpeg", detectedExt: "mp3", kind: "audio" };
    }
    if (head.length >= 4 && head[0] === 0x66 && head[1] === 0x4c && head[2] === 0x61 && head[3] === 0x43) {
      return { detectedMime: "audio/flac", detectedExt: "flac", kind: "audio" };
    }
    if (head.length >= 4 && head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53) {
      // Ogg wraps audio and Theora video — the codec header decides.
      if (text.toLowerCase().includes("theora")) {
        return { detectedMime: "video/ogg", detectedExt: "ogv", kind: "video" };
      }
      return { detectedMime: "audio/ogg", detectedExt: "ogg", kind: "audio" };
    }
    if (head.length >= 4 && head[0] === 0x67 && head[1] === 0x6c && head[2] === 0x54 && head[3] === 0x46) {
      return { detectedMime: "model/gltf-binary", detectedExt: "glb", kind: "3d" };
    }
    // MZ executables must be recognisable so a renamed .exe is caught by
    // typeMismatch instead of degrading to "unknown".
    if (head[0] === 0x4d && head[1] === 0x5a) {
      return { detectedMime: "application/x-msdownload", detectedExt: "exe", kind: null };
    }
    return detectSvg(head);
  } catch {
    return null;
  }
}

// Dimensions and EXIF come from sharp's metadata. Any decode failure degrades
// to the signature-only base — corrupt rasters still upload.
async function enrichFromSharp(buffer, base) {
  try {
    const sharp = await loadSharp();
    if (!sharp) return base;
    let meta = null;
    try {
      meta = await sharp(buffer).metadata();
    } catch {
      return base;
    }
    if (!meta || typeof meta !== "object") return base;
    const width = Number.isInteger(meta.width) && meta.width > 0 ? meta.width : null;
    const height = Number.isInteger(meta.height) && meta.height > 0 ? meta.height : null;
    let orientation =
      Number.isInteger(meta.orientation) && meta.orientation >= 1 && meta.orientation <= 8
        ? meta.orientation
        : null;
    const hasAlpha = typeof meta.hasAlpha === "boolean" ? meta.hasAlpha : null;
    const pages = Number.isInteger(meta.pages) && meta.pages > 0 ? meta.pages : 1;
    const animated = pages > 1;
    let exif = emptyExif();
    try {
      if (meta.exif && meta.exif.length > 0) {
        const parsed = readExif(meta.exif);
        exif = parsed.exif;
        if (orientation === null) orientation = parsed.orientation;
      }
    } catch {
      // Malformed EXIF keeps null fields.
    }
    return { ...base, width, height, orientation, hasAlpha, animated, pages, exif };
  } catch {
    return base;
  }
}

export async function probeFile(buffer, { filename, contentType } = {}) {
  // Hints are intentionally unread: trusting them would defeat the purpose —
  // detection is magic bytes only, comparison lives in typeMismatch.
  void filename;
  void contentType;
  try {
    let input = null;
    if (Buffer.isBuffer(buffer)) input = buffer;
    else if (buffer instanceof Uint8Array) {
      input = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else {
      return null;
    }
    if (input.length === 0) return null;
    const head = input.subarray(0, HEAD_BYTES);
    const sig = detectSignature(head);
    if (!sig) return null;
    const base = {
      detectedMime: sig.detectedMime,
      detectedExt: sig.detectedExt,
      kind: sig.kind,
      width: null,
      height: null,
      orientation: null,
      hasAlpha: null,
      animated: null,
      pages: null,
      exif: emptyExif(),
    };
    // Sharp only understands raster stills — vectors and containers would
    // error or mislead, so they stay signature-only.
    if (sig.kind !== "image" || sig.detectedMime === "image/svg+xml") return base;
    return await enrichFromSharp(input, base);
  } catch {
    return null;
  }
}

export function typeMismatch(probe, { contentType, filename } = {}) {
  try {
    // Unknown bytes are not evidence of hostility — only a recognised
    // signature contradicting a concrete claim is a mismatch.
    if (!probe || typeof probe.detectedMime !== "string" || !probe.detectedMime) return null;
    const detected = canonMime(probe.detectedMime);
    if (!detected) return null;
    const declared = canonMime(contentType);
    if (declared && !GENERIC_TYPES.has(declared) && declared !== detected) {
      return `declared ${declared} but bytes are ${detected}`;
    }
    const expected = expectedForFilename(filename);
    if (!expected) return null;
    if (expected.mime && canonMime(expected.mime) === detected) return null;
    if (expected.kind && probe.kind && expected.kind === probe.kind) return null;
    // OOXML is a zip — naming a docx .zip is not spoofing.
    if (isOoxmlMime(detected) && expected.ext === "zip") return null;
    const want = expected.mime ? canonMime(expected.mime) : `${expected.kind || "unknown"}/*`;
    return `filename ${expected.base} suggests ${want} but bytes are ${detected}`;
  } catch {
    return null;
  }
}
