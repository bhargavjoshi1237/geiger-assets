"use client";

import React, { useMemo, useState } from "react";
import { Loader2, SlidersHorizontal, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader, StatsBar, SearchInput, StatusPill, EmptyState, DataTable, Toolbar,
} from "@/components/internal/shared/screen_kit";
import { MEMBER_STATUS_META, statusFilterOptions, formatMoney, formatDate } from "./constants";
import { FilterDropdown, RowActions, ClearFiltersButton, useCreatorRows, CreateDialog, TextField } from "./creator_kit";
import { listMembers, createMember, updateMember, deleteMember } from "@/lib/supabase/creator";

const STATUS_FILTERS = statusFilterOptions(MEMBER_STATUS_META, "All statuses");

function MemberDialog({ open, onOpenChange, initial, onSubmit, title, submitLabel }) {
  const [fanName, setFanName] = useState(initial?.fanName ?? "");
  const [fanEmail, setFanEmail] = useState(initial?.fanEmail ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  React.useEffect(() => {
    setFanName(initial?.fanName ?? "");
    setFanEmail(initial?.fanEmail ?? "");
    setStatus(initial?.status ?? "active");
  }, [initial, open]);
  return (
    <CreateDialog open={open} onOpenChange={onOpenChange} title={title} description="Fan directory — every subscriber and free follower in one registry." submitLabel={submitLabel} onSubmit={() => onSubmit({ fanName, fanEmail, status })}>
      <TextField label="Display name" value={fanName} onChange={setFanName} placeholder="e.g. alex_fan" />
      <TextField label="Email" value={fanEmail} onChange={setFanEmail} placeholder="fan@example.com" />
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground">Status</label>
        <FilterDropdown value={status} onValueChange={setStatus} options={Object.entries(MEMBER_STATUS_META).map(([value, m]) => ({ value, label: m.label }))} placeholder="Status" />
      </div>
    </CreateDialog>
  );
}

export function MembersScreen({ projectId }) {
  const [rows, setRows, loading] = useCreatorRows(listMembers, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((m) => m.fanName.toLowerCase().includes(q) || m.fanEmail.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((m) => m.status === statusFilter);
    return r;
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const active = rows.filter((m) => m.status === "active").length;
    const trialing = rows.filter((m) => m.status === "trialing").length;
    const revenue = rows.reduce((s, m) => s + m.totalSpentCents, 0);
    return [
      { label: "Members", value: String(rows.length), footer: `${active} active` },
      { label: "Trialing", value: String(trialing), footer: "conversion funnel" },
      { label: "Lifetime value", value: formatMoney(revenue), footer: "all-time member spend" },
      { label: "Churned", value: String(rows.filter((m) => m.status === "cancelled").length), footer: "cancelled or expired" },
    ];
  }, [rows]);

  const handleCreate = async ({ fanName, fanEmail, status }) => {
    if (!fanName.trim() && !fanEmail.trim()) return toast.error("Name or email is required");
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, fanName: fanName.trim(), fanEmail: fanEmail.trim(), status, totalSpentCents: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setRows((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const created = await createMember({ id, projectId, fanName: fanName.trim(), fanEmail: fanEmail.trim() || null, status });
    if (created) {
      setRows((prev) => prev.map((m) => (m.id === id ? created : m)));
      toast.success("Member added");
    } else {
      setRows((prev) => prev.filter((m) => m.id !== id));
      toast.error("Could not add member");
    }
  };

  const handleSave = async ({ fanName, fanEmail, status }) => {
    if (!editing) return;
    const prev = rows;
    setRows((list) => list.map((m) => (m.id === editing.id ? { ...m, fanName, fanEmail, status } : m)));
    setEditing(null);
    const saved = await updateMember(editing.id, { fanName, fanEmail: fanEmail || null, status });
    if (!saved) {
      setRows(prev);
      toast.error("Could not save member");
    } else {
      setRows((list) => list.map((m) => (m.id === editing.id ? saved : m)));
      toast.success("Member updated");
    }
  };

  const handleDelete = async (member) => {
    const prev = rows;
    setRows((list) => list.filter((m) => m.id !== member.id));
    const ok = await deleteMember(member.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not remove member");
    } else toast.success("Member removed");
  };

  const columns = [
    { key: "fan", header: "Member", render: (m) => (<div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-semibold text-foreground">{(m.fanName || m.fanEmail || "?").slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{m.fanName || "—"}</p><p className="truncate text-[11px] text-text-tertiary">{m.fanEmail || "no email"}</p></div></div>) },
    { key: "spent", header: "Lifetime", className: "tabular-nums text-xs", render: (m) => formatMoney(m.totalSpentCents) },
    { key: "status", header: "Status", render: (m) => <StatusPill status={m.status} map={MEMBER_STATUS_META} className="text-[10px]" /> },
    { key: "seen", header: "Last seen", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell", render: (m) => formatDate(m.lastSeenAt || m.createdAt) },
    { key: "actions", header: "", align: "right", render: (m) => <RowActions onEdit={() => setEditing(m)} onDelete={() => handleDelete(m)} /> },
  ];

  const hasFilters = statusFilter !== "all" || Boolean(search);

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader title="Members" description="Fan registry — subscribers, trialing followers, and top spenders with lifetime value." actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><UserPlus className="mr-1.5 h-4 w-4" />Add member</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search members..." className="w-full sm:w-64" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          {hasFilters ? <ClearFiltersButton onClick={() => { setStatusFilter("all"); setSearch(""); }} /> : null}
        </div>
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <DataTable columns={columns} data={filtered} getRowKey={(m) => m.id} onRowClick={setEditing} empty={<EmptyState icon={Users} title="No members yet" description={hasFilters ? "Try adjusting your filters." : "Members appear here once fans subscribe or follow."} action={<Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><UserPlus className="mr-1.5 h-4 w-4" />Add member</Button>} />} />
      )}
      {!loading && filtered.length > 0 ? <div className="text-xs text-text-secondary">Showing {filtered.length} of {rows.length} members</div> : null}
      <MemberDialog open={showCreate} onOpenChange={setShowCreate} title="Add member" submitLabel="Add member" onSubmit={handleCreate} />
      {editing ? <MemberDialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)} initial={editing} title={`Edit ${editing.fanName || "member"}`} submitLabel="Save changes" onSubmit={handleSave} /> : null}
    </MainScreenWrapper>
  );
}

export default MembersScreen;
