if (typeof window !== "undefined") {
  throw new Error("lib/image/transform is server-only.");
}

import { createHash } from "node:crypto";

// Dynamic delivery transform engine.
//
// Canonical path form:
//
//   /d/{projectId}/{assetId}/w_800,h_600,c_fill,g_face,f_auto,q_auto/hero.jpg
//   /d/{p}/{id}/w_800,c_fill/e_blur:400/hero.jpg   (chained: segments apply in order)
//
// Each transform segment is a comma-separated op list. The ops below mirror
// the Cloudinary-style vocabulary used across the suite:
//
//   w_ h_ c_(fill|fit|cover|contain|pad|crop|thumb) g_ ar_ dpr_
//   f_(auto|webp|avif|jpg|png) q_(auto|1-100)
//   e_(blur|sharpen|grayscale|sepia|negate|brightness|contrast|saturation|tint)[:param]
//   a_ fl_flip fl_flop r_ b_ bo_ o_
//   l_text:<…> l_asset:<id>  (overlays, positioned with x_ y_ g_ o_ in the same segment)

const CROP_MODES = new Set(["fill", "fit", "cover", "contain", "pad", "crop", "thumb"]);
const FORMATS = new Set(["auto", "webp", "avif", "jpg", "jpeg", "png"]);
const EFFECTS = new Set([
  "blur",
  "sharpen",
  "grayscale",
  "sepia",
  "negate",
  "brightness",
  "contrast",
  "saturation",
  "tint",
]);

const HARD_MAX_DIM = 8000;

const NAMED_COLORS = {
  white: "#ffffff",
  black: "#000000",
  red: "#ff0000",
  green: "#00ff00",
  blue: "#0000ff",
  yellow: "#ffff00",
  transparent: "#00000000",
};

function clampInt(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function clampFloat(value, min, max) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function parseColor(raw) {
  if (raw == null) return null;
  let v = String(raw).trim().replace(/^rgb:/i, "");
  if (NAMED_COLORS[v.toLowerCase()]) v = NAMED_COLORS[v.toLowerCase()];
  const hex = v.replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex) || /^[0-9a-fA-F]{6}$/.test(hex) || /^[0-9a-fA-F]{8}$/.test(hex)) {
    let full = hex;
    if (full.length === 3) full = full.split("").map((c) => c + c).join("");
    const r = Number.parseInt(full.slice(0, 2), 16);
    const g = Number.parseInt(full.slice(2, 4), 16);
    const b = Number.parseInt(full.slice(4, 6), 16);
    const a = full.length === 8 ? Number.parseInt(full.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, alpha: a };
  }
  return null;
}

function gravityFor(value) {
  const v = String(value || "center").toLowerCase();
  if (v === "face" || v === "faces" || v === "attention") return "attention";
  if (v === "center" || v === "middle") return "centre";
  if (v === "north" || v === "top") return "north";
  if (v === "south" || v === "bottom") return "south";
  if (v === "east" || v === "right") return "east";
  if (v === "west" || v === "left") return "west";
  if (v === "northeast" || v === "north_east") return "north-east";
  if (v === "northwest" || v === "north_west") return "north-west";
  if (v === "southeast" || v === "south_east") return "south-east";
  if (v === "southwest" || v === "south_west") return "south-west";
  if (v === "entropy") return "entropy";
  return "centre";
}

function emptyStep() {
  return {
    width: null,
    height: null,
    crop: null,
    gravity: null,
    aspect: null,
    dpr: null,
    format: null,
    quality: null,
    effects: [],
    angle: null,
    flip: false,
    flop: false,
    radius: null,
    background: null,
    border: null,
    opacity: null,
    overlays: [],
  };
}

function currentOverlay(step) {
  return step.overlays.length ? step.overlays[step.overlays.length - 1] : null;
}

// Parse one comma-separated segment into a step. Throws on invalid syntax.
export function parseSegment(segment) {
  const step = emptyStep();
  const raw = String(segment ?? "").trim();
  if (!raw) throw new Error("empty transform segment");
  for (const token of raw.split(",")) {
    const t = token.trim();
    if (!t) continue;
    if (t === "fl_flip") { step.flip = true; continue; }
    if (t === "fl_flop") { step.flop = true; continue; }
    if (t.startsWith("l_text:")) {
      step.overlays.push({ kind: "text", text: decodeURIComponent(t.slice(7)), x: null, y: null, gravity: null, opacity: null });
      continue;
    }
    if (t.startsWith("l_asset:")) {
      const id = t.slice(8);
      if (!id) throw new Error("l_asset requires an asset id");
      step.overlays.push({ kind: "asset", assetId: id, x: null, y: null, gravity: null, opacity: null });
      continue;
    }
    const sep = t.indexOf("_");
    if (sep <= 0) throw new Error(`unknown transform op: ${t}`);
    const op = t.slice(0, sep);
    const arg = t.slice(sep + 1);
    // x_/y_/g_/o_ after an overlay belong to that overlay; otherwise the step.
    const overlay = currentOverlay(step);
    switch (op) {
      case "w": {
        const w = clampInt(arg, 1, HARD_MAX_DIM);
        if (w == null) throw new Error(`invalid width: ${arg}`);
        step.width = w;
        break;
      }
      case "h": {
        const h = clampInt(arg, 1, HARD_MAX_DIM);
        if (h == null) throw new Error(`invalid height: ${arg}`);
        step.height = h;
        break;
      }
      case "c": {
        if (!CROP_MODES.has(arg)) throw new Error(`invalid crop mode: ${arg}`);
        step.crop = arg;
        break;
      }
      case "g": {
        if (overlay) overlay.gravity = arg;
        else step.gravity = arg;
        break;
      }
      case "ar": {
        const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(arg);
        if (!m) throw new Error(`invalid aspect ratio: ${arg}`);
        step.aspect = Number(m[1]) / Number(m[2]);
        break;
      }
      case "dpr": {
        const dpr = clampFloat(arg, 1, 4);
        if (dpr == null) throw new Error(`invalid dpr: ${arg}`);
        step.dpr = dpr;
        break;
      }
      case "f": {
        if (!FORMATS.has(arg)) throw new Error(`invalid format: ${arg}`);
        step.format = arg === "jpeg" ? "jpg" : arg;
        break;
      }
      case "q": {
        if (arg === "auto") { step.quality = "auto"; break; }
        const q = clampInt(arg, 1, 100);
        if (q == null) throw new Error(`invalid quality: ${arg}`);
        step.quality = q;
        break;
      }
      case "e": {
        const colon = arg.indexOf(":");
        const name = colon < 0 ? arg : arg.slice(0, colon);
        const param = colon < 0 ? null : arg.slice(colon + 1);
        if (!EFFECTS.has(name)) throw new Error(`invalid effect: ${name}`);
        step.effects.push({ name, param });
        break;
      }
      case "a":
      case "r": {
        const angle = clampInt(arg, -360, 360);
        if (angle == null) throw new Error(`invalid angle: ${arg}`);
        step.angle = angle;
        break;
      }
      case "b": {
        const color = parseColor(arg);
        if (!color) throw new Error(`invalid background: ${arg}`);
        step.background = color;
        break;
      }
      case "bo": {
        const m = /^(\d+)(?:px)?(?:_(.+))?$/.exec(arg);
        if (!m) throw new Error(`invalid border: ${arg}`);
        const width = clampInt(m[1], 1, 100);
        const color = parseColor((m[2] || "").replace(/^(solid|dashed)_/, "")) || { r: 0, g: 0, b: 0, alpha: 1 };
        step.border = { width, color };
        break;
      }
      case "o": {
        const o = clampInt(arg, 0, 100);
        if (o == null) throw new Error(`invalid opacity: ${arg}`);
        if (overlay) overlay.opacity = o;
        else step.opacity = o;
        break;
      }
      case "x": {
        const x = clampInt(arg, -HARD_MAX_DIM, HARD_MAX_DIM);
        if (x == null) throw new Error(`invalid x offset: ${arg}`);
        if (overlay) overlay.x = x;
        break;
      }
      case "y": {
        const y = clampInt(arg, -HARD_MAX_DIM, HARD_MAX_DIM);
        if (y == null) throw new Error(`invalid y offset: ${arg}`);
        if (overlay) overlay.y = y;
        break;
      }
      default:
        throw new Error(`unknown transform op: ${op}`);
    }
  }
  return step;
}

// Split [...rest] into { segments, filename }. The last entry is the filename.
export function splitRest(rest) {
  const parts = Array.isArray(rest) ? rest.map(String) : [];
  if (!parts.length) return { segments: [], filename: "" };
  return { segments: parts.slice(0, -1), filename: parts[parts.length - 1] };
}

export function parseTransformPath(segments) {
  return (segments || []).map(parseSegment);
}

// Merge chained steps in order: later segments override geometry, while
// effects and overlays accumulate.
export function mergeSteps(steps) {
  const plan = emptyStep();
  for (const step of steps || []) {
    for (const key of ["width", "height", "crop", "gravity", "aspect", "dpr", "format", "quality", "angle", "background", "border", "opacity"]) {
      if (step[key] !== null && step[key] !== undefined) plan[key] = step[key];
    }
    if (step.flip) plan.flip = true;
    if (step.flop) plan.flop = true;
    if (step.radius !== null && step.radius !== undefined) plan.radius = step.radius;
    plan.effects.push(...step.effects);
    plan.overlays.push(...step.overlays);
  }
  return plan;
}

export function canonicalSegment(step) {
  const parts = [];
  if (step.width != null) parts.push(`w_${step.width}`);
  if (step.height != null) parts.push(`h_${step.height}`);
  if (step.crop) parts.push(`c_${step.crop}`);
  if (step.gravity) parts.push(`g_${step.gravity}`);
  if (step.aspect) parts.push(`ar_${step.aspect}`);
  if (step.dpr != null) parts.push(`dpr_${step.dpr}`);
  if (step.format) parts.push(`f_${step.format}`);
  if (step.quality != null) parts.push(`q_${step.quality}`);
  for (const e of step.effects) parts.push(`e_${e.name}${e.param != null ? `:${e.param}` : ""}`);
  if (step.angle != null) parts.push(`r_${step.angle}`);
  if (step.flip) parts.push("fl_flip");
  if (step.flop) parts.push("fl_flop");
  if (step.opacity != null) parts.push(`o_${step.opacity}`);
  for (const o of step.overlays) {
    parts.push(o.kind === "text" ? `l_text:${encodeURIComponent(o.text)}` : `l_asset:${o.assetId}`);
    if (o.x != null) parts.push(`x_${o.x}`);
    if (o.y != null) parts.push(`y_${o.y}`);
    if (o.gravity) parts.push(`g_${o.gravity}`);
    if (o.opacity != null) parts.push(`o_${o.opacity}`);
  }
  return parts.join(",");
}

// Query form (?w=800&fit=cover…) accepted on the delivery route and
// 308-redirected to the canonical path form.
const FIT_TO_CROP = { cover: "cover", fill: "fill", fit: "fit", contain: "contain", pad: "pad", crop: "crop", thumb: "thumb" };

export function queryToCanonical(searchParams) {
  const parts = [];
  const w = searchParams.get("w") ?? searchParams.get("width");
  const h = searchParams.get("h") ?? searchParams.get("height");
  if (w) parts.push(`w_${w}`);
  if (h) parts.push(`h_${h}`);
  const crop = searchParams.get("c") ?? searchParams.get("crop");
  const fit = searchParams.get("fit");
  if (crop && CROP_MODES.has(crop)) parts.push(`c_${crop}`);
  else if (fit && FIT_TO_CROP[fit]) parts.push(`c_${FIT_TO_CROP[fit]}`);
  const g = searchParams.get("g") ?? searchParams.get("gravity");
  if (g) parts.push(`g_${g}`);
  const ar = searchParams.get("ar");
  if (ar) parts.push(`ar_${ar}`);
  const dpr = searchParams.get("dpr");
  if (dpr) parts.push(`dpr_${dpr}`);
  const f = searchParams.get("f") ?? searchParams.get("format");
  if (f) parts.push(`f_${f}`);
  const q = searchParams.get("q") ?? searchParams.get("quality");
  if (q) parts.push(`q_${q}`);
  const e = searchParams.get("e") ?? searchParams.get("effect");
  if (e) parts.push(`e_${e}`);
  return parts.join(",");
}

export function defaultPolicy() {
  return {
    maxWidth: 4000,
    maxHeight: 4000,
    maxMegapixels: 25,
    allowedFormats: ["auto", "webp", "avif", "jpg", "png"],
    allowedEffects: ["blur", "sharpen", "grayscale", "sepia", "negate", "brightness", "contrast", "saturation", "tint"],
    referrerAllowlist: [],
    monthlyTransformBudget: 100000,
    requireSignedUrls: false,
  };
}

export function normalizePolicy(row) {
  const d = defaultPolicy();
  if (!row) return d;
  return {
    maxWidth: Number(row.max_width ?? d.maxWidth) || d.maxWidth,
    maxHeight: Number(row.max_height ?? d.maxHeight) || d.maxHeight,
    maxMegapixels: Number(row.max_megapixels ?? d.maxMegapixels) || d.maxMegapixels,
    allowedFormats: Array.isArray(row.allowed_formats) && row.allowed_formats.length ? row.allowed_formats : d.allowedFormats,
    allowedEffects: Array.isArray(row.allowed_effects) && row.allowed_effects.length ? row.allowed_effects : d.allowedEffects,
    referrerAllowlist: Array.isArray(row.referrer_allowlist) ? row.referrer_allowlist : [],
    monthlyTransformBudget: Number(row.monthly_transform_budget ?? d.monthlyTransformBudget) || d.monthlyTransformBudget,
    requireSignedUrls: Boolean(row.require_signed_urls),
  };
}

// Policy is OPEN by default, bounded by the project limits.
export function validatePlan(plan, policy) {
  const p = policy || defaultPolicy();
  const dpr = plan.dpr || 1;
  const w = plan.width != null ? Math.round(plan.width * dpr) : null;
  const h = plan.height != null ? Math.round(plan.height * dpr) : null;
  if (w != null && w > p.maxWidth) return `width ${w} exceeds project maximum ${p.maxWidth}`;
  if (h != null && h > p.maxHeight) return `height ${h} exceeds project maximum ${p.maxHeight}`;
  if (w != null && h != null && (w * h) / 1e6 > p.maxMegapixels) {
    return `requested ${(w * h / 1e6).toFixed(1)}MP exceeds project maximum ${p.maxMegapixels}MP`;
  }
  if (plan.format && !p.allowedFormats.includes(plan.format)) {
    return `format ${plan.format} is not allowed by this project's delivery policy`;
  }
  for (const e of plan.effects) {
    if (!p.allowedEffects.includes(e.name)) return `effect ${e.name} is not allowed by this project's delivery policy`;
  }
  return null;
}

export function checkReferrer(request, policy) {
  const allow = policy?.referrerAllowlist || [];
  if (!allow.length) return null;
  const referer = request.headers.get("referer") || request.headers.get("referrer") || "";
  if (!referer) return null;
  try {
    const host = new URL(referer).hostname.toLowerCase();
    const ok = allow.some((entry) => {
      const a = String(entry).toLowerCase().trim();
      return a && (host === a || host.endsWith(`.${a}`));
    });
    return ok ? null : "referrer not allowed by this project's delivery policy";
  } catch {
    return "referrer not allowed by this project's delivery policy";
  }
}

export function derivativeKeyFor(assetId, canonical, ext) {
  const hash = createHash("sha256").update(String(canonical)).digest("hex").slice(0, 32);
  const safeExt = String(ext || "jpg").replace(/[^A-Za-z0-9]/g, "") || "jpg";
  return `derived/${assetId}/${hash}.${safeExt}`;
}

export function canonicalFor(assetId, segments) {
  return segments.join("/");
}

const EXT_TO_CONTENT_TYPE = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export function resolveFormat(plan, accept) {
  if (!plan.format || plan.format === "auto") {
    const a = String(accept || "");
    if (a.includes("image/avif")) return "avif";
    if (a.includes("image/webp")) return "webp";
    return "jpg";
  }
  return plan.format;
}

export function resolveQuality(plan) {
  if (plan.quality == null || plan.quality === "auto") return 80;
  return plan.quality;
}

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod?.default || mod;
  } catch (e) {
    console.error("[image.transform] sharp unavailable", e?.message || e);
    return null;
  }
}

function effectParam(effect, fallback) {
  if (effect.param == null || effect.param === "") return fallback;
  const n = Number(effect.param);
  return Number.isFinite(n) ? n : fallback;
}

function textOverlaySvg(text, width) {
  const safe = String(text ?? "").slice(0, 280).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const w = Math.max(200, Math.min(1600, Number(width) || 800));
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="120">` +
      `<rect x="0" y="0" width="100%" height="100%" fill="black" fill-opacity="0"/>` +
      `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="56" font-weight="600" fill="white" stroke="black" stroke-width="1" paint-order="stroke">${safe}</text>` +
      `</svg>`,
  );
}

// Run sharp over the source buffer. loadOverlay resolves l_asset:<id> overlays
// to image buffers (the delivery route wires it to S3).
export async function runTransform(buffer, plan, { accept, loadOverlay, sourceWidth, sourceHeight } = {}) {
  const sharp = await loadSharp();
  if (!sharp) throw new Error("image pipeline unavailable");
  const format = resolveFormat(plan, accept);
  const quality = resolveQuality(plan);
  const dpr = plan.dpr || 1;

  let width = plan.width != null ? Math.round(plan.width * dpr) : null;
  let height = plan.height != null ? Math.round(plan.height * dpr) : null;
  if (plan.aspect && width != null && height == null && sourceWidth && sourceHeight) {
    height = Math.round(width / plan.aspect);
  } else if (plan.aspect && width == null && height != null) {
    width = Math.round(height * plan.aspect);
  }

  let pipeline = sharp(buffer, { animated: false }).rotate();
  if (plan.flip) pipeline = pipeline.flip();
  if (plan.flop) pipeline = pipeline.flop();
  if (plan.angle) pipeline = pipeline.rotate(plan.angle);

  const crop = plan.crop || (width != null || height != null ? "fill" : null);
  if (width != null || height != null) {
    const fit = crop === "fit" || crop === "contain" ? "inside" : crop === "pad" ? "contain" : "cover";
    pipeline = pipeline.resize({
      width: width || null,
      height: height || null,
      fit,
      position: gravityFor(plan.gravity),
      background: plan.background || { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: fit === "inside",
    });
  }

  if (plan.border) {
    pipeline = pipeline.extend({
      top: plan.border.width,
      bottom: plan.border.width,
      left: plan.border.width,
      right: plan.border.width,
      background: plan.border.color,
    });
  }

  for (const effect of plan.effects) {
    switch (effect.name) {
      case "blur":
        pipeline = pipeline.blur(Math.max(0.3, Math.min(100, effectParam(effect, 8))));
        break;
      case "sharpen":
        pipeline = pipeline.sharpen({ sigma: Math.max(0.3, Math.min(10, effectParam(effect, 1))) });
        break;
      case "grayscale":
        pipeline = pipeline.grayscale();
        break;
      case "sepia":
        pipeline = pipeline.grayscale().tint({ r: 180, g: 150, b: 110 });
        break;
      case "negate":
        pipeline = pipeline.negate({ alpha: false });
        break;
      case "brightness": {
        const v = Math.max(-100, Math.min(100, effectParam(effect, 0)));
        pipeline = pipeline.modulate({ brightness: 1 + v / 100 });
        break;
      }
      case "contrast": {
        const v = Math.max(-100, Math.min(100, effectParam(effect, 0)));
        const a = 1 + v / 100;
        pipeline = pipeline.linear(a, -(128 * (a - 1)));
        break;
      }
      case "saturation": {
        const v = Math.max(-100, Math.min(100, effectParam(effect, 0)));
        pipeline = pipeline.modulate({ saturation: 1 + v / 100 });
        break;
      }
      case "tint": {
        const color = parseColor(effect.param || "white");
        if (color) pipeline = pipeline.tint({ r: color.r, g: color.g, b: color.b });
        break;
      }
      default:
        break;
    }
  }

  const composites = [];
  for (const overlay of plan.overlays) {
    let input = null;
    if (overlay.kind === "text") {
      input = textOverlaySvg(overlay.text, width || sourceWidth);
    } else if (overlay.kind === "asset" && typeof loadOverlay === "function") {
      try {
        input = await loadOverlay(overlay.assetId);
      } catch (e) {
        console.error("[image.transform] overlay load failed", e?.message || e);
        input = null;
      }
    }
    if (!input) continue;
    composites.push({
      input,
      gravity: gravityFor(overlay.gravity || plan.gravity),
      left: overlay.x ?? undefined,
      top: overlay.y ?? undefined,
      opacity: overlay.opacity != null ? overlay.opacity / 100 : undefined,
    });
  }
  if (composites.length) pipeline = pipeline.composite(composites);

  if (plan.opacity != null) pipeline = pipeline.ensureAlpha(plan.opacity / 100);

  const contentType = EXT_TO_CONTENT_TYPE[format] || "image/jpeg";
  if (format === "png") pipeline = pipeline.png();
  else if (format === "webp") pipeline = pipeline.webp({ quality });
  else if (format === "avif") pipeline = pipeline.avif({ quality });
  else pipeline = pipeline.jpeg({ quality });

  const bytes = await pipeline.toBuffer();
  const meta = await sharp(bytes).metadata().catch(() => null);
  return {
    bytes,
    contentType,
    ext: format === "jpg" ? "jpg" : format,
    width: meta?.width ?? width,
    height: meta?.height ?? height,
    transforms: 1 + plan.effects.length + plan.overlays.length,
  };
}
