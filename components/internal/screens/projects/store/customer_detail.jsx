"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Ban, Copy, Download, ReceiptText, ShieldCheck, User, X } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { EditorShell } from "@/components/internal/shared/editor_shell";
import { EditorSaveActions, useEditorGuard } from "@/components/internal/shared/unsaved_changes";
import {
  EmptyState,
  Field,
  SectionCard,
  SettingRow,
  SettingsList,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { AssetThumbnail } from "@/components/internal/shared/asset_thumbnail";
import { GrantDownloadsDialog } from "./grant_downloads_dialog";
import {
  CUSTOMER_STATUS_META,
  ENTITLEMENT_STATE_META,
  ORDER_STATUS_META,
  RENDITION_OPTIONS,
  entitlementState,
  formatDate,
  formatMoney,
  limitLabel,
  plural,
} from "./constants";
import { REVENUE_STATUSES } from "@/lib/commerce/shape";
import { createEntitlements, entitlementUrl, orderPageUrl, updateCustomer } from "@/lib/supabase/store";
import { getUser } from "@/lib/supabase/user";

const NAV = [
  {
    group: null,
    items: [
      { key: "profile", label: "Profile", icon: User, desc: "Contact details, tags and notes." },
      { key: "orders", label: "Orders", icon: ReceiptText, desc: "Everything this customer has bought." },
      { key: "downloads", label: "Downloads", icon: Download, desc: "Download links they hold." },
      { key: "licenses", label: "Licences", icon: BadgeCheck, desc: "Licences issued to them." },
    ],
  },
  {
    group: "Account",
    items: [{ key: "account", label: "Access", icon: ShieldCheck, desc: "Blocking and marketing consent." }],
  },
];

const RENDITION_LABEL = Object.fromEntries(RENDITION_OPTIONS.map((o) => [o.value, o.label]));

function draftOf(c) {
  return {
    name: c.name,
    email: c.email,
    company: c.company,
    phone: c.phone,
    country: c.country,
    notes: c.notes,
    tags: c.tags,
    status: c.status,
    marketingOptIn: c.marketingOptIn,
  };
}

export function CustomerDetailScreen({
  customer,
  orders,
  entitlements,
  licenses,
  galleryById,
  assetById,
  assets,
  onBack,
  onChange,
  onEntitlements,
}) {
  const [draft, setDraft] = useState(() => draftOf(customer));
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showGrant, setShowGrant] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const dirty = JSON.stringify(draftOf(customer)) !== JSON.stringify(draft);

  const save = async () => {
    if (!dirty || saving) return false;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email)) {
      toast.error("Enter a valid email");
      return false;
    }
    setSaving(true);
    const saved = await updateCustomer(customer.id, draft);
    setSaving(false);
    if (saved) {
      onChange(saved);
      setDraft(draftOf(saved));
      toast.success("Customer saved");
      return true;
    }
    toast.error("Couldn't save — is that email already used by another customer?");
    return false;
  };
  const discard = () => setDraft(draftOf(customer));

  const guard = useEditorGuard({ dirty, saving, save, discard, onBack, name: customer.name || customer.email });

  const paid = useMemo(() => orders.filter((o) => REVENUE_STATUSES.has(o.status)), [orders]);

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || draft.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return setTagInput("");
    set("tags")([...draft.tags, tag]);
    setTagInput("");
  };

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const grant = async (input) => {
    setShowGrant(false);
    const user = await getUser();
    const rows = input.assetIds.map((assetId) => ({
      projectId: customer.projectId,
      customerId: customer.id,
      assetId,
      rendition: input.rendition,
      maxDownloads: input.maxDownloads,
      expiresAt: input.expiresAt,
      source: "manual",
      createdBy: user?.id || null,
    }));
    const created = await createEntitlements(rows);
    if (created?.length) {
      onEntitlements(created);
      toast.success(`${plural(created.length, "download link")} granted`);
    } else toast.error("Couldn't grant the downloads");
  };

  return (
    <>
      <EditorShell
        back={{ label: "Customers", onClick: guard.back }}
        title={customer.name || customer.email}
        status={customer.status}
        statusMap={CUSTOMER_STATUS_META}
        badges={customer.tags.map((t) => (
          <Badge key={t} variant="outline" className="text-[10px]">
            {t}
          </Badge>
        ))}
        meta={`${customer.email} · ${plural(customer.ordersCount, "order")} · ${formatMoney(customer.totalSpentCents)} lifetime`}
        actions={
          <EditorSaveActions dirty={dirty} saving={saving} onSave={save} onDiscard={discard}>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setShowGrant(true)}
            >
              <Download className="h-4 w-4" />
              Grant downloads
            </Button>
          </EditorSaveActions>
        }
        nav={NAV}
        subject={customer}
        active={guard.active}
        onActiveChange={guard.selectSection}
      >
        {({ active }) => (
          <>
            {active === "profile" ? (
              <div className="space-y-8">
                <SectionCard bare title="Contact">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name">
                      <Input value={draft.name} onChange={(e) => set("name")(e.target.value)} className="bg-surface-card" />
                    </Field>
                    <Field label="Email">
                      <Input type="email" value={draft.email} onChange={(e) => set("email")(e.target.value)} className="bg-surface-card" />
                    </Field>
                    <Field label="Company">
                      <Input value={draft.company} onChange={(e) => set("company")(e.target.value)} className="bg-surface-card" />
                    </Field>
                    <Field label="Phone">
                      <Input value={draft.phone} onChange={(e) => set("phone")(e.target.value)} className="bg-surface-card" />
                    </Field>
                    <Field label="Country">
                      <Input value={draft.country} onChange={(e) => set("country")(e.target.value)} className="bg-surface-card" />
                    </Field>
                  </div>
                </SectionCard>
                <SectionCard bare title="Tags" description="Segments for filtering — workflows can add them too (Tag customer).">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {draft.tags.map((t) => (
                      <Badge key={t} variant="outline" className="gap-1 pr-1 text-[11px]">
                        {t}
                        <button type="button" aria-label={`Remove ${t}`} className="rounded hover:text-foreground" onClick={() => set("tags")(draft.tags.filter((x) => x !== t))}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      onBlur={addTag}
                      placeholder="Add a tag…"
                      className="h-7 w-36 bg-surface-card text-xs"
                    />
                  </div>
                </SectionCard>
                <SectionCard bare title="Notes" description="Private to the team.">
                  <Textarea value={draft.notes} onChange={(e) => set("notes")(e.target.value)} rows={4} className="bg-surface-card" placeholder="Preferences, agreements, context…" />
                </SectionCard>
              </div>
            ) : null}

            {active === "orders" ? (
              <SectionCard bare title="Orders" description={`${plural(paid.length, "paid order")} · ${formatMoney(paid.reduce((s, o) => s + o.totalCents - o.refundedCents, 0))} net`} bodyPadding={false}>
                {orders.length ? (
                  <div className="divide-y divide-border">
                    {orders.map((o) => (
                      <div key={o.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-sm text-foreground">{o.number}</p>
                          <p className="truncate text-[11px] text-text-tertiary">
                            {formatDate(o.createdAt)}
                            {galleryById.get(o.galleryId) ? ` · ${galleryById.get(o.galleryId).name}` : ""}
                          </p>
                        </div>
                        <StatusPill status={o.status} map={ORDER_STATUS_META} className="text-[10px]" />
                        <span className="w-24 text-right text-sm tabular-nums text-foreground">{formatMoney(o.totalCents, o.currency)}</span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Copy the buyer's order link"
                          className="h-8 w-8 text-text-secondary hover:bg-surface-active hover:text-foreground"
                          onClick={() => copy(orderPageUrl(o, galleryById.get(o.galleryId)?.slug), "Order link")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={ReceiptText} title="No orders yet" description="Orders from any gallery show here." />
                )}
              </SectionCard>
            ) : null}

            {active === "downloads" ? (
              <SectionCard bare title="Download links" bodyPadding={false}>
                {entitlements.length ? (
                  <div className="divide-y divide-border">
                    {entitlements.map((e) => {
                      const asset = assetById.get(e.assetId);
                      return (
                        <div key={e.id} className="flex items-center gap-3 py-3">
                          <AssetThumbnail asset={asset} assetId={e.assetId} className="h-10 w-10 rounded-md" iconClassName="h-4 w-4" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground">{asset?.name || "Asset"}</p>
                            <p className="truncate text-[11px] text-text-tertiary">
                              {RENDITION_LABEL[e.rendition]} · {e.downloadsCount} used of {limitLabel(e.maxDownloads).toLowerCase()} · expires {e.expiresAt ? formatDate(e.expiresAt) : "never"}
                            </p>
                          </div>
                          <StatusPill status={entitlementState(e)} map={ENTITLEMENT_STATE_META} className="text-[10px]" />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Copy download link"
                            className="h-8 w-8 text-text-secondary hover:bg-surface-active hover:text-foreground"
                            onClick={() => copy(entitlementUrl(e.token), "Download link")}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={Download}
                    title="No download links"
                    description="Links arrive with paid orders, or grant some by hand."
                    action={
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowGrant(true)}>
                        <Download className="h-4 w-4" />
                        Grant downloads
                      </Button>
                    }
                  />
                )}
              </SectionCard>
            ) : null}

            {active === "licenses" ? (
              <SectionCard bare title="Licences" description={customer.licenseeId ? "Issued to this customer's licensee record." : "A licensee record is created with their first licence purchase."}>
                {licenses.length ? (
                  <div className="divide-y divide-border">
                    {licenses.map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{l.title}</p>
                          <p className="font-mono text-[11px] text-text-tertiary">
                            {l.reference} · {l.isPerpetual ? "perpetual" : `until ${formatDate(l.endDate)}`}
                          </p>
                        </div>
                        <span className="text-xs capitalize text-text-secondary">{l.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-tertiary">No licences issued.</p>
                )}
              </SectionCard>
            ) : null}

            {active === "account" ? (
              <SectionCard bare title="Access">
                <SettingsList>
                  <SettingRow
                    icon={Ban}
                    title="Block this customer"
                    description="Checkout refuses new orders from this email. Existing downloads keep working — revoke them on Digital Downloads."
                    checked={draft.status === "blocked"}
                    onCheckedChange={(on) => set("status")(on ? "blocked" : "active")}
                  />
                  <SettingRow
                    title="Marketing consent"
                    description="They opted in to hear about new work at checkout."
                    checked={draft.marketingOptIn}
                    onCheckedChange={set("marketingOptIn")}
                  />
                </SettingsList>
              </SectionCard>
            ) : null}
          </>
        )}
      </EditorShell>

      <GrantDownloadsDialog
        open={showGrant}
        onOpenChange={setShowGrant}
        customers={[]}
        customer={customer}
        assets={assets}
        onSubmit={grant}
      />
      {guard.dialog}
    </>
  );
}

export default CustomerDetailScreen;
