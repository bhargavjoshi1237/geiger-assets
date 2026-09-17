"use client";

import {
  ActionMenu,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
  LogoLoading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Ban,
  ChevronDown,
  Copy,
  Download,
  Eye,
  Link2,
  Lock,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
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
import {
  SHARE_EXPIRY_OPTIONS,
  SHARE_KIND_FILTER_OPTIONS,
  SHARE_KIND_MAP,
  SHARE_KIND_OPTIONS,
  SHARE_SCOPE_MAP,
  SHARE_SCOPE_OPTIONS,
  SHARE_STATUS_FILTER_OPTIONS,
  SHARE_STATUS_MAP,
  SHARE_VISIBILITY_FILTER_OPTIONS,
  SHARE_VISIBILITY_MAP,
  SHARE_VISIBILITY_OPTIONS,
  SORT_OPTIONS,
  expiryTtlToIso,
  formatDate,
  shareStatus,
} from "./constants";
import {
  createSharedLink,
  listSharedLinks,
  revokeSharedLink,
  softDeleteSharedLink,
  updateSharedLink,
} from "@/lib/supabase/collaboration";

function FilterDropdown({ value, onValueChange, options, placeholder, icon: Icon }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-8 gap-1.5 rounded-md border-border bg-surface-card px-3 text-xs font-medium text-foreground hover:bg-surface-subtle"
        >
          {Icon ? <Icon className="h-3.5 w-3.5 text-text-secondary" /> : null}
          {options.find((o) => o.value === value)?.label || placeholder}
          <ChevronDown className="h-3 w-3 text-text-secondary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="border-border bg-surface-subtle text-foreground" align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="cursor-pointer text-xs focus:bg-surface-hover focus:text-foreground"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const EMPTY_DRAFT = {
  label: "",
  kind: "asset",
  assetId: "",
  collectionName: "",
  visibility: "private",
  scope: "view",
  passwordProtected: false,
  passwordHint: "",
  expiryTtl: "604800",
};

function CreateLinkDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [error, setError] = useState("");
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.label.trim()) {
      setError("A label is required.");
      return;
    }
    if (draft.kind === "asset" && !draft.assetId.trim()) {
      setError("An asset ID is required for asset links.");
      return;
    }
    if (draft.kind === "collection" && !draft.collectionName.trim()) {
      setError("A collection name is required for collection links.");
      return;
    }
    onCreate({ ...draft, label: draft.label.trim() });
    setDraft(EMPTY_DRAFT);
    setError("");
    onOpenChange(false);
  };

  const close = (next) => {
    if (!next) {
      setDraft(EMPTY_DRAFT);
      setError("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New share link</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Share an asset or a collection outside the workspace. Asset links mint a
            signed delivery token through the share API.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Label" htmlFor="share-label">
            <Input
              id="share-label"
              value={draft.label}
              onChange={(e) => set("label")(e.target.value)}
              placeholder="e.g. Client preview — spring set"
              className="border-border bg-surface-card text-foreground"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kind">
              <Select value={draft.kind} onValueChange={set("kind")}>
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle text-foreground">
                  {SHARE_KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Visibility">
              <Select value={draft.visibility} onValueChange={set("visibility")}>
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle text-foreground">
                  {SHARE_VISIBILITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {draft.kind === "asset" ? (
            <Field label="Asset ID" htmlFor="share-asset">
              <Input
                id="share-asset"
                value={draft.assetId}
                onChange={(e) => set("assetId")(e.target.value)}
                placeholder="Asset UUID to share"
                className="border-border bg-surface-card text-foreground"
              />
            </Field>
          ) : (
            <Field label="Collection name" htmlFor="share-collection">
              <Input
                id="share-collection"
                value={draft.collectionName}
                onChange={(e) => set("collectionName")(e.target.value)}
                placeholder="e.g. Spring campaign selects"
                className="border-border bg-surface-card text-foreground"
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Access">
              <Select value={draft.scope} onValueChange={set("scope")}>
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle text-foreground">
                  {SHARE_SCOPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Expiry">
              <Select value={draft.expiryTtl} onValueChange={set("expiryTtl")}>
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle text-foreground">
                  {SHARE_EXPIRY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-card px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Password protection</p>
              <p className="text-xs text-text-secondary">Recipients must enter a password.</p>
            </div>
            <Switch
              checked={draft.passwordProtected}
              onCheckedChange={set("passwordProtected")}
              aria-label="Password protection"
            />
          </div>
          {draft.passwordProtected ? (
            <Field label="Password hint" htmlFor="share-hint">
              <Input
                id="share-hint"
                value={draft.passwordHint}
                onChange={(e) => set("passwordHint")(e.target.value)}
                placeholder="Hint shown to recipients"
                className="border-border bg-surface-card text-foreground"
              />
            </Field>
          ) : null}
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
            onClick={() => close(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            Create link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Delivery tokens are minted by the real share route — the row in
// assets.shared_links is only the workspace's handle for the token.
async function mintDeliveryToken({ assetId, scope, ttlSeconds }) {
  try {
    const res = await fetch("/api/media/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId,
        variant: "original",
        scope: scope === "download" ? "download" : "view",
        ttlSeconds: ttlSeconds ? Number(ttlSeconds) : undefined,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { error: body?.error || `http_${res.status}` };
    return { token: body?.token ?? "", url: body?.url ?? "", expiresAt: body?.expiresAt ?? "" };
  } catch {
    return { error: "network" };
  }
}

function absoluteUrl(url) {
  if (!url) return "";
  if (/^https?:/i.test(url)) return url;
  if (typeof window === "undefined") return url;
  return new URL(url.startsWith("/") ? url : `/${url}`, window.location.origin).toString();
}

// The signing route caps tokens at 30 days, so "no expiry" still mints the
// longest-lived token it allows — the row keeps no expiry, the bearer does not.
const MAX_MINT_TTL = "2592000";

function ttlForMint(expiryTtl) {
  return expiryTtl && expiryTtl !== "none" ? expiryTtl : MAX_MINT_TTL;
}

function remainingTtlSeconds(expiresAt, fallback = "604800") {
  if (!expiresAt) return fallback;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return fallback;
  return String(Math.min(Math.floor(ms / 1000), Number(MAX_MINT_TTL)));
}

export function SharedLinksScreen({ projectId }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortValue, setSortValue] = useState("updated-desc");
  const [showCreate, setShowCreate] = useState(false);
  const [refreshingId, setRefreshingId] = useState(null);

  useEffect(() => {
    let alive = true;
    listSharedLinks(projectId).then((rows) => {
      if (!alive) return;
      setLinks(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    let result = [...links];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.label.toLowerCase().includes(q) ||
          (l.collectionName || "").toLowerCase().includes(q) ||
          (l.assetId || "").toLowerCase().includes(q),
      );
    }
    if (kindFilter !== "all") result = result.filter((l) => l.kind === kindFilter);
    if (visibilityFilter !== "all") result = result.filter((l) => l.visibility === visibilityFilter);
    if (statusFilter !== "all") result = result.filter((l) => shareStatus(l) === statusFilter);

    const [field, direction] = sortValue.split("-");
    result.sort((a, b) => {
      let cmp = 0;
      if (field === "updated") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
      else if (field === "created") cmp = new Date(a.createdAt) - new Date(b.createdAt);
      else if (field === "title") cmp = a.label.localeCompare(b.label);
      return direction === "desc" ? -cmp : cmp;
    });
    return result;
  }, [links, search, kindFilter, visibilityFilter, statusFilter, sortValue]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${kindFilter}|${visibilityFilter}|${statusFilter}|${sortValue}`,
  });

  const stats = useMemo(() => {
    const active = links.filter((l) => shareStatus(l) === "active");
    const views = links.reduce((sum, l) => sum + (Number(l.viewCount) || 0), 0);
    return [
      { label: "Active links", value: String(active.length), footer: "currently shareable" },
      {
        label: "Public",
        value: String(links.filter((l) => l.visibility === "public").length),
        footer: "anyone with the link",
      },
      {
        label: "Private",
        value: String(links.filter((l) => l.visibility !== "public").length),
        footer: "token only",
      },
      { label: "Total views", value: String(views), footer: "across all links" },
    ];
  }, [links]);

  const hasActiveFilters =
    kindFilter !== "all" || visibilityFilter !== "all" || statusFilter !== "all" || Boolean(search);

  const clearFilters = () => {
    setKindFilter("all");
    setVisibilityFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  const handleCreate = async (draft) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const expiresAt = expiryTtlToIso(draft.expiryTtl);
    const optimistic = {
      id,
      projectId: projectId ?? null,
      label: draft.label,
      kind: draft.kind,
      assetId: draft.kind === "asset" ? draft.assetId.trim() : null,
      collectionId: null,
      collectionName: draft.kind === "collection" ? draft.collectionName.trim() : "",
      visibility: draft.visibility,
      scope: draft.scope,
      passwordProtected: draft.passwordProtected,
      passwordHint: draft.passwordHint,
      token: "",
      url: "",
      viewCount: 0,
      expiresAt,
      revokedAt: "",
      isActive: true,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    };
    setLinks((rows) => [optimistic, ...rows]);
    const created = await createSharedLink({ id, ...draft, assetId: optimistic.assetId, expiresAt });
    if (!created) {
      setLinks((rows) => rows.filter((l) => l.id !== id));
      toast.error("Couldn't create the share link.");
      return;
    }
    setLinks((rows) => rows.map((l) => (l.id === id ? created : l)));

    // Collection links have no single asset to sign for — the row is the link.
    if (created.kind !== "asset" || !created.assetId) {
      toast.success("Share link created");
      return;
    }
    const minted = await mintDeliveryToken({
      assetId: created.assetId,
      scope: created.scope,
      ttlSeconds: ttlForMint(draft.expiryTtl),
    });
    if (!minted.token) {
      toast.error(`Link saved, but no delivery token could be minted (${minted.error}).`);
      return;
    }
    const saved = await updateSharedLink(created.id, {
      token: minted.token,
      url: minted.url,
      expiresAt: minted.expiresAt || created.expiresAt,
    });
    if (saved) {
      setLinks((rows) => rows.map((l) => (l.id === saved.id ? saved : l)));
      toast.success("Share link created");
    } else {
      toast.error("Link created, but the token couldn't be saved to it.");
    }
  };

  const handleRefreshToken = async (link) => {
    if (!link.assetId) {
      toast.error("Only asset links can mint a new token.");
      return;
    }
    setRefreshingId(link.id);
    const minted = await mintDeliveryToken({
      assetId: link.assetId,
      scope: link.scope,
      ttlSeconds: remainingTtlSeconds(link.expiresAt),
    });
    setRefreshingId(null);
    if (!minted.token) {
      toast.error(`Couldn't mint a new token (${minted.error}).`);
      return;
    }
    const prev = links;
    setLinks((rows) =>
      rows.map((l) =>
        l.id === link.id
          ? { ...l, token: minted.token, url: minted.url, expiresAt: minted.expiresAt || l.expiresAt }
          : l,
      ),
    );
    const saved = await updateSharedLink(link.id, {
      token: minted.token,
      url: minted.url,
      expiresAt: minted.expiresAt || link.expiresAt,
    });
    if (saved) {
      setLinks((rows) => rows.map((l) => (l.id === saved.id ? saved : l)));
      toast.success("Issued a fresh token for the link.");
    } else {
      setLinks(prev);
      toast.error("Couldn't save the new token.");
    }
  };

  const handleCopy = async (link) => {
    const absolute = absoluteUrl(link.url);
    if (!absolute) {
      toast.error("This link has no URL yet.");
      return;
    }
    try {
      await navigator.clipboard.writeText(absolute);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const handleRevoke = async (link) => {
    const prev = links;
    const now = new Date().toISOString();
    setLinks((rows) =>
      rows.map((l) => (l.id === link.id ? { ...l, isActive: false, revokedAt: now } : l)),
    );
    const saved = await revokeSharedLink(link.id);
    if (saved) {
      setLinks((rows) => rows.map((l) => (l.id === saved.id ? saved : l)));
      toast.success("Link revoked");
    } else {
      setLinks(prev);
      toast.error("Couldn't revoke the link.");
    }
  };

  const handleDelete = async (link) => {
    const prev = links;
    setLinks((rows) => rows.filter((l) => l.id !== link.id));
    const ok = await softDeleteSharedLink(link.id);
    if (ok) toast.success("Link deleted");
    else {
      setLinks(prev);
      toast.error("Couldn't delete the link.");
    }
  };

  const columns = [
    {
      key: "label",
      header: "Link",
      render: (l) => (
        <div className="min-w-0">
          <p className="flex max-w-[280px] items-center gap-1.5 truncate text-sm font-medium text-foreground">
            <span className="truncate">{l.label || "Untitled link"}</span>
            {l.passwordProtected ? <Lock className="h-3 w-3 shrink-0 text-text-tertiary" aria-label="Password protected" /> : null}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
            {l.kind === "asset"
              ? `Asset ${l.assetId ? `${l.assetId.slice(0, 8)}…` : "—"}`
              : `Collection · ${l.collectionName || "—"}`}
            {" · "}
            {SHARE_SCOPE_MAP[l.scope]?.label || l.scope}
          </p>
        </div>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      render: (l) => <StatusPill status={l.kind} map={SHARE_KIND_MAP} className="text-[10px]" />,
    },
    {
      key: "visibility",
      header: "Visibility",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (l) => (
        <StatusPill status={l.visibility} map={SHARE_VISIBILITY_MAP} className="text-[10px]" />
      ),
    },
    {
      key: "access",
      header: "Access",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (l) => (
        <span className="flex items-center gap-1.5">
          {l.scope === "download" ? (
            <Download className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Eye className="h-3.5 w-3.5 text-sky-400" />
          )}
          {l.scope === "download" ? "Download" : "View only"}
        </span>
      ),
    },
    {
      key: "expiry",
      header: "Expires",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (l) => (l.expiresAt ? formatDate(l.expiresAt) : "No expiry"),
    },
    {
      key: "views",
      header: "Views",
      align: "right",
      className: "text-right text-xs tabular-nums text-text-secondary",
      render: (l) => String(l.viewCount ?? 0),
    },
    {
      key: "status",
      header: "Status",
      render: (l) => (
        <StatusPill status={shareStatus(l)} map={SHARE_STATUS_MAP} className="text-[10px]" />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (l) => {
        const status = shareStatus(l);
        return (
          <ActionMenu
            label={`Actions for ${l.label}`}
            items={[
              {
                icon: Copy,
                label: "Copy link",
                disabled: !l.url,
                onSelect: () => handleCopy(l),
              },
              l.kind === "asset" && l.assetId && status === "active"
                ? {
                    icon: RefreshCw,
                    label: refreshingId === l.id ? "Minting…" : "Refresh token",
                    spin: refreshingId === l.id,
                    disabled: refreshingId === l.id,
                    onSelect: () => handleRefreshToken(l),
                  }
                : null,
              { separator: true },
              status === "active"
                ? {
                    icon: Ban,
                    label: "Revoke",
                    onSelect: () => handleRevoke(l),
                  }
                : null,
              {
                icon: Trash2,
                label: "Delete",
                destructive: true,
                onSelect: () => handleDelete(l),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="Shared Links"
        description="Share individual assets and curated sets outside the workspace."
        actions={
          <Button
            className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New link
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={kindFilter}
            onValueChange={setKindFilter}
            options={SHARE_KIND_FILTER_OPTIONS}
            placeholder="Kind"
            icon={SlidersHorizontal}
          />
          <FilterDropdown
            value={visibilityFilter}
            onValueChange={setVisibilityFilter}
            options={SHARE_VISIBILITY_FILTER_OPTIONS}
            placeholder="Visibility"
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={SHARE_STATUS_FILTER_OPTIONS}
            placeholder="Status"
          />
          <FilterDropdown
            value={sortValue}
            onValueChange={setSortValue}
            options={SORT_OPTIONS}
            placeholder="Sort"
            icon={ArrowUpDown}
          />
          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
              onClick={clearFilters}
            >
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          ) : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search links..." />
      </Toolbar>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(l) => l.id}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                {links.length === 0 ? (
                  <EmptyState
                    icon={Link2}
                    title="No share links yet"
                    description="Create your first link to share work outside the workspace."
                    action={
                      <Button
                        className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                        onClick={() => setShowCreate(true)}
                      >
                        <Plus className="mr-1.5 h-4 w-4" />
                        New link
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={Link2}
                    title="No matching links"
                    description="No links match the current search and filter."
                    action={
                      <Button variant="ghost" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    }
                  />
                )}
              </div>
            }
          />
          <ListPagination {...pager} itemLabel="links" />
        </div>
      )}

      <CreateLinkDialog open={showCreate} onOpenChange={setShowCreate} onCreate={handleCreate} />
    </MainScreenWrapper>
  );
}

export default SharedLinksScreen;
