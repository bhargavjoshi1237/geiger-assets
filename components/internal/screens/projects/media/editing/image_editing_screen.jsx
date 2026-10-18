"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";

import { LoadingArea } from "@/components/internal/shared/screen_kit";
import { assetFileUrl, uploadAsset, UPLOAD_ERROR_MESSAGES } from "@/lib/storage/client";
import { createRelationship, getAsset, listAssets, listRelationships } from "@/lib/supabase/assets";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { isImageAsset } from "../shared";

// Fabric touches the DOM on import, so the editor only ever loads client-side.
const ImageEditor = dynamic(() => import("./editor/image_editor").then((m) => m.ImageEditor), {
  ssr: false,
  loading: () => <LoadingArea panel size={72} className="h-full min-h-[560px]" />,
});

// Same-origin original for the canvas (so it can be exported), falling back
// to the preview for rows without a stored file.
function assetImageUrl(asset) {
  if (!asset) return "";
  return asset.storageKey
    ? assetFileUrl(asset.id, { proxy: true, version: asset.etag || asset.updatedAt })
    : asset.thumbnailUrl;
}

export function ImageEditingScreen({ projectId }) {
  const { assetId, openAsset, openAssetInTab, setTab } = useWorkspaceUrl();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [defaultId, setDefaultId] = useState(null);
  const [localFile, setLocalFile] = useState(null);
  const [variantRows, setVariantRows] = useState({ forId: null, rows: [] });

  useEffect(() => {
    let alive = true;
    listAssets(projectId).then((rows) => {
      if (!alive) return;
      if (rows === null) toast.error("Couldn't load images.");
      const images = (rows ?? []).filter(isImageAsset);
      setAssets(images);
      setDefaultId(images[0]?.id ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  // The open image lives in the URL (?asset=<id>); with none, the most
  // recently updated image at load time opens (pinned, so saving a new asset
  // doesn't swap the canvas).
  const current = useMemo(() => {
    const id = assetId || defaultId;
    return id ? assets.find((a) => a.id === id) ?? null : null;
  }, [assets, assetId, defaultId]);
  const currentId = current?.id ?? null;

  useEffect(() => {
    if (!currentId) return undefined;
    let alive = true;
    listRelationships(currentId).then((rows) => {
      if (!alive) return;
      setVariantRows({
        forId: currentId,
        rows: (rows ?? []).filter((r) => r.relationType === "variant" && r.relatedAssetId),
      });
    });
    return () => {
      alive = false;
    };
  }, [currentId]);

  const variantsLoading = Boolean(currentId) && !localFile && variantRows.forId !== currentId;
  const variants = useMemo(() => {
    if (!currentId || variantRows.forId !== currentId) return [];
    return variantRows.rows.map((r) => {
      const asset = assets.find((a) => a.id === r.relatedAssetId);
      return asset ?? { id: r.relatedAssetId, name: r.related?.name || "Variant", status: r.related?.status || "draft" };
    });
  }, [assets, currentId, variantRows]);

  const source = useMemo(() => {
    if (localFile) {
      return { key: localFile.key, name: localFile.name, url: localFile.url, thumbnailUrl: localFile.url, assetId: null };
    }
    if (!current) return null;
    return {
      key: current.id,
      assetId: current.id,
      name: current.name,
      url: assetImageUrl(current),
      fallbackUrl: current.thumbnailUrl,
      thumbnailUrl: current.miniThumbnailUrl || current.thumbnailUrl,
    };
  }, [current, localFile]);

  const clearLocalFile = () => {
    setLocalFile((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const handleOpenAsset = (asset) => {
    clearLocalFile();
    openAsset(asset.id);
  };

  const handleOpenFile = (file) => {
    setLocalFile((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { key: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file) };
    });
  };

  const handleSaveAsset = async ({ file, name }) => {
    if (!projectId) {
      toast.error("Open a project before saving to the library.");
      return false;
    }
    let failure = null;
    const uploaded = await uploadAsset(file, {
      projectId,
      name,
      type: "image",
      status: "draft",
      folder: current && !localFile ? current.folder || "root" : "root",
      tags: current && !localFile ? current.tags : undefined,
      quality: "original",
      onError: (code) => {
        failure = code;
      },
    });
    if (!uploaded) {
      toast.error(UPLOAD_ERROR_MESSAGES[failure] || "Couldn't save the image.");
      return false;
    }
    const created = (await getAsset(uploaded.id)) ?? uploaded;
    setAssets((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);

    if (current && !localFile) {
      const link = await createRelationship({
        id: crypto.randomUUID(),
        assetId: current.id,
        relatedAssetId: created.id,
        relationType: "variant",
        label: "Edited variation",
      });
      if (link) {
        setVariantRows((prev) => (prev.forId === current.id ? { ...prev, rows: [...prev.rows, link] } : prev));
        // Back-link so the variant's own detail shows where it came from.
        await createRelationship({ assetId: created.id, relatedAssetId: current.id, relationType: "source", label: "Edited from" });
      } else {
        toast.error("Saved, but couldn't link it to the source image.");
      }
    }

    toast.success(`Saved “${created.name || name}” to the library.`, {
      action: { label: "View", onClick: () => openAssetInTab(created.id, "Asset Library") },
    });
    return true;
  };

  const handleSaveVersion = async ({ file }) => {
    if (!current || localFile || !projectId) return false;
    let failure = null;
    const uploaded = await uploadAsset(file, {
      projectId,
      assetId: current.id,
      folder: current.folder,
      quality: "original",
      onError: (code) => {
        failure = code;
      },
    });
    if (!uploaded) {
      toast.error(UPLOAD_ERROR_MESSAGES[failure] || "Couldn't save the new version.");
      return false;
    }
    const fresh = await getAsset(current.id);
    if (fresh) setAssets((prev) => prev.map((a) => (a.id === fresh.id ? fresh : a)));
    toast.success(`Saved as the current version of “${current.name}”.`);
    return true;
  };

  return (
    <div className="h-full min-h-[560px]">
      <ImageEditor
        source={source}
        assets={assets}
        assetsLoading={loading}
        assetImageUrl={assetImageUrl}
        onOpenAsset={handleOpenAsset}
        onOpenFile={handleOpenFile}
        onSaveAsset={handleSaveAsset}
        onSaveVersion={handleSaveVersion}
        variants={variants}
        variantsLoading={variantsLoading}
        onGoToLibrary={() => setTab("Asset Library")}
      />
    </div>
  );
}

export default ImageEditingScreen;
