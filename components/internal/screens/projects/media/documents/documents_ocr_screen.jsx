"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, ScanText, FileDown, Copy, Loader2, Search } from "lucide-react";
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
import { STATUS_META, STATUS_FILTER_OPTIONS, FILE_TYPE_COLORS, formatBytes, formatDate } from "@/components/internal/screens/projects/library/constants";
import { listAssets } from "@/lib/supabase/assets";
import { OCR_META, ocrStatusOf, mockOcrText, mockPageCount } from "../shared";
import { cn } from "@/lib/utils";

const KIND_OPTIONS = [
  { value: "all", label: "All documents" },
  { value: "pdf", label: "PDF" },
  { value: "document", label: "Office docs" },
];

const OCR_FILTER = [
  { value: "all", label: "All OCR states" },
  { value: "ready", label: "OCR complete" },
  { value: "processing", label: "OCR running" },
  { value: "none", label: "No OCR" },
];

function DocThumb({ asset }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15">
      <FileText className="h-4 w-4 text-emerald-300" />
    </div>
  );
}

function DocumentsDetail({ asset, onBack }) {
  const pages = mockPageCount(asset);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [extract, setExtract] = useState([1, 2]);
  const ocr = ocrStatusOf(asset);
  const text = useMemo(() => mockOcrText(asset), [asset]);
  const highlighted = q ? text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")) : [text];
  return (
    <MainScreenWrapper>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to documents" className="h-8 w-8 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <DocThumb asset={asset} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{asset.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusPill status={ocr} map={OCR_META} className="text-[10px]" />
              <span className="text-xs text-text-secondary">{pages} pages · {(asset.format || asset.type).toUpperCase()} · {formatBytes(asset.sizeBytes)}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => toast.success("OCR re-queued for this document.")}>
            <ScanText className="h-4 w-4" /> Re-run OCR
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => toast.success(`Pages ${extract.join(", ")} queued for extraction.`)}>
            <FileDown className="h-4 w-4" /> Extract pages
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <SectionCard title="Pages" description="Thumbnails with page-level extraction.">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: Math.min(pages, 12) }).map((_, i) => {
              const n = i + 1;
              const selected = extract.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setPage(n);
                    setExtract((prev) => (prev.includes(n) ? prev.filter((p) => p !== n) : [...prev, n].sort((a, b) => a - b)));
                  }}
                  className={cn("overflow-hidden rounded-lg border text-left transition-colors", page === n ? "border-primary/60" : "border-border", selected && "ring-1 ring-primary/40")}
                >
                  <div className="flex aspect-[3/4] flex-col bg-surface-card p-2">
                    <div className="h-1.5 w-2/3 rounded bg-border" />
                    <div className="mt-1.5 space-y-1">
                      <div className="h-1 w-full rounded bg-border/70" />
                      <div className="h-1 w-5/6 rounded bg-border/70" />
                      <div className="h-1 w-4/6 rounded bg-border/70" />
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="font-mono text-[10px] text-text-secondary">p.{n}</span>
                      {selected ? <Badge className="border border-primary/30 bg-primary/10 px-1 py-0 text-[9px] text-primary">extract</Badge> : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {pages > 12 ? <p className="mt-2 text-xs text-text-tertiary">Showing 12 of {pages} pages. Extraction supports full ranges.</p> : null}
          <div className="mt-3 rounded-lg border border-border bg-surface-card px-3 py-2.5 text-xs text-text-secondary">
            Page {page} selected · {extract.length} marked for extraction · output PDF keeps text layer.
          </div>
        </SectionCard>
        <div className="space-y-4">
          <SectionCard title="Extracted text" description="OCR layer with content search.">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search inside document…" className="pl-8 border-border bg-surface-card" />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-surface-card px-3 py-2.5 text-sm leading-6 text-foreground">
              {highlighted.map((part, i) =>
                q && part.toLowerCase() === q.toLowerCase() ? (
                  <mark key={i} className="rounded bg-amber-400/30 px-0.5 text-foreground">{part}</mark>
                ) : (
                  <span key={i} className="whitespace-pre-wrap">{part}</span>
                )
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => { navigator.clipboard?.writeText(text); toast.success("Extracted text copied."); }}>
                <Copy className="h-3.5 w-3.5" /> Copy text
              </Button>
              <Button variant="ghost" size="sm" className="text-text-secondary hover:text-foreground" onClick={() => toast.success("Text export (.txt) downloaded.")}>
                Download .txt
              </Button>
            </div>
          </SectionCard>
          <SectionCard title="Document facts" description="Indexing and file facts.">
            <div className="space-y-2.5 text-sm">
              {[
                ["Pages", String(pages)],
                ["OCR", OCR_META[ocr]?.label || ocr],
                ["Size", formatBytes(asset.sizeBytes)],
                ["Folder", asset.folder || "root"],
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

export function DocumentsOcrScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [ocrFilter, setOcrFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    listAssets(projectId).then((rows) => {
      if (!alive) return;
      setAssets((rows ?? []).filter((a) => a.type === "document" || a.type === "pdf"));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [projectId]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (kindFilter !== "all" && a.type !== kindFilter) return false;
      if (ocrFilter !== "all" && ocrStatusOf(a) !== ocrFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search) {
        const hay = `${a.name} ${a.format} ${(a.tags || []).join(" ")} ${mockOcrText(a)}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [assets, search, kindFilter, ocrFilter, statusFilter]);

  const pager = usePagination(filtered, { resetKey: `${search}|${kindFilter}|${ocrFilter}|${statusFilter}` });

  const stats = useMemo(() => {
    const pages = assets.reduce((s, a) => s + mockPageCount(a), 0);
    const ready = assets.filter((a) => ocrStatusOf(a) === "ready").length;
    return [
      { label: "Documents", value: String(assets.length), footer: "PDF + office" },
      { label: "Pages", value: String(pages), footer: "indexed pages" },
      { label: "OCR complete", value: String(ready), footer: "searchable text" },
      { label: "Storage", value: formatBytes(assets.reduce((s, a) => s + (a.sizeBytes || 0), 0)), footer: "across docs" },
    ];
  }, [assets]);

  const openAsset = openId ? assets.find((a) => a.id === openId) ?? null : null;
  if (openAsset) return <DocumentsDetail asset={openAsset} onBack={() => setOpenId(null)} />;

  const columns = [
    {
      key: "name",
      header: "Document",
      render: (a) => (
        <div className="flex items-center gap-3">
          <DocThumb asset={a} />
          <div className="min-w-0">
            <p className="max-w-[260px] truncate text-sm font-medium text-foreground">{a.name}</p>
            <p className="text-xs text-text-secondary">{mockPageCount(a)} pages · {formatBytes(a.sizeBytes)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Kind",
      render: (a) => <Badge className={cn("border px-1.5 py-0 text-[10px]", FILE_TYPE_COLORS[a.type] || "border-border bg-surface-card text-text-secondary")}>{(a.format || a.type).toUpperCase()}</Badge>,
    },
    {
      key: "ocr",
      header: "OCR",
      render: (a) => <StatusPill status={ocrStatusOf(a)} map={OCR_META} className="text-[10px]" />,
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
      <ScreenHeader title="Documents & OCR" description="PDFs, office docs, and presentations — page thumbnails, OCR extraction, and content search." actions={<Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => toast.success("OCR queued for documents missing text.")}><ScanText className="h-4 w-4" /> Run OCR</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={kindFilter} onValueChange={setKindFilter} options={KIND_OPTIONS} height="h-9" />
          <FilterDropdown value={ocrFilter} onValueChange={setOcrFilter} options={OCR_FILTER} height="h-9" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search filenames or inside text…" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel size={56} />
      ) : (
        <div className="space-y-5">
          <DataTable columns={columns} data={pager.pageItems} getRowKey={(a) => a.id} onRowClick={(a) => setOpenId(a.id)} empty={<div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={FileText} title={assets.length ? "No documents match" : "No documents yet"} description={assets.length ? "Try clearing search or filters." : "Upload PDFs or office files from the Asset Library."} /></div>} />
          <ListPagination {...pager} itemLabel="documents" />
        </div>
      )}
      {loading ? null : <p className="flex items-center gap-1.5 text-xs text-text-tertiary"><Loader2 className="hidden h-3 w-3" />Content search covers the OCR text layer, not just filenames.</p>}
    </MainScreenWrapper>
  );
}

export default DocumentsOcrScreen;


