"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  ExternalLink,
  Link2,
  Lock,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Ban,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
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
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";

import {
  listShareLinks,
  createShareLink,
  updateShareLink,
  revokeShareLink,
  softDeleteShareLink,
  mintToken,
} from "@/lib/supabase/shares";
import { listAssets } from "@/lib/supabase/assets";
import { listCollections } from "@/lib/supabase/collections";
import { getUser } from "@/lib/supabase/user";
import { uniqueId } from "@/lib/utils";

import {
  SHARE_STATUS_MAP,
  SHARE_VISIBILITY_MAP,
  SHARE_STATUS_FILTER_OPTIONS,
  SHARE_VISIBILITY_FILTER_OPTIONS,
  SHARE_TARGET_OPTIONS,
  EXPIRY_PRESETS,
  formatDate,
  formatRelative,
  isExpiringSoon,
  shareUrl,
} from "./constants";

const EMPTY_DRAFT = {
  name: "",
  subjectType: "asset",
  subjectId: "",
  visibility: "private",
  password: "",
  expiry: "30d",
  allowDownload: true,
  allowComments: false,
};

function expiryToIso(preset) {
  const found = EXPIRY_PRESETS.find((p) => p.value === preset);
  if (!found?.days) return null;
  return new Date(Date.now() + found.days * 86400000).toISOString();
}

function copyToClipboard(text, message) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    toast.error("Clipboard isn't available in this browser.");
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => toast.success(message),
    () => toast.error("Couldn't copy the link."),
  );
}

function ShareLinkDialog({ open, onOpenChange, onSubmit, assets, collections, initial }) {
  const [draft, setDraft] = useState(initial || EMPTY_DRAFT);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  // Re-seed the form whenever the dialog opens onto a different link.
  const [seed, setSeed] = useState(initial);
  if (initial !== seed) {
    setSeed(initial);
    setDraft(initial || EMPTY_DRAFT);
  }

  const targets = draft.subjectType === "collection" ? collections : assets;
  const editing = Boolean(initial?.id);

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the link a name so you can recognise it later.");
      return;
    }
    if (!draft.subjectId) {
      toast.error(
        draft.subjectType === "collection"
          ? "Pick the collection this link shares."
          : "Pick the asset this link shares.",
      );
      return;
    }
    onSubmit(draft);
    setDraft(EMPTY_DRAFT);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-background">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit shared link" : "Create shared link"}</DialogTitle>
          <DialogDescription>
            Anyone with the URL can open this link until it expires or you revoke it.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="grid gap-4"
        >
          <Field label="Link name" htmlFor="share-name">
            <Input
              id="share-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Autumn campaign — client review"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Shares">
              <Select
                value={draft.subjectType}
                onValueChange={(v) => setDraft((d) => ({ ...d, subjectType: v, subjectId: "" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHARE_TARGET_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={draft.subjectType === "collection" ? "Collection" : "Asset"}>
              <Select value={draft.subjectId} onValueChange={set("subjectId")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {(targets || []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Visibility" hint="Restricted links still need the URL.">
              <Select value={draft.visibility} onValueChange={set("visibility")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Restricted — anyone with the link</SelectItem>
                  <SelectItem value="public">Public — discoverable</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Expires">
              <Select value={draft.expiry} onValueChange={set("expiry")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="Password"
            hint="Optional. Not yet enforced on the public page — treat it as a reminder, not protection."
            htmlFor="share-password"
          >
            <Input
              id="share-password"
              value={draft.password}
              onChange={(e) => set("password")(e.target.value)}
              placeholder="Leave empty for no password"
            />
          </Field>

          <div className="grid gap-3 rounded-lg border border-border bg-surface-card p-3">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="text-foreground">Allow downloads</span>
              <Switch
                checked={draft.allowDownload}
                onCheckedChange={set("allowDownload")}
              />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="text-foreground">Allow comments</span>
              <Switch
                checked={draft.allowComments}
                onCheckedChange={set("allowComments")}
              />
            </label>
          </div>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            {editing ? "Save changes" : "Create link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SharedLinksScreen({ projectId }) {
  const [links, setLinks] = useState([]);
  const [assets, setAssets] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let alive = true;
    listShareLinks(projectId).then((rows) => {
      if (!alive) return;
      setLinks(rows ?? []);
      setLoading(false);
    });
    listAssets(projectId).then((rows) => alive && setAssets(rows ?? []));
    listCollections(projectId).then((rows) => alive && setCollections(rows ?? []));
    getUser().then((u) => alive && setUser(u));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const targetName = useMemo(() => {
    const map = new Map([
      ...assets.map((a) => [a.id, a.name]),
      ...collections.map((c) => [c.id, c.name]),
    ]);
    return (id) => map.get(id) || "Unknown target";
  }, [assets, collections]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return links.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (visibility !== "all" && l.visibility !== visibility) return false;
      if (term && !`${l.name} ${targetName(l.subjectId)}`.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  }, [links, search, status, visibility, targetName]);

  const stats = useMemo(() => {
    const active = links.filter((l) => l.status === "active").length;
    const views = links.reduce((s, l) => s + l.viewCount, 0);
    const downloads = links.reduce((s, l) => s + l.downloadCount, 0);
    const expiring = links.filter(
      (l) => l.status === "active" && isExpiringSoon(l.expiresAt),
    ).length;
    return [
      { label: "Active links", value: String(active), footer: `${links.length} total` },
      { label: "Views", value: views.toLocaleString("en-US"), footer: "All time" },
      { label: "Downloads", value: downloads.toLocaleString("en-US"), footer: "All time" },
      {
        label: "Expiring soon",
        value: String(expiring),
        footer: "Within 7 days",
      },
    ];
  }, [links]);

  const handleCreate = (draft) => {
    const link = {
      id: uniqueId(),
      projectId,
      name: draft.name.trim(),
      token: mintToken(),
      subjectType: draft.subjectType,
      subjectId: draft.subjectId,
      visibility: draft.visibility,
      password: draft.password,
      expiresAt: expiryToIso(draft.expiry),
      allowDownload: draft.allowDownload,
      allowComments: draft.allowComments,
      status: "active",
      viewCount: 0,
      downloadCount: 0,
      createdBy: user?.id || null,
      actorName: user?.name || "",
    };
    setLinks((prev) => [{ ...link, hasPassword: Boolean(draft.password) }, ...prev]);
    createShareLink(link).then((saved) => {
      if (saved) {
        setLinks((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
        toast.success(`"${link.name}" is live.`);
      } else {
        setLinks((prev) => prev.filter((l) => l.id !== link.id));
        toast.error("Couldn't create the shared link.");
      }
    });
  };

  const handleEdit = (draft) => {
    const id = editing?.id;
    if (!id) return;
    const previous = links.find((l) => l.id === id);
    const patch = {
      name: draft.name.trim(),
      subjectType: draft.subjectType,
      subjectId: draft.subjectId,
      visibility: draft.visibility,
      password: draft.password,
      expiresAt: expiryToIso(draft.expiry),
      allowDownload: draft.allowDownload,
      allowComments: draft.allowComments,
    };
    setLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch, hasPassword: Boolean(draft.password) } : l)),
    );
    setEditing(null);
    updateShareLink(id, patch).then((saved) => {
      if (saved) {
        setLinks((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
        toast.success("Link updated.");
      } else {
        if (previous) setLinks((prev) => prev.map((l) => (l.id === id ? previous : l)));
        toast.error("Couldn't save your changes.");
      }
    });
  };

  const handleRevoke = (link) => {
    setLinks((prev) =>
      prev.map((l) => (l.id === link.id ? { ...l, status: "revoked" } : l)),
    );
    revokeShareLink(link.id, user || {}).then((saved) => {
      if (!saved) {
        setLinks((prev) =>
          prev.map((l) => (l.id === link.id ? { ...l, status: link.status } : l)),
        );
        toast.error("Couldn't revoke the link.");
        return;
      }
      toast.success(`"${link.name}" revoked — the URL no longer resolves.`);
    });
  };

  const handleDelete = (link) => {
    setDeleteTarget(null);
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
    softDeleteShareLink(link.id).then((ok) => {
      if (!ok) {
        setLinks((prev) => [link, ...prev]);
        toast.error("Couldn't delete the link.");
        return;
      }
      toast.success(`Deleted "${link.name}".`);
    });
  };

  const openEdit = (link) => {
    const preset =
      EXPIRY_PRESETS.find((p) => {
        if (!link.expiresAt) return p.value === "never";
        if (!p.days) return false;
        const target = Date.now() + p.days * 86400000;
        return Math.abs(new Date(link.expiresAt).getTime() - target) < 86400000;
      })?.value || (link.expiresAt ? "30d" : "never");
    setEditing({
      id: link.id,
      name: link.name,
      subjectType: link.subjectType,
      subjectId: link.subjectId || "",
      visibility: link.visibility,
      password: "",
      expiry: preset,
      allowDownload: link.allowDownload,
      allowComments: link.allowComments,
    });
    setDialogOpen(true);
  };

  const columns = [
    {
      key: "name",
      header: "Link",
      render: (l) => (
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            {l.name}
            {l.hasPassword ? (
              <Lock className="h-3 w-3 text-text-tertiary" aria-label="Password protected" />
            ) : null}
          </span>
          <span className="text-xs text-text-secondary">
            {l.subjectType === "collection" ? "Collection" : "Asset"} ·{" "}
            {targetName(l.subjectId)}
          </span>
        </div>
      ),
    },
    {
      key: "visibility",
      header: "Visibility",
      render: (l) => (
        <Badge variant={SHARE_VISIBILITY_MAP[l.visibility]?.variant || "neutral"}>
          {SHARE_VISIBILITY_MAP[l.visibility]?.label || l.visibility}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (l) => <StatusPill status={l.status} map={SHARE_STATUS_MAP} />,
    },
    {
      key: "expires",
      header: "Expires",
      className: "text-text-secondary",
      render: (l) => {
        if (!l.expiresAt) return "Never";
        const soon = isExpiringSoon(l.expiresAt);
        return (
          <span className={soon ? "text-amber-400" : undefined}>
            {formatRelative(l.expiresAt)}
          </span>
        );
      },
    },
    {
      key: "views",
      header: "Views",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (l) => l.viewCount.toLocaleString("en-US"),
    },
    {
      key: "downloads",
      header: "Downloads",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (l) => l.downloadCount.toLocaleString("en-US"),
    },
    {
      key: "created",
      header: "Created",
      className: "text-text-secondary",
      render: (l) => formatDate(l.createdAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (l) => (
        <ActionMenu
          label="Link actions"
          items={[
            {
              icon: Copy,
              label: "Copy URL",
              onSelect: () => copyToClipboard(shareUrl(l.token), "Link copied."),
            },
            {
              icon: ExternalLink,
              label: "Open",
              onSelect: () => window.open(shareUrl(l.token), "_blank", "noopener"),
            },
            { icon: Pencil, label: "Edit", onSelect: () => openEdit(l) },
            { separator: true },
            ...(l.status === "revoked"
              ? []
              : [{ icon: Ban, label: "Revoke", onSelect: () => handleRevoke(l) }]),
            {
              icon: Trash2,
              label: "Delete",
              variant: "destructive",
              onSelect: () => setDeleteTarget(l),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Shared Links"
        description="Every way an asset leaves this workspace, in one revocable place. Set who can open a link, whether they can download, and when access ends."
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
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={status}
            onValueChange={setStatus}
            options={SHARE_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={visibility}
            onValueChange={setVisibility}
            options={SHARE_VISIBILITY_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search links…" />
      </Toolbar>

      {loading ? (
        <LoadingArea panel size={48} label="Loading shared links…" />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(l) => l.id}
          onRowClick={(l) => copyToClipboard(shareUrl(l.token), "Link copied.")}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={links.length ? Link2 : Share2}
                title={links.length ? "No links match your filters" : "No shared links yet"}
                description={
                  links.length
                    ? "Try clearing the search or filters, or create a new link."
                    : "Share an asset or a collection with someone outside the workspace — and keep the ability to switch it off."
                }
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
          }
        />
      )}

      <ShareLinkDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        onSubmit={editing ? handleEdit : handleCreate}
        assets={assets}
        collections={collections}
        initial={editing}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete shared link</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>? The
              URL stops working immediately and its view history is lost. Revoke instead if
              you want to keep the record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => handleDelete(deleteTarget)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default SharedLinksScreen;
