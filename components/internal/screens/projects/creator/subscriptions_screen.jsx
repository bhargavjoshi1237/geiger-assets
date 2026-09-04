"use client";

import React, { useMemo, useState } from "react";
import { CalendarClock, Loader2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader, StatsBar, SearchInput, StatusPill, EmptyState, DataTable, Toolbar,
} from "@/components/internal/shared/screen_kit";
import { SUB_STATUS_META, statusFilterOptions, formatDate } from "./constants";
import { FilterDropdown, RowActions, ClearFiltersButton, useCreatorRows, CreateDialog } from "./creator_kit";
import { listSubscriptions, createSubscription, updateSubscription, deleteSubscription, listMembers, listTiers } from "@/lib/supabase/creator";

const STATUS_FILTERS = statusFilterOptions(SUB_STATUS_META, "All statuses");

function SubscriptionDialog({ open, onOpenChange, members, tiers, onSubmit }) {
  const [memberId, setMemberId] = useState("all");
  const [tierId, setTierId] = useState("all");
  React.useEffect(() => { setMemberId("all"); setTierId("all"); }, [open]);
  return (
    <CreateDialog open={open} onOpenChange={onOpenChange} title="New subscription" description="Attach a member to a tier — monthly/annual recurring billing starts here." submitLabel="Create subscription" onSubmit={() => onSubmit({ memberId, tierId })}>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground">Member</label>
        <FilterDropdown value={memberId} onValueChange={setMemberId} options={[{ value: "all", label: "Select member" }, ...members.map((m) => ({ value: m.id, label: m.fanName || m.fanEmail || m.id.slice(0, 8) }))]} placeholder="Member" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground">Tier</label>
        <FilterDropdown value={tierId} onValueChange={setTierId} options={[{ value: "all", label: "Select tier" }, ...tiers.map((t) => ({ value: t.id, label: t.name }))]} placeholder="Tier" />
      </div>
    </CreateDialog>
  );
}

export function SubscriptionsScreen({ projectId }) {
  const [rows, setRows, loading] = useCreatorRows(listSubscriptions, projectId);
  const [members] = useCreatorRows(listMembers, projectId);
  const [tiers] = useCreatorRows(listTiers, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((s) => (memberById.get(s.memberId)?.fanName ?? "").toLowerCase().includes(q) || (tierById.get(s.tierId)?.name ?? "").toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((s) => s.status === statusFilter);
    return r;
  }, [rows, search, statusFilter, memberById, tierById]);

  const stats = useMemo(() => {
    const active = rows.filter((s) => s.status === "active").length;
    const trialing = rows.filter((s) => s.status === "trialing").length;
    const pastDue = rows.filter((s) => s.status === "past_due").length;
    const cancelRate = rows.length ? Math.round((rows.filter((s) => s.status === "cancelled").length / rows.length) * 100) : 0;
    return [
      { label: "Subscriptions", value: String(rows.length), footer: `${active} active` },
      { label: "Trialing", value: String(trialing), footer: "converting soon" },
      { label: "Past due", value: String(pastDue), footer: "needs dunning" },
      { label: "Churn", value: `${cancelRate}%`, footer: "cancelled share" },
    ];
  }, [rows]);

  const handleCreate = async ({ memberId, tierId }) => {
    if (memberId === "all" || tierId === "all") return toast.error("Pick a member and a tier");
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, memberId, tierId, status: "active", currentPeriodStart: new Date().toISOString(), currentPeriodEnd: "", trialEnd: "", cancelAtPeriodEnd: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setRows((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const created = await createSubscription({ id, projectId, memberId, tierId, status: "active" });
    if (created) {
      setRows((prev) => prev.map((s) => (s.id === id ? created : s)));
      toast.success("Subscription created");
    } else {
      setRows((prev) => prev.filter((s) => s.id !== id));
      toast.error("Could not create subscription");
    }
  };

  const handleCancel = async (sub) => {
    const prev = rows;
    setRows((list) => list.map((s) => (s.id === sub.id ? { ...s, status: "cancelled", cancelAtPeriodEnd: true } : s)));
    const saved = await updateSubscription(sub.id, { status: "cancelled", cancelAtPeriodEnd: true });
    if (!saved) {
      setRows(prev);
      toast.error("Could not cancel subscription");
    } else toast.success("Subscription cancelled");
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

  const columns = [
    { key: "member", header: "Member", render: (s) => (<div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{memberById.get(s.memberId)?.fanName || "—"}</p><p className="truncate text-[11px] text-text-tertiary">{memberById.get(s.memberId)?.fanEmail || ""}</p></div>) },
    { key: "tier", header: "Tier", className: "text-xs", render: (s) => tierById.get(s.tierId)?.name || "—" },
    { key: "status", header: "Status", render: (s) => <StatusPill status={s.status} map={SUB_STATUS_META} className="text-[10px]" /> },
    { key: "period", header: "Renews", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell", render: (s) => formatDate(s.currentPeriodEnd) },
    { key: "actions", header: "", align: "right", render: (s) => <RowActions onEdit={() => handleCancel(s)} onDelete={() => handleDelete(s)} /> },
  ];

  const hasFilters = statusFilter !== "all" || Boolean(search);

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader title="Subscriptions" description="Recurring billing — trials, renewals, past-due dunning, and cancellations." actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><RefreshCw className="mr-1.5 h-4 w-4" />New subscription</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search subscriptions..." className="w-full sm:w-64" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          {hasFilters ? <ClearFiltersButton onClick={() => { setStatusFilter("all"); setSearch(""); }} /> : null}
        </div>
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <DataTable columns={columns} data={filtered} getRowKey={(s) => s.id} empty={<EmptyState icon={CalendarClock} title="No subscriptions yet" description={hasFilters ? "Try adjusting your filters." : "Create a subscription to start recurring billing."} action={<Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><RefreshCw className="mr-1.5 h-4 w-4" />New subscription</Button>} />} />
      )}
      {!loading && filtered.length > 0 ? <div className="text-xs text-text-secondary">Showing {filtered.length} of {rows.length} subscriptions</div> : null}
      <SubscriptionDialog open={showCreate} onOpenChange={setShowCreate} members={members} tiers={tiers} onSubmit={handleCreate} />
    </MainScreenWrapper>
  );
}

export default SubscriptionsScreen;
