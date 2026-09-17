"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
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
  CURRENCY_OPTIONS,
  INVOICE_STATUS_FILTER_OPTIONS,
  INVOICE_STATUS_MAP,
  ORDER_STATUS_FILTER_OPTIONS,
  ORDER_STATUS_MAP,
  formatMoney,
  parseDollarsToCents,
} from "./constants";
import {
  createGalleryOrder,
  listGalleryOrders,
  softDeleteGalleryOrder,
  updateGalleryOrder,
} from "@/lib/supabase/galleries";

// Orders and Invoices — order management, invoices and receipts, refunds,
// tax records, order status, exportable reports.

const EMPTY_DRAFT = {
  customerName: "",
  customerEmail: "",
  total: "49.00",
  tax: "0.00",
  currency: "usd",
};

const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

const INVOICE_STATUS_OPTIONS = Object.entries(INVOICE_STATUS_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

function OrderDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [status, setStatus] = useState("pending");
  const [invoiceStatus, setInvoiceStatus] = useState("draft");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDraft({
      ...EMPTY_DRAFT,
      customerName: initial?.customerName ?? "",
      customerEmail: initial?.customerEmail ?? "",
      total: initial ? (Number(initial.totalCents || 0) / 100).toFixed(2) : "49.00",
      tax: initial ? (Number(initial.taxCents || 0) / 100).toFixed(2) : "0.00",
      currency: initial?.currency ?? "usd",
    });
    setStatus(initial?.status || "pending");
    setInvoiceStatus(initial?.invoiceStatus || "draft");
    setBusy(false);
  }, [open, initial]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    if (!draft.customerName.trim()) {
      toast.error("Give the order a customer name.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      customerName: draft.customerName.trim(),
      customerEmail: draft.customerEmail.trim(),
      totalCents: parseDollarsToCents(draft.total),
      taxCents: parseDollarsToCents(draft.tax),
      currency: draft.currency,
      status,
      invoiceStatus,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit order" : "New order"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Record an order with totals, tax, and invoice state.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer" htmlFor="order-name">
              <Input
                id="order-name"
                className="bg-surface-card"
                value={draft.customerName}
                onChange={(e) => set("customerName")(e.target.value)}
                placeholder="Jane Miller"
                autoFocus
              />
            </Field>
            <Field label="Email" htmlFor="order-email">
              <Input
                id="order-email"
                className="bg-surface-card"
                value={draft.customerEmail}
                onChange={(e) => set("customerEmail")(e.target.value)}
                placeholder="jane@example.com"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Total" htmlFor="order-total">
              <Input
                id="order-total"
                className="bg-surface-card"
                value={draft.total}
                onChange={(e) => set("total")(e.target.value)}
                placeholder="49.00"
              />
            </Field>
            <Field label="Tax" htmlFor="order-tax">
              <Input
                id="order-tax"
                className="bg-surface-card"
                value={draft.tax}
                onChange={(e) => set("tax")(e.target.value)}
                placeholder="0.00"
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Order status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Invoice">
              <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
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
            {editing ? "Save changes" : "Create order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toCsv(rows) {
  const header = "order_number,customer,email,status,invoice,total_cents,tax_cents,currency";
  const lines = rows.map((o) =>
    [
      o.orderNumber,
      `"${String(o.customerName).replace(/"/g, '""')}"`,
      o.customerEmail,
      o.status,
      o.invoiceStatus,
      String(o.totalCents),
      String(o.taxCents),
      o.currency,
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export function OrdersInvoicesScreen({ projectId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [invoiceFilter, setInvoiceFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let alive = true;
    listGalleryOrders(projectId).then((rows) => {
      if (!alive) return;
      setOrders(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid");
    return [
      { label: "Orders", value: String(orders.length), footer: "all time" },
      {
        label: "Revenue",
        value: formatMoney(paid.reduce((s, o) => s + o.totalCents, 0)),
        footer: "paid orders",
      },
      { label: "Paid", value: String(paid.length), footer: "collected" },
      {
        label: "Refunded",
        value: String(orders.filter((o) => o.status === "refunded").length),
        footer: "returned",
      },
    ];
  }, [orders]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (invoiceFilter !== "all" && order.invoiceStatus !== invoiceFilter) return false;
      if (
        needle &&
        !`${order.orderNumber} ${order.customerName} ${order.customerEmail}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, invoiceFilter]);

  const filtersActive =
    statusFilter !== "all" || invoiceFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setStatusFilter("all");
    setInvoiceFilter("all");
    setSearch("");
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (order) => {
    setEditing(order);
    setDialogOpen(true);
  };

  const nextOrderNumber = () => `ORD-${String(orders.length + 1).padStart(4, "0")}`;

  const submitOrder = async (draft) => {
    if (editing) {
      const previous = orders;
      setOrders((rows) =>
        rows.map((o) => (o.id === editing.id ? { ...o, ...draft } : o)),
      );
      const saved = await updateGalleryOrder(editing.id, draft);
      if (!saved) {
        setOrders(previous);
        toast.error("Could not save the order.");
        return false;
      }
      setOrders((rows) => rows.map((o) => (o.id === saved.id ? saved : o)));
      toast.success(`Saved ${saved.orderNumber || "order"}.`);
      return true;
    }
    const id = crypto.randomUUID();
    const orderNumber = nextOrderNumber();
    const optimistic = {
      id,
      projectId,
      customerId: null,
      orderNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setOrders((rows) => [optimistic, ...rows]);
    const created = await createGalleryOrder({ id, projectId, orderNumber, ...draft });
    if (!created) {
      setOrders((rows) => rows.filter((o) => o.id !== id));
      toast.error("Could not create the order.");
      return false;
    }
    setOrders((rows) => rows.map((o) => (o.id === id ? created : o)));
    toast.success(`Created ${created.orderNumber}.`);
    return true;
  };

  const markPaid = async (order) => {
    const previous = orders;
    setOrders((rows) =>
      rows.map((o) =>
        o.id === order.id ? { ...o, status: "paid", invoiceStatus: "paid" } : o,
      ),
    );
    const saved = await updateGalleryOrder(order.id, { status: "paid", invoiceStatus: "paid" });
    if (!saved) {
      setOrders(previous);
      toast.error("Could not mark the order paid.");
      return;
    }
    setOrders((rows) => rows.map((o) => (o.id === saved.id ? saved : o)));
    toast.success(`${saved.orderNumber} marked paid.`);
  };

  const refundOrder = async (order) => {
    const previous = orders;
    setOrders((rows) =>
      rows.map((o) => (o.id === order.id ? { ...o, status: "refunded" } : o)),
    );
    const saved = await updateGalleryOrder(order.id, { status: "refunded" });
    if (!saved) {
      setOrders(previous);
      toast.error("Could not refund the order.");
      return;
    }
    setOrders((rows) => rows.map((o) => (o.id === saved.id ? saved : o)));
    toast.success(`${saved.orderNumber} refunded.`);
  };

  const duplicateOrder = async (order) => {
    const id = crypto.randomUUID();
    const orderNumber = nextOrderNumber();
    const optimistic = {
      ...order,
      id,
      orderNumber,
      status: "pending",
      invoiceStatus: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setOrders((rows) => [optimistic, ...rows]);
    const created = await createGalleryOrder({
      id,
      projectId,
      orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      status: "pending",
      invoiceStatus: "draft",
      totalCents: order.totalCents,
      taxCents: order.taxCents,
      currency: order.currency,
    });
    if (!created) {
      setOrders((rows) => rows.filter((o) => o.id !== id));
      toast.error("Could not duplicate the order.");
      return;
    }
    setOrders((rows) => rows.map((o) => (o.id === id ? created : o)));
    toast.success(`Duplicated as ${created.orderNumber}.`);
  };

  const removeOrder = async (order) => {
    const previous = orders;
    setOrders((rows) => rows.filter((o) => o.id !== order.id));
    const ok = await softDeleteGalleryOrder(order.id);
    if (!ok) {
      setOrders(previous);
      toast.error("Could not delete the order.");
      return;
    }
    toast.success(`Deleted ${order.orderNumber || "order"}.`);
  };

  const exportReport = async () => {
    const csv = toCsv(filtered);
    try {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "orders-report.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filtered.length} orders.`);
    } catch {
      try {
        await navigator.clipboard.writeText(csv);
        toast.success("Report copied to clipboard.");
      } catch {
        toast.error("Could not export the report.");
      }
    }
  };

  const columns = [
    {
      key: "order",
      header: "Order",
      render: (order) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[200px] truncate font-mono text-sm font-semibold text-foreground">
            {order.orderNumber || "—"}
          </span>
          <span className="truncate text-xs text-text-secondary">
            {order.customerName || "Unknown"} · {order.customerEmail || "no email"}
          </span>
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      className: "text-right tabular-nums text-xs",
      render: (order) => (
        <div className="flex flex-col items-end gap-0.5">
          <span>{formatMoney(order.totalCents, order.currency)}</span>
          <span className="text-[11px] text-text-tertiary">
            tax {formatMoney(order.taxCents, order.currency)}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Order",
      render: (order) => <StatusPill status={order.status} map={ORDER_STATUS_MAP} />,
    },
    {
      key: "invoice",
      header: "Invoice",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (order) => <StatusPill status={order.invoiceStatus} map={INVOICE_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (order) => (
        <ActionMenu
          label={`Actions for ${order.orderNumber}`}
          items={[
            order.status === "paid"
              ? null
              : { icon: Receipt, label: "Mark paid", onSelect: () => markPaid(order) },
            order.status === "refunded"
              ? null
              : { icon: Copy, label: "Refund", onSelect: () => refundOrder(order) },
            { icon: Pencil, label: "Edit", onSelect: () => openEdit(order) },
            { icon: Copy, label: "Duplicate", onSelect: () => duplicateOrder(order) },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              destructive: true,
              onSelect: () => removeOrder(order),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Orders and Invoices"
        description="Orders, invoices and receipts — refunds, tax records, exportable reports."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-border bg-surface-card text-foreground hover:bg-surface-active"
              onClick={exportReport}
            >
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" /> New order
            </Button>
          </div>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={ORDER_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={invoiceFilter}
            onValueChange={setInvoiceFilter}
            options={INVOICE_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search orders…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading orders" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(order) => order.id}
          onRowClick={openEdit}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              {filtersActive ? (
                <EmptyState
                  icon={Receipt}
                  title="No orders match these filters"
                  description="Try a different order, invoice state, or search term."
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
                  icon={Receipt}
                  title="No orders yet"
                  description="Orders from the storefront will land here."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={openCreate}
                    >
                      <Plus className="h-4 w-4" /> New order
                    </Button>
                  }
                />
              )}
            </div>
          }
        />
      )}

      <OrderDialog
        key={editing ? `order:${editing.id}` : "order:new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={submitOrder}
      />
    </MainScreenWrapper>
  );
}

export default OrdersInvoicesScreen;
