import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { listRelatedByAssetIds, listScopedAssets } from "@/lib/export/scope";

export const runtime = "nodejs";

const KNOWN_FIELDS = [
  "name",
  "type",
  "format",
  "status",
  "folder",
  "sizeBytes",
  "mimeType",
  "tags",
  "description",
  "createdAt",
  "updatedAt",
  "storageKey",
];

const FIELD_LABELS = {
  name: "Name",
  type: "Type",
  format: "Format",
  status: "Status",
  folder: "Folder",
  sizeBytes: "Size (bytes)",
  mimeType: "MIME type",
  tags: "Tags",
  description: "Description",
  createdAt: "Created",
  updatedAt: "Updated",
  storageKey: "Storage key",
};

function assetView(row) {
  return {
    id: row.id,
    name: row.name ?? "",
    type: row.type ?? "",
    format: row.format ?? "",
    status: row.status ?? "",
    folder: row.folder ?? "",
    sizeBytes: Number(row.size_bytes ?? 0),
    mimeType: row.mime_type ?? "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    description: row.description ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    storageKey: row.storage_key ?? "",
  };
}

function escapeCell(value) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(records, fields) {
  const header = fields.map((f) => escapeCell(FIELD_LABELS[f] || f)).join(",");
  const lines = records.map((r) =>
    fields
      .map((f) => {
        if (f === "versionCount") return String(r.versionCount);
        if (f === "commentCount") return String(r.commentCount);
        if (f === "rightsSummary") return escapeCell(r.rightsSummary);
        return escapeCell(r.asset[f]);
      })
      .join(","),
  );
  return [header, ...lines].join("\r\n");
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || "";
  const scope = searchParams.get("scope") || "project";
  const scopeId = searchParams.get("scopeId") || "";
  const search = searchParams.get("search") || "";
  const format = searchParams.get("format") === "json" ? "json" : "csv";

  const access = await requireProjectAccess({ projectId, action: "read" });
  if (access.response) return access.response;

  const { rows, truncated, error } = await listScopedAssets(access.supabase, {
    projectId,
    scope,
    scopeId,
    search,
  });
  if (error) {
    const status = error === "unknown_scope" ? 404 : 500;
    return NextResponse.json({ error }, { status });
  }

  const requested = (searchParams.get("fields") || "")
    .split(",")
    .map((f) => f.trim())
    .filter((f) => KNOWN_FIELDS.includes(f));
  const fields = requested.length ? requested : [...KNOWN_FIELDS];

  const wantVersions = searchParams.get("versions") === "1";
  const wantComments = searchParams.get("comments") === "1";
  const wantRights = searchParams.get("rights") === "1";
  const ids = rows.map((r) => r.id);

  let versionsByAsset = new Map();
  if (wantVersions && ids.length) {
    const versions = await listRelatedByAssetIds(
      access.supabase,
      "asset_versions",
      ids,
      "asset_id, version_number, label, is_current, size_bytes, mime_type, created_at",
    );
    versionsByAsset = new Map();
    for (const v of versions || []) {
      if (!versionsByAsset.has(v.asset_id)) versionsByAsset.set(v.asset_id, []);
      versionsByAsset.get(v.asset_id).push({
        versionNumber: v.version_number,
        label: v.label ?? "",
        isCurrent: Boolean(v.is_current),
        sizeBytes: Number(v.size_bytes ?? 0),
        mimeType: v.mime_type ?? "",
        createdAt: v.created_at ?? "",
      });
    }
  }

  let commentsByAsset = new Map();
  if (wantComments && ids.length) {
    const comments = await listRelatedByAssetIds(
      access.supabase,
      "comments",
      ids,
      "asset_id, body, author_name, status, created_at",
      { extraFilter: (q) => q.is("deleted_at", null).order("created_at", { ascending: true }) },
    );
    commentsByAsset = new Map();
    for (const c of comments || []) {
      if (!commentsByAsset.has(c.asset_id)) commentsByAsset.set(c.asset_id, []);
      commentsByAsset.get(c.asset_id).push({
        body: c.body ?? "",
        authorName: c.author_name ?? "",
        status: c.status ?? "",
        createdAt: c.created_at ?? "",
      });
    }
  }

  let rightsByAsset = new Map();
  if (wantRights && ids.length) {
    const rights = await listRelatedByAssetIds(
      access.supabase,
      "rights_records",
      ids,
      "asset_id, title, rights_holder_id, acquisition_type, ownership_share, territories, window_start, window_end, status",
      { extraFilter: (q) => q.is("deleted_at", null) },
    );
    // Join holder names without a second round of per-row queries: one lookup
    // across the project's holders covers every record on this export.
    let holderNames = new Map();
    try {
      const { data } = await access.supabase
        .schema("assets")
        .from("rights_holders")
        .select("id, name")
        .eq("project_id", projectId);
      holderNames = new Map((data || []).map((h) => [h.id, h.name ?? ""]));
    } catch {
      // Holder names are a nicety — the export still works without them.
    }
    rightsByAsset = new Map();
    for (const r of rights || []) {
      if (!rightsByAsset.has(r.asset_id)) rightsByAsset.set(r.asset_id, []);
      rightsByAsset.get(r.asset_id).push({
        title: r.title ?? "",
        holderName: holderNames.get(r.rights_holder_id) || "",
        acquisitionType: r.acquisition_type ?? "",
        ownershipShare: Number(r.ownership_share ?? 0),
        territories: Array.isArray(r.territories) ? r.territories : [],
        windowStart: r.window_start ?? "",
        windowEnd: r.window_end ?? "",
        status: r.status ?? "",
      });
    }
  }

  const records = rows.map((row) => {
    const asset = assetView(row);
    const versions = versionsByAsset.get(row.id) || [];
    const comments = commentsByAsset.get(row.id) || [];
    const rights = rightsByAsset.get(row.id) || [];
    return {
      asset,
      versionCount: versions.length,
      commentCount: comments.length,
      rightsSummary:
        rights.length === 0
          ? ""
          : `${rights.length} record${rights.length === 1 ? "" : "s"} (${[...new Set(rights.map((r) => r.status))].join(", ")})`,
      versions: wantVersions ? versions : undefined,
      comments: wantComments ? comments : undefined,
      rights: wantRights ? rights : undefined,
    };
  });

  let body;
  let contentType;
  let ext;
  if (format === "json") {
    const picked = records.map((r) => {
      const asset = {};
      for (const f of fields) asset[f] = r.asset[f];
      if (wantVersions) asset.versions = r.versions;
      if (wantComments) asset.comments = r.comments;
      if (wantRights) asset.rights = r.rights;
      return asset;
    });
    body = JSON.stringify({ exportedAt: new Date().toISOString(), count: picked.length, assets: picked }, null, 2);
    contentType = "application/json; charset=utf-8";
    ext = "json";
  } else {
    const columns = [...fields];
    if (wantVersions) columns.push("versionCount");
    if (wantComments) columns.push("commentCount");
    if (wantRights) columns.push("rightsSummary");
    body = toCsv(records, columns);
    contentType = "text/csv; charset=utf-8";
    ext = "csv";
  }

  const bytes = Buffer.byteLength(body, "utf8");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="geiger-export-${date}.${ext}"`,
      "X-Export-File-Count": String(records.length),
      "X-Export-Total-Bytes": String(bytes),
      ...(truncated ? { "X-Export-Truncated": "1" } : {}),
    },
  });
}
