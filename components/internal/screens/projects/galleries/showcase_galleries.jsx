"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Images, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
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
  SHOWCASE_STATUS_FILTER_OPTIONS,
  SHOWCASE_STATUS_MAP,
  SHOWCASE_VISIBILITY_FILTER_OPTIONS,
  SHOWCASE_VISIBILITY_MAP,
  formatCount,
} from "./constants";
import {
  createShowcase,
  listShowcases,
  softDeleteShowcase,
  updateShowcase,
} from "@/lib/supabase/galleries";

// Showcase Galleries — public and private showcases, password protection,
// favorites and proofing, download requests, visitor analytics.

const EMPTY_DRAFT = {
  name: "",
  description: "",
  visibility: "private",
  isPasswordProtected: false,
  proofingEnabled: false,
  downloadsEnabled: false,
};

const VISIBILITY_OPTIONS = Object.entries(SHOWCASE_VISIBILITY_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

const STATUS_OPTIONS = Object.entries(SHOWCASE_STATUS_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

function ShowcaseDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [status, setStatus] = useState("draft");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDraft({ ...EMPTY_DRAFT, ...(initial || {}) });
    setStatus(initial?.status || "draft");
    setBusy(false);
  }, [open, initial]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give the showcase a name.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      name,
      description: draft.description.trim(),
      visibility: draft.visibility,
      isPasswordProtected: draft.visibility === "password" || Boolean(draft.isPasswordProtected),
      proofingEnabled: Boolean(draft.proofingEnabled),
      downloadsEnabled: Boolean(draft.downloadsEnabled),
      status,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit showcase" : "New showcase"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Control who can visit, whether proofing is on, and if visitors may request downloads.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="showcase-name">
            <Input
              id="showcase-name"
              className="bg-surface-card"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Client review — Miller wedding…"
              autoFocus
            />
          </Field>
          <Field label="Description" htmlFor="showcase-desc">
            <Textarea
              id="showcase-desc"
              className="min-h-20 bg-surface-card"
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="What should visitors know?"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Visibility">
              <Select value={draft.visibility} onValueChange={set("visibility")}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((o) => (
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
          <div className="grid gap-2">
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Password protection</p>
                <p className="text-xs text-text-secondary">Require a password to enter.</p>
              </div>
              <Switch
                checked={draft.visibility === "password" || draft.isPasswordProtected}
                onCheckedChange={(v) => {
                  set("isPasswordProtected")(v);
                  if (v && draft.visibility === "private") set("visibility")("password");
                }}
                aria-label="Password protection"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Proofing</p>
                <p className="text-xs text-text-secondary">Visitors can favorite and comment.</p>
              </div>
              <Switch
                checked={draft.proofingEnabled}
                onCheckedChange={set("proofingEnabled")}
                aria-label="Proofing"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Download requests</p>
                <p className="text-xs text-text-secondary">Visitors may request files.</p>
              </div>
              <Switch
                checked={draft.downloadsEnabled}
                onCheckedChange={set("downloadsEnabled")}
                aria-label="Download requests"
              />
            </div>
          </div>
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
            {editing ? "Save changes" : "Create showcase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ShowcaseGalleriesScreen({ projectId }) {
  const [showcases, setShowcases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let alive = true;
    listShowcases(projectId).then((rows) => {
      if (!alive) return;
      setShowcases(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const stats = useMemo(
    () => [
      { label: "Showcases", value: String(showcases.length), footer: "client-facing views" },
      {
        label: "Live",
        value: String(showcases.filter((s) => s.status === "live").length),
        footer: "open to visitors",
      },
      {
        label: "Visits",
        value: formatCount(showcases.reduce((s, x) => s + x.viewCount, 0)),
        footer: "visitor analytics",
      },
      {
        label: "Requests",
        value: formatCount(showcases.reduce((s, x) => s + x.downloadRequestCount, 0)),
        footer: "download requests",
      },
    ],
    [showcases],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return showcases.filter((showcase) => {
      if (visibilityFilter !== "all" && showcase.visibility !== visibilityFilter) return false;
      if (statusFilter !== "all" && showcase.status !== statusFilter) return false;
      if (
        needle &&
        !`${showcase.name} ${showcase.description}`.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [showcases, search, visibilityFilter, statusFilter]);

  const filtersActive =
    visibilityFilter !== "all" || statusFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setVisibilityFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (showcase) => {
    setEditing(showcase);
    setDialogOpen(true);
  };

  const submitShowcase = async (draft) => {
    if (editing) {
      const previous = showcases;
      setShowcases((rows) =>
        rows.map((s) => (s.id === editing.id ? { ...s, ...draft } : s)),
      );
      const saved = await updateShowcase(editing.id, draft);
      if (!saved) {
        setShowcases(previous);
        toast.error("Could not save the showcase.");
        return false;
      }
      setShowcases((rows) => rows.map((s) => (s.id === saved.id ? saved : s)));
      toast.success(`Saved “${saved.name}”.`);
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      galleryId: null,
      viewCount: 0,
      favoriteCount: 0,
      downloadRequestCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setShowcases((rows) => [optimistic, ...rows]);
    const created = await createShowcase({ id, projectId, ...draft });
    if (!created) {
      setShowcases((rows) => rows.filter((s) => s.id !== id));
      toast.error("Could not create the showcase.");
      return false;
    }
    setShowcases((rows) => rows.map((s) => (s.id === id ? created : s)));
    toast.success(`Created “${created.name}”.`);
    return true;
  };

  const toggleProofing = async (showcase) => {
    const previous = showcases;
    setShowcases((rows) =>
      rows.map((s) =>
        s.id === showcase.id ? { ...s, proofingEnabled: !s.proofingEnabled } : s,
      ),
    );
    const saved = await updateShowcase(showcase.id, {
      proofingEnabled: !showcase.proofingEnabled,
    });
    if (!saved) {
      setShowcases(previous);
      toast.error("Could not change proofing.");
      return;
    }
    setShowcases((rows) => rows.map((s) => (s.id === saved.id ? saved : s)));
    toast.success(`Proofing ${saved.proofingEnabled ? "on" : "off"} for “${saved.name}”.`);
  };

  const duplicateShowcase = async (showcase) => {
    const id = crypto.randomUUID();
    const copy = `Copy of ${showcase.name}`;
    const optimistic = {
      ...showcase,
      id,
      name: copy,
      status: "draft",
      viewCount: 0,
      favoriteCount: 0,
      downloadRequestCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setShowcases((rows) => [optimistic, ...rows]);
    const created = await createShowcase({
      id,
      projectId,
      name: copy,
      description: showcase.description,
      visibility: showcase.visibility,
      status: "draft",
      isPasswordProtected: showcase.isPasswordProtected,
      proofingEnabled: showcase.proofingEnabled,
      downloadsEnabled: showcase.downloadsEnabled,
    });
    if (!created) {
      setShowcases((rows) => rows.filter((s) => s.id !== id));
      toast.error("Could not duplicate the showcase.");
      return;
    }
    setShowcases((rows) => rows.map((s) => (s.id === id ? created : s)));
    toast.success(`Duplicated as “${created.name}”.`);
  };

  const removeShowcase = async (showcase) => {
    const previous = showcases;
    setShowcases((rows) => rows.filter((s) => s.id !== showcase.id));
    const ok = await softDeleteShowcase(showcase.id);
    if (!ok) {
      setShowcases(previous);
      toast.error("Could not delete the showcase.");
      return;
    }
    toast.success(`Deleted “${showcase.name}”.`);
  };

  const columns = [
    {
      key: "name",
      header: "Showcase",
      render: (showcase) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">
            {showcase.name || "Untitled showcase"}
          </span>
          <span className="truncate text-xs text-text-secondary">
            {formatCount(showcase.viewCount)} visits · {formatCount(showcase.favoriteCount)}{" "}
            favorites · {formatCount(showcase.downloadRequestCount)} requests
          </span>
        </div>
      ),
    },
    {
      key: "visibility",
      header: "Access",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (showcase) => (
        <StatusPill status={showcase.visibility} map={SHOWCASE_VISIBILITY_MAP} />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (showcase) => <StatusPill status={showcase.status} map={SHOWCASE_STATUS_MAP} />,
    },
    {
      key: "proofing",
      header: "Proofing",
      align: "right",
      className: "text-right",
      render: (showcase) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={showcase.proofingEnabled}
            aria-label={`Proofing for ${showcase.name}`}
            onCheckedChange={() => toggleProofing(showcase)}
          />
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (showcase) => (
        <ActionMenu
          label={`Actions for ${showcase.name}`}
          items={[
            {
              icon: ShieldCheck,
              label: showcase.proofingEnabled ? "Turn proofing off" : "Turn proofing on",
              onSelect: () => toggleProofing(showcase),
            },
            { icon: Pencil, label: "Edit", onSelect: () => openEdit(showcase) },
            { icon: Copy, label: "Duplicate", onSelect: () => duplicateShowcase(showcase) },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              destructive: true,
              onSelect: () => removeShowcase(showcase),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Showcase Galleries"
        description="Public and private showcases — passwords, proofing, download requests, visitor analytics."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> New showcase
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={visibilityFilter}
            onValueChange={setVisibilityFilter}
            options={SHOWCASE_VISIBILITY_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={SHOWCASE_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search showcases…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading showcases" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(showcase) => showcase.id}
          onRowClick={openEdit}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              {filtersActive ? (
                <EmptyState
                  icon={Images}
                  title="No showcases match these filters"
                  description="Try a different visibility, status, or search term."
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
                  icon={Images}
                  title="No showcases yet"
                  description="Create a showcase to share work with clients."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={openCreate}
                    >
                      <Plus className="h-4 w-4" /> New showcase
                    </Button>
                  }
                />
              )}
            </div>
          }
        />
      )}

      <ShowcaseDialog
        key={editing ? `showcase:${editing.id}` : "showcase:new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={submitShowcase}
      />
    </MainScreenWrapper>
  );
}

export default ShowcaseGalleriesScreen;
