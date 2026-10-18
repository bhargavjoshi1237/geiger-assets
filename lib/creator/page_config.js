// The creator page's layout document — shared by the server (what fans get),
// the public page (how it renders) and the workspace builder (what it edits).
//
//   { version, theme, header, nav, cta, sections[], seo, footer }
//
// creator_profiles.page_draft holds the builder's working copy and page_config
// the published one; both go through normalizePageConfig so an old or partial
// document always renders. Plain data + pure helpers only — components own JSX.

export const PAGE_CONFIG_VERSION = 1;
// postMessage type the builder uses to stream unsaved edits into its preview frame.
export const PREVIEW_MESSAGE = "creator-page:draft";
const MAX_SECTIONS = 40;

// ---------------------------------------------------------------------------
// Theme

export const THEME_PRESETS = {
  midnight: { label: "Midnight", background: "#0b0b0f", surface: "#15151c", text: "#f4f4f5", muted: "#a1a1aa", border: "#26262f", accent: "#f97316" },
  noir: { label: "Noir", background: "#000000", surface: "#101010", text: "#ffffff", muted: "#9a9a9a", border: "#232323", accent: "#ffffff" },
  ocean: { label: "Ocean", background: "#07111f", surface: "#0e1c30", text: "#e6f0ff", muted: "#8ea3c0", border: "#1b2d47", accent: "#38bdf8" },
  forest: { label: "Forest", background: "#0c1411", surface: "#13201b", text: "#ecfdf5", muted: "#9fb8ad", border: "#1f3129", accent: "#34d399" },
  paper: { label: "Paper", background: "#faf9f6", surface: "#ffffff", text: "#1c1917", muted: "#78716c", border: "#e7e5e4", accent: "#e11d48" },
  studio: { label: "Studio", background: "#f4f6fb", surface: "#ffffff", text: "#0f172a", muted: "#64748b", border: "#e2e8f0", accent: "#4f46e5" },
  blush: { label: "Blush", background: "#fff5f7", surface: "#ffffff", text: "#3b0a1a", muted: "#9f5a70", border: "#fbd5de", accent: "#db2777" },
  sand: { label: "Sand", background: "#f5efe6", surface: "#fbf7f1", text: "#2b2118", muted: "#8a7560", border: "#e6dccd", accent: "#b45309" },
};

export const FONTS = {
  geist: { label: "Geist", family: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" },
  inter: { label: "Inter", family: "'Inter', sans-serif", google: "Inter:wght@400;500;600;700" },
  "dm-sans": { label: "DM Sans", family: "'DM Sans', sans-serif", google: "DM+Sans:wght@400;500;600;700" },
  manrope: { label: "Manrope", family: "'Manrope', sans-serif", google: "Manrope:wght@400;500;600;700;800" },
  "plus-jakarta": { label: "Plus Jakarta Sans", family: "'Plus Jakarta Sans', sans-serif", google: "Plus+Jakarta+Sans:wght@400;500;600;700;800" },
  outfit: { label: "Outfit", family: "'Outfit', sans-serif", google: "Outfit:wght@400;500;600;700" },
  sora: { label: "Sora", family: "'Sora', sans-serif", google: "Sora:wght@400;500;600;700" },
  "space-grotesk": { label: "Space Grotesk", family: "'Space Grotesk', sans-serif", google: "Space+Grotesk:wght@400;500;600;700" },
  bricolage: { label: "Bricolage Grotesque", family: "'Bricolage Grotesque', sans-serif", google: "Bricolage+Grotesque:wght@400;500;600;700;800" },
  syne: { label: "Syne", family: "'Syne', sans-serif", google: "Syne:wght@500;600;700;800" },
  playfair: { label: "Playfair Display", family: "'Playfair Display', serif", google: "Playfair+Display:wght@500;600;700;800" },
  fraunces: { label: "Fraunces", family: "'Fraunces', serif", google: "Fraunces:wght@400;500;600;700" },
  "dm-serif": { label: "DM Serif Display", family: "'DM Serif Display', serif", google: "DM+Serif+Display" },
  "instrument-serif": { label: "Instrument Serif", family: "'Instrument Serif', serif", google: "Instrument+Serif" },
  jetbrains: { label: "JetBrains Mono", family: "'JetBrains Mono', monospace", google: "JetBrains+Mono:wght@400;500;600;700" },
};

export const RADIUS_OPTIONS = [
  { value: "none", label: "Square", px: 0 },
  { value: "sm", label: "Subtle", px: 6 },
  { value: "md", label: "Soft", px: 12 },
  { value: "lg", label: "Round", px: 18 },
  { value: "xl", label: "Pill", px: 28 },
];

export const CARD_STYLES = [
  { value: "flat", label: "Flat" },
  { value: "outline", label: "Outline" },
  { value: "elevated", label: "Elevated" },
  { value: "glass", label: "Glass" },
];

export const WIDTH_OPTIONS = [
  { value: "narrow", label: "Narrow", px: 720 },
  { value: "standard", label: "Standard", px: 1024 },
  { value: "wide", label: "Wide", px: 1280 },
];

export const BACKDROP_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "glow", label: "Accent glow" },
  { value: "gradient", label: "Gradient" },
  { value: "image", label: "Image" },
];

// ---------------------------------------------------------------------------
// Effects & motion — shared by the header, every section and the theme

/** How a section enters as it scrolls into view. */
export const ANIMATIONS = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade in" },
  { value: "rise", label: "Rise up" },
  { value: "zoom", label: "Zoom in" },
  { value: "slide", label: "Slide in" },
  { value: "blur", label: "Blur in" },
];

/** A decorative layer drawn over a section or banner. */
export const EFFECTS = [
  { value: "none", label: "None" },
  { value: "grain", label: "Film grain" },
  { value: "grid", label: "Grid lines" },
  { value: "dots", label: "Dot pattern" },
  { value: "glow", label: "Accent glow" },
  { value: "aurora", label: "Aurora (animated)" },
  { value: "vignette", label: "Vignette" },
  { value: "beam", label: "Border beam (animated)" },
];

/** Treatments for a background or banner image. */
export const MEDIA_EFFECTS = [
  { value: "none", label: "Still" },
  { value: "kenburns", label: "Slow zoom" },
  { value: "parallax", label: "Parallax" },
  { value: "blur", label: "Soft blur" },
  { value: "mono", label: "Black & white" },
  { value: "duotone", label: "Duotone" },
];

export const SECTION_BACKGROUNDS = [
  { value: "none", label: "None" },
  { value: "surface", label: "Card" },
  { value: "accent", label: "Accent tint" },
  { value: "gradient", label: "Gradient" },
  { value: "image", label: "Image" },
];

export const OVERLAY_OPTIONS = [
  { value: "light", label: "Light", pct: 35 },
  { value: "medium", label: "Medium", pct: 60 },
  { value: "heavy", label: "Heavy", pct: 82 },
];

export const PADDING_OPTIONS = [
  { value: "sm", label: "Tight" },
  { value: "md", label: "Comfy" },
  { value: "lg", label: "Roomy" },
];

export const CARD_HOVERS = [
  { value: "none", label: "None" },
  { value: "lift", label: "Lift" },
  { value: "glow", label: "Glow" },
  { value: "zoom", label: "Zoom" },
];

export const BUTTON_STYLES = [
  { value: "solid", label: "Solid" },
  { value: "gradient", label: "Gradient" },
  { value: "glow", label: "Glow" },
  { value: "shine", label: "Shine" },
];

export const COUNTDOWN_STYLES = [
  { value: "cards", label: "Cards" },
  { value: "minimal", label: "Minimal" },
  { value: "outline", label: "Outline" },
];

// ---------------------------------------------------------------------------
// Header, nav, sections

export const HEADER_LAYOUTS = [
  { value: "banner", label: "Banner", description: "Wide banner with your avatar overlapping it." },
  { value: "centered", label: "Centered", description: "Banner with a centred avatar, name and actions." },
  { value: "hero", label: "Full hero", description: "Tall full-bleed image with your name over it." },
  { value: "split", label: "Split", description: "Name and pitch beside a large portrait image." },
  { value: "minimal", label: "Minimal", description: "No banner — a compact identity row." },
];

export const NAV_STYLES = [
  { value: "underline", label: "Underline" },
  { value: "pills", label: "Pills" },
  { value: "segmented", label: "Segmented" },
];

export const PAGE_TABS = [
  { value: "home", label: "Home", locked: true },
  { value: "posts", label: "Posts" },
  { value: "membership", label: "Membership" },
  { value: "shop", label: "Shop" },
  { value: "about", label: "About" },
];

export const AUDIENCE_OPTIONS = [
  { value: "all", label: "Everyone" },
  { value: "guests", label: "Non-members only" },
  { value: "members", label: "Members only" },
  { value: "tier", label: "Members of a tier and above" },
];

export const CTA_ACTIONS = [
  { value: "join", label: "Open membership" },
  { value: "follow", label: "Follow" },
  { value: "tip", label: "Send a tip" },
  { value: "link", label: "Open a link" },
];

/** Every section type the builder can add, with its default props. */
export const SECTION_TYPES = {
  hero: {
    label: "Hero",
    description: "A big welcome — headline, pitch, image or video and a call to action.",
    defaults: { eyebrow: "", heading: "", body: "", mediaAssetId: null, ctaLabel: "Become a member", ctaAction: "join", ctaUrl: "", align: "left" },
  },
  featured: {
    label: "Featured posts",
    description: "Pinned, hand-picked or most-liked posts up front.",
    defaults: { title: "Featured", mode: "pinned", postIds: [], limit: 3 },
  },
  tiers: {
    label: "Membership tiers",
    description: "Your tiers side by side with a monthly / annual switch.",
    defaults: { title: "Membership", subtitle: "", highlightTierId: null },
  },
  feed: {
    label: "Post feed",
    description: "Your latest posts as a list or a grid.",
    defaults: { title: "Latest posts", limit: 5, layout: "list", filter: "all" },
  },
  gallery: {
    label: "Media grid",
    description: "Photos and videos from your posts — locked ones stay blurred.",
    defaults: { title: "Gallery", layout: "grid", columns: 3, limit: 12, includeLocked: true },
  },
  bundles: {
    label: "Bundles",
    description: "Post bundles for sale.",
    defaults: { title: "Bundles" },
  },
  text: {
    label: "Text",
    description: "A heading and a few paragraphs.",
    defaults: { heading: "", body: "", align: "left" },
  },
  links: {
    label: "Links",
    description: "Your links as buttons.",
    defaults: { title: "Links", style: "buttons" },
  },
  faq: {
    label: "FAQ",
    description: "Questions and answers — billing, content, schedule.",
    defaults: { title: "FAQ", items: [] },
  },
  countdown: {
    label: "Countdown",
    description: "A timer to your next drop, stream or launch.",
    defaults: { title: "", body: "", date: "", ctaLabel: "", ctaAction: "join", ctaUrl: "", display: "cards" },
  },
  follow: {
    label: "Follow",
    description: "Free follow for fans not ready to pay yet.",
    defaults: { heading: "Stay in the loop", body: "" },
  },
  tip: {
    label: "Tip jar",
    description: "One-tap support with your suggested amounts.",
    defaults: { heading: "Support my work", body: "" },
  },
  embed: {
    label: "Embed",
    description: "A YouTube, Vimeo, Spotify or SoundCloud player.",
    defaults: { title: "", url: "" },
  },
};

export const SECTION_TYPE_ORDER = Object.keys(SECTION_TYPES);

// ---------------------------------------------------------------------------
// Defaults + normalising

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `s-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** A section's look: its backdrop, a decorative layer and how it animates in. */
export const SECTION_STYLE_DEFAULTS = {
  background: "none",
  bgAssetId: null,
  mediaEffect: "none",
  overlay: "medium",
  effect: "none",
  padding: "md",
  width: "contained",
  animation: "inherit",
};

export function newSection(type) {
  const spec = SECTION_TYPES[type];
  if (!spec) return null;
  return { id: uid(), type, hidden: false, audience: "all", minTierId: null, props: structuredCloneSafe(spec.defaults), style: { ...SECTION_STYLE_DEFAULTS } };
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

/** The page a creator starts from — a proven layout they then make their own. */
export function defaultPageConfig(profile = {}) {
  const accent = isHex(profile.accentColor) ? profile.accentColor : THEME_PRESETS.midnight.accent;
  const sections = ["featured", "tiers", "feed", "bundles", "follow"].map((type) => newSection(type));
  sections[1].audience = "guests";
  sections[4].audience = "guests";
  return normalizePageConfig({ theme: { ...presetTheme("midnight"), accent }, sections });
}

export function presetTheme(key) {
  const p = THEME_PRESETS[key] || THEME_PRESETS.midnight;
  return {
    preset: THEME_PRESETS[key] ? key : "midnight",
    background: p.background,
    surface: p.surface,
    text: p.text,
    muted: p.muted,
    border: p.border,
    accent: p.accent,
  };
}

const HEX_RE = /^#[0-9a-f]{6}$/i;
function isHex(v) {
  return typeof v === "string" && HEX_RE.test(v);
}
function pick(value, options, fallback) {
  const values = options.map((o) => (typeof o === "string" ? o : o.value));
  return values.includes(value) ? value : fallback;
}
function str(value, max = 500) {
  return typeof value === "string" ? value.slice(0, max) : "";
}
function int(value, min, max, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function uuidOrNull(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}
function safeUrl(value) {
  const s = str(value, 1000).trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function normalizeTheme(raw = {}) {
  const base = presetTheme(raw.preset);
  const color = (key) => (isHex(raw[key]) ? raw[key] : base[key]);
  return {
    // "custom" once a colour is changed by hand; its colours still fall back to Midnight.
    preset: raw.preset === "custom" ? "custom" : base.preset,
    background: color("background"),
    surface: color("surface"),
    text: color("text"),
    muted: color("muted"),
    border: color("border"),
    accent: color("accent"),
    fontBody: FONTS[raw.fontBody] ? raw.fontBody : "geist",
    fontHeading: FONTS[raw.fontHeading] ? raw.fontHeading : "geist",
    radius: pick(raw.radius, RADIUS_OPTIONS, "lg"),
    card: pick(raw.card, CARD_STYLES, "flat"),
    width: pick(raw.width, WIDTH_OPTIONS, "standard"),
    backdrop: pick(raw.backdrop, BACKDROP_OPTIONS, "glow"),
    backdropAssetId: uuidOrNull(raw.backdropAssetId),
    // Page-wide motion: the default section entrance, card hover and button finish.
    sectionAnimation: pick(raw.sectionAnimation, ANIMATIONS, "rise"),
    cardHover: pick(raw.cardHover, CARD_HOVERS, "lift"),
    buttonStyle: pick(raw.buttonStyle, BUTTON_STYLES, "solid"),
  };
}

function normalizeSectionProps(type, raw = {}) {
  const d = SECTION_TYPES[type].defaults;
  const p = { ...d, ...(raw && typeof raw === "object" ? raw : {}) };
  switch (type) {
    case "hero":
      return {
        eyebrow: str(p.eyebrow, 80),
        heading: str(p.heading, 160),
        body: str(p.body, 1200),
        mediaAssetId: uuidOrNull(p.mediaAssetId),
        ctaLabel: str(p.ctaLabel, 40),
        ctaAction: pick(p.ctaAction, CTA_ACTIONS, "join"),
        ctaUrl: safeUrl(p.ctaUrl),
        align: pick(p.align, ["left", "center"], "left"),
      };
    case "featured":
      return {
        title: str(p.title, 80),
        mode: pick(p.mode, ["pinned", "picked", "popular"], "pinned"),
        postIds: (Array.isArray(p.postIds) ? p.postIds : []).map(uuidOrNull).filter(Boolean).slice(0, 12),
        limit: int(p.limit, 1, 12, 3),
      };
    case "tiers":
      return { title: str(p.title, 80), subtitle: str(p.subtitle, 240), highlightTierId: uuidOrNull(p.highlightTierId) };
    case "feed":
      return {
        title: str(p.title, 80),
        limit: int(p.limit, 1, 30, 5),
        layout: pick(p.layout, ["list", "grid"], "list"),
        filter: pick(p.filter, ["all", "public", "members", "ppv"], "all"),
      };
    case "gallery":
      return {
        title: str(p.title, 80),
        layout: pick(p.layout, ["grid", "masonry"], "grid"),
        columns: int(p.columns, 2, 4, 3),
        limit: int(p.limit, 3, 48, 12),
        includeLocked: p.includeLocked !== false,
      };
    case "bundles":
      return { title: str(p.title, 80) };
    case "text":
      return { heading: str(p.heading, 160), body: str(p.body, 4000), align: pick(p.align, ["left", "center"], "left") };
    case "links":
      return { title: str(p.title, 80), style: pick(p.style, ["buttons", "list"], "buttons") };
    case "faq":
      return {
        title: str(p.title, 80),
        items: (Array.isArray(p.items) ? p.items : [])
          .map((i) => ({ q: str(i?.q, 200), a: str(i?.a, 1500) }))
          .slice(0, 20),
      };
    case "countdown":
      return {
        title: str(p.title, 120),
        body: str(p.body, 600),
        date: str(p.date, 40),
        ctaLabel: str(p.ctaLabel, 40),
        ctaAction: pick(p.ctaAction, CTA_ACTIONS, "join"),
        ctaUrl: safeUrl(p.ctaUrl),
        display: pick(p.display, COUNTDOWN_STYLES, "cards"),
      };
    case "follow":
    case "tip":
      return { heading: str(p.heading, 120), body: str(p.body, 600) };
    case "embed":
      return { title: str(p.title, 120), url: safeUrl(p.url) };
    default:
      return {};
  }
}

function normalizeSectionStyle(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  return {
    background: pick(s.background, SECTION_BACKGROUNDS, "none"),
    bgAssetId: uuidOrNull(s.bgAssetId),
    mediaEffect: pick(s.mediaEffect, MEDIA_EFFECTS, "none"),
    overlay: pick(s.overlay, OVERLAY_OPTIONS, "medium"),
    effect: pick(s.effect, EFFECTS, "none"),
    padding: pick(s.padding, PADDING_OPTIONS, "md"),
    width: pick(s.width, ["contained", "full"], "contained"),
    // "inherit" follows the theme's section animation.
    animation: s.animation === "inherit" || !s.animation ? "inherit" : pick(s.animation, ANIMATIONS, "inherit"),
  };
}

function normalizeSection(raw) {
  if (!raw || !SECTION_TYPES[raw.type]) return null;
  return {
    id: str(raw.id, 64) || uid(),
    type: raw.type,
    hidden: Boolean(raw.hidden),
    audience: pick(raw.audience, AUDIENCE_OPTIONS, "all"),
    minTierId: uuidOrNull(raw.minTierId),
    props: normalizeSectionProps(raw.type, raw.props),
    style: normalizeSectionStyle(raw.style),
  };
}

/** Any stored / edited page document -> a complete, valid one. */
export function normalizePageConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const header = src.header || {};
  const nav = src.nav || {};
  const cta = src.cta || {};
  const seo = src.seo || {};
  const footer = src.footer || {};
  const tabs = nav.tabs && typeof nav.tabs === "object" ? nav.tabs : {};
  const sections = (Array.isArray(src.sections) ? src.sections : []).map(normalizeSection).filter(Boolean).slice(0, MAX_SECTIONS);
  const seen = new Set();
  return {
    version: PAGE_CONFIG_VERSION,
    theme: normalizeTheme(src.theme),
    header: {
      layout: pick(header.layout, HEADER_LAYOUTS, "banner"),
      showStats: header.showStats !== false,
      showSocials: header.showSocials !== false,
      mediaEffect: pick(header.mediaEffect, MEDIA_EFFECTS, "none"),
      overlay: pick(header.overlay, OVERLAY_OPTIONS, "medium"),
      effect: pick(header.effect, EFFECTS, "none"),
      animate: header.animate !== false,
    },
    nav: {
      style: pick(nav.style, NAV_STYLES, "underline"),
      sticky: nav.sticky !== false,
      tabs: Object.fromEntries(PAGE_TABS.map((t) => [t.value, t.locked ? true : tabs[t.value] !== false])),
      links: (Array.isArray(nav.links) ? nav.links : [])
        .map((l) => ({ label: str(l?.label, 40), url: safeUrl(l?.url) }))
        .filter((l) => l.label && l.url)
        .slice(0, 5),
    },
    cta: {
      label: str(cta.label, 40) || "Become a member",
      mobileBar: cta.mobileBar !== false,
    },
    // Duplicate ids (e.g. a pasted section) get fresh ones so React keys stay unique.
    sections: sections.map((s) => {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        return s;
      }
      const id = uid();
      seen.add(id);
      return { ...s, id };
    }),
    seo: { title: str(seo.title, 70), description: str(seo.description, 200) },
    footer: { text: str(footer.text, 280), showBranding: footer.showBranding !== false },
  };
}

// ---------------------------------------------------------------------------
// Rendering helpers

/** Should this viewer see the section? `access` = { member, tierRank }. */
export function sectionVisible(section, access, tiers) {
  if (section.hidden) return false;
  if (section.audience === "guests") return !access.member;
  if (section.audience === "members") return access.member;
  if (section.audience === "tier") {
    if (!access.member) return false;
    const min = tiers.find((t) => t.id === section.minTierId);
    return !min || access.tierRank >= min.position;
  }
  return true;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isDarkColor(hex) {
  return isHex(hex) ? luminance(hex) < 0.35 : true;
}

/** Readable text on top of `hex` — near-black or white. */
export function contrastText(hex) {
  return isHex(hex) && luminance(hex) > 0.45 ? "#0b0b0f" : "#ffffff";
}

function mix(a, b, pct) {
  return `color-mix(in oklab, ${a}, ${b} ${pct}%)`;
}

/**
 * The page's design tokens. They override the suite's semantic tokens so every
 * shared primitive (buttons, dialogs, inputs) picks up the creator's theme.
 */
export function themeTokens(theme) {
  const t = normalizeTheme(theme);
  const radius = RADIUS_OPTIONS.find((r) => r.value === t.radius)?.px ?? 18;
  const accentText = contrastText(t.accent);
  const dark = isDarkColor(t.background);
  return {
    "color-scheme": dark ? "dark" : "light",
    "--background": t.background,
    "--foreground": t.text,
    "--card": t.surface,
    "--card-foreground": t.text,
    "--popover": t.surface,
    "--popover-foreground": t.text,
    "--primary": t.accent,
    "--primary-foreground": accentText,
    "--secondary": mix(t.surface, t.text, 6),
    "--secondary-foreground": t.text,
    "--muted": mix(t.surface, t.text, 6),
    "--muted-foreground": t.muted,
    "--accent": mix(t.surface, t.text, 8),
    "--accent-foreground": t.text,
    "--border": t.border,
    "--input": t.border,
    "--ring": t.accent,
    "--surface-subtle": t.surface,
    "--surface-card": mix(t.surface, t.text, 4),
    "--surface-hover": mix(t.surface, t.text, 8),
    "--surface-active": mix(t.surface, t.text, 11),
    "--surface-dialog": t.surface,
    "--surface-strong": mix(t.surface, t.text, 16),
    "--border-strong": mix(t.border, t.text, 18),
    "--text-secondary": t.muted,
    "--text-tertiary": mix(t.muted, t.background, 30),
    "--cp-accent": t.accent,
    "--cp-accent-text": accentText,
    "--cp-radius": `${radius}px`,
    "--cp-font-body": FONTS[t.fontBody].family,
    "--cp-font-heading": FONTS[t.fontHeading].family,
    "--cp-width": `${WIDTH_OPTIONS.find((w) => w.value === t.width)?.px ?? 1024}px`,
  };
}

/** Google Fonts stylesheet for the theme's fonts, or "" when only Geist is used. */
export function fontHref(theme) {
  const families = [...new Set([theme?.fontBody, theme?.fontHeading])].map((k) => FONTS[k]?.google).filter(Boolean);
  if (!families.length) return "";
  return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap`;
}

/** YouTube / Vimeo / Spotify / SoundCloud page URL -> its player URL, else "". */
export function embedSrc(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtube.com") {
      const id = u.searchParams.get("v") || u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{6,})/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
    }
    if (host === "vimeo.com") {
      const id = u.pathname.match(/\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : "";
    }
    if (host === "open.spotify.com") {
      const m = u.pathname.match(/^\/(track|album|playlist|episode|show|artist)\/(\w+)/);
      return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : "";
    }
    if (host === "soundcloud.com") {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.toString())}&visual=true`;
    }
  } catch {
    return "";
  }
  return "";
}

export function embedIsAudio(src) {
  return src.includes("spotify.com") || src.includes("soundcloud.com");
}

/** Every asset id the page document points at (hero media, section backgrounds, backdrop). */
export function pageAssetIds(config) {
  const ids = new Set();
  if (config?.theme?.backdropAssetId) ids.add(config.theme.backdropAssetId);
  for (const s of config?.sections || []) {
    if (s.type === "hero" && s.props.mediaAssetId) ids.add(s.props.mediaAssetId);
    if (s.style?.background === "image" && s.style.bgAssetId) ids.add(s.style.bgAssetId);
  }
  return [...ids];
}

/** The section's resolved entrance animation — its own, or the theme's default. */
export function sectionAnimation(section, theme) {
  const own = section.style?.animation;
  return own && own !== "inherit" ? own : theme?.sectionAnimation || "none";
}
