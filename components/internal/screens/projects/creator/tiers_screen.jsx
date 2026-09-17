"use client";

import { Button, LogoLoading } from "@geiger/ui";
import React, { useMemo, useState } from "react";
import { ArrowUpDown, BadgePlus, Layers, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
import {
  ScreenHeader, StatsBar, SearchInput, StatusPill, EmptyState, DataTable, Toolbar,
} from "@/components/internal/shared/screen_kit";
import { TIER_STATUS_META, INTERVAL_OPTIONS, statusFilterOptions, formatMoney, formatDate, parseDollarsToCents } from "./constants";
import { FilterDropdown, RowActions, ClearFiltersButton, useCreatorRows, CreateDialog, TextField } from "./creator_kit";
import { listTiers, createTier, updateTier, deleteTier } from "@/lib/supabase/creator";

const STATUS_FILTERS = statusFilterOptions(TIER_STATUS_META, "All statuses");

const SORT_OPTIONS = [
  { value: "updated-desc", label: "Recently updated" },
  { value: "updated-asc", label: "Least recently updated" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "price-desc", label: "Highest price" },
  { value: "price-asc", label: "Lowest price" },
];

function TierDialog({ open, onOpenChange, initial, onSubmit, submitLabel, title }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? String((initial.priceCents / 100).toFixed(2)) : "9.99");
  const [interval, setInterval] = useState(initial?.interval ?? "month");
  const [description, setDescription] = useState(initial?.description ?? "");
  React.useEffect(() => {
    setName(initial?.name ?? "");
    setPrice(initial ? String((initial.priceCents / 100).toFixed(2)) : "9.99");
    setInterval(initial?.interval ?? "month");
    setDescription(initial?.description ?? "");
  }, [initial, open]);
  return (
    <CreateDialog open={open} onOpenChange={onOpenChange} title={title} description="Patreon-style recurring tier with perks and billing interval." submitLabel={submitLabel} onSubmit={() => onSubmit({ name, priceCents: parseDollarsToCents(price), interval, description })}>
      <TextField label="Tier name" value={name} onChange={setName} placeholder="e.g. Gold" />
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Price (USD)" value={price} onChange={setPrice} placeholder="9.99" />
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Interval</label>
          <FilterDropdown value={interval} onValueChange={setInterval} options={INTERVAL_OPTIONS} placeholder="Interval" />
        </div>
      </div>
      <TextField label="Description" value={description} onChange={setDescription} placeholder="What do members get?" />
    </CreateDialog>
  );
}

export function TiersScreen({ projectId }) {
  const [rows, setRows, loading] = useCreatorRows(listTiers, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortValue, setSortValue] = useState("updated-desc");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((t) => (t.isActive ? "active" : "archived") === statusFilter);
    const [field, direction] = sortValue.split("-");
    r.sort((a, b) => {
      let cmp = 0;
      if (field === "updated") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
      else if (field === "name") cmp = a.name.localeCompare(b.name);
      else if (field === "price") cmp = a.priceCents - b.priceCents;
      return direction === "desc" ? -cmp : cmp;
    });
    return r;
  }, [rows, search, statusFilter, sortValue]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${statusFilter}|${sortValue}`,
  });

  const stats = useMemo(() => {
    const active = rows.filter((t) => t.isActive);
    const paid = active.filter((t) => !t.isFree && t.priceCents > 0);
    const avg = paid.length ? Math.round(paid.reduce((s, t) => s + t.priceCents, 0) / paid.length) : 0;
    return [
      { label: "Tiers", value: String(rows.length), footer: `${active.length} active` },
      { label: "Paid tiers", value: String(paid.length), footer: "recurring revenue" },
      { label: "Avg price", value: formatMoney(avg), footer: "per paid tier" },
      { label: "Free tiers", value: String(active.filter((t) => t.isFree || t.priceCents === 0).length), footer: "funnel entry" },
    ];
  }, [rows]);

  const handleCreate = async ({ name, priceCents, interval, description }) => {
    if (!name.trim()) return toast.error("Tier name is required");
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, name: name.trim(), description, priceCents, currency: "usd", interval, isFree: priceCents === 0, isActive: true, position: rows.length, perks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setRows((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const created = await createTier({ id, projectId, name: name.trim(), description, priceCents, interval, isActive: true, position: rows.length });
    if (created) {
      setRows((prev) => prev.map((t) => (t.id === id ? created : t)));
      toast.success("Tier created");
    } else {
      setRows((prev) => prev.filter((t) => t.id !== id));
      toast.error("Could not create tier");
    }
  };

  const handleSave = async ({ name, priceCents, interval, description }) => {
    if (!editing) return;
    const prev = rows;
    setRows((list) => list.map((t) => (t.id === editing.id ? { ...t, name, priceCents, interval, description, isFree: priceCents === 0 } : t)));
    setEditing(null);
    const saved = await updateTier(editing.id, { name, priceCents, interval, description });
    if (!saved) {
      setRows(prev);
      toast.error("Could not save tier");
    } else {
      setRows((list) => list.map((t) => (t.id === editing.id ? saved : t)));
      toast.success("Tier updated");
    }
  };

  const handleDelete = async (tier) => {
    const prev = rows;
    setRows((list) => list.filter((t) => t.id !== tier.id));
    const ok = await deleteTier(tier.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete tier");
    } else toast.success("Tier deleted");
  };

  const columns = [
    { key: "name", header: "Tier", render: (t) => (<div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{t.name}</p><p className="truncate text-[11px] text-text-tertiary">{t.description || "—"}</p></div>) },
    { key: "price", header: "Price", className: "tabular-nums text-xs", render: (t) => (t.isFree || t.priceCents === 0 ? "Free" : `${formatMoney(t.priceCents, t.currency)} / ${t.interval === "year" ? "yr" : "mo"}`) },
    { key: "status", header: "Status", render: (t) => <StatusPill status={t.isActive ? "active" : "archived"} map={TIER_STATUS_META} className="text-[10px]" /> },
    { key: "updated", header: "Updated", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell", render: (t) => formatDate(t.updatedAt) },
    { key: "actions", header: "", align: "right", render: (t) => <RowActions onEdit={() => setEditing(t)} onDelete={() => handleDelete(t)} /> },
  ];

  const hasFilters = statusFilter !== "all" || Boolean(search);

  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
  };

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader title="Membership Tiers" description="Patreon-style recurring tiers — free funnel entry plus paid plans with perks." actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><BadgePlus className="mr-1.5 h-4 w-4" />New tier</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={sortValue} onValueChange={setSortValue} options={SORT_OPTIONS} placeholder="Sort" icon={ArrowUpDown} />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tiers..." />
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable columns={columns} data={pager.pageItems} getRowKey={(t) => t.id} onRowClick={setEditing} empty={<div className="rounded-xl border border-border bg-surface-subtle">{rows.length === 0 ? (<EmptyState icon={Layers} title="No tiers yet" description="Create your first membership tier to start recurring revenue." action={<Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><BadgePlus className="mr-1.5 h-4 w-4" />New tier</Button>} />) : (<EmptyState icon={Layers} title="No matching tiers" description="No tiers matches the current search and filter." action={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>} />)}</div>} />
          <ListPagination {...pager} itemLabel="tiers" />
        </div>
      )}
      <TierDialog open={showCreate} onOpenChange={setShowCreate} title="New tier" submitLabel="Create tier" onSubmit={handleCreate} />
      {editing ? (
        <TierDialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)} initial={editing} title={`Edit ${editing.name}`} submitLabel="Save changes" onSubmit={handleSave} />
      ) : null}
    </MainScreenWrapper>
  );
}

export default TiersScreen;
