"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Image as ImageIcon, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  CreateDialog,
  FieldRow,
  FilterDropdown,
  RowActions,
  SelectField,
  TextField,
  useModuleRows,
} from "@/components/internal/shared/module_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";

import {
  DYNAMIC_STATUS_FILTER_OPTIONS,
  DYNAMIC_STATUS_MAP,
  FIT_OPTIONS,
  FORMAT_OPTIONS,
  dynamicUrl,
  formatDate,
} from "./constants";
import {
  createDynamicLink,
  listDynamicLinks,
  mintLinkToken,
  softDeleteDynamicLink,
  updateDynamicLink,
} from "@/lib/supabase/dynamic_links";
import { listAssets } from "@/lib/supabase/assets";
import { getUser } from "@/lib/supabase/user";

const EMPTY_DRAFT = { name: "", assetId: "", status: "active" };
const EMPTY_TRANSFORM = { w: 1200, h: "", fit: "cover", format: "auto", quality: 80, dpr: 1, breakpoints: [480, 768, 1200] };

function normalizeBreakpoints(value) {
  return String(value || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 8);
}

function LinkDialog({ open, onOpenChange, onSubmit, assets, initial }) {
  const [draft, setDraft] = useState(initial || EMPTY_DRAFT);
  const [seed, setSeed] = useState(initial);
  if (initial !== seed) {
    setSeed(initial);
    setDraft(initial || EMPTY_DRAFT);
  }
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const editing = Boolean(initial?.id);

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the link a name.");
      return;
    }
    if (!draft.assetId) {
      toast.error("Pick the image this link serves.");
      return;
    }
    onSubmit(draft);
    setDraft(EMPTY_DRAFT);
    onOpenChange(false);
  };

  const assetOptions = (assets || []).map((a) => ({ value: a.id, label: a.name }));

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit dynamic link" : "New dynamic link"}
      description="A stable token — the transform and the target can change without the URL changing."
      submitLabel={editing ? "Save changes" : "Create link"}
      onSubmit={submit}
    >
      <TextField label="Name" value={draft.name} onChange={set("name")} placeholder="e.g. Hero — homepage" />
      <SelectField label="Image" value={draft.assetId} onChange={set("assetId")} options={assetOptions} placeholder="Select an image…" />
      <SelectField
        label="Status"
        value={draft.status}
        onChange={set("status")}
        options={[
          { value: "active", label: "Active" },
          { value: "paused", label: "Paused" },
        ]}
      />
    </CreateDialog>
  );
}

function TransformPanel({ link, assets, onSave, saving }) {
  const asset = assets.find((a) => a.id === link.assetId) || null;
  const t = { ...EMPTY_TRANSFORM, ...(link.transform || {}) };
  const [w, setW] = useState(String(t.w ?? ""));
  const [h, setH] = useState(String(t.h ?? ""));
  const [fit, setFit] = useState(t.fit || "cover");
  const [format, setFormat] = useState(t.format || "auto");
  const [quality, setQuality] = useState(String(t.quality ?? 80));
  const [dpr, setDpr] = useState(String(t.dpr ?? 1));
  const [breakpoints, setBreakpoints] = useState((t.breakpoints || []).join(", "));
  const [signed, setSigned] = useState(!!link.signed);
  const [seedId, setSeedId] = useState(link.id);

  if (link.id !== seedId) {
    setSeedId(link.id);
    setW(String(t.w ?? ""));
    setH(String(t.h ?? ""));
    setFit(t.fit || "cover");
    setFormat(t.format || "auto");
    setQuality(String(t.quality ?? 80));
    setDpr(String(t.dpr ?? 1));
    setBreakpoints((t.breakpoints || []).join(", "));
    setSigned(!!link.signed);
  }

  const transform = {
    w: w === "" ? "" : Number(w) || "",
    h: h === "" ? "" : Number(h) || "",
    fit,
    format,
    quality: Number(quality) || 80,
    dpr: Number(dpr) || 1,
    breakpoints: normalizeBreakpoints(breakpoints),
  };
  const url = dynamicUrl(link.token, transform);
  const srcset = (transform.breakpoints || [])
    .map((b) => `${dynamicUrl(link.token, { ...transform, w: b })} ${b}w`)
    .join(",\n");

  const save = () => onSave(link.id, { transform, signed });

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-black/40">
        {asset?.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnailUrl}
            alt={asset.name}
            className="max-h-56 w-full object-contain"
            style={w ? { aspectRatio: `${w} / ${h || Math.round((Number(w) || 3) * 0.66)}` } : undefined}
          />
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-text-tertiary">
            <ImageIcon className="h-8 w-8" />
            <p className="text-xs">No preview — the target asset has no file yet.</p>
          </div>
        )}
      </div>

      <FieldRow>
        <Field label="Width (px)">
          <Input value={w} onChange={(e) => setW(e.target.value)} inputMode="numeric" placeholder="1200" className="bg-surface-card" />
        </Field>
        <Field label="Height (px)" hint="Empty keeps aspect.">
          <Input value={h} onChange={(e) => setH(e.target.value)} inputMode="numeric" placeholder="Auto" className="bg-surface-card" />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Fit">
          <Select value={fit} onValueChange={setFit}>
            <SelectTrigger className="bg-surface-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Format">
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="bg-surface-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label={`Quality (${quality})`}>
          <Input type="range" min="1" max="100" value={quality} onChange={(e) => setQuality(e.target.value)} className="h-10" />
        </Field>
        <Field label="Device pixel ratio">
          <Select value={dpr} onValueChange={setDpr}>
            <SelectTrigger className="bg-surface-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["1", "2", "3"].map((v) => (
                <SelectItem key={v} value={v}>{v}x</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldRow>
      <Field label="Breakpoints" hint="Comma-separated widths for the responsive set.">
        <Input value={breakpoints} onChange={(e) => setBreakpoints(e.target.value)} placeholder="480, 768, 1200" className="bg-surface-card" />
      </Field>
      <label className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-card px-3 py-2.5 text-sm">
        <span className="text-foreground">Signed URL</span>
        <Switch checked={signed} onCheckedChange={setSigned} />
      </label>

      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground">Live URL</p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-black/40 p-3 font-mono text-[11px] leading-5 text-text-secondary">{url}</pre>
        <div className="mt-2 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => {
              navigator.clipboard?.writeText(url);
              toast.success("Dynamic URL copied.");
            }}
          >
            <Copy className="h-3.5 w-3.5" /> Copy URL
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => {
              navigator.clipboard?.writeText(`<img src="${url}" srcset="${srcset}" alt="${asset?.name || link.name}" loading="lazy" />`);
              toast.success("Responsive snippet copied.");
            }}
          >
            <Copy className="h-3.5 w-3.5" /> Copy srcset
          </Button>
        </div>
      </div>

      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save transform
      </Button>
    </div>
  );
}

export function DynamicImagesScreen({ projectId }) {
  const [links, setLinks] = useModuleRows(listDynamicLinks, projectId);
  const [assets] = useModuleRows(listAssets, projectId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [repointId, setRepointId] = useState("");

  const loading = links === null;
  const rows = useMemo(() => links ?? [], [links]);
  const assetRows = useMemo(() => assets ?? [], [assets]);

  const assetName = useMemo(() => {
    const map = new Map(assetRows.map((a) => [a.id, a.name]));
    return (id) => map.get(id) || "Unknown asset";
  }, [assetRows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (term && !`${l.name} ${l.token} ${assetName(l.assetId)}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, search, status, assetName]);

  const selected = useMemo(
    () => rows.find((l) => l.id === (selectedId || filtered[0]?.id)) || null,
    [rows, selectedId, filtered],
  );

  const stats = useMemo(() => {
    const active = rows.filter((l) => l.status === "active").length;
    const signed = rows.filter((l) => l.signed).length;
    const targets = new Set(rows.map((l) => l.assetId).filter(Boolean)).size;
    return [
      { label: "Dynamic links", value: String(rows.length), footer: "Stable tokens" },
      { label: "Active", value: String(active), footer: "Serving transforms" },
      { label: "Signed", value: String(signed), footer: "Expiring signatures" },
      { label: "Targets", value: String(targets), footer: "Linked assets" },
    ];
  }, [rows]);

  const handleCreate = async (draft) => {
    const id = crypto.randomUUID();
    const user = await getUser();
    const payload = {
      id,
      projectId,
      name: draft.name.trim(),
      token: mintLinkToken(),
      assetId: draft.assetId,
      transform: { ...EMPTY_TRANSFORM },
      signed: false,
      status: draft.status || "active",
      createdBy: user?.id || null,
    };
    setLinks((prev) => [payload, ...prev]);
    const saved = await createDynamicLink(payload);
    if (saved) {
      setLinks((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
      setSelectedId(saved.id);
      toast.success(`"${payload.name}" is live.`);
    } else {
      setLinks((prev) => prev.filter((l) => l.id !== id));
      toast.error("Couldn't create the dynamic link.");
    }
  };

  const handleEdit = async (draft) => {
    const id = editing?.id;
    if (!id) return;
    const previous = rows.find((l) => l.id === id);
    const patch = { name: draft.name.trim(), assetId: draft.assetId, status: draft.status };
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setEditing(null);
    const saved = await updateDynamicLink(id, patch);
    if (saved) {
      setLinks((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
      toast.success("Link updated.");
    } else {
      if (previous) setLinks((prev) => prev.map((l) => (l.id === id ? previous : l)));
      toast.error("Couldn't save your changes.");
    }
  };

  const handleSaveTransform = async (id, patch) => {
    const previous = rows.find((l) => l.id === id);
    setSaving(true);
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const saved = await updateDynamicLink(id, patch);
    setSaving(false);
    if (saved) {
      setLinks((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
      toast.success("Transform saved — the URL is unchanged.");
    } else {
      if (previous) setLinks((prev) => prev.map((l) => (l.id === id ? previous : l)));
      toast.error("Couldn't save the transform.");
    }
  };

  /** Re-point the token at another asset — the URL stays exactly the same. */
  const handleRepoint = async () => {
    if (!selected || !repointId) {
      toast.error("Pick an asset to re-point to.");
      return;
    }
    const previous = selected.assetId;
    setLinks((prev) => prev.map((l) => (l.id === selected.id ? { ...l, assetId: repointId } : l)));
    setRepointId("");
    const saved = await updateDynamicLink(selected.id, { assetId: repointId });
    if (saved) {
      setLinks((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
      toast.success("Re-pointed — the URL didn't change.");
    } else {
      setLinks((prev) => prev.map((l) => (l.id === selected.id ? { ...l, assetId: previous } : l)));
      toast.error("Couldn't re-point the link.");
    }
  };

  const handleDuplicate = async (link) => {
    const id = crypto.randomUUID();
    const payload = {
      id,
      projectId,
      name: `${link.name} (copy)`,
      token: mintLinkToken(),
      assetId: link.assetId,
      transform: link.transform,
      signed: link.signed,
      status: "active",
    };
    setLinks((prev) => [payload, ...prev]);
    const saved = await createDynamicLink(payload);
    if (saved) {
      setLinks((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
      toast.success("Link duplicated with a fresh token.");
    } else {
      setLinks((prev) => prev.filter((l) => l.id !== id));
      toast.error("Couldn't duplicate the link.");
    }
  };

  const handleDelete = async (link) => {
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
    if (selectedId === link.id) setSelectedId(null);
    const ok = await softDeleteDynamicLink(link.id);
    if (ok) toast.success(`Deleted "${link.name}".`);
    else {
      setLinks((prev) => [link, ...prev]);
      toast.error("Couldn't delete the link.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Link",
      render: (l) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{l.name}</span>
          <span className="font-mono text-[11px] text-text-tertiary">/dyn/{l.token}</span>
        </div>
      ),
    },
    {
      key: "target",
      header: "Target",
      className: "max-w-[180px] truncate text-xs text-text-secondary",
      render: (l) => assetName(l.assetId),
    },
    {
      key: "transform",
      header: "Transform",
      render: (l) => {
        const t = l.transform || {};
        const label = [t.w ? `${t.w}w` : "", t.h ? `×${t.h}` : "", t.format && t.format !== "auto" ? t.format : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <Badge className="border border-border bg-surface-card px-1.5 py-0 text-[10px] text-text-secondary">
            {label || "Original"}
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (l) => <StatusPill status={l.status} map={DYNAMIC_STATUS_MAP} className="text-[10px]" />,
    },
    {
      key: "updated",
      header: "Updated",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (l) => formatDate(l.updatedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (l) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            onEdit={() => {
              setEditing({ id: l.id, name: l.name, assetId: l.assetId || "", status: l.status });
              setDialogOpen(true);
            }}
            onDelete={() => handleDelete(l)}
            extra={[
              { icon: Copy, label: "Copy URL", onSelect: () => {
                navigator.clipboard?.writeText(dynamicUrl(l.token, l.transform || {}));
                toast.success("Dynamic URL copied.");
              } },
              { icon: Plus, label: "Duplicate", onSelect: () => handleDuplicate(l) },
              { separator: true },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Dynamic Images"
        description="Transform images at delivery time — resize, crop, format, and quality from the URL."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New link
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <FilterDropdown value={status} onValueChange={setStatus} options={DYNAMIC_STATUS_FILTER_OPTIONS} height="h-9" />
        <SearchInput value={search} onChange={setSearch} placeholder="Search links…" />
      </Toolbar>

      {loading ? (
        <LoadingArea panel size={56} label="Loading dynamic links…" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={ImageIcon}
            title="No dynamic links yet"
            description="Create a stable token for an image, then tune its transform without ever changing the URL."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> New link
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)]">
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(l) => l.id}
            onRowClick={(l) => setSelectedId(l.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={ImageIcon}
                  title="No links match your filters"
                  description="Try clearing the search or status filter."
                />
              </div>
            }
          />
          {selected ? (
            <SectionCard
              title={selected.name}
              description={`Target: ${assetName(selected.assetId)} · /dyn/${selected.token}`}
              action={<Pencil className="h-4 w-4 text-text-tertiary" />}
            >
              <TransformPanel link={selected} assets={assetRows} onSave={handleSaveTransform} saving={saving} />
              <div className="mt-4 border-t border-border pt-4">
                <Field label="Re-point target" hint="Swap the image — the URL stays exactly the same.">
                  <div className="flex gap-2">
                    <Select value={repointId} onValueChange={setRepointId}>
                      <SelectTrigger className="bg-surface-card">
                        <SelectValue placeholder="Pick another asset…" />
                      </SelectTrigger>
                      <SelectContent>
                        {assetRows.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      className="shrink-0 border-border bg-transparent"
                      onClick={handleRepoint}
                      disabled={!repointId}
                    >
                      Re-point
                    </Button>
                  </div>
                </Field>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  onClick={() => handleDelete(selected)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete link
                </Button>
              </div>
            </SectionCard>
          ) : null}
        </div>
      )}

      <LinkDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        onSubmit={editing ? handleEdit : handleCreate}
        assets={assetRows}
        initial={editing}
      />
    </MainScreenWrapper>
  );
}

export default DynamicImagesScreen;
