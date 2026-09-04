"use client";

import React, { useMemo, useState } from "react";
import { Loader2, SlidersHorizontal, TicketPercent } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader, StatsBar, SearchInput, StatusPill, EmptyState, DataTable, Toolbar,
} from "@/components/internal/shared/screen_kit";
import { PROMO_KIND_META, statusFilterOptions, formatDate } from "./constants";
import { FilterDropdown, RowActions, ClearFiltersButton, useCreatorRows, CreateDialog, TextField } from "./creator_kit";
import { listPromos, createPromo, updatePromo, deletePromo } from "@/lib/supabase/creator";

const KIND_FILTERS = [
  { value: "all", label: "All kinds" },
  ...Object.entries(PROMO_KIND_META).map(([value, m]) => ({ value, label: m.label })),
];

function PromoDialog({ open, onOpenChange, initial, onSubmit, title, submitLabel }) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "discount");
  const [percentOff, setPercentOff] = useState(initial?.percentOff != null ? String(initial.percentOff) : "20");
  const [duration, setDuration] = useState(initial ? String(initial.durationMonths) : "1");
  React.useEffect(() => {
    setCode(initial?.code ?? "");
    setKind(initial?.kind ?? "discount");
    setPercentOff(initial?.percentOff != null ? String(initial.percentOff) : "20");
    setDuration(initial ? String(initial.durationMonths) : "1");
  }, [initial, open]);
  return (
    <CreateDialog open={open} onOpenChange={onOpenChange} title={title} description="Trials, discounts, and free months — gifting and autopilot growth levers." submitLabel={submitLabel} onSubmit={() => onSubmit({ code, kind, percentOff: Number(percentOff) || null, durationMonths: Number(duration) || 1 })}>
      <TextField label="Code" value={code} onChange={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9-_]/g, ""))} placeholder="e.g. WELCOME20" />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Kind</label>
          <FilterDropdown value={kind} onValueChange={setKind} options={Object.entries(PROMO_KIND_META).map(([value, m]) => ({ value, label: m.label }))} placeholder="Kind" />
        </div>
        <TextField label="Percent off" value={percentOff} onChange={setPercentOff} placeholder="20" />
      </div>
      <TextField label="Duration (months)" value={duration} onChange={setDuration} placeholder="1" />
    </CreateDialog>
  );
}

export function PromosScreen({ projectId }) {
  const [rows, setRows, loading] = useCreatorRows(listPromos, projectId);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((p) => p.code.toLowerCase().includes(q));
    }
    if (kindFilter !== "all") r = r.filter((p) => p.kind === kindFilter);
    return r;
  }, [rows, search, kindFilter]);

  const stats = useMemo(() => {
    const redemptions = rows.reduce((s, p) => s + p.redeemedCount, 0);
    return [
      { label: "Promo codes", value: String(rows.length), footer: `${rows.filter((p) => p.isActive).length} active` },
      { label: "Redemptions", value: String(redemptions), footer: "claimed by fans" },
      { label: "Trials", value: String(rows.filter((p) => p.kind === "trial").length), footer: "trial builders" },
      { label: "Free months", value: String(rows.filter((p) => p.kind === "free_month").length), footer: "gifting levers" },
    ];
  }, [rows]);

  const handleCreate = async ({ code, kind, percentOff, durationMonths }) => {
    if (!code.trim()) return toast.error("Code is required");
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, code: code.trim(), kind, percentOff, amountOffCents: null, durationMonths, maxRedemptions: null, redeemedCount: 0, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setRows((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const created = await createPromo({ id, projectId, code: code.trim(), kind, percentOff, durationMonths });
    if (created) {
      setRows((prev) => prev.map((p) => (p.id === id ? created : p)));
      toast.success("Promo code created");
    } else {
      setRows((prev) => prev.filter((p) => p.id !== id));
      toast.error("Could not create promo (code may already exist)");
    }
  };

  const handleSave = async ({ code, kind, percentOff, durationMonths }) => {
    if (!editing) return;
    const prev = rows;
    setRows((list) => list.map((p) => (p.id === editing.id ? { ...p, code, kind, percentOff, durationMonths } : p)));
    setEditing(null);
    const saved = await updatePromo(editing.id, { code, kind, percentOff, durationMonths });
    if (!saved) {
      setRows(prev);
      toast.error("Could not save promo");
    } else {
      setRows((list) => list.map((p) => (p.id === editing.id ? saved : p)));
      toast.success("Promo updated");
    }
  };

  const handleToggle = async (promo) => {
    const prev = rows;
    setRows((list) => list.map((p) => (p.id === promo.id ? { ...p, isActive: !p.isActive } : p)));
    const saved = await updatePromo(promo.id, { isActive: !promo.isActive });
    if (!saved) setRows(prev);
    else toast.success(promo.isActive ? "Promo paused" : "Promo activated");
  };

  const handleDelete = async (promo) => {
    const prev = rows;
    setRows((list) => list.filter((p) => p.id !== promo.id));
    const ok = await deletePromo(promo.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete promo");
    } else toast.success("Promo deleted");
  };

  const columns = [
    { key: "code", header: "Code", render: (p) => (<div className="min-w-0"><p className="font-mono text-sm font-semibold text-foreground">{p.code}</p><p className="text-[11px] text-text-tertiary">{p.percentOff ? `${p.percentOff}% off` : p.kind === "free_month" ? "free month" : "trial"} · {p.durationMonths} mo</p></div>) },
    { key: "kind", header: "Kind", render: (p) => <StatusPill status={p.kind} map={PROMO_KIND_META} className="text-[10px]" /> },
    { key: "redeemed", header: "Claimed", className: "tabular-nums text-xs", render: (p) => `${p.redeemedCount}${p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""}` },
    { key: "status", header: "Status", className: "text-xs", render: (p) => (p.isActive ? "Active" : "Paused") },
    { key: "date", header: "Updated", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell", render: (p) => formatDate(p.updatedAt) },
    { key: "actions", header: "", align: "right", render: (p) => <RowActions onEdit={() => setEditing(p)} onDelete={() => handleDelete(p)} /> },
  ];

  const hasFilters = kindFilter !== "all" || Boolean(search);

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader title="Promo Codes & Perks" description="Discounts, trials, and gifted months — autopilot acquisition and win-backs." actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><TicketPercent className="mr-1.5 h-4 w-4" />New promo</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search codes..." className="w-full sm:w-64" />
          <FilterDropdown value={kindFilter} onValueChange={setKindFilter} options={KIND_FILTERS} placeholder="Kind" icon={SlidersHorizontal} />
          {hasFilters ? <ClearFiltersButton onClick={() => { setKindFilter("all"); setSearch(""); }} /> : null}
        </div>
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <DataTable columns={columns} data={filtered} getRowKey={(p) => p.id} onRowClick={handleToggle} empty={<EmptyState icon={TicketPercent} title="No promo codes yet" description={hasFilters ? "Try adjusting your filters." : "Create a trial or discount to grow the funnel."} action={<Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><TicketPercent className="mr-1.5 h-4 w-4" />New promo</Button>} />} />
      )}
      {!loading && filtered.length > 0 ? <div className="text-xs text-text-secondary">Showing {filtered.length} of {rows.length} promos · click a row to pause/resume</div> : null}
      <PromoDialog open={showCreate} onOpenChange={setShowCreate} title="New promo code" submitLabel="Create promo" onSubmit={handleCreate} />
      {editing ? <PromoDialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)} initial={editing} title={`Edit ${editing.code}`} submitLabel="Save changes" onSubmit={handleSave} /> : null}
    </MainScreenWrapper>
  );
}

export default PromosScreen;
