// Library domain: assets, folders, collections, versions, relationships,
// duplicates, requests, uploads and external upload portals.

import { personId } from "../cast";
import { base, daysAgo, daysFromNow, dateOnly, sid, noise } from "./helpers";

const BLOB = "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets";
const BLOB_IMAGES = [
  `${BLOB}/asset-00a586c62c8782e65c0a.jpg`,
  `${BLOB}/internal-brand-023-3291bb4c.jpg`,
  `${BLOB}/asset-0ec1f3ba625f482c9dc3.jpg`,
  `${BLOB}/asset-85923e7fafe00c9c0d1f.jpg`,
  `${BLOB}/asset-8e2e88cff7f33224ddd7.jpg`,
  `${BLOB}/asset-0a66efa21dd4b7e6c526.jpg`,
  `${BLOB}/asset-cc24ca462279ca23250c.jpg`,
];

const photo = (seed, w = 800, h = 600) => `https://picsum.photos/seed/geiger-${seed}/${w}/${h}`;

const FOLDERS = [
  // [n, name, parent n, path, location, color]
  [1, "Brand", null, "/Brand", "hot", "#3b82f6"],
  [2, "Logos", 1, "/Brand/Logos", "hot", "#6366f1"],
  [3, "Typography", 1, "/Brand/Typography", "hot", "#8b5cf6"],
  [4, "Campaigns", null, "/Campaigns", "hot", "#f59e0b"],
  [5, "Spring 2026", 4, "/Campaigns/Spring 2026", "hot", "#10b981"],
  [6, "Holiday 2025", 4, "/Campaigns/Holiday 2025", "cold", "#ef4444"],
  [7, "Product", null, "/Product", "cloud-s3", "#14b8a6"],
  [8, "Photography", 7, "/Product/Photography", "cloud-s3", "#06b6d4"],
  [9, "Video", null, "/Video", "cloud-s3", "#ec4899"],
  [10, "Audio", null, "/Audio", "hot", "#a855f7"],
  [11, "Documents", null, "/Documents", "hot", "#64748b"],
  [12, "3D", null, "/3D", "cloud-gcs", "#f97316"],
];

// [n, name, type, format, sizeMB, dimensions, folder, status, tags, color, thumb, downloads, days]
const ASSETS = [
  [1, "Primary logo — dark.svg", "image", "svg", 0.08, "2400x800", "/Brand/Logos", "approved", ["logo", "brand", "primary"], "#18181b", BLOB_IMAGES[1], 412, 120],
  [2, "Primary logo — light.svg", "image", "svg", 0.08, "2400x800", "/Brand/Logos", "approved", ["logo", "brand", "primary"], "#f4f4f5", BLOB_IMAGES[1], 388, 120],
  [3, "Wordmark stacked.png", "image", "png", 1.4, "2000x2000", "/Brand/Logos", "approved", ["logo", "wordmark"], "#27272a", photo("wordmark", 800, 800), 164, 96],
  [4, "Spring hero — meadow.jpg", "image", "jpg", 8.2, "6000x4000", "/Campaigns/Spring 2026", "approved", ["hero", "spring", "campaign"], "#4d7c0f", BLOB_IMAGES[0], 231, 18],
  [5, "Spring hero — city.jpg", "image", "jpg", 7.6, "6000x4000", "/Campaigns/Spring 2026", "review", ["hero", "spring", "urban"], "#0f766e", BLOB_IMAGES[2], 57, 9],
  [6, "Spring social square 01.jpg", "image", "jpg", 2.1, "1080x1080", "/Campaigns/Spring 2026", "approved", ["social", "instagram", "spring"], "#b45309", photo("spring-sq-1", 800, 800), 96, 12],
  [7, "Spring social square 02.jpg", "image", "jpg", 2.3, "1080x1080", "/Campaigns/Spring 2026", "review", ["social", "instagram", "spring"], "#be123c", photo("spring-sq-2", 800, 800), 41, 6],
  [8, "Spring story 9x16.jpg", "image", "jpg", 3.4, "1080x1920", "/Campaigns/Spring 2026", "draft", ["social", "story"], "#7c3aed", photo("spring-story", 540, 960), 12, 3],
  [9, "Holiday key visual.jpg", "image", "jpg", 9.8, "7200x4800", "/Campaigns/Holiday 2025", "approved", ["holiday", "key-visual"], "#991b1b", BLOB_IMAGES[3], 540, 210],
  [10, "Holiday gift guide banner.png", "image", "png", 4.4, "3000x1000", "/Campaigns/Holiday 2025", "archived", ["holiday", "banner", "web"], "#b91c1c", photo("gift-banner", 900, 300), 302, 240],
  [11, "Product — aurora lamp front.jpg", "image", "jpg", 5.1, "4000x5000", "/Product/Photography", "approved", ["product", "lamp", "packshot"], "#a16207", BLOB_IMAGES[4], 187, 44],
  [12, "Product — aurora lamp lifestyle.jpg", "image", "jpg", 6.3, "5000x3333", "/Product/Photography", "approved", ["product", "lamp", "lifestyle"], "#78350f", BLOB_IMAGES[5], 143, 40],
  [13, "Product — nova chair side.jpg", "image", "jpg", 4.8, "4000x5000", "/Product/Photography", "review", ["product", "chair", "packshot"], "#44403c", photo("nova-chair", 640, 800), 38, 8],
  [14, "Product — nova chair detail.jpg", "image", "jpg", 3.9, "4000x4000", "/Product/Photography", "processing", ["product", "chair", "detail"], "#57534e", photo("nova-detail", 800, 800), 0, 1],
  [15, "Studio portrait — founders.jpg", "image", "jpg", 7.2, "5472x3648", "/Brand", "approved", ["team", "portrait", "press"], "#1e293b", BLOB_IMAGES[6], 276, 150],
  [16, "Office interior wide.jpg", "image", "jpg", 6.8, "6000x4000", "/Brand", "approved", ["office", "interior"], "#334155", photo("office-wide"), 91, 88],
  [17, "Texture — paper grain.png", "image", "png", 12.4, "4096x4096", "/Brand", "approved", ["texture", "background"], "#d6d3d1", photo("paper-grain", 800, 800), 64, 70],
  [18, "Brand film — 60s cut.mp4", "video", "mp4", 412, "3840x2160", "/Video", "approved", ["brand-film", "4k", "hero"], "#0c0a09", photo("brand-film", 960, 540), 128, 34],
  [19, "Brand film — 15s cutdown.mp4", "video", "mp4", 98, "1920x1080", "/Video", "review", ["brand-film", "cutdown", "social"], "#1c1917", photo("cutdown", 960, 540), 22, 7],
  [20, "Spring teaser vertical.mov", "video", "mov", 186, "1080x1920", "/Campaigns/Spring 2026", "draft", ["teaser", "vertical", "spring"], "#365314", photo("teaser", 540, 960), 4, 2],
  [21, "Product demo — aurora lamp.mp4", "video", "mp4", 264, "1920x1080", "/Video", "approved", ["product", "demo", "lamp"], "#422006", photo("lamp-demo", 960, 540), 76, 52],
  [22, "Sonic logo.wav", "audio", "wav", 4.2, "", "/Audio", "approved", ["sonic", "brand", "audio-logo"], "#581c87", "", 63, 110],
  [23, "Podcast intro — ep. 12.mp3", "audio", "mp3", 18.6, "", "/Audio", "review", ["podcast", "voice"], "#6b21a8", "", 9, 5],
  [24, "Ambient bed — spring.mp3", "audio", "mp3", 9.3, "", "/Audio", "approved", ["music", "spring", "licensed"], "#7e22ce", "", 27, 21],
  [25, "Brand guidelines 2026.pdf", "pdf", "pdf", 24.8, "", "/Documents", "approved", ["guidelines", "brand"], "#1d4ed8", "", 612, 60],
  [26, "Spring campaign brief.docx", "document", "docx", 1.2, "", "/Documents", "approved", ["brief", "spring"], "#2563eb", "", 48, 30],
  [27, "Media plan Q2.xlsx", "document", "xlsx", 0.9, "", "/Documents", "draft", ["planning", "media"], "#16a34a", "", 17, 4],
  [28, "Photographer release — Lena Ortiz.pdf", "pdf", "pdf", 0.6, "", "/Documents", "approved", ["release", "legal"], "#475569", "", 5, 45],
  [29, "Packaging dieline.ai", "raw", "ai", 36.2, "", "/Product", "review", ["packaging", "print"], "#ea580c", "", 14, 11],
  [30, "Spring key visual master.psd", "raw", "psd", 512, "6000x4000", "/Campaigns/Spring 2026", "draft", ["master", "layered", "spring"], "#0e7490", "", 6, 10],
  [31, "Website components.fig", "raw", "fig", 22.5, "", "/Brand", "approved", ["ui", "web", "figma"], "#a21caf", "", 33, 25],
  [32, "Studio shoot RAW 0412.cr3", "raw", "cr3", 58.1, "6720x4480", "/Product/Photography", "draft", ["raw", "shoot"], "#3f3f46", "", 2, 8],
  [33, "Brand display font.otf", "raw", "otf", 0.4, "", "/Brand/Typography", "approved", ["font", "typography"], "#111827", "", 120, 180],
  [34, "Aurora lamp model.glb", "3d", "glb", 14.7, "", "/3D", "approved", ["3d", "product", "ar"], "#c2410c", photo("lamp-3d", 800, 800), 45, 28],
  [35, "Nova chair model.usdz", "3d", "usdz", 21.3, "", "/3D", "review", ["3d", "product", "ar"], "#9a3412", "", 7, 6],
  [36, "Press kit 2026.zip", "archive", "zip", 148, "", "/Documents", "approved", ["press", "kit"], "#52525b", "", 88, 14],
  [37, "Holiday lookbook.pdf", "pdf", "pdf", 31.5, "", "/Campaigns/Holiday 2025", "archived", ["lookbook", "holiday"], "#b91c1c", "", 204, 230],
  [38, "Team offsite recap.jpg", "image", "jpg", 5.4, "5000x3333", "/Brand", "draft", ["team", "culture"], "#0f172a", photo("offsite"), 3, 2],
];

const MB = 1024 * 1024;

function assetRows() {
  return ASSETS.map(([n, name, type, format, sizeMb, dimensions, folder, status, tags, color, thumb, downloads, days]) => ({
    ...base("asset", n, { created: days, updated: Math.max(0, Math.round(days * noise(n) * 0.6)) }),
    name,
    type,
    format,
    size_bytes: Math.round(sizeMb * MB),
    dimensions: dimensions || null,
    folder,
    status,
    tags,
    description: "",
    downloads,
    color,
    thumbnail_url: thumb,
    mini_thumbnail_url: "",
    storage_key: null,
    cdn_enabled: status === "approved" && n % 3 !== 0,
    cdn_enabled_at: status === "approved" ? daysAgo(Math.min(days, 12)) : null,
    delivery_enabled: status === "approved",
    created_by: personId(1 + (n % 5)),
    metadata:
      type === "raw" && format === "fig"
        ? { figmaUrl: "https://www.figma.com/file/playground/website-components" }
        : {},
  }));
}

// A handful of recently deleted assets feed Archive & Trash.
function trashedAssets() {
  return [
    [39, "Old logo lockup (2019).png", "image", "png", 0.7, "/Brand/Logos", photo("old-logo", 800, 800), 6],
    [40, "Draft banner v1.jpg", "image", "jpg", 2.2, "/Campaigns/Spring 2026", photo("draft-banner", 900, 300), 3],
    [41, "Unused b-roll 03.mp4", "video", "mp4", 142, "/Video", photo("broll", 960, 540), 12],
  ].map(([n, name, type, format, sizeMb, folder, thumb, deleted]) => ({
    ...base("asset", n, { created: 60, updated: deleted }),
    name,
    type,
    format,
    size_bytes: Math.round(sizeMb * MB),
    folder,
    status: "archived",
    tags: ["deprecated"],
    downloads: 0,
    color: "#52525b",
    thumbnail_url: thumb,
    deleted_at: daysAgo(deleted),
    created_by: personId(2),
  }));
}

function folderRows(assets) {
  return FOLDERS.map(([n, name, parent, path, location, color]) => {
    const size = assets
      .filter((a) => a.folder === path || a.folder.startsWith(`${path}/`))
      .reduce((sum, a) => sum + a.size_bytes, 0);
    return {
      ...base("folder", n, { created: 150 - n }),
      name,
      parent_id: parent ? sid("folder", parent) : null,
      path,
      storage_location: location,
      color,
      size_bytes: size,
      created_by: personId(1),
    };
  });
}

const COLLECTIONS = [
  // [n, name, description, type, color, status, favorite, visibility, asset ns]
  [1, "Spring 2026 launch", "Everything approved for the spring campaign rollout.", "manual", "#10b981", "active", true, "team", [4, 5, 6, 7, 8, 20, 24, 26]],
  [2, "Brand essentials", "Logos, type and guidelines every partner needs.", "board", "#3b82f6", "active", true, "public", [1, 2, 3, 25, 33, 15]],
  [3, "Product packshots", "Clean studio shots for ecommerce and retail partners.", "smart", "#f59e0b", "active", false, "team", [11, 12, 13, 14]],
  [4, "Video library", "Brand films, cutdowns and product demos.", "album", "#ec4899", "active", false, "team", [18, 19, 20, 21]],
  [5, "Press kit", "Approved media for journalists and partners.", "manual", "#8b5cf6", "active", false, "public", [1, 15, 16, 25, 36]],
  [6, "Holiday 2025 archive", "Last season's campaign, kept for reference.", "album", "#ef4444", "archived", false, "private", [9, 10, 37]],
];

function collectionRows() {
  const collections = [];
  const joins = [];
  let joinN = 1;
  for (const [n, name, description, type, color, status, favorite, visibility, assetNs] of COLLECTIONS) {
    collections.push({
      ...base("collection", n, { created: 90 - n * 7, updated: n }),
      name,
      description,
      type,
      cover_color: color,
      status,
      is_favorite: favorite,
      visibility,
      created_by: personId(1 + (n % 3)),
    });
    assetNs.forEach((an, position) => {
      joins.push({
        id: sid("collection_asset", joinN++),
        collection_id: sid("collection", n),
        asset_id: sid("asset", an),
        position,
        added_at: daysAgo(20 - position),
      });
    });
  }
  return { collections, joins };
}

function versionRows() {
  const rows = [];
  let n = 1;
  const history = {
    4: ["Initial grade", "Sky replaced", "Final retouch"],
    9: ["First pass", "Client edits"],
    18: ["Rough cut", "Picture lock", "Final mix"],
    25: ["2025 edition", "2026 refresh"],
    30: ["Layout", "Colour pass"],
  };
  for (const [assetN, labels] of Object.entries(history)) {
    labels.forEach((label, i) => {
      const isCurrent = i === labels.length - 1;
      rows.push({
        id: sid("version", n),
        asset_id: sid("asset", Number(assetN)),
        version_number: i + 1,
        label,
        is_current: isCurrent,
        size_bytes: Math.round((4 + i * 1.5) * MB),
        note: isCurrent ? "Current version" : "",
        created_by: personId(1 + (i % 4)),
        created_at: daysAgo(30 - i * 8),
        is_locked: isCurrent && assetN !== "30",
        approved_at: isCurrent && assetN !== "30" ? daysAgo(5) : null,
        metadata: {},
      });
      n += 1;
    });
  }
  return rows;
}

function relationshipRows() {
  return [
    [1, 30, 4, "derived", "Exported hero"],
    [2, 4, 6, "variant", "Social crop"],
    [3, 4, 8, "variant", "Story crop"],
    [4, 18, 19, "child", "15s cutdown"],
    [5, 11, 34, "product", "3D model"],
    [6, 32, 13, "source", "RAW source"],
    [7, 4, 20, "campaign", "Spring 2026"],
  ].map(([n, from, to, relation, label]) => ({
    id: sid("relation", n),
    asset_id: sid("asset", from),
    related_asset_id: sid("asset", to),
    relation_type: relation,
    label,
    created_by: personId(1),
    created_at: daysAgo(10 + n),
    metadata: {},
  }));
}

function duplicateRows() {
  const groups = [
    [1, "exact", 100, "open", "Keep the dark logo; the light variant is a byte-identical copy.", [1, 2]],
    [2, "near", 94, "open", "Merge tags into square 01 and trash square 02.", [6, 7]],
    [3, "visual", 88, "open", "Different crops of the same shot — keep both, link as variants.", [11, 12]],
    [4, "near", 91, "resolved", "Kept both: the cutdown is a derived edit.", [18, 19]],
  ];
  const members = [];
  let mn = 1;
  const rows = groups.map(([n, match, similarity, status, action, assetNs]) => {
    assetNs.forEach((an, i) => {
      members.push({
        id: sid("duplicate_member", mn++),
        group_id: sid("duplicate", n),
        asset_id: sid("asset", an),
        is_keeper: i === 0,
        created_at: daysAgo(4),
      });
    });
    return {
      ...base("duplicate", n, { created: 5 + n, updated: n }),
      match_type: match,
      similarity,
      status,
      recommended_action: action,
    };
  });
  return { rows, members };
}

function requestRows() {
  return [
    [1, "Spring hero — wide crop for billboards", "48-sheet and 96-sheet crops of the meadow hero.", "Maya Chen", "Jonas Weber", "high", "in_progress", 4, 4],
    [2, "Nova chair lifestyle photography", "Two lifestyle scenes: living room and studio.", "Ravi Patel", "Lena Ortiz", "medium", "open", 14, 13],
    [3, "Localized brand film subtitles (DE, FR, JP)", "Subtitle files for the 60s brand film.", "Sofia Rossi", "Jonas Weber", "urgent", "submitted", 2, 18],
    [4, "Holiday lookbook print files", "Print-ready PDFs with bleed.", "Maya Chen", "Ava Johnson", "low", "approved", -20, 37],
    [5, "Retail partner logo pack", "Logo pack for the retail partner portal.", "Ravi Patel", "Ava Johnson", "medium", "closed", -8, 1],
    [6, "Podcast episode 13 cover art", "Square cover art matching the series.", "Sofia Rossi", null, "low", "open", 21, null],
  ].map(([n, title, description, requester, assignee, priority, status, due, ref]) => ({
    ...base("request", n, { created: 12 - n, updated: Math.max(0, 6 - n) }),
    title,
    description,
    requester,
    assignee,
    priority,
    status,
    due_date: dateOnly(due >= 0 ? daysFromNow(due) : daysAgo(-due)),
    reference_asset_id: ref ? sid("asset", ref) : null,
    created_by: personId(1 + (n % 5)),
  }));
}

function uploadRows() {
  return [
    [1, "Spring social square 02.jpg", "image", 2.3, "completed", 100, "drag-drop", 7, 0],
    [2, "Brand film — 15s cutdown.mp4", "video", 98, "completed", 100, "drag-drop", 19, 1],
    [3, "Nova chair detail.jpg", "image", 3.9, "processing", 92, "folder", 14, 0],
    [4, "Studio shoot RAW 0413.cr3", "raw", 57.4, "uploading", 46, "folder", null, 0],
    [5, "Studio shoot RAW 0414.cr3", "raw", 59.8, "queued", 0, "folder", null, 0],
    [6, "Retail assets.zip", "archive", 212, "failed", 63, "zip", null, 2],
    [7, "Spring story 9x16.jpg", "image", 3.4, "completed", 100, "cloud", 8, 3],
    [8, "Ambient bed — spring.mp3", "audio", 9.3, "completed", 100, "url", 24, 5],
  ].map(([n, filename, type, sizeMb, status, progress, source, assetN, days]) => ({
    ...base("upload", n, { created: days, updated: days }),
    filename,
    file_type: type,
    size_bytes: Math.round(sizeMb * MB),
    status,
    progress,
    source,
    error: status === "failed" ? "Archive contains an unsupported file type (.exe)" : null,
    asset_id: assetN ? sid("asset", assetN) : null,
    created_by: personId(1 + (n % 4)),
  }));
}

function portalRows() {
  const portals = [
    [1, "Photographer drop — spring shoot", "link", "spring-shoot-drop", "active", true, "/Campaigns/Spring 2026", 14],
    [2, "Agency deliverables", "form", "agency-deliverables", "active", true, "/Campaigns", 45],
    [3, "Retail partner submissions", "form", "retail-partners", "paused", false, "/Product", null],
    [4, "Holiday UGC collection", "link", "holiday-ugc", "expired", false, "/Campaigns/Holiday 2025", -30],
  ].map(([n, name, type, slug, status, requireMeta, folder, expires]) => ({
    ...base("portal", n, { created: 40 - n * 5, updated: n }),
    name,
    type,
    slug,
    status,
    require_metadata: requireMeta,
    destination_folder: folder,
    expires_at: expires == null ? null : expires > 0 ? daysFromNow(expires) : daysAgo(-expires),
    created_by: personId(1),
  }));
  const submissions = [
    [1, 1, "Lena Ortiz", "lena@ortiz.studio", 24, "approved", "Final selects from day one."],
    [2, 1, "Lena Ortiz", "lena@ortiz.studio", 18, "pending", "Day two selects, colour graded."],
    [3, 2, "Brightline Agency", "studio@brightline.agency", 6, "approved", "Social cutdowns v2."],
    [4, 2, "Brightline Agency", "studio@brightline.agency", 3, "rejected", "Wrong aspect ratio — resubmitting."],
    [5, 2, "Pixel & Grain", "hello@pixelgrain.co", 9, "pending", "OOH mockups."],
    [6, 3, "Northwind Outdoor", "erin@northwind-outdoor.example", 4, "pending", "Store window photos."],
    [7, 4, "Customer UGC", "ugc@halcyon.studio", 57, "approved", "Holiday posts, cleared for reuse."],
  ].map(([n, portal, name, email, count, status, note]) => ({
    id: sid("submission", n),
    portal_id: sid("portal", portal),
    submitter_name: name,
    submitter_email: email,
    file_count: count,
    status,
    note,
    created_at: daysAgo(n * 2),
    metadata: {},
  }));
  return { portals, submissions };
}

export function librarySeed() {
  const assets = [...assetRows(), ...trashedAssets()];
  const { collections, joins } = collectionRows();
  const duplicates = duplicateRows();
  const portals = portalRows();
  return {
    assets,
    folders: folderRows(assets),
    collections,
    collection_assets: joins,
    asset_versions: versionRows(),
    asset_relationships: relationshipRows(),
    duplicate_groups: duplicates.rows,
    duplicate_members: duplicates.members,
    asset_requests: requestRows(),
    upload_jobs: uploadRows(),
    upload_portals: portals.portals,
    upload_submissions: portals.submissions,
  };
}
