// Everything the playground swaps into the data layer while it is mounted (see
// ./mode.js and ./use_playground_mode.js): the in-memory Supabase client, plus
// stand-ins for the storage calls that would otherwise hit /api/storage/* on
// the server. Uploads run a short simulated transfer and land in the in-memory
// library with a local object-URL preview, so the whole upload flow works
// without a byte leaving the browser.

import { normalizeAsset } from "@/lib/supabase/assets";
import { emitWorkflowEvent } from "@/lib/workflows/emit";
import { createMemoryClient } from "./memory_client";
import { getPlaygroundDb, PLAYGROUND_USER } from "./db";
import { playgroundRpc } from "./rpc";

// Embedded many-to-one lookups that are named by their FK column
// (`asset:asset_id(...)`) rather than by the target table.
const FK_TABLES = {
  asset_id: "assets",
  related_asset_id: "assets",
  reference_asset_id: "assets",
  cover_asset_id: "assets",
  poster_asset_id: "assets",
};

// Child tables whose FK back to the parent isn't `<singular parent>_id`.
const CHILD_FKS = {
  "approval_reviews.approval_review_items": "review_id",
  "duplicate_groups.duplicate_members": "group_id",
  "upload_portals.upload_submissions": "portal_id",
};

// Every assets table carries soft delete and the metadata bag.
const withAssetsColumns = (table, row) => ({ deleted_at: null, metadata: {}, ...row });

// Legal holds, as the database enforces them: an asset under an active hold
// can't be trashed or deleted, a released hold is frozen, assets can only join
// an active hold in the same project, and every change lands in the hold's
// audit trail (legal_hold_events).

const blocked = (message) => ({ error: { message, status: 409 } });

function isHeld(db, assetId) {
  return db.table("legal_hold_assets").some((link) =>
    link.asset_id === assetId && db.table("legal_holds").some((hold) =>
      hold.id === link.hold_id && hold.status === "active"));
}

function canJoinHold(db, link) {
  const hold = db.table("legal_holds").find((item) => item.id === link.hold_id);
  const asset = db.table("assets").find((item) => item.id === link.asset_id);
  return Boolean(
    hold && hold.status === "active" && asset && !asset.deleted_at && asset.project_id === hold.project_id &&
    !db.table("legal_hold_assets").some((item) => item.hold_id === link.hold_id && item.asset_id === link.asset_id),
  );
}

function recordHoldEvent(db, row, eventType, assetId = null) {
  const now = new Date().toISOString();
  db.table("legal_hold_events").unshift(withAssetsColumns("legal_hold_events", {
    id: globalThis.crypto.randomUUID(),
    created_at: now,
    updated_at: now,
    project_id: row.project_id,
    hold_id: row.hold_id ?? row.id,
    asset_id: assetId,
    event_type: eventType,
    actor_id: PLAYGROUND_USER.id,
  }));
}

const legalHoldRules = {
  beforeWrite({ op, table, input, rows, patch, db }) {
    if (table === "legal_hold_assets" && (op === "insert" || op === "upsert")) {
      if (!input.every((link) => canJoinHold(db, link))) return blocked("Asset cannot be added to this hold");
    }
    const trashing = op === "delete" || (op === "update" && patch?.deleted_at);
    if (table === "assets" && trashing && rows.some((row) => isHeld(db, row.id))) {
      return blocked("Asset is under an active legal hold");
    }
    if (table === "legal_holds" && op === "update" && rows.some((row) => row.status === "released")) {
      return blocked("Released legal holds cannot be changed");
    }
    return null;
  },
  afterWrite({ op, table, rows, patch, db }) {
    if (table === "legal_holds" && op !== "delete") {
      const eventType = op === "update" ? (patch?.status === "released" ? "released" : "updated") : "created";
      for (const row of rows) recordHoldEvent(db, row, eventType);
    }
    if (table === "legal_hold_assets") {
      const eventType = op === "delete" ? "asset_removed" : "asset_added";
      for (const row of rows) recordHoldEvent(db, row, eventType, row.asset_id);
    }
  },
};

// One client for the whole session, so every createClient() call shares state.
let client = null;

function createPlaygroundClient() {
  client ??= createMemoryClient({
    getDb: getPlaygroundDb,
    user: PLAYGROUND_USER,
    fkTables: FK_TABLES,
    childFks: CHILD_FKS,
    rpc: playgroundRpc,
    hooks: legalHoldRules,
    defaults: withAssetsColumns,
  });
  return client;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const EXTENSION_TYPES = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "heic"],
  video: ["mp4", "mov", "webm", "mkv", "m4v"],
  audio: ["mp3", "wav", "aac", "flac", "ogg", "m4a"],
  pdf: ["pdf"],
  document: ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "md"],
  "3d": ["glb", "gltf", "obj", "fbx", "usdz", "stl", "blend"],
  raw: ["psd", "ai", "fig", "sketch", "cr2", "cr3", "nef", "arw", "dng", "otf", "ttf"],
  archive: ["zip", "rar", "7z", "tar", "gz"],
};

function typeFor(filename, mime) {
  const ext = String(filename).split(".").pop().toLowerCase();
  for (const [type, exts] of Object.entries(EXTENSION_TYPES)) {
    if (exts.includes(ext)) return type;
  }
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("audio/")) return "audio";
  return "document";
}

function insertAsset({ name, type, format, sizeBytes, folder, status, tags, previewUrl, mimeType, assetId }) {
  const assets = getPlaygroundDb().table("assets");
  const now = new Date().toISOString();
  const existing = assetId ? assets.find((a) => a.id === assetId) : null;
  if (existing) {
    Object.assign(existing, {
      size_bytes: sizeBytes,
      thumbnail_url: previewUrl || existing.thumbnail_url,
      updated_at: now,
    });
    return normalizeAsset(existing);
  }
  const row = {
    id: crypto.randomUUID(),
    project_id: getPlaygroundDb().table("projects")[0]?.id ?? null,
    name,
    type,
    format,
    size_bytes: sizeBytes,
    dimensions: null,
    folder: folder || "root",
    status: status || "draft",
    tags: Array.isArray(tags) ? tags : [],
    description: "",
    downloads: 0,
    color: "#737373",
    thumbnail_url: previewUrl || "",
    mini_thumbnail_url: "",
    storage_key: null,
    mime_type: mimeType || "",
    original_filename: name,
    cdn_enabled: false,
    delivery_enabled: false,
    created_by: PLAYGROUND_USER.id,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    metadata: {},
  };
  assets.unshift(row);
  emitWorkflowEvent({ type: "asset.uploaded", projectId: row.project_id, assetId: row.id });
  return normalizeAsset(row);
}

async function uploadAsset(file, { assetId, name, type, status, folder, tags, onProgress, onPhase, onError, signal } = {}) {
  const phase = (p) => {
    try {
      onPhase?.(p);
    } catch {
    }
  };
  const cancelled = () => {
    try {
      onError?.("cancelled");
    } catch {
    }
    return null;
  };
  if (!(file instanceof Blob)) {
    try {
      onError?.("bad_input");
    } catch {
    }
    return null;
  }

  phase("hashing");
  onProgress?.(4);
  await wait(250);
  phase("uploading");
  for (let p = 12; p <= 92; p += 16) {
    if (signal?.aborted) return cancelled();
    onProgress?.(p);
    await wait(180);
  }
  phase("committing");
  onProgress?.(100);
  await wait(200);
  phase("done");

  const filename = name || file.name || "file";
  const kind = type || typeFor(filename, file.type);
  return insertAsset({
    assetId,
    name: filename,
    type: kind,
    format: String(filename).split(".").pop().toLowerCase(),
    sizeBytes: file.size,
    folder,
    status,
    tags,
    mimeType: file.type,
    previewUrl: file.type?.startsWith("image/") ? URL.createObjectURL(file) : "",
  });
}

async function importAssetFromUrl(url, { name, status, folder, tags } = {}) {
  await wait(600);
  const filename = name || String(url).split("/").pop().split("?")[0] || "imported-file";
  const kind = typeFor(filename, "");
  return insertAsset({
    name: filename,
    type: kind,
    format: String(filename).split(".").pop().toLowerCase(),
    sizeBytes: 2 * 1024 * 1024,
    folder,
    status,
    tags,
    previewUrl: kind === "image" ? url : "",
  });
}

async function purgeAsset(id) {
  const { data, error } = await createPlaygroundClient()
    .from("assets").delete().eq("id", id).select("id").maybeSingle();
  return !error && Boolean(data);
}

export const playgroundHandlers = {
  createClient: createPlaygroundClient,
  uploadAsset,
  importAssetFromUrl,
  deleteAssetFile: async () => true,
  purgeAsset,
  signAssetUrls: async () => ({}),
};

// Routes for interceptFetch (see ./intercept_fetch.js). The assets screens
// reach the server only through the stand-ins above, so there are none.
export const playgroundRoutes = null;
