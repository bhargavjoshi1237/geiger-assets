"use client";

import { Button, LogoLoading } from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, ScanText, Trash2 } from "lucide-react";

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
import { listAssets } from "@/lib/supabase/assets";
import {
  createMediaAnnotation,
  createMediaTranscript,
  listMediaAnnotations,
  listMediaTranscripts,
  softDeleteMediaAnnotation,
} from "@/lib/supabase/media_screens";
import {
  DOCUMENT_KIND_FILTER_OPTIONS,
  MEDIA_ASSET_STATUS_FILTER_OPTIONS,
  MEDIA_ASSET_STATUS_MAP,
  TRANSCRIPT_STATUS_MAP,
  formatBytes,
  formatDate,
  ocrStateOf,
} from "./constants";

function pageCountOf(asset) {
  const raw = asset?.pageCount || asset?.metadata?.pageCount || asset?.metadata?.pages;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 99) : 1;
}

export function DocumentsOcrScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [extracting, setExtracting] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listAssets(projectId), listMediaTranscripts(projectId), listMediaAnnotations(projectId)]).then(
      ([rows, subs, notes]) => {
        if (!alive) return;
        setAssets(rows ?? []);
        setTranscripts(subs ?? []);
        setPages(notes ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const documents = useMemo(() => assets.filter((a) => a.type === "document" || a.type === "pdf"), [assets]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return documents.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (kindFilter !== "all" && a.type !== kindFilter) return false;
      if (needle && !`${a.name} ${a.format} ${(a.tags || []).join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [documents, search, statusFilter, kindFilter]);

  const selected = useMemo(
    () => filtered.find((a) => a.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  const ocrRows = useMemo(
    () => transcripts.filter((t) => t.assetId === selected?.id && t.kind === "ocr"),
    [transcripts, selected],
  );

  const extractedPages = useMemo(
    () => pages.filter((p) => p.assetId === selected?.id && p.kind === "annotation" && String(p.label || "").startsWith("Page ")),
    [pages, selected],
  );

  const stats = useMemo(() => {
    const ocrReady = new Set(transcripts.filter((t) => t.kind === "ocr").map((t) => t.assetId)).size;
    const pdfs = documents.filter((a) => a.type === "pdf").length;
    const totalPages = documents.reduce((sum, a) => sum + pageCountOf(a), 0);
    return [
      { label: "Documents", value: String(documents.length), footer: `${pdfs} PDFs` },
      { label: "OCR ready", value: String(ocrReady), footer: "with extracted text" },
      { label: "Pages tracked", value: String(totalPages), footer: "from metadata count" },
      { label: "Extracted pages", value: String(pages.filter((p) => String(p.label || "").startsWith("Page ")).length), footer: "page rows saved" },
    ];
  }, [documents, transcripts, pages]);

  const filtersActive = search.trim() !== "" || statusFilter !== "all" || kindFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setKindFilter("all");
  };

  const handleExtractOcr = async () => {
    if (!selected || extracting) return;
    setExtracting(true);
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, assetId: selected.id, kind: "ocr", language: "en", text: "", status: "processing", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setTranscripts((prev) => [optimistic, ...prev]);
    const created = await createMediaTranscript({ id, projectId, assetId: selected.id, kind: "ocr", language: "en", text: "", status: "processing" });
    setExtracting(false);
    if (created) {
      setTranscripts((prev) => prev.map((t) => (t.id === id ? created : t)));
      toast.success("OCR queued — text lands here when extraction finishes.");
    } else {
      setTranscripts((prev) => prev.filter((t) => t.id !== id));
      toast.error("Couldn't queue OCR extraction.");
    }
  };

  const handleExtractPage = async (pageNumber) => {
    if (!selected) return;
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, assetId: selected.id, kind: "annotation", label: `Page ${pageNumber}`, body: "", positionX: null, positionY: null, timestampSeconds: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setPages((prev) => [optimistic, ...prev]);
    const created = await createMediaAnnotation({ id, projectId, assetId: selected.id, kind: "annotation", label: `Page ${pageNumber}`, body: "" });
    if (created) {
      setPages((prev) => prev.map((p) => (p.id === id ? created : p)));
      toast.success(`Page ${pageNumber} queued for extraction.`);
    } else {
      setPages((prev) => prev.filter((p) => p.id !== id));
      toast.error("Couldn't queue page extraction.");
    }
  };

  const handleRemovePage = async (page) => {
    const prev = pages;
    setPages((rows) => rows.filter((p) => p.id !== page.id));
    const ok = await softDeleteMediaAnnotation(page.id);
    if (!ok) {
      setPages(prev);
      toast.error("Couldn't remove the page row.");
    } else {
      toast.success("Page row removed.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Document",
      render: (a) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">{a.name}</span>
          <span className="truncate text-xs text-text-secondary">{a.format || a.type} · {pageCountOf(a)} pages · {formatBytes(a.sizeBytes)}</span>
        </div>
      ),
    },
    {
      key: "ocr",
      header: "OCR",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => <span className="capitalize">{ocrStateOf(a, transcripts)}</span>,
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

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Documents & OCR"
        description="PDF, office, and presentation previews with page tracking, OCR extraction, and per-page rows."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleExtractOcr} disabled={!selected || extracting}>
            <ScanText className="h-4 w-4" /> {extracting ? "Queuing…" : "Extract OCR"}
          </Button>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={kindFilter} onValueChange={setKindFilter} options={DOCUMENT_KIND_FILTER_OPTIONS} height="h-9" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={MEDIA_ASSET_STATUS_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search documents, formats, tags…" />
      </Toolbar>
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading documents" />
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
                {documents.length === 0 ? (
                  <EmptyState icon={FileText} title="No documents yet" description="Upload a PDF or office file to preview pages and run OCR." />
                ) : (
                  <EmptyState icon={FileText} title="No documents match these filters" description="Try a different kind, status, or search term." action={<Button variant="outline" className="border-border bg-surface-card text-foreground hover:bg-surface-active" onClick={clearFilters}>Clear filters</Button>} />
                )}
              </div>
            }
          />
          {selected ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Preview" description={`${pageCountOf(selected)} pages · OCR ${ocrStateOf(selected, transcripts)}`}>
                <AssetPreview asset={selected} />
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {Array.from({ length: Math.min(pageCountOf(selected), 8) }).map((_, i) => (
                    <div key={i} className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border border-border bg-surface-card text-text-tertiary">
                      <FileText className="h-4 w-4" />
                      <span className="text-[10px] tabular-nums">p.{i + 1}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="OCR & pages" description="Extraction rows queue honestly — empty means not yet extracted.">
                <div className="space-y-2">
                  {ocrRows.length === 0 ? (
                    <p className="text-xs text-text-tertiary">No OCR text yet. Queue extraction to create a processing row.</p>
                  ) : (
                    ocrRows.map((row) => (
                      <div key={row.id} className="rounded-lg border border-border bg-surface-card p-3">
                        <div className="flex items-center gap-2">
                          <StatusPill status={row.status} map={TRANSCRIPT_STATUS_MAP} />
                          <span className="text-[11px] uppercase tracking-wider text-text-tertiary">{row.language}</span>
                        </div>
                        <p className="mt-2 line-clamp-4 text-xs text-text-secondary">{row.text || "Extraction queued — text appears here when the worker finishes."}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">Page extraction ({extractedPages.length}/{pageCountOf(selected)})</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.from({ length: pageCountOf(selected) }).map((_, i) => {
                      const n = i + 1;
                      const done = extractedPages.some((p) => p.label === `Page ${n}`);
                      return (
                        <Button key={n} variant="outline" size="sm" disabled={done} className="h-7 border-border bg-surface-card text-xs text-foreground hover:bg-surface-active" onClick={() => handleExtractPage(n)}>
                          {done ? `Page ${n} ✓` : `Extract p.${n}`}
                        </Button>
                      );
                    })}
                  </div>
                  {extractedPages.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {extractedPages.map((page) => (
                        <li key={page.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs">
                          <span className="min-w-0 flex-1 text-foreground">{page.label}</span>
                          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${page.label}`} className="h-6 w-6 text-text-tertiary hover:bg-red-500/10 hover:text-red-400" onClick={() => handleRemovePage(page)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </SectionCard>
            </div>
          ) : null}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default DocumentsOcrScreen;
