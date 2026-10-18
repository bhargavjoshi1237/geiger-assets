"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, ExternalLink, Link2, ReceiptText, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { ClearFiltersButton, FilterDropdown, RowActions } from "@/components/internal/shared/module_kit";
import { ExportButton } from "../licensing/licensing_kit";
import { OrderDetailScreen } from "./order_detail";
import { invoiceNumber } from "./invoice_view";
import {
  FULFILLMENT_META,
  ORDER_STATUS_META,
  PROVIDER_META,
  centsToDollarString,
  compactMoney,
  formatDate,
  formatMoney,
  optionsFromMeta,
  plural,
} from "./constants";
import { REVENUE_STATUSES } from "@/lib/commerce/shape";
import {
  getStoreSettings,
  listCustomers,
  listEntitlements,
  listOrderItems,
  listOrders,
  orderPageUrl,
  runOrderAction,
} from "@/lib/supabase/store";
import { listGalleries } from "@/lib/supabase/galleries";
import { listLicenses } from "@/lib/supabase/licensing";
import { listAssets } from "@/lib/supabase/assets";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

const STATUS_FILTERS = optionsFromMeta(ORDER_STATUS_META, "All statuses");
const PROVIDER_FILTERS = optionsFromMeta(PROVIDER_META, "All payment methods");
const PERIOD_FILTERS = [
  { value: "all", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

async function fetchOrdersData(projectId) {
  const [o, i, c, g, e, l, a, s] = await Promise.all([
    listOrders(projectId),
    listOrderItems(projectId),
    listCustomers(projectId),
    listGalleries(projectId),
    listEntitlements(projectId),
    listLicenses(projectId),
    listAssets(projectId),
    getStoreSettings(projectId),
  ]);
  return { o, i, c, g, e, l, a, s };
}

export function OrdersInvoicesScreen({ projectId }) {
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [galleries, setGalleries] = useState([]);
  const [entitlements, setEntitlements] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [assets, setAssets] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [galleryFilter, setGalleryFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [openId, setOpenId] = useState(null);
  // "Last N days" is measured from when the screen opened.
  const [now] = useState(() => Date.now());
  const { setSection } = useWorkspaceUrl();

  const apply = useCallback(({ o, i, c, g, e, l, a, s: st }) => {
    setOrders(o ?? []);
    setItems(i ?? []);
    setCustomers(c ?? []);
    setGalleries(g ?? []);
    setEntitlements(e ?? []);
    setLicenses(l ?? []);
    setAssets(a ?? []);
    setSettings(st);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    fetchOrdersData(projectId).then((data) => alive && apply(data));
    return () => {
      alive = false;
    };
  }, [projectId, apply]);

  // After a server action: pull the fresh order, items, links and licences.
  const load = useCallback(() => fetchOrdersData(projectId).then(apply), [projectId, apply]);

  const itemsByOrder = useMemo(() => {
    const map = new Map();
    for (const item of items) map.set(item.orderId, [...(map.get(item.orderId) || []), item]);
    return map;
  }, [items]);
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const galleryById = useMemo(() => new Map(galleries.map((g) => [g.id, g])), [galleries]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const galleryFilters = useMemo(
    () => [
      { value: "all", label: "All galleries" },
      ...galleries.filter((g) => orders.some((o) => o.galleryId === g.id)).map((g) => ({ value: g.id, label: g.name })),
    ],
    [galleries, orders],
  );

  const filtered = useMemo(() => {
    let list = orders;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.number.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q) ||
          o.name.toLowerCase().includes(q) ||
          (itemsByOrder.get(o.id) || []).some((i) => i.title.toLowerCase().includes(q)),
      );
    }
    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);
    if (galleryFilter !== "all") list = list.filter((o) => o.galleryId === galleryFilter);
    if (providerFilter !== "all") list = list.filter((o) => o.provider === providerFilter);
    if (period !== "all") {
      const since = now - Number(period) * 86_400_000;
      list = list.filter((o) => new Date(o.createdAt).getTime() >= since);
    }
    return list;
  }, [orders, search, statusFilter, galleryFilter, providerFilter, period, itemsByOrder, now]);

  const stats = useMemo(() => {
    const scope = period === "all" ? orders : filtered;
    const paid = scope.filter((o) => REVENUE_STATUSES.has(o.status) || o.status === "refunded");
    const gross = paid.reduce((s, o) => s + o.totalCents, 0);
    const refunded = paid.reduce((s, o) => s + o.refundedCents, 0);
    const pending = scope.filter((o) => o.status === "pending");
    const unfulfilled = scope.filter((o) => o.status === "paid" && o.fulfillmentStatus !== "fulfilled");
    return [
      { label: "Net revenue", value: compactMoney(gross - refunded), footer: refunded ? `${formatMoney(refunded)} refunded` : "after refunds" },
      { label: "Paid orders", value: String(paid.length), footer: unfulfilled.length ? `${unfulfilled.length} awaiting fulfilment` : "all delivered" },
      { label: "Average order", value: formatMoney(paid.length ? Math.round(gross / paid.length) : 0), footer: "per paid order" },
      { label: "Awaiting payment", value: String(pending.length), footer: formatMoney(pending.reduce((s, o) => s + o.totalCents, 0)) + " open" },
    ];
  }, [orders, filtered, period]);

  const replaceOrder = (next) => setOrders((list) => list.map((o) => (o.id === next.id ? next : o)));

  const copyBuyerLink = async (order) => {
    const url = orderPageUrl(order, galleryById.get(order.galleryId)?.slug);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Buyer link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const cancel = async (order) => {
    const result = await runOrderAction(order.id, "cancel", {});
    if (result?.order) {
      replaceOrder(result.order);
      toast.success(`${order.number} cancelled`);
    } else toast.error("Couldn't cancel the order");
  };

  const open = openId ? orders.find((o) => o.id === openId) : null;
  if (open) {
    return (
      <OrderDetailScreen
        key={open.id}
        order={open}
        items={itemsByOrder.get(open.id) || []}
        customer={customerById.get(open.customerId) || null}
        gallery={galleryById.get(open.galleryId) || null}
        settings={settings}
        assetById={assetById}
        entitlements={entitlements}
        licenses={licenses.filter((l) => (itemsByOrder.get(open.id) || []).some((i) => i.licenseId === l.id))}
        onBack={() => {
          setSection(null);
          setOpenId(null);
        }}
        onChange={replaceOrder}
        onEntitlementChange={(next) => setEntitlements((list) => list.map((e) => (e.id === next.id ? next : e)))}
        onReload={load}
      />
    );
  }

  const columns = [
    {
      key: "number",
      header: "Order",
      render: (o) => {
        const lines = itemsByOrder.get(o.id) || [];
        return (
          <div className="min-w-0">
            <p className="font-mono text-sm font-medium text-foreground">{o.number || "—"}</p>
            <p className="truncate text-[11px] text-text-tertiary">
              {lines[0]?.title || "No items"}
              {lines.length > 1 ? ` +${lines.length - 1} more` : ""}
            </p>
          </div>
        );
      },
    },
    {
      key: "customer",
      header: "Customer",
      render: (o) => (
        <div className="min-w-0">
          <p className="truncate text-xs text-foreground">{o.name || customerById.get(o.customerId)?.name || o.email}</p>
          <p className="truncate text-[11px] text-text-tertiary">{o.email}</p>
        </div>
      ),
    },
    {
      key: "gallery",
      header: "Gallery",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (o) => galleryById.get(o.galleryId)?.name || <span className="text-text-tertiary">—</span>,
    },
    {
      key: "date",
      header: "Placed",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (o) => formatDate(o.createdAt),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      className: "tabular-nums text-xs font-medium",
      render: (o) => (
        <span className="inline-flex flex-col items-end">
          {formatMoney(o.totalCents, o.currency)}
          {o.refundedCents ? <span className="text-[10px] font-normal text-text-tertiary">−{formatMoney(o.refundedCents, o.currency)}</span> : null}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={o.status} map={ORDER_STATUS_META} className="text-[10px]" />
          {o.status === "paid" && o.fulfillmentStatus !== "fulfilled" ? (
            <StatusPill status={o.fulfillmentStatus} map={FULFILLMENT_META} className="hidden text-[10px] xl:inline-flex" />
          ) : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (o) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            extra={[
              { icon: Link2, label: "Copy buyer link", onSelect: () => copyBuyerLink(o) },
              ...(o.status === "pending" || o.status === "failed" ? [{ icon: Ban, label: "Cancel order", onSelect: () => cancel(o) }] : []),
            ]}
            onEdit={() => setOpenId(o.id)}
            editLabel="Open order"
            editIcon={ExternalLink}
          />
        </div>
      ),
    },
  ];

  const exportColumns = [
    { key: "number", header: "Order" },
    { key: "invoice", header: "Invoice", value: (o) => invoiceNumber(o, settings) },
    { key: "createdAt", header: "Placed", value: (o) => formatDate(o.createdAt) },
    { key: "paidAt", header: "Paid", value: (o) => (o.paidAt ? formatDate(o.paidAt) : "") },
    { key: "email", header: "Email" },
    { key: "name", header: "Name" },
    { key: "gallery", header: "Gallery", value: (o) => galleryById.get(o.galleryId)?.name || "" },
    { key: "items", header: "Items", value: (o) => (itemsByOrder.get(o.id) || []).map((i) => `${i.productName}: ${i.title}`).join("; ") },
    { key: "subtotal", header: "Subtotal", value: (o) => centsToDollarString(o.subtotalCents) },
    { key: "discount", header: "Discount", value: (o) => centsToDollarString(o.discountCents) },
    { key: "tax", header: "Tax", value: (o) => centsToDollarString(o.taxCents) },
    { key: "total", header: "Total", value: (o) => centsToDollarString(o.totalCents) },
    { key: "refunded", header: "Refunded", value: (o) => centsToDollarString(o.refundedCents) },
    { key: "currency", header: "Currency" },
    { key: "status", header: "Status" },
    { key: "provider", header: "Payment" },
    { key: "providerRef", header: "Reference" },
  ];

  const hasFilters = statusFilter !== "all" || galleryFilter !== "all" || providerFilter !== "all" || period !== "all" || Boolean(search);
  const clearFilters = () => {
    setStatusFilter("all");
    setGalleryFilter("all");
    setProviderFilter("all");
    setPeriod("all");
    setSearch("");
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Orders & Invoices"
        description="Every gallery sale — payment, fulfilment, refunds and the invoice for each."
        actions={<ExportButton filename="orders" rows={filtered} columns={exportColumns} label="Export CSV" />}
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={period} onValueChange={setPeriod} options={PERIOD_FILTERS} placeholder="Period" />
          {galleryFilters.length > 2 ? (
            <FilterDropdown value={galleryFilter} onValueChange={setGalleryFilter} options={galleryFilters} placeholder="Gallery" />
          ) : null}
          <FilterDropdown value={providerFilter} onValueChange={setProviderFilter} options={PROVIDER_FILTERS} placeholder="Payment" />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search orders, buyers, items..." className="w-full sm:w-64" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" label="Loading orders" />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(o) => o.id}
          onRowClick={(o) => setOpenId(o.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={hasFilters ? SlidersHorizontal : orders.length ? ReceiptText : ShoppingCart}
                title={hasFilters ? "No matching orders" : "No orders yet"}
                description={
                  hasFilters
                    ? "Try adjusting your filters."
                    : "Orders land here when someone buys from a gallery. Turn on Selling in a gallery's editor to open its store."
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" className="border-border bg-surface-card" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            </div>
          }
        />
      )}
      {!loading && filtered.length > 0 ? (
        <div className="text-xs text-text-secondary">
          Showing {plural(filtered.length, "order")} of {orders.length}
        </div>
      ) : null}
    </MainScreenWrapper>
  );
}

export default OrdersInvoicesScreen;
