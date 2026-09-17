// URL image-transform specs: "w_384,h_256,c_fill,q_90" -> a validated,
// canonical resize request.
//
// Isomorphic — pure string work, no Node or browser APIs — so a client that
// builds media URLs and the route handler that serves them agree on exactly
// one spelling. Nothing here encodes, reads or writes anything; it only
// decides whether a spec is acceptable and what its one true name is.
//
// THE SECURITY MODEL: every value is drawn from a fixed allowlist, never
// parsed as a free integer. An open transform route is a CPU and storage
// amplifier — an unauthenticated-ish caller walking w_1..w_4000 would derive
// thousands of near-identical images per asset and leave every one of them in
// the bucket forever (derivatives are written before they are ever served
// twice). Allowlisting turns "unbounded" into a small constant per asset:
//
//   dimension x fit combinations
//     c_fit / c_min   (one dimension is enough): 10 w-only + 10 h-only
//                                                + 100 both = 120, x2 = 240
//     c_fill / c_pad / c_scale (both required):  100 each          = 300
//                                                            total = 540
//   x 3 qualities x 2 deliverable formats (webp, avif)            = 3240
//
// 3240 is the hard ceiling on distinct derivative slots one asset can ever
// accumulate through this route, no matter what a caller sends. Real traffic
// uses a handful (a responsive srcset is 3-5 widths at one fit and quality).
// Anything outside the allowlist is rejected here and answered with a 400 —
// it is never silently clamped, because clamping would let a walk of 4000
// widths all resolve and still cost a derive apiece on the way in.

// A responsive ladder, not an arbitrary range: these are the widths a srcset
// actually asks for (1x/2x of the common card, column and full-bleed sizes),
// and they match the ladder next/image ships by default so a caller does not
// have to invent its own. Heights reuse the same rungs — a separate vertical
// ladder would double the combination count for no visual gain.
export const TRANSFORM_WIDTHS = Object.freeze([128, 256, 384, 512, 640, 768, 1024, 1280, 1536, 1920]);
export const TRANSFORM_HEIGHTS = TRANSFORM_WIDTHS;

// Friendly crop vocabulary -> sharp's `fit`. Deliberately indirect: sharp's
// own names read backwards to anyone who has used a CDN ("fill" means stretch
// in sharp, but means crop-to-fill everywhere else), and pinning our own names
// means a future switch of imaging library cannot change the URL contract.
export const TRANSFORM_FITS = Object.freeze({
  fit: "inside", // scale down to sit inside the box, keep aspect, never crop
  fill: "cover", // cover the box exactly, cropping the overflow
  pad: "contain", // sit inside the box, padded out to the exact size
  scale: "fill", // stretch to the exact size, ignoring aspect ratio
  min: "outside", // scale until the box is covered; may exceed it, never crops
});

// Three rungs, not a 1-100 dial: quality is perceptually flat between
// neighbouring values, so a continuous range would multiply the derivative
// count ~30x while producing visually identical files. 60 = dense grids,
// 75 = the default everywhere, 90 = detail/zoom surfaces.
export const TRANSFORM_QUALITIES = Object.freeze([60, 75, 90]);

export const DEFAULT_TRANSFORM_FIT = "fit";
export const DEFAULT_TRANSFORM_QUALITY = 75;

// Cropping to an exact box is meaningless with only one dimension given, so
// these modes require both. Rejecting instead of inferring the missing side
// keeps one spec from having two reasonable readings.
const FITS_REQUIRING_BOTH = Object.freeze(["fill", "pad", "scale"]);

// Four keys exist, so a spec can never be longer than four pairs; the byte cap
// bounds the split before any of it is examined.
const MAX_SPEC_PAIRS = 4;
const MAX_SPEC_LEN = 64;

// Exactly "<single letter>_<lowercase alphanumeric>" — no whitespace, no
// padding, no empty value. Numeric values are matched separately against
// DIGITS_RE so Number() can never be handed "0x80" or "1e3", both of which are
// finite numbers that would otherwise sneak past an allowlist membership test
// under a second spelling.
const PAIR_RE = /^([a-z])_([a-z0-9]+)$/;
// No leading zeros: "w_0128" would canonicalise to the same slot as "w_128",
// so it is harmless to the cache, but a single spelling per value keeps the
// accepted URL space exactly the size of the allowlist.
const DIGITS_RE = /^[1-9]\d*$/;

function allowedNumber(value, allowlist) {
  if (!DIGITS_RE.test(value)) return null;
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  return allowlist.includes(n) ? n : null;
}

// Canonical form: keys emitted in sorted order (c, h, q, w) with defaults
// omitted. This is what makes the cache work — "h_256,w_384", "w_384,h_256"
// and "w_384,c_fit,h_256,q_75" are three spellings of one image, and all three
// canonicalise to "h_256,w_384", so they share a manifest slot and are derived
// once. Without it every spelling would cut a fresh derivative.
export function canonicalTransform(parsed) {
  try {
    if (!parsed || typeof parsed !== "object") return null;
    const parts = [];
    if (parsed.fit && parsed.fit !== DEFAULT_TRANSFORM_FIT) parts.push(`c_${parsed.fit}`);
    if (parsed.height != null) parts.push(`h_${parsed.height}`);
    if (parsed.quality != null && parsed.quality !== DEFAULT_TRANSFORM_QUALITY) {
      parts.push(`q_${parsed.quality}`);
    }
    if (parsed.width != null) parts.push(`w_${parsed.width}`);
    return parts.length > 0 ? parts.join(",") : null;
  } catch {
    return null;
  }
}

// Parses and validates a spec. Returns null — never throws — for anything
// malformed, unknown, duplicated or out of bounds; the route turns that null
// into a 400. On success:
//   { width, height, fit, sharpFit, quality, canonical }
// where `width`/`height` may be null (one-dimension resize), `fit` is our
// friendly name and `sharpFit` the value to hand the imaging library.
export function parseTransform(spec) {
  try {
    if (typeof spec !== "string") return null;
    const raw = spec.trim().toLowerCase();
    if (raw === "" || raw.length > MAX_SPEC_LEN) return null;

    const parts = raw.split(",");
    if (parts.length > MAX_SPEC_PAIRS) return null;

    const seen = new Set();
    let width = null;
    let height = null;
    let fit = DEFAULT_TRANSFORM_FIT;
    let quality = DEFAULT_TRANSFORM_QUALITY;

    for (const part of parts) {
      // Parts are matched without trimming, so "w_384, h_256" is rejected
      // rather than silently accepted. (Surrounding whitespace on the whole
      // spec is already gone -- it was trimmed above.)
      const m = PAIR_RE.exec(part);
      if (!m) return null;
      const key = m[1];
      const value = m[2];
      // A repeated key has no defensible reading ("w_128,w_256"), so reject
      // rather than letting last-wins decide.
      if (seen.has(key)) return null;
      seen.add(key);

      if (key === "w") {
        width = allowedNumber(value, TRANSFORM_WIDTHS);
        if (width === null) return null;
      } else if (key === "h") {
        height = allowedNumber(value, TRANSFORM_HEIGHTS);
        if (height === null) return null;
      } else if (key === "c") {
        if (!Object.hasOwn(TRANSFORM_FITS, value)) return null;
        fit = value;
      } else if (key === "q") {
        quality = allowedNumber(value, TRANSFORM_QUALITIES);
        if (quality === null) return null;
      } else {
        // Unknown key — rejected, not ignored, so a typo surfaces as a 400
        // instead of quietly serving the wrong size.
        return null;
      }
    }

    // A spec with no dimension is a plain re-encode of the full original: the
    // most expensive derive we can do and the least useful. Named variants
    // exist for that.
    if (width === null && height === null) return null;
    if (FITS_REQUIRING_BOTH.includes(fit) && (width === null || height === null)) return null;

    const parsed = { width, height, fit, sharpFit: TRANSFORM_FITS[fit], quality };
    const canonical = canonicalTransform(parsed);
    if (!canonical) return null;
    return { ...parsed, canonical };
  } catch {
    return null;
  }
}

// Manifest slot for a transform derivative: "t/<canonical>.<ext>".
//
// Cannot collide with a named-variant slot ("<variant>.<ext>", e.g.
// "thumb.webp"): variant names come from the frozen VARIANTS keys, which are
// bare lowercase words, so a named slot can never contain a "/". The prefix is
// therefore a namespace, not a convention anyone has to remember to honour.
export function transformSlot(canonical, ext) {
  if (typeof canonical !== "string" || canonical === "") return null;
  if (typeof ext !== "string" || ext === "") return null;
  return `t/${canonical}.${ext}`;
}

// Object-key token for the same derivative. derivativeKey() strips anything
// outside [A-Za-z0-9_-], so the slot's "/" and "," would silently collapse and
// could fuse two distinct specs into one object. Swapping "," for "-" up front
// keeps the token injective under that filter: "t-h_256-w_384".
export function transformToken(canonical) {
  if (typeof canonical !== "string" || canonical === "") return null;
  return `t-${canonical.replace(/,/g, "-")}`;
}
