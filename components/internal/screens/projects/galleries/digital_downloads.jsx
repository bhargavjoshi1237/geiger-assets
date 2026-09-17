"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { ActionMenu } from "@geiger/ui/action-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
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
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import {
  DOWNLOAD_RENDITION_FILTER_OPTIONS,
  DOWNLOAD_RENDITION_MAP,
  DOWNLOAD_RENDITION_OPTIONS,
  DOWNLOAD_STATUS_FILTER_OPTIONS,
  DOWNLOAD_STATUS_MAP,
  formatDate,
} from "./constants";
import {
  createDownload,
  listDownloads,
  softDeleteDownload,
  updateDownload,
} from "@/lib/supabase/galleries";

// Digital Downloads — single-asset sales, bundles, rendition selection,
// automatic fulfillment, download limits, delivery history.

const EMPTY_DRAFT = {
  name: "",
  assetId: "",
  fileName: "",
  rendition: "original",
  downloadLimit: "5",
  customerEmail: "",
  expiresAt: "",
};

const STATUS_OPTIONS = Object.entries(DOWNLOAD_STATUS_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

function DownloadDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDraft({
      ...EMPTY_DRAFT,
      name: initial?.name ?? "",
      assetId: initial?.assetId ?? "",
      fileName: initial?.fileName ?? "",
      rendition: initial?.rendition ?? "original",
      downloadLimit: initial ? String(initial.downloadLimit ?? 5) : "5",
      customerEmail: initial?.customerEmail ?? "",
      expiresAt: initial?.expiresAt ? String(initial.expiresAt).slice(0, 10) : "",
    });
    setStatus(initial?.status || "active");
    setBusy(false);
  }, [open, initial]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give the download a name.");
      return;
    }
    const limit = Math.max(0, Math.floor(Number(draft.downloadLimit) || 0));
    setBusy(true);
    const ok = await onSubmit({
      name,
      assetId: draft.assetId.trim() || null,
      fileName: draft.fileName.trim(),
      rendition: draft.rendition,
      downloadLimit: limit,
      customerEmail: draft.customerEmail.trim(),
      expiresAt: draft.expiresAt ? new Date(`${draft.expiresAt}T23:59:59`).toISOString() : null,
      status,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit download" : "New download"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Sell a single asset or bundle with rendition choice and delivery limits.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="download-name">
            <Input
              id="download-name"
              className="bg-surface-card"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Miller wedding — full set…"
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Asset ID" htmlFor="download-asset" hint="Source asset.">
              <Input
                id="download-asset"
                className="bg-surface-card"
                value={draft.assetId}
                onChange={(e) => set("assetId")(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label="File name" htmlFor="download-file">
              <Input
                id="download-file"
                className="bg-surface-card"
                value={draft.fileName}
                onChange={(e) => set("fileName")(e.target.value)}
                placeholder="miller-wedding.zip"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rendition">
              <Select value={draft.rendition} onValueChange={set("rendition")}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOWNLOAD_RENDITION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Download limit" htmlFor="download-limit">
              <Input
                id="download-limit"
                className="bg-surface-card"
                inputMode="numeric"
                value={draft.downloadLimit}
                onChange={(e) => set("downloadLimit")(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="5"
              />
            </Field>
            <Field label="Expires" htmlFor="download-expires">
              <Input
                id="download-expires"
                className="bg-surface-card"
                type="date"
                value={draft.expiresAt}
                onChange={(e) => set("expiresAt")(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Customer email" htmlFor="download-email">
            <Input
              id="download-email"
              className="bg-surface-card"
              value={draft.customerEmail}
              onChange={(e) => set("customerEmail")(e.target.value)}
              placeholder="buyer@example.com"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
            disabled={busy}
          >
            {editing ? "Save changes" : "Create download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DigitalDownloadsScreen({ projectId }) {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [renditionFilter, setRenditionFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let alive = true;
    listDownloads(projectId).then((rows) => {
      if (!alive) return;
      setDownloads(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const stats = useMemo(
    () => [
      { label: "Downloads", value: String(downloads.length), footer: "delivery records" },
      {
        label: "Active",
        value: String(downloads.filter((d) => d.status === "active").length),
        footer: "ready to fulfill",
      },
      {
        label: "Delivered",
        value: String(downloads.reduce((s, d) => s + d.downloadCount, 0)),
        footer: "files served",
      },
      {
        label: "Fulfilled",
        value: String(downloads.filter((d) => d.status === "fulfilled").length),
        footer: "limits reached",
      },
    ],
    [downloads],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return downloads.filter((download) => {
      if (statusFilter !== "all" && download.status !== statusFilter) return false;
      if (renditionFilter !== "all" && download.rendition !== renditionFilter) return false;
      if (
        needle &&
        !`${download.name} ${download.fileName} ${download.customerEmail}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [downloads, search, statusFilter, renditionFilter]);

  const filtersActive =
    statusFilter !== "all" || renditionFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setStatusFilter("all");
    setRenditionFilter("all");
    setSearch("");
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (download) => {
    setEditing(download);
    setDialogOpen(true);
  };

  const submitDownload = async (draft) => {
    if (editing) {
      const previous = downloads;
      setDownloads((rows) =>
        rows.map((d) => (d.id === editing.id ? { ...d, ...draft } : d)),
      );
      const saved = await updateDownload(editing.id, draft);
      if (!saved) {
        setDownloads(previous);
        toast.error("Could not save the download.");
        return false;
      }
      setDownloads((rows) => rows.map((d) => (d.id === saved.id ? saved : d)));
      toast.success(`Saved “${saved.name}”.`);
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      downloadCount: 0,
      lastDeliveredAt: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setDownloads((rows) => [optimistic, ...rows]);
    const created = await createDownload({ id, projectId, ...draft });
    if (!created) {
      setDownloads((rows) => rows.filter((d) => d.id !== id));
      toast.error("Could not create the download.");
      return false;
    }
    setDownloads((rows) => rows.map((d) => (d.id === id ? created : d)));
    toast.success(`Created “${created.name}”.`);
    return true;
  };

  const fulfillDownload = async (download) => {
    const previous = downloads;
    const nextCount = download.downloadCount + 1;
    const patch = {
      downloadCount: nextCount,
      lastDeliveredAt: new Date().toISOString(),
      status:
        download.downloadLimit > 0 && nextCount >= download.downloadLimit
          ? "fulfilled"
          : download.status,
    };
    setDownloads((rows) => rows.map((d) => (d.id === download.id ? { ...d, ...patch } : d)));
    const saved = await updateDownload(download.id, patch);
    if (!saved) {
      setDownloads(previous);
      toast.error("Could not record fulfillment.");
      return;
    }
    setDownloads((rows) => rows.map((d) => (d.id === saved.id ? saved : d)));
    toast.success(`Fulfilled “${saved.name}” (${saved.downloadCount}/${saved.downloadLimit}).`);
  };

  const duplicateDownload = async (download) => {
    const id = crypto.randomUUID();
    const copy = `Copy of ${download.name}`;
    const optimistic = {
      ...download,
      id,
      name: copy,
      status: "active",
      downloadCount: 0,
      lastDeliveredAt: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDownloads((rows) => [optimistic, ...rows]);
    const created = await createDownload({
      id,
      projectId,
      name: copy,
      assetId: download.assetId,
      fileName: download.fileName,
      rendition: download.rendition,
      status: "active",
      downloadLimit: download.downloadLimit,
      customerEmail: download.customerEmail,
      expiresAt: download.expiresAt || null,
    });
    if (!created) {
      setDownloads((rows) => rows.filter((d) => d.id !== id));
      toast.error("Could not duplicate the download.");
      return;
    }
    setDownloads((rows) => rows.map((d) => (d.id === id ? created : d)));
    toast.success(`Duplicated as “${created.name}”.`);
  };

  const removeDownload = async (download) => {
    const previous = downloads;
    setDownloads((rows) => rows.filter((d) => d.id !== download.id));
    const ok = await softDeleteDownload(download.id);
    if (!ok) {
      setDownloads(previous);
      toast.error("Could not delete the download.");
      return;
    }
    toast.success(`Deleted “${download.name}”.`);
  };

  const columns = [
    {
      key: "name",
      header: "Download",
      render: (download) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">
            {download.name || "Untitled download"}
          </span>
          <span className="truncate text-xs text-text-secondary">
            {download.fileName || "no file"} · {download.customerEmail || "no buyer"}
          </span>
        </div>
      ),
    },
    {
      key: "rendition",
      header: "Rendition",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (download) => (
        <StatusPill status={download.rendition} map={DOWNLOAD_RENDITION_MAP} />
      ),
    },
    {
      key: "progress",
      header: "Delivered",
      render: (download) => (
        <div className="flex flex-col gap-1">
          <StatusPill status={download.status} map={DOWNLOAD_STATUS_MAP} />
          <span className="text-[11px] text-text-tertiary">
            {download.downloadCount}/{download.downloadLimit}
            {download.expiresAt ? ` · expires ${formatDate(download.expiresAt)}` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (download) => (
        <ActionMenu
          label={`Actions for ${download.name}`}
          items={[
            { icon: Send, label: "Record fulfillment", onSelect: () => fulfillDownload(download) },
            { icon: Pencil, label: "Edit", onSelect: () => openEdit(download) },
            { icon: Copy, label: "Duplicate", onSelect: () => duplicateDownload(download) },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              destructive: true,
              onSelect: () => removeDownload(download),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Digital Downloads"
        description="Single-asset sales and bundles — renditions, fulfillment, limits, delivery history."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> New download
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={DOWNLOAD_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={renditionFilter}
            onValueChange={setRenditionFilter}
            options={DOWNLOAD_RENDITION_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search downloads…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading downloads" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(download) => download.id}
          onRowClick={openEdit}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              {filtersActive ? (
                <EmptyState
                  icon={Download}
                  title="No downloads match these filters"
                  description="Try a different status, rendition, or search term."
                  action={
                    <Button
                      variant="outline"
                      className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Download}
                  title="No downloads yet"
                  description="Sell your first single asset or bundle."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={openCreate}
                    >
                      <Plus className="h-4 w-4" /> New download
                    </Button>
                  }
                />
              )}
            </div>
          }
        />
      )}

      <DownloadDialog
        key={editing ? `download:${editing.id}` : "download:new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={submitDownload}
      />
    </MainScreenWrapper>
  );
}

export default DigitalDownloadsScreen;
