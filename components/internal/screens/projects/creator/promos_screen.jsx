"use client";

import React, { useMemo, useState } from "react";
import { Power, PowerOff, SlidersHorizontal, TicketPercent } from "lucide-react";
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
import { PROMO_KIND_META, statusFilterOptions, formatDate } from "./constants";
import { FilterDropdown, RowActions, ClearFiltersButton, useCreatorRows, CreateDialog, DateField, FieldRow, SelectField, TextField } from "./creator_kit";
import { listPromos, createPromo, updatePromo, deletePromo } from "@/lib/supabase/creator";

const KIND_FILTERS = [
  { value: "all", label: "All kinds" },
  ...Object.entries(PROMO_KIND_META).map(([value, m]) => ({ value, label: m.label })),
];

const KIND_OPTIONS = Object.entries(PROMO_KIND_META).map(([value, m]) => ({ value, label: m.label }));
const digits = (v) => v.replace(/[^0-9]/g, "");

function PromoDialog({ open, onOpenChange, initial, onSubmit, title, submitLabel }) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState("discount");
  const [percentOff, setPercentOff] = useState("20");
  const [duration, setDuration] = useState("1");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  React.useEffect(() => {
    if (!open) return;
    setCode(initial?.code ?? "");
    setKind(initial?.kind ?? "discount");
    setPercentOff(initial?.percentOff != null ? String(initial.percentOff) : "20");
    setDuration(initial ? String(initial.durationMonths) : "1");
    setMaxRedemptions(initial?.maxRedemptions != null ? String(initial.maxRedemptions) : "");
    setExpiresAt(initial?.expiresAt ? String(initial.expiresAt).slice(0, 10) : "");
  }, [initial, open]);
  const discount = kind === "discount";
  const durationField = (
    <TextField
      label={discount ? "Applies for (months)" : kind === "trial" ? "Trial length (months)" : "Free months"}
      value={duration}
      onChange={(v) => setDuration(digits(v).slice(0, 2))}
      inputMode="numeric"
      placeholder="1"
    />
  );
  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Trials, discounts and free months — gifting and acquisition levers."
      submitLabel={submitLabel}
      onSubmit={() =>
        onSubmit({
          code: code.trim(),
          kind,
          percentOff: discount ? Math.min(100, Math.max(1, Number(percentOff) || 0)) || null : null,
          durationMonths: Math.max(1, Number(duration) || 1),
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
          expiresAt: expiresAt || null,
        })
      }
    >
      <FieldRow>
        <TextField label="Code" value={code} onChange={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9-_]/g, ""))} placeholder="e.g. WELCOME20" />
        <SelectField label="Kind" value={kind} onChange={setKind} options={KIND_OPTIONS} />
      </FieldRow>
      {discount ? (
        <FieldRow>
          <TextField label="Percent off" value={percentOff} onChange={(v) => setPercentOff(digits(v).slice(0, 3))} inputMode="numeric" placeholder="20" />
          {durationField}
        </FieldRow>
      ) : (
        durationField
      )}
      <FieldRow>
        <TextField label="Max redemptions" value={maxRedemptions} onChange={(v) => setMaxRedemptions(digits(v))} inputMode="numeric" placeholder="Unlimited" />
        <DateField label="Expires" value={expiresAt} onChange={setExpiresAt} placeholder="Never" />
      </FieldRow>
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

  const pager = usePagination(filtered, { resetKey: `${search}|${kindFilter}` });

  const stats = useMemo(() => {
    const redemptions = rows.reduce((s, p) => s + p.redeemedCount, 0);
    return [
      { label: "Promo codes", value: String(rows.length), footer: `${rows.filter((p) => p.isActive).length} active` },
      { label: "Redemptions", value: String(redemptions), footer: "claimed by fans" },
      { label: "Trials", value: String(rows.filter((p) => p.kind === "trial").length), footer: "trial builders" },
      { label: "Free months", value: String(rows.filter((p) => p.kind === "free_month").length), footer: "gifting levers" },
    ];
  }, [rows]);

  const handleCreate = async (input) => {
    if (!input.code) return toast.error("Code is required");
    if (rows.some((p) => p.code === input.code)) return toast.error("That code already exists");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    setRows((prev) => [{ id, projectId, amountOffCents: null, redeemedCount: 0, isActive: true, createdAt: now, updatedAt: now, ...input }, ...prev]);
    setShowCreate(false);
    const created = await createPromo({ id, projectId, isActive: true, ...input });
    if (created) {
      setRows((prev) => prev.map((p) => (p.id === id ? created : p)));
      toast.success("Promo code created");
    } else {
      setRows((prev) => prev.filter((p) => p.id !== id));
      toast.error("Could not create promo (code may already exist)");
    }
  };

  const handleSave = async (input) => {
    if (!editing) return;
    if (!input.code) return toast.error("Code is required");
    const target = editing;
    const prev = rows;
    setRows((list) => list.map((p) => (p.id === target.id ? { ...p, ...input } : p)));
    setEditing(null);
    const saved = await updatePromo(target.id, input);
    if (!saved) {
      setRows(prev);
      toast.error("Could not save promo");
    } else {
      setRows((list) => list.map((p) => (p.id === target.id ? saved : p)));
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
    { key: "actions", header: "", align: "right", render: (p) => <RowActions extra={[{ icon: p.isActive ? PowerOff : Power, label: p.isActive ? "Pause" : "Activate", onSelect: () => handleToggle(p) }]} onEdit={() => setEditing(p)} onDelete={() => handleDelete(p)} /> },
  ];

  const hasFilters = kindFilter !== "all" || Boolean(search);

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Promo Codes & Perks" description="Discounts, trials, and gifted months — autopilot acquisition and win-backs." actions={<Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><TicketPercent className="h-4 w-4" />New promo</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={kindFilter} onValueChange={setKindFilter} options={KIND_FILTERS} placeholder="Kind" icon={SlidersHorizontal} />
          {hasFilters ? <ClearFiltersButton onClick={() => { setKindFilter("all"); setSearch(""); }} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search codes..." className="w-full sm:w-64" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" />
      ) : (
        <DataTable columns={columns} data={pager.pageItems} getRowKey={(p) => p.id} onRowClick={setEditing} empty={<div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={TicketPercent} title="No promo codes yet" description={hasFilters ? "Try adjusting your filters." : "Create a trial or discount to grow the funnel."} action={<Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><TicketPercent className="h-4 w-4" />New promo</Button>} /></div>} />
      )}
      {!loading ? <ListPagination {...pager} itemLabel="promos" /> : null}
      <PromoDialog open={showCreate} onOpenChange={setShowCreate} title="New promo code" submitLabel="Create promo" onSubmit={handleCreate} />
      {editing ? <PromoDialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)} initial={editing} title={`Edit ${editing.code}`} submitLabel="Save changes" onSubmit={handleSave} /> : null}
    </MainScreenWrapper>
  );
}

export default PromosScreen;
