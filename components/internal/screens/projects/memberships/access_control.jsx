"use client";

import { Button, LogoLoading } from "@geiger/ui";
import React, { useMemo, useState } from "react";
import { ArrowUpDown, Lock, ShieldPlus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
import {
  ScreenHeader, StatsBar, SearchInput, StatusPill, EmptyState, DataTable, Toolbar,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { ACCESS_SCOPE_META, RULE_STATUS_META, SCOPE_OPTIONS, ALLOWANCE_OPTIONS, statusFilterOptions, formatDate } from "./constants";
import { FilterDropdown, RowActions, ClearFiltersButton, useCreatorRows as useMembershipRows, CreateDialog, TextField } from "@/components/internal/screens/projects/creator/creator_kit";
import { listAccessRules, createAccessRule, updateAccessRule, softDeleteAccessRule } from "@/lib/supabase/memberships";
import { listTiers } from "@/lib/supabase/creator";

const STATUS_FILTERS = statusFilterOptions(RULE_STATUS_META, "All statuses");
const SCOPE_FILTERS = [{ value: "all", label: "All scopes" }, ...SCOPE_OPTIONS];

const SORT_OPTIONS = [
  { value: "updated-desc", label: "Recently updated" },
  { value: "updated-asc", label: "Least recently updated" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "scope-asc", label: "Scope A–Z" },
];

const EMPTY_DRAFT = {
  name: "",
  scopeType: "collection",
  scopeName: "",
  tierId: "any",
  loginRequired: true,
  paywallEnabled: false,
  allowHiresDownload: false,
  watermarkBypass: false,
  previewOnly: false,
  metadataVisible: true,
  isActive: true,
};

function allowancesSummary(rule) {
  const parts = [];
  if (rule.loginRequired) parts.push("Login");
  if (rule.paywallEnabled) parts.push("Paywall");
  if (rule.allowHiresDownload) parts.push("Hi-res");
  if (rule.watermarkBypass) parts.push("No watermark");
  if (rule.previewOnly) parts.push("Preview-only");
  if (rule.metadataVisible) parts.push("Metadata");
  return parts.length ? parts.join(" · ") : "View only";
}

function RuleDialog({ open, onOpenChange, initial, tiers, onSubmit, title, submitLabel }) {
  const [draft, setDraft] = useState(initial ? {
    name: initial.name,
    scopeType: initial.scopeType,
    scopeName: initial.scopeName,
    tierId: initial.tierId ?? "any",
    loginRequired: initial.loginRequired,
    paywallEnabled: initial.paywallEnabled,
    allowHiresDownload: initial.allowHiresDownload,
    watermarkBypass: initial.watermarkBypass,
    previewOnly: initial.previewOnly,
    metadataVisible: initial.metadataVisible,
    isActive: initial.isActive,
  } : EMPTY_DRAFT);
  React.useEffect(() => {
    if (!open) return;
    setDraft(initial ? {
      name: initial.name,
      scopeType: initial.scopeType,
      scopeName: initial.scopeName,
      tierId: initial.tierId ?? "any",
      loginRequired: initial.loginRequired,
      paywallEnabled: initial.paywallEnabled,
      allowHiresDownload: initial.allowHiresDownload,
      watermarkBypass: initial.watermarkBypass,
      previewOnly: initial.previewOnly,
      metadataVisible: initial.metadataVisible,
      isActive: initial.isActive,
    } : EMPTY_DRAFT);
  }, [initial, open]);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  return (
    <CreateDialog open={open} onOpenChange={onOpenChange} title={title} description="Bind a folder, collection, or gallery to a tier and its allowances." submitLabel={submitLabel} onSubmit={() => onSubmit(draft)} wide>
      <TextField label="Rule name" value={draft.name} onChange={set("name")} placeholder="e.g. Gold collectors — Spring drop" />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Scope</label>
          <FilterDropdown value={draft.scopeType} onValueChange={set("scopeType")} options={SCOPE_OPTIONS} placeholder="Scope" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Tier</label>
          <FilterDropdown value={draft.tierId} onValueChange={set("tierId")} options={[{ value: "any", label: "Any paid tier" }, ...tiers.map((t) => ({ value: t.id, label: t.name }))]} placeholder="Tier" />
        </div>
      </div>
      <TextField label="Scope name" value={draft.scopeName} onChange={set("scopeName")} placeholder="e.g. Spring drop gallery" />
      <div className="rounded-lg border border-border bg-surface-card px-4 py-1">
        {ALLOWANCE_OPTIONS.map((opt) => (
          <SettingRow key={opt.key} title={opt.label} description={opt.hint} checked={Boolean(draft[opt.key])} onCheckedChange={set(opt.key)} />
        ))}
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground">Status</label>
        <FilterDropdown value={draft.isActive ? "active" : "paused"} onValueChange={(v) => set("isActive")(v === "active")} options={Object.entries(RULE_STATUS_META).map(([value, m]) => ({ value, label: m.label }))} placeholder="Status" />
      </div>
    </CreateDialog>
  );
}

export function AccessControlScreen({ projectId }) {
  const [rows, setRows, loading] = useMembershipRows(listAccessRules, projectId);
  const [tiers] = useMembershipRows(listTiers, projectId);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortValue, setSortValue] = useState("updated-desc");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((rule) => rule.name.toLowerCase().includes(q) || rule.scopeName.toLowerCase().includes(q));
    }
    if (scopeFilter !== "all") r = r.filter((rule) => rule.scopeType === scopeFilter);
    if (statusFilter !== "all") r = r.filter((rule) => (rule.isActive ? "active" : "paused") === statusFilter);
    const [field, direction] = sortValue.split("-");
    r.sort((a, b) => {
      let cmp = 0;
      if (field === "updated") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
      else if (field === "name") cmp = a.name.localeCompare(b.name);
      else if (field === "scope") cmp = (a.scopeName || "").localeCompare(b.scopeName || "");
      return direction === "desc" ? -cmp : cmp;
    });
    return r;
  }, [rows, search, scopeFilter, statusFilter, sortValue]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${scopeFilter}|${statusFilter}|${sortValue}`,
  });

  const stats = useMemo(() => {
    const active = rows.filter((rule) => rule.isActive);
    return [
      { label: "Rules", value: String(rows.length), footer: `${active.length} active` },
      { label: "Paywalled", value: String(active.filter((rule) => rule.paywallEnabled).length), footer: "guest paywalls live" },
      { label: "Login gates", value: String(active.filter((rule) => rule.loginRequired).length), footer: "members-only scopes" },
      { label: "Hi-res locked", value: String(active.filter((rule) => !rule.allowHiresDownload).length), footer: "preview-only or gated" },
    ];
  }, [rows]);

  const toInput = (draft) => ({
    name: draft.name.trim(),
    scopeType: draft.scopeType,
    scopeName: draft.scopeName.trim(),
    tierId: draft.tierId === "any" ? null : draft.tierId,
    loginRequired: draft.loginRequired,
    paywallEnabled: draft.paywallEnabled,
    allowHiresDownload: draft.allowHiresDownload,
    watermarkBypass: draft.watermarkBypass,
    previewOnly: draft.previewOnly,
    metadataVisible: draft.metadataVisible,
    isActive: draft.isActive,
  });

  const handleCreate = async (draft) => {
    if (!draft.name.trim()) return toast.error("Rule name is required");
    if (!draft.scopeName.trim()) return toast.error("Scope name is required");
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, ...toInput(draft), position: rows.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setRows((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const created = await createAccessRule({ id, projectId, ...toInput(draft), position: rows.length });
    if (created) {
      setRows((prev) => prev.map((rule) => (rule.id === id ? created : rule)));
      toast.success("Access rule created");
    } else {
      setRows((prev) => prev.filter((rule) => rule.id !== id));
      toast.error("Could not create access rule");
    }
  };

  const handleSave = async (draft) => {
    if (!editing) return;
    if (!draft.name.trim()) return toast.error("Rule name is required");
    const prev = rows;
    setRows((list) => list.map((rule) => (rule.id === editing.id ? { ...rule, ...toInput(draft) } : rule)));
    setEditing(null);
    const saved = await updateAccessRule(editing.id, toInput(draft));
    if (!saved) {
      setRows(prev);
      toast.error("Could not save access rule");
    } else {
      setRows((list) => list.map((rule) => (rule.id === editing.id ? saved : rule)));
      toast.success("Access rule updated");
    }
  };

  const handleDelete = async (rule) => {
    const prev = rows;
    setRows((list) => list.filter((r) => r.id !== rule.id));
    const ok = await softDeleteAccessRule(rule.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete access rule");
    } else toast.success("Access rule deleted");
  };

  const columns = [
    { key: "rule", header: "Rule", render: (rule) => (<div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{rule.name}</p><p className="truncate text-[11px] text-text-tertiary">{rule.scopeName || "—"}</p></div>) },
    { key: "scope", header: "Scope", render: (rule) => <StatusPill status={rule.scopeType} map={ACCESS_SCOPE_META} className="text-[10px]" /> },
    { key: "tier", header: "Tier", className: "text-xs", render: (rule) => (rule.tierId ? (tierById.get(rule.tierId)?.name || "—") : "Any paid") },
    { key: "allowances", header: "Allowances", className: "hidden max-w-55 truncate text-[11px] text-text-secondary xl:table-cell", headClassName: "hidden xl:table-cell", render: (rule) => allowancesSummary(rule) },
    { key: "status", header: "Status", render: (rule) => <StatusPill status={rule.isActive ? "active" : "paused"} map={RULE_STATUS_META} className="text-[10px]" /> },
    { key: "updated", header: "Updated", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell", render: (rule) => formatDate(rule.updatedAt) },
    { key: "actions", header: "", align: "right", render: (rule) => <RowActions onEdit={() => setEditing(rule)} onDelete={() => handleDelete(rule)} /> },
  ];

  const hasFilters = scopeFilter !== "all" || statusFilter !== "all" || Boolean(search);

  const clearFilters = () => {
    setScopeFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader title="Access Control" description="Gate folders, collections, and galleries by member tier — locks, paywalls, and download allowances." actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><ShieldPlus className="mr-1.5 h-4 w-4" />New rule</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={scopeFilter} onValueChange={setScopeFilter} options={SCOPE_FILTERS} placeholder="Scope" icon={Lock} />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={sortValue} onValueChange={setSortValue} options={SORT_OPTIONS} placeholder="Sort" icon={ArrowUpDown} />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search rules..." />
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable columns={columns} data={pager.pageItems} getRowKey={(rule) => rule.id} onRowClick={setEditing} empty={<div className="rounded-xl border border-border bg-surface-subtle">{rows.length === 0 ? (<EmptyState icon={Lock} title="No access rules yet" description="Lock a folder, collection, or gallery behind a member tier." action={<Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><ShieldPlus className="mr-1.5 h-4 w-4" />New rule</Button>} />) : (<EmptyState icon={Lock} title="No matching rules" description="No access rules matches the current search and filter." action={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>} />)}</div>} />
          <ListPagination {...pager} itemLabel="rules" />
        </div>
      )}
      <RuleDialog open={showCreate} onOpenChange={setShowCreate} tiers={tiers} title="New access rule" submitLabel="Create rule" onSubmit={handleCreate} />
      {editing ? (
        <RuleDialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)} initial={editing} tiers={tiers} title={`Edit ${editing.name}`} submitLabel="Save changes" onSubmit={handleSave} />
      ) : null}
    </MainScreenWrapper>
  );
}

export default AccessControlScreen;
