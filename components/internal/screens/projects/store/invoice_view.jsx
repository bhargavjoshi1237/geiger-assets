"use client";

import React, { useRef } from "react";
import { Printer } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { SectionCard } from "@/components/internal/shared/screen_kit";
import { formatDate, formatMoney } from "./constants";

/** INV-0042 for order ORD-0042 — the invoice shares the order's sequence. */
export function invoiceNumber(order, settings) {
  const orderPrefix = settings?.invoices?.orderPrefix || "ORD-";
  const invoicePrefix = settings?.invoices?.invoicePrefix || "INV-";
  const number = String(order?.number || "");
  return number.startsWith(orderPrefix) ? `${invoicePrefix}${number.slice(orderPrefix.length)}` : `${invoicePrefix}${number}`;
}

// Printing goes through a bare window so the workspace chrome stays out of it.
function printNode(node, title) {
  if (!node || typeof window === "undefined") return;
  const frame = window.open("", "_blank", "width=900,height=1000");
  if (!frame) return;
  frame.document.write(`<!doctype html><html><head><title>${title}</title><style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #111; margin: 48px; line-height: 1.5; }
    h1 { font-size: 22px; margin: 0; }
    h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #666; margin: 0 0 6px; }
    p { font-size: 13px; margin: 0; white-space: pre-wrap; }
    .row { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 28px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0 20px; }
    th { text-align: left; font-weight: 500; color: #666; border-bottom: 1px solid #ddd; padding: 8px 0; }
    td { border-bottom: 1px solid #eee; padding: 8px 0; vertical-align: top; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .totals { margin-left: auto; width: 280px; font-size: 13px; }
    .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
    .grand { border-top: 1px solid #111; margin-top: 6px; padding-top: 8px !important; font-weight: 600; font-size: 15px; }
    .muted { color: #666; }
    .stamp { display: inline-block; border: 1px solid currentColor; border-radius: 4px; padding: 2px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
  </style></head><body>${node.innerHTML}</body></html>`);
  frame.document.close();
  frame.focus();
  frame.print();
}

function TotalRow({ label, value, className = "" }) {
  return (
    <div className={`flex justify-between py-1 ${className}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** A printable invoice / receipt for one order, from the store's invoice settings. */
export function InvoiceView({ order, items, customer, settings, galleryName }) {
  const printable = useRef(null);
  const number = invoiceNumber(order, settings);
  const inv = settings?.invoices || {};
  const store = settings?.store || {};
  const billing = order.billing || {};
  const address = billing.address || {};
  const addressLines = [address.line1, address.line2, [address.city, address.region, address.postalCode].filter(Boolean).join(", "), address.country]
    .filter(Boolean);
  const paid = ["paid", "fulfilled", "partially_refunded", "refunded"].includes(order.status);
  const money = (cents) => formatMoney(cents, order.currency);

  return (
    <SectionCard
      bare
      title="Invoice"
      description={paid ? "A receipt for a paid order." : "Awaiting payment — send this as a pro-forma invoice."}
      action={
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-border bg-transparent px-3 text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
          onClick={() => printNode(printable.current, `${number} — ${store.name || inv.sellerName || "Invoice"}`)}
        >
          <Printer className="h-3.5 w-3.5" />
          Print / PDF
        </Button>
      }
    >
      <div className="rounded-xl border border-border bg-white p-8 text-zinc-900 shadow-sm">
        <div ref={printable}>
          <div className="row mb-7 flex justify-between gap-8">
            <div>
              <h1 className="text-xl font-semibold">{inv.sellerName || store.name || "Invoice"}</h1>
              {inv.sellerAddress ? <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-500">{inv.sellerAddress}</p> : null}
              {inv.taxId ? <p className="mt-1 text-xs text-zinc-500">Tax ID {inv.taxId}</p> : null}
              {store.supportEmail ? <p className="mt-1 text-xs text-zinc-500">{store.supportEmail}</p> : null}
            </div>
            <div className="text-right">
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{paid ? "Receipt" : "Invoice"}</h2>
              <p className="font-mono text-sm">{number}</p>
              <p className="muted mt-1 text-xs text-zinc-500">Order {order.number}</p>
              <p className="muted text-xs text-zinc-500">Issued {formatDate(order.paidAt || order.createdAt)}</p>
              <p className="mt-2">
                <span className={`stamp inline-block rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${paid ? "text-emerald-700" : "text-amber-700"}`}>
                  {order.status === "refunded" ? "Refunded" : paid ? "Paid" : "Due"}
                </span>
              </p>
            </div>
          </div>

          <div className="row mb-7 flex justify-between gap-8">
            <div>
              <h2 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Billed to</h2>
              <p className="text-sm font-medium">{order.name || customer?.name || order.email}</p>
              {billing.company ? <p className="text-sm">{billing.company}</p> : null}
              <p className="text-sm text-zinc-600">{order.email}</p>
              {addressLines.map((line) => (
                <p key={line} className="text-sm text-zinc-600">
                  {line}
                </p>
              ))}
            </div>
            {galleryName ? (
              <div className="text-right">
                <h2 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">From gallery</h2>
                <p className="text-sm">{galleryName}</p>
              </div>
            ) : null}
          </div>

          <table className="mb-5 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-zinc-200 py-2 text-left font-medium text-zinc-500">Item</th>
                <th className="num border-b border-zinc-200 py-2 text-right font-medium text-zinc-500">Qty</th>
                <th className="num border-b border-zinc-200 py-2 text-right font-medium text-zinc-500">Unit</th>
                <th className="num border-b border-zinc-200 py-2 text-right font-medium text-zinc-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="border-b border-zinc-100 py-2">
                    <span className="font-medium">{item.productName}</span>
                    <br />
                    <span className="muted text-xs text-zinc-500">{item.title}</span>
                  </td>
                  <td className="num border-b border-zinc-100 py-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="num border-b border-zinc-100 py-2 text-right tabular-nums">{money(item.unitCents)}</td>
                  <td className="num border-b border-zinc-100 py-2 text-right tabular-nums">{money(item.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totals ml-auto w-72 text-sm">
            <TotalRow label="Subtotal" value={money(order.subtotalCents)} />
            {order.discountCents ? (
              <TotalRow label={`Discount${order.discountCode ? ` (${order.discountCode})` : ""}`} value={`−${money(order.discountCents)}`} />
            ) : null}
            {order.taxCents ? (
              <TotalRow
                label={`${billing.taxLabel || settings?.taxes?.label || "Tax"}${billing.taxInclusive ? " (included)" : ""}`}
                value={money(order.taxCents)}
              />
            ) : null}
            <TotalRow label="Total" value={money(order.totalCents)} className="grand mt-1.5 border-t border-zinc-900 pt-2 text-base font-semibold" />
            {order.refundedCents ? <TotalRow label="Refunded" value={`−${money(order.refundedCents)}`} /> : null}
          </div>

          {inv.footer || settings?.policies?.refunds ? (
            <div className="mt-8 space-y-2 border-t border-zinc-200 pt-4">
              {inv.footer ? <p className="whitespace-pre-wrap text-xs text-zinc-500">{inv.footer}</p> : null}
              {settings?.policies?.refunds ? (
                <p className="whitespace-pre-wrap text-xs text-zinc-500">Refunds: {settings.policies.refunds}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}

export default InvoiceView;
