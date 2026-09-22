"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  ChevronDown,
  Link2,
  Pause,
  Play,
  Copy,
  Trash2,
  Eye,
  X,
  ArrowUpDown,
  SlidersHorizontal,
  Inbox,
  FormInput,
  Zap,
  Bell,
  Shield,
  FolderOpen,
  AlertCircle,
} from "lucide-react";
import { ActionMenu } from "@geiger/ui/action-menu";
import { toast } from "sonner";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@geiger/ui/sheet";
import { cn } from "@/lib/utils";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  SearchInput,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import {
  PORTAL_STATUS_META,
  TYPE_LABELS,
  TYPE_BADGE_COLORS,
  TYPE_OPTIONS,
  STATUS_FILTER_OPTIONS,
  TYPE_FILTER_OPTIONS,
  SORT_OPTIONS,
  formatDate,
  slugify,
} from "./constants";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import {
  listPortals,
  listAllSubmissions,
  createPortal,
  updatePortal,
  deletePortal,
} from "@/lib/supabase/external_uploads";
import { portalShareUrl } from "@/lib/share";

const PROVIDERS = [
  {
    id: "google-drive",
    name: "Google Drive",
    desc: "Import assets from Drive folders and shared drives",
    color: "#4285F4",
    letter: "G",
    category: "cloud",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    desc: "Sync files from Dropbox folders and shared spaces",
    color: "#0061FF",
    letter: "Db",
    category: "cloud",
  },
  {
    id: "onedrive",
    name: "OneDrive",
    desc: "Connect to Microsoft OneDrive and SharePoint",
    color: "#0078D4",
    letter: "Od",
    category: "cloud",
  },
  {
    id: "box",
    name: "Box",
    desc: "Pull assets from Box enterprise content management",
    color: "#0061D5",
    letter: "Bx",
    category: "cloud",
  },
  {
    id: "s3",
    name: "Amazon S3",
    desc: "Connect an S3 bucket to import or sync assets",
    color: "#FF9900",
    letter: "S3",
    category: "storage",
  },
  {
    id: "r2",
    name: "Cloudflare R2",
    desc: "Import from Cloudflare R2 object storage",
    color: "#F38020",
    letter: "R2",
    category: "storage",
  },
  {
    id: "ftp",
    name: "FTP / SFTP",
    desc: "Import from FTP and SFTP servers",
    color: "#64748b",
    letter: "FTP",
    category: "storage",
  },
  {
    id: "unsplash",
    name: "Unsplash",
    desc: "Search and import from 3M+ free high-res photos",
    color: "#111111",
    letter: "Un",
    category: "stock",
  },
  {
    id: "pexels",
    name: "Pexels",
    desc: "Free stock photos, videos and music",
    color: "#05A081",
    letter: "Px",
    category: "stock",
  },
  {
    id: "shutterstock",
    name: "Shutterstock",
    desc: "Licensed stock imagery and footage",
    color: "#EE2E24",
    letter: "Ss",
    category: "stock",
  },
  {
    id: "getty",
    name: "Getty Images",
    desc: "Premium stock content and editorial media",
    color: "#CC0000",
    letter: "Gi",
    category: "stock",
  },
  {
    id: "adobe-stock",
    name: "Adobe Stock",
    desc: "Creative assets from Adobe's stock library",
    color: "#FF0000",
    letter: "As",
    category: "stock",
  },
];

const SIZE_LIMIT_OPTIONS = [
  { value: "10mb", label: "10 MB" },
  { value: "50mb", label: "50 MB" },
  { value: "100mb", label: "100 MB" },
  { value: "500mb", label: "500 MB" },
  { value: "none", label: "No limit" },
];

const FILE_TYPE_CHIPS = [
  { value: "image", label: "Images" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Documents" },
  { value: "3d", label: "3D Models" },
  { value: "raw", label: "Raw Files" },
];

const FOLDER_OPTIONS = [
  { value: "root", label: "/ Root" },
  { value: "campaigns", label: "Campaigns" },
  { value: "products", label: "Products" },
  { value: "brand", label: "Brand Assets" },
  { value: "external", label: "External / Inbox" },
];

const EMPTY_DRAFT = {
  name: "",
  type: "link",
  destinationFolder: "root",
  requireMetadata: false,
  expiresAt: "",
};

function ProviderIcon({ provider }) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold tracking-tight text-white"
      style={{ background: provider.color }}
    >
      {provider.letter}
    </div>
  );
}

function ProviderCard({ provider, connected, onConnect, onDisconnect }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-surface-subtle p-4 transition-colors",
        connected
          ? "border-emerald-500/30"
          : "border-border hover:border-border-strong",
      )}
    >
      <div className="flex items-start justify-between">
        <ProviderIcon provider={provider} />
        {connected ? (
          <Badge className="border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0 text-[10px] text-emerald-300">
            Connected
          </Badge>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{provider.name}</p>
        <p className="mt-0.5 text-xs text-text-secondary">{provider.desc}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-7 w-full text-xs",
          connected
            ? "border-border text-text-secondary hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
            : "border-border bg-surface-card text-foreground hover:bg-surface-hover",
        )}
        onClick={() =>
          connected ? onDisconnect(provider.id) : onConnect(provider.id)
        }
      >
        {connected ? "Disconnect" : "Connect"}
      </Button>
    </div>
  );
}

function ProviderSection({ title, providers, connected, onConnect, onDisconnect }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            connected={connected.has(provider.id)}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
          />
        ))}
      </div>
    </div>
  );
}

function PortalGlyph({ type }) {
  const Icon = type === "form" ? FormInput : Link2;
  const tone = type === "form" ? "#a78bfa" : "#38bdf8";
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
      style={{ background: `${tone}15`, borderColor: `${tone}25` }}
    >
      <Icon className="h-4 w-4" style={{ color: tone }} />
    </div>
  );
}

function PortalRowActions({ portal, onView, onToggle, onCopyLink, onDelete }) {
  const paused = portal.status === "paused";
  return (
    <ActionMenu
      label="Portal actions"
      items={[
        { icon: Eye, label: "View", onSelect: () => onView(portal) },
        {
          icon: paused ? Play : Pause,
          label: paused ? "Activate" : "Pause",
          onSelect: () => onToggle(portal),
        },
        { icon: Copy, label: "Copy link", onSelect: () => onCopyLink(portal) },
        { separator: true },
        { icon: Trash2, label: "Delete", destructive: true, onSelect: () => onDelete(portal) },
      ]}
    />
  );
}

function CreatePortalDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [error, setError] = useState("");
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const close = () => {
    setDraft(EMPTY_DRAFT);
    setError("");
    onOpenChange(false);
  };

  const submit = () => {
    if (!draft.name.trim()) {
      setError("A portal name is required.");
      return;
    }
    onCreate(draft);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Portal</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Create a link or form to collect files from outside your workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field
            label="Name"
            htmlFor="portal-name"
            hint={draft.name ? `/u/${slugify(draft.name)}` : undefined}
          >
            <Input
              id="portal-name"
              value={draft.name}
              onChange={(e) => {
                set("name")(e.target.value);
                if (error) setError("");
              }}
              placeholder="Client photo drop"
              className="border-border bg-surface-card text-foreground"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
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
            <Field label="Destination folder" htmlFor="portal-folder">
              <Input
                id="portal-folder"
                value={draft.destinationFolder}
                onChange={(e) => set("destinationFolder")(e.target.value)}
                className="border-border bg-surface-card text-foreground"
              />
            </Field>
          </div>
          <Field label="Expires" htmlFor="portal-expires" hint="Leave blank for no expiry.">
            <Input
              id="portal-expires"
              type="date"
              value={draft.expiresAt}
              onChange={(e) => set("expiresAt")(e.target.value)}
              className="border-border bg-surface-card text-foreground"
            />
          </Field>
          <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Require metadata</p>
              <p className="text-xs text-text-secondary">
                Ask submitters for context before they upload.
              </p>
            </div>
            <Switch checked={draft.requireMetadata} onCheckedChange={set("requireMetadata")} />
          </div>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active"
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            Create Portal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExternalSourcesSheet({
  projectId,
  open,
  onOpenChange,
  onOpenPortal,
  reloadKey = 0,
}) {
  const [portals, setPortals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingSubmissions, setPendingSubmissions] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortValue, setSortValue] = useState("updated-desc");
  const [showCreate, setShowCreate] = useState(false);
  const [showPortals, setShowPortals] = useState(false);

  const [connected, setConnected] = useState(new Set());

  const [autoApprove, setAutoApprove] = useState(false);
  const [defaultFolder, setDefaultFolder] = useState("external");
  const [sizeLimit, setSizeLimit] = useState("100mb");
  const [allowedTypes, setAllowedTypes] = useState(
    new Set(FILE_TYPE_CHIPS.map((c) => c.value)),
  );
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState("");

  const fetchedRef = useRef(null);
  useEffect(() => {
    if (!open || fetchedRef.current === reloadKey) return;
    fetchedRef.current = reloadKey;
    listPortals(projectId).then((rows) => {
      setPortals(rows ?? []);
      setLoading(false);
    });
    listAllSubmissions().then((rows) => {
      setPendingSubmissions((rows ?? []).filter((s) => s.status === "pending").length);
    });
  }, [open, projectId, reloadKey]);

  const handleConnect = (id) => setConnected((prev) => new Set([...prev, id]));
  const handleDisconnect = (id) =>
    setConnected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const toggleAllowedType = (value) => {
    setAllowedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const openPortal = (id) => {
    setShowPortals(false);
    onOpenPortal?.(id);
  };

  const hasPortalFilters = statusFilter !== "all" || typeFilter !== "all" || Boolean(search);

  const clearFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setSearch("");
  };

  const filtered = useMemo(() => {
    let result = [...portals];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") result = result.filter((p) => p.status === statusFilter);
    if (typeFilter !== "all") result = result.filter((p) => p.type === typeFilter);
    const [field, direction] = sortValue.split("-");
    result.sort((a, b) => {
      let cmp = 0;
      if (field === "updated") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
      else if (field === "name") cmp = a.name.localeCompare(b.name);
      else if (field === "submissions") cmp = a.submissionCount - b.submissionCount;
      return direction === "desc" ? -cmp : cmp;
    });
    return result;
  }, [portals, search, statusFilter, typeFilter, sortValue]);

  const handleCreate = async (draft) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic = {
      id,
      projectId,
      name: draft.name.trim(),
      type: draft.type,
      slug: slugify(draft.name),
      status: "active",
      requireMetadata: draft.requireMetadata,
      destinationFolder: draft.destinationFolder || "root",
      expiresAt: draft.expiresAt || "",
      submissionCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    setPortals((rows) => [optimistic, ...rows]);
    const created = await createPortal({
      id,
      projectId,
      name: optimistic.name,
      type: optimistic.type,
      slug: optimistic.slug,
      status: "active",
      requireMetadata: optimistic.requireMetadata,
      destinationFolder: optimistic.destinationFolder,
      expiresAt: optimistic.expiresAt,
    });
    if (created) {
      setPortals((rows) => rows.map((p) => (p.id === id ? created : p)));
      toast.success("Portal created.");
    } else {
      setPortals((rows) => rows.filter((p) => p.id !== id));
      toast.error("Couldn't create that portal.");
    }
  };

  const handleToggle = async (portal) => {
    const next = portal.status === "paused" ? "active" : "paused";
    const prev = portals;
    setPortals((rows) => rows.map((p) => (p.id === portal.id ? { ...p, status: next } : p)));
    const updated = await updatePortal(portal.id, { status: next });
    if (!updated) {
      setPortals(prev);
      toast.error("Couldn't update that portal.");
    }
  };

  const handleCopyLink = async (portal) => {
    try {
      await navigator.clipboard.writeText(portalShareUrl(portal.slug));
      toast.success("Portal link copied.");
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  };

  const handleDelete = async (portal) => {
    const prev = portals;
    setPortals((rows) => rows.filter((p) => p.id !== portal.id));
    const ok = await deletePortal(portal.id);
    if (!ok) {
      setPortals(prev);
      toast.error("Couldn't delete that portal.");
      return;
    }
    toast.success(`"${portal.name}" deleted.`);
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <div className="flex items-center gap-3">
          <PortalGlyph type={p.type} />
          <div className="min-w-0">
            <p className="max-w-[200px] truncate text-sm font-medium text-foreground">{p.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-text-tertiary">/u/{p.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (p) => (
        <Badge className={cn("border px-1.5 py-0 text-[10px]", TYPE_BADGE_COLORS[p.type])}>
          {TYPE_LABELS[p.type] || p.type}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <StatusPill status={p.status} map={PORTAL_STATUS_META} className="text-[10px]" />
      ),
    },
    {
      key: "submissions",
      header: "Submissions",
      align: "right",
      className: "tabular-nums text-xs text-text-secondary",
      render: (p) => p.submissionCount.toLocaleString(),
    },
    {
      key: "updated",
      header: "Updated",
      className: "text-xs text-text-secondary hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (p) => formatDate(p.updatedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <PortalRowActions
          portal={p}
          onView={(x) => openPortal(x.id)}
          onToggle={handleToggle}
          onCopyLink={handleCopyLink}
          onDelete={handleDelete}
        />
      ),
    },
  ];

  const cloudProviders = PROVIDERS.filter((p) => p.category === "cloud");
  const storageProviders = PROVIDERS.filter((p) => p.category === "storage");
  const stockProviders = PROVIDERS.filter((p) => p.category === "stock");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-border bg-background p-0 sm:max-w-3xl"
      >
        <SheetHeader className="gap-1 border-b border-border p-6 pb-4">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold text-foreground">
                Sources &amp; Portals
              </SheetTitle>
              <SheetDescription className="mt-1 text-sm text-text-secondary">
                Connect the cloud drives, buckets and stock libraries you import from.
              </SheetDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setShowPortals(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Portals &amp; settings
              {pendingSubmissions > 0 ? (
                <Badge className="ml-1 border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-300">
                  {pendingSubmissions}
                </Badge>
              ) : null}
            </Button>
          </div>
          {connected.size > 0 ? (
            <Badge className="mt-2 w-fit border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
              {connected.size} provider{connected.size !== 1 ? "s" : ""} connected
            </Badge>
          ) : null}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-6">

          <div className="flex flex-col gap-6">
            <ProviderSection
              title="Cloud Storage"
              providers={cloudProviders}
              connected={connected}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
            <ProviderSection
              title="Object Storage & FTP"
              providers={storageProviders}
              connected={connected}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
            <ProviderSection
              title="Stock Libraries"
              providers={stockProviders}
              connected={connected}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
          </div>
        </div>

        <Dialog open={showPortals} onOpenChange={setShowPortals}>
          <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-4 overflow-hidden border-border bg-background text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Portals &amp; import settings
              </DialogTitle>
              <DialogDescription className="text-sm text-text-secondary">
                Collect files through shareable links and forms, and set the rules every incoming
                file follows.
              </DialogDescription>
            </DialogHeader>
            <div className="-mr-1 min-h-0 flex-1 space-y-8 overflow-y-auto pr-1">

              <div>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      Upload Portals
                      {pendingSubmissions > 0 ? (
                        <Badge className="border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-300">
                          {pendingSubmissions} pending
                        </Badge>
                      ) : null}
                    </h2>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      Shareable links and forms for external contributors to submit files
                    </p>
                  </div>
                  <Button
                    className="h-8 shrink-0 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    New Portal
                  </Button>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search portals…"
                    className="w-44"
                  />
                  <FilterDropdown
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                    options={STATUS_FILTER_OPTIONS}
                    placeholder="Status"
                    icon={SlidersHorizontal}
                  />
                  <FilterDropdown
                    value={typeFilter}
                    onValueChange={setTypeFilter}
                    options={TYPE_FILTER_OPTIONS}
                    placeholder="Type"
                  />
                  <FilterDropdown
                    value={sortValue}
                    onValueChange={setSortValue}
                    options={SORT_OPTIONS}
                    placeholder="Sort"
                    icon={ArrowUpDown}
                  />
                  {hasPortalFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
                      onClick={clearFilters}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Clear
                    </Button>
                  )}
                </div>

                {loading ? (
                  <LoadingArea panel className="h-48 py-0" />
                ) : (
                  <DataTable
                    columns={columns}
                    data={filtered}
                    getRowKey={(p) => p.id}
                    onRowClick={(p) => openPortal(p.id)}
                    empty={
                      <div className="rounded-xl border border-border bg-surface-subtle">
                        <EmptyState
                          icon={Inbox}
                          title="No portals found"
                          description={
                            hasPortalFilters
                              ? "Try adjusting your filters or search query."
                              : "Create your first upload portal to start collecting files."
                          }
                          action={
                            hasPortalFilters ? (
                              <Button
                                variant="outline"
                                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active"
                                onClick={clearFilters}
                              >
                                Clear filters
                              </Button>
                            ) : (
                              <Button
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={() => setShowCreate(true)}
                              >
                                <Plus className="h-4 w-4" />
                                New Portal
                              </Button>
                            )
                          }
                        />
                      </div>
                    }
                  />
                )}
              </div>

              <div>
                <h2 className="mb-4 text-sm font-semibold text-foreground">Import Settings</h2>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between rounded-xl border border-border bg-surface-subtle px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
                          <Zap className="h-3.5 w-3.5 text-text-secondary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Auto-approve files</p>
                          <p className="text-xs text-text-secondary">
                            Skip the review queue for incoming submissions
                          </p>
                        </div>
                      </div>
                      <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
                    </div>

                    <div className="rounded-xl border border-border bg-surface-subtle p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
                          <FolderOpen className="h-3.5 w-3.5 text-text-secondary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Default destination</p>
                          <p className="text-xs text-text-secondary">
                            Where incoming files land by default
                          </p>
                        </div>
                      </div>
                      <Select value={defaultFolder} onValueChange={setDefaultFolder}>
                        <SelectTrigger className="h-8 border-border bg-surface-card text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-surface-subtle text-foreground">
                          {FOLDER_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value} className="text-xs">
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-xl border border-border bg-surface-subtle p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
                          <AlertCircle className="h-3.5 w-3.5 text-text-secondary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">File size limit</p>
                          <p className="text-xs text-text-secondary">
                            Maximum size for incoming uploads
                          </p>
                        </div>
                      </div>
                      <Select value={sizeLimit} onValueChange={setSizeLimit}>
                        <SelectTrigger className="h-8 border-border bg-surface-card text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-surface-subtle text-foreground">
                          {SIZE_LIMIT_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value} className="text-xs">
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="rounded-xl border border-border bg-surface-subtle p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
                          <Shield className="h-3.5 w-3.5 text-text-secondary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Allowed file types</p>
                          <p className="text-xs text-text-secondary">
                            Files not matching will be rejected
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {FILE_TYPE_CHIPS.map(({ value, label }) => {
                          const active = allowedTypes.has(value);
                          return (
                            <button
                              key={value}
                              onClick={() => toggleAllowedType(value)}
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                                active
                                  ? "border-primary/40 bg-primary/10 text-primary"
                                  : "border-border bg-surface-card text-text-tertiary hover:bg-surface-hover hover:text-foreground",
                              )}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-surface-subtle p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
                            <Bell className="h-3.5 w-3.5 text-text-secondary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Email notifications</p>
                            <p className="text-xs text-text-secondary">
                              Get notified when new files are submitted
                            </p>
                          </div>
                        </div>
                        <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                      </div>
                      {emailNotifications && (
                        <Input
                          value={notificationEmail}
                          onChange={(e) => setNotificationEmail(e.target.value)}
                          placeholder="you@example.com"
                          type="email"
                          className="h-8 border-border bg-surface-card text-xs text-foreground placeholder:text-text-tertiary"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <CreatePortalDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onCreate={handleCreate}
        />
      </SheetContent>
    </Sheet>
  );
}

export default ExternalSourcesSheet;
