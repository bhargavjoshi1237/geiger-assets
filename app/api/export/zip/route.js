import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { isStorageConfigured } from "@/lib/storage/service";
import { backendForRef, refFromAssetRow } from "@/lib/storage/backends/index.js";
import { listScopedAssets } from "@/lib/export/scope";
import { streamStoreZip } from "@/lib/export/store_zip";
import {
  EXPORT_ZIP_MAX_BYTES,
  EXPORT_ZIP_MAX_FILES,
} from "@/components/internal/screens/projects/platform/constants";

export const runtime = "nodejs";

function sanitizeSegment(segment) {
  return (
    String(segment || "")
      .replace(/[\\/]+/g, "-")
      .replace(/^\.+/, "")
      .replace(/[<>:"|?*\x00-\x1f]/g, "")
      .trim() || "file"
  );
}

function zipPathFor(row, preserve) {
  const filename = sanitizeSegment(row.original_filename || row.name || "file").slice(0, 180);
  if (!preserve) return filename;
  const folder = String(row.folder || "root")
    .split("/")
    .map(sanitizeSegment)
    .filter((s) => s && s !== "root")
    .join("/");
  return folder ? `${folder}/${filename}` : filename;
}

function dedupePaths(paths) {
  const seen = new Map();
  return paths.map((path) => {
    const lower = path.toLowerCase();
    const count = seen.get(lower) || 0;
    seen.set(lower, count + 1);
    if (count === 0) return path;
    const dot = path.lastIndexOf(".");
    return dot > 0 ? `${path.slice(0, dot)} (${count + 1})${path.slice(dot)}` : `${path} (${count + 1})`;
  });
}

async function* bodyChunks(body) {
  if (!body) return;
  if (typeof body?.getReader === "function") {
    const reader = body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
    return;
  }
  if (typeof body?.[Symbol.asyncIterator] === "function") {
    for await (const chunk of body) yield chunk;
    return;
  }
  if (body instanceof Uint8Array) yield body;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || "";
  const scope = searchParams.get("scope") || "project";
  const scopeId = searchParams.get("scopeId") || "";
  const search = searchParams.get("search") || "";
  const preserve = searchParams.get("preserve") !== "0";

  const access = await requireProjectAccess({ projectId, action: "read" });
  if (access.response) return access.response;

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }

  const { rows, error } = await listScopedAssets(access.supabase, {
    projectId,
    scope,
    scopeId,
    search,
  });
  if (error) {
    const status = error === "unknown_scope" ? 404 : 500;
    return NextResponse.json({ error }, { status });
  }

  const candidates = rows.filter((r) => r.storage_key);
  if (!candidates.length) {
    return NextResponse.json({ error: "nothing_stored" }, { status: 404 });
  }

  // Preflight: authoritative sizes from storage (skips vanished objects), then
  // the hard caps — enforced here, before a single byte streams. Each head
  // follows its row's backend, so pooled and S3 objects mix freely.
  const heads = await Promise.all(
    candidates.map(async (row) => {
      const ref = refFromAssetRow(row) || { backend: "s3", key: row.storage_key };
      return { row, ref, head: await backendForRef(ref).head(ref) };
    }),
  );
  const files = heads
    .filter(({ head }) => head && head.size > 0)
    .map(({ row, ref, head }) => ({ row, ref, size: head.size }));
  if (!files.length) {
    return NextResponse.json({ error: "nothing_stored" }, { status: 404 });
  }

  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  if (files.length > EXPORT_ZIP_MAX_FILES || totalBytes > EXPORT_ZIP_MAX_BYTES) {
    return NextResponse.json(
      {
        error: "zip_too_large",
        fileCount: files.length,
        totalBytes,
        maxFiles: EXPORT_ZIP_MAX_FILES,
        maxBytes: EXPORT_ZIP_MAX_BYTES,
      },
      { status: 413 },
    );
  }

  const names = dedupePaths(files.map(({ row }) => zipPathFor(row, preserve)));
  const entries = files.map(({ row, ref, size }, i) => ({
    key: row.storage_key,
    ref,
    name: names[i],
    mtime: row.updated_at || row.created_at,
    size,
  }));

  async function* readFile(entry) {
    const got = await backendForRef(entry.ref).getStream(entry.ref);
    if (!got?.stream) throw new Error(`missing object: ${entry.key}`);
    let emitted = 0;
    for await (const chunk of bodyChunks(got.stream)) {
      const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
      emitted += bytes.length;
      yield bytes;
    }
    if (emitted !== entry.size) {
      console.error(`[export.zip] size drift for ${entry.key}: head ${entry.size}, streamed ${emitted}`);
    }
  }

  let streamedBytes = 0;
  const zipIterable = streamStoreZip(entries, async function* (entry) {
    for await (const chunk of readFile(entry)) {
      streamedBytes += chunk.length;
      if (streamedBytes > EXPORT_ZIP_MAX_BYTES + 1024 * 1024) {
        throw new Error("zip cap exceeded mid-stream");
      }
      yield chunk;
    }
  });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of zipIterable) controller.enqueue(chunk);
        controller.close();
      } catch (e) {
        console.error("[export.zip]", e);
        controller.error(e);
      }
    },
  });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="geiger-originals-${date}.zip"`,
      "X-Export-File-Count": String(entries.length),
      "X-Export-Total-Bytes": String(totalBytes),
    },
  });
}
