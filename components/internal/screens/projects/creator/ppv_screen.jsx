"use client";

import React, { useMemo, useState } from "react";
import { Eye, Loader2, Lock, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader, StatsBar, SearchInput, StatusPill, EmptyState, DataTable, Toolbar,
} from "@/components/internal/shared/screen_kit";
import { PPV_STATUS_META, statusFilterOptions, formatMoney, formatDate, parseDollarsToCents } from "./constants";
import { FilterDropdown, RowActions, ClearFiltersButton, useCreatorRows, CreateDialog, TextField } from "./creator_kit";
import { listPpvPosts, createPpvPost, updatePpvPost, deletePpvPost } from "@/lib/supabase/creator";

const STATUS_FILTERS = statusFilterOptions(PPV_STATUS_META, "All statuses");

function PpvDialog({ open, onOpenChange, initial, onSubmit, title, submitLabel }) {
  const [postTitle, setPostTitle] = useState(initial?.title ?? "");
  const [price, setPrice] = useState(initial ? String((initial.priceCents / 100).toFixed(2)) : "5.00");
  const [teaser, setTeaser] = useState(initial?.teaserText ?? "");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  React.useEffect(() => {
    setPostTitle(initial?.title ?? "");
    setPrice(initial ? String((initial.priceCents / 100).toFixed(2)) : "5.00");
    setTeaser(initial?.teaserText ?? "");
    setStatus(initial?.status ?? "draft");
  }, [initial, open]);
  return (
    <CreateDialog open={open} onOpenChange={onOpenChange} title={title} description="Locked post or DM drop — teaser is free, the media unlocks on payment." submitLabel={submitLabel} onSubmit={() => onSubmit({ title: postTitle, priceCents: parseDollarsToCents(price), teaserText: teaser, status })}>
      <TextField label="Title" value={postTitle} onChange={setPostTitle} placeholder="e.g. Behind-the-scenes drop" />
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Unlock price (USD)" value={price} onChange={setPrice} placeholder="5.00" />
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Status</label>
          <FilterDropdown value={status} onValueChange={setStatus} options={Object.entries(PPV_STATUS_META).map(([value, m]) => ({ value, label: m.label }))} placeholder="Status" />
        </div>
      </div>
      <TextField label="Teaser text" value={teaser} onChange={setTeaser} placeholder="What makes fans unlock?" />
    </CreateDialog>
  );
}

export function PpvScreen({ projectId }) {
  const [rows, setRows, loading] = useCreatorRows(listPpvPosts, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((p) => p.title.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((p) => p.status === statusFilter);
    return r;
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const revenue = rows.reduce((s, p) => s + p.revenueCents, 0);
    const unlocks = rows.reduce((s, p) => s + p.unlockCount, 0);
    return [
      { label: "PPV posts", value: String(rows.length), footer: `${rows.filter((p) => p.status === "published").length} published` },
      { label: "Unlocks", value: String(unlocks), footer: "paid unlocks" },
      { label: "PPV revenue", value: formatMoney(revenue), footer: "gross from locks" },
      { label: "Avg lock", value: rows.length ? formatMoney(Math.round(rows.reduce((s, p) => s + p.priceCents, 0) / rows.length)) : formatMoney(0), footer: "per post" },
    ];
  }, [rows]);

  const handleCreate = async ({ title, priceCents, teaserText, status }) => {
    if (!title.trim()) return toast.error("Title is required");
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, title: title.trim(), teaserText, priceCents, currency: "usd", status, unlockCount: 0, revenueCents: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setRows((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const created = await createPpvPost({ id, projectId, title: title.trim(), teaserText, priceCents, status });
    if (created) {
      setRows((prev) => prev.map((p) => (p.id === id ? created : p)));
      toast.success("PPV post created");
    } else {
      setRows((prev) => prev.filter((p) => p.id !== id));
      toast.error("Could not create PPV post");
    }
  };

  const handleSave = async ({ title, priceCents, teaserText, status }) => {
    if (!editing) return;
    const prev = rows;
    setRows((list) => list.map((p) => (p.id === editing.id ? { ...p, title, priceCents, teaserText, status } : p)));
    setEditing(null);
    const saved = await updatePpvPost(editing.id, { title, priceCents, teaserText, status });
    if (!saved) {
      setRows(prev);
      toast.error("Could not save PPV post");
    } else {
      setRows((list) => list.map((p) => (p.id === editing.id ? saved : p)));
      toast.success("PPV post updated");
    }
  };

  const handlePublish = async (post) => {
    const next = post.status === "published" ? "archived" : "published";
    const prev = rows;
    setRows((list) => list.map((p) => (p.id === post.id ? { ...p, status: next } : p)));
    const saved = await updatePpvPost(post.id, { status: next });
    if (!saved) setRows(prev);
    else toast.success(next === "published" ? "PPV published" : "PPV archived");
  };

  const handleDelete = async (post) => {
    const prev = rows;
    setRows((list) => list.filter((p) => p.id !== post.id));
    const ok = await deletePpvPost(post.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete PPV post");
    } else toast.success("PPV post deleted");
  };

  const columns = [
    { key: "title", header: "Post", render: (p) => (<div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary"><Lock className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{p.title}</p><p className="truncate text-[11px] text-text-tertiary">{p.teaserText || "no teaser"}</p></div></div>) },
    { key: "price", header: "Lock", className: "tabular-nums text-xs", render: (p) => formatMoney(p.priceCents, p.currency) },
    { key: "unlocks", header: "Unlocks", className: "tabular-nums text-xs", render: (p) => `${p.unlockCount} · ${formatMoney(p.revenueCents)}` },
    { key: "status", header: "Status", render: (p) => <StatusPill status={p.status} map={PPV_STATUS_META} className="text-[10px]" /> },
    { key: "date", header: "Updated", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell", render: (p) => formatDate(p.updatedAt) },
    { key: "actions", header: "", align: "right", render: (p) => <RowActions onEdit={() => setEditing(p)} onDelete={() => handleDelete(p)} extra={null} /> },
  ];

  const hasFilters = statusFilter !== "all" || Boolean(search);

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader title="Pay-Per-View" description="OnlyFans-style locked posts — free teaser, paid unlock, per-post revenue." actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><Lock className="mr-1.5 h-4 w-4" />New PPV</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search PPV posts..." className="w-full sm:w-64" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          {hasFilters ? <ClearFiltersButton onClick={() => { setStatusFilter("all"); setSearch(""); }} /> : null}
        </div>
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <DataTable columns={columns} data={filtered} getRowKey={(p) => p.id} onRowClick={(p) => handlePublish(p)} empty={<EmptyState icon={Eye} title="No PPV posts yet" description={hasFilters ? "Try adjusting your filters." : "Lock your best content behind a pay-per-view price."} action={<Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><Lock className="mr-1.5 h-4 w-4" />New PPV</Button>} />} />
      )}
      {!loading && filtered.length > 0 ? <div className="text-xs text-text-secondary">Showing {filtered.length} of {rows.length} PPV posts · click a row to publish/archive</div> : null}
      <PpvDialog open={showCreate} onOpenChange={setShowCreate} title="New PPV post" submitLabel="Create PPV" onSubmit={handleCreate} />
      {editing ? <PpvDialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)} initial={editing} title={`Edit ${editing.title}`} submitLabel="Save changes" onSubmit={handleSave} /> : null}
    </MainScreenWrapper>
  );
}

export default PpvScreen;
