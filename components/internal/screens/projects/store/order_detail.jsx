"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  BadgeCheck,
  Check,
  Clock,
  Copy,
  CreditCard,
  Download,
  FileText,
  Link2,
  Loader2,
  Package,
  ReceiptText,
  RotateCcw,
  Truck,
  Undo2,
  User,
} from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import { EditorShell } from "@/components/internal/shared/editor_shell";
import {
  EmptyState,
  Field,
  SectionCard,
  SettingRow,
  SettingsList,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { AssetThumbnail } from "@/components/internal/shared/asset_thumbnail";
import { InvoiceView } from "./invoice_view";
import {
  ENTITLEMENT_SOURCE_META,
  ENTITLEMENT_STATE_META,
  FULFILLMENT_META,
  ORDER_STATUS_META,
  PRODUCT_KIND_META,
  PROVIDER_META,
  RENDITION_OPTIONS,
  centsToDollarString,
  entitlementState,
  formatDate,
  formatDateTime,
  formatMoney,
  limitLabel,
  parseDollarsToCents,
  plural,
} from "./constants";
import {
  addOrderEvent,
  entitlementUrl,
  listOrderEvents,
  orderPageUrl,
  runOrderAction,
  updateEntitlement,
  updateOrder,
} from "@/lib/supabase/store";
import { isShippedKind, withEntitlementPatch } from "@/lib/commerce/shape";
import { getUser } from "@/lib/supabase/user";

const NAV = [
  {
    group: null,
    items: [
      { key: "summary", label: "Items & payment", icon: ReceiptText, desc: "What was bought, what it cost, and how it was paid." },
      { key: "buyer", label: "Customer & billing", icon: User, desc: "Who bought it and the details they gave at checkout." },
      { key: "delivery", label: "Downloads & licences", icon: Download, desc: "Download links and licences this order granted." },
    ],
  },
  {
    group: "Records",
    items: [
      { key: "timeline", label: "Timeline", icon: Clock, desc: "Everything that happened to this order." },
      { key: "invoice", label: "Invoice", icon: FileText, desc: "A printable invoice or receipt." },
    ],
  },
];

const EVENT_ICONS = {
  created: Package,
  paid: CreditCard,
  fulfilled: BadgeCheck,
  fulfillment: Truck,
  refund: Undo2,
  cancelled: Ban,
  entitlement: Download,
  license: BadgeCheck,
  payment: CreditCard,
  note: FileText,
};

const RENDITION_LABEL = Object.fromEntries(RENDITION_OPTIONS.map((o) => [o.value, o.label]));

const outlineButton =
  "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

function DetailLine({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="min-w-0 text-right text-foreground">{children}</span>
    </div>
  );
}

function RefundDialog({ open, onOpenChange, order, busy, onSubmit }) {
  const remaining = order.totalCents - order.refundedCents;
  const [amount, setAmount] = useState(centsToDollarString(remaining));
  const [reason, setReason] = useState("");
  const [revoke, setRevoke] = useState(true);
  const [terminate, setTerminate] = useState(false);
  const cents = parseDollarsToCents(amount);
  const full = cents >= remaining;

  const [seeded, setSeeded] = useState(open);
  if (open !== seeded) {
    setSeeded(open);
    if (open) {
      setAmount(centsToDollarString(remaining));
      setReason("");
      setRevoke(true);
      setTerminate(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refund {order.number}</DialogTitle>
          <DialogDescription>
            {order.provider === "stripe"
              ? "The refund is sent to Stripe and returns to the buyer's card."
              : "Recorded here — return the money through whatever took the payment."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Amount" hint={`Up to ${formatMoney(remaining, order.currency)} remaining.`}>
            <div className="flex items-center gap-1 rounded-md border border-border bg-surface-card pl-3">
              <span className="text-sm text-text-tertiary">$</span>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="border-0 bg-transparent px-1 focus-visible:ring-0" />
            </div>
          </Field>
          <Field label="Reason">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Shown on the order timeline." className="bg-surface-card" />
          </Field>
          {full ? (
            <SettingsList>
              <SettingRow
                title="Revoke download links"
                description="The buyer's links stop working."
                checked={revoke}
                onCheckedChange={setRevoke}
              />
              <SettingRow
                title="Terminate licences"
                description="Licences issued by this order are marked terminated."
                checked={terminate}
                onCheckedChange={setTerminate}
              />
            </SettingsList>
          ) : (
            <p className="text-xs text-text-tertiary">A partial refund keeps the buyer’s downloads and licences.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" className="text-muted-foreground hover:bg-surface-active" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={busy || cents <= 0 || cents > remaining}
            onClick={() => onSubmit({ amountCents: cents, reason: reason.trim(), revokeAccess: revoke, terminateLicenses: terminate })}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            Refund {formatMoney(Math.min(cents, remaining), order.currency)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarkPaidDialog({ open, onOpenChange, order, busy, onSubmit }) {
  const [reference, setReference] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark {order.number} paid</DialogTitle>
          <DialogDescription>
            For an invoice or offline payment. Fulfilment runs straight away and the Order paid workflows fire.
          </DialogDescription>
        </DialogHeader>
        <Field label="Payment reference" hint="Bank transfer id, cheque number — optional.">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. BACS 20260926-114" className="bg-surface-card" />
        </Field>
        <DialogFooter>
          <Button variant="ghost" className="text-muted-foreground hover:bg-surface-active" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy} onClick={() => onSubmit(reference.trim())}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Mark paid — {formatMoney(order.totalCents, order.currency)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrderDetailScreen({
  order,
  items,
  customer,
  gallery,
  settings,
  assetById,
  entitlements,
  licenses,
  onBack,
  onChange,
  onEntitlementChange,
  onReload,
}) {
  const [events, setEvents] = useState(null);
  const [note, setNote] = useState("");
  const [staffNote, setStaffNote] = useState(order.staffNote);
  const [busy, setBusy] = useState(null);
  const [showRefund, setShowRefund] = useState(false);
  const [showPaid, setShowPaid] = useState(false);

  useEffect(() => {
    let alive = true;
    listOrderEvents(order.id).then((rows) => alive && setEvents(rows ?? []));
    return () => {
      alive = false;
    };
  }, [order.id, order.status, order.fulfillmentStatus]);

  const orderEntitlements = useMemo(() => entitlements.filter((e) => e.orderId === order.id), [entitlements, order.id]);
  const buyerLink = orderPageUrl(order, gallery?.slug);
  const money = (cents) => formatMoney(cents, order.currency);
  const pendingShipments = items.filter((i) => isShippedKind(i.kind) && i.status === "pending").length;

  const act = async (action, payload, success) => {
    setBusy(action);
    const user = await getUser();
    const result = await runOrderAction(order.id, action, { ...payload, actor: user?.name || user?.email || "Staff" });
    setBusy(null);
    if (!result?.order) {
      toast.error(result?.error ? `Couldn't complete that — ${String(result.error).replace(/_/g, " ")}` : "Couldn't complete that");
      return false;
    }
    onChange(result.order);
    onReload?.();
    toast.success(success);
    return true;
  };

  const copy = async (text, what = "Link") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const addNote = async () => {
    const summary = note.trim();
    if (!summary) return;
    const user = await getUser();
    const optimistic = { id: crypto.randomUUID(), orderId: order.id, kind: "note", summary, actor: user?.name || user?.email || "Staff", occurredAt: new Date().toISOString() };
    setEvents((list) => [optimistic, ...(list || [])]);
    setNote("");
    const created = await addOrderEvent({ projectId: order.projectId, orderId: order.id, kind: "note", summary, actor: optimistic.actor });
    if (created) setEvents((list) => list.map((e) => (e.id === optimistic.id ? created : e)));
    else {
      setEvents((list) => list.filter((e) => e.id !== optimistic.id));
      toast.error("Couldn't add the note");
    }
  };

  const saveStaffNote = async () => {
    if (staffNote === order.staffNote) return;
    const saved = await updateOrder(order.id, { staffNote });
    if (saved) onChange(saved);
    else toast.error("Couldn't save the note");
  };

  const patchEntitlement = async (e, patch, success) => {
    onEntitlementChange(withEntitlementPatch(e, patch));
    const saved = await updateEntitlement(e.id, patch);
    if (saved) {
      onEntitlementChange(saved);
      toast.success(success);
    } else {
      onEntitlementChange(e);
      toast.error("Couldn't update the download");
    }
  };

  const status = order.status;
  const actions = (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label="Copy the buyer's order link"
        title="Copy the buyer's order link"
        className={outlineButton}
        disabled={!buyerLink}
        onClick={() => copy(buyerLink, "Buyer link")}
      >
        <Link2 className="h-4 w-4" />
      </Button>
      {status === "pending" || status === "failed" ? (
        <>
          <Button
            variant="outline"
            className={outlineButton}
            disabled={Boolean(busy)}
            onClick={() => act("cancel", {}, "Order cancelled")}
          >
            {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            Cancel order
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={Boolean(busy)} onClick={() => setShowPaid(true)}>
            <Check className="h-4 w-4" />
            Mark paid
          </Button>
        </>
      ) : null}
      {pendingShipments > 0 && ["paid", "fulfilled", "partially_refunded"].includes(status) ? (
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={Boolean(busy)}
          onClick={() => act("fulfill", { markPrintsShipped: true }, "Marked shipped")}
        >
          {busy === "fulfill" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
          Mark {plural(pendingShipments, "item")} shipped
        </Button>
      ) : null}
      {status === "paid" && order.fulfillmentStatus === "unfulfilled" && pendingShipments === 0 ? (
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={Boolean(busy)}
          onClick={() => act("fulfill", {}, "Order delivered")}
        >
          {busy === "fulfill" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Deliver now
        </Button>
      ) : null}
      {["paid", "fulfilled", "partially_refunded"].includes(status) ? (
        <Button variant="outline" className={outlineButton} disabled={Boolean(busy)} onClick={() => setShowRefund(true)}>
          <Undo2 className="h-4 w-4" />
          Refund
        </Button>
      ) : null}
    </>
  );

  return (
    <>
      <EditorShell
        back={{ label: "Orders & Invoices", onClick: onBack }}
        title={order.number || "Order"}
        status={order.status}
        statusMap={ORDER_STATUS_META}
        badges={
          <>
            <StatusPill status={order.fulfillmentStatus} map={FULFILLMENT_META} className="text-[10px]" />
            <StatusPill status={order.provider} map={PROVIDER_META} className="text-[10px]" />
          </>
        }
        meta={`${money(order.totalCents)} · ${order.name || order.email} · ${formatDateTime(order.createdAt)}${gallery ? ` · ${gallery.name}` : ""}`}
        actions={actions}
        nav={NAV}
        subject={order}
      >
        {({ active }) => (
          <>
            {active === "summary" ? (
              <div className="space-y-8">
                <SectionCard bare title="Items" description={plural(items.length, "item")} bodyPadding={false}>
                  <div className="divide-y divide-border">
                    {items.map((item) => {
                      const meta = PRODUCT_KIND_META[item.kind];
                      const asset = item.assetId ? assetById.get(item.assetId) : null;
                      const Icon = meta?.icon || Package;
                      const license = item.licenseId ? licenses.find((l) => l.id === item.licenseId) : null;
                      return (
                        <div key={item.id} className="flex items-center gap-3 py-3">
                          {asset ? (
                            <AssetThumbnail asset={asset} className="h-11 w-11 rounded-md" iconClassName="h-4 w-4" />
                          ) : (
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface-card text-text-secondary">
                              <Icon className="h-4 w-4" />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                            <p className="truncate text-[11px] text-text-tertiary">
                              {item.productName}
                              {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
                              {item.assetIds?.length && !item.assetId ? ` · ${plural(item.assetIds.length, "asset")}` : ""}
                              {license ? ` · ${license.reference}` : ""}
                            </p>
                          </div>
                          <StatusPill status={item.kind} map={PRODUCT_KIND_META} className="hidden text-[10px] sm:inline-flex" />
                          <span className={cn("w-24 text-right text-sm tabular-nums", item.status === "refunded" ? "text-text-tertiary line-through" : "text-foreground")}>
                            {money(item.totalCents)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="ml-auto w-full max-w-xs border-t border-border pt-3">
                    <DetailLine label="Subtotal">{money(order.subtotalCents)}</DetailLine>
                    {order.discountCents ? (
                      <DetailLine label={`Discount${order.discountCode ? ` · ${order.discountCode}` : ""}`}>−{money(order.discountCents)}</DetailLine>
                    ) : null}
                    {order.taxCents ? (
                      <DetailLine label={`${order.billing?.taxLabel || "Tax"}${order.billing?.taxInclusive ? " (incl.)" : ""}`}>{money(order.taxCents)}</DetailLine>
                    ) : null}
                    <div className="flex items-center justify-between border-t border-border py-2.5 text-sm font-semibold text-foreground">
                      <span>Total</span>
                      <span className="tabular-nums">{money(order.totalCents)}</span>
                    </div>
                    {order.refundedCents ? <DetailLine label="Refunded">−{money(order.refundedCents)}</DetailLine> : null}
                  </div>
                </SectionCard>

                <SectionCard bare title="Payment">
                  <div className="grid gap-x-10 sm:grid-cols-2">
                    <div>
                      <DetailLine label="Provider">
                        <StatusPill status={order.provider} map={PROVIDER_META} className="text-[10px]" />
                      </DetailLine>
                      <DetailLine label="Reference">
                        <span className="font-mono text-xs">{order.providerRef || "—"}</span>
                      </DetailLine>
                    </div>
                    <div>
                      <DetailLine label="Placed">{formatDateTime(order.createdAt)}</DetailLine>
                      <DetailLine label="Paid">{formatDateTime(order.paidAt)}</DetailLine>
                      {order.refundedAt ? <DetailLine label="Refunded">{formatDateTime(order.refundedAt)}</DetailLine> : null}
                      {order.cancelledAt ? <DetailLine label="Cancelled">{formatDateTime(order.cancelledAt)}</DetailLine> : null}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard bare title="Staff note" description="Private to the team — never shown to the buyer.">
                  <Textarea
                    value={staffNote}
                    onChange={(e) => setStaffNote(e.target.value)}
                    onBlur={saveStaffNote}
                    rows={3}
                    placeholder="Anything the team should know about this order."
                    className="bg-surface-card"
                  />
                </SectionCard>
              </div>
            ) : null}

            {active === "buyer" ? (
              <div className="space-y-8">
                <SectionCard bare title="Customer">
                  <div className="grid gap-x-10 sm:grid-cols-2">
                    <div>
                      <DetailLine label="Name">{order.name || customer?.name || "—"}</DetailLine>
                      <DetailLine label="Email">
                        <button type="button" className="hover:underline" onClick={() => copy(order.email, "Email")}>
                          {order.email}
                        </button>
                      </DetailLine>
                      <DetailLine label="Company">{order.billing?.company || customer?.company || "—"}</DetailLine>
                      <DetailLine label="Phone">{order.billing?.phone || customer?.phone || "—"}</DetailLine>
                    </div>
                    <div>
                      <DetailLine label="Orders">{customer ? customer.ordersCount : "—"}</DetailLine>
                      <DetailLine label="Lifetime spend">{customer ? money(customer.totalSpentCents) : "—"}</DetailLine>
                      <DetailLine label="Customer since">{formatDate(customer?.firstOrderAt || customer?.createdAt)}</DetailLine>
                      <DetailLine label="Terms accepted">{order.termsAcceptedAt ? formatDateTime(order.termsAcceptedAt) : "Not required"}</DetailLine>
                    </div>
                  </div>
                </SectionCard>
                <SectionCard bare title="Billing address">
                  {order.billing?.address && Object.values(order.billing.address).some(Boolean) ? (
                    <p className="whitespace-pre-line text-sm text-foreground">
                      {[
                        order.billing.address.line1,
                        order.billing.address.line2,
                        [order.billing.address.city, order.billing.address.region, order.billing.address.postalCode].filter(Boolean).join(", "),
                        order.billing.address.country,
                      ]
                        .filter(Boolean)
                        .join("\n")}
                    </p>
                  ) : (
                    <p className="text-xs text-text-tertiary">Not collected — turn it on in Cart & Checkout.</p>
                  )}
                </SectionCard>
                <SectionCard bare title="Note from the buyer">
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {order.customerNote || <span className="text-text-tertiary">No note.</span>}
                  </p>
                </SectionCard>
              </div>
            ) : null}

            {active === "delivery" ? (
              <div className="space-y-8">
                <SectionCard
                  bare
                  title="Download links"
                  description={orderEntitlements.length ? `${plural(orderEntitlements.length, "link")} — manage them all on Digital Downloads.` : undefined}
                  bodyPadding={false}
                >
                  {orderEntitlements.length ? (
                    <div className="divide-y divide-border">
                      {orderEntitlements.map((e) => {
                        const asset = assetById.get(e.assetId);
                        const state = entitlementState(e);
                        return (
                          <div key={e.id} className="flex items-center gap-3 py-3">
                            <AssetThumbnail asset={asset} assetId={e.assetId} className="h-10 w-10 rounded-md" iconClassName="h-4 w-4" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-foreground">{asset?.name || "Asset"}</p>
                              <p className="truncate text-[11px] text-text-tertiary">
                                {RENDITION_LABEL[e.rendition]} · {e.downloadsCount} of {limitLabel(e.maxDownloads).toLowerCase()} used · expires{" "}
                                {e.expiresAt ? formatDate(e.expiresAt) : "never"} · {ENTITLEMENT_SOURCE_META[e.source]?.label}
                              </p>
                            </div>
                            <StatusPill status={state} map={ENTITLEMENT_STATE_META} className="text-[10px]" />
                            <Button variant="ghost" size="icon-sm" aria-label="Copy download link" className="h-8 w-8 text-text-secondary hover:bg-surface-active hover:text-foreground" onClick={() => copy(entitlementUrl(e.token), "Download link")}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            {state === "revoked" ? (
                              <Button variant="ghost" size="icon-sm" aria-label="Restore link" title="Restore link" className="h-8 w-8 text-text-secondary hover:bg-surface-active hover:text-foreground" onClick={() => patchEntitlement(e, { revokedAt: null }, "Link restored")}>
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon-sm" aria-label="Revoke link" title="Revoke link" className="h-8 w-8 text-text-secondary hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400" onClick={() => patchEntitlement(e, { revokedAt: new Date().toISOString() }, "Link revoked")}>
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Download}
                      title="No downloads on this order"
                      description={order.status === "pending" ? "Links are created once the order is paid." : "Nothing on this order delivers files."}
                    />
                  )}
                </SectionCard>
                <SectionCard bare title="Licences" description="Issued to the buyer's licensee record — open them on Issued Licenses.">
                  {licenses.length ? (
                    <div className="divide-y divide-border">
                      {licenses.map((l) => (
                        <div key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-foreground">{l.title}</p>
                            <p className="font-mono text-[11px] text-text-tertiary">{l.reference}</p>
                          </div>
                          <span className="text-xs capitalize text-text-secondary">{l.status}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-tertiary">No licences — this order had no licence products, or they haven’t been issued yet.</p>
                  )}
                </SectionCard>
              </div>
            ) : null}

            {active === "timeline" ? (
              <SectionCard bare title="Timeline">
                <div className="mb-5 flex gap-2">
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addNote()}
                    placeholder="Add a note to the timeline…"
                    className="bg-surface-card"
                  />
                  <Button variant="outline" className={outlineButton} disabled={!note.trim()} onClick={addNote}>
                    Add
                  </Button>
                </div>
                {events === null ? (
                  <p className="py-6 text-center text-xs text-text-tertiary">Loading…</p>
                ) : events.length ? (
                  <ol className="relative space-y-4 border-l border-border pl-5">
                    {events.map((e) => {
                      const Icon = EVENT_ICONS[e.kind] || FileText;
                      return (
                        <li key={e.id} className="relative">
                          <span className="absolute -left-[29px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-card text-text-secondary">
                            <Icon className="h-3 w-3" />
                          </span>
                          <p className="text-sm text-foreground">{e.summary}</p>
                          <p className="text-[11px] text-text-tertiary">
                            {formatDateTime(e.occurredAt)}
                            {e.actor ? ` · ${e.actor}` : ""}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="py-6 text-center text-xs text-text-tertiary">Nothing recorded yet.</p>
                )}
              </SectionCard>
            ) : null}

            {active === "invoice" ? (
              <InvoiceView order={order} items={items} customer={customer} settings={settings} galleryName={gallery?.name} />
            ) : null}
          </>
        )}
      </EditorShell>

      <RefundDialog
        open={showRefund}
        onOpenChange={setShowRefund}
        order={order}
        busy={busy === "refund"}
        onSubmit={async (payload) => {
          const ok = await act("refund", payload, "Refund recorded");
          if (ok) setShowRefund(false);
        }}
      />
      <MarkPaidDialog
        open={showPaid}
        onOpenChange={setShowPaid}
        order={order}
        busy={busy === "mark_paid"}
        onSubmit={async (reference) => {
          const ok = await act("mark_paid", { reference }, "Order marked paid and fulfilled");
          if (ok) setShowPaid(false);
        }}
      />
    </>
  );
}

export default OrderDetailScreen;
