"use client";

import React, { useMemo, useState } from "react";
import { LockOpen, MessagesSquare, Send, SlidersHorizontal } from "lucide-react";
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
import { MSG_STATUS_META, statusFilterOptions, formatMoney, formatDate, parseDollarsToCents } from "./constants";
import { FilterDropdown, RowActions, ClearFiltersButton, useCreatorRows, CreateDialog, MoneyField, SelectField, TextAreaField } from "./creator_kit";
import { listPaidMessages, createPaidMessage, updatePaidMessage, deletePaidMessage, listMembers } from "@/lib/supabase/creator";

const STATUS_FILTERS = statusFilterOptions(MSG_STATUS_META, "All statuses");

function MessageDialog({ open, onOpenChange, members, onSubmit }) {
  const [memberId, setMemberId] = useState("broadcast");
  const [body, setBody] = useState("");
  const [price, setPrice] = useState("3.00");
  React.useEffect(() => {
    if (!open) return;
    setMemberId("broadcast");
    setBody("");
    setPrice("3.00");
  }, [open]);
  return (
    <CreateDialog open={open} onOpenChange={onOpenChange} title="New paid message" description="Mass DM or 1:1 locked message — fans pay to unlock the attachment." submitLabel="Send PPV message" onSubmit={() => onSubmit({ memberId, body, priceCents: parseDollarsToCents(price) })}>
      <SelectField
        label="Audience"
        value={memberId}
        onChange={setMemberId}
        options={[{ value: "broadcast", label: "Mass DM — all members" }, ...members.map((m) => ({ value: m.id, label: m.fanName || m.fanEmail || m.id.slice(0, 8) }))]}
      />
      <TextAreaField label="Message" value={body} onChange={setBody} placeholder="Teaser copy fans see before unlocking..." rows={3} />
      <MoneyField label="Unlock price (USD)" value={price} onChange={setPrice} placeholder="3.00" hint="Use 0 for a free message." />
    </CreateDialog>
  );
}

export function MessagesScreen({ projectId }) {
  const [allRows, setRows, loading] = useCreatorRows(listPaidMessages, projectId);
  // Fan replies belong to the Inbox chat, not the paid-message ledger.
  const rows = useMemo(() => allRows.filter((m) => m.direction !== "inbound"), [allRows]);
  const [members] = useCreatorRows(listMembers, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((m) => m.body.toLowerCase().includes(q) || (memberById.get(m.memberId)?.fanName ?? "").toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((m) => m.status === statusFilter);
    return r;
  }, [rows, search, statusFilter, memberById]);

  const pager = usePagination(filtered, { resetKey: `${search}|${statusFilter}` });

  const stats = useMemo(() => {
    const locked = rows.filter((m) => m.status === "locked").length;
    const unlocked = rows.filter((m) => m.status === "unlocked").length;
    const pipeline = rows.filter((m) => m.status === "locked").reduce((s, m) => s + m.priceCents, 0);
    return [
      { label: "Paid messages", value: String(rows.length), footer: `${locked} awaiting unlock` },
      { label: "Unlocked", value: String(unlocked), footer: `${rows.length ? Math.round((unlocked / rows.length) * 100) : 0}% conversion` },
      { label: "Locked value", value: formatMoney(pipeline), footer: "unsent revenue in inbox" },
      { label: "Mass drops", value: String(rows.filter((m) => !m.memberId).length), footer: "broadcast campaigns" },
    ];
  }, [rows]);

  const handleCreate = async ({ memberId, body, priceCents }) => {
    if (!body.trim()) return toast.error("Message copy is required");
    const id = crypto.randomUUID();
    const batchId = memberId === "broadcast" ? crypto.randomUUID() : null;
    const optimistic = { id, projectId, memberId: memberId === "broadcast" ? null : memberId, batchId, body: body.trim(), priceCents, currency: "usd", status: "locked", sentAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setRows((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const created = await createPaidMessage({ id, projectId, memberId: memberId === "broadcast" ? null : memberId, batchId, body: body.trim(), priceCents, status: "locked", sentAt: new Date().toISOString() });
    if (created) {
      setRows((prev) => prev.map((m) => (m.id === id ? created : m)));
      toast.success(memberId === "broadcast" ? "Mass DM sent" : "Paid message sent");
    } else {
      setRows((prev) => prev.filter((m) => m.id !== id));
      toast.error("Could not send message");
    }
  };

  const handleMarkUnlocked = async (msg) => {
    const prev = allRows;
    setRows((list) => list.map((m) => (m.id === msg.id ? { ...m, status: "unlocked", unlockedAt: new Date().toISOString() } : m)));
    const saved = await updatePaidMessage(msg.id, { status: "unlocked", unlockedAt: new Date().toISOString() });
    if (!saved) {
      setRows(prev);
      toast.error("Could not update message");
    } else toast.success("Marked unlocked");
  };

  const handleDelete = async (msg) => {
    const prev = allRows;
    setRows((list) => list.filter((m) => m.id !== msg.id));
    const ok = await deletePaidMessage(msg.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete message");
    } else toast.success("Message deleted");
  };

  const columns = [
    { key: "body", header: "Message", render: (m) => (<div className="min-w-0"><p className="max-w-[320px] truncate text-sm font-medium text-foreground">{m.body || "—"}</p><p className="text-[11px] text-text-tertiary">{m.memberId ? memberById.get(m.memberId)?.fanName || "1:1" : "Mass DM broadcast"}</p></div>) },
    { key: "price", header: "Lock", className: "tabular-nums text-xs", render: (m) => formatMoney(m.priceCents, m.currency) },
    { key: "status", header: "Status", render: (m) => <StatusPill status={m.status} map={MSG_STATUS_META} className="text-[10px]" /> },
    { key: "sent", header: "Sent", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell", render: (m) => formatDate(m.sentAt) },
    { key: "actions", header: "", align: "right", render: (m) => <RowActions onEdit={() => handleMarkUnlocked(m)} editLabel="Mark Unlocked" editIcon={LockOpen} onDelete={() => handleDelete(m)} /> },
  ];

  const hasFilters = statusFilter !== "all" || Boolean(search);

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Paid Messages" description="PPV in the inbox — mass drops and 1:1 locked DMs with unlock tracking." actions={<Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><Send className="h-4 w-4" />New message</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          {hasFilters ? <ClearFiltersButton onClick={() => { setStatusFilter("all"); setSearch(""); }} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search messages..." className="w-full sm:w-64" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" />
      ) : (
        <DataTable columns={columns} data={pager.pageItems} getRowKey={(m) => m.id} empty={<div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={MessagesSquare} title="No paid messages yet" description={hasFilters ? "Try adjusting your filters." : "Send a mass PPV drop to turn your inbox into revenue."} action={<Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><Send className="h-4 w-4" />New message</Button>} /></div>} />
      )}
      {!loading ? <ListPagination {...pager} itemLabel="messages" /> : null}
      <MessageDialog open={showCreate} onOpenChange={setShowCreate} members={members} onSubmit={handleCreate} />
    </MainScreenWrapper>
  );
}

export default MessagesScreen;
