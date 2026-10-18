"use client";

import React, { useMemo, useState } from "react";
import { Ban, Layers, RotateCcw, SlidersHorizontal, UserPlus, Users } from "lucide-react";
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
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { MEMBER_STATUS_META, statusFilterOptions, formatMoney, formatDate } from "./constants";
import { FilterDropdown, RowActions, ClearFiltersButton, useCreatorRows, CreateDialog, FieldRow, SelectField, TextField } from "./creator_kit";
import { MemberDetailScreen } from "./member_detail";
import {
  listMembers,
  createMember,
  updateMember,
  deleteMember,
  listSubscriptions,
  listTiers,
  listInvoices,
  listTips,
  listPaidMessages,
} from "@/lib/supabase/creator";
import { getUser } from "@/lib/supabase/user";

const STATUS_FILTERS = statusFilterOptions(MEMBER_STATUS_META, "All statuses");
const STATUS_OPTIONS = Object.entries(MEMBER_STATUS_META).map(([value, m]) => ({ value, label: m.label }));
const LIVE = new Set(["active", "trialing", "past_due"]);
const EMPTY = { fanName: "", fanEmail: "", status: "active" };

function MemberDialog({ open, onOpenChange, onSubmit }) {
  const [draft, setDraft] = useState(EMPTY);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  React.useEffect(() => {
    if (open) setDraft(EMPTY);
  }, [open]);
  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add member"
      description="Add a fan by hand — subscribers from checkout are added automatically."
      submitLabel="Add member"
      onSubmit={() => onSubmit(draft)}
    >
      <FieldRow>
        <TextField label="Display name" value={draft.fanName} onChange={set("fanName")} placeholder="e.g. alex_fan" />
        <TextField label="Email" type="email" value={draft.fanEmail} onChange={set("fanEmail")} placeholder="fan@example.com" />
      </FieldRow>
      <SelectField label="Status" value={draft.status} onChange={set("status")} options={STATUS_OPTIONS} />
    </CreateDialog>
  );
}

export function MembersScreen({ projectId }) {
  const [rows, setRows, loading] = useCreatorRows(listMembers, projectId);
  const [subscriptions, setSubscriptions] = useCreatorRows(listSubscriptions, projectId);
  const [tiers] = useCreatorRows(listTiers, projectId);
  const [invoices] = useCreatorRows(listInvoices, projectId);
  const [tips] = useCreatorRows(listTips, projectId);
  const [messages] = useCreatorRows(listPaidMessages, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [openId, setOpenId] = useState(null);
  const { setSection } = useWorkspaceUrl();

  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const tierFilters = useMemo(() => [{ value: "all", label: "All tiers" }, { value: "none", label: "No tier" }, ...tiers.map((t) => ({ value: t.id, label: t.name }))], [tiers]);

  // A member's current tier: their newest live subscription.
  const tierIdByMember = useMemo(() => {
    const map = new Map();
    for (const s of [...subscriptions].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
      if (LIVE.has(s.status)) map.set(s.memberId, s.tierId);
    }
    return map;
  }, [subscriptions]);

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((m) => m.fanName.toLowerCase().includes(q) || m.fanEmail.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((m) => m.status === statusFilter);
    if (tierFilter === "none") r = r.filter((m) => !tierIdByMember.has(m.id));
    else if (tierFilter !== "all") r = r.filter((m) => tierIdByMember.get(m.id) === tierFilter);
    return r;
  }, [rows, search, statusFilter, tierFilter, tierIdByMember]);

  const pager = usePagination(filtered, { resetKey: `${search}|${statusFilter}|${tierFilter}` });

  const stats = useMemo(() => {
    const active = rows.filter((m) => m.status === "active").length;
    const revenue = rows.reduce((s, m) => s + m.totalSpentCents, 0);
    const paying = rows.filter((m) => tierById.get(tierIdByMember.get(m.id))?.priceCents > 0).length;
    return [
      { label: "Members", value: String(rows.length), footer: `${active} active` },
      { label: "Paying", value: String(paying), footer: `${rows.filter((m) => m.status === "trialing").length} trialing` },
      { label: "Lifetime value", value: formatMoney(revenue), footer: `${formatMoney(rows.length ? Math.round(revenue / rows.length) : 0)} average` },
      { label: "At risk", value: String(rows.filter((m) => m.status === "past_due").length), footer: `${rows.filter((m) => m.status === "blocked").length} suspended` },
    ];
  }, [rows, tierById, tierIdByMember]);

  const replace = (next) => setRows((list) => list.map((m) => (m.id === next.id ? next : m)));
  const upsertSubscription = (sub) =>
    setSubscriptions((list) => (list.some((s) => s.id === sub.id) ? list.map((s) => (s.id === sub.id ? sub : s)) : [sub, ...list]));

  const handleCreate = async ({ fanName, fanEmail, status }) => {
    const email = fanEmail.trim().toLowerCase();
    if (!fanName.trim() && !email) return toast.error("Name or email is required");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast.error("Enter a valid email");
    if (email && rows.some((m) => m.fanEmail.toLowerCase() === email)) return toast.error("A member with that email already exists");
    const user = await getUser();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    setRows((prev) => [{ id, projectId, fanName: fanName.trim(), fanEmail: email, status, totalSpentCents: 0, lastSeenAt: "", createdAt: now, updatedAt: now }, ...prev]);
    setShowCreate(false);
    const created = await createMember({ id, projectId, fanName: fanName.trim(), fanEmail: email || null, status, createdBy: user?.id || null });
    if (created) {
      replace(created);
      toast.success("Member added");
    } else {
      setRows((prev) => prev.filter((m) => m.id !== id));
      toast.error("Could not add member");
    }
  };

  const setStatus = async (member, status) => {
    replace({ ...member, status });
    const saved = await updateMember(member.id, { status });
    if (!saved) {
      replace(member);
      toast.error("Could not update member");
    } else {
      replace(saved);
      toast.success(status === "blocked" ? "Member suspended" : "Member reactivated");
    }
  };

  const handleDelete = async (member) => {
    if (subscriptions.some((s) => s.memberId === member.id && LIVE.has(s.status))) {
      return toast.error("This member has a live subscription — suspend them instead");
    }
    const prev = rows;
    setRows((list) => list.filter((m) => m.id !== member.id));
    const ok = await deleteMember(member.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not remove member");
    } else toast.success("Member removed");
  };

  const open = openId ? rows.find((m) => m.id === openId) : null;
  if (open) {
    return (
      <MemberDetailScreen
        key={open.id}
        member={open}
        tiers={tiers}
        subscriptions={subscriptions.filter((s) => s.memberId === open.id)}
        invoices={invoices.filter((i) => i.memberId === open.id)}
        tips={tips.filter((t) => t.memberId === open.id)}
        messages={messages.filter((m) => m.memberId === open.id)}
        onBack={() => {
          setSection(null);
          setOpenId(null);
        }}
        onChange={replace}
        onSubscription={upsertSubscription}
      />
    );
  }

  const columns = [
    {
      key: "fan",
      header: "Member",
      render: (m) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-semibold text-foreground">
            {(m.fanName || m.fanEmail || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{m.fanName || "—"}</p>
            <p className="truncate text-[11px] text-text-tertiary">{m.fanEmail || "no email"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "tier",
      header: "Tier",
      className: "hidden text-xs sm:table-cell",
      headClassName: "hidden sm:table-cell",
      render: (m) => tierById.get(tierIdByMember.get(m.id))?.name || <span className="text-text-tertiary">No tier</span>,
    },
    { key: "spent", header: "Lifetime", className: "tabular-nums text-xs", render: (m) => formatMoney(m.totalSpentCents) },
    { key: "status", header: "Status", render: (m) => <StatusPill status={m.status} map={MEMBER_STATUS_META} className="text-[10px]" /> },
    {
      key: "seen",
      header: "Last seen",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (m) => formatDate(m.lastSeenAt || m.createdAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (m) => (
        <RowActions
          onEdit={() => setOpenId(m.id)}
          editLabel="Open profile"
          onDelete={() => handleDelete(m)}
          extra={[
            m.status === "blocked"
              ? { icon: RotateCcw, label: "Reactivate", onSelect: () => setStatus(m, "active") }
              : { icon: Ban, label: "Suspend", onSelect: () => setStatus(m, "blocked") },
          ]}
        />
      ),
    },
  ];

  const hasFilters = statusFilter !== "all" || tierFilter !== "all" || Boolean(search);
  const clear = () => {
    setStatusFilter("all");
    setTierFilter("all");
    setSearch("");
  };
  const addMember = (
    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}>
      <UserPlus className="h-4 w-4" />
      Add member
    </Button>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Members" description="The member registry — every subscriber and free follower with their tier, lifetime value and account status." actions={addMember} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={tierFilter} onValueChange={setTierFilter} options={tierFilters} placeholder="Tier" icon={Layers} />
          {hasFilters ? <ClearFiltersButton onClick={clear} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search members..." className="w-full sm:w-64" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" />
      ) : (
        <DataTable
          columns={columns}
          data={pager.pageItems}
          getRowKey={(m) => m.id}
          onRowClick={(m) => setOpenId(m.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={Users}
                title={hasFilters ? "No members match" : "No members yet"}
                description={hasFilters ? "Try adjusting your filters." : "Members appear here once fans subscribe or follow."}
                action={hasFilters ? <ClearFiltersButton onClick={clear} /> : addMember}
              />
            </div>
          }
        />
      )}
      {!loading ? <ListPagination {...pager} itemLabel="members" /> : null}
      <MemberDialog open={showCreate} onOpenChange={setShowCreate} onSubmit={handleCreate} />
    </MainScreenWrapper>
  );
}

export default MembersScreen;
