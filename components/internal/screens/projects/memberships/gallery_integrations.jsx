"use client";

import { Button, LogoLoading } from "@geiger/ui";
import React, { useMemo, useState } from "react";
import { ArrowUpDown, Images, LayoutGrid, SlidersHorizontal } from "lucide-react";
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
import { GALLERY_STATUS_META, GALLERY_FEATURE_OPTIONS, statusFilterOptions, formatDate } from "./constants";
import { FilterDropdown, RowActions, ClearFiltersButton, useCreatorRows as useMembershipRows, CreateDialog, TextField } from "@/components/internal/screens/projects/creator/creator_kit";
import { listGalleryLinks, createGalleryLink, updateGalleryLink, softDeleteGalleryLink } from "@/lib/supabase/memberships";
import { listTiers } from "@/lib/supabase/creator";

const STATUS_FILTERS = statusFilterOptions(GALLERY_STATUS_META, "All statuses");

const SORT_OPTIONS = [
  { value: "updated-desc", label: "Recently updated" },
  { value: "updated-asc", label: "Least recently updated" },
  { value: "name-asc", label: "Gallery A–Z" },
  { value: "name-desc", label: "Gallery Z–A" },
];

const EMPTY_DRAFT = {
  galleryName: "",
  tierId: "any",
  loginRequired: true,
  memberPricingEnabled: false,
  paywallEnabled: false,
  signupFormEnabled: true,
  welcomeBanner: "",
  isActive: true,
};

function featuresSummary(link) {
  const parts = [];
  if (link.loginRequired) parts.push("Login");
  if (link.memberPricingEnabled) parts.push("Member pricing");
  if (link.paywallEnabled) parts.push("Paywall");
  if (link.signupFormEnabled) parts.push("Signup form");
  if (link.welcomeBanner) parts.push("Banner");
  return parts.length ? parts.join(" · ") : "Linked";
}

function GalleryLinkDialog({ open, onOpenChange, initial, tiers, onSubmit, title, submitLabel }) {
  const [draft, setDraft] = useState(initial ? {
    galleryName: initial.galleryName,
    tierId: initial.tierId ?? "any",
    loginRequired: initial.loginRequired,
    memberPricingEnabled: initial.memberPricingEnabled,
    paywallEnabled: initial.paywallEnabled,
    signupFormEnabled: initial.signupFormEnabled,
    welcomeBanner: initial.welcomeBanner,
    isActive: initial.isActive,
  } : EMPTY_DRAFT);
  React.useEffect(() => {
    if (!open) return;
    setDraft(initial ? {
      galleryName: initial.galleryName,
      tierId: initial.tierId ?? "any",
      loginRequired: initial.loginRequired,
      memberPricingEnabled: initial.memberPricingEnabled,
      paywallEnabled: initial.paywallEnabled,
      signupFormEnabled: initial.signupFormEnabled,
      welcomeBanner: initial.welcomeBanner,
      isActive: initial.isActive,
    } : EMPTY_DRAFT);
  }, [initial, open]);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  return (
    <CreateDialog open={open} onOpenChange={onOpenChange} title={title} description="Attach membership login, pricing, and paywalls to a showcase gallery or storefront." submitLabel={submitLabel} onSubmit={() => onSubmit(draft)} wide>
      <TextField label="Gallery name" value={draft.galleryName} onChange={set("galleryName")} placeholder="e.g. Spring drop showcase" />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Tier</label>
          <FilterDropdown value={draft.tierId} onValueChange={set("tierId")} options={[{ value: "any", label: "All members" }, ...tiers.map((t) => ({ value: t.id, label: t.name }))]} placeholder="Tier" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Status</label>
          <FilterDropdown value={draft.isActive ? "active" : "paused"} onValueChange={(v) => set("isActive")(v === "active")} options={Object.entries(GALLERY_STATUS_META).map(([value, m]) => ({ value, label: m.label }))} placeholder="Status" />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface-card px-4 py-1">
        {GALLERY_FEATURE_OPTIONS.map((opt) => (
          <SettingRow key={opt.key} title={opt.label} description={opt.hint} checked={Boolean(draft[opt.key])} onCheckedChange={set(opt.key)} />
        ))}
      </div>
      <TextField label="Welcome banner" value={draft.welcomeBanner} onChange={set("welcomeBanner")} placeholder="e.g. Members get 20% off prints" hint="Shown to signed-in members on this gallery" />
    </CreateDialog>
  );
}

export function GalleryIntegrationsScreen({ projectId }) {
  const [rows, setRows, loading] = useMembershipRows(listGalleryLinks, projectId);
  const [tiers] = useMembershipRows(listTiers, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [sortValue, setSortValue] = useState("updated-desc");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const tierFilters = useMemo(() => [{ value: "all", label: "All tiers" }, ...tiers.map((t) => ({ value: t.id, label: t.name }))], [tiers]);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((link) => link.galleryName.toLowerCase().includes(q) || (link.welcomeBanner || "").toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((link) => (link.isActive ? "active" : "paused") === statusFilter);
    if (tierFilter !== "all") r = r.filter((link) => link.tierId === tierFilter);
    const [field, direction] = sortValue.split("-");
    r.sort((a, b) => {
      let cmp = 0;
      if (field === "updated") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
      else if (field === "name") cmp = a.galleryName.localeCompare(b.galleryName);
      return direction === "desc" ? -cmp : cmp;
    });
    return r;
  }, [rows, search, statusFilter, tierFilter, sortValue]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${statusFilter}|${tierFilter}|${sortValue}`,
  });

  const stats = useMemo(() => {
    const active = rows.filter((link) => link.isActive);
    return [
      { label: "Galleries", value: String(rows.length), footer: `${active.length} active` },
      { label: "Login-gated", value: String(active.filter((link) => link.loginRequired).length), footer: "member sign-in walls" },
      { label: "Paywalled", value: String(active.filter((link) => link.paywallEnabled).length), footer: "interactive paywalls" },
      { label: "Member pricing", value: String(active.filter((link) => link.memberPricingEnabled).length), footer: "tier storefront pricing" },
    ];
  }, [rows]);

  const toInput = (draft) => ({
    galleryName: draft.galleryName.trim(),
    tierId: draft.tierId === "any" ? null : draft.tierId,
    loginRequired: draft.loginRequired,
    memberPricingEnabled: draft.memberPricingEnabled,
    paywallEnabled: draft.paywallEnabled,
    signupFormEnabled: draft.signupFormEnabled,
    welcomeBanner: draft.welcomeBanner.trim(),
    isActive: draft.isActive,
  });

  const handleCreate = async (draft) => {
    if (!draft.galleryName.trim()) return toast.error("Gallery name is required");
    const id = crypto.randomUUID();
    const optimistic = { id, projectId, ...toInput(draft), position: rows.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setRows((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const created = await createGalleryLink({ id, projectId, ...toInput(draft), position: rows.length });
    if (created) {
      setRows((prev) => prev.map((link) => (link.id === id ? created : link)));
      toast.success("Gallery connected");
    } else {
      setRows((prev) => prev.filter((link) => link.id !== id));
      toast.error("Could not connect gallery");
    }
  };

  const handleSave = async (draft) => {
    if (!editing) return;
    if (!draft.galleryName.trim()) return toast.error("Gallery name is required");
    const prev = rows;
    setRows((list) => list.map((link) => (link.id === editing.id ? { ...link, ...toInput(draft) } : link)));
    setEditing(null);
    const saved = await updateGalleryLink(editing.id, toInput(draft));
    if (!saved) {
      setRows(prev);
      toast.error("Could not save gallery link");
    } else {
      setRows((list) => list.map((link) => (link.id === editing.id ? saved : link)));
      toast.success("Gallery link updated");
    }
  };

  const handleToggle = async (link) => {
    const prev = rows;
    setRows((list) => list.map((l) => (l.id === link.id ? { ...l, isActive: !l.isActive } : l)));
    const saved = await updateGalleryLink(link.id, { isActive: !link.isActive });
    if (!saved) setRows(prev);
    else toast.success(link.isActive ? "Gallery link paused" : "Gallery link activated");
  };

  const handleDelete = async (link) => {
    const prev = rows;
    setRows((list) => list.filter((l) => l.id !== link.id));
    const ok = await softDeleteGalleryLink(link.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not remove gallery link");
    } else toast.success("Gallery link removed");
  };

  const columns = [
    { key: "gallery", header: "Gallery", render: (link) => (<div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{link.galleryName}</p><p className="truncate text-[11px] text-text-tertiary">{link.welcomeBanner || "No welcome banner"}</p></div>) },
    { key: "tier", header: "Tier", className: "text-xs", render: (link) => (link.tierId ? (tierById.get(link.tierId)?.name || "—") : "All members") },
    { key: "features", header: "Features", className: "hidden max-w-60 truncate text-[11px] text-text-secondary xl:table-cell", headClassName: "hidden xl:table-cell", render: (link) => featuresSummary(link) },
    { key: "status", header: "Status", render: (link) => <StatusPill status={link.isActive ? "active" : "paused"} map={GALLERY_STATUS_META} className="text-[10px]" /> },
    { key: "updated", header: "Updated", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell", render: (link) => formatDate(link.updatedAt) },
    { key: "actions", header: "", align: "right", render: (link) => <RowActions onEdit={() => setEditing(link)} onDelete={() => handleDelete(link)} /> },
  ];

  const hasFilters = statusFilter !== "all" || tierFilter !== "all" || Boolean(search);

  const clearFilters = () => {
    setStatusFilter("all");
    setTierFilter("all");
    setSearch("");
  };

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader title="Gallery Integrations" description="Membership login, member pricing, and paywalls on showcase galleries and storefronts." actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><LayoutGrid className="mr-1.5 h-4 w-4" />Connect gallery</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={tierFilter} onValueChange={setTierFilter} options={tierFilters} placeholder="Tier" icon={Images} />
          <FilterDropdown value={sortValue} onValueChange={setSortValue} options={SORT_OPTIONS} placeholder="Sort" icon={ArrowUpDown} />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search galleries..." />
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable columns={columns} data={pager.pageItems} getRowKey={(link) => link.id} onRowClick={handleToggle} empty={<div className="rounded-xl border border-border bg-surface-subtle">{rows.length === 0 ? (<EmptyState icon={Images} title="No galleries connected" description="Connect a showcase gallery to gate it behind membership." action={<Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><LayoutGrid className="mr-1.5 h-4 w-4" />Connect gallery</Button>} />) : (<EmptyState icon={Images} title="No matching galleries" description="No galleries matches the current search and filter." action={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>} />)}</div>} />
          <ListPagination {...pager} itemLabel="galleries" />
        </div>
      )}
      <GalleryLinkDialog open={showCreate} onOpenChange={setShowCreate} tiers={tiers} title="Connect gallery" submitLabel="Connect gallery" onSubmit={handleCreate} />
      {editing ? (
        <GalleryLinkDialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)} initial={editing} tiers={tiers} title={`Edit ${editing.galleryName}`} submitLabel="Save changes" onSubmit={handleSave} />
      ) : null}
    </MainScreenWrapper>
  );
}

export default GalleryIntegrationsScreen;
