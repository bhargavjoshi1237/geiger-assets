"use client";

import { Button, DropdownMenuItem, Input, LogoLoading } from "@geiger/ui";
import React, { useMemo, useState } from "react";
import { ArrowUpDown, Coins, SlidersHorizontal } from "lucide-react";
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
  REVENUE_TYPE_MAP, REVENUE_STATUS_MAP, REVENUE_TYPE_FILTER_OPTIONS, REVENUE_STATUS_FILTER_OPTIONS,
  formatMoney, formatDate, formatPercent,
  royaltyOwedCents, orgShareCents, guaranteeRemainingCents,
} from "./constants";
import {
  FilterDropdown, RowActions, ClearFiltersButton, useLicensingRows, CreateDialog,
  TextField, SelectField,
} from "./licensing_kit";
import { listRevenues, createRevenue, updateRevenue, softDeleteRevenue } from "@/lib/supabase/licensing";

const SORT_OPTIONS = [
  { value: "gross-desc", label: "Largest gross" },
  { value: "gross-asc", label: "Smallest gross" },
  { value: "updated-desc", label: "Recently updated" },
  { value: "name-asc", label: "Asset A–Z" },
];

const NEXT_STATUS = { pending: "collected", collected: "distributed" };
const NEXT_STATUS_LABEL = { pending: "Mark collected", collected: "Mark distributed" };

function RevenueDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const seed = (row) => ({
    assetName: row?.assetName ?? "",
    licenseeName: row?.licenseeName ?? "",
    revenueType: row?.revenueType ?? "license",
    gross: row ? (Number(row.grossCents ?? 0) / 100).toFixed(2) : "",
    royaltyRate: row ? String(row.royaltyRatePercent ?? "") : "",
    share: row ? String(row.sharePercent ?? 100) : "100",
    guarantee: row ? (Number(row.minimumGuaranteeCents ?? 0) / 100).toFixed(2) : "",
    recouped: row ? (Number(row.recoupedCents ?? 0) / 100).toFixed(2) : "",
    periodStart: (row?.periodStart ?? "").slice(0, 10),
    periodEnd: (row?.periodEnd ?? "").slice(0, 10),
    status: row?.status ?? "pending",
  });
  const [draft, setDraft] = useState(() => seed(initial));
  React.useEffect(() => {
    if (open) setDraft(seed(initial));
  }, [open, initial]);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit revenue" : "Record revenue"}
      description="Asset-level income — license fees and royalties with rates, shares, guarantees, and recoupment."
      submitLabel={editing ? "Save changes" : "Record revenue"}
      onSubmit={() => onSubmit(draft)}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Asset" value={draft.assetName} onChange={set("assetName")} placeholder="e.g. Hero image v3" />
        <TextField label="Licensee" value={draft.licenseeName} onChange={set("licenseeName")} placeholder="e.g. Acme Media" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Type" value={draft.revenueType} onChange={set("revenueType")} options={Object.entries(REVENUE_TYPE_MAP).map(([value, m]) => ({ value, label: m.label }))} />
        <TextField label="Gross (USD)" value={draft.gross} onChange={set("gross")} placeholder="0.00" />
        <SelectField label="Status" value={draft.status} onChange={set("status")} options={Object.entries(REVENUE_STATUS_MAP).map(([value, m]) => ({ value, label: m.label }))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Royalty rate %" value={draft.royaltyRate} onChange={set("royaltyRate")} placeholder="e.g. 12.5" hint="Royalties only — leave blank for flat fees." />
        <TextField label="Org share %" value={draft.share} onChange={set("share")} placeholder="100" hint="Share of the royalty kept by the organization." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Minimum guarantee (USD)" value={draft.guarantee} onChange={set("guarantee")} placeholder="0.00" />
        <TextField label="Recouped (USD)" value={draft.recouped} onChange={set("recouped")} placeholder="0.00" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Period start">
          <Input type="date" value={draft.periodStart} onChange={(e) => set("periodStart")(e.target.value)} className="border-border bg-surface-card text-foreground" />
        </Field>
        <Field label="Period end">
          <Input type="date" value={draft.periodEnd} onChange={(e) => set("periodEnd")(e.target.value)} className="border-border bg-surface-card text-foreground" />
        </Field>
      </div>
    </CreateDialog>
  );
}

export function RevenueRoyaltiesScreen({ projectId }) {
  const [rows, setRows, loading] = useLicensingRows(listRevenues, projectId);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortValue, setSortValue] = useState("gross-desc");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((t) => `${t.assetName} ${t.licenseeName}`.toLowerCase().includes(q));
    }
    if (typeFilter !== "all") r = r.filter((t) => t.revenueType === typeFilter);
    if (statusFilter !== "all") r = r.filter((t) => t.status === statusFilter);
    const [field, direction] = sortValue.split("-");
    r.sort((a, b) => {
      let cmp = 0;
      if (field === "gross") cmp = a.grossCents - b.grossCents;
      else if (field === "updated") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
      else if (field === "name") cmp = a.assetName.localeCompare(b.assetName);
      return direction === "desc" ? -cmp : cmp;
    });
    return r;
  }, [rows, search, typeFilter, statusFilter, sortValue]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${typeFilter}|${statusFilter}|${sortValue}`,
  });

  const stats = useMemo(() => {
    const gross = rows.reduce((s, t) => s + (t.grossCents ?? 0), 0);
    const owed = rows.reduce(
      (s, t) => s + (t.revenueType === "royalty" ? royaltyOwedCents(t) : t.grossCents ?? 0),
      0,
    );
    const guarantees = rows.reduce((s, t) => s + (t.minimumGuaranteeCents ?? 0), 0);
    const recouped = rows.reduce((s, t) => s + (t.recoupedCents ?? 0), 0);
    return [
      { label: "Gross income", value: formatMoney(gross), footer: "license + royalty" },
      { label: "Due", value: formatMoney(owed), footer: "fees + royalties owed" },
      { label: "Guarantees", value: formatMoney(guarantees), footer: "minimums promised" },
      { label: "Recouped", value: formatMoney(recouped), footer: "against guarantees" },
    ];
  }, [rows]);

  const parseDollars = (v) => Math.max(0, Math.round(Number(String(v ?? "").replace(/[^0-9.]/g, "")) * 100) || 0);

  const toPayload = (draft) => ({
    assetName: draft.assetName.trim(),
    licenseeName: draft.licenseeName.trim(),
    revenueType: draft.revenueType,
    grossCents: parseDollars(draft.gross),
    royaltyRatePercent: Number(draft.royaltyRate) || 0,
    sharePercent: draft.share === "" ? 100 : Number(draft.share) || 0,
    minimumGuaranteeCents: parseDollars(draft.guarantee),
    recoupedCents: parseDollars(draft.recouped),
    periodStart: draft.periodStart || null,
    periodEnd: draft.periodEnd || null,
    status: draft.status,
  });

  const handleCreate = async (draft) => {
    if (!draft.assetName.trim()) return toast.error("Asset is required");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic = { id, projectId, licenseId: null, ...toPayload(draft), createdAt: now, updatedAt: now };
    setRows((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const created = await createRevenue({ id, projectId, ...toPayload(draft) });
    if (created) {
      setRows((prev) => prev.map((t) => (t.id === id ? created : t)));
      toast.success("Revenue recorded");
    } else {
      setRows((prev) => prev.filter((t) => t.id !== id));
      toast.error("Could not record revenue");
    }
  };

  const handleSave = async (draft) => {
    if (!editing) return;
    if (!draft.assetName.trim()) return toast.error("Asset is required");
    const prev = rows;
    const patch = toPayload(draft);
    setRows((list) => list.map((t) => (t.id === editing.id ? { ...t, ...patch } : t)));
    setEditing(null);
    const saved = await updateRevenue(editing.id, patch);
    if (!saved) {
      setRows(prev);
      toast.error("Could not save revenue");
    } else {
      setRows((list) => list.map((t) => (t.id === editing.id ? saved : t)));
      toast.success("Revenue updated");
    }
  };

  const handleAdvance = async (revenue) => {
    const next = NEXT_STATUS[revenue.status];
    if (!next) return;
    const prev = rows;
    setRows((list) => list.map((t) => (t.id === revenue.id ? { ...t, status: next } : t)));
    const saved = await updateRevenue(revenue.id, { status: next });
    if (!saved) {
      setRows(prev);
      toast.error("Could not update status");
    } else toast.success(`Marked ${next}`);
  };

  const handleDelete = async (revenue) => {
    const prev = rows;
    setRows((list) => list.filter((t) => t.id !== revenue.id));
    const ok = await softDeleteRevenue(revenue.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete revenue");
    } else toast.success("Revenue deleted");
  };

  const columns = [
    {
      key: "asset", header: "Asset",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{t.assetName || "—"}</p>
          <p className="truncate text-[11px] text-text-tertiary">
            {t.licenseeName || "No licensee"}{t.periodStart || t.periodEnd ? ` · ${formatDate(t.periodStart)} → ${formatDate(t.periodEnd)}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "type", header: "Type",
      render: (t) => <StatusPill status={t.revenueType} map={REVENUE_TYPE_MAP} className="text-[10px]" />,
    },
    {
      key: "gross", header: "Gross", align: "right", className: "tabular-nums text-xs",
      render: (t) => formatMoney(t.grossCents),
    },
    {
      key: "due", header: "Due", align: "right", className: "tabular-nums text-xs",
      render: (t) => {
        if (t.revenueType === "royalty") {
          return `${formatMoney(royaltyOwedCents(t))} · ${formatPercent(t.royaltyRatePercent)}`;
        }
        return formatMoney(t.grossCents);
      },
    },
    {
      key: "recoup", header: "Guarantee", className: "hidden text-xs xl:table-cell", headClassName: "hidden xl:table-cell",
      render: (t) => {
        const guarantee = t.minimumGuaranteeCents ?? 0;
        if (!guarantee) return <span className="text-text-tertiary">—</span>;
        const recouped = Math.min(t.recoupedCents ?? 0, guarantee);
        const pct = Math.round((recouped / guarantee) * 100);
        return (
          <div className="flex min-w-36 flex-col gap-1">
            <span className="tabular-nums text-text-secondary">
              {formatMoney(recouped)} / {formatMoney(guarantee)}
            </span>
            <span className="h-1 overflow-hidden rounded-full bg-surface-active">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </span>
          </div>
        );
      },
    },
    {
      key: "remaining", header: "Left to recoup", align: "right", className: "hidden text-xs tabular-nums lg:table-cell", headClassName: "hidden lg:table-cell",
      render: (t) => ((t.minimumGuaranteeCents ?? 0) ? formatMoney(guaranteeRemainingCents(t)) : "—"),
    },
    {
      key: "org", header: "Org share", align: "right", className: "hidden text-xs tabular-nums lg:table-cell", headClassName: "hidden lg:table-cell",
      render: (t) => (t.revenueType === "royalty" ? formatMoney(orgShareCents(t)) : "—"),
    },
    {
      key: "status", header: "Status",
      render: (t) => <StatusPill status={t.status} map={REVENUE_STATUS_MAP} className="text-[10px]" />,
    },
    {
      key: "actions", header: "", align: "right",
      render: (t) => (
        <RowActions
          onEdit={() => setEditing(t)}
          onDelete={() => handleDelete(t)}
          extra={NEXT_STATUS[t.status] ? (
            <DropdownMenuItem className="cursor-pointer text-xs focus:bg-surface-hover" onClick={() => handleAdvance(t)}>
              <Coins className="mr-2 h-3.5 w-3.5" /> {NEXT_STATUS_LABEL[t.status]}
            </DropdownMenuItem>
          ) : null}
        />
      ),
    },
  ];

  const hasFilters = typeFilter !== "all" || statusFilter !== "all" || Boolean(search);
  const clearFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="Revenue & Royalties"
        description="Asset-level income — license fees, royalty rates and shares, minimum guarantees, and recoupment."
        actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><Coins className="mr-1.5 h-4 w-4" />Record revenue</Button>}
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={typeFilter} onValueChange={setTypeFilter} options={REVENUE_TYPE_FILTER_OPTIONS} placeholder="Type" icon={SlidersHorizontal} />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={REVENUE_STATUS_FILTER_OPTIONS} placeholder="Status" />
          <FilterDropdown value={sortValue} onValueChange={setSortValue} options={SORT_OPTIONS} placeholder="Sort" icon={ArrowUpDown} />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search assets, licensees…" />
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
                  <EmptyState icon={Coins} title="No revenue yet" description="Record license income or a royalty statement against an asset." action={<Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><Coins className="mr-1.5 h-4 w-4" />Record revenue</Button>} />
                ) : (
                  <EmptyState icon={Coins} title="No matching revenue" description="No revenue matches the current search and filters." action={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>} />
                )}
              </div>
            )}
          />
          <ListPagination {...pager} itemLabel="revenue rows" />
        </div>
      )}
      <RevenueDialog open={showCreate} onOpenChange={setShowCreate} onSubmit={handleCreate} />
      {editing ? (
        <RevenueDialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)} initial={editing} onSubmit={handleSave} />
      ) : null}
    </MainScreenWrapper>
  );
}

export default RevenueRoyaltiesScreen;
