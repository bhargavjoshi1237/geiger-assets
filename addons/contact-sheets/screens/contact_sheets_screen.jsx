"use client";

// Contact Sheets — saved print layouts bound to a source collection. Grid
// columns/rows, caption fields, header/footer and page size, with a preview
// grid over the collection's real assets and a printable HTML export. State
// lives in metadata.contactSheets (array).

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CopyPlus, Download, FileImage, LayoutGrid } from "lucide-react";

import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import {
  CreateDialog,
  RowActions,
  SelectField,
  TextField,
} from "@/components/internal/shared/module_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Label } from "@geiger/ui/label";
import { cn } from "@/lib/utils";
import {
  listCollectionAssets,
  listCollections,
} from "@/lib/supabase/collections";
import { formatBytes } from "@/components/internal/screens/projects/settings/constants";
import { useProjectSettings } from "@/components/internal/screens/projects/settings/settings_kit";

const CAPTION_FIELDS = [
  { value: "name", label: "File name" },
  { value: "type", label: "Type" },
  { value: "format", label: "Format" },
  { value: "size", label: "Size" },
  { value: "status", label: "Status" },
];

const PAGE_SIZE_OPTIONS = [
  { value: "A4", label: "A4" },
  { value: "Letter", label: "Letter" },
  { value: "A3", label: "A3" },
  { value: "Tabloid", label: "Tabloid" },
];

const EMPTY_LAYOUT_DRAFT = {
  id: null,
  name: "",
  sourceCollection: "",
  columns: 4,
  rows: 5,
  fields: ["name"],
  header: "",
  footer: "",
  pageSize: "A4",
};

function captionValue(asset, field) {
  if (!asset) return "—";
  switch (field) {
    case "name":
      return asset.name || "Untitled";
    case "type":
      return asset.type || "—";
    case "format":
      return asset.format || "—";
    case "size":
      return formatBytes(asset.sizeBytes);
    case "status":
      return asset.status || "—";
    default:
      return "—";
  }
}

function fieldLabel(field) {
  return CAPTION_FIELDS.find((f) => f.value === field)?.label || field;
}

function SheetCell({ asset, fields }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-border bg-surface-card">
      <div
        className="flex h-16 items-center justify-center"
        style={asset?.color ? { backgroundColor: `${asset.color}22` } : undefined}
      >
        <FileImage className="h-5 w-5 text-text-tertiary" />
      </div>
      <div className="space-y-0.5 px-1.5 py-1">
        {fields.map((field) => (
          <p
            key={field}
            className="truncate text-[10px] leading-tight text-text-secondary"
          >
            {captionValue(asset, field)}
          </p>
        ))}
      </div>
    </div>
  );
}

function exportHtml(layout, collectionName, assets) {
  const cells = assets
    .map(({ asset }) => {
      const captions = layout.fields
        .map((f) => `<div>${fieldLabel(f)}: ${captionValue(asset, f)}</div>`)
        .join("");
      const swatch = asset?.color
        ? `<div style="height:120px;background:${asset.color}22"></div>`
        : `<div style="height:120px;background:#eee"></div>`;
      return `<div style="border:1px solid #ccc;border-radius:4px;overflow:hidden">${swatch}<div style="padding:4px 6px;font-size:10px">${captions}</div></div>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${layout.name}</title></head><body style="font-family:sans-serif;margin:24px"><h1>${layout.name}</h1><p>${collectionName} · ${layout.pageSize}</p>${layout.header ? `<p>${layout.header}</p>` : ""}<div style="display:grid;grid-template-columns:repeat(${layout.columns},1fr);gap:8px">${cells}</div>${layout.footer ? `<p>${layout.footer}</p>` : ""}</body></html>`;
}

function LayoutDialog({ open, onOpenChange, draft, onDraftChange, onSave, collections }) {
  const set = (key) => (value) => onDraftChange({ ...draft, [key]: value });
  const toggleField = (field) => {
    const next = new Set(draft.fields || []);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    onDraftChange({ ...draft, fields: CAPTION_FIELDS.map((f) => f.value).filter((v) => next.has(v)) });
  };
  const collectionOptions = collections.map((c) => ({ value: c.id, label: c.name || "Untitled" }));
  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={draft.id ? "Edit layout" : "New layout"}
      description="Caption fields print under each thumbnail."
      submitLabel={draft.id ? "Save changes" : "Create layout"}
      onSubmit={() => {
        if (!draft.name.trim()) {
          toast.error("Give the layout a name first.");
          return;
        }
        if (!draft.sourceCollection) {
          toast.error("Choose a source collection first.");
          return;
        }
        if (!(draft.fields || []).length) {
          toast.error("Print at least one caption field.");
          return;
        }
        onSave();
      }}
      size="lg"
    >
      <TextField
        label="Layout name"
        value={draft.name}
        onChange={set("name")}
        placeholder="e.g. Shoot selects"
      />
      <SelectField
        label="Source collection"
        value={draft.sourceCollection}
        onChange={set("sourceCollection")}
        options={collectionOptions}
        placeholder={collections.length ? "Choose a collection" : "No collections yet"}
      />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium text-muted-foreground">Columns</Label>
          <Input
            type="number"
            value={draft.columns}
            min={1}
            max={8}
            onChange={(e) => onDraftChange({ ...draft, columns: Number(e.target.value) || 1 })}
            aria-label="Columns"
            className="h-10 border-border bg-surface-card text-foreground"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-sm font-medium text-muted-foreground">Rows</Label>
          <Input
            type="number"
            value={draft.rows}
            min={1}
            max={10}
            onChange={(e) => onDraftChange({ ...draft, rows: Number(e.target.value) || 1 })}
            aria-label="Rows"
            className="h-10 border-border bg-surface-card text-foreground"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Caption fields</Label>
        <div className="flex flex-wrap gap-2">
          {CAPTION_FIELDS.map((f) => {
            const on = (draft.fields || []).includes(f.value);
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => toggleField(f.value)}
                aria-pressed={on}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                  on
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border bg-surface-card text-text-secondary hover:bg-surface-hover",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
      <TextField label="Header text" value={draft.header} onChange={set("header")} placeholder="Optional header" />
      <TextField label="Footer text" value={draft.footer} onChange={set("footer")} placeholder="Optional footer" />
      <SelectField
        label="Page size"
        value={draft.pageSize}
        onChange={set("pageSize")}
        options={PAGE_SIZE_OPTIONS}
      />
    </CreateDialog>
  );
}

// Keyed by layout id by the parent, so switching layouts remounts fresh —
// loading starts true and assets empty with no reset effect.
function LayoutPreview({ layout, collectionName }) {
  const perPage = Math.max(
    1,
    Math.min(
      80,
      (Number(layout?.columns) || 1) * (Number(layout?.rows) || 1),
    ),
  );
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listCollectionAssets(layout?.sourceCollection).then((rows) => {
      if (!alive) return;
      setAssets((rows ?? []).slice(0, perPage));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout?.sourceCollection]);

  const handleExport = () => {
    if (!layout) return;
    const html = exportHtml(layout, collectionName, assets);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${layout.name || "contact-sheet"}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Layout "${layout.name}" exported.`);
  };

  return (
    <SectionCard
      title="Preview"
      description={layout ? `${collectionName} · ${layout.pageSize}` : undefined}
      action={
        layout ? (
          <Button
            variant="outline"
            onClick={handleExport}
            className="border-border bg-surface-card text-foreground hover:bg-surface-hover"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        ) : undefined
      }
    >
      {!layout ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-text-tertiary">
          Select a layout to preview it.
        </p>
      ) : loading ? (
        <LoadingArea size={40} label="Loading preview" />
      ) : (
        <div className="space-y-2">
          {layout.header ? (
            <p className="text-sm font-medium text-foreground">{layout.header}</p>
          ) : null}
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}
          >
            {assets.length === 0 ? (
              <p className="col-span-full rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-text-tertiary">
                No assets in this collection yet — cells preview the
                caption layout.
              </p>
            ) : null}
            {(assets.length
              ? assets
              : Array.from({ length: Math.min(8, perPage) }).map((_, i) => ({
                  asset: null,
                  id: `empty-${i}`,
                }))
            ).map(({ asset, id }) => (
              <SheetCell
                key={asset?.id || id}
                asset={asset}
                fields={layout.fields}
              />
            ))}
          </div>
          {layout.footer ? (
            <p className="text-xs text-text-secondary">{layout.footer}</p>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}

export function ContactSheetsScreen({ projectId }) {  const { settings, loading: settingsLoading, patchSection } =
    useProjectSettings(projectId);
  const layouts = useMemo(
    () => (Array.isArray(settings.contactSheets) ? settings.contactSheets : []),
    [settings.contactSheets],
  );
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_LAYOUT_DRAFT);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let alive = true;
    listCollections(projectId).then((rows) => {
      if (!alive) return;
      setCollections(rows ?? []);
      setCollectionsLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const selected =
    layouts.find((l) => l.id === selectedId) || layouts[0] || null;

  const collectionName = useMemo(() => {
    if (!selected) return "";
    return (
      collections.find((c) => c.id === selected.sourceCollection)?.name ||
      "Unknown collection"
    );
  }, [collections, selected]);

  const persist = async (next, notice) => {
    const saved = await patchSection("contactSheets", next);
    if (saved && notice) toast.success(notice);
    return Boolean(saved);
  };

  const openAdd = () => {
    setDraft(EMPTY_LAYOUT_DRAFT);
    setDialogOpen(true);
  };

  const openEdit = (layout) => {
    setDraft({ ...EMPTY_LAYOUT_DRAFT, ...layout });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const entry = {
      id: draft.id || crypto.randomUUID(),
      name: draft.name.trim(),
      sourceCollection: draft.sourceCollection,
      columns: Math.min(8, Math.max(1, Number(draft.columns) || 1)),
      rows: Math.min(10, Math.max(1, Number(draft.rows) || 1)),
      fields: draft.fields,
      header: draft.header,
      footer: draft.footer,
      pageSize: draft.pageSize,
    };
    const next = draft.id
      ? layouts.map((l) => (l.id === draft.id ? entry : l))
      : [...layouts, entry];
    setDialogOpen(false);
    if (await persist(next, draft.id ? "Layout saved." : `Layout "${entry.name}" created.`)) {
      setSelectedId(entry.id);
    }
  };

  const handleDuplicate = async (layout) => {
    const copy = {
      ...layout,
      id: crypto.randomUUID(),
      name: `${layout.name} copy`,
    };
    if (await persist([...layouts, copy], `Layout "${copy.name}" created.`)) {
      setSelectedId(copy.id);
    }
  };

  const handleDelete = (layout) =>
    persist(
      layouts.filter((l) => l.id !== layout.id),
      `Layout "${layout.name}" deleted.`,
    );

  const columns = [
    {
      key: "name",
      header: "Layout",
      render: (l) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{l.name}</p>
          <p className="truncate text-[11px] text-text-tertiary">
            {collections.find((c) => c.id === l.sourceCollection)?.name || "Unknown collection"}
          </p>
        </div>
      ),
    },
    {
      key: "grid",
      header: "Grid",
      className: "hidden sm:table-cell font-mono text-xs tabular-nums text-text-secondary",
      headClassName: "hidden sm:table-cell",
      render: (l) => `${l.columns}×${l.rows}`,
    },
    {
      key: "page",
      header: "Page",
      className: "hidden md:table-cell text-xs text-text-secondary",
      headClassName: "hidden md:table-cell",
      render: (l) => l.pageSize,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (l) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            onEdit={() => openEdit(l)}
            onDelete={() => handleDelete(l)}
            deleteLabel="Delete"
            extra={[
              {
                icon: CopyPlus,
                label: "Duplicate",
                onSelect: () => handleDuplicate(l),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  if (settingsLoading || collectionsLoading) {
    return (
      <SecondaryScreenWrapper>
        <ScreenHeader
          title="Contact Sheets"
          description="Printable review sheets for collections."
        />
        <LoadingArea size={56} label="Loading contact sheets" />
      </SecondaryScreenWrapper>
    );
  }

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Contact Sheets"
        description="Printable review sheets for collections."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openAdd}
          >
            <LayoutGrid className="h-4 w-4" />
            New layout
          </Button>
        }
      />

      {layouts.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={LayoutGrid}
            title="No layouts yet"
            description="Save a grid layout against a collection."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={openAdd}
              >
                <LayoutGrid className="h-4 w-4" />
                New layout
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <DataTable
            columns={columns}
            data={layouts}
            getRowKey={(l) => l.id}
            onRowClick={(l) => setSelectedId(l.id)}
          />
          <LayoutPreview
            key={selected?.id || "none"}
            layout={selected}
            collectionName={collectionName}
          />
        </div>
      )}

      <LayoutDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={draft}
        onDraftChange={setDraft}
        onSave={handleSave}
        collections={collections}
      />
    </SecondaryScreenWrapper>
  );
}

export default ContactSheetsScreen;
