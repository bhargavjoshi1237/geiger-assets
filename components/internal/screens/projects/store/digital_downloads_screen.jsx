"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, CalendarPlus, Copy, Download, FileOutput, RotateCcw, SlidersHorizontal, Undo2 } from "lucide-react";
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
import {
  ClearFiltersButton,
  FilterDropdown,
  RowActions,
  useModuleRows,
} from "@/components/internal/shared/module_kit";
import { AssetThumbnail } from "@/components/internal/shared/asset_thumbnail";
import { GrantDownloadsDialog } from "./grant_downloads_dialog";
import {
  ENTITLEMENT_SOURCE_META,
  ENTITLEMENT_STATE_META,
  RENDITION_OPTIONS,
  entitlementState,
  formatDate,
  formatDateTime,
  optionsFromMeta,
  plural,
} from "./constants";
import { withEntitlementPatch } from "@/lib/commerce/shape";
import {
  createEntitlements,
  deleteEntitlement,
  entitlementUrl,
  listCustomers,
  listEntitlements,
  listOrders,
  updateEntitlement,
} from "@/lib/supabase/store";
import { listAssets } from "@/lib/supabase/assets";
import { getUser } from "@/lib/supabase/user";

const STATE_FILTERS = optionsFromMeta(ENTITLEMENT_STATE_META, "All states");
const SOURCE_FILTERS = optionsFromMeta(ENTITLEMENT_SOURCE_META, "All sources");
const RENDITION_LABEL = Object.fromEntries(RENDITION_OPTIONS.map((o) => [o.value, o.label]));
const DAY_MS = 86_400_000;

function UsageBar({ used, max }) {
  if (!(max > 0)) {
    return <span className="text-xs tabular-nums text-text-secondary">{used} · unlimited</span>;
  }
  const pct = Math.min(100, Math.round((used / max) * 100));
  return (
    <div className="w-28">
      <div className="flex justify-between text-[11px] tabular-nums text-text-secondary">
        <span>
          {used} / {max}
        </span>
        <span className="text-text-tertiary">{pct}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-strong">
        <div className={pct >= 100 ? "h-full bg-amber-400" : "h-full bg-foreground/70"} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DigitalDownloadsScreen({ projectId }) {
  const [rows, setRows, loading] = useModuleRows(listEntitlements, projectId);
  const [customers] = useModuleRows(listCustomers, projectId);
  const [orders] = useModuleRows(listOrders, projectId);
  const [assets] = useModuleRows(listAssets, projectId);

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [showGrant, setShowGrant] = useState(false);
  const [now] = useState(() => Date.now());

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const filtered = useMemo(() => {
    let list = rows;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => {
        const c = customerById.get(e.customerId);
        return [assetById.get(e.assetId)?.name, c?.email, c?.name, orderById.get(e.orderId)?.number].some((v) =>
          String(v || "").toLowerCase().includes(q),
        );
      });
    }
    if (stateFilter !== "all") list = list.filter((e) => entitlementState(e) === stateFilter);
    if (sourceFilter !== "all") list = list.filter((e) => e.source === sourceFilter);
    return list;
  }, [rows, search, stateFilter, sourceFilter, customerById, assetById, orderById]);

  const stats = useMemo(() => {
    const active = rows.filter((e) => !e.problem);
    const served = rows.reduce((s, e) => s + e.downloadsCount, 0);
    const soon = active.filter((e) => e.expiresAt && new Date(e.expiresAt).getTime() - now < 7 * DAY_MS).length;
    const unused = active.filter((e) => e.downloadsCount === 0).length;
    return [
      { label: "Active links", value: String(active.length), footer: `of ${rows.length} issued` },
      { label: "Downloads served", value: String(served), footer: "across every link" },
      { label: "Expiring this week", value: String(soon), footer: "still active" },
      { label: "Never downloaded", value: String(unused), footer: "active but unused" },
    ];
  }, [rows, now]);

  const patch = async (e, change, success) => {
    setRows((list) => list.map((x) => (x.id === e.id ? withEntitlementPatch(x, change) : x)));
    const saved = await updateEntitlement(e.id, change);
    if (saved) {
      setRows((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      toast.success(success);
    } else {
      setRows((list) => list.map((x) => (x.id === e.id ? e : x)));
      toast.error("Couldn't update the link");
    }
  };

  const extend = (e) => {
    const base = Math.max(now, e.expiresAt ? new Date(e.expiresAt).getTime() : now);
    patch(e, { expiresAt: new Date(base + 30 * DAY_MS).toISOString() }, "Extended by 30 days");
  };

  const remove = async (e) => {
    const previous = rows;
    setRows((list) => list.filter((x) => x.id !== e.id));
    const ok = await deleteEntitlement(e.id);
    if (ok) toast.success("Link deleted");
    else {
      setRows(previous);
      toast.error("Couldn't delete the link");
    }
  };

  const copy = async (e) => {
    try {
      await navigator.clipboard.writeText(entitlementUrl(e.token));
      toast.success("Download link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const grant = async (input) => {
    setShowGrant(false);
    const user = await getUser();
    const created = await createEntitlements(
      input.assetIds.map((assetId) => ({
        projectId,
        customerId: input.customerId,
        assetId,
        rendition: input.rendition,
        maxDownloads: input.maxDownloads,
        expiresAt: input.expiresAt,
        source: "manual",
        createdBy: user?.id || null,
      })),
    );
    if (created?.length) {
      setRows((list) => [...created, ...list]);
      toast.success(`${plural(created.length, "download link")} granted`);
    } else toast.error("Couldn't grant the downloads");
  };

  const columns = [
    {
      key: "asset",
      header: "File",
      render: (e) => {
        const asset = assetById.get(e.assetId);
        return (
          <div className="flex min-w-0 items-center gap-3">
            <AssetThumbnail asset={asset} assetId={e.assetId} className="h-10 w-10 rounded-md" iconClassName="h-4 w-4" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{asset?.name || "Asset"}</p>
              <p className="truncate text-[11px] text-text-tertiary">{RENDITION_LABEL[e.rendition]}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "customer",
      header: "Customer",
      render: (e) => {
        const c = customerById.get(e.customerId);
        const o = orderById.get(e.orderId);
        return (
          <div className="min-w-0">
            <p className="truncate text-xs text-foreground">{c?.name || c?.email || "—"}</p>
            <p className="truncate text-[11px] text-text-tertiary">{o ? o.number : ENTITLEMENT_SOURCE_META[e.source]?.label}</p>
          </div>
        );
      },
    },
    {
      key: "usage",
      header: "Used",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (e) => <UsageBar used={e.downloadsCount} max={e.maxDownloads} />,
    },
    {
      key: "last",
      header: "Last download",
      className: "hidden text-xs text-text-secondary xl:table-cell",
      headClassName: "hidden xl:table-cell",
      render: (e) => (e.lastDownloadedAt ? formatDateTime(e.lastDownloadedAt) : "Never"),
    },
    {
      key: "expires",
      header: "Expires",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (e) => (e.expiresAt ? formatDate(e.expiresAt) : "Never"),
    },
    {
      key: "state",
      header: "State",
      render: (e) => <StatusPill status={entitlementState(e)} map={ENTITLEMENT_STATE_META} className="text-[10px]" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (e) => (
        <div onClick={(ev) => ev.stopPropagation()}>
          <RowActions
            extra={[
              { icon: Copy, label: "Copy link", onSelect: () => copy(e) },
              { icon: CalendarPlus, label: "Extend 30 days", onSelect: () => extend(e) },
              ...(e.downloadsCount > 0 ? [{ icon: RotateCcw, label: "Reset download count", onSelect: () => patch(e, { downloadsCount: 0 }, "Download count reset") }] : []),
              e.revokedAt
                ? { icon: Undo2, label: "Restore link", onSelect: () => patch(e, { revokedAt: null }, "Link restored") }
                : { icon: Ban, label: "Revoke link", onSelect: () => patch(e, { revokedAt: new Date().toISOString() }, "Link revoked") },
            ]}
            onDelete={() => remove(e)}
            deleteLabel="Delete link"
          />
        </div>
      ),
    },
  ];

  const hasFilters = stateFilter !== "all" || sourceFilter !== "all" || Boolean(search);
  const clearFilters = () => {
    setStateFilter("all");
    setSourceFilter("all");
    setSearch("");
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Digital Downloads"
        description="Every download link a sale, a workflow or your team has handed out — with limits, expiry and revocation."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={!customers.length} onClick={() => setShowGrant(true)}>
            <Download className="h-4 w-4" />
            Grant downloads
          </Button>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={stateFilter} onValueChange={setStateFilter} options={STATE_FILTERS} placeholder="State" icon={SlidersHorizontal} />
          <FilterDropdown value={sourceFilter} onValueChange={setSourceFilter} options={SOURCE_FILTERS} placeholder="Source" />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search files, buyers, orders..." className="w-full sm:w-64" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" label="Loading downloads" />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(e) => e.id}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={hasFilters ? SlidersHorizontal : FileOutput}
                title={hasFilters ? "No matching links" : "No download links yet"}
                description={
                  hasFilters
                    ? "Try adjusting your filters."
                    : "Paid orders create links automatically; workflows (Grant downloads) and your team can add more."
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

      <GrantDownloadsDialog open={showGrant} onOpenChange={setShowGrant} customers={customers} assets={assets} onSubmit={grant} />
    </MainScreenWrapper>
  );
}

export default DigitalDownloadsScreen;
