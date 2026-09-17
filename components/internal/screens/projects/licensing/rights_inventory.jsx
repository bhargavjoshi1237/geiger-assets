"use client";

import { Button, Input, LogoLoading } from "@geiger/ui";
import React, { useMemo, useState } from "react";
import { ArrowUpDown, Scale, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
import {
  ScreenHeader, StatsBar, SearchInput, StatusPill, EmptyState, DataTable, Toolbar, Field,
} from "@/components/internal/shared/screen_kit";
import {
  RIGHT_STATUS_MAP, RIGHT_TYPE_MAP, RIGHT_STATUS_FILTER_OPTIONS, RIGHT_TYPE_FILTER_OPTIONS,
  SORT_OPTIONS, daysUntil, formatDate,
} from "./constants";
import {
  FilterDropdown, RowActions, ClearFiltersButton, useLicensingRows, CreateDialog,
  TextField, SelectField,
} from "./licensing_kit";
import { listRights, createRight, updateRight, softDeleteRight } from "@/lib/supabase/licensing";

const WINDOW_SOON_DAYS = 90;

const EMPTY_DRAFT = {
  holderName: "",
  title: "",
  rightType: "ownership",
  sharePercent: "100",
  territories: "",
  channels: "",
  media: "",
  windowStart: "",
  windowEnd: "",
  status: "active",
};

function RightDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const [draft, setDraft] = useState(initial ? {
    holderName: initial.holderName ?? "",
    title: initial.title ?? "",
    rightType: initial.rightType ?? "ownership",
    sharePercent: String(initial.sharePercent ?? 100),
    territories: initial.territories ?? "",
    channels: initial.channels ?? "",
    media: initial.media ?? "",
    windowStart: (initial.windowStart ?? "").slice(0, 10),
    windowEnd: (initial.windowEnd ?? "").slice(0, 10),
    status: initial.status ?? "active",
  } : EMPTY_DRAFT);
  React.useEffect(() => {
    if (!open) return;
    setDraft(initial ? {
      holderName: initial.holderName ?? "",
      title: initial.title ?? "",
      rightType: initial.rightType ?? "ownership",
      sharePercent: String(initial.sharePercent ?? 100),
      territories: initial.territories ?? "",
      channels: initial.channels ?? "",
      media: initial.media ?? "",
      windowStart: (initial.windowStart ?? "").slice(0, 10),
      windowEnd: (initial.windowEnd ?? "").slice(0, 10),
      status: initial.status ?? "active",
    } : EMPTY_DRAFT);
  }, [open, initial]);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit right" : "Record a right"}
      description="Who holds it, what it covers, the ownership share, and the window it applies to."
      submitLabel={editing ? "Save changes" : "Record right"}
      onSubmit={() => onSubmit(draft)}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Rights holder" value={draft.holderName} onChange={set("holderName")} placeholder="e.g. Studio North" />
        <TextField label="Title / work" value={draft.title} onChange={set("title")} placeholder="e.g. Summer catalog" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Right type" value={draft.rightType} onChange={set("rightType")} options={Object.entries(RIGHT_TYPE_MAP).map(([value, m]) => ({ value, label: m.label }))} />
        <TextField label="Share %" value={draft.sharePercent} onChange={set("sharePercent")} placeholder="100" />
        <SelectField label="Status" value={draft.status} onChange={set("status")} options={Object.entries(RIGHT_STATUS_MAP).map(([value, m]) => ({ value, label: m.label }))} />
      </div>
      <TextField label="Territories" value={draft.territories} onChange={set("territories")} placeholder="e.g. DE, AT, CH" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Channels" value={draft.channels} onChange={set("channels")} placeholder="e.g. streaming, broadcast" />
        <TextField label="Media" value={draft.media} onChange={set("media")} placeholder="e.g. video, stills" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Window start">
          <Input type="date" value={draft.windowStart} onChange={(e) => set("windowStart")(e.target.value)} className="border-border bg-surface-card text-foreground" />
        </Field>
        <Field label="Window end">
          <Input type="date" value={draft.windowEnd} onChange={(e) => set("windowEnd")(e.target.value)} className="border-border bg-surface-card text-foreground" />
        </Field>
      </div>
    </CreateDialog>
  );
}

export function RightsInventoryScreen({ projectId }) {
  const [rows, setRows, loading] = useLicensingRows(listRights, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortValue, setSortValue] = useState("updated-desc");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((t) => `${t.holderName} ${t.title} ${t.territories}`.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((t) => t.status === statusFilter);
    if (typeFilter !== "all") r = r.filter((t) => t.rightType === typeFilter);
    const [field, direction] = sortValue.split("-");
    r.sort((a, b) => {
      let cmp = 0;
      if (field === "updated") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
      else if (field === "name") cmp = a.holderName.localeCompare(b.holderName);
      return direction === "desc" ? -cmp : cmp;
    });
    return r;
  }, [rows, search, statusFilter, typeFilter, sortValue]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${statusFilter}|${typeFilter}|${sortValue}`,
  });

  const stats = useMemo(() => {
    const active = rows.filter((t) => t.status === "active");
    const avgShare = rows.length
      ? rows.reduce((s, t) => s + (Number(t.sharePercent) || 0), 0) / rows.length
      : 0;
    const windowsSoon = rows.filter((t) => {
      const d = daysUntil(t.windowEnd);
      return d !== null && d >= 0 && d <= WINDOW_SOON_DAYS;
    }).length;
    return [
      { label: "Rights", value: String(rows.length), footer: `${active.length} active` },
      { label: "Avg share", value: `${Math.round(avgShare)}%`, footer: "ownership held" },
      { label: "Windows ending", value: String(windowsSoon), footer: `within ${WINDOW_SOON_DAYS} days` },
      { label: "Disputed", value: String(rows.filter((t) => t.status === "disputed").length), footer: "needs review" },
    ];
  }, [rows]);

  const toPayload = (draft) => ({
    holderName: draft.holderName.trim(),
    title: draft.title.trim(),
    rightType: draft.rightType,
    sharePercent: Math.min(100, Math.max(0, Number(draft.sharePercent) || 0)),
    territories: draft.territories.trim(),
    channels: draft.channels.trim(),
    media: draft.media.trim(),
    windowStart: draft.windowStart || null,
    windowEnd: draft.windowEnd || null,
    status: draft.status,
  });

  const handleCreate = async (draft) => {
    if (!draft.holderName.trim()) return toast.error("Rights holder is required");
    if (!draft.title.trim()) return toast.error("Title is required");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic = { id, projectId, ...toPayload(draft), createdAt: now, updatedAt: now };
    setRows((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const created = await createRight({ id, projectId, ...toPayload(draft) });
    if (created) {
      setRows((prev) => prev.map((t) => (t.id === id ? created : t)));
      toast.success("Right recorded");
    } else {
      setRows((prev) => prev.filter((t) => t.id !== id));
      toast.error("Could not record right");
    }
  };

  const handleSave = async (draft) => {
    if (!editing) return;
    if (!draft.holderName.trim()) return toast.error("Rights holder is required");
    const prev = rows;
    const patch = toPayload(draft);
    setRows((list) => list.map((t) => (t.id === editing.id ? { ...t, ...patch } : t)));
    setEditing(null);
    const saved = await updateRight(editing.id, patch);
    if (!saved) {
      setRows(prev);
      toast.error("Could not save right");
    } else {
      setRows((list) => list.map((t) => (t.id === editing.id ? saved : t)));
      toast.success("Right updated");
    }
  };

  const handleDelete = async (right) => {
    const prev = rows;
    setRows((list) => list.filter((t) => t.id !== right.id));
    const ok = await softDeleteRight(right.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete right");
    } else toast.success("Right deleted");
  };

  const columns = [
    {
      key: "holder", header: "Rights holder",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{t.holderName || "—"}</p>
          <p className="truncate text-[11px] text-text-tertiary">{t.title || "Untitled"}</p>
        </div>
      ),
    },
    {
      key: "type", header: "Type",
      render: (t) => <StatusPill status={t.rightType} map={RIGHT_TYPE_MAP} className="text-[10px]" />,
    },
    {
      key: "share", header: "Share", align: "right", className: "tabular-nums text-xs",
      render: (t) => `${Number(t.sharePercent) || 0}%`,
    },
    {
      key: "scope", header: "Scope", className: "hidden text-xs text-text-secondary xl:table-cell", headClassName: "hidden xl:table-cell",
      render: (t) => [t.territories, t.channels].filter(Boolean).join(" · ") || "—",
    },
    {
      key: "window", header: "Window", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell",
      render: (t) => (t.windowEnd ? formatDate(t.windowEnd) : "Open-ended"),
    },
    {
      key: "status", header: "Status",
      render: (t) => <StatusPill status={t.status} map={RIGHT_STATUS_MAP} className="text-[10px]" />,
    },
    {
      key: "actions", header: "", align: "right",
      render: (t) => <RowActions onEdit={() => setEditing(t)} onDelete={() => handleDelete(t)} />,
    },
  ];

  const hasFilters = statusFilter !== "all" || typeFilter !== "all" || Boolean(search);
  const clearFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setSearch("");
  };

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="Rights Inventory"
        description="Record the rights the organization owns or controls — holders, shares, territories, channels, and windows."
        actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><Scale className="mr-1.5 h-4 w-4" />Record right</Button>}
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={RIGHT_STATUS_FILTER_OPTIONS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={typeFilter} onValueChange={setTypeFilter} options={RIGHT_TYPE_FILTER_OPTIONS} placeholder="Type" />
          <FilterDropdown value={sortValue} onValueChange={setSortValue} options={SORT_OPTIONS} placeholder="Sort" icon={ArrowUpDown} />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search holders, titles…" />
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(t) => t.id}
            onRowClick={setEditing}
            empty={(
              <div className="rounded-xl border border-border bg-surface-subtle">
                {rows.length === 0 ? (
                  <EmptyState icon={Scale} title="No rights recorded" description="Record the first right your organization owns or controls." action={<Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><Scale className="mr-1.5 h-4 w-4" />Record right</Button>} />
                ) : (
                  <EmptyState icon={Scale} title="No matching rights" description="No rights match the current search and filters." action={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>} />
                )}
              </div>
            )}
          />
          <ListPagination {...pager} itemLabel="rights" />
        </div>
      )}
      <RightDialog open={showCreate} onOpenChange={setShowCreate} onSubmit={handleCreate} />
      {editing ? (
        <RightDialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)} initial={editing} onSubmit={handleSave} />
      ) : null}
    </MainScreenWrapper>
  );
}

export default RightsInventoryScreen;
