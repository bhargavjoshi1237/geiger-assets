"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  Loader2,
  Save,
  Trash2,
  Plus,
  X,
  History,
  Repeat2,
  RotateCcw,
  Check,
  File,
  LayoutDashboard,
  SquarePen,
  Share2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  SectionCard,
  StatusPill,
  Field,
  EmptyState,
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

// Stacked editor nav — mirrors the Geiger Events event editor. Each item maps to
// a section keyed in the URL (?section=<key>); the default ("overview") is
// dropped from the URL for cleanliness.
const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "overview",
        label: "Overview",
        icon: LayoutDashboard,
        desc: "A snapshot of this asset — preview and key details.",
      },
    ],
  },
  {
    group: "Manage",
    items: [
      {
        key: "details",
        label: "Asset details",
        icon: SquarePen,
        desc: "Name, description, status, type, folder, and tags.",
      },
      {
        key: "relationships",
        label: "Relationships",
        icon: Share2,
        desc: "Originals, derivatives, variants, and related records.",
      },
      {
        key: "versions",
        label: "Versions",
        icon: History,
        desc: "An inspectable history of every revision.",
      },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function TypeGlyph({ type, color, className }) {
  const Icon = TYPE_ICONS[type] || File;
  return <Icon className={className} style={{ color: color || "#737373" }} />;
}

// ---------------------------------------------------------------------------
// Right rail — Relationships
// ---------------------------------------------------------------------------

function RelationshipsPanel({ assetId, rows, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [relationType, setRelationType] = useState("derived");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!label.trim()) return;
    setBusy(true);
    await onAdd({ relationType, label: label.trim() });
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

      {rows.length === 0 && !adding ? (
        <EmptyState
          icon={Repeat2}
          title="No relationships"
          description="Link this asset to its originals, variants, or campaigns."
          className="py-10"
        />
      ) : (
        <div className="divide-y divide-border">
          {rows.map((rel) => {
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
                  onClick={() => onRemove(rel.id)}
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

// ---------------------------------------------------------------------------
// Right rail — Version Control
// ---------------------------------------------------------------------------

function VersionsPanel({ rows, onRestore }) {
  return (
    <SectionCard
      title="Version Control"
      description="An inspectable history of every revision."
      bodyPadding={false}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={History}
          title="No versions yet"
          description="Replacing the file will start the version history."
          className="py-10"
        />
      ) : (
        <div className="divide-y divide-border">
          {rows.map((v) => (
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
                  onClick={() => onRestore(v.id)}
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

// ---------------------------------------------------------------------------
// Section — Overview (preview + key details snapshot)
// ---------------------------------------------------------------------------

function OverviewSection({ draft, relationships, versions }) {
  const facts = [
    { label: "Type", value: draft.format || draft.type },
    { label: "Size", value: formatBytes(draft.sizeBytes) },
    { label: "Folder", value: draft.folder || "—" },
    { label: "Downloads", value: (draft.downloads ?? 0).toLocaleString() },
    { label: "Relationships", value: String(relationships.length) },
    { label: "Versions", value: String(versions.length) },
  ];

  return (
    <div className="space-y-4">
      <SectionCard title="Preview">
        <div
          className="flex aspect-video items-center justify-center rounded-xl border border-border"
          style={{
            background: `linear-gradient(135deg, ${draft.color}15 0%, ${draft.color}08 100%)`,
            borderColor: `${draft.color}20`,
          }}
        >
          <TypeGlyph type={draft.type} color={draft.color} className="h-16 w-16" />
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
              <StatusPill status={draft.status} map={STATUS_META} className="text-[10px]" />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
              Modified
            </dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {draft.updatedAt ? formatDate(draft.updatedAt) : "—"}
            </dd>
          </div>
        </dl>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section — Asset details (editable form)
// ---------------------------------------------------------------------------

function DetailsSection({ draft, set, addTag, removeTag }) {
  return (
    <SectionCard title="Details">
      <div className="grid gap-4">
        <Field label="Name" htmlFor="asset-name">
          <Input
            id="asset-name"
            value={draft.name}
            onChange={(e) => set("name")(e.target.value)}
            className="border-border bg-surface-card text-foreground"
          />
        </Field>
        <Field label="Description" htmlFor="asset-desc">
          <Textarea
            id="asset-desc"
            value={draft.description}
            onChange={(e) => set("description")(e.target.value)}
            placeholder="Add a description…"
            className="min-h-20 border-border bg-surface-card text-foreground"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={draft.status} onValueChange={set("status")}>
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
            <Select value={draft.type} onValueChange={set("type")}>
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
            value={draft.folder}
            onChange={(e) => set("folder")(e.target.value)}
            className="border-border bg-surface-card text-foreground"
          />
        </Field>
        <Field label="Tags" hint="Press Enter to add a tag.">
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-card px-2 py-2">
            {draft.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="gap-1 border-border bg-surface-subtle text-[11px] text-muted-foreground"
              >
                {tag}
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  onClick={() => removeTag(tag)}
                  className="text-text-tertiary hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              onKeyDown={addTag}
              placeholder={draft.tags.length ? "" : "Add tags…"}
              className="min-w-24 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-text-tertiary"
            />
          </div>
        </Field>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Edit screen
// ---------------------------------------------------------------------------

export function AssetEditScreen({ assetId, onBack, onChange }) {
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState(null);
  const [draft, setDraft] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [versions, setVersions] = useState([]);
  const [saving, setSaving] = useState(false);

  // Active editor section lives in the URL (?section=<key>) — falls back to the
  // first nav item for an unknown/absent value.
  const { section, setSection } = useWorkspaceUrl();
  const active = NAV_ITEMS.some((i) => i.key === section) ? section : NAV_ITEMS[0].key;

  useEffect(() => {
    let alive = true;
    Promise.all([
      getAsset(assetId),
      listRelationships(assetId),
      listVersions(assetId),
    ]).then(([a, rels, vers]) => {
      if (!alive) return;
      setAsset(a);
      setDraft(a);
      setRelationships(rels ?? []);
      setVersions(vers ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [assetId]);

  const dirty = useMemo(() => {
    if (!asset || !draft) return false;
    return (
      asset.name !== draft.name ||
      asset.description !== draft.description ||
      asset.status !== draft.status ||
      asset.type !== draft.type ||
      asset.folder !== draft.folder ||
      asset.tags.join(",") !== draft.tags.join(",")
    );
  }, [asset, draft]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    const patch = {
      name: draft.name,
      description: draft.description,
      status: draft.status,
      type: draft.type,
      folder: draft.folder,
      tags: draft.tags,
    };
    const updated = await updateAsset(assetId, patch);
    setSaving(false);
    if (updated) {
      setAsset(updated);
      setDraft(updated);
      onChange?.(updated);
    } else {
      // write failed — reconcile back to the last known-good asset
      setDraft(asset);
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
    }
  };

  const handleRemoveRelationship = async (id) => {
    const prev = relationships;
    setRelationships((rows) => rows.filter((r) => r.id !== id));
    const ok = await deleteRelationship(id);
    if (!ok) setRelationships(prev);
  };

  const handleRestoreVersion = async (versionId) => {
    const prev = versions;
    setVersions((rows) => rows.map((v) => ({ ...v, isCurrent: v.id === versionId })));
    const ok = await restoreVersion(assetId, versionId);
    if (!ok) setVersions(prev);
  };

  const removeTag = (tag) => set("tags")(draft.tags.filter((t) => t !== tag));
  const addTag = (e) => {
    if (e.key !== "Enter") return;
    const value = e.target.value.trim();
    if (value && !draft.tags.includes(value)) set("tags")([...draft.tags, value]);
    e.target.value = "";
    e.preventDefault();
  };

  if (loading) {
    return (
      <MainScreenWrapper className="dark">
        <div className="flex h-64 items-center justify-center text-text-tertiary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </MainScreenWrapper>
    );
  }

  if (!asset || !draft) {
    return (
      <MainScreenWrapper className="dark">
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
      </MainScreenWrapper>
    );
  }

  return (
    <MainScreenWrapper className="dark">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to library"
            className="h-8 w-8 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
            style={{ background: `${draft.color}15`, borderColor: `${draft.color}25` }}
          >
            <TypeGlyph type={draft.type} color={draft.color} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {draft.name || "Untitled asset"}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusPill status={draft.status} map={STATUS_META} className="text-[10px]" />
              <span className="text-xs text-text-secondary">
                {draft.format} · {formatBytes(draft.sizeBytes)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="h-9 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Download
          </Button>
          <Button
            className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            {dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </div>

      {/* Content (left) + stacked section nav (right) — mirrors the Geiger
          Events event editor. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
        <div className="order-2 min-w-0 lg:order-1">
          {active === "overview" ? (
            <OverviewSection
              draft={draft}
              relationships={relationships}
              versions={versions}
            />
          ) : active === "details" ? (
            <DetailsSection
              draft={draft}
              set={set}
              addTag={addTag}
              removeTag={removeTag}
            />
          ) : active === "relationships" ? (
            <RelationshipsPanel
              assetId={assetId}
              rows={relationships}
              onAdd={handleAddRelationship}
              onRemove={handleRemoveRelationship}
            />
          ) : active === "versions" ? (
            <VersionsPanel rows={versions} onRestore={handleRestoreVersion} />
          ) : null}
        </div>

        <aside className="order-1 lg:order-2">
          {/* Pinned to the viewport so the nav spans the full height even when the
              section content is shorter, scrolling inside its own area. Offset =
              topbar + main padding. Scrollbar hidden to match the suite chrome. */}
          <nav className="space-y-5 lg:sticky lg:top-0 lg:h-[calc(100dvh-7.5rem)] lg:overflow-y-auto lg:pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_GROUPS.map((group, gi) => (
              <div key={group.group || `g${gi}`}>
                {group.group ? (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    {group.group}
                  </p>
                ) : null}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = active === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setSection(item.key)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          isActive
                            ? "bg-surface-card font-medium text-white"
                            : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-white" : "text-text-secondary",
                          )}
                        />
                        <span className="truncate capitalize">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
      </div>
    </MainScreenWrapper>
  );
}

export default AssetEditScreen;
