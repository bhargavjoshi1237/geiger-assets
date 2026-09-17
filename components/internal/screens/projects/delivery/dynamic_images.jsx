"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Image as ImageIcon, Link2, TriangleAlert } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { listAssets } from "@/lib/supabase/assets";
import {
  DEFAULT_TRANSFORM_FIT,
  DEFAULT_TRANSFORM_QUALITY,
  TRANSFORM_FITS,
  TRANSFORM_HEIGHTS,
  TRANSFORM_QUALITIES,
  TRANSFORM_WIDTHS,
  parseTransform,
} from "@/lib/media/transform";
import { TRANSFORM_FIT_LABELS, formatBytes } from "./constants";

// Dynamic Images — a live playground over the real transform route.
//
// Every control here draws from the allowlist in lib/media/transform.js — the
// same module the route enforces — so a combination this screen offers is a
// combination the route serves, and anything the route would 400 on is shown
// as invalid here instead of guessed or clamped. Widths and heights share one
// responsive ladder; qualities are three rungs, not a dial; the canonical
// form (c, h, q, w with defaults omitted) is what makes spellings share one
// cached derivative.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const FIT_REQUIRING_BOTH = ["fill", "pad", "scale"];

function isImageAsset(asset) {
  if (!asset) return false;
  if (String(asset.type || "").toLowerCase() === "image") return true;
  return String(asset.mimeType || "").toLowerCase().startsWith("image/");
}

export function DynamicImagesScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assetId, setAssetId] = useState("");
  const [width, setWidth] = useState("384");
  const [height, setHeight] = useState("auto");
  const [fit, setFit] = useState(DEFAULT_TRANSFORM_FIT);
  const [quality, setQuality] = useState(String(DEFAULT_TRANSFORM_QUALITY));
  const [format, setFormat] = useState("auto");

  useEffect(() => {
    let alive = true;
    listAssets(projectId).then((rows) => {
      if (!alive) return;
      const list = rows ?? [];
      setAssets(list);
      const first = list.find(isImageAsset);
      if (first) setAssetId(first.id);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const images = useMemo(() => assets.filter(isImageAsset), [assets]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return images;
    return images.filter((asset) =>
      `${asset.name} ${asset.format} ${asset.folder}`.toLowerCase().includes(needle),
    );
  }, [images, search]);

  const selected = useMemo(
    () => images.find((asset) => asset.id === assetId) || null,
    [images, assetId],
  );

  const draftSpec = useMemo(() => {
    const parts = [];
    if (width !== "auto") parts.push(`w_${width}`);
    if (height !== "auto") parts.push(`h_${height}`);
    if (fit !== DEFAULT_TRANSFORM_FIT) parts.push(`c_${fit}`);
    if (quality !== String(DEFAULT_TRANSFORM_QUALITY)) parts.push(`q_${quality}`);
    return parts.join(",");
  }, [width, height, fit, quality]);

  const parsed = useMemo(
    () => (draftSpec ? parseTransform(draftSpec) : null),
    [draftSpec],
  );

  const error = useMemo(() => {
    if (!selected) return "Choose a source asset to preview a transform.";
    if (!draftSpec) return "Pick at least a width or a height — a dimension-less spec only re-encodes the original.";
    if (!parsed) {
      if (FIT_REQUIRING_BOTH.includes(fit) && (width === "auto" || height === "auto")) {
        return `“${fit}” needs both a width and a height — cropping to a box from one side has no single reading.`;
      }
      return "That combination is outside the route allowlist and would answer 400.";
    }
    return null;
  }, [selected, draftSpec, parsed, fit, width, height]);

  const url = useMemo(() => {
    if (!selected || !parsed) return "";
    const params = format === "auto" ? "" : `?format=${format}`;
    return `${BASE}/api/media/${selected.id}/t/${parsed.canonical}${params}`;
  }, [selected, parsed, format]);

  const stats = useMemo(
    () => [
      { label: "Widths", value: String(TRANSFORM_WIDTHS.length), footer: "responsive ladder" },
      { label: "Crop modes", value: String(Object.keys(TRANSFORM_FITS).length), footer: "friendly fit names" },
      { label: "Qualities", value: String(TRANSFORM_QUALITIES.length), footer: "60 / 75 / 90" },
      { label: "Slot ceiling", value: "3,240", footer: "max derivatives per asset" },
    ],
    [],
  );

  const copyUrl = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Transform URL copied.");
    } catch {
      toast.error("Copy failed — select the URL manually.");
    }
  };

  const filtersActive = search.trim() !== "";

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Dynamic Images"
        description="Transform images at delivery time."
        actions={
          url ? (
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={copyUrl}
            >
              <Copy className="h-4 w-4" /> Copy URL
            </Button>
          ) : null
        }
      />

      <StatsBar stats={stats} />

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading dynamic images" />
        </div>
      ) : images.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={ImageIcon}
            title="No images to transform"
            description="Upload a raster still first — video, audio, and documents fall back to their originals instead of deriving."
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <SectionCard
            title="Source asset"
            description={`${images.length} raster image${images.length === 1 ? "" : "s"} in this project.`}
            className="lg:col-span-2"
          >
            <div className="space-y-3">
              <SearchInput value={search} onChange={setSearch} placeholder="Search images…" />
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={ImageIcon}
                    title="No images match"
                    description="Try a different search term."
                    action={
                      filtersActive ? (
                        <Button
                          variant="outline"
                          className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                          onClick={() => setSearch("")}
                        >
                          Clear search
                        </Button>
                      ) : null
                    }
                  />
                ) : (
                  filtered.map((asset) => {
                    const active = asset.id === assetId;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setAssetId(asset.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                          active
                            ? "border-border-strong bg-surface-active"
                            : "border-border bg-surface-card hover:bg-surface-hover"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {asset.name || "Untitled image"}
                          </span>
                          <span className="block truncate text-[11px] text-text-tertiary">
                            {[asset.format, asset.dimensions, formatBytes(asset.sizeBytes)]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </span>
                        </span>
                        {active ? <Badge variant="info">Source</Badge> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </SectionCard>

          <div className="space-y-6 lg:col-span-3">
            <SectionCard
              title="Transform"
              description="Every value comes from the route allowlist — off-ladder sizes are rejected, never clamped."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Width" htmlFor="t-width">
                  <Select value={width} onValueChange={setWidth}>
                    <SelectTrigger id="t-width" className="bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      {TRANSFORM_WIDTHS.map((w) => (
                        <SelectItem key={w} value={String(w)}>
                          {w}px
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Height" htmlFor="t-height">
                  <Select value={height} onValueChange={setHeight}>
                    <SelectTrigger id="t-height" className="bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      {TRANSFORM_HEIGHTS.map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          {h}px
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Crop"
                  htmlFor="t-fit"
                  hint={FIT_REQUIRING_BOTH.includes(fit) ? "Needs both width and height." : undefined}
                >
                  <Select value={fit} onValueChange={setFit}>
                    <SelectTrigger id="t-fit" className="bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(TRANSFORM_FITS).map((name) => (
                        <SelectItem key={name} value={name}>
                          {TRANSFORM_FIT_LABELS[name] || name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Quality" htmlFor="t-quality">
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger id="t-quality" className="bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSFORM_QUALITIES.map((q) => (
                        <SelectItem key={q} value={String(q)}>
                          {q}
                          {q === DEFAULT_TRANSFORM_QUALITY ? " (default)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Format"
                  htmlFor="t-format"
                  hint="Auto follows the request Accept header; an override pins one encoding."
                >
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger id="t-format" className="bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (Accept negotiation)</SelectItem>
                      <SelectItem value="webp">WebP</SelectItem>
                      <SelectItem value="avif">AVIF</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Spec" hint="Canonical form — every spelling shares one cached derivative.">
                  <div className="flex h-9 items-center rounded-md border border-border bg-surface-card px-3 font-mono text-xs text-foreground">
                    {parsed ? parsed.canonical : draftSpec || "—"}
                  </div>
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              title="URL and preview"
              description="Served by the transform route; non-raster originals fall back to the file itself."
              action={
                url ? (
                  <Button
                    variant="outline"
                    className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                    onClick={copyUrl}
                  >
                    <Link2 className="h-4 w-4" /> Copy
                  </Button>
                ) : null
              }
            >
              {error ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="break-all rounded-md border border-border bg-surface-card px-3 py-2 font-mono text-xs text-foreground">
                    {url}
                  </div>
                  <div className="overflow-hidden rounded-lg border border-border bg-surface-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={url}
                      src={url}
                      alt={selected?.name ? `Transform preview of ${selected.name}` : "Transform preview"}
                      className="max-h-96 w-full object-contain"
                    />
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      <Toolbar>
        <span className="text-xs text-text-tertiary">
          Named variants stay put: thumb, preview, and poster cover grids, detail panes, and lightboxes without ad-hoc specs.
        </span>
      </Toolbar>
      <DataTable
        columns={[
          {
            key: "variant",
            header: "Named variant",
            render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
          },
          {
            key: "size",
            header: "Box",
            render: (row) => <span className="text-xs text-text-secondary">{row.box}</span>,
          },
          {
            key: "use",
            header: "Use for",
            render: (row) => <span className="text-xs text-text-secondary">{row.use}</span>,
          },
        ]}
        data={[
          { name: "thumb", box: "256px", use: "Grid cells, 2x retina for a 128px cell" },
          { name: "preview", box: "1024px", use: "Detail pane and list preview" },
          { name: "poster", box: "1920px", use: "Lightbox and OG poster" },
        ]}
        getRowKey={(row) => row.name}
      />
    </MainScreenWrapper>
  );
}

export default DynamicImagesScreen;
