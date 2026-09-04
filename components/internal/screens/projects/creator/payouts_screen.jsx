"use client";

import React, { useMemo, useState } from "react";
import { Landmark, Loader2, SlidersHorizontal, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader, StatsBar, SearchInput, StatusPill, EmptyState, DataTable, Toolbar,
} from "@/components/internal/shared/screen_kit";
import { PAYOUT_STATUS_META, statusFilterOptions, formatMoney, formatDate } from "./constants";
import { FilterDropdown, RowActions, ClearFiltersButton, useCreatorRows, CreateDialog, TextField } from "./creator_kit";
import { listPayouts, createPayout, updatePayout, deletePayout, listTips, listPpvPosts, listSubscriptions } from "@/lib/supabase/creator";

const STATUS_FILTERS = statusFilterOptions(PAYOUT_STATUS_META, "All statuses");

function PayoutDialog({ open, onOpenChange, onSubmit }) {
  const [destination, setDestination] = useState("");
  const [net, setNet] = useState("");
  React.useEffect(() => { setDestination(""); setNet(""); }, [open]);
  return (
    <CreateDialog open={open} onOpenChange={onOpenChange} title="New payout" description="Settle collected revenue — gross minus platform and processing fees." submitLabel="Create payout" onSubmit={() => onSubmit({ destination, netCents: Math.round(Number(net.replace(/[^0-9.]/g, "")) * 100) || 0 })}>
      <TextField label="Destination" value={destination} onChange={setDestination} placeholder="e.g. bank ••4242" />
      <TextField label="Net amount (USD)" value={net} onChange={setNet} placeholder="1,250.00" />
    </CreateDialog>
  );
}

export function PayoutsScreen({ projectId }) {
  const [rows, setRows, loading] = useCreatorRows(listPayouts, projectId);
  const [tips] = useCreatorRows(listTips, projectId);
  const [ppv] = useCreatorRows(listPpvPosts, projectId);
  const [subs] = useCreatorRows(listSubscriptions, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((p) => p.destination.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((p) => p.status === statusFilter);
    return r;
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const grossTips = tips.filter((t) => t.status === "succeeded").reduce((s, t) => s + t.amountCents, 0);
    const grossPpv = ppv.reduce((s, p) => s + p.revenueCents, 0);
    const gross = grossTips + grossPpv;
    const paidOut = rows.filter((p) => p.status === "paid").reduce((s, p) => s + p.netCents, 0);
    return [
      { label: "Gross collected", value: formatMoney(gross), footer: "tips + PPV" },
      { label: "Paid out", value: formatMoney(paidOut), footer: "settled to bank" },
      { label: "Pending", value: String(rows.filter((p) => p.status === "pending").length + rows.filter((p) => p.status === "processing").length), footer: "awaiting settlement" },
      { label: "Active subs", value: String(subs.filter((s) => s.status === "active").length), footer: "recurring base" },
    ];
  }, [rows, tips, ppv, subs]);

  const handleCreate = async ({ destination, netCents }) => {
    if (!destination.trim()) return toast.error("Destination is required");
    const id = crypto.randomUUID();
    const fees = Math.round(netCents * 0.1);
    const optimistic = { id, projectId, destination: destination.trim(), grossCents: netCents + fees, feesCents: fees, netCents, status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setRows((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const created = await createPayout({ id, projectId, destination: destination.trim(), grossCents: netCents + fees, feesCents: fees, netCents, status: "pending" });
    if (created) {
      setRows((prev) => prev.map((p) => (p.id === id ? created : p)));
      toast.success("Payout created");
    } else {
      setRows((prev) => prev.filter((p) => p.id !== id));
      toast.error("Could not create payout");
    }
  };

  const handleMarkPaid = async (payout) => {
    const prev = rows;
    setRows((list) => list.map((p) => (p.id === payout.id ? { ...p, status: "paid", paidAt: new Date().toISOString() } : p)));
    const saved = await updatePayout(payout.id, { status: "paid", paidAt: new Date().toISOString() });
    if (!saved) {
      setRows(prev);
      toast.error("Could not update payout");
    } else toast.success("Payout marked paid");
  };

  const handleDelete = async (payout) => {
    const prev = rows;
    setRows((list) => list.filter((p) => p.id !== payout.id));
    const ok = await deletePayout(payout.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete payout");
    } else toast.success("Payout deleted");
  };

  const columns = [
    { key: "dest", header: "Destination", render: (p) => (<div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary"><Landmark className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{p.destination || "—"}</p><p className="text-[11px] text-text-tertiary">{formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</p></div></div>) },
    { key: "gross", header: "Gross", align: "right", className: "tabular-nums text-xs", render: (p) => formatMoney(p.grossCents) },
    { key: "net", header: "Net", align: "right", className: "tabular-nums text-xs", render: (p) => formatMoney(p.netCents) },
    { key: "status", header: "Status", render: (p) => <StatusPill status={p.status} map={PAYOUT_STATUS_META} className="text-[10px]" /> },
    { key: "actions", header: "", align: "right", render: (p) => <RowActions onEdit={() => handleMarkPaid(p)} onDelete={() => handleDelete(p)} /> },
  ];

  const hasFilters = statusFilter !== "all" || Boolean(search);

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader title="Payouts" description="Revenue settlement — gross, fees, net, and payout status per period." actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><Wallet className="mr-1.5 h-4 w-4" />New payout</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search payouts..." className="w-full sm:w-64" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          {hasFilters ? <ClearFiltersButton onClick={() => { setStatusFilter("all"); setSearch(""); }} /> : null}
        </div>
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <DataTable columns={columns} data={filtered} getRowKey={(p) => p.id} onRowClick={handleMarkPaid} empty={<EmptyState icon={Wallet} title="No payouts yet" description={hasFilters ? "Try adjusting your filters." : "Settle collected revenue to a destination."} action={<Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><Wallet className="mr-1.5 h-4 w-4" />New payout</Button>} />} />
      )}
      {!loading && filtered.length > 0 ? <div className="text-xs text-text-secondary">Showing {filtered.length} of {rows.length} payouts · click a row to mark paid</div> : null}
      <PayoutDialog open={showCreate} onOpenChange={setShowCreate} onSubmit={handleCreate} />
    </MainScreenWrapper>
  );
}

export default PayoutsScreen;
