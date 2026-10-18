"use client";

// Cart & Checkout — how the store takes money and what happens after: payment
// provider, the details checkout collects, cart rules, taxes, fulfilment
// defaults, order/invoice numbering, and the workflows listening on the
// order.* triggers. Every control saves on change (or blur), optimistically.

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  PackageCheck,
  Percent,
  Workflow,
} from "lucide-react";
import { Switch } from "@geiger/ui/switch";
import { Badge } from "@geiger/ui/badge";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  Field,
  LoadingArea,
  ScreenHeader,
  SectionCard,
  SegmentedTabs,
  SettingRow,
  SettingsList,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { useModuleRows } from "@/components/internal/shared/module_kit";
import { SelectSettingRow } from "../settings/settings_kit";
import { BlurInput, BlurTextarea, useStoreSettings, useStoreStatus } from "./store_kit";
import {
  PAYMENT_MODE_OPTIONS,
  PROVIDER_META,
  centsToDollarString,
  formatMoney,
  parseDollarsToCents,
} from "./constants";
import { formatOrderNumber } from "@/lib/commerce/shape";
import { listWorkflows } from "@/lib/supabase/workflows";
import { catalogEntry } from "../workflows/constants";

const TABS = [
  { value: "payments", label: "Payments", icon: CreditCard },
  { value: "checkout", label: "Checkout", icon: ClipboardList },
  { value: "taxes", label: "Taxes", icon: Percent },
  { value: "fulfillment", label: "Fulfilment", icon: PackageCheck },
  { value: "invoices", label: "Invoices", icon: FileText },
];

// Checkout fields a buyer can be asked for, beyond the always-required email.
const CHECKOUT_FIELDS = ["collectName", "collectCompany", "collectPhone", "collectAddress", "allowNotes", "requireTerms", "marketingOptIn"];

const COMMERCE_TRIGGERS = new Set([
  "order.created",
  "order.paid",
  "order.fulfilled",
  "order.refunded",
  "license.purchased",
  "customer.created",
]);

function StatusLine({ ok, children }) {
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <p className="flex items-start gap-2 text-sm">
      <Icon className={ok ? "mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" : "mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400"} />
      <span className="text-text-secondary">{children}</span>
    </p>
  );
}

function NumberInput({ value, onCommit, suffix, prefix, ...props }) {
  return (
    <div className="flex items-center gap-1.5">
      {prefix ? <span className="text-sm text-text-tertiary">{prefix}</span> : null}
      <BlurInput value={String(value ?? "")} onCommit={onCommit} inputMode="decimal" className="h-9 w-24 text-right" {...props} />
      {suffix ? <span className="text-sm text-text-tertiary">{suffix}</span> : null}
    </div>
  );
}

export function CartCheckoutScreen({ projectId }) {
  const { settings, loading, patch } = useStoreSettings(projectId);
  const status = useStoreStatus(projectId);
  const [workflows] = useModuleRows(listWorkflows, projectId);

  const [tab, setTab] = useState("payments");

  const orderWorkflows = useMemo(() => workflows.filter((w) => COMMERCE_TRIGGERS.has(w.trigger)), [workflows]);

  const { payments, checkout, taxes, fulfillment, invoices } = settings;
  const mode = payments.mode;
  const live =
    mode === "manual" ? "manual" : mode === "test" ? "test" : status?.stripeConfigured ? "stripe" : mode === "stripe" ? "stripe" : "test";
  const stripeWanted = mode === "auto" || mode === "stripe";
  const activeWorkflows = orderWorkflows.filter((w) => w.status === "Active").length;

  const stats = [
    {
      label: "Payments",
      value: PROVIDER_META[live]?.label || "—",
      footer: live === "stripe" ? (status?.stripeTestKey ? "Stripe test key" : "Live charges") : live === "test" ? "No real payments" : "Buyers pay by invoice",
    },
    {
      label: "Checkout fields",
      value: String(1 + CHECKOUT_FIELDS.filter((key) => checkout[key]).length),
      footer: "email always asked",
    },
    {
      label: "Tax",
      value: taxes.enabled ? `${taxes.ratePercent}%` : "Off",
      footer: taxes.enabled ? `${taxes.label} · ${taxes.inclusive ? "included" : "added"}` : "no tax line",
    },
    {
      label: "Order workflows",
      value: String(activeWorkflows),
      footer: `next order ${formatOrderNumber(invoices.orderPrefix, settings.nextOrderNumber)}`,
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Cart & Checkout" description="How galleries take payment, and what happens once they do." />
      <StatsBar stats={stats} />
      <Toolbar>
        <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
      </Toolbar>

      {loading ? (
        <LoadingArea panel className="h-64 py-0" label="Loading checkout settings" />
      ) : tab === "payments" ? (
        <div className="space-y-6">
          <SectionCard
            title="Payments"
            description="Where buyers pay. Changes apply to the next checkout."
            action={<StatusPill status={live} map={PROVIDER_META} className="text-[10px]" />}
          >
            <SettingsList>
              <SelectSettingRow
                title="Payment method"
                description="Automatic uses Stripe once its keys are set, and the test checkout until then."
                value={mode}
                options={PAYMENT_MODE_OPTIONS}
                onSave={(next) => patch("payments", { mode: next })}
              />
              <SettingRow
                title="Statement descriptor"
                description="Up to 22 characters on the buyer's card statement (Stripe)."
                control={
                  <BlurInput
                    value={payments.statementDescriptor}
                    onCommit={(v) => patch("payments", { statementDescriptor: v.slice(0, 22) })}
                    placeholder="GEIGER PHOTO"
                    maxLength={22}
                    className="h-9 w-44"
                  />
                }
              />
            </SettingsList>
            {stripeWanted ? (
              <div className="mt-4 space-y-2 rounded-lg border border-border bg-surface-card p-4">
                {status === null ? (
                  <p className="text-xs text-text-tertiary">Checking the payment provider…</p>
                ) : (
                  <>
                    <StatusLine ok={status.stripeConfigured}>
                      {status.stripeConfigured
                        ? `Stripe key is set${status.stripeTestKey ? " (test mode — no real charges)" : " (live)"}.`
                        : "STRIPE_SECRET_KEY isn't set — checkout runs in test mode."}
                    </StatusLine>
                    <StatusLine ok={status.webhookConfigured}>
                      {status.webhookConfigured
                        ? "Webhook secret is set — paid orders complete automatically."
                        : "Add a Stripe webhook to /api/store/stripe/webhook (checkout.session.completed, checkout.session.expired) and set STRIPE_WEBHOOK_SECRET."}
                    </StatusLine>
                    <StatusLine ok={status.serviceRole}>
                      {status.serviceRole
                        ? "Service key is set — checkout and webhooks write with server credentials."
                        : "SUPABASE_SERVICE_ROLE_KEY isn't set — checkout falls back to the public key and the demo RLS policies."}
                    </StatusLine>
                  </>
                )}
              </div>
            ) : null}
            {mode === "manual" ? (
              <p className="mt-4 text-xs text-text-secondary">
                Buyers place the order and get an invoice to pay. Mark it paid on Orders & Invoices — fulfilment and the
                Order paid workflows run then.
              </p>
            ) : null}
          </SectionCard>
          <p className="flex items-center gap-2 text-xs text-text-tertiary">
            <CreditCard className="h-3.5 w-3.5" />
            Card details never touch this app — Stripe hosts the payment page.
          </p>
        </div>
      ) : tab === "checkout" ? (
        <div className="space-y-6">
          <SectionCard title="Checkout details" description="What buyers fill in. Email is always required.">
            <SettingsList>
              <SettingRow title="Ask for their name" checked={checkout.collectName} onCheckedChange={(v) => patch("checkout", { collectName: v })} />
              <SettingRow title="Ask for a company" description="Useful when you issue licences to businesses." checked={checkout.collectCompany} onCheckedChange={(v) => patch("checkout", { collectCompany: v })} />
              <SettingRow title="Ask for a phone number" checked={checkout.collectPhone} onCheckedChange={(v) => patch("checkout", { collectPhone: v })} />
              <SettingRow title="Require a billing address" description="For tax invoices in most regions. Carts with prints or physical products always ask for a shipping address." checked={checkout.collectAddress} onCheckedChange={(v) => patch("checkout", { collectAddress: v })} />
              <SettingRow title="Allow a note with the order" checked={checkout.allowNotes} onCheckedChange={(v) => patch("checkout", { allowNotes: v })} />
              <SettingRow title="Require accepting the terms" description="Buyers tick a box linking to your terms (Storefront → Policies)." checked={checkout.requireTerms} onCheckedChange={(v) => patch("checkout", { requireTerms: v })} />
              <SettingRow title="Offer a marketing opt-in" description="An unticked box — the choice lands on the customer record." checked={checkout.marketingOptIn} onCheckedChange={(v) => patch("checkout", { marketingOptIn: v })} />
              <SettingRow title="Accept discount codes" description="Galleries can still turn codes off for themselves." checked={checkout.allowDiscounts} onCheckedChange={(v) => patch("checkout", { allowDiscounts: v })} />
            </SettingsList>
          </SectionCard>

          <SectionCard title="Cart rules">
            <SettingsList>
              <SettingRow
                title="Minimum order"
                description={checkout.minimumOrderCents ? `Carts under ${formatMoney(checkout.minimumOrderCents)} can't check out.` : "No minimum."}
                control={
                  <NumberInput
                    prefix="$"
                    value={checkout.minimumOrderCents ? centsToDollarString(checkout.minimumOrderCents) : ""}
                    onCommit={(v) => patch("checkout", { minimumOrderCents: parseDollarsToCents(v) })}
                    placeholder="0.00"
                    aria-label="Minimum order"
                  />
                }
              />
              <SettingRow
                title="Most items per order"
                description="Stops runaway carts; 0 for no limit."
                control={
                  <NumberInput
                    value={checkout.maxItems}
                    onCommit={(v) => patch("checkout", { maxItems: Math.max(0, Math.round(Number(v) || 0)) })}
                    aria-label="Most items per order"
                  />
                }
              />
            </SettingsList>
          </SectionCard>
        </div>
      ) : tab === "taxes" ? (
        <SectionCard
          title="Taxes"
          description="A single rate applied at checkout. For multi-region tax, turn this off and let Stripe Tax handle it."
          action={<Switch checked={taxes.enabled} onCheckedChange={(v) => patch("taxes", { enabled: v })} aria-label="Charge tax" />}
        >
          {taxes.enabled ? (
            <SettingsList>
              <SettingRow
                title="Rate"
                control={
                  <NumberInput
                    suffix="%"
                    value={taxes.ratePercent}
                    onCommit={(v) => patch("taxes", { ratePercent: Math.max(0, Math.min(100, Number(v) || 0)) })}
                    aria-label="Tax rate"
                  />
                }
              />
              <SettingRow
                title="Label"
                description="Shown on the cart and invoice — VAT, GST, Sales tax."
                control={<BlurInput value={taxes.label} onCommit={(v) => patch("taxes", { label: v || "Tax" })} className="h-9 w-32" />}
              />
              <SettingRow
                title="Prices include tax"
                description="On: tax is carved out of the price. Off: tax is added on top at checkout."
                checked={taxes.inclusive}
                onCheckedChange={(v) => patch("taxes", { inclusive: v })}
              />
            </SettingsList>
          ) : (
            <p className="text-xs text-text-tertiary">Off — no tax line at checkout.</p>
          )}
        </SectionCard>
      ) : tab === "fulfillment" ? (
        <div className="space-y-6">
          <SectionCard title="Fulfilment" description="What the checkout itself does once an order is paid.">
            <SettingsList>
              <SettingRow
                title="Deliver automatically"
                description="Create download links as soon as payment clears. Off: orders wait for you to fulfil them."
                checked={fulfillment.autoFulfill}
                onCheckedChange={(v) => patch("fulfillment", { autoFulfill: v })}
              />
              <SettingRow
                title="Issue licences automatically"
                description="Licence products create an Issued License for the buyer. Off: issue them yourself, or with a workflow."
                checked={fulfillment.issueLicenses}
                onCheckedChange={(v) => patch("fulfillment", { issueLicenses: v })}
              />
              <SettingRow
                title="Default download limit"
                description="For gallery prices that don't borrow a product's settings. 0 = unlimited."
                control={
                  <NumberInput
                    value={fulfillment.downloadLimit}
                    onCommit={(v) => patch("fulfillment", { downloadLimit: Math.max(0, Math.round(Number(v) || 0)) })}
                    aria-label="Default download limit"
                  />
                }
              />
              <SettingRow
                title="Default link lifetime"
                description="Days before a download link expires. 0 = never."
                control={
                  <NumberInput
                    suffix="days"
                    value={fulfillment.expiryDays}
                    onCommit={(v) => patch("fulfillment", { expiryDays: Math.max(0, Math.round(Number(v) || 0)) })}
                    aria-label="Default link lifetime"
                  />
                }
              />
            </SettingsList>
            <Field label="Thank-you message" hint="Shown on every order page; a gallery can set its own." className="mt-5">
              <BlurTextarea
                value={checkout.thankYouMessage}
                onCommit={(v) => patch("checkout", { thankYouMessage: v })}
                rows={2}
                placeholder="Thanks for your order! Your files are ready below."
              />
            </Field>
          </SectionCard>

          <SectionCard
            title="After the sale"
            description="Workflows listening on order triggers — emails, tags, memberships, royalties, webhooks and more."
            action={
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Workflow className="h-3 w-3" />
                {activeWorkflows} active
              </Badge>
            }
          >
            {orderWorkflows.length ? (
              <div className="divide-y divide-border">
                {orderWorkflows.map((w) => {
                  const entry = catalogEntry(w.trigger);
                  const Icon = entry?.icon || Workflow;
                  return (
                    <div key={w.id} className="flex items-center gap-3 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{w.name}</p>
                        <p className="truncate text-[11px] text-text-tertiary">
                          {entry?.label || w.trigger} · {w.steps?.length ? w.steps.length - 1 : 0} step{w.steps?.length === 2 ? "" : "s"}
                        </p>
                      </div>
                      <span className={w.status === "Active" ? "text-xs text-emerald-600 dark:text-emerald-400" : "text-xs text-text-tertiary"}>{w.status}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                None yet. In <span className="text-foreground">Workflows</span>, start from an <span className="text-foreground">Order paid</span>,{" "}
                <span className="text-foreground">Licence purchased</span> or <span className="text-foreground">New customer</span> trigger and chain
                commerce steps — grant downloads, issue a licence, tag the customer, enrol them in a membership tier, accrue royalties,
                add sold work to a collection, or call a webhook.
              </p>
            )}
          </SectionCard>
        </div>
      ) : (
        <SectionCard title="Invoices & numbering">
          <SettingsList>
            <SettingRow
              title="Order prefix"
              description={`Next order: ${formatOrderNumber(invoices.orderPrefix, settings.nextOrderNumber)}`}
              control={<BlurInput value={invoices.orderPrefix} onCommit={(v) => patch("invoices", { orderPrefix: v })} className="h-9 w-28 font-mono" />}
            />
            <SettingRow
              title="Invoice prefix"
              description="Invoices share the order's sequence number."
              control={<BlurInput value={invoices.invoicePrefix} onCommit={(v) => patch("invoices", { invoicePrefix: v })} className="h-9 w-28 font-mono" />}
            />
          </SettingsList>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Seller name">
              <BlurInput value={invoices.sellerName} onCommit={(v) => patch("invoices", { sellerName: v })} placeholder="Studio or legal name" />
            </Field>
            <Field label="Tax / VAT number">
              <BlurInput value={invoices.taxId} onCommit={(v) => patch("invoices", { taxId: v })} placeholder="Optional" />
            </Field>
            <Field label="Seller address" className="sm:col-span-2">
              <BlurTextarea value={invoices.sellerAddress} onCommit={(v) => patch("invoices", { sellerAddress: v })} rows={2} />
            </Field>
            <Field label="Invoice footer" className="sm:col-span-2" hint="Payment instructions, bank details for invoice orders, a thank-you.">
              <BlurTextarea value={invoices.footer} onCommit={(v) => patch("invoices", { footer: v })} rows={2} />
            </Field>
          </div>
        </SectionCard>
      )}
    </MainScreenWrapper>
  );
}

export default CartCheckoutScreen;
