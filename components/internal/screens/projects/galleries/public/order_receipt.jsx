"use client";

// The buyer's view of one order — reached from checkout, from Stripe's
// success redirect, or from a link the seller shares. Reads like a store's
// order-confirmation page: where the order stands (a progress track plus one
// clear next step), the downloads and licences it granted, and an order
// summary with the receipt / invoice as a PDF download.

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Boxes,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileDown,
  FileText,
  Loader2,
  LockOpen,
  Mail,
  MapPin,
  Package,
  Printer,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/internal/shared/screen_kit";
import { RENDITIONS, deliversFiles, isShippedKind } from "@/lib/commerce/shape";
import { formatPrice } from "@/lib/commerce/pricing";
import { formatDate } from "@/lib/format";
import { ORDER_STATUS_META, PROVIDER_META } from "../../store/constants";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const POLL_MS = 3000;
const POLL_LIMIT = 20;

const PROBLEM_TEXT = {
  expired: "Link expired",
  exhausted: "Download limit reached",
  revoked: "No longer available",
};

const KIND_ICON = { download: Download, license: BadgeCheck, print: Printer, physical: Package, bundle: Boxes, unlock: LockOpen };

const PAID_STATUSES = new Set(["paid", "fulfilled", "partially_refunded"]);

function Panel({ icon: Icon, tone = "neutral", title, children, spin = false }) {
  const tones = {
    neutral: "border-border bg-surface-subtle",
    success: "border-emerald-500/20 bg-emerald-500/10",
    warning: "border-amber-500/20 bg-amber-500/10",
  };
  const iconTones = { neutral: "text-text-secondary", success: "text-emerald-600 dark:text-emerald-400", warning: "text-amber-700 dark:text-amber-400" };
  return (
    <div className={cn("flex gap-3 rounded-xl border p-4", tones[tone])}>
      {Icon ? <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconTones[tone], spin && "animate-spin")} /> : null}
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-foreground">{title}</p>
        {children ? <div className="mt-1 text-text-secondary">{children}</div> : null}
      </div>
    </div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">{children}</h2>
      {action}
    </div>
  );
}

/** Placed → Paid → Delivered/Shipped, with the current step highlighted. */
function ProgressTrack({ steps }) {
  return (
    <ol className="grid grid-cols-3 gap-2">
      {steps.map((step, index) => (
        <li key={step.key} className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                step.state === "done" && "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                step.state === "current" && "border-primary bg-primary text-primary-foreground",
                step.state === "failed" && "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
                step.state === "todo" && "border-border bg-surface-card text-text-tertiary",
              )}
            >
              {step.state === "done" ? (
                <Check className="h-3.5 w-3.5" />
              ) : step.state === "failed" ? (
                <X className="h-3.5 w-3.5" />
              ) : step.state === "current" && step.busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                index + 1
              )}
            </span>
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn("h-px flex-1", step.state === "done" ? "bg-emerald-500/40" : "bg-border")}
              />
            ) : null}
          </div>
          <p className={cn("mt-2 truncate text-sm font-medium", step.state === "todo" ? "text-text-tertiary" : "text-foreground")}>
            {step.label}
          </p>
          <p className="truncate text-xs text-text-tertiary">{step.detail || " "}</p>
        </li>
      ))}
    </ol>
  );
}

function ItemThumb({ asset, kind }) {
  const Icon = KIND_ICON[kind] || FileText;
  if (asset?.thumbnailUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset.thumbnailUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />;
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
      <Icon className="h-5 w-5 text-text-secondary" />
    </span>
  );
}

function TotalRow({ label, value, strong = false, muted = false }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "text-base font-semibold", muted && "text-text-secondary")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function OrderReceipt({
  slug,
  order,
  items,
  galleryName,
  buyerName,
  settings,
  thankYou,
  entitlements,
  licenses,
  assets,
  justPaid,
}) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [polls, setPolls] = useState(0);
  const currency = order.currency;
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const pending = order.status === "pending";
  const paid = PAID_STATUSES.has(order.status);
  const failed = order.status === "failed" || order.status === "cancelled";
  const confirming = pending && justPaid && order.provider === "stripe";
  const storeName = settings.store.name || galleryName || "the store";
  const galleryHref = `${BASE}/g/${encodeURIComponent(slug)}`;
  const firstName = buyerName ? buyerName.split(" ")[0] : "";

  // Stripe redirects before its webhook lands; re-read until the order flips.
  useEffect(() => {
    if (!confirming || polls >= POLL_LIMIT) return undefined;
    const id = window.setTimeout(() => {
      setPolls((n) => n + 1);
      router.refresh();
    }, POLL_MS);
    return () => window.clearTimeout(id);
  }, [confirming, polls, router]);

  // Test orders now pay at checkout; this only finishes older pending ones.
  const payTest = async () => {
    setPaying(true);
    try {
      const res = await fetch(`${BASE}/g/${encodeURIComponent(slug)}/order/${order.id}/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: order.accessToken }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Couldn't complete the test payment.");
        setPaying(false);
        return;
      }
      toast.success("Payment approved.");
      router.refresh();
    } catch {
      toast.error("Couldn't reach the store.");
    }
    setPaying(false);
  };

  const shipped = items.filter((i) => isShippedKind(i.kind));
  const pendingShipments = shipped.filter((i) => i.status === "pending");
  const hasFiles = items.some((i) => deliversFiles(i.kind, i.fulfillment));
  const allDelivered = paid && items.every((i) => i.status !== "pending");
  const readyFiles = entitlements.filter((e) => !e.problem).length;
  const address = order.billing?.address || {};
  const shipTo = [address.line1, address.line2, address.city, address.region, address.postalCode, address.country].filter(Boolean);
  const productionDays = Math.max(0, ...pendingShipments.map((i) => Number(i.fulfillment?.productionDays) || 0));

  const deliverLabel = shipped.length ? (hasFiles ? "Delivered" : "Shipped") : hasFiles ? "Files ready" : "Complete";
  const steps = [
    { key: "placed", label: "Order placed", detail: formatDate(order.createdAt), state: "done" },
    {
      key: "paid",
      label: failed ? (order.status === "failed" ? "Payment failed" : "Cancelled") : "Payment",
      detail: paid || order.status === "refunded" ? formatDate(order.paidAt || order.createdAt) : confirming ? "Confirming…" : pending ? "Awaiting payment" : "",
      state: failed ? "failed" : paid || order.status === "refunded" ? "done" : "current",
      busy: confirming,
    },
    {
      key: "delivered",
      label: deliverLabel,
      detail: allDelivered
        ? formatDate(order.fulfilledAt || order.paidAt)
        : paid && pendingShipments.length
          ? productionDays
            ? `Ships in ~${productionDays} days`
            : "Preparing"
          : "",
      state: allDelivered || order.status === "refunded" ? "done" : paid ? "current" : "todo",
    },
  ];

  const heading = paid
    ? `Thank you${firstName ? `, ${firstName}` : ""}!`
    : confirming
      ? "Confirming your payment"
      : pending
        ? "Almost there"
        : order.status === "refunded"
          ? "Order refunded"
          : failed
            ? "Payment didn't go through"
            : `Order ${order.number}`;
  const subheading = paid
    ? thankYou ||
      (pendingShipments.length
        ? `Your order is confirmed — ${storeName} is getting it ready.`
        : hasFiles
          ? "Your order is confirmed and your files are ready to download."
          : "Your order is confirmed.")
    : confirming
      ? "Hang tight — this usually takes a few seconds."
      : pending
        ? "Your order is saved. Complete the payment to unlock it."
        : failed
          ? "Nothing was charged. You can head back to the gallery and try again."
          : "";
  const HeroIcon = paid ? CheckCircle2 : confirming ? Loader2 : pending ? Clock : order.status === "refunded" ? Undo2 : failed ? X : FileText;

  const receiptHref = `${BASE}/g/${encodeURIComponent(slug)}/order/${order.id}/receipt?t=${encodeURIComponent(order.accessToken)}`;
  const receiptLabel = pending ? "Download invoice" : "Download receipt";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <a
          href={galleryHref}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {galleryName || "the gallery"}
        </a>

        {/* Hero ---------------------------------------------------------------- */}
        <header className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-start">
          <span
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border",
              paid && "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              (pending || confirming) && "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
              (failed || order.status === "refunded") && "border-border bg-surface-subtle text-text-secondary",
            )}
          >
            <HeroIcon className={cn("h-7 w-7", confirming && "animate-spin")} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-text-secondary">{storeName}</p>
              <StatusPill status={order.status} map={ORDER_STATUS_META} className="text-[10px]" />
              {order.provider === "test" && (paid || pending) ? (
                <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  Test payment — no money charged
                </span>
              ) : null}
            </div>
            <h1 className="mt-1.5 text-3xl font-semibold tracking-tight sm:text-4xl">{heading}</h1>
            {subheading ? <p className="mt-2 max-w-xl text-base text-text-secondary">{subheading}</p> : null}
            <p className="mt-3 text-sm text-text-tertiary">
              Order <span className="font-mono text-text-secondary">{order.number}</span> · {formatDate(order.createdAt)} · {order.email}
            </p>
          </div>

          <div className="w-full shrink-0 rounded-xl border border-border bg-surface-subtle p-4 sm:w-64">
            <p className="text-xs text-text-tertiary">{paid || order.status === "refunded" ? "Total paid" : "Total due"}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatPrice(order.totalCents, currency)}</p>
            <p className="mt-1 truncate text-xs text-text-secondary">
              {items.length} item{items.length === 1 ? "" : "s"} · {PROVIDER_META[order.provider]?.label || order.provider}
            </p>
            <Button asChild variant="outline" className="mt-4 w-full border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground">
              <a href={receiptHref} download>
                <FileDown className="h-4 w-4" />
                {receiptLabel}
              </a>
            </Button>
          </div>
        </header>

        <div className="mt-8 rounded-xl border border-border bg-surface-subtle px-4 py-4 sm:px-5">
          <ProgressTrack steps={steps} />
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Main column --------------------------------------------------------- */}
          <div className="min-w-0 space-y-8">
            {confirming ? (
              <Panel icon={Loader2} spin title="Waiting for the payment provider">
                {polls >= POLL_LIMIT
                  ? "This is taking longer than usual. Your payment is safe — refresh in a minute, or contact the seller."
                  : "Your files unlock here the moment the payment clears. No need to refresh."}
              </Panel>
            ) : pending && order.provider === "test" ? (
              <Panel icon={CreditCard} tone="warning" title="Finish your test payment">
                <p>This store isn&apos;t taking real payments yet, so nothing is charged.</p>
                <Button className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90" disabled={paying} onClick={payTest}>
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Pay {formatPrice(order.totalCents, currency)} (test)
                </Button>
              </Panel>
            ) : pending ? (
              <Panel icon={FileText} tone="warning" title="Pay by invoice">
                <p>Open the invoice, pay {storeName} as it describes, and your order unlocks here as soon as they mark it paid.</p>
                {settings.invoices.footer ? <p className="mt-2 whitespace-pre-wrap">{settings.invoices.footer}</p> : null}
                <Button asChild className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90">
                  <a href={receiptHref} download>
                    <FileDown className="h-4 w-4" />
                    Download invoice
                  </a>
                </Button>
              </Panel>
            ) : order.status === "refunded" ? (
              <Panel icon={Undo2} title="This order was refunded">
                {formatPrice(order.refundedCents, currency)} was returned to you. Download links from this order no longer work.
              </Panel>
            ) : failed ? (
              <Panel icon={Clock} title={order.status === "failed" ? "The payment didn't complete" : "This order was cancelled"}>
                <p>Your cart is still saved on the gallery.</p>
                <Button asChild className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90">
                  <a href={galleryHref}>Return to the gallery</a>
                </Button>
              </Panel>
            ) : null}

            {/* Downloads ------------------------------------------------------- */}
            {entitlements.length ? (
              <section>
                <SectionTitle
                  action={
                    readyFiles ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      </span>
                    ) : null
                  }
                >
                  Your downloads
                </SectionTitle>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-subtle">
                  {entitlements.map((e) => {
                    const asset = assetById.get(e.assetId);
                    const left = e.maxDownloads > 0 ? Math.max(0, e.maxDownloads - e.downloadsCount) : null;
                    return (
                      <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                        <ItemThumb asset={asset} kind="download" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{asset?.name || "File"}</p>
                          <p className="truncate text-xs text-text-secondary">
                            {RENDITIONS[e.rendition]?.label || "Original file"}
                            {left !== null ? ` · ${left} download${left === 1 ? "" : "s"} left` : ""}
                            {e.expiresAt ? ` · until ${formatDate(e.expiresAt)}` : ""}
                          </p>
                        </div>
                        {e.problem ? (
                          <span className="text-xs text-text-tertiary">{PROBLEM_TEXT[e.problem] || "Unavailable"}</span>
                        ) : (
                          <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                            <a href={`${BASE}/api/store/download/${e.token}`} onClick={() => window.setTimeout(() => router.refresh(), 1500)}>
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : paid && hasFiles ? (
              <Panel icon={Clock} title="Your files are on their way">
                {storeName} is preparing your downloads — they&apos;ll appear here, so keep this page handy.
              </Panel>
            ) : null}

            {/* Licences -------------------------------------------------------- */}
            {licenses.length ? (
              <section>
                <SectionTitle>Your licences</SectionTitle>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-subtle">
                  {licenses.map((l) => (
                    <li key={l.id} className="flex items-start gap-3 px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10">
                        <BadgeCheck className="h-4 w-4 text-violet-700 dark:text-violet-300" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{l.title}</p>
                        <p className="text-xs text-text-secondary">
                          <span className="font-mono">{l.reference}</span> · {l.usage_type} use ·{" "}
                          {l.is_perpetual ? "perpetual" : `${formatDate(l.start_date)} – ${formatDate(l.end_date)}`}
                        </p>
                      </div>
                      {l.status === "pending" ? (
                        <span className="shrink-0 text-xs text-amber-700 dark:text-amber-400">Awaiting approval</span>
                      ) : (
                        <span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400">Active</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Shipping -------------------------------------------------------- */}
            {paid && shipped.length ? (
              <section>
                <SectionTitle>Shipping</SectionTitle>
                <div className="rounded-xl border border-border bg-surface-subtle p-4">
                  <ul className="space-y-3">
                    {shipped.map((i) => (
                      <li key={i.id} className="flex items-center gap-3">
                        <ItemThumb asset={assetById.get(i.assetId)} kind={i.kind} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{i.title}</p>
                          <p className="truncate text-xs text-text-secondary">
                            {i.productName}
                            {i.quantity > 1 ? ` × ${i.quantity}` : ""}
                          </p>
                        </div>
                        <span className={cn("shrink-0 text-xs", i.status === "pending" ? "text-amber-700 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                          {i.status === "pending" ? "Preparing" : "Shipped"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {shipTo.length ? (
                    <p className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-sm text-text-secondary">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                      {shipTo.join(", ")}
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>

          {/* Order summary ------------------------------------------------------- */}
          <aside className="space-y-4 lg:sticky lg:top-6">
            <div className="rounded-xl border border-border bg-surface-subtle">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Order summary</h2>
                <span className="text-xs text-text-tertiary">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="space-y-3 px-4 py-4">
                {items.map((i) => {
                  const asset = assetById.get(i.assetId) || (i.assetIds?.length ? assetById.get(i.assetIds[0]) : null);
                  return (
                    <li key={i.id} className="flex items-center gap-3">
                      <span className="relative">
                        <ItemThumb asset={asset} kind={i.kind} />
                        {i.quantity > 1 ? (
                          <span className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-surface-card px-1.5 text-[10px] font-semibold tabular-nums">
                            {i.quantity}
                          </span>
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{i.title}</span>
                        <span className="block truncate text-xs text-text-secondary">{i.productName}</span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums">{formatPrice(i.totalCents, currency)}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="space-y-1.5 border-t border-border px-4 py-3 text-sm">
                <TotalRow label="Subtotal" value={formatPrice(order.subtotalCents, currency)} muted />
                {order.discountCents ? (
                  <TotalRow
                    label={`Discount${order.discountCode ? ` (${order.discountCode})` : ""}`}
                    value={`−${formatPrice(order.discountCents, currency)}`}
                    muted
                  />
                ) : null}
                {order.taxCents ? (
                  <TotalRow
                    label={`${order.billing?.taxLabel || "Tax"}${order.billing?.taxInclusive ? " (included)" : ""}`}
                    value={formatPrice(order.taxCents, currency)}
                    muted
                  />
                ) : null}
                {order.refundedCents ? <TotalRow label="Refunded" value={`−${formatPrice(order.refundedCents, currency)}`} muted /> : null}
                <div className="pt-1.5">
                  <TotalRow label={paid || order.status === "refunded" ? "Paid" : "Total"} value={formatPrice(order.totalCents, currency)} strong />
                </div>
              </div>
              <dl className="space-y-1.5 border-t border-border px-4 py-3 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-text-tertiary">Payment</dt>
                  <dd className="text-text-secondary">{PROVIDER_META[order.provider]?.label || order.provider}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-tertiary">Receipt to</dt>
                  <dd className="truncate text-text-secondary">{order.email}</dd>
                </div>
              </dl>
              <div className="grid gap-2 border-t border-border p-4">
                <Button
                  asChild
                  variant="outline"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                >
                  <a href={receiptHref} download>
                    <FileDown className="h-4 w-4" />
                    {receiptLabel} (PDF)
                  </a>
                </Button>
                <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <a href={galleryHref}>{paid ? "Continue Browsing" : "Back To The Gallery"}</a>
                </Button>
              </div>
            </div>

            {settings.store.supportEmail ? (
              <a
                href={`mailto:${settings.store.supportEmail}?subject=${encodeURIComponent(`Order ${order.number}`)}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle p-4 text-sm transition-colors hover:bg-surface-hover"
              >
                <Mail className="h-4 w-4 shrink-0 text-text-secondary" />
                <span className="min-w-0">
                  <span className="block font-medium">Need help with this order?</span>
                  <span className="block truncate text-xs text-text-secondary">{settings.store.supportEmail}</span>
                </span>
              </a>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default OrderReceipt;
