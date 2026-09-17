// Content negotiation for on-the-fly image delivery.
//
// Isomorphic — no browser or server APIs here. Both a route handler and a
// client component can import this to agree on which encoding a single
// asset URL should return (the `f_auto` behaviour: AVIF where wanted,
// WebP next, JPEG for old clients). Format today is frozen at upload
// time; this module only decides, it never encodes or fetches.

export const IMAGE_FORMAT_MIME = Object.freeze({
  avif: "image/avif",
  webp: "image/webp",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
});

function clampQ(n) {
  if (!(n > 0)) return 0;
  if (!(n < 1)) return 1;
  return n;
}

export function parseAccept(header) {
  if (typeof header !== "string") return [];
  let value = header.trim();
  if (value === "") return [];
  // Tolerate callers passing the full header line ("Accept: ...").
  if (value.length > 7 && value.slice(0, 7).toLowerCase() === "accept:") {
    value = value.slice(7).trim();
    if (value === "") return [];
  }
  // Cap work on pathological input without throwing.
  if (value.length > 20000) value = value.slice(0, 20000);
  const out = [];
  const parts = value.split(",");
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (part === "") continue;
    const segments = part.split(";");
    const range = segments[0].trim().toLowerCase();
    const slash = range.indexOf("/");
    if (slash <= 0) continue;
    const type = range.slice(0, slash).trim();
    const subtype = range.slice(slash + 1).trim();
    if (type === "" || subtype === "") continue;
    if (/\s/.test(type) || /\s/.test(subtype)) continue;
    // Only exact, type/*, and */* are meaningful — reject stray stars.
    if (type === "*" && subtype !== "*") continue;
    if (type.includes("*") && type !== "*") continue;
    if (subtype.includes("*") && subtype !== "*") continue;
    let q = 1;
    for (let i = 1; i < segments.length; i += 1) {
      const param = segments[i].trim();
      if (param === "") continue;
      const eq = param.indexOf("=");
      if (eq <= 0) continue;
      if (param.slice(0, eq).trim().toLowerCase() !== "q") continue;
      const raw = param.slice(eq + 1).trim();
      if (raw !== "") {
        const n = Number(raw);
        q = Number.isFinite(n) ? clampQ(n) : 1;
      }
      break;
    }
    let specificity = 2;
    if (type === "*") specificity = 0;
    else if (subtype === "*") specificity = 1;
    out.push({ type, subtype, q, specificity });
    if (out.length >= 200) break;
  }
  out.sort((a, b) => {
    if (b.q !== a.q) return b.q - a.q;
    if (b.specificity !== a.specificity) return b.specificity - a.specificity;
    return 0;
  });
  return out;
}

export function acceptsType(header, mime) {
  if (header == null) return true;
  if (typeof header !== "string") return true;
  if (header.trim() === "") return true;
  let entries;
  try {
    entries = parseAccept(header);
  } catch {
    return true;
  }
  if (!entries || entries.length === 0) return true;
  if (typeof mime !== "string") return false;
  const clean = mime.toLowerCase().split(";")[0].trim();
  const slash = clean.indexOf("/");
  if (slash <= 0) return false;
  const type = clean.slice(0, slash).trim();
  const subtype = clean.slice(slash + 1).trim();
  if (type === "" || subtype === "") return false;
  if (type === "*" || subtype === "*") return false;
  // Most specific covering range decides, so an exact q=0 refusal beats
  // a permissive wildcard.
  let best = null;
  for (const e of entries) {
    if (e.type !== "*" && e.type !== type) continue;
    if (e.subtype !== "*" && e.subtype !== subtype) continue;
    if (!best || e.specificity > best.specificity || (e.specificity === best.specificity && e.q > best.q)) {
      best = e;
    }
  }
  if (!best) return false;
  return best.q > 0;
}

function normalizeFallback(fallback) {
  const key = typeof fallback === "string" ? fallback.trim().toLowerCase() : "";
  return Object.hasOwn(IMAGE_FORMAT_MIME, key) ? key : "jpeg";
}

function normalizeCandidates(candidates, fallback) {
  if (candidates === undefined) return ["avif", "webp", "jpeg"];
  if (!Array.isArray(candidates)) return ["avif", "webp", "jpeg"];
  const list = [];
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const key = c.trim().toLowerCase();
    if (!Object.hasOwn(IMAGE_FORMAT_MIME, key)) continue;
    if (!list.includes(key)) list.push(key);
    if (list.length >= 10) break;
  }
  return list.length > 0 ? list : [fallback];
}

export function negotiateImageFormat(header, { candidates, fallback } = {}) {
  try {
    const fb = normalizeFallback(fallback);
    const list = normalizeCandidates(candidates, fb);
    const fallbackResult = { format: fb, contentType: IMAGE_FORMAT_MIME[fb], matched: false };
    const entries = typeof header === "string" ? parseAccept(header) : [];
    // Unknown client — serve the safest format rather than guessing.
    if (entries.length === 0) return fallbackResult;
    let onlyWildcard = true;
    let maxWildcardQ = 0;
    for (const e of entries) {
      if (e.type !== "*" || e.subtype !== "*") {
        onlyWildcard = false;
        break;
      }
      if (e.q > maxWildcardQ) maxWildcardQ = e.q;
    }
    // Client expressed no opinion — serve the server's best encoding.
    if (onlyWildcard) {
      if (maxWildcardQ <= 0) return fallbackResult;
      const first = list[0] || fb;
      return { format: first, contentType: IMAGE_FORMAT_MIME[first], matched: false };
    }
    let best = null;
    for (let i = 0; i < list.length; i += 1) {
      const format = list[i];
      const mime = IMAGE_FORMAT_MIME[format];
      const slash = mime.indexOf("/");
      const mtype = mime.slice(0, slash);
      const msub = mime.slice(slash + 1);
      let eff = null;
      for (const e of entries) {
        if (e.type !== "*" && e.type !== mtype) continue;
        if (e.subtype !== "*" && e.subtype !== msub) continue;
        if (!eff || e.specificity > eff.specificity || (e.specificity === eff.specificity && e.q > eff.q)) {
          eff = e;
        }
      }
      // Refused (q=0) or unmentioned formats are never selectable here.
      if (!eff || eff.q <= 0) continue;
      if (
        !best ||
        eff.q > best.q ||
        (eff.q === best.q &&
          (eff.specificity > best.specificity ||
            (eff.specificity === best.specificity && i < best.index)))
      ) {
        best = { format, q: eff.q, specificity: eff.specificity, index: i };
      }
    }
    if (!best) return fallbackResult;
    return {
      format: best.format,
      contentType: IMAGE_FORMAT_MIME[best.format],
      matched: best.specificity === 2,
    };
  } catch {
    return { format: "jpeg", contentType: "image/jpeg", matched: false };
  }
}

export function varyHeader(base) {
  // Without Vary: Accept a CDN will serve AVIF bytes to a browser that
  // cannot decode them — the encoding varies per request header.
  try {
    if (base == null) return "Accept";
    if (typeof base !== "string") return "Accept";
    const trimmed = base.trim();
    if (trimmed === "") return "Accept";
    const parts = trimmed
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    if (parts.length === 0) return "Accept";
    for (const p of parts) {
      if (p.toLowerCase() === "accept") return parts.join(", ");
    }
    parts.push("Accept");
    return parts.join(", ");
  } catch {
    return "Accept";
  }
}
