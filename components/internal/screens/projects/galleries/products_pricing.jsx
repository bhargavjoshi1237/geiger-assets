"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
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
  CURRENCY_OPTIONS,
  PRODUCT_STATUS_FILTER_OPTIONS,
  PRODUCT_STATUS_MAP,
  PRODUCT_TYPE_FILTER_OPTIONS,
  PRODUCT_TYPE_MAP,
  PRODUCT_TYPE_OPTIONS,
  formatMoney,
  parseDollarsToCents,
} from "./constants";
import {
  createGalleryProduct,
  listGalleryProducts,
  softDeleteGalleryProduct,
  updateGalleryProduct,
} from "@/lib/supabase/galleries";

// Products and Pricing — digital products, license products, price sheets,
// per-asset pricing, bundles and packages, regional currencies.

const EMPTY_DRAFT = {
  name: "",
  description: "",
  productType: "digital",
  price: "19.00",
  currency: "usd",
  licenseType: "",
};

const STATUS_OPTIONS = Object.entries(PRODUCT_STATUS_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

function ProductDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [status, setStatus] = useState("draft");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDraft({
      ...EMPTY_DRAFT,
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      productType: initial?.productType ?? "digital",
      price: initial ? (Number(initial.priceCents || 0) / 100).toFixed(2) : "19.00",
      currency: initial?.currency ?? "usd",
      licenseType: initial?.licenseType ?? "",
    });
    setStatus(initial?.status || "draft");
    setBusy(false);
  }, [open, initial]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give the product a name.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      name,
      description: draft.description.trim(),
      productType: draft.productType,
      priceCents: parseDollarsToCents(draft.price),
      currency: draft.currency,
      licenseType: draft.licenseType.trim(),
      status,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Digital goods, licenses, bundles, and packages with regional pricing.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="product-name">
            <Input
              id="product-name"
              className="bg-surface-card"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Fine-art print — A3…"
              autoFocus
            />
          </Field>
          <Field label="Description" htmlFor="product-desc">
            <Textarea
              id="product-desc"
              className="min-h-20 bg-surface-card"
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="What does the buyer get?"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value={draft.productType} onValueChange={set("productType")}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPE_OPTIONS.map((o) => (
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
            <Field label="Price" htmlFor="product-price">
              <Input
                id="product-price"
                className="bg-surface-card"
                value={draft.price}
                onChange={(e) => set("price")(e.target.value)}
                placeholder="19.00"
              />
            </Field>
            <Field label="Currency">
              <Select value={draft.currency} onValueChange={set("currency")}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field
            label="License"
            htmlFor="product-license"
            hint="For license products — e.g. editorial, commercial."
          >
            <Input
              id="product-license"
              className="bg-surface-card"
              value={draft.licenseType}
              onChange={(e) => set("licenseType")(e.target.value)}
              placeholder="Personal, commercial…"
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
            {editing ? "Save changes" : "Create product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductsPricingScreen({ projectId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let alive = true;
    listGalleryProducts(projectId).then((rows) => {
      if (!alive) return;
      setProducts(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const stats = useMemo(() => {
    const active = products.filter((p) => p.status === "active");
    const avg = active.length
      ? Math.round(active.reduce((s, p) => s + p.priceCents, 0) / active.length)
      : 0;
    return [
      { label: "Products", value: String(products.length), footer: "price sheet entries" },
      { label: "Active", value: String(active.length), footer: "available to buy" },
      { label: "Avg price", value: formatMoney(avg), footer: "per active product" },
      {
        label: "Bundles",
        value: String(products.filter((p) => p.productType === "bundle" || p.productType === "package").length),
        footer: "packs and packages",
      },
    ];
  }, [products]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products.filter((product) => {
      if (typeFilter !== "all" && product.productType !== typeFilter) return false;
      if (statusFilter !== "all" && product.status !== statusFilter) return false;
      if (
        needle &&
        !`${product.name} ${product.description} ${product.licenseType}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [products, search, typeFilter, statusFilter]);

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

  const openEdit = (product) => {
    setEditing(product);
    setDialogOpen(true);
  };

  const submitProduct = async (draft) => {
    if (editing) {
      const previous = products;
      setProducts((rows) =>
        rows.map((p) => (p.id === editing.id ? { ...p, ...draft } : p)),
      );
      const saved = await updateGalleryProduct(editing.id, draft);
      if (!saved) {
        setProducts(previous);
        toast.error("Could not save the product.");
        return false;
      }
      setProducts((rows) => rows.map((p) => (p.id === saved.id ? saved : p)));
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
    setProducts((rows) => [optimistic, ...rows]);
    const created = await createGalleryProduct({ id, projectId, ...draft });
    if (!created) {
      setProducts((rows) => rows.filter((p) => p.id !== id));
      toast.error("Could not create the product.");
      return false;
    }
    setProducts((rows) => rows.map((p) => (p.id === id ? created : p)));
    toast.success(`Created “${created.name}”.`);
    return true;
  };

  const duplicateProduct = async (product) => {
    const id = crypto.randomUUID();
    const copy = `Copy of ${product.name}`;
    const optimistic = {
      ...product,
      id,
      name: copy,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProducts((rows) => [optimistic, ...rows]);
    const created = await createGalleryProduct({
      id,
      projectId,
      name: copy,
      description: product.description,
      productType: product.productType,
      status: "draft",
      priceCents: product.priceCents,
      currency: product.currency,
      licenseType: product.licenseType,
    });
    if (!created) {
      setProducts((rows) => rows.filter((p) => p.id !== id));
      toast.error("Could not duplicate the product.");
      return;
    }
    setProducts((rows) => rows.map((p) => (p.id === id ? created : p)));
    toast.success(`Duplicated as “${created.name}”.`);
  };

  const removeProduct = async (product) => {
    const previous = products;
    setProducts((rows) => rows.filter((p) => p.id !== product.id));
    const ok = await softDeleteGalleryProduct(product.id);
    if (!ok) {
      setProducts(previous);
      toast.error("Could not delete the product.");
      return;
    }
    toast.success(`Deleted “${product.name}”.`);
  };

  const columns = [
    {
      key: "name",
      header: "Product",
      render: (product) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">
            {product.name || "Untitled product"}
          </span>
          <span className="truncate text-xs text-text-secondary">
            {product.licenseType || product.description || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (product) => <StatusPill status={product.productType} map={PRODUCT_TYPE_MAP} />,
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      className: "text-right tabular-nums text-xs",
      render: (product) => formatMoney(product.priceCents, product.currency),
    },
    {
      key: "status",
      header: "Status",
      render: (product) => <StatusPill status={product.status} map={PRODUCT_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (product) => (
        <ActionMenu
          label={`Actions for ${product.name}`}
          items={[
            { icon: Pencil, label: "Edit", onSelect: () => openEdit(product) },
            { icon: Copy, label: "Duplicate", onSelect: () => duplicateProduct(product) },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              destructive: true,
              onSelect: () => removeProduct(product),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Products and Pricing"
        description="Digital and license products, bundles, packages, and regional currencies."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> New product
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={PRODUCT_TYPE_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={PRODUCT_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search products…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading products" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(product) => product.id}
          onRowClick={openEdit}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              {filtersActive ? (
                <EmptyState
                  icon={Wallet}
                  title="No products match these filters"
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
                  icon={Wallet}
                  title="No products yet"
                  description="Add digital goods, licenses, bundles, and packages."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={openCreate}
                    >
                      <Plus className="h-4 w-4" /> New product
                    </Button>
                  }
                />
              )}
            </div>
          }
        />
      )}

      <ProductDialog
        key={editing ? `product:${editing.id}` : "product:new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={submitProduct}
      />
    </MainScreenWrapper>
  );
}

export default ProductsPricingScreen;
