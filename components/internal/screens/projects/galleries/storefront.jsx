"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Store, Trash2 } from "lucide-react";
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
  STOREFRONT_PAGE_TYPE_MAP,
  STOREFRONT_STATUS_FILTER_OPTIONS,
  STOREFRONT_STATUS_MAP,
  STOREFRONT_TYPE_FILTER_OPTIONS,
} from "./constants";
import {
  createStorefrontPage,
  listStorefrontPages,
  softDeleteStorefrontPage,
  updateStorefrontPage,
} from "@/lib/supabase/galleries";

// Storefront — product pages, shopping cart config, checkout settings,
// customer accounts, discount codes, store policies.

const EMPTY_DRAFT = {
  name: "",
  slug: "",
  pageType: "product",
  description: "",
  cartEnabled: true,
  accountsEnabled: false,
  isPublished: false,
};

const TYPE_OPTIONS = Object.entries(STOREFRONT_PAGE_TYPE_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

const STATUS_OPTIONS = Object.entries(STOREFRONT_STATUS_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function StorefrontDialog({ open, onOpenChange, initial, onSubmit }) {
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
      toast.error("Give the page a name.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      name,
      slug: draft.slug.trim() ? slugify(draft.slug) : slugify(name),
      pageType: draft.pageType,
      description: draft.description.trim(),
      cartEnabled: Boolean(draft.cartEnabled),
      accountsEnabled: Boolean(draft.accountsEnabled),
      isPublished: Boolean(draft.isPublished),
      status,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit page" : "New storefront page"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Product pages, cart and checkout config, accounts, and store policies.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="storefront-name">
            <Input
              id="storefront-name"
              className="bg-surface-card"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Print shop…"
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Slug" htmlFor="storefront-slug">
              <Input
                id="storefront-slug"
                className="bg-surface-card"
                value={draft.slug}
                onChange={(e) => set("slug")(e.target.value)}
                placeholder="print-shop"
              />
            </Field>
            <Field label="Page type">
              <Select value={draft.pageType} onValueChange={set("pageType")}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Description" htmlFor="storefront-desc">
            <Textarea
              id="storefront-desc"
              className="min-h-20 bg-surface-card"
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="Discount codes, policies, and checkout notes…"
            />
          </Field>
          <Field label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-surface-card sm:max-w-xs">
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
          <div className="grid gap-2">
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Shopping cart</p>
                <p className="text-xs text-text-secondary">Let visitors collect items.</p>
              </div>
              <Switch
                checked={draft.cartEnabled}
                onCheckedChange={set("cartEnabled")}
                aria-label="Shopping cart"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Customer accounts</p>
                <p className="text-xs text-text-secondary">Returning buyers can sign in.</p>
              </div>
              <Switch
                checked={draft.accountsEnabled}
                onCheckedChange={set("accountsEnabled")}
                aria-label="Customer accounts"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Published</p>
                <p className="text-xs text-text-secondary">Visible in the storefront.</p>
              </div>
              <Switch
                checked={draft.isPublished}
                onCheckedChange={set("isPublished")}
                aria-label="Published"
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
            {editing ? "Save changes" : "Create page"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StorefrontScreen({ projectId }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let alive = true;
    listStorefrontPages(projectId).then((rows) => {
      if (!alive) return;
      setPages(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const stats = useMemo(
    () => [
      { label: "Pages", value: String(pages.length), footer: "storefront surfaces" },
      {
        label: "Live",
        value: String(pages.filter((p) => p.status === "live").length),
        footer: "open for shoppers",
      },
      {
        label: "Cart on",
        value: String(pages.filter((p) => p.cartEnabled).length),
        footer: "collecting items",
      },
      {
        label: "Accounts",
        value: String(pages.filter((p) => p.accountsEnabled).length),
        footer: "with sign-in",
      },
    ],
    [pages],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return pages.filter((page) => {
      if (typeFilter !== "all" && page.pageType !== typeFilter) return false;
      if (statusFilter !== "all" && page.status !== statusFilter) return false;
      if (
        needle &&
        !`${page.name} ${page.slug} ${page.description}`.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [pages, search, typeFilter, statusFilter]);

  const filtersActive = typeFilter !== "all" || statusFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (page) => {
    setEditing(page);
    setDialogOpen(true);
  };

  const submitPage = async (draft) => {
    if (editing) {
      const previous = pages;
      setPages((rows) => rows.map((p) => (p.id === editing.id ? { ...p, ...draft } : p)));
      const saved = await updateStorefrontPage(editing.id, draft);
      if (!saved) {
        setPages(previous);
        toast.error("Could not save the page.");
        return false;
      }
      setPages((rows) => rows.map((p) => (p.id === saved.id ? saved : p)));
      toast.success(`Saved “${saved.name}”.`);
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      viewCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setPages((rows) => [optimistic, ...rows]);
    const created = await createStorefrontPage({ id, projectId, ...draft });
    if (!created) {
      setPages((rows) => rows.filter((p) => p.id !== id));
      toast.error("Could not create the page.");
      return false;
    }
    setPages((rows) => rows.map((p) => (p.id === id ? created : p)));
    toast.success(`Created “${created.name}”.`);
    return true;
  };

  const toggleCart = async (page) => {
    const previous = pages;
    setPages((rows) =>
      rows.map((p) => (p.id === page.id ? { ...p, cartEnabled: !p.cartEnabled } : p)),
    );
    const saved = await updateStorefrontPage(page.id, { cartEnabled: !page.cartEnabled });
    if (!saved) {
      setPages(previous);
      toast.error("Could not change cart config.");
      return;
    }
    setPages((rows) => rows.map((p) => (p.id === saved.id ? saved : p)));
    toast.success(`Cart ${saved.cartEnabled ? "enabled" : "disabled"} for “${saved.name}”.`);
  };

  const duplicatePage = async (page) => {
    const id = crypto.randomUUID();
    const copy = `Copy of ${page.name}`;
    const optimistic = {
      ...page,
      id,
      name: copy,
      slug: page.slug ? `${page.slug}-copy` : slugify(copy),
      status: "draft",
      isPublished: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPages((rows) => [optimistic, ...rows]);
    const created = await createStorefrontPage({
      id,
      projectId,
      name: copy,
      slug: optimistic.slug,
      pageType: page.pageType,
      description: page.description,
      cartEnabled: page.cartEnabled,
      accountsEnabled: page.accountsEnabled,
      status: "draft",
      isPublished: false,
    });
    if (!created) {
      setPages((rows) => rows.filter((p) => p.id !== id));
      toast.error("Could not duplicate the page.");
      return;
    }
    setPages((rows) => rows.map((p) => (p.id === id ? created : p)));
    toast.success(`Duplicated as “${created.name}”.`);
  };

  const removePage = async (page) => {
    const previous = pages;
    setPages((rows) => rows.filter((p) => p.id !== page.id));
    const ok = await softDeleteStorefrontPage(page.id);
    if (!ok) {
      setPages(previous);
      toast.error("Could not delete the page.");
      return;
    }
    toast.success(`Deleted “${page.name}”.`);
  };

  const columns = [
    {
      key: "name",
      header: "Page",
      render: (page) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">
            {page.name || "Untitled page"}
          </span>
          <span className="truncate text-xs text-text-secondary">
            /{page.slug || page.id}
            {page.cartEnabled ? " · cart on" : ""}
            {page.accountsEnabled ? " · accounts" : ""}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (page) => <StatusPill status={page.pageType} map={STOREFRONT_PAGE_TYPE_MAP} />,
    },
    {
      key: "status",
      header: "Status",
      render: (page) => <StatusPill status={page.status} map={STOREFRONT_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (page) => (
        <ActionMenu
          label={`Actions for ${page.name}`}
          items={[
            {
              icon: Store,
              label: page.cartEnabled ? "Disable cart" : "Enable cart",
              onSelect: () => toggleCart(page),
            },
            { icon: Pencil, label: "Edit", onSelect: () => openEdit(page) },
            { icon: Copy, label: "Duplicate", onSelect: () => duplicatePage(page) },
            { separator: true },
            { icon: Trash2, label: "Delete", destructive: true, onSelect: () => removePage(page) },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Storefront"
        description="Product pages, cart config, checkout settings, accounts, and store policies."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> New page
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={STOREFRONT_TYPE_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STOREFRONT_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search pages…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading storefront" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(page) => page.id}
          onRowClick={openEdit}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              {filtersActive ? (
                <EmptyState
                  icon={Store}
                  title="No pages match these filters"
                  description="Try a different type, status, or search term."
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
                  icon={Store}
                  title="No storefront pages yet"
                  description="Create product pages, cart, checkout, and policy surfaces."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={openCreate}
                    >
                      <Plus className="h-4 w-4" /> New page
                    </Button>
                  }
                />
              )}
            </div>
          }
        />
      )}

      <StorefrontDialog
        key={editing ? `storefront:${editing.id}` : "storefront:new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={submitPage}
      />
    </MainScreenWrapper>
  );
}

export default StorefrontScreen;
