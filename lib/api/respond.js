import { NextResponse } from "next/server";
import { apiError } from "./auth.js";

// Shared v1 response helpers: camelCase JSON, cursor pagination, and the
// { error: { code, message } } error shape.

export { apiError };

export function ok(data, init) {
  return NextResponse.json(data, init);
}

function encodeCursor(offset) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

export function decodeCursor(cursor) {
  if (!cursor) return 0;
  try {
    const n = Number(Buffer.from(String(cursor), "base64url").toString("utf8"));
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

// Slice-based cursor pagination over an in-memory ordered array.
export function paginate(rows, { limit = 50, cursor } = {}) {
  const perPage = Math.max(1, Math.min(100, Number(limit) || 50));
  const offset = decodeCursor(cursor);
  const slice = (rows || []).slice(offset, offset + perPage);
  const next = offset + perPage < (rows || []).length ? encodeCursor(offset + perPage) : null;
  return { data: slice, pagination: { nextCursor: next, limit: perPage } };
}

export function normalizeAssetRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    type: row.type ?? "image",
    format: row.format ?? "",
    sizeBytes: Number(row.size_bytes ?? 0),
    dimensions: row.dimensions ?? "",
    folder: row.folder ?? "root",
    status: row.status ?? "draft",
    tags: Array.isArray(row.tags) ? row.tags : [],
    description: row.description ?? "",
    downloads: Number(row.downloads ?? 0),
    deliveryEnabled: Boolean(row.delivery_enabled),
    storageStatus: row.storage_status ?? "none",
    mimeType: row.mime_type ?? "",
    originalFilename: row.original_filename ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}
