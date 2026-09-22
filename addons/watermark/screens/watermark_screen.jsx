"use client";

// Watermarks — text/image preset builder with a 9-cell placement grid and a
// live preview over a sample asset. One preset can be the default for share
// links. State lives in metadata.watermarks (array).

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { CopyPlus, Image as ImageIcon, Stamp, Star } from "lucide-react";

import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SectionCard,
  SegmentedTabs,
} from "@/components/internal/shared/screen_kit";
import {
  CreateDialog,
  RowActions,
  SelectField,
  TextField,
} from "@/components/internal/shared/module_kit";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Slider } from "@geiger/ui/slider";
import { cn } from "@/lib/utils";
import { useProjectSettings } from "@/components/internal/screens/projects/settings/settings_kit";

const POSITIONS = [
  { value: "top-left", label: "Top left", justify: "justify-start", items: "items-start" },
  { value: "top-center", label: "Top center", justify: "justify-center", items: "items-start" },
  { value: "top-right", label: "Top right", justify: "justify-end", items: "items-start" },
  { value: "middle-left", label: "Middle left", justify: "justify-start", items: "items-center" },
  { value: "center", label: "Center", justify: "justify-center", items: "items-center" },
  { value: "middle-right", label: "Middle right", justify: "justify-end", items: "items-center" },
  { value: "bottom-left", label: "Bottom left", justify: "justify-start", items: "items-end" },
  { value: "bottom-center", label: "Bottom center", justify: "justify-center", items: "items-end" },
  { value: "bottom-right", label: "Bottom right", justify: "justify-end", items: "items-end" },
];

const BLEND_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
];

const KIND_TABS = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
];

const EMPTY_PRESET_DRAFT = {
  id: null,
  name: "",
  kind: "text",
  text: "© Project",
  imageUrl: "",
  position: "bottom-right",
  opacity: 60,
  scale: 100,
  margin: 16,
  blend: "normal",
};

function positionMeta(value) {
  return POSITIONS.find((p) => p.value === value) || POSITIONS[8];
}

function WatermarkMark({ preset }) {
  if (preset.kind === "image" && preset.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={preset.imageUrl}
        alt={preset.name || "Watermark"}
        style={{
          width: `${Math.max(24, Number(preset.scale) || 100)}px`,
          opacity: (Number(preset.opacity) || 0) / 100,
          mixBlendMode: preset.blend || "normal",
        }}
      />
    );
  }
  return (
    <span
      className="max-w-full break-words text-sm font-semibold text-foreground"
      style={{
        fontSize: `${Math.max(10, ((Number(preset.scale) || 100) / 100) * 14)}px`,
        opacity: (Number(preset.opacity) || 0) / 100,
        mixBlendMode: preset.blend || "normal",
      }}
    >
      {preset.text || "© Project"}
    </span>
  );
}

export function WatermarkPreview({ preset }) {
  const meta = positionMeta(preset?.position);
  const margin = Math.max(0, Number(preset?.margin) || 0);
  if (!preset) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-text-tertiary">
        Select a preset to preview it.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <ImageIcon className="h-3.5 w-3.5 text-text-tertiary" />
        <span className="truncate font-mono text-[11px] text-text-secondary">
          sample-asset.jpg
        </span>
      </div>
      <div className={cn("flex h-64 p-4", meta.justify, meta.items)}>
        <div style={{ margin }}>
          <WatermarkMark preset={preset} />
        </div>
      </div>
    </div>
  );
}

function PresetDialog({ open, onOpenChange, draft, onDraftChange, onSave }) {
  const set = (key) => (value) => onDraftChange({ ...draft, [key]: value });
  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={draft.id ? "Edit preset" : "New preset"}
      description="Marks apply to share-link previews."
      submitLabel={draft.id ? "Save changes" : "Create preset"}
      onSubmit={() => {
        if (!draft.name.trim()) {
          toast.error("Give the preset a name first.");
          return;
        }
        if (draft.kind === "image" && !draft.imageUrl.trim()) {
          toast.error("Add an image URL for an image mark.");
          return;
        }
        onSave();
      }}
      size="lg"
    >
      <TextField
        label="Preset name"
        value={draft.name}
        onChange={set("name")}
        placeholder="e.g. Review proof"
      />
      <div className="space-y-2">
        <SegmentedTabs tabs={KIND_TABS} value={draft.kind} onChange={set("kind")} />
        {draft.kind === "text" ? (
          <TextField
            label="Mark text"
            value={draft.text}
            onChange={set("text")}
            placeholder="© Project"
          />
        ) : (
          <TextField
            label="Image URL"
            value={draft.imageUrl}
            onChange={set("imageUrl")}
            placeholder="https://…"
          />
        )}
      </div>
      <Field label="Position">
        <div
          role="group"
          aria-label="Watermark position"
          className="grid w-fit grid-cols-3 gap-1 rounded-lg border border-border bg-surface-card p-1.5"
        >
          {POSITIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              title={p.label}
              aria-label={p.label}
              aria-pressed={draft.position === p.value}
              onClick={() => onDraftChange({ ...draft, position: p.value })}
              className={cn(
                "h-8 w-8 rounded-md border transition-colors",
                draft.position === p.value
                  ? "border-primary/60 bg-primary/10"
                  : "border-transparent hover:bg-surface-hover",
              )}
            >
              <span
                className={cn(
                  "mx-auto block h-1.5 w-1.5 rounded-full",
                  draft.position === p.value ? "bg-primary" : "bg-text-tertiary",
                )}
              />
            </button>
          ))}
        </div>
      </Field>
      <Field label={`Opacity — ${draft.opacity}%`}>
        <Slider
          value={[Number(draft.opacity) || 0]}
          min={5}
          max={100}
          step={1}
          onValueChange={([v]) => onDraftChange({ ...draft, opacity: v })}
          aria-label="Opacity"
        />
      </Field>
      <Field label={`Scale — ${draft.scale}%`}>
        <Slider
          value={[Number(draft.scale) || 100]}
          min={25}
          max={300}
          step={5}
          onValueChange={([v]) => onDraftChange({ ...draft, scale: v })}
          aria-label="Scale"
        />
      </Field>
      <Field label="Margin (px)" hint="Space from the asset edge.">
        <Input
          type="number"
          value={draft.margin}
          min={0}
          max={128}
          onChange={(e) =>
            onDraftChange({ ...draft, margin: Number(e.target.value) || 0 })
          }
          aria-label="Margin"
          className="h-9 w-28 border-border bg-surface-card text-right tabular-nums text-foreground"
        />
      </Field>
      <SelectField
        label="Blend"
        value={draft.blend}
        onChange={set("blend")}
        options={BLEND_OPTIONS}
      />
    </CreateDialog>
  );
}

export function WatermarkScreen({ projectId }) {
  const { settings, loading, patchSection } = useProjectSettings(projectId);
  const presets = useMemo(
    () => (Array.isArray(settings.watermarks) ? settings.watermarks : []),
    [settings.watermarks],
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_PRESET_DRAFT);
  const [selectedId, setSelectedId] = useState(null);

  const selected =
    presets.find((p) => p.id === selectedId) ||
    presets.find((p) => p.isDefault) ||
    presets[0] ||
    null;

  const persist = async (next, notice) => {
    const saved = await patchSection("watermarks", next);
    if (saved && notice) toast.success(notice);
    return Boolean(saved);
  };

  const openAdd = () => {
    setDraft(EMPTY_PRESET_DRAFT);
    setDialogOpen(true);
  };

  const openEdit = (preset) => {
    setDraft({ ...EMPTY_PRESET_DRAFT, ...preset });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const entry = {
      id: draft.id || crypto.randomUUID(),
      name: draft.name.trim(),
      kind: draft.kind,
      text: draft.text,
      imageUrl: draft.imageUrl.trim(),
      position: draft.position,
      opacity: Number(draft.opacity) || 60,
      scale: Number(draft.scale) || 100,
      margin: Math.max(0, Number(draft.margin) || 0),
      blend: draft.blend,
      isDefault: draft.id
        ? presets.some((p) => p.id === draft.id && p.isDefault)
        : presets.length === 0,
    };
    const next = draft.id
      ? presets.map((p) => (p.id === draft.id ? entry : p))
      : [...presets, entry];
    setDialogOpen(false);
    if (await persist(next, draft.id ? "Preset saved." : `Preset "${entry.name}" created.`)) {
      setSelectedId(entry.id);
    }
  };

  const handleDuplicate = async (preset) => {
    const copy = {
      ...preset,
      id: crypto.randomUUID(),
      name: `${preset.name} copy`,
      isDefault: false,
    };
    if (await persist([...presets, copy], `Preset "${copy.name}" created.`)) {
      setSelectedId(copy.id);
    }
  };

  const handleDelete = (preset) =>
    persist(
      presets.filter((p) => p.id !== preset.id),
      `Preset "${preset.name}" deleted.`,
    );

  const handleDefault = (preset) =>
    persist(
      presets.map((p) => ({ ...p, isDefault: p.id === preset.id })),
      `"${preset.name}" is now the share-link default.`,
    );

  const columns = [
    {
      key: "name",
      header: "Preset",
      render: (p) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {p.name}
          </span>
          {p.isDefault ? (
            <Badge className="gap-1 border border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-300">
              <Star className="h-2.5 w-2.5" />
              Default
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: "kind",
      header: "Mark",
      className: "hidden sm:table-cell text-xs text-text-secondary",
      headClassName: "hidden sm:table-cell",
      render: (p) => (p.kind === "image" ? "Image" : "Text"),
    },
    {
      key: "position",
      header: "Position",
      className: "hidden md:table-cell text-xs text-text-secondary",
      headClassName: "hidden md:table-cell",
      render: (p) => positionMeta(p.position).label,
    },
    {
      key: "opacity",
      header: "Opacity",
      align: "right",
      className: "hidden sm:table-cell text-xs tabular-nums text-text-secondary",
      headClassName: "hidden sm:table-cell",
      render: (p) => `${p.opacity}%`,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            onEdit={() => openEdit(p)}
            onDelete={() => handleDelete(p)}
            deleteLabel="Delete"
            extra={[
              ...(p.isDefault
                ? []
                : [
                    {
                      icon: Star,
                      label: "Set as default",
                      onSelect: () => handleDefault(p),
                    },
                  ]),
              {
                icon: CopyPlus,
                label: "Duplicate",
                onSelect: () => handleDuplicate(p),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <SecondaryScreenWrapper>
        <ScreenHeader
          title="Watermarks"
          description="Marks that protect shared previews."
        />
        <LoadingArea size={56} label="Loading watermarks" />
      </SecondaryScreenWrapper>
    );
  }

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Watermarks"
        description="Marks that protect shared previews."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openAdd}
          >
            <Stamp className="h-4 w-4" />
            New preset
          </Button>
        }
      />

      {presets.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Stamp}
            title="No presets yet"
            description="Build a text or image mark for share links."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={openAdd}
              >
                <Stamp className="h-4 w-4" />
                New preset
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <DataTable
            columns={columns}
            data={presets}
            getRowKey={(p) => p.id}
            onRowClick={(p) => setSelectedId(p.id)}
          />
          <SectionCard title="Preview" description="Over a sample asset.">
            <WatermarkPreview preset={selected} />
          </SectionCard>
        </div>
      )}

      <PresetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={draft}
        onDraftChange={setDraft}
        onSave={handleSave}
      />
    </SecondaryScreenWrapper>
  );
}

export default WatermarkScreen;
