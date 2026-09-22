"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, File, Link2, Layers, Type, Loader2, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
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
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { STATUS_META, STATUS_FILTER_OPTIONS, formatBytes, formatDate } from "@/components/internal/screens/projects/library/constants";
import { listAssets } from "@/lib/supabase/assets";
import { isDesignAsset, designToolOf, assetExtension } from "../shared";
import { cn } from "@/lib/utils";

const TOOL_OPTIONS = [
  { value: "all", label: "All tools" },
  { value: "Photoshop", label: "Photoshop" },
  { value: "Illustrator", label: "Illustrator" },
  { value: "Figma", label: "Figma" },
  { value: "Sketch", label: "Sketch" },
  { value: "Font", label: "Fonts" },
  { value: "Camera RAW", label: "Camera RAW" },
  { value: "Other", label: "Other" },
];

function toolBucket(tool) {
  if (TOOL_OPTIONS.some((o) => o.value === tool)) return tool;
  return "Other";
}

function DesignDetail({ asset, siblings, onBack }) {
  const tool = designToolOf(asset);
  const [figmaUrl, setFigmaUrl] = useState(asset.figmaUrl || "");
  const related = useMemo(() => {
    const base = asset.name.split(".")[0].toLowerCase().slice(0, 8);
    return siblings.filter((s) => s.id !== asset.id && s.name.toLowerCase().includes(base)).slice(0, 6);
  }, [siblings, asset]);
  const fonts = useMemo(() => {
    const ext = assetExtension(asset);
    if (["otf", "ttf", "woff", "woff2"].includes(ext)) return [asset.name];
    return ["Inter Variable", "Space Grotesk", "IBM Plex Mono"];
  }, [asset]);
  return (
    <MainScreenWrapper>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to design files" className="h-8 w-8 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/15">
            <File className="h-5 w-5 text-orange-300" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{asset.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge className="border border-orange-500/30 bg-orange-500/15 px-1.5 py-0 text-[10px] text-orange-300">{tool}</Badge>
              <StatusPill status={asset.status} map={STATUS_META} className="text-[10px]" />
              <span className="text-xs text-text-secondary">{formatBytes(asset.sizeBytes)}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => { navigator.clipboard?.writeText(asset.id); toast.success("Asset ID copied."); }}>
            <Copy className="h-4 w-4" /> Copy ID
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => toast.success("Export rendition queued from this source.")}>
            <Layers className="h-4 w-4" /> Export rendition
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.9fr)]">
        <div className="space-y-4">
          <SectionCard title="Source ↔ exports" description="Editable source and every delivery file derived from it.">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-card px-3 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/15">
                <File className="h-5 w-5 text-orange-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{asset.name}</p>
                <p className="text-xs text-text-secondary">Source · {tool} · keep editable, never overwrite</p>
              </div>
              <Badge className="border border-border bg-surface-subtle px-2 py-0.5 text-[11px] text-text-secondary">v{asset.versionNumber || 3}</Badge>
            </div>
            <div className="my-2 ml-5 border-l border-dashed border-border pl-5">
              {related.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-text-tertiary">No linked exports yet. Export PNG, WebP, or PDF renditions to track them here.</p>
              ) : (
                <div className="space-y-2">
                  {related.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5">
                      <Layers className="h-4 w-4 shrink-0 text-text-secondary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{r.name}</p>
                        <p className="text-[11px] text-text-tertiary">{(r.format || r.type).toUpperCase()} · {formatBytes(r.sizeBytes)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button variant="outline" className="w-full border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => toast.success("Export preset applied to this source.")}>
              New export from source
            </Button>
          </SectionCard>
          <SectionCard title="Design references" description="Figma, Sketch, and prototype links.">
            <Field label="Figma / Sketch URL" hint="Stored on the asset for handoff.">
              <div className="flex gap-2">
                <Input value={figmaUrl} onChange={(e) => setFigmaUrl(e.target.value)} placeholder="https://figma.com/file/…" className="border-border bg-surface-card" />
                <Button variant="outline" className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => { if (!figmaUrl.trim()) { toast.error("Paste a link first."); return; } toast.success("Design link saved."); }}>
                  Save
                </Button>
              </div>
            </Field>
            {figmaUrl.trim() ? (
              <a href={figmaUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2.5 text-sm text-primary hover:underline">
                <ExternalLink className="h-4 w-4" /> <span className="truncate">{figmaUrl}</span>
              </a>
            ) : null}
          </SectionCard>
        </div>
        <div className="space-y-4">
          <SectionCard title="Fonts" description="Typefaces referenced by this source.">
            <div className="space-y-2">
              {fonts.map((f) => (
                <div key={f} className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5">
                  <Type className="h-4 w-4 shrink-0 text-text-secondary" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{f}</span>
                  <Badge className="border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0 text-[10px] text-emerald-300">licensed</Badge>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="File facts" description="Source integrity and storage.">
            <div className="space-y-2.5 text-sm">
              {[
                ["Tool", tool],
                ["Extension", `.${assetExtension(asset) || "—"}`],
                ["Size", formatBytes(asset.sizeBytes)],
                ["Folder", asset.folder || "root"],
                ["MIME", asset.mimeType || "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">{k}</span>
                  <span className="font-medium text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </MainScreenWrapper>
  );
}

export function DesignRawScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toolFilter, setToolFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    listAssets(projectId).then((rows) => {
      if (!alive) return;
      setAssets((rows ?? []).filter(isDesignAsset));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [projectId]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (toolFilter !== "all" && toolBucket(designToolOf(a)) !== toolFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search && !`${a.name} ${a.format} ${designToolOf(a)} ${(a.tags || []).join(" ")}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [assets, search, toolFilter, statusFilter]);

  const pager = usePagination(filtered, { resetKey: `${search}|${toolFilter}|${statusFilter}` });

  const stats = useMemo(() => {
    const fonts = assets.filter((a) => designToolOf(a) === "Font").length;
    const raws = assets.filter((a) => designToolOf(a) === "Camera RAW" || a.type === "raw").length;
    return [
      { label: "Sources", value: String(assets.length), footer: "editable originals" },
      { label: "Fonts", value: String(fonts), footer: "typefaces stored" },
      { label: "RAW captures", value: String(raws), footer: "camera originals" },
      { label: "Storage", value: formatBytes(assets.reduce((s, a) => s + (a.sizeBytes || 0), 0)), footer: "source files" },
    ];
  }, [assets]);

  const openAsset = openId ? assets.find((a) => a.id === openId) ?? null : null;
  if (openAsset) return <DesignDetail asset={openAsset} siblings={assets} onBack={() => setOpenId(null)} />;

  const columns = [
    {
      key: "name",
      header: "Source file",
      render: (a) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/15">
            <File className="h-4 w-4 text-orange-300" />
          </div>
          <div className="min-w-0">
            <p className="max-w-[260px] truncate text-sm font-medium text-foreground">{a.name}</p>
            <p className="text-xs text-text-secondary">.{assetExtension(a) || "file"} · {formatBytes(a.sizeBytes)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "tool",
      header: "Tool",
      render: (a) => <Badge className="border border-border bg-surface-card px-1.5 py-0 text-[10px] text-text-secondary">{designToolOf(a)}</Badge>,
    },
    {
      key: "folder",
      header: "Folder",
      className: "text-xs text-text-secondary hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => a.folder || "root",
    },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusPill status={a.status} map={STATUS_META} />,
    },
    {
      key: "modified",
      header: "Modified",
      className: "text-xs text-text-secondary hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (a) => formatDate(a.updatedAt),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Design & Raw Files" description="Editable sources, camera RAW, and fonts — with source-to-export lineage." actions={<Button variant="outline" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => toast.success("Source intake checklist opened.")}><Link2 className="h-4 w-4" /> Link Figma file</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={toolFilter} onValueChange={setToolFilter} options={TOOL_OPTIONS} height="h-9" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search sources, tools, fonts…" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel size={56} />
      ) : (
        <div className="space-y-5">
          <DataTable columns={columns} data={pager.pageItems} getRowKey={(a) => a.id} onRowClick={(a) => setOpenId(a.id)} empty={<div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={File} title={assets.length ? "No sources match" : "No design sources yet"} description={assets.length ? "Try clearing search or filters." : "Upload PSD, AI, Figma refs, RAW, or fonts from the Asset Library."} /></div>} />
          <ListPagination {...pager} itemLabel="sources" />
        </div>
      )}
      {loading ? null : <p className={cn("text-xs text-text-tertiary")}>Sources stay editable — publish delivery files as renditions instead of overwriting.</p>}
      {loading ? <Loader2 className="hidden h-3 w-3" /> : null}
    </MainScreenWrapper>
  );
}

export default DesignRawScreen;

