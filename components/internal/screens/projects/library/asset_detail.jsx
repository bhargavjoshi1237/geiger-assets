"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, File } from "lucide-react";

import {
  EditorLoading,
  EditorNotFound,
  EditorShell,
} from "@/components/internal/shared/editor_shell";
import { EditorSaveActions, useEditorGuard } from "@/components/internal/shared/unsaved_changes";
import { Button } from "@geiger/ui/button";
import { STATUS_META, formatBytes } from "./constants";
import {
  getAsset,
  listAssets,
  updateAsset,
  listRelationships,
  createRelationship,
  deleteRelationship,
  listVersions,
  restoreVersion,
} from "@/lib/supabase/assets";
import { getDeliverySettings } from "@/lib/supabase/delivery";
import { NAV_GROUPS } from "./asset_sections";
import { assetFileUrl, uploadAsset, UPLOAD_PHASE_LABELS, UPLOAD_ERROR_MESSAGES } from "@/lib/storage/client";
import { OverviewSection } from "./sections/overview_section";
import { DetailsSection } from "./sections/details_section";
import { RelationshipsSection } from "./sections/relationships_section";
import { VersionsSection } from "./sections/versions_section";
import { DeliverySection } from "./sections/delivery_section";
import { TechnicalSection } from "./sections/technical_section";

export const SECTIONS = {
  overview: OverviewSection,
  details: DetailsSection,
  relationships: RelationshipsSection,
  versions: VersionsSection,
  delivery: DeliverySection,
  technical: TechnicalSection,
};

const EDITABLE = ["name", "description", "status", "type", "folder", "tags", "color", "deliveryEnabled"];

function pickEditable(source) {
  const out = {};
  for (const key of EDITABLE) out[key] = source?.[key];
  return out;
}

export function AssetEditScreen({ assetId, onBack, onUpdate }) {
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState(null);
  const [form, setForm] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [versions, setVersions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [replaceProgress, setReplaceProgress] = useState(0);
  const [replacePhase, setReplacePhase] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      getAsset(assetId),
      listRelationships(assetId),
      listVersions(assetId),
    ]).then(([a, rels, vers]) => {
      if (!alive) return;
      setAsset(a);
      setForm(a);
      setRelationships(rels ?? []);
      setVersions(vers ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [assetId]);

  const projectId = asset?.projectId;
  useEffect(() => {
    if (!projectId) return undefined;
    let alive = true;
    listAssets(projectId).then((rows) => {
      if (alive) setCandidates(rows ?? []);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Fetched once here rather than inside the Delivery section, so switching
  // tabs doesn't re-read the project's delivery settings each time.
  const [transformsEnabled, setTransformsEnabled] = useState(false);
  useEffect(() => {
    if (!projectId) return undefined;
    let alive = true;
    getDeliverySettings(projectId).then((row) => {
      if (alive) setTransformsEnabled(Boolean(row?.transformsEnabled));
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const folders = useMemo(() => {
    const seen = new Set(candidates.map((a) => a.folder).filter(Boolean));
    if (form?.folder) seen.add(form.folder);
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [candidates, form]);

  const dirty = useMemo(() => {
    if (!asset || !form) return false;
    return EDITABLE.some((key) =>
      key === "tags"
        ? (asset.tags || []).join(",") !== (form.tags || []).join(",")
        : asset[key] !== form[key],
    );
  }, [asset, form]);

  const save = useCallback(async () => {
    if (!dirty || saving || !form) return false;
    if (!form.name?.trim()) {
      toast.error("Give the asset a name before saving.");
      return false;
    }
    setSaving(true);
    const updated = await updateAsset(assetId, pickEditable(form));
    setSaving(false);
    if (updated) {
      setAsset(updated);
      setForm(updated);
      onUpdate?.(updated);
      toast.success("Changes saved.");
      return true;
    }
    toast.error("Couldn't save your changes to the server.");
    return false;
  }, [assetId, dirty, form, onUpdate, saving]);

  const guard = useEditorGuard({
    dirty,
    saving,
    save,
    discard: () => setForm(asset),
    onBack,
    name: form?.name || "this asset",
    resetSection: false,
  });
  const back = { label: "Asset Library", onClick: guard.back };

  if (loading) {
    return <EditorLoading back={back} title="Loading asset…" nav={NAV_GROUPS} />;
  }

  if (!asset || !form) {
    return (
      <EditorNotFound
        back={back}
        nav={NAV_GROUPS}
        icon={File}
        title="Asset not found"
        description="This asset may have been deleted or isn't available."
      />
    );
  }

  const patch = (partial) => setForm((f) => ({ ...f, ...partial }));

  const handleAddRelationship = async ({ relationType, label, relatedAssetId }) => {
    const optimistic = {
      id: crypto.randomUUID(),
      assetId,
      relatedAssetId: relatedAssetId ?? null,
      relationType,
      label,
      createdAt: new Date().toISOString(),
      related: relatedAssetId
        ? candidates.find((a) => a.id === relatedAssetId) ?? null
        : null,
    };
    setRelationships((prev) => [...prev, optimistic]);
    const created = await createRelationship({
      id: optimistic.id,
      assetId,
      relationType,
      label,
      relatedAssetId,
    });
    if (created) {
      setRelationships((prev) => prev.map((r) => (r.id === optimistic.id ? created : r)));
    } else {
      setRelationships((prev) => prev.filter((r) => r.id !== optimistic.id));
      toast.error("Couldn't save the link to the server.");
    }
  };

  const handleRemoveRelationship = async (id) => {
    const prev = relationships;
    setRelationships((rows) => rows.filter((r) => r.id !== id));
    const ok = await deleteRelationship(id);
    if (!ok) {
      setRelationships(prev);
      toast.error("Couldn't remove the link on the server.");
    }
  };

  const handleRestoreVersion = async (versionId) => {
    const prev = versions;
    setVersions((rows) => rows.map((v) => ({ ...v, isCurrent: v.id === versionId })));
    const ok = await restoreVersion(assetId, versionId);
    if (!ok) {
      setVersions(prev);
      toast.error("Couldn't restore that version on the server.");
    } else {
      toast.success("Version restored.");
    }
  };

  const handleReplaceFile = async (file) => {
    if (replacing) return;
    if (!projectId) {
      toast.error("This asset isn't attached to a project yet.");
      return;
    }
    setReplacing(true);
    setReplaceProgress(1);
    setReplacePhase(UPLOAD_PHASE_LABELS.hashing);
    let failure = null;
    const result = await uploadAsset(file, {
      projectId,
      assetId,
      folder: form.folder,
      onProgress: setReplaceProgress,
      onPhase: (p) => setReplacePhase(UPLOAD_PHASE_LABELS[p] || ""),
      onError: (code) => {
        failure = code;
      },
    });
    setReplacing(false);
    setReplaceProgress(0);
    setReplacePhase("");
    if (!result) {
      toast.error(UPLOAD_ERROR_MESSAGES[failure] || `Couldn't replace ${file.name || "the file"}.`);
      return;
    }
    const [fresh, vers] = await Promise.all([getAsset(assetId), listVersions(assetId)]);
    setVersions(vers ?? []);
    if (fresh) {
      setAsset(fresh);

      setForm((f) => ({ ...fresh, ...pickEditable(f) }));
      onUpdate?.(fresh);
    }
    toast.success("File replaced — a new version was recorded.");
  };

  const hasFile = Boolean(form.storageKey);

  return (
    <>
      <EditorShell
        searchable
        back={back}
        title={form.name || "Untitled asset"}
        status={form.status}
        statusMap={STATUS_META}
        meta={
          [form.format || form.type, formatBytes(form.sizeBytes), form.folder]
            .filter(Boolean)
            .join(" · ") || "No details set yet"
        }
        actions={
          <EditorSaveActions
            dirty={dirty}
            saving={saving}
            onSave={save}
            onDiscard={() => setForm(asset)}
          >
            <Button
              variant="outline"
              aria-label="Download asset"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => {
                if (!hasFile) {
                  toast.error("No file uploaded yet for this asset.");
                  return;
                }
                window.open(assetFileUrl(form.id, { download: true }), "_blank");
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
          </EditorSaveActions>
        }
        nav={NAV_GROUPS}
        subject={form}
        active={guard.active}
        onActiveChange={guard.selectSection}
      >
        {({ active: key }) => {
          const ActiveSection = SECTIONS[key] || SECTIONS.overview;
          return (
            <ActiveSection
              asset={form}
              saved={asset}
              headerItem={NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === key)}
              relationships={relationships}
              versions={versions}
              candidates={candidates}
              folders={folders}
              transformsEnabled={transformsEnabled}
              onPatch={patch}
              onAdd={handleAddRelationship}
              onRemove={handleRemoveRelationship}
              onRestore={handleRestoreVersion}
              onReplace={handleReplaceFile}
              replacing={replacing}
              replaceProgress={replaceProgress}
              replacePhase={replacePhase}
            />
          );
        }}
      </EditorShell>

      {guard.dialog}
    </>
  );
}

export default AssetEditScreen;
