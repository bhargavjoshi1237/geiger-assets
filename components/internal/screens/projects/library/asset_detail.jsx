"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  Loader2,
  Plus,
  X,
  History,
  Repeat2,
  RotateCcw,
  Check,
  File,
} from "lucide-react";

import { EditorShell } from "@/components/internal/shared/editor_shell";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  SectionCard,
  StatusPill,
  Field,
} from "@/components/internal/shared/screen_kit";
import {
  TYPE_ICONS,
  STATUS_META,
  RELATION_META,
  TYPE_OPTIONS,
  STATUS_OPTIONS,
  RELATION_OPTIONS,
  formatBytes,
  formatDate,
} from "./constants";
import {
  getAsset,
  updateAsset,
  listRelationships,
  createRelationship,
  deleteRelationship,
  listVersions,
  restoreVersion,
} from "@/lib/supabase/assets";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { NAV_GROUPS } from "./asset_sections";

function TypeGlyph({ type, color, className }) {
  const Icon = TYPE_ICONS[type] || File;
  return <Icon className={className} style={{ color: color || "#737373" }} />;
}

export function RelationshipsSection({
  asset,
  relationships = [],
  onAdd,
  onRemove,
}) {
  const [adding, setAdding] = useState(false);
  const [relationType, setRelationType] = useState("derived");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!label.trim()) return;
    setBusy(true);
    await onAdd?.({ relationType, label: label.trim() });
    setBusy(false);
    setLabel("");
    setRelationType("derived");
    setAdding(false);
  };

  return (
    <SectionCard
      title="Relationships"
      description="Originals, derivatives, variants, and related records."
      action={
        <Button
          variant="outline"
          size="sm"
          className="h-7 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      }
      bodyPadding={false}
    >
      {adding ? (
        <div className="space-y-2.5 border-b border-border bg-surface-card/40 p-4">
          <Select value={relationType} onValueChange={setRelationType}>
            <SelectTrigger className="h-8 border-border bg-surface-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border bg-surface-subtle text-foreground">
              {RELATION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Related asset or record name"
            className="h-8 border-border bg-surface-card text-xs"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
              onClick={submit}
              disabled={busy || !label.trim()}
            >
              {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Add link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-text-secondary hover:text-foreground"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {relationships.length === 0 && !adding ? (
        <EmptyState
          icon={Repeat2}
          title="No relationships"
          description="Link this asset to its originals, variants, or campaigns."
          className="py-10"
        />
      ) : (
        <div className="divide-y divide-border">
          {relationships.map((rel) => {
            const meta = RELATION_META[rel.relationType] || RELATION_META.derived;
            const name = rel.related?.name || rel.label || "Untitled";
            return (
              <div key={rel.id} className="group flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
                  <TypeGlyph
                    type={rel.related?.type}
                    color={rel.related?.color}
                    className="h-4 w-4"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{name}</p>
                  <Badge className={cn("mt-0.5 border px-1.5 py-0 text-[10px]", meta.className)}>
                    {meta.label}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove relationship"
                  className="h-7 w-7 shrink-0 text-text-tertiary opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                  onClick={() => onRemove?.(rel.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

export function VersionsSection({ versions = [], onRestore }) {
  return (
    <SectionCard
      title="Version Control"
      description="An inspectable history of every revision."
      bodyPadding={false}
    >
      {versions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No versions yet"
          description="Replacing the file will start the version history."
          className="py-10"
        />
      ) : (
        <div className="divide-y divide-border">
          {versions.map((v) => (
            <div key={v.id} className="group flex items-center gap-3 px-4 py-3">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums",
                  v.isCurrent
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-border bg-surface-card text-text-secondary",
                )}
              >
                v{v.versionNumber}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {v.label || `Version ${v.versionNumber}`}
                  </p>
                  {v.isCurrent ? (
                    <Badge className="border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0 text-[10px] text-emerald-300">
                      <Check className="h-2.5 w-2.5" />
                      Current
                    </Badge>
                  ) : null}
                </div>
                <p className="text-[11px] text-text-tertiary">
                  {v.sizeBytes != null ? formatBytes(v.sizeBytes) : "—"}
                  {v.createdAt ? ` · ${formatDate(v.createdAt)}` : ""}
                </p>
              </div>
              {!v.isCurrent ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 text-xs text-text-secondary opacity-0 transition-opacity hover:bg-surface-active hover:text-foreground group-hover:opacity-100"
                  onClick={() => onRestore?.(v.id)}
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Restore
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export function OverviewSection({ asset, relationships = [], versions = [] }) {
  if (!asset) return null;
  const facts = [
    { label: "Type", value: asset.format || asset.type },
    { label: "Size", value: formatBytes(asset.sizeBytes) },
    { label: "Folder", value: asset.folder || "—" },
    { label: "Downloads", value: (asset.downloads ?? 0).toLocaleString() },
    { label: "Relationships", value: String(relationships.length) },
    { label: "Versions", value: String(versions.length) },
  ];

  return (
    <div className="space-y-4">
      <SectionCard title="Preview">
        <div
          className="flex aspect-video items-center justify-center rounded-xl border border-border"
          style={{
            background: `linear-gradient(135deg, ${asset.color}15 0%, ${asset.color}08 100%)`,
            borderColor: `${asset.color}20`,
          }}
        >
          <TypeGlyph type={asset.type} color={asset.color} className="h-16 w-16" />
        </div>
      </SectionCard>

      <SectionCard title="Key details" description="At-a-glance metadata for this asset.">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                {f.label}
              </dt>
              <dd className="mt-1 truncate text-sm font-medium tabular-nums text-foreground">
                {f.value}
              </dd>
            </div>
          ))}
          <div className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
              Status
            </dt>
            <dd className="mt-1">
              <StatusPill status={asset.status} map={STATUS_META} className="text-[10px]" />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
              Modified
            </dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {asset.updatedAt ? formatDate(asset.updatedAt) : "—"}
            </dd>
          </div>
        </dl>
      </SectionCard>
    </div>
  );
}

export function DetailsSection({ asset, onPatch, onAddTag, onRemoveTag }) {
  if (!asset) return null;
  const patch = onPatch || (() => {});
  return (
    <SectionCard title="Details">
      <div className="grid gap-4">
        <Field label="Name" htmlFor="asset-name">
          <Input
            id="asset-name"
            value={asset.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <Field label="Description" htmlFor="asset-desc">
          <Textarea
            id="asset-desc"
            value={asset.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Add a description…"
            className="min-h-20 border-border bg-surface-card text-foreground"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={asset.status} onValueChange={(v) => patch({ status: v })}>
              <SelectTrigger className="border-border bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-surface-subtle text-foreground">
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={asset.type} onValueChange={(v) => patch({ type: v })}>
              <SelectTrigger className="border-border bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-surface-subtle text-foreground">
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Folder" htmlFor="asset-folder">
          <Input
            id="asset-folder"
            value={asset.folder}
            onChange={(e) => patch({ folder: e.target.value })}
          />
        </Field>
        <Field label="Tags" hint="Press Enter to add a tag.">
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-card px-2 py-2">
            {(asset.tags || []).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="gap-1 border-border bg-surface-subtle text-[11px] text-muted-foreground"
              >
                {tag}
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  onClick={() => onRemoveTag?.(tag)}
                  className="text-text-tertiary hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              onKeyDown={onAddTag}
              placeholder={asset.tags?.length ? "" : "Add tags…"}
              className="min-w-24 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-text-tertiary"
            />
          </div>
        </Field>
      </div>
    </SectionCard>
  );
}

export const SECTIONS = {
  overview: OverviewSection,
  details: DetailsSection,
  relationships: RelationshipsSection,
  versions: VersionsSection,
};

export function AssetEditScreen({ assetId, onBack, onUpdate }) {
  const { section: active, setSection: setActive } = useWorkspaceUrl();
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState(null);
  const [form, setForm] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [versions, setVersions] = useState([]);
  const [saving, setSaving] = useState(false);

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

  const dirty = useMemo(() => {
    if (!asset || !form) return false;
    return (
      asset.name !== form.name ||
      asset.description !== form.description ||
      asset.status !== form.status ||
      asset.type !== form.type ||
      asset.folder !== form.folder ||
      (asset.tags || []).join(",") !== (form.tags || []).join(",")
    );
  }, [asset, form]);

  if (loading) {
    return (
      <EditorShell
        back={{ label: "Asset Library", onClick: onBack }}
        title="Loading asset…"
        nav={NAV_GROUPS}
        subject={null}
        active={active}
        onActiveChange={setActive}
      >
        <div className="flex h-64 items-center justify-center text-text-tertiary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </EditorShell>
    );
  }

  if (!asset || !form) {
    return (
      <EditorShell
        back={{ label: "Asset Library", onClick: onBack }}
        title="Asset not found"
        nav={NAV_GROUPS}
        subject={null}
        active={active}
        onActiveChange={setActive}
      >
        <EmptyState
          icon={File}
          title="Asset not found"
          description="This asset may have been deleted or isn't available."
          action={
            <Button
              variant="outline"
              className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
              onClick={onBack}
            >
              Back to Library
            </Button>
          }
        />
      </EditorShell>
    );
  }

  const patch = (partial) => setForm((f) => ({ ...f, ...partial }));

  const commit = (partial) => {
    const next = { ...form, ...partial };
    setForm(next);
    onUpdate?.(next);
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    const updated = await updateAsset(assetId, {
      name: form.name,
      description: form.description,
      status: form.status,
      type: form.type,
      folder: form.folder,
      tags: form.tags,
    });
    setSaving(false);
    if (updated) {
      setAsset(updated);
      setForm(updated);
      onUpdate?.(updated);
      toast.success("Changes saved.");
    } else {
      setForm(asset);
      toast.error("Couldn't save your changes to the server.");
    }
  };

  const handleAddRelationship = async ({ relationType, label }) => {
    const optimistic = {
      id: crypto.randomUUID(),
      assetId,
      relatedAssetId: null,
      relationType,
      label,
      createdAt: new Date().toISOString(),
      related: null,
    };
    setRelationships((prev) => [...prev, optimistic]);
    const created = await createRelationship({ id: optimistic.id, assetId, relationType, label });
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

  const removeTag = (tag) => patch({ tags: (form.tags || []).filter((t) => t !== tag) });
  const addTag = (e) => {
    if (e.key !== "Enter") return;
    const value = e.target.value.trim();
    if (value && !(form.tags || []).includes(value))
      patch({ tags: [...(form.tags || []), value] });
    e.target.value = "";
    e.preventDefault();
  };

  return (
    <EditorShell
      searchable
      back={{ label: "Asset Library", onClick: onBack }}
      title={form.name || "Untitled asset"}
      status={form.status}
      statusMap={STATUS_META}
      meta={
        [form.format || form.type, formatBytes(form.sizeBytes), form.folder]
          .filter(Boolean)
          .join(" · ") || "No details set yet"
      }
      actions={
        <>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={save}
            disabled={!dirty || saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {dirty ? "Save Changes" : "Saved"}
          </Button>
        </>
      }
      nav={NAV_GROUPS}
      subject={form}
      active={active}
      onActiveChange={setActive}
    >
      {({ active: key }) => {
        const ActiveSection = SECTIONS[key] || SECTIONS.overview;
        return (
          <ActiveSection
            asset={form}
            headerItem={NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === key)}
            relationships={relationships}
            versions={versions}
            onPatch={patch}
            onCommit={commit}
            onAdd={handleAddRelationship}
            onRemove={handleRemoveRelationship}
            onRestore={handleRestoreVersion}
            onAddTag={addTag}
            onRemoveTag={removeTag}
          />
        );
      }}
    </EditorShell>
  );
}

export default AssetEditScreen;
