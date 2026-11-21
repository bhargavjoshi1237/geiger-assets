if (typeof window !== "undefined") {
  throw new Error("lib/storage/object_head is server-only.");
}

import { Readable } from "node:stream";

// The first `bytes` of a stored object, read back through the backend that
// holds it. A backend that ignores Range answers 200 with the whole body, so
// the read stops at the window and cancels the rest. Null when nothing could
// be read — the caller then has no evidence either way.
export async function readObjectHead(backend, ref, bytes) {
  try {
    const got = await backend.getStream(ref, { range: `bytes=0-${bytes - 1}` });
    if (!got?.stream) return null;
    const body = typeof got.stream.getReader === "function" ? got.stream : Readable.toWeb(got.stream);
    const reader = body.getReader();
    const chunks = [];
    let seen = 0;
    try {
      while (seen < bytes) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
        seen += value.length;
      }
    } finally {
      reader.cancel().catch(() => {});
    }
    const head = Buffer.concat(chunks);
    return head.length ? head.subarray(0, bytes) : null;
  } catch (e) {
    console.error("[storage.readObjectHead]", e?.message || e);
    return null;
  }
}
