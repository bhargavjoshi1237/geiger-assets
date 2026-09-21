// Browser-side pool ticket executor — ported from
// geiger-dash/lib/filestore/client-upload.js (dependency-free).
//
// The server hands back a ticket describing exactly how to transfer bytes;
// this follows it. It never sees a credential, because every ticket is either
// pre-signed, carries only fields safe to expose, or points at the pool's own
// proxy route. A 90-line copy is the right call while both trees are moving;
// do not create a shared npm package for this right now.

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getPath(source, path) {
  if (!source || !path) return undefined;
  return path
    .split(".")
    .reduce((acc, part) => (acc == null ? undefined : acc[part]), source);
}

// Returns what /api/storage/commit needs: the provider key, its raw response,
// and (for multipart) each part's ETag.
export async function runUploadTicket({ ticket, mode, file, onProgress }) {
  if (mode === "form-post") {
    const form = new FormData();
    for (const [key, value] of Object.entries(ticket.fields || {})) {
      form.append(key, value);
    }
    form.append(ticket.fileField || "file", file, file.name);

    const response = await fetch(ticket.url, {
      method: ticket.method || "POST",
      headers: ticket.headers || {},
      body: form,
    });
    const payload = await readJson(response);

    if (!response.ok) {
      throw new Error(payload?.error || `Upload failed (${response.status}).`);
    }

    onProgress?.(1);
    return {
      providerKey: getPath(payload, ticket.keyPath || "file"),
      response: payload,
      parts: [],
    };
  }

  if (mode === "presigned-put" || mode === "proxy") {
    const response = await fetch(ticket.url, {
      method: ticket.method || "PUT",
      headers: ticket.headers || {},
      body: file,
    });

    if (!response.ok) {
      const payload = await readJson(response);
      throw new Error(payload?.error || `Upload failed (${response.status}).`);
    }

    onProgress?.(1);
    const payload = mode === "proxy" ? await readJson(response) : null;
    return {
      providerKey: payload?.providerKey || null,
      response: payload,
      parts: [],
    };
  }

  if (mode === "multipart") {
    const partSize = ticket.partSize || 5 * 1024 * 1024;
    const parts = [];

    // Sequential rather than parallel: a pool provider is usually rate-limited,
    // and a failed part is far easier to reason about in order.
    for (const part of ticket.parts || []) {
      const start = (part.partNumber - 1) * partSize;
      const chunk = file.slice(start, Math.min(start + partSize, file.size));

      const response = await fetch(part.url, {
        method: part.method || "PUT",
        headers: part.headers || { "Content-Type": ticket.contentType },
        body: chunk,
      });

      if (!response.ok) {
        throw new Error(`Part ${part.partNumber} failed (${response.status}).`);
      }

      parts.push({
        partNumber: part.partNumber,
        etag: response.headers.get("etag") || undefined,
      });
      onProgress?.(parts.length / (ticket.parts?.length || 1));
    }

    return { providerKey: null, response: null, parts };
  }

  throw new Error(`Unsupported upload mode: ${mode}`);
}
