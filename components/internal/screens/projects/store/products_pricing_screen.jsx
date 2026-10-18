"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Copy,
  Package,
  Plus,
  ScrollText,
  SlidersHorizontal,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SegmentedTabs,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  ClearFiltersButton,
  FilterDropdown,
  RowActions,
  useModuleRows,
} from "@/components/internal/shared/module_kit";
import { ProductDialog } from "./product_dialog";
import { PriceSheetDialog } from "./price_sheet_dialog";
import {
  PRODUCT_KIND_META,
  PRODUCT_STATUS_META,
  formatMoney,
  fulfillmentSummary,
  optionsFromMeta,
  plural,
} from "./constants";
import { fulfillmentDefaults } from "@/lib/commerce/shape";
import {
  createPriceSheet,
  createProduct,
  deletePriceSheet,
  deleteProduct,
  listPriceSheets,
  listProducts,
  setDefaultPriceSheet,
  updatePriceSheet,
  updateProduct,
} from "@/lib/supabase/store";
import { listTemplates } from "@/lib/supabase/licensing";
import { listGalleries } from "@/lib/supabase/galleries";
import { getUser } from "@/lib/supabase/user";

const KIND_FILTERS = optionsFromMeta(PRODUCT_KIND_META, "All kinds");
const STATUS_FILTERS = optionsFromMeta(PRODUCT_STATUS_META, "All statuses");

const TABS = [
  { value: "products", label: "Products", icon: Package },
  { value: "sheets", label: "Price sheets", icon: ScrollText },
];

// A sensible first catalogue, created only when someone asks for it.
const STARTER = [
  { kind: "download", name: "Web download", description: "Screen-ready file for websites and social.", priceCents: 1500, fulfillment: { rendition: "medium", downloadLimit: 3, expiryDays: 30 } },
  { kind: "download", name: "High-res download", description: "The full-resolution original.", priceCents: 4900, fulfillment: { rendition: "original", downloadLimit: 5, expiryDays: 30 } },
  { kind: "license", name: "Editorial licence — 1 year", description: "Non-commercial editorial use, worldwide, web and print.", priceCents: 15000, fulfillment: { usageType: "editorial", durationMonths: 12, channels: ["web", "print"] } },
  { kind: "license", name: "Commercial licence — 1 year", description: "Advertising and marketing use, worldwide.", priceCents: 45000, fulfillment: { usageType: "advertising", durationMonths: 12, channels: ["web", "social", "print"] } },
  { kind: "print", name: "Fine-art print 12×18", description: "Archival pigment print on matte paper.", priceCents: 8500, fulfillment: { size: "12×18 in", paper: "Hahnemühle Photo Rag", finish: "Unframed" } },
  { kind: "physical", name: "Photo book — A4 hardcover", description: "A printed book of the gallery, shipped to your door.", priceCents: 6500, fulfillment: { variant: "A4 · Hardcover", productionDays: 10 } },
  { kind: "bundle", name: "Any 5 — high-res", description: "Pick any five images.", priceCents: 17500, fulfillment: { size: 5, rendition: "original" } },
];

export function ProductsPricingScreen({ projectId }) {
  const [products, setProducts, loadingProducts] = useModuleRows(listProducts, projectId);
  const [sheets, setSheets, loadingSheets] = useModuleRows(listPriceSheets, projectId);
  const [templates] = useModuleRows(listTemplates, projectId);
  const [galleries] = useModuleRows(listGalleries, projectId);

  const [tab, setTab] = useState("products");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productDialog, setProductDialog] = useState(null); // { product } | null
  const [sheetDialog, setSheetDialog] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const loading = loadingProducts || loadingSheets;

  const sheetsByProduct = useMemo(() => {
    const map = new Map();
    for (const sheet of sheets) for (const line of sheet.lines) map.set(line.productId, (map.get(line.productId) || 0) + 1);
    return map;
  }, [sheets]);

  const galleriesBySheet = useMemo(() => {
    const map = new Map();
    for (const g of galleries) {
      const id = g.commerce?.priceSheetId;
      if (id) map.set(id, [...(map.get(id) || []), g]);
    }
    return map;
  }, [galleries]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    if (kindFilter !== "all") list = list.filter((p) => p.kind === kindFilter);
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    return list;
  }, [products, search, kindFilter, statusFilter]);

  const filteredSheets = useMemo(() => {
    if (!search) return sheets;
    const q = search.toLowerCase();
    return sheets.filter((s) => s.name.toLowerCase().includes(q));
  }, [sheets, search]);

  const stats = useMemo(() => {
    const active = products.filter((p) => p.status === "active");
    const avg = active.length ? Math.round(active.reduce((s, p) => s + p.priceCents, 0) / active.length) : 0;
    const selling = galleries.filter((g) => g.commerce?.enabled).length;
    return [
      { label: "Products", value: String(products.length), footer: `${active.length} active` },
      { label: "Price sheets", value: String(sheets.length), footer: sheets.find((s) => s.isDefault)?.name || "no default yet" },
      { label: "Average price", value: formatMoney(avg), footer: "across active products" },
      { label: "Selling galleries", value: String(selling), footer: `of ${galleries.length} galleries` },
    ];
  }, [products, sheets, galleries]);

  // Products ---------------------------------------------------------------------

  const saveProduct = async (draft) => {
    const editing = productDialog?.product;
    setProductDialog(null);
    if (editing) {
      const previous = products;
      setProducts((list) => list.map((p) => (p.id === editing.id ? { ...p, ...draft } : p)));
      const saved = await updateProduct(editing.id, draft);
      if (saved) {
        setProducts((list) => list.map((p) => (p.id === saved.id ? saved : p)));
        toast.success("Product saved");
      } else {
        setProducts(previous);
        toast.error("Couldn't save the product");
      }
      return;
    }
    const user = await getUser();
    const payload = { id: crypto.randomUUID(), projectId, position: products.length, createdBy: user?.id || null, ...draft };
    setProducts((list) => [...list, payload]);
    const created = await createProduct(payload);
    if (created) {
      setProducts((list) => list.map((p) => (p.id === created.id ? created : p)));
      toast.success(`${created.name} created`);
    } else {
      setProducts((list) => list.filter((p) => p.id !== payload.id));
      toast.error("Couldn't create the product");
    }
  };

  const duplicateProduct = async (product) => {
    const payload = {
      id: crypto.randomUUID(),
      projectId,
      kind: product.kind,
      name: `${product.name} (copy)`,
      description: product.description,
      priceCents: product.priceCents,
      compareAtCents: product.compareAtCents,
      status: "draft",
      fulfillment: product.fulfillment,
      licenseTemplateId: product.licenseTemplateId,
      position: products.length,
    };
    setProducts((list) => [...list, payload]);
    const created = await createProduct(payload);
    if (created) {
      setProducts((list) => list.map((p) => (p.id === created.id ? created : p)));
      toast.success("Product duplicated as a draft");
    } else {
      setProducts((list) => list.filter((p) => p.id !== payload.id));
      toast.error("Couldn't duplicate the product");
    }
  };

  const setProductStatus = async (product, status) => {
    const previous = products;
    setProducts((list) => list.map((p) => (p.id === product.id ? { ...p, status } : p)));
    const saved = await updateProduct(product.id, { status });
    if (saved) toast.success(status === "archived" ? "Product archived — galleries stop offering it" : "Product restored");
    else {
      setProducts(previous);
      toast.error("Couldn't update the product");
    }
  };

  const removeProduct = async (product) => {
    const previous = products;
    setProducts((list) => list.filter((p) => p.id !== product.id));
    const ok = await deleteProduct(product.id);
    if (ok) toast.success("Product deleted");
    else {
      setProducts(previous);
      toast.error("Couldn't delete the product");
    }
  };

  const createStarter = async () => {
    setSeeding(true);
    const user = await getUser();
    const payloads = STARTER.map((p, i) => ({
      id: crypto.randomUUID(),
      projectId,
      position: products.length + i,
      status: "active",
      createdBy: user?.id || null,
      ...p,
      fulfillment: { ...fulfillmentDefaults(p.kind), ...p.fulfillment },
    }));
    const created = (await Promise.all(payloads.map(createProduct))).filter(Boolean);
    if (!created.length) {
      setSeeding(false);
      return toast.error("Couldn't create the starter catalogue");
    }
    setProducts((list) => [...list, ...created]);
    const sheet = await createPriceSheet({
      id: crypto.randomUUID(),
      projectId,
      name: "Standard pricing",
      description: "Starter sheet — edit the prices to suit.",
      lines: created.map((p, position) => ({ productId: p.id, priceCents: null, position })),
      isDefault: sheets.length === 0,
      createdBy: user?.id || null,
    });
    if (sheet) setSheets((list) => [...list, sheet]);
    setSeeding(false);
    toast.success(`${created.length} products and a price sheet created`);
  };

  // Sheets -------------------------------------------------------------------------

  const saveSheet = async (draft) => {
    const editing = sheetDialog?.sheet;
    setSheetDialog(null);
    if (editing) {
      const previous = sheets;
      setSheets((list) => list.map((s) => (s.id === editing.id ? { ...s, ...draft } : s)));
      const saved = await updatePriceSheet(editing.id, draft);
      if (saved) {
        setSheets((list) => list.map((s) => (s.id === saved.id ? saved : s)));
        toast.success("Price sheet saved");
      } else {
        setSheets(previous);
        toast.error("Couldn't save the price sheet");
      }
      return;
    }
    const user = await getUser();
    const payload = { id: crypto.randomUUID(), projectId, isDefault: sheets.length === 0, createdBy: user?.id || null, ...draft };
    setSheets((list) => [...list, payload]);
    const created = await createPriceSheet(payload);
    if (created) {
      setSheets((list) => list.map((s) => (s.id === created.id ? created : s)));
      toast.success(`${created.name} created`);
    } else {
      setSheets((list) => list.filter((s) => s.id !== payload.id));
      toast.error("Couldn't create the price sheet");
    }
  };

  const duplicateSheet = async (sheet) => {
    const payload = { id: crypto.randomUUID(), projectId, name: `${sheet.name} (copy)`, description: sheet.description, lines: sheet.lines, isDefault: false };
    setSheets((list) => [...list, payload]);
    const created = await createPriceSheet(payload);
    if (created) {
      setSheets((list) => list.map((s) => (s.id === created.id ? created : s)));
      toast.success("Price sheet duplicated");
    } else {
      setSheets((list) => list.filter((s) => s.id !== payload.id));
      toast.error("Couldn't duplicate the price sheet");
    }
  };

  const makeDefault = async (sheet) => {
    const previous = sheets;
    setSheets((list) => list.map((s) => ({ ...s, isDefault: s.id === sheet.id })));
    const ok = await setDefaultPriceSheet(projectId, sheet.id);
    if (ok) toast.success(`${sheet.name} is the default for new stores`);
    else {
      setSheets(previous);
      toast.error("Couldn't change the default");
    }
  };

  const removeSheet = async (sheet) => {
    const using = galleriesBySheet.get(sheet.id)?.length || 0;
    if (using) return toast.error(`${plural(using, "gallery", "galleries")} still sell from this sheet`);
    const previous = sheets;
    setSheets((list) => list.filter((s) => s.id !== sheet.id));
    const ok = await deletePriceSheet(sheet.id);
    if (ok) toast.success("Price sheet deleted");
    else {
      setSheets(previous);
      toast.error("Couldn't delete the price sheet");
    }
  };

  // Columns ------------------------------------------------------------------------

  const productColumns = [
    {
      key: "name",
      header: "Product",
      render: (p) => {
        const meta = PRODUCT_KIND_META[p.kind];
        const Icon = meta?.icon || Package;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{p.name || "Untitled product"}</p>
              <p className="truncate text-[11px] text-text-tertiary">{fulfillmentSummary(p)}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "kind",
      header: "Kind",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (p) => <StatusPill status={p.kind} map={PRODUCT_KIND_META} className="text-[10px]" />,
    },
    {
      key: "sheets",
      header: "On sheets",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (p) => sheetsByProduct.get(p.id) || <span className="text-text-tertiary">—</span>,
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      className: "tabular-nums text-xs font-medium",
      render: (p) => (
        <span className="inline-flex flex-col items-end">
          {formatMoney(p.priceCents)}
          {p.compareAtCents > p.priceCents ? (
            <span className="text-[10px] font-normal text-text-tertiary line-through">{formatMoney(p.compareAtCents)}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusPill status={p.status} map={PRODUCT_STATUS_META} className="text-[10px]" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            extra={[
              { icon: Copy, label: "Duplicate", onSelect: () => duplicateProduct(p) },
              p.status === "archived"
                ? { icon: ArchiveRestore, label: "Restore", onSelect: () => setProductStatus(p, "active") }
                : { icon: Archive, label: "Archive", onSelect: () => setProductStatus(p, "archived") },
            ]}
            onEdit={() => setProductDialog({ product: p })}
            onDelete={() => removeProduct(p)}
          />
        </div>
      ),
    },
  ];

  const sheetColumns = [
    {
      key: "name",
      header: "Price sheet",
      render: (s) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
            {s.name || "Untitled sheet"}
            {s.isDefault ? (
              <Badge variant="info" className="text-[10px]">
                Default
              </Badge>
            ) : null}
          </p>
          <p className="truncate text-[11px] text-text-tertiary">
            {s.lines
              .map((l) => productById.get(l.productId)?.name)
              .filter(Boolean)
              .slice(0, 3)
              .join(" · ") || "No products"}
            {s.lines.length > 3 ? ` +${s.lines.length - 3}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "products",
      header: "Products",
      className: "text-xs text-text-secondary",
      render: (s) => s.lines.length,
    },
    {
      key: "galleries",
      header: "Galleries",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (s) => {
        const using = galleriesBySheet.get(s.id) || [];
        return using.length ? using.map((g) => g.name).join(", ") : <span className="text-text-tertiary">Unused</span>;
      },
    },
    {
      key: "range",
      header: "Price range",
      align: "right",
      className: "tabular-nums text-xs font-medium",
      render: (s) => {
        const prices = s.lines
          .map((l) => l.priceCents ?? productById.get(l.productId)?.priceCents)
          .filter((v) => v !== undefined && v !== null);
        if (!prices.length) return "—";
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        return min === max ? formatMoney(min) : `${formatMoney(min)} – ${formatMoney(max)}`;
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            extra={[
              ...(s.isDefault ? [] : [{ icon: Star, label: "Make default", onSelect: () => makeDefault(s) }]),
              { icon: Copy, label: "Duplicate", onSelect: () => duplicateSheet(s) },
            ]}
            onEdit={() => setSheetDialog({ sheet: s })}
            onDelete={() => removeSheet(s)}
          />
        </div>
      ),
    },
  ];

  const hasFilters = kindFilter !== "all" || statusFilter !== "all" || Boolean(search);
  const clearFilters = () => {
    setKindFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  const primary =
    tab === "products" ? (
      <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setProductDialog({ product: null })}>
        <Plus className="h-4 w-4" />
        New product
      </Button>
    ) : (
      <Button
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={!products.length}
        onClick={() => setSheetDialog({ sheet: null })}
      >
        <Plus className="h-4 w-4" />
        New price sheet
      </Button>
    );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Products & Pricing"
        description="What galleries sell — downloads, licences, prints, bundles and unlocks — and the price sheets that group them."
        actions={primary}
      />
      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
          {tab === "products" ? (
            <>
              <FilterDropdown value={kindFilter} onValueChange={setKindFilter} options={KIND_FILTERS} placeholder="Kind" icon={SlidersHorizontal} />
              <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" />
            </>
          ) : null}
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={tab === "products" ? "Search products..." : "Search price sheets..."}
          className="w-full sm:w-56"
        />
      </Toolbar>

      {loading ? (
        <LoadingArea panel className="h-64 py-0" label="Loading the catalogue" />
      ) : tab === "products" ? (
        <DataTable
          columns={productColumns}
          data={filteredProducts}
          getRowKey={(p) => p.id}
          onRowClick={(p) => setProductDialog({ product: p })}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={hasFilters ? SlidersHorizontal : Package}
                title={hasFilters ? "No matching products" : "No products yet"}
                description={
                  hasFilters
                    ? "Try adjusting your filters."
                    : "Create what galleries sell, or start from a starter catalogue you can edit."
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" className="border-border bg-surface-card" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="outline" className="border-border bg-surface-card" disabled={seeding} onClick={createStarter}>
                        <Sparkles className="h-4 w-4" />
                        Starter catalogue
                      </Button>
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setProductDialog({ product: null })}>
                        <Plus className="h-4 w-4" />
                        New product
                      </Button>
                    </div>
                  )
                }
              />
            </div>
          }
        />
      ) : (
        <DataTable
          columns={sheetColumns}
          data={filteredSheets}
          getRowKey={(s) => s.id}
          onRowClick={(s) => setSheetDialog({ sheet: s })}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={ScrollText}
                title={search ? "No matching price sheets" : "No price sheets yet"}
                description={
                  products.length
                    ? "Group products into a sheet, then pick the sheet in a gallery's Selling settings."
                    : "Create products first — a price sheet is a menu of them."
                }
                action={
                  products.length ? (
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setSheetDialog({ sheet: null })}>
                      <Plus className="h-4 w-4" />
                      New price sheet
                    </Button>
                  ) : (
                    <Button variant="outline" className="border-border bg-surface-card" onClick={() => setTab("products")}>
                      Go to products
                    </Button>
                  )
                }
              />
            </div>
          }
        />
      )}

      <ProductDialog
        open={Boolean(productDialog)}
        onOpenChange={(open) => !open && setProductDialog(null)}
        product={productDialog?.product || null}
        templates={templates.filter((t) => t.status !== "archived")}
        onSubmit={saveProduct}
      />
      <PriceSheetDialog
        open={Boolean(sheetDialog)}
        onOpenChange={(open) => !open && setSheetDialog(null)}
        sheet={sheetDialog?.sheet || null}
        products={products}
        onSubmit={saveSheet}
      />
    </MainScreenWrapper>
  );
}

export default ProductsPricingScreen;
