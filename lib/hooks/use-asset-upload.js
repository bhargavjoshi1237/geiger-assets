"use client";

import { useCallback, useRef, useState } from "react";
import { uploadAsset, UPLOAD_ERROR_MESSAGES } from "@/lib/storage/client";
import { uniqueId } from "@/lib/utils";

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
      void next.run();
    }
  }, []);

  const startFile = useCallback((file, opts = {}) => {
    const id = uniqueId();
    const filename = file?.name || "file";
    const controller = new AbortController();
    controllersRef.current.set(id, controller);

    setUploads((prev) => [...prev, { ...entry(id, filename), status: "queued" }]);

    const run = async () => {
      patch(id, { status: "uploading", progress: 1, error: "" });
      let failure = null;
      const asset = await uploadAsset(file, {
        projectId: opts.projectId || projectId,
        assetId: opts.assetId,
        folder: opts.folder,
        tags: opts.tags,
        quality: opts.quality,
        signal: controller.signal,
        onProgress: (progress) => patch(id, { progress }),
        onPhase: (hookPhase) => patch(id, { phase: hookPhase }),
        onError: (code) => {
          failure = code;
        },
      });
      controllersRef.current.delete(id);
      activeRef.current -= 1;
      if (asset) {
        patch(id, { status: "completed", progress: 100, assetId: asset.id });
      } else {
        patch(id, {
          status: controller.signal.aborted ? "cancelled" : "failed",
          error: UPLOAD_ERROR_MESSAGES[failure] || "Upload failed",
        });
      }
      pump();
      return asset;
    };

    queueRef.current.push({ id, run });
    pump();
    return id;
  }, [patch, projectId, pump]);

  const upload = useCallback((files, opts = {}) => {
    const list = Array.isArray(files) ? files : [files];
    return list.filter(Boolean).map((f) => startFile(f, opts));
  }, [startFile]);

  const cancel = useCallback((id) => {
    // A still-queued upload is dequeued outright; an in-flight one is aborted.
    const qi = queueRef.current.findIndex((e) => e.id === id);
    if (qi >= 0) {
      queueRef.current.splice(qi, 1);
      controllersRef.current.delete(id);
      patch(id, { status: "cancelled", error: "Upload cancelled" });
      return;
    }
    const controller = controllersRef.current.get(id);
    if (controller) controller.abort();
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
