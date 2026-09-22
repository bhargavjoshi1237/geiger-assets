"use client";

// Video delivery — owns assets.video_delivery.
//
// Per-video delivery state (streaming mode, ABR ladder, poster, captions,
// signing, player config). This row describes how a video streams; it never
// duplicates transcoding — masters and renditions live in the Media area.
//
// DB is snake_case, the UI is camelCase; the mapping happens here. Reads return
// null (no DB / failure) or [] (configured, empty); writes return the normalized
// row, or null/false on failure. Nothing here throws or toasts.

import {
  createRow,
  getRow,
  listRows,
  meta,
  softDeleteRow,
  toRowGeneric,
  updateRow,
} from "./row_helpers";
import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

const TABLE = "video_delivery";

const VIDEO_MAP = {
  projectId: "project_id",
  assetId: "asset_id",
  streamingMode: "streaming_mode",
  ladder: "ladder",
  posterAssetId: "poster_asset_id",
  captions: "captions",
  signed: "signed",
  player: "player",
  status: "status",
  createdBy: "created_by",
};

export function normalizeVideoDelivery(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    assetId: row.asset_id ?? null,
    streamingMode: row.streaming_mode ?? "progressive",
    ladder: Array.isArray(row.ladder) ? row.ladder : [],
    posterAssetId: row.poster_asset_id ?? null,
    captions: Array.isArray(row.captions) ? row.captions : [],
    signed: Boolean(row.signed),
    player: row.player && typeof row.player === "object" ? row.player : {},
    status: row.status ?? "draft",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    ...meta(row),
  };
}

function videoRow(input) {
  const row = toRowGeneric(input, VIDEO_MAP);
  if ("assetId" in input) row.asset_id = input.assetId || null;
  if ("posterAssetId" in input) row.poster_asset_id = input.posterAssetId || null;
  if ("ladder" in input) row.ladder = Array.isArray(input.ladder) ? input.ladder : [];
  if ("captions" in input) row.captions = Array.isArray(input.captions) ? input.captions : [];
  if ("player" in input) row.player = input.player || {};
  if ("signed" in input) row.signed = Boolean(input.signed);
  return row;
}

export const listVideoDelivery = (projectId) =>
  listRows(TABLE, projectId).then((r) => (r ? r.map(normalizeVideoDelivery) : r));

export const getVideoDelivery = (id) => getRow(TABLE, id).then(normalizeVideoDelivery);

/** The delivery row for one video asset, if it has been configured. */
export async function getVideoDeliveryByAsset(assetId) {
  if (!assetId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient()
      .from(TABLE)
      .select("*")
      .eq("asset_id", assetId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[video_delivery.getByAsset]", error.message);
      return null;
    }
    return normalizeVideoDelivery(data);
  } catch (e) {
    console.error("[video_delivery.getByAsset]", e);
    return null;
  }
}

export const createVideoDelivery = (input) =>
  createRow(TABLE, videoRow(input)).then(normalizeVideoDelivery);

export const updateVideoDelivery = (id, patch) =>
  updateRow(TABLE, id, videoRow(patch)).then(normalizeVideoDelivery);

export const softDeleteVideoDelivery = (id) => softDeleteRow(TABLE, id);
