"use client";

import { Button, DropdownMenuItem, LogoLoading } from "@geiger/ui";
import React, { useMemo, useState } from "react";
import { ArrowUpDown, Ban, CheckCircle2, History, SlidersHorizontal, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
import {
  ScreenHeader, StatsBar, SearchInput, StatusPill, EmptyState, DataTable, Toolbar,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { MEMBER_STATUS_META } from "@/components/internal/screens/projects/creator/constants";
import { ACTIVITY_KIND_META, statusFilterOptions, formatDate, formatDateTime } from "./constants";
import { FilterDropdown, RowActions, ClearFiltersButton, useCreatorRows as useMembershipRows, CreateDialog } from "@/components/internal/screens/projects/creator/creator_kit";
import { listActivity } from "@/lib/supabase/memberships";
import { listMembers, listSubscriptions, listTiers, updateMember, deleteMember, createSubscription, updateSubscription } from "@/lib/supabase/creator";

const STATUS_FILTERS = statusFilterOptions(MEMBER_STATUS_META, "All statuses");

const SORT_OPTIONS = [
  { value: "recent-desc", label: "Recently active" },
  { value: "recent-asc", label: "Least recently active" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "spent-desc", label: "Highest spend" },
  { value: "spent-asc", label: "Lowest spend" },
];

function AssignTierDialog({ open, onOpenChange, members, tiers, initialMemberId, onSubmit }) {
  const [memberId, setMemberId] = useState(initialMemberId ?? "all");
  const [tierId, setTierId] = useState("all");
  React.useEffect(() => {
    if (!open) return;
    setMemberId(initialMemberId ?? "all");
    setTierId("all");
  }, [initialMemberId, open]);
  return (
    <CreateDialog open={open} onOpenChange={onOpenChange} title="Assign tier" description="Attach a member to a tier manually — their active subscription follows." submitLabel="Assign tier" onSubmit={() => onSubmit({ memberId, tierId })}>
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

export function MemberRegistryScreen({ projectId }) {
  const [members, setMembers, loadingMembers] = useMembershipRows(listMembers, projectId);
  const [subscriptions, setSubscriptions] = useMembershipRows(listSubscriptions, projectId);
  const [tiers] = useMembershipRows(listTiers, projectId);
  const [activity] = useMembershipRows(listActivity, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortValue, setSortValue] = useState("recent-desc");
  const [showAssign, setShowAssign] = useState(false);
  const [assignMemberId, setAssignMemberId] = useState(null);

  const loading = loadingMembers;

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const activeSubByMember = useMemo(() => {
    const map = new Map();
    for (const sub of subscriptions) {
      if ((sub.status === "active" || sub.status === "trialing") && !map.has(sub.memberId)) {
        map.set(sub.memberId, sub);
      }
    }
    return map;
  }, [subscriptions]);
  const activityByMember = useMemo(() => {
    const map = new Map();
    for (const event of activity) {
      if (!event.memberId) continue;
      if (!map.has(event.memberId)) map.set(event.memberId, []);
      map.get(event.memberId).push(event);
    }
    return map;
  }, [activity]);

  const filtered = useMemo(() => {
    let r = [...members];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((m) => m.fanName.toLowerCase().includes(q) || m.fanEmail.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((m) => m.status === statusFilter);
    const [field, direction] = sortValue.split("-");
    r.sort((a, b) => {
      let cmp = 0;
      if (field === "recent") cmp = new Date(a.lastSeenAt || a.createdAt) - new Date(b.lastSeenAt || b.createdAt);
      else if (field === "name") cmp = (a.fanName || "").localeCompare(b.fanName || "");
      else if (field === "spent") cmp = a.totalSpentCents - b.totalSpentCents;
      return direction === "desc" ? -cmp : cmp;
    });
    return r;
  }, [members, search, statusFilter, sortValue]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${statusFilter}|${sortValue}`,
  });

  const recentActivity = useMemo(() => [...activity].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8), [activity]);

  const stats = useMemo(() => {
    const suspended = members.filter((m) => m.status === "blocked").length;
    const downloads = activity.filter((e) => e.kind === "download").length;
    return [
      { label: "Members", value: String(members.length), footer: `${activeSubByMember.size} with active tier` },
      { label: "Subscriptions", value: String(subscriptions.filter((s) => s.status === "active").length), footer: "active renewals" },
      { label: "Suspended", value: String(suspended), footer: "blocked accounts" },
      { label: "Downloads", value: String(downloads), footer: "logged member downloads" },
    ];
  }, [members, subscriptions, activity, activeSubByMember]);

  const openAssign = (memberId = null) => {
    setAssignMemberId(memberId);
    setShowAssign(true);
  };

  const handleAssign = async ({ memberId, tierId }) => {
    if (memberId === "all" || tierId === "all") return toast.error("Pick a member and a tier");
    const existing = activeSubByMember.get(memberId);
    setShowAssign(false);
    if (existing) {
      const prev = subscriptions;
      setSubscriptions((list) => list.map((s) => (s.id === existing.id ? { ...s, tierId } : s)));
      const saved = await updateSubscription(existing.id, { tierId });
      if (!saved) {
        setSubscriptions(prev);
        toast.error("Could not reassign tier");
      } else {
        setSubscriptions((list) => list.map((s) => (s.id === existing.id ? saved : s)));
        toast.success("Tier reassigned");
      }
      return;
    }
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, memberId, tierId, status: "active", currentPeriodStart: new Date().toISOString(), currentPeriodEnd: "", trialEnd: "", cancelAtPeriodEnd: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setSubscriptions((prev) => [optimistic, ...prev]);
    const created = await createSubscription({ id, projectId, memberId, tierId, status: "active" });
    if (created) {
      setSubscriptions((prev) => prev.map((s) => (s.id === id ? created : s)));
      toast.success("Tier assigned");
    } else {
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      toast.error("Could not assign tier");
    }
  };

  const handleSuspend = async (member) => {
    const next = member.status === "blocked" ? "active" : "blocked";
    const prev = members;
    setMembers((list) => list.map((m) => (m.id === member.id ? { ...m, status: next } : m)));
    const saved = await updateMember(member.id, { status: next });
    if (!saved) {
      setMembers(prev);
      toast.error("Could not update account status");
    } else {
      setMembers((list) => list.map((m) => (m.id === member.id ? saved : m)));
      toast.success(next === "blocked" ? "Member suspended" : "Member reactivated");
    }
  };

  const handleDelete = async (member) => {
    const prev = members;
    setMembers((list) => list.filter((m) => m.id !== member.id));
    const ok = await deleteMember(member.id);
    if (!ok) {
      setMembers(prev);
      toast.error("Could not remove member");
    } else toast.success("Member removed");
  };

  const columns = [
    { key: "member", header: "Member", render: (m) => (<div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-semibold text-foreground">{(m.fanName || m.fanEmail || "?").slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{m.fanName || "—"}</p><p className="truncate text-[11px] text-text-tertiary">{m.fanEmail || "no email"}</p></div></div>) },
    { key: "tier", header: "Tier", className: "text-xs", render: (m) => (tierById.get(activeSubByMember.get(m.id)?.tierId)?.name || "No tier") },
    { key: "status", header: "Status", render: (m) => <StatusPill status={m.status} map={MEMBER_STATUS_META} className="text-[10px]" /> },
    { key: "activity", header: "Activity", className: "hidden text-[11px] text-text-secondary md:table-cell", headClassName: "hidden md:table-cell", render: (m) => {
      const events = activityByMember.get(m.id) || [];
      const views = events.filter((e) => e.kind === "view").length;
      const downloads = events.filter((e) => e.kind === "download").length;
      return events.length ? `${views} views · ${downloads} downloads` : "—";
    } },
    { key: "seen", header: "Last seen", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell", render: (m) => formatDate(m.lastSeenAt || m.createdAt) },
    { key: "actions", header: "", align: "right", render: (m) => (
      <RowActions
        onEdit={() => openAssign(m.id)}
        onDelete={() => handleDelete(m)}
        extra={(
          <DropdownMenuItem className="cursor-pointer text-xs focus:bg-surface-hover" onClick={() => handleSuspend(m)}>
            {m.status === "blocked" ? (<><CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Reactivate</>) : (<><Ban className="mr-2 h-3.5 w-3.5" /> Suspend</>)}
          </DropdownMenuItem>
        )}
      />
    ) },
  ];

  const activityColumns = [
    { key: "member", header: "Member", render: (e) => (<span className="text-xs font-medium text-foreground">{memberById.get(e.memberId)?.fanName || memberById.get(e.memberId)?.fanEmail || "—"}</span>) },
    { key: "event", header: "Event", render: (e) => <StatusPill status={e.kind} map={ACTIVITY_KIND_META} className="text-[10px]" /> },
    { key: "detail", header: "Detail", className: "max-w-60 truncate text-xs text-text-secondary", render: (e) => (e.detail || "—") },
    { key: "when", header: "When", className: "text-right text-xs text-text-secondary", align: "right", render: (e) => formatDateTime(e.createdAt) },
  ];

  const hasFilters = statusFilter !== "all" || Boolean(search);

  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
  };

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader title="Member Registry" description="Profiles, active subscriptions, and account statuses — with login and download history." actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => openAssign()}><UserPlus className="mr-1.5 h-4 w-4" />Assign tier</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={sortValue} onValueChange={setSortValue} options={SORT_OPTIONS} placeholder="Sort" icon={ArrowUpDown} />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search members..." />
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable columns={columns} data={pager.pageItems} getRowKey={(m) => m.id} onRowClick={(m) => openAssign(m.id)} empty={<div className="rounded-xl border border-border bg-surface-subtle">{members.length === 0 ? (<EmptyState icon={Users} title="No members yet" description="Members appear here once fans subscribe or follow." action={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>} />) : (<EmptyState icon={Users} title="No matching members" description="No members matches the current search and filter." action={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>} />)}</div>} />
          <ListPagination {...pager} itemLabel="members" />
          <SectionCard title="Recent activity" description="Logins, views, and downloads across the registry.">
            {recentActivity.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-4 py-6 text-sm text-text-tertiary">
                <History className="h-4 w-4 shrink-0" />
                No member activity logged yet — logins, views, and downloads will appear here.
              </div>
            ) : (
              <DataTable columns={activityColumns} data={recentActivity} getRowKey={(e) => e.id} />
            )}
          </SectionCard>
        </div>
      )}
      <AssignTierDialog open={showAssign} onOpenChange={setShowAssign} members={members} tiers={tiers} initialMemberId={assignMemberId} onSubmit={handleAssign} />
    </MainScreenWrapper>
  );
}

export default MemberRegistryScreen;
