"use client";

import { useCallback, useRef, useState } from "react";
import { uploadAsset } from "@/lib/storage/client";

const MAX_CONCURRENT = 3;

function entry(id, filename) {
  return { id, filename, progress: 0, status: "queued", error: "" };
}

export function useAssetUpload({ projectId } = {}) {
  const [uploads, setUploads] = useState([]);
  const queueRef = useRef([]);
  const activeRef = useRef(0);
  const controllersRef = useRef(new Map());

  const patch = useCallback((id, p) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...p } : u)));
  }, []);

  const pump = useCallback(() => {
    while (activeRef.current < MAX_CONCURRENT && queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      if (!next) break;
      activeRef.current += 1;
      void next();
    }
  }, []);

  const startFile = useCallback((file, opts = {}) => {
    const id = crypto.randomUUID();
    const filename = file?.name || "file";
    const controller = new AbortController();
    controllersRef.current.set(id, controller);

    setUploads((prev) => [...prev, { ...entry(id, filename), status: "queued" }]);

    const run = async () => {
      patch(id, { status: "uploading", progress: 1 });
      const asset = await uploadAsset(file, {
        projectId: opts.projectId || projectId,
        assetId: opts.assetId,
        folder: opts.folder,
        tags: opts.tags,
        signal: controller.signal,
        onProgress: (progress) => patch(id, { progress }),
      });
      controllersRef.current.delete(id);
      activeRef.current -= 1;
      if (asset) {
        patch(id, { status: "complete", progress: 100, assetId: asset.id });
      } else {
        patch(id, {
          status: controller.signal.aborted ? "cancelled" : "failed",
          error: controller.signal.aborted ? "Upload cancelled" : "Upload failed",
        });
      }
      pump();
      return asset;
    };

    queueRef.current.push(run);
    pump();
    return id;
  }, [patch, projectId, pump]);

  const upload = useCallback((files, opts = {}) => {
    const list = Array.isArray(files) ? files : [files];
    return list.filter(Boolean).map((f) => startFile(f, opts));
  }, [startFile]);

  const cancel = useCallback((id) => {
    const controller = controllersRef.current.get(id);
    if (controller) controller.abort();
    queueRef.current = queueRef.current.filter(Boolean);
    patch(id, { status: "cancelled", error: "Upload cancelled" });
  }, [patch]);

  const retry = useCallback((id, file, opts = {}) => {
    if (!file) return null;
    setUploads((prev) => prev.filter((u) => u.id !== id));
    return startFile(file, opts);
  }, [startFile]);

  const clear = useCallback((id) => {
    if (id) setUploads((prev) => prev.filter((u) => u.id !== id));
    else setUploads([]);
  }, []);

  return { upload, uploads, cancel, retry, clear };
}
