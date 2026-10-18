"use client";

import React, { useMemo, useState } from "react";
import { Ban, CalendarClock, CalendarX, Layers, RefreshCw, RotateCcw, SlidersHorizontal, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
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
import { SUB_STATUS_META, addInterval, statusFilterOptions, formatDate, formatMoney, monthlyCents } from "./constants";
import { FilterDropdown, RowActions, ClearFiltersButton, useCreatorRows } from "./creator_kit";
import { SubscriptionDialog, buildSubscription } from "./subscription_dialog";
import { listSubscriptions, createSubscription, updateSubscription, deleteSubscription, listMembers, listTiers } from "@/lib/supabase/creator";
import { getUser } from "@/lib/supabase/user";

const STATUS_FILTERS = statusFilterOptions(SUB_STATUS_META, "All statuses");
const LIVE = new Set(["active", "trialing", "past_due"]);

export function SubscriptionsScreen({ projectId }) {
  const [rows, setRows, loading] = useCreatorRows(listSubscriptions, projectId);
  const [members] = useCreatorRows(listMembers, projectId);
  const [tiers] = useCreatorRows(listTiers, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const tierFilters = useMemo(() => [{ value: "all", label: "All tiers" }, ...tiers.map((t) => ({ value: t.id, label: t.name }))], [tiers]);

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((s) => {
        const m = memberById.get(s.memberId);
        return [m?.fanName, m?.fanEmail, tierById.get(s.tierId)?.name].some((v) => String(v || "").toLowerCase().includes(q));
      });
    }
    if (statusFilter !== "all") r = r.filter((s) => s.status === statusFilter);
    if (tierFilter !== "all") r = r.filter((s) => s.tierId === tierFilter);
    return r;
  }, [rows, search, statusFilter, tierFilter, memberById, tierById]);

  const pager = usePagination(filtered, { resetKey: `${search}|${statusFilter}|${tierFilter}` });

  const stats = useMemo(() => {
    const live = rows.filter((s) => LIVE.has(s.status));
    const mrr = rows.filter((s) => s.status === "active").reduce((sum, s) => sum + monthlyCents(tierById.get(s.tierId)), 0);
    const ending = live.filter((s) => s.cancelAtPeriodEnd).length;
    const churned = rows.filter((s) => s.status === "cancelled" || s.status === "expired").length;
    return [
      { label: "Live subscriptions", value: String(live.length), footer: `${rows.filter((s) => s.status === "trialing").length} trialing` },
      { label: "MRR", value: formatMoney(mrr), footer: "from active subscriptions" },
      { label: "Past due", value: String(rows.filter((s) => s.status === "past_due").length), footer: "in the dunning queue" },
      { label: "Churn", value: rows.length ? `${Math.round((churned / rows.length) * 100)}%` : "0%", footer: `${ending} ending at period end` },
    ];
  }, [rows, tierById]);

  const replace = (next) => setRows((list) => list.map((s) => (s.id === next.id ? next : s)));

  const handleCreate = async ({ memberId, tierId, trialDays }) => {
    const tier = tierById.get(tierId);
    if (!memberId || !tier) return toast.error("Pick a member and a tier");
    if (rows.some((s) => s.memberId === memberId && s.tierId === tierId && LIVE.has(s.status))) {
      return toast.error("That member already has a live subscription on this tier");
    }
    const user = await getUser();
    const input = { ...buildSubscription({ projectId, memberId, tier, trialDays }), createdBy: user?.id || null };
    const now = new Date().toISOString();
    setRows((prev) => [{ ...input, createdAt: now, updatedAt: now }, ...prev]);
    setShowCreate(false);
    const created = await createSubscription(input);
    if (created) {
      replace(created);
      toast.success(input.status === "trialing" ? "Trial started" : "Subscription created");
    } else {
      setRows((prev) => prev.filter((s) => s.id !== input.id));
      toast.error("Could not create subscription");
    }
  };

  const patch = async (sub, changes, message) => {
    const prev = rows;
    replace({ ...sub, ...changes });
    const saved = await updateSubscription(sub.id, changes);
    if (!saved) {
      setRows(prev);
      toast.error("Could not update subscription");
    } else {
      replace(saved);
      toast.success(message);
    }
  };

  const reactivate = (sub) => {
    const tier = tierById.get(sub.tierId);
    const now = new Date().toISOString();
    patch(sub, { status: "active", cancelAtPeriodEnd: false, currentPeriodStart: now, currentPeriodEnd: addInterval(now, tier?.interval) }, "Subscription reactivated");
  };

  const handleDelete = async (sub) => {
    const prev = rows;
    setRows((list) => list.filter((s) => s.id !== sub.id));
    const ok = await deleteSubscription(sub.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete subscription");
    } else toast.success("Subscription deleted");
  };

  const actionsFor = (s) => {
    if (!LIVE.has(s.status)) return [{ icon: RotateCcw, label: "Reactivate", onSelect: () => reactivate(s) }];
    return [
      s.cancelAtPeriodEnd
        ? { icon: Undo2, label: "Resume renewal", onSelect: () => patch(s, { cancelAtPeriodEnd: false }, "Renewal resumed") }
        : { icon: CalendarX, label: "Cancel at period end", onSelect: () => patch(s, { cancelAtPeriodEnd: true }, "Will cancel at period end") },
      { icon: Ban, label: "Cancel now", onSelect: () => patch(s, { status: "cancelled", cancelAtPeriodEnd: false, currentPeriodEnd: new Date().toISOString() }, "Subscription cancelled") },
    ];
  };

  const columns = [
    {
      key: "member",
      header: "Member",
      render: (s) => {
        const m = memberById.get(s.memberId);
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{m?.fanName || m?.fanEmail || "Unknown member"}</p>
            <p className="truncate text-[11px] text-text-tertiary">{m?.fanEmail || ""}</p>
          </div>
        );
      },
    },
    {
      key: "tier",
      header: "Tier",
      className: "text-xs",
      render: (s) => {
        const t = tierById.get(s.tierId);
        return (
          <div className="min-w-0">
            <p className="truncate text-foreground">{t?.name || "—"}</p>
            {t && !t.isFree && t.priceCents ? <p className="text-[11px] tabular-nums text-text-tertiary">{formatMoney(t.priceCents, t.currency)} / {t.interval === "year" ? "yr" : "mo"}</p> : null}
          </div>
        );
      },
    },
    { key: "status", header: "Status", render: (s) => <StatusPill status={s.status} map={SUB_STATUS_META} className="text-[10px]" /> },
    {
      key: "period",
      header: "Renews",
      className: "hidden whitespace-nowrap text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (s) => {
        if (!LIVE.has(s.status)) return <span className="text-text-tertiary">Ended {formatDate(s.currentPeriodEnd || s.updatedAt)}</span>;
        if (s.status === "trialing") return `Trial ends ${formatDate(s.trialEnd || s.currentPeriodEnd)}`;
        return s.cancelAtPeriodEnd ? <span className="text-amber-700 dark:text-amber-300">Ends {formatDate(s.currentPeriodEnd)}</span> : formatDate(s.currentPeriodEnd);
      },
    },
    {
      key: "started",
      header: "Started",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (s) => formatDate(s.createdAt),
    },
    { key: "actions", header: "", align: "right", render: (s) => <RowActions extra={actionsFor(s)} onDelete={() => handleDelete(s)} /> },
  ];

  const hasFilters = statusFilter !== "all" || tierFilter !== "all" || Boolean(search);
  const clear = () => {
    setStatusFilter("all");
    setTierFilter("all");
    setSearch("");
  };
  const newSubscription = (
    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}>
      <RefreshCw className="h-4 w-4" />
      New subscription
    </Button>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Subscriptions" description="Every member-to-tier attachment — trials, renewals, past-due dunning and cancellations." actions={newSubscription} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={tierFilter} onValueChange={setTierFilter} options={tierFilters} placeholder="Tier" icon={Layers} />
          {hasFilters ? <ClearFiltersButton onClick={clear} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search subscriptions..." className="w-full sm:w-64" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" />
      ) : (
        <DataTable
          columns={columns}
          data={pager.pageItems}
          getRowKey={(s) => s.id}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={CalendarClock}
                title={hasFilters ? "No subscriptions match" : "No subscriptions yet"}
                description={hasFilters ? "Try adjusting your filters." : "Create a subscription to start recurring billing."}
                action={hasFilters ? <ClearFiltersButton onClick={clear} /> : newSubscription}
              />
            </div>
          }
        />
      )}
      {!loading ? <ListPagination {...pager} itemLabel="subscriptions" /> : null}
      <SubscriptionDialog open={showCreate} onOpenChange={setShowCreate} members={members} tiers={tiers} onSubmit={handleCreate} />
    </MainScreenWrapper>
  );
}

export default SubscriptionsScreen;
