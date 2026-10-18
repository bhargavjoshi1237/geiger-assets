"use client";

// Storefront — the store as a whole: which galleries sell and how each is
// priced, the discount codes buyers can use, and the store's identity and
// policies. Opening a gallery lands on its editor's Selling section.

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  Images,
  Pause,
  Play,
  Plus,
  Settings2,
  ShoppingCart,
  Store,
  TicketPercent,
} from "lucide-react";
import { Button } from "@geiger/ui/button";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SectionCard,
  SegmentedTabs,
  SettingsList,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { RowActions, useModuleRows } from "@/components/internal/shared/module_kit";
import { SelectSettingRow } from "../settings/settings_kit";
import { GalleryDetailScreen } from "../galleries/gallery_detail";
import { STATUS_META as GALLERY_STATUS_META } from "../galleries/constants";
import { DiscountDialog } from "./discount_dialog";
import { BlurInput, BlurTextarea, useStoreSettings } from "./store_kit";
import {
  CURRENCY_OPTIONS,
  DISCOUNT_STATUS_META,
  compactMoney,
  formatDate,
  formatMoney,
  plural,
} from "./constants";
import { REVENUE_STATUSES, withCommerceDefaults } from "@/lib/commerce/shape";
import {
  createDiscount,
  deleteDiscount,
  listDiscounts,
  listOrders,
  listPriceSheets,
  updateDiscount,
} from "@/lib/supabase/store";
import { listGalleries, updateGallery } from "@/lib/supabase/galleries";
import { listCollections } from "@/lib/supabase/collections";
import { getUser } from "@/lib/supabase/user";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

const TABS = [
  { value: "galleries", label: "Selling galleries", icon: Images },
  { value: "discounts", label: "Discount codes", icon: TicketPercent },
  { value: "store", label: "Store & policies", icon: Settings2 },
];

const SELLING_META = {
  on: { label: "Selling", variant: "success", dotClass: "bg-emerald-400" },
  off: { label: "View only", variant: "neutral", dotClass: "bg-zinc-400" },
};

function pricingSummary(commerce, sheetById) {
  const c = withCommerceDefaults(commerce);
  const parts = [];
  if (c.priceSheetId) parts.push(sheetById.get(c.priceSheetId)?.name || "Price sheet");
  if (c.perAsset.enabled) parts.push(`Per asset from ${formatMoney(c.perAsset.defaultPriceCents)}`);
  if (c.unlock.enabled) parts.push(`Unlock ${formatMoney(c.unlock.priceCents)}`);
  return parts.join(" · ") || "Nothing priced yet";
}

function discountValue(d) {
  return d.kind === "fixed" ? `${formatMoney(d.value)} off` : `${d.value}% off`;
}

export function StorefrontScreen({ projectId }) {
  const [galleries, setGalleries, loadingGalleries] = useModuleRows(listGalleries, projectId);
  const [collections] = useModuleRows(listCollections, projectId);
  const [orders] = useModuleRows(listOrders, projectId);
  const [sheets] = useModuleRows(listPriceSheets, projectId);
  const [discounts, setDiscounts, loadingDiscounts] = useModuleRows(listDiscounts, projectId);
  const { settings, loading: loadingSettings, patch } = useStoreSettings(projectId);
  const { setSection } = useWorkspaceUrl();

  const [tab, setTab] = useState("galleries");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const [discountDialog, setDiscountDialog] = useState(null);

  const sheetById = useMemo(() => new Map(sheets.map((s) => [s.id, s])), [sheets]);

  const salesByGallery = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      if (!REVENUE_STATUSES.has(o.status) || !o.galleryId) continue;
      const cur = map.get(o.galleryId) || { orders: 0, revenue: 0 };
      map.set(o.galleryId, { orders: cur.orders + 1, revenue: cur.revenue + o.totalCents - o.refundedCents });
    }
    return map;
  }, [orders]);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return galleries
      .filter((g) => !q || g.name.toLowerCase().includes(q) || g.slug.toLowerCase().includes(q))
      .map((g) => ({ ...g, selling: Boolean(g.commerce?.enabled), sales: salesByGallery.get(g.id) || { orders: 0, revenue: 0 } }))
      .sort((a, b) => Number(b.selling) - Number(a.selling) || b.sales.revenue - a.sales.revenue);
  }, [galleries, search, salesByGallery]);

  const filteredDiscounts = useMemo(() => {
    const q = search.toLowerCase();
    return q ? discounts.filter((d) => d.code.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)) : discounts;
  }, [discounts, search]);

  const stats = useMemo(() => {
    const selling = galleries.filter((g) => g.commerce?.enabled);
    const revenue = [...salesByGallery.values()].reduce((s, v) => s + v.revenue, 0);
    const paidOrders = [...salesByGallery.values()].reduce((s, v) => s + v.orders, 0);
    const liveCodes = discounts.filter((d) => d.status === "active").length;
    const redemptions = discounts.reduce((s, d) => s + d.redemptions, 0);
    return [
      { label: "Selling galleries", value: String(selling.length), footer: `of ${galleries.length} galleries` },
      { label: "Gallery revenue", value: compactMoney(revenue), footer: "net of refunds" },
      { label: "Paid orders", value: String(paidOrders), footer: selling.length ? `${(paidOrders / selling.length).toFixed(1)} per selling gallery` : "—" },
      { label: "Discount codes", value: String(liveCodes), footer: `${plural(redemptions, "redemption")}` },
    ];
  }, [galleries, salesByGallery, discounts]);

  const openGallery = (g) => {
    setSection("selling");
    setOpenId(g.id);
  };

  const toggleSelling = async (g) => {
    const commerce = { ...withCommerceDefaults(g.commerce), enabled: !g.selling };
    setGalleries((list) => list.map((x) => (x.id === g.id ? { ...x, commerce } : x)));
    const saved = await updateGallery(g.id, { commerce });
    if (saved) toast.success(commerce.enabled ? `${g.name} is selling` : `${g.name} is view-only`);
    else {
      setGalleries((list) => list.map((x) => (x.id === g.id ? { ...x, commerce: g.commerce } : x)));
      toast.error("Couldn't update the gallery");
    }
  };

  const saveDiscount = async (draft) => {
    const editing = discountDialog?.discount;
    setDiscountDialog(null);
    if (editing) {
      const previous = discounts;
      setDiscounts((list) => list.map((d) => (d.id === editing.id ? { ...d, ...draft } : d)));
      const saved = await updateDiscount(editing.id, draft);
      if (saved) {
        setDiscounts((list) => list.map((d) => (d.id === saved.id ? saved : d)));
        toast.success("Discount saved");
      } else {
        setDiscounts(previous);
        toast.error("Couldn't save the discount");
      }
      return;
    }
    const user = await getUser();
    const payload = { id: crypto.randomUUID(), projectId, redemptions: 0, createdBy: user?.id || null, ...draft };
    setDiscounts((list) => [payload, ...list]);
    const created = await createDiscount(payload);
    if (created) {
      setDiscounts((list) => list.map((d) => (d.id === created.id ? created : d)));
      toast.success(`${created.code} created`);
    } else {
      setDiscounts((list) => list.filter((d) => d.id !== payload.id));
      toast.error("Couldn't create the discount");
    }
  };

  const setDiscountStatus = async (d, status) => {
    setDiscounts((list) => list.map((x) => (x.id === d.id ? { ...x, status } : x)));
    const saved = await updateDiscount(d.id, { status });
    if (!saved) {
      setDiscounts((list) => list.map((x) => (x.id === d.id ? d : x)));
      toast.error("Couldn't update the code");
    } else toast.success(status === "active" ? `${d.code} resumed` : `${d.code} paused`);
  };

  const removeDiscount = async (d) => {
    const previous = discounts;
    setDiscounts((list) => list.filter((x) => x.id !== d.id));
    const ok = await deleteDiscount(d.id);
    if (ok) toast.success("Discount deleted");
    else {
      setDiscounts(previous);
      toast.error("Couldn't delete the discount");
    }
  };

  if (openId) {
    return (
      <GalleryDetailScreen
        key={openId}
        id={openId}
        projectId={projectId}
        collections={collections}
        galleries={galleries}
        onBack={() => setOpenId(null)}
        onChange={(next) => setGalleries((list) => list.map((g) => (g.id === next.id ? next : g)))}
      />
    );
  }

  const galleryColumns = [
    {
      key: "name",
      header: "Gallery",
      render: (g) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{g.name || "Untitled gallery"}</p>
          <p className="truncate text-[11px] text-text-tertiary">{g.selling ? pricingSummary(g.commerce, sheetById) : `/g/${g.slug || "—"}`}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Page",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (g) => <StatusPill status={g.status} map={GALLERY_STATUS_META} className="text-[10px]" />,
    },
    {
      key: "orders",
      header: "Orders",
      className: "text-xs text-text-secondary",
      render: (g) => g.sales.orders || <span className="text-text-tertiary">—</span>,
    },
    {
      key: "revenue",
      header: "Revenue",
      align: "right",
      className: "tabular-nums text-xs font-medium",
      render: (g) => formatMoney(g.sales.revenue),
    },
    {
      key: "selling",
      header: "Store",
      render: (g) => <StatusPill status={g.selling ? "on" : "off"} map={SELLING_META} className="text-[10px]" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (g) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            extra={[
              g.selling
                ? { icon: Pause, label: "Stop selling", onSelect: () => toggleSelling(g) }
                : { icon: Play, label: "Start selling", onSelect: () => toggleSelling(g) },
              ...(g.slug && g.status === "published"
                ? [{ icon: ExternalLink, label: "Open public page", onSelect: () => window.open(`/g/${g.slug}`, "_blank", "noopener") }]
                : []),
            ]}
            onEdit={() => openGallery(g)}
            editLabel="Edit pricing"
          />
        </div>
      ),
    },
  ];

  const discountColumns = [
    {
      key: "code",
      header: "Code",
      render: (d) => (
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium text-foreground">{d.code}</p>
          <p className="truncate text-[11px] text-text-tertiary">{d.description || discountValue(d)}</p>
        </div>
      ),
    },
    {
      key: "value",
      header: "Discount",
      className: "text-xs text-text-secondary",
      render: (d) => discountValue(d),
    },
    {
      key: "scope",
      header: "Applies to",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (d) => (d.galleryId ? galleries.find((g) => g.id === d.galleryId)?.name || "A gallery" : "Every gallery"),
    },
    {
      key: "used",
      header: "Used",
      className: "text-xs tabular-nums text-text-secondary",
      render: (d) => (d.maxRedemptions ? `${d.redemptions} / ${d.maxRedemptions}` : d.redemptions),
    },
    {
      key: "window",
      header: "Window",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (d) =>
        d.startsAt || d.endsAt ? `${d.startsAt ? formatDate(d.startsAt) : "Now"} → ${d.endsAt ? formatDate(d.endsAt) : "open"}` : "Always",
    },
    {
      key: "status",
      header: "Status",
      render: (d) => <StatusPill status={d.status} map={DISCOUNT_STATUS_META} className="text-[10px]" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (d) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            extra={[
              d.status === "active"
                ? { icon: Pause, label: "Pause", onSelect: () => setDiscountStatus(d, "paused") }
                : { icon: Play, label: "Resume", onSelect: () => setDiscountStatus(d, "active") },
            ]}
            onEdit={() => setDiscountDialog({ discount: d })}
            onDelete={() => removeDiscount(d)}
          />
        </div>
      ),
    },
  ];

  const loading = loadingGalleries || loadingDiscounts || loadingSettings;
  const { store, policies } = settings;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Storefront"
        description="Which galleries sell and how, the discount codes buyers can use, and the store's identity and policies."
        actions={
          tab === "discounts" ? (
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setDiscountDialog({ discount: null })}>
              <Plus className="h-4 w-4" />
              New code
            </Button>
          ) : null
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
        {tab !== "store" ? (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={tab === "galleries" ? "Search galleries..." : "Search codes..."}
            className="w-full sm:w-56"
          />
        ) : null}
      </Toolbar>

      {loading ? (
        <LoadingArea panel className="h-64 py-0" label="Loading the storefront" />
      ) : tab === "galleries" ? (
        <DataTable
          columns={galleryColumns}
          data={rows}
          getRowKey={(g) => g.id}
          onRowClick={openGallery}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={search ? Store : Images}
                title={search ? "No matching galleries" : "No galleries yet"}
                description={search ? "Try another search." : "Create a gallery in Gallery Builder, then turn on Selling in its editor."}
              />
            </div>
          }
        />
      ) : tab === "discounts" ? (
        <DataTable
          columns={discountColumns}
          data={filteredDiscounts}
          getRowKey={(d) => d.id}
          onRowClick={(d) => setDiscountDialog({ discount: d })}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={TicketPercent}
                title={search ? "No matching codes" : "No discount codes yet"}
                description="Percentage or fixed-amount codes, limited by gallery, date window, minimum spend and total uses."
                action={
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setDiscountDialog({ discount: null })}>
                    <Plus className="h-4 w-4" />
                    New code
                  </Button>
                }
              />
            </div>
          }
        />
      ) : (
        <div className="space-y-6">
          <SectionCard title="Store" description="Shown on the cart, checkout, order pages and invoices.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Store name" hint="Defaults to the gallery's name when empty.">
                <BlurInput value={store.name} onCommit={(v) => patch("store", { name: v })} placeholder="e.g. Rivera Photography" />
              </Field>
              <Field label="Support email" hint="Where buyers reply about an order.">
                <BlurInput type="email" value={store.supportEmail} onCommit={(v) => patch("store", { supportEmail: v })} placeholder="orders@studio.com" />
              </Field>
            </div>
            <SettingsList className="mt-4">
              <SelectSettingRow
                title="Currency"
                description="Every price, sheet and order uses it. Change it before you start selling."
                value={store.currency}
                options={CURRENCY_OPTIONS}
                onSave={(v) => patch("store", { currency: v })}
              />
            </SettingsList>
          </SectionCard>
          <SectionCard title="Policies" description="Linked from checkout (terms must be accepted when Cart & Checkout requires it).">
            <div className="grid gap-4">
              <Field label="Terms of sale">
                <BlurTextarea value={policies.terms} onCommit={(v) => patch("policies", { terms: v })} rows={5} placeholder="What buyers agree to — licence scope for downloads, print care, delivery times…" />
              </Field>
              <Field label="Refund policy">
                <BlurTextarea value={policies.refunds} onCommit={(v) => patch("policies", { refunds: v })} rows={3} placeholder="e.g. Digital downloads are refundable within 14 days if not downloaded." />
              </Field>
              <Field label="Privacy note">
                <BlurTextarea value={policies.privacy} onCommit={(v) => patch("policies", { privacy: v })} rows={3} placeholder="How buyer details are used." />
              </Field>
            </div>
          </SectionCard>
          <p className="flex items-center gap-2 text-xs text-text-tertiary">
            <ShoppingCart className="h-3.5 w-3.5" />
            Payment, taxes and checkout fields live on Cart & Checkout; products and price sheets on Products & Pricing.
          </p>
        </div>
      )}

      <DiscountDialog
        open={Boolean(discountDialog)}
        onOpenChange={(open) => !open && setDiscountDialog(null)}
        discount={discountDialog?.discount || null}
        galleries={galleries}
        existingCodes={new Set(discounts.map((d) => d.code))}
        onSubmit={saveDiscount}
      />
    </MainScreenWrapper>
  );
}

export default StorefrontScreen;
