"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Plus, ShoppingCart, Star, Trash2 } from "lucide-react";
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
  CHECKOUT_MODE_FILTER_OPTIONS,
  CHECKOUT_MODE_MAP,
  CHECKOUT_MODE_OPTIONS,
  CHECKOUT_PROVIDER_MAP,
  CHECKOUT_PROVIDER_OPTIONS,
  CHECKOUT_STATUS_FILTER_OPTIONS,
  CHECKOUT_STATUS_MAP,
} from "./constants";
import {
  createCheckoutConfig,
  listCheckoutConfigs,
  softDeleteCheckoutConfig,
  updateCheckoutConfig,
} from "@/lib/supabase/galleries";

// Cart and Checkout — guest and account checkout, payment collection
// settings, taxes, terms acceptance, order confirmation. Payment providers
// are configuration only: selecting one records where checkout should route.
// No provider SDK is called and no credentials are collected here.

const EMPTY_DRAFT = {
  name: "",
  description: "",
  checkoutMode: "both",
  paymentProvider: "manual",
  taxEnabled: true,
  termsRequired: true,
};

const STATUS_OPTIONS = Object.entries(CHECKOUT_STATUS_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

function CheckoutDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [status, setStatus] = useState("draft");
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDraft({
      ...EMPTY_DRAFT,
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      checkoutMode: initial?.checkoutMode ?? "both",
      paymentProvider: initial?.paymentProvider ?? "manual",
      taxEnabled: initial?.taxEnabled ?? true,
      termsRequired: initial?.termsRequired ?? true,
    });
    setStatus(initial?.status || "draft");
    setIsDefault(Boolean(initial?.isDefault));
    setBusy(false);
  }, [open, initial]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give the checkout a name.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      name,
      description: draft.description.trim(),
      checkoutMode: draft.checkoutMode,
      paymentProvider: draft.paymentProvider,
      taxEnabled: Boolean(draft.taxEnabled),
      termsRequired: Boolean(draft.termsRequired),
      status,
      isDefault,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit checkout" : "New checkout"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Guest and account checkout with tax, terms, and confirmation settings.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="checkout-name">
            <Input
              id="checkout-name"
              className="bg-surface-card"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Standard checkout…"
              autoFocus
            />
          </Field>
          <Field label="Description" htmlFor="checkout-desc">
            <Textarea
              id="checkout-desc"
              className="min-h-20 bg-surface-card"
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="Order confirmation notes…"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Checkout mode">
              <Select value={draft.checkoutMode} onValueChange={set("checkoutMode")}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHECKOUT_MODE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Payment provider"
              hint="Configuration only — no credentials here."
            >
              <Select value={draft.paymentProvider} onValueChange={set("paymentProvider")}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHECKOUT_PROVIDER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
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
                <p className="text-sm font-medium text-foreground">Collect tax</p>
                <p className="text-xs text-text-secondary">Apply tax rates at checkout.</p>
              </div>
              <Switch
                checked={draft.taxEnabled}
                onCheckedChange={set("taxEnabled")}
                aria-label="Collect tax"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Terms acceptance</p>
                <p className="text-xs text-text-secondary">Buyers accept terms to confirm.</p>
              </div>
              <Switch
                checked={draft.termsRequired}
                onCheckedChange={set("termsRequired")}
                aria-label="Terms acceptance"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Default checkout</p>
                <p className="text-xs text-text-secondary">Used when no other applies.</p>
              </div>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} aria-label="Default" />
            </div>
          </div>
          <p className="text-xs text-text-tertiary">
            Provider choice only records where checkout should route — it never connects to
            Stripe, PayPal, or a bank from this screen.
          </p>
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
            {editing ? "Save changes" : "Create checkout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CartCheckoutScreen({ projectId }) {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let alive = true;
    listCheckoutConfigs(projectId).then((rows) => {
      if (!alive) return;
      setConfigs(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const stats = useMemo(
    () => [
      { label: "Checkouts", value: String(configs.length), footer: "cart configurations" },
      {
        label: "Live",
        value: String(configs.filter((c) => c.status === "live").length),
        footer: "accepting orders",
      },
      {
        label: "Default",
        value: String(configs.filter((c) => c.isDefault).length),
        footer: "fallback checkout",
      },
      {
        label: "Tax on",
        value: String(configs.filter((c) => c.taxEnabled).length),
        footer: "collecting tax",
      },
    ],
    [configs],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return configs.filter((config) => {
      if (modeFilter !== "all" && config.checkoutMode !== modeFilter) return false;
      if (statusFilter !== "all" && config.status !== statusFilter) return false;
      if (
        needle &&
        !`${config.name} ${config.description} ${config.paymentProvider}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [configs, search, modeFilter, statusFilter]);

  const filtersActive = modeFilter !== "all" || statusFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setModeFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (config) => {
    setEditing(config);
    setDialogOpen(true);
  };

  const submitConfig = async (draft) => {
    if (editing) {
      const previous = configs;
      const next = draft.isDefault
        ? configs.map((c) => ({ ...c, isDefault: c.id === editing.id }))
        : configs;
      setConfigs(
        next.map((c) => (c.id === editing.id ? { ...c, ...draft } : c)),
      );
      const saved = await updateCheckoutConfig(editing.id, draft);
      if (!saved) {
        setConfigs(previous);
        toast.error("Could not save the checkout.");
        return false;
      }
      setConfigs((rows) => {
        const merged = rows.map((c) => (c.id === saved.id ? saved : c));
        return saved.isDefault ? merged.map((c) => ({ ...c, isDefault: c.id === saved.id })) : merged;
      });
      toast.success(`Saved “${saved.name}”.`);
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setConfigs((rows) =>
      draft.isDefault ? [{ ...optimistic }, ...rows.map((c) => ({ ...c, isDefault: false }))] : [optimistic, ...rows],
    );
    const created = await createCheckoutConfig({ id, projectId, ...draft });
    if (!created) {
      setConfigs((rows) => rows.filter((c) => c.id !== id));
      toast.error("Could not create the checkout.");
      return false;
    }
    setConfigs((rows) =>
      rows
        .map((c) => (c.id === id ? created : c))
        .map((c) => (created.isDefault ? { ...c, isDefault: c.id === created.id } : c)),
    );
    toast.success(`Created “${created.name}”.`);
    return true;
  };

  const setDefault = async (config) => {
    const previous = configs;
    setConfigs((rows) => rows.map((c) => ({ ...c, isDefault: c.id === config.id })));
    const saved = await updateCheckoutConfig(config.id, { isDefault: true });
    if (!saved) {
      setConfigs(previous);
      toast.error("Could not set the default checkout.");
      return;
    }
    setConfigs((rows) =>
      rows.map((c) => (c.id === saved.id ? saved : { ...c, isDefault: false })),
    );
    toast.success(`“${saved.name}” is now the default.`);
  };

  const duplicateConfig = async (config) => {
    const id = crypto.randomUUID();
    const copy = `Copy of ${config.name}`;
    const optimistic = {
      ...config,
      id,
      name: copy,
      status: "draft",
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setConfigs((rows) => [optimistic, ...rows]);
    const created = await createCheckoutConfig({
      id,
      projectId,
      name: copy,
      description: config.description,
      checkoutMode: config.checkoutMode,
      paymentProvider: config.paymentProvider,
      taxEnabled: config.taxEnabled,
      termsRequired: config.termsRequired,
      status: "draft",
      isDefault: false,
    });
    if (!created) {
      setConfigs((rows) => rows.filter((c) => c.id !== id));
      toast.error("Could not duplicate the checkout.");
      return;
    }
    setConfigs((rows) => rows.map((c) => (c.id === id ? created : c)));
    toast.success(`Duplicated as “${created.name}”.`);
  };

  const removeConfig = async (config) => {
    const previous = configs;
    setConfigs((rows) => rows.filter((c) => c.id !== config.id));
    const ok = await softDeleteCheckoutConfig(config.id);
    if (!ok) {
      setConfigs(previous);
      toast.error("Could not delete the checkout.");
      return;
    }
    toast.success(`Deleted “${config.name}”.`);
  };

  const columns = [
    {
      key: "name",
      header: "Checkout",
      render: (config) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="max-w-[240px] truncate font-medium text-foreground">
              {config.name || "Untitled checkout"}
            </span>
            {config.isDefault ? <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> : null}
          </span>
          <span className="truncate text-xs text-text-secondary">
            {CHECKOUT_PROVIDER_MAP[config.paymentProvider]?.label || config.paymentProvider}
            {config.taxEnabled ? " · tax" : ""}
            {config.termsRequired ? " · terms" : ""}
          </span>
        </div>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (config) => <StatusPill status={config.checkoutMode} map={CHECKOUT_MODE_MAP} />,
    },
    {
      key: "status",
      header: "Status",
      render: (config) => <StatusPill status={config.status} map={CHECKOUT_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (config) => (
        <ActionMenu
          label={`Actions for ${config.name}`}
          items={[
            config.isDefault
              ? null
              : { icon: Star, label: "Make default", onSelect: () => setDefault(config) },
            { icon: Pencil, label: "Edit", onSelect: () => openEdit(config) },
            { icon: Copy, label: "Duplicate", onSelect: () => duplicateConfig(config) },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              destructive: true,
              onSelect: () => removeConfig(config),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Cart and Checkout"
        description="Guest and account checkout — payment settings, taxes, terms, confirmation."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> New checkout
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={modeFilter}
            onValueChange={setModeFilter}
            options={CHECKOUT_MODE_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={CHECKOUT_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search checkouts…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading checkouts" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(config) => config.id}
          onRowClick={openEdit}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              {filtersActive ? (
                <EmptyState
                  icon={ShoppingCart}
                  title="No checkouts match these filters"
                  description="Try a different mode, status, or search term."
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
                  icon={ShoppingCart}
                  title="No checkouts yet"
                  description="Configure how buyers pay, confirm, and accept terms."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={openCreate}
                    >
                      <Plus className="h-4 w-4" /> New checkout
                    </Button>
                  }
                />
              )}
            </div>
          }
        />
      )}

      <CheckoutDialog
        key={editing ? `checkout:${editing.id}` : "checkout:new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={submitConfig}
      />
    </MainScreenWrapper>
  );
}

export default CartCheckoutScreen;
