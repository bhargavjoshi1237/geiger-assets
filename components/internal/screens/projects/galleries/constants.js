// Lookups, option lists and formatters for the Galleries area. Config only —
// no row data lives here; galleries come from lib/supabase/galleries.js.

export const STATUS_META = {
  draft: {
    variant: "neutral",
    label: "Draft",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
  published: {
    variant: "success",
    label: "Published",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  unpublished: {
    variant: "warning",
    label: "Unpublished",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
};

// Deliberately not the collections private/team/public set — "team" is
// meaningless on a page whose purpose is to be seen from outside the workspace.
export const VISIBILITY_META = {
  public: {
    variant: "success",
    label: "Public",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  unlisted: {
    variant: "info",
    label: "Unlisted",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    dotClass: "bg-blue-400",
  },
  private: {
    variant: "neutral",
    label: "Private",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
};

export const DOMAIN_STATUS_META = {
  pending: {
    variant: "neutral",
    label: "Pending",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
  verifying: {
    variant: "info",
    label: "Verifying",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    dotClass: "bg-blue-400",
  },
  active: {
    variant: "success",
    label: "Active",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  failed: {
    variant: "destructive",
    label: "Failed",
    className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    dotClass: "bg-red-400",
  },
};

export const SSL_STATUS_META = {
  none: { label: "No certificate", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30" },
  pending: { label: "Issuing", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  issued: { label: "Secured", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  error: { label: "Error", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
};

export const REQUEST_STATUS_META = {
  pending: {
    variant: "warning",
    label: "Pending",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  approved: {
    variant: "success",
    label: "Approved",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  denied: {
    variant: "destructive",
    label: "Denied",
    className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    dotClass: "bg-red-400",
  },
};

export const LAYOUT_META = {
  grid: { label: "Grid", hint: "Even tiles in a fixed column count." },
  masonry: { label: "Masonry", hint: "Columns that keep each image's own height." },
  justified: { label: "Justified rows", hint: "Full-bleed rows of equal height." },
  mosaic: { label: "Mosaic", hint: "A square grid where every sixth tile is featured large." },
  slideshow: { label: "Slideshow", hint: "One asset at a time, with navigation." },
  single: { label: "Single column", hint: "One large asset per row, editorial style." },
};

export const DOWNLOAD_MODE_META = {
  open: { label: "Open", hint: "Anyone viewing the gallery can download." },
  request: { label: "On request", hint: "Visitors ask; you approve or deny." },
  off: { label: "Disabled", hint: "No downloads offered." },
};

export const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "unpublished", label: "Unpublished" },
];

export const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "unlisted", label: "Unlisted" },
  { value: "private", label: "Private" },
];

export const LAYOUT_OPTIONS = Object.entries(LAYOUT_META).map(([value, m]) => ({
  value,
  label: m.label,
}));

export const DOWNLOAD_MODE_OPTIONS = Object.entries(DOWNLOAD_MODE_META).map(([value, m]) => ({
  value,
  label: m.label,
}));

export const SOURCE_OPTIONS = [
  { value: "collection", label: "Collection (live)" },
  { value: "curated", label: "Curated selection" },
];

export const DOMAIN_KIND_OPTIONS = [
  { value: "subdomain", label: "Geiger subdomain" },
  { value: "custom", label: "Custom domain" },
];

export const STATUS_FILTER_OPTIONS = [{ value: "all", label: "All Statuses" }, ...STATUS_OPTIONS];
export const VISIBILITY_FILTER_OPTIONS = [
  { value: "all", label: "All Visibility" },
  ...VISIBILITY_OPTIONS,
];
export const LAYOUT_FILTER_OPTIONS = [{ value: "all", label: "All Layouts" }, ...LAYOUT_OPTIONS];
export const REQUEST_FILTER_OPTIONS = [
  { value: "all", label: "All Requests" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
];

export const SORT_OPTIONS = [
  { value: "modified-desc", label: "Last Modified" },
  { value: "modified-asc", label: "Oldest Modified" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
];

// The page chrome lives in the theme bag too. Header links stay in the gallery's
// own `nav` column; everything else about the bars is presentation.
export const DEFAULT_HEADER = {
  show: false,
  brand: "",
  logoAssetId: "",
  logoUrl: "",
  align: "right",
  ctaLabel: "",
  ctaHref: "",
};

export const DEFAULT_FOOTER = {
  show: true,
  text: "",
  links: [],
  align: "split",
  credit: true,
};

export const DEFAULT_POSTER = {
  aspect: "cinema",
  focus: "center",
  motion: "none",
  frame: "hairline",
  frameColor: "neutral",
  corners: "subtle",
  shadow: "none",
  overlay: false,
  eyebrow: "",
  title: "",
  subtitle: "",
  button: "",
  position: "bottom-left",
  scrim: "gradient",
  size: "md",
};

// Theme defaults applied to a new gallery and used as the fallback wherever a
// stored theme is missing a key.
export const DEFAULT_THEME = {
  accent: "#6366f1",
  ground: "dark",
  typography: "sans",
  gap: "comfortable",
  radius: "rounded",
  caption: "below",
  // Layout detail
  columns: "auto",
  tileShape: "square",
  width: "contained",
  hover: "zoom",
  entrance: "none",
  // Page look
  texture: "grid",
  titleSize: "regular",
  heroAlign: "left",
  showStats: true,
  accentButtons: false,
  header: DEFAULT_HEADER,
  footer: DEFAULT_FOOTER,
  poster: DEFAULT_POSTER,
};

export const ACCENT_SWATCHES = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#64748b",
];

export const GROUND_OPTIONS = [
  { value: "dark", label: "Suite" },
  { value: "midnight", label: "Midnight" },
  { value: "light", label: "Light" },
  { value: "paper", label: "Paper" },
];

export const TYPOGRAPHY_OPTIONS = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
];

export const GAP_OPTIONS = [
  { value: "tight", label: "Tight" },
  { value: "comfortable", label: "Comfortable" },
  { value: "airy", label: "Airy" },
];

export const RADIUS_OPTIONS = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "pill", label: "Soft" },
];

export const CAPTION_OPTIONS = [
  { value: "below", label: "Below" },
  { value: "overlay", label: "Overlay" },
  { value: "none", label: "Hidden" },
];

export const COLUMN_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
];

export const TILE_SHAPE_OPTIONS = [
  { value: "square", label: "Square" },
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];

export const WIDTH_OPTIONS = [
  { value: "contained", label: "Contained" },
  { value: "wide", label: "Wide" },
  { value: "full", label: "Full bleed" },
];

export const HOVER_OPTIONS = [
  { value: "zoom", label: "Zoom" },
  { value: "lift", label: "Lift" },
  { value: "mono", label: "Mono to color" },
  { value: "none", label: "None" },
];

export const ENTRANCE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade in" },
  { value: "rise", label: "Rise up" },
];

export const TEXTURE_OPTIONS = [
  { value: "grid", label: "Grid" },
  { value: "dots", label: "Dots" },
  { value: "glow", label: "Accent glow" },
  { value: "none", label: "Plain" },
];

export const TITLE_SIZE_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "large", label: "Large" },
  { value: "display", label: "Display" },
];

export const HERO_ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
];

export const HEADER_ALIGN_OPTIONS = [
  { value: "right", label: "Right" },
  { value: "center", label: "Center" },
];

export const FOOTER_ALIGN_OPTIONS = [
  { value: "split", label: "Split" },
  { value: "center", label: "Centered" },
];

export const POSTER_ASPECT_OPTIONS = [
  { value: "cinema", label: "21:9" },
  { value: "wide", label: "16:9" },
  { value: "classic", label: "3:2" },
  { value: "natural", label: "Original" },
];

export const POSTER_FOCUS_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
];

export const POSTER_MOTION_OPTIONS = [
  { value: "none", label: "Still" },
  { value: "hover", label: "Zoom on hover" },
  { value: "drift", label: "Slow drift" },
];

export const POSTER_FRAME_OPTIONS = [
  { value: "none", label: "None" },
  { value: "hairline", label: "Hairline" },
  { value: "bold", label: "Bold" },
  { value: "matted", label: "Matted" },
];

export const POSTER_FRAME_COLOR_OPTIONS = [
  { value: "neutral", label: "Neutral" },
  { value: "accent", label: "Accent" },
  { value: "contrast", label: "Contrast" },
];

export const POSTER_CORNER_OPTIONS = [
  { value: "square", label: "Square" },
  { value: "subtle", label: "Subtle" },
  { value: "rounded", label: "Rounded" },
  { value: "soft", label: "Soft" },
];

export const POSTER_SHADOW_OPTIONS = [
  { value: "none", label: "Flat" },
  { value: "soft", label: "Lifted" },
  { value: "glow", label: "Accent glow" },
];

export const POSTER_POSITION_OPTIONS = [
  { value: "top-left", label: "Top left" },
  { value: "center", label: "Center" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom center" },
];

export const POSTER_SCRIM_OPTIONS = [
  { value: "none", label: "None" },
  { value: "gradient", label: "Gradient" },
  { value: "full", label: "Full tint" },
];

export const POSTER_SIZE_OPTIONS = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
];

/** Tailwind classes per theme key, shared by the editor preview and the public page. */
export const GAP_CLASS = { tight: "gap-1", comfortable: "gap-3", airy: "gap-6" };
export const RADIUS_CLASS = { square: "rounded-none", rounded: "rounded-lg", pill: "rounded-2xl" };
export const TYPOGRAPHY_CLASS = { sans: "font-sans", serif: "font-serif", mono: "font-mono" };
export const WIDTH_CLASS = { contained: "max-w-6xl", wide: "max-w-[88rem]", full: "max-w-none" };
export const TITLE_SIZE_CLASS = {
  regular: "text-3xl sm:text-5xl",
  large: "text-4xl sm:text-6xl",
  display: "text-5xl tracking-tighter sm:text-7xl lg:text-8xl",
};

/** Max-width class every page band (top bar, hero, toolbar, gallery, footer) shares. */
export function pageWidth(theme) {
  return WIDTH_CLASS[theme?.width] || WIDTH_CLASS.contained;
}

/** Near-black or white, whichever reads better on the given hex colour. */
export function readableOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#18181b" : "#ffffff";
}

/**
 * Class + style for a primary button: the ground's own primary, or the accent
 * with readable text when the theme puts the accent on buttons.
 */
export function primaryButton(theme, tone) {
  if (!theme?.accentButtons) return { className: tone.primary, style: undefined };
  return {
    className: "hover:brightness-110",
    style: { background: theme.accent, color: readableOn(theme.accent) },
  };
}

// Each ground carries the full set of classes the page needs. "dark" (shown as
// Suite) is the suite's own palette through semantic tokens, so it follows the
// app theme; light, midnight and paper are fixed ramps that look the same for
// every visitor. The accent is deliberately *not* in here — it only tints
// details unless the theme opts buttons into it (see primaryButton).
export const GROUND_TONE = {
  dark: {
    page: "bg-background text-foreground",
    bar: "bg-background/80",
    surface: "bg-surface-subtle",
    card: "bg-surface-card",
    border: "border-border",
    divide: "divide-border",
    muted: "text-muted-foreground",
    subtle: "text-text-tertiary",
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    chip: "border-border bg-surface-subtle text-text-secondary hover:bg-surface-hover hover:text-foreground",
    link: "text-text-secondary hover:bg-surface-hover hover:text-foreground",
    contrast: "border-zinc-900 dark:border-white/85",
    rule: "via-border-strong",
    // geiger-ui Tabs already use the suite palette on dark.
    tabsList: "",
    tabsTrigger: "",
    media: "bg-surface-card",
    caption: "text-text-secondary",
    stage: "bg-black",
    // Same faint grid the landing page sits on.
    texture: "bg-[linear-gradient(to_right,#80808026_1px,transparent_1px),linear-gradient(to_bottom,#80808026_1px,transparent_1px)]",
    dots: "bg-[radial-gradient(#80808059_1px,transparent_1px)]",
  },
  midnight: {
    page: "bg-zinc-950 text-zinc-100",
    bar: "bg-zinc-950/80",
    surface: "bg-zinc-900",
    card: "bg-zinc-900",
    border: "border-zinc-800",
    divide: "divide-zinc-800",
    muted: "text-zinc-400",
    subtle: "text-zinc-500",
    primary: "bg-zinc-100 text-zinc-900 hover:bg-white",
    chip: "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white",
    link: "text-zinc-400 hover:bg-zinc-900 hover:text-white",
    contrast: "border-white/85",
    rule: "via-zinc-700",
    tabsList: "border-zinc-800 bg-zinc-900",
    tabsTrigger:
      "text-zinc-400 hover:text-zinc-100 group-data-[variant=default]/tabs-list:hover:bg-zinc-800 group-data-[variant=default]/tabs-list:data-[state=active]:bg-zinc-800 group-data-[variant=default]/tabs-list:data-[state=active]:text-zinc-100",
    media: "bg-zinc-900",
    caption: "text-zinc-400",
    stage: "bg-black",
    texture: "bg-[linear-gradient(to_right,#a1a1aa14_1px,transparent_1px),linear-gradient(to_bottom,#a1a1aa14_1px,transparent_1px)]",
    dots: "bg-[radial-gradient(#a1a1aa33_1px,transparent_1px)]",
  },
  light: {
    page: "bg-zinc-50 text-zinc-900",
    bar: "bg-zinc-50/80",
    surface: "bg-white",
    card: "bg-zinc-100",
    border: "border-zinc-200",
    divide: "divide-zinc-200",
    muted: "text-zinc-600",
    subtle: "text-zinc-500",
    primary: "bg-zinc-900 text-white hover:bg-zinc-800",
    chip: "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
    link: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
    contrast: "border-zinc-900",
    rule: "via-zinc-300",
    // Same variant-scoped selectors geiger-ui Tabs use, so these replace its
    // dark-token hover/active colours rather than losing on specificity.
    tabsList: "border-zinc-200 bg-white",
    tabsTrigger:
      "text-zinc-500 hover:text-zinc-900 group-data-[variant=default]/tabs-list:hover:bg-zinc-100 group-data-[variant=default]/tabs-list:data-[state=active]:bg-zinc-100 group-data-[variant=default]/tabs-list:data-[state=active]:text-zinc-900",
    media: "bg-zinc-200",
    caption: "text-zinc-600",
    stage: "bg-zinc-200",
    texture: "bg-[linear-gradient(to_right,#71717a1a_1px,transparent_1px),linear-gradient(to_bottom,#71717a1a_1px,transparent_1px)]",
    dots: "bg-[radial-gradient(#71717a40_1px,transparent_1px)]",
  },
  paper: {
    page: "bg-stone-100 text-stone-900",
    bar: "bg-stone-100/80",
    surface: "bg-stone-50",
    card: "bg-stone-200/70",
    border: "border-stone-300/70",
    divide: "divide-stone-300/70",
    muted: "text-stone-600",
    subtle: "text-stone-500",
    primary: "bg-stone-900 text-stone-50 hover:bg-stone-800",
    chip: "border-stone-300/70 bg-stone-50 text-stone-600 hover:bg-stone-200 hover:text-stone-900",
    link: "text-stone-600 hover:bg-stone-200/70 hover:text-stone-900",
    contrast: "border-stone-900",
    rule: "via-stone-400/70",
    tabsList: "border-stone-300/70 bg-stone-50",
    tabsTrigger:
      "text-stone-500 hover:text-stone-900 group-data-[variant=default]/tabs-list:hover:bg-stone-200/70 group-data-[variant=default]/tabs-list:data-[state=active]:bg-stone-200/70 group-data-[variant=default]/tabs-list:data-[state=active]:text-stone-900",
    media: "bg-stone-200",
    caption: "text-stone-600",
    stage: "bg-stone-200",
    texture: "bg-[linear-gradient(to_right,#78716c1f_1px,transparent_1px),linear-gradient(to_bottom,#78716c1f_1px,transparent_1px)]",
    dots: "bg-[radial-gradient(#78716c4d_1px,transparent_1px)]",
  },
};

export function groundTone(theme) {
  return GROUND_TONE[theme?.ground] || GROUND_TONE.dark;
}

function objectOr(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** Stored theme over the defaults — one level deep for the header/footer/poster groups. */
export function withThemeDefaults(theme) {
  const stored = objectOr(theme);
  const footer = { ...DEFAULT_FOOTER, ...objectOr(stored.footer) };
  return {
    ...DEFAULT_THEME,
    ...stored,
    header: { ...DEFAULT_HEADER, ...objectOr(stored.header) },
    footer: { ...footer, links: Array.isArray(footer.links) ? footer.links : [] },
    poster: { ...DEFAULT_POSTER, ...objectOr(stored.poster) },
  };
}

export { formatBytes, formatDate } from "@/lib/format";
