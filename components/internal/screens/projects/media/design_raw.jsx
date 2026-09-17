"use client";

import { Button, LogoLoading } from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link2, PenTool, Trash2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import { AssetPreview } from "@/components/internal/shared/asset_preview";
import { createRelationship, deleteRelationship, listAssets, listRelationships } from "@/lib/supabase/assets";
import { createMediaAnnotation, listMediaAnnotations, softDeleteMediaAnnotation } from "@/lib/supabase/media_screens";
import {
  DESIGN_KIND_FILTER_OPTIONS,
  MEDIA_ASSET_STATUS_FILTER_OPTIONS,
  MEDIA_ASSET_STATUS_MAP,
  designKindOf,
  formatBytes,
  formatDate,
  isDesignAsset,
} from "./constants";

export function DesignRawScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [references, setReferences] = useState([]);
  const [relations, setRelations] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [refUrl, setRefUrl] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listAssets(projectId), listMediaAnnotations(projectId)]).then(([rows, notes]) => {
      if (!alive) return;
      setAssets(rows ?? []);
      setReferences((notes ?? []).filter((n) => n.kind === "reference"));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const designFiles = useMemo(() => assets.filter(isDesignAsset), [assets]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return designFiles.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (kindFilter !== "all" && designKindOf(a) !== kindFilter) return false;
      if (needle && !`${a.name} ${a.format} ${(a.tags || []).join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [designFiles, search, statusFilter, kindFilter]);

  const selected = useMemo(
    () => filtered.find((a) => a.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    if (relations[selected.id]) return;
    listRelationships(selected.id).then((rows) => {
      if (!rows) return;
      setRelations((prev) => ({ ...prev, [selected.id]: rows }));
    });
  }, [selected, relations]);

  const selectedRefs = useMemo(
    () => references.filter((r) => r.assetId === selected?.id),
    [references, selected],
  );

  const selectedRelations = useMemo(() => relations[selected?.id] || [], [relations, selected]);

  const stats = useMemo(() => {
    const kinds = designFiles.map(designKindOf);
    return [
      { label: "Design & RAW", value: String(designFiles.length), footer: "sources in scope" },
      { label: "Design files", value: String(kinds.filter((k) => k === "design").length), footer: "PSD / AI / Figma" },
      { label: "Camera RAW", value: String(kinds.filter((k) => k === "raw").length), footer: "unprocessed captures" },
      { label: "Fonts", value: String(kinds.filter((k) => k === "font").length), footer: "typefaces" },
    ];
  }, [designFiles]);

  const filtersActive = search.trim() !== "" || statusFilter !== "all" || kindFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setKindFilter("all");
  };

  const handleAddReference = async () => {
    if (!selected || !refUrl.trim()) {
      toast.error("Paste a Figma or Sketch URL first.");
      return;
    }
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, assetId: selected.id, kind: "reference", label: refUrl.trim().slice(0, 120), body: refUrl.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setReferences((prev) => [optimistic, ...prev]);
    setRefUrl("");
    const created = await createMediaAnnotation({ id, projectId, assetId: selected.id, kind: "reference", label: optimistic.label, body: optimistic.body });
    if (created) {
      setReferences((prev) => prev.map((r) => (r.id === id ? created : r)));
      toast.success("Reference linked.");
    } else {
      setReferences((prev) => prev.filter((r) => r.id !== id));
      toast.error("Couldn't save the reference.");
    }
  };

  const handleRemoveReference = async (ref) => {
    const prev = references;
    setReferences((rows) => rows.filter((r) => r.id !== ref.id));
    const ok = await softDeleteMediaAnnotation(ref.id);
    if (!ok) {
      setReferences(prev);
      toast.error("Couldn't remove the reference.");
    } else {
      toast.success("Reference removed.");
    }
  };

  const handleLinkExport = async () => {
    if (!selected) return;
    const exportCandidate = assets.find((a) => a.id !== selected.id && a.type === "image");
    if (!exportCandidate) {
      toast.error("No export candidate in this project yet.");
      return;
    }
    const created = await createRelationship({ assetId: selected.id, relatedAssetId: exportCandidate.id, relationType: "derived", label: "" });
    if (created) {
      setRelations((prev) => ({ ...prev, [selected.id]: [...(prev[selected.id] || []), created] }));
      toast.success(`Linked export ${exportCandidate.name}.`);
    } else {
      toast.error("Couldn't link the export.");
    }
  };

  const handleUnlinkExport = async (relId) => {
    if (!selected) return;
    const prev = relations[selected.id] || [];
    setRelations((all) => ({ ...all, [selected.id]: prev.filter((r) => r.id !== relId) }));
    const ok = await deleteRelationship(relId);
    if (!ok) {
      setRelations((all) => ({ ...all, [selected.id]: prev }));
      toast.error("Couldn't remove the link.");
    } else {
      toast.success("Export unlinked.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Source file",
      render: (a) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">{a.name}</span>
          <span className="truncate text-xs capitalize text-text-secondary">{a.format || a.type} · {designKindOf(a)} · {formatBytes(a.sizeBytes)}</span>
        </div>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      className: "hidden text-xs capitalize text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => designKindOf(a),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusPill status={a.status} map={MEDIA_ASSET_STATUS_MAP} />,
    },
    {
      key: "modified",
      header: "Modified",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (a) => formatDate(a.updatedAt),
    },
  ];

  const isFont = selected && designKindOf(selected) === "font";

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Design & Raw Files"
        description="PSD and AI sources, Figma and Sketch references, camera RAW captures, font previews, and source-to-export links."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleLinkExport} disabled={!selected}>
            <Link2 className="h-4 w-4" /> Link export
          </Button>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={kindFilter} onValueChange={setKindFilter} options={DESIGN_KIND_FILTER_OPTIONS} height="h-9" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={MEDIA_ASSET_STATUS_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search sources, formats, tags…" />
      </Toolbar>
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading design files" />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(a) => a.id}
            onRowClick={(a) => setSelectedId(a.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                {designFiles.length === 0 ? (
                  <EmptyState icon={PenTool} title="No design sources yet" description="Design files, RAW captures, and fonts land here once uploaded." />
                ) : (
                  <EmptyState icon={PenTool} title="No sources match these filters" description="Try a different kind, status, or search term." action={<Button variant="outline" className="border-border bg-surface-card text-foreground hover:bg-surface-active" onClick={clearFilters}>Clear filters</Button>} />
                )}
              </div>
            }
          />
          {selected ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Preview" description={`${selected.format || selected.type} source — vectors and binaries show a placeholder when not renderable.`}>
                {isFont ? (
                  <div className="rounded-xl border border-border bg-surface-card p-6 text-center">
                    <p className="text-4xl font-bold text-foreground">Aa</p>
                    <p className="mt-2 text-sm text-text-secondary">{selected.name}</p>
                    <p className="mt-1 text-[11px] text-text-tertiary">Generic preview — the file is not installed as a webfont here.</p>
                  </div>
                ) : (
                  <AssetPreview asset={selected} />
                )}
              </SectionCard>
              <SectionCard title="References & exports" description="Figma / Sketch links plus linked export assets.">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={refUrl} onChange={(e) => setRefUrl(e.target.value)} placeholder="https://figma.com/… or sketch link" className="h-9 flex-1 rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground outline-none placeholder:text-text-tertiary" />
                  <Button size="sm" className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={handleAddReference}>
                    <Link2 className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
                <ul className="mt-3 space-y-2">
                  {selectedRefs.length === 0 ? (
                    <li className="text-xs text-text-tertiary">No external references — paste one above.</li>
                  ) : (
                    selectedRefs.map((ref) => (
                      <li key={ref.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-foreground">{ref.body || ref.label}</span>
                        <Button variant="ghost" size="icon-sm" aria-label="Remove reference" className="h-6 w-6 text-text-tertiary hover:bg-red-500/10 hover:text-red-400" onClick={() => handleRemoveReference(ref)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">Source-to-export ({selectedRelations.length})</p>
                  {selectedRelations.length === 0 ? (
                    <p className="mt-2 text-xs text-text-tertiary">No exports linked — use “Link export” to attach the nearest image.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {selectedRelations.map((rel) => (
                        <li key={rel.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs">
                          <span className="min-w-0 flex-1 truncate text-foreground">{rel.related?.name || rel.label || "Linked asset"}</span>
                          <Button variant="ghost" size="icon-sm" aria-label="Unlink export" className="h-6 w-6 text-text-tertiary hover:bg-red-500/10 hover:text-red-400" onClick={() => handleUnlinkExport(rel.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </SectionCard>
            </div>
          ) : null}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default DesignRawScreen;
