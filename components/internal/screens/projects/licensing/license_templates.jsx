"use client";

import { Button, LogoLoading, Switch } from "@geiger/ui";
import React, { useMemo, useState } from "react";
import { ArrowUpDown, FileText, SlidersHorizontal } from "lucide-react";
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
  TEMPLATE_STATUS_MAP, USAGE_TYPE_MAP, TEMPLATE_STATUS_FILTER_OPTIONS, USAGE_TYPE_FILTER_OPTIONS,
  SORT_OPTIONS, formatMoney, templateStatusOf,
} from "./constants";
import {
  FilterDropdown, RowActions, ClearFiltersButton, useLicensingRows, CreateDialog,
  TextField, AreaField, SelectField,
} from "./licensing_kit";
import {
  listLicenseTemplates, createLicenseTemplate, updateLicenseTemplate, softDeleteLicenseTemplate,
} from "@/lib/supabase/licensing";

const EMPTY_DRAFT = {
  name: "",
  description: "",
  usageType: "commercial",
  territories: "",
  channels: "",
  durationDays: "365",
  restrictions: "",
  basePrice: "49.00",
  isActive: true,
};

function TemplateDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const seed = (row) => ({
    name: row?.name ?? "",
    description: row?.description ?? "",
    usageType: row?.usageType ?? "commercial",
    territories: row?.territories ?? "",
    channels: row?.channels ?? "",
    durationDays: row ? String(row.durationDays ?? 365) : "365",
    restrictions: row?.restrictions ?? "",
    basePrice: row ? (Number(row.basePriceCents ?? 0) / 100).toFixed(2) : "49.00",
    isActive: row ? row.isActive !== false : true,
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
      title={editing ? "Edit template" : "New license template"}
      description="A reusable outbound grant — scope, duration, restrictions, and base price."
      submitLabel={editing ? "Save changes" : "Create template"}
      onSubmit={() => onSubmit(draft)}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Template name" value={draft.name} onChange={set("name")} placeholder="e.g. Standard commercial" />
        <SelectField label="Usage type" value={draft.usageType} onChange={set("usageType")} options={Object.entries(USAGE_TYPE_MAP).map(([value, m]) => ({ value, label: m.label }))} />
      </div>
      <AreaField label="Description" value={draft.description} onChange={set("description")} placeholder="What does this grant cover?" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Territories" value={draft.territories} onChange={set("territories")} placeholder="e.g. Worldwide" />
        <TextField label="Channels" value={draft.channels} onChange={set("channels")} placeholder="e.g. digital, print" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Duration (days)" value={draft.durationDays} onChange={set("durationDays")} placeholder="365" />
        <TextField label="Base price (USD)" value={draft.basePrice} onChange={set("basePrice")} placeholder="49.00" />
      </div>
      <AreaField label="Restrictions" value={draft.restrictions} onChange={set("restrictions")} placeholder="e.g. no resale, no sublicensing" />
      <Field label="Active" hint="Archived templates stay on past licenses but can’t be granted anew.">
        <div className="flex h-9 items-center">
          <Switch checked={draft.isActive} onCheckedChange={set("isActive")} aria-label="Template active" />
        </div>
      </Field>
    </CreateDialog>
  );
}

export function LicenseTemplatesScreen({ projectId }) {
  const [rows, setRows, loading] = useLicensingRows(listLicenseTemplates, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [usageFilter, setUsageFilter] = useState("all");
  const [sortValue, setSortValue] = useState("updated-desc");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((t) => templateStatusOf(t) === statusFilter);
    if (usageFilter !== "all") r = r.filter((t) => t.usageType === usageFilter);
    const [field, direction] = sortValue.split("-");
    r.sort((a, b) => {
      let cmp = 0;
      if (field === "updated") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
      else if (field === "name") cmp = a.name.localeCompare(b.name);
      return direction === "desc" ? -cmp : cmp;
    });
    return r;
  }, [rows, search, statusFilter, usageFilter, sortValue]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${statusFilter}|${usageFilter}|${sortValue}`,
  });

  const stats = useMemo(() => {
    const active = rows.filter((t) => t.isActive !== false);
    const priced = active.filter((t) => (t.basePriceCents ?? 0) > 0);
    const avg = priced.length
      ? Math.round(priced.reduce((s, t) => s + t.basePriceCents, 0) / priced.length)
      : 0;
    return [
      { label: "Templates", value: String(rows.length), footer: `${active.length} active` },
      { label: "Avg base price", value: formatMoney(avg), footer: "per priced template" },
      { label: "Usage types", value: String(new Set(rows.map((t) => t.usageType)).size), footer: "covered" },
      { label: "Archived", value: String(rows.filter((t) => t.isActive === false).length), footer: "read-only grants" },
    ];
  }, [rows]);

  const toPayload = (draft) => ({
    name: draft.name.trim(),
    description: draft.description.trim(),
    usageType: draft.usageType,
    territories: draft.territories.trim(),
    channels: draft.channels.trim(),
    durationDays: Math.max(0, Math.floor(Number(draft.durationDays) || 0)),
    restrictions: draft.restrictions.trim(),
    basePriceCents: Math.max(0, Math.round(Number(String(draft.basePrice).replace(/[^0-9.]/g, "")) * 100) || 0),
    isActive: Boolean(draft.isActive),
  });

  const handleCreate = async (draft) => {
    if (!draft.name.trim()) return toast.error("Template name is required");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic = { id, projectId, currency: "usd", ...toPayload(draft), createdAt: now, updatedAt: now };
    setRows((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const created = await createLicenseTemplate({ id, projectId, ...toPayload(draft) });
    if (created) {
      setRows((prev) => prev.map((t) => (t.id === id ? created : t)));
      toast.success("Template created");
    } else {
      setRows((prev) => prev.filter((t) => t.id !== id));
      toast.error("Could not create template");
    }
  };

  const handleSave = async (draft) => {
    if (!editing) return;
    if (!draft.name.trim()) return toast.error("Template name is required");
    const prev = rows;
    const patch = toPayload(draft);
    setRows((list) => list.map((t) => (t.id === editing.id ? { ...t, ...patch } : t)));
    setEditing(null);
    const saved = await updateLicenseTemplate(editing.id, patch);
    if (!saved) {
      setRows(prev);
      toast.error("Could not save template");
    } else {
      setRows((list) => list.map((t) => (t.id === editing.id ? saved : t)));
      toast.success("Template updated");
    }
  };

  const handleDelete = async (template) => {
    const prev = rows;
    setRows((list) => list.filter((t) => t.id !== template.id));
    const ok = await softDeleteLicenseTemplate(template.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete template");
    } else toast.success("Template deleted");
  };

  const columns = [
    {
      key: "name", header: "Template",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
          <p className="truncate text-[11px] text-text-tertiary">{t.description || "—"}</p>
        </div>
      ),
    },
    {
      key: "usage", header: "Usage",
      render: (t) => <StatusPill status={t.usageType} map={USAGE_TYPE_MAP} className="text-[10px]" />,
    },
    {
      key: "scope", header: "Grant scope", className: "hidden text-xs text-text-secondary xl:table-cell", headClassName: "hidden xl:table-cell",
      render: (t) => {
        const bits = [t.territories, t.channels, t.durationDays ? `${t.durationDays}d` : ""].filter(Boolean);
        return bits.join(" · ") || "—";
      },
    },
    {
      key: "price", header: "Base price", align: "right", className: "tabular-nums text-xs",
      render: (t) => formatMoney(t.basePriceCents, t.currency),
    },
    {
      key: "status", header: "Status",
      render: (t) => <StatusPill status={templateStatusOf(t)} map={TEMPLATE_STATUS_MAP} className="text-[10px]" />,
    },
    {
      key: "actions", header: "", align: "right",
      render: (t) => <RowActions onEdit={() => setEditing(t)} onDelete={() => handleDelete(t)} />,
    },
  ];

  const hasFilters = statusFilter !== "all" || usageFilter !== "all" || Boolean(search);
  const clearFilters = () => {
    setStatusFilter("all");
    setUsageFilter("all");
    setSearch("");
  };

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="License Templates"
        description="Reusable outbound grants — usage types, territories, channels, durations, and restrictions."
        actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><FileText className="mr-1.5 h-4 w-4" />New template</Button>}
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={TEMPLATE_STATUS_FILTER_OPTIONS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={usageFilter} onValueChange={setUsageFilter} options={USAGE_TYPE_FILTER_OPTIONS} placeholder="Usage" />
          <FilterDropdown value={sortValue} onValueChange={setSortValue} options={SORT_OPTIONS} placeholder="Sort" icon={ArrowUpDown} />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search templates…" />
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
                  <EmptyState icon={FileText} title="No templates yet" description="Create a reusable grant to stop redrafting every license." action={<Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><FileText className="mr-1.5 h-4 w-4" />New template</Button>} />
                ) : (
                  <EmptyState icon={FileText} title="No matching templates" description="No templates match the current search and filters." action={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>} />
                )}
              </div>
            )}
          />
          <ListPagination {...pager} itemLabel="templates" />
        </div>
      )}
      <TemplateDialog open={showCreate} onOpenChange={setShowCreate} onSubmit={handleCreate} />
      {editing ? (
        <TemplateDialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)} initial={editing} onSubmit={handleSave} />
      ) : null}
    </MainScreenWrapper>
  );
}

export default LicenseTemplatesScreen;
