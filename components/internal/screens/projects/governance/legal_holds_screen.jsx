"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Gavel, Plus, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable, EmptyState, LoadingArea, ScreenHeader, SearchInput, StatsBar, Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  CreateDialog, FieldRow, RowActions, TextAreaField, TextField, useModuleRows,
} from "@/components/internal/shared/module_kit";
import { ConfirmDeleteDialog } from "@/components/internal/screens/projects/settings/settings_kit";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { DetailList, DetailSheet, Notice, SheetSection } from "@/components/internal/screens/projects/platform/platform_kit";
import {
  addLegalHoldAsset, createLegalHold, listLegalHoldEvents, listLegalHolds, releaseLegalHold,
  removeLegalHoldAsset, searchHoldAssets, updateLegalHold,
} from "@/lib/supabase/governance";
import { getUser } from "@/lib/supabase/user";
import { formatGovernanceDate, formatGovernanceDateTime } from "./constants";
import { useGovernanceManage } from "./use_governance_manage";

const EMPTY_DRAFT = { name: "", matterReference: "", reason: "", custodian: "" };
const FILTERS = [
  { value: "active", label: "Active holds" },
  { value: "released", label: "Released" },
  { value: "all", label: "All holds" },
];
const EVENT_LABELS = {
  created: "Hold created",
  updated: "Details updated",
  released: "Hold released",
  asset_added: "Asset added",
  asset_removed: "Asset removed",
};

export function LegalHoldsScreen({ projectId }) {
  const [holds, setHolds, loading] = useModuleRows(listLegalHolds, projectId);
  const canManage = useGovernanceManage(projectId);
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetResults, setAssetResults] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetBusy, setAssetBusy] = useState(null);
  const [eventVersion, setEventVersion] = useState(0);
  const [eventResult, setEventResult] = useState({ holdId: null, events: [] });

  const selected = holds.find((hold) => hold.id === selectedId) ?? null;
  const selectedStatus = selected?.status;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return holds.filter((hold) => (filter === "all" || hold.status === filter) &&
      (!q || [hold.name, hold.matterReference, hold.custodian, hold.reason]
        .some((value) => String(value).toLowerCase().includes(q))));
  }, [holds, filter, search]);
  const active = holds.filter((hold) => hold.status === "active");
  const protectedCount = new Set(active.flatMap((hold) => hold.assets.map((asset) => asset.id))).size;
  const stats = [
    { label: "Active holds", value: active.length },
    { label: "Protected assets", value: protectedCount },
    { label: "Released holds", value: holds.length - active.length },
  ];

  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    listLegalHoldEvents(selectedId).then((events) => {
      if (alive) setEventResult({ holdId: selectedId, events: events ?? [] });
    });
    return () => { alive = false; };
  }, [selectedId, eventVersion]);

  useEffect(() => {
    if (!selectedId || selectedStatus !== "active") return;
    let alive = true;
    const timer = setTimeout(() => {
      setAssetsLoading(true);
      searchHoldAssets(projectId, assetSearch).then((rows) => {
        if (!alive) return;
        setAssetResults(rows ?? []);
        setAssetsLoading(false);
      });
    }, 180);
    return () => { alive = false; clearTimeout(timer); };
  }, [projectId, selectedId, selectedStatus, assetSearch]);

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setDialogOpen(true);
  };
  const openEdit = (hold) => {
    setDraft({ ...hold });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!canManage) return;
    const name = draft.name.trim();
    if (!name) return toast.error("Give the hold a name.");
    if (!draft.reason.trim()) return toast.error("Describe why these assets must be preserved.");
    setSaving(true);
    if (draft.id) {
      const previous = holds;
      setHolds((rows) => rows.map((row) => row.id === draft.id ? { ...row, ...draft, name } : row));
      const saved = await updateLegalHold(draft.id, { ...draft, name });
      setSaving(false);
      if (!saved) {
        setHolds(previous);
        return toast.error("Couldn't save the hold.");
      }
      setHolds((rows) => rows.map((row) => row.id === saved.id ? { ...row, ...saved, assets: row.assets } : row));
      setEventVersion((value) => value + 1);
      toast.success("Hold saved.");
    } else {
      const optimistic = { ...draft, name, id: crypto.randomUUID(), projectId, status: "active", assets: [], createdAt: new Date().toISOString() };
      setHolds((rows) => [optimistic, ...rows]);
      const user = await getUser();
      const saved = await createLegalHold(projectId, { ...optimistic, createdBy: user?.id });
      setSaving(false);
      if (!saved) {
        setHolds((rows) => rows.filter((row) => row.id !== optimistic.id));
        return toast.error("Couldn't create the hold.");
      }
      setHolds((rows) => rows.map((row) => row.id === saved.id ? saved : row));
      setSelectedId(saved.id);
      setEventVersion((value) => value + 1);
      toast.success("Hold created. Add assets to protect them.");
    }
    setDialogOpen(false);
  };

  const addAsset = async (asset) => {
    if (!canManage || !selected || selected.status !== "active" || selected.assets.some((item) => item.id === asset.id)) return;
    const previous = holds;
    setAssetBusy(asset.id);
    setHolds((rows) => rows.map((row) => row.id === selected.id ? {
      ...row, assets: [...row.assets, { id: asset.id, name: asset.name, type: asset.type, addedAt: new Date().toISOString() }],
    } : row));
    const user = await getUser();
    const ok = await addLegalHoldAsset(selected, asset.id, user?.id);
    if (!ok) {
      setHolds(previous);
      toast.error("Couldn't add the asset to this hold.");
    } else {
      setEventVersion((value) => value + 1);
      toast.success("Asset is protected by this hold.");
    }
    setAssetBusy(null);
  };

  const removeAsset = async () => {
    if (!canManage || !selected || !removeTarget) return;
    const previous = holds;
    const asset = removeTarget;
    setRemoveTarget(null);
    setHolds((rows) => rows.map((row) => row.id === selected.id ? {
      ...row, assets: row.assets.filter((item) => item.id !== asset.id),
    } : row));
    const ok = await removeLegalHoldAsset(selected.id, asset.id);
    if (!ok) {
      setHolds(previous);
      toast.error("Couldn't remove the asset from this hold.");
    } else {
      setEventVersion((value) => value + 1);
      toast.success("Asset removed from hold.");
    }
  };

  const release = async () => {
    if (!canManage || !releaseTarget) return;
    const target = releaseTarget;
    const previous = holds;
    setHolds((rows) => rows.map((row) => row.id === target.id ? { ...row, status: "released", releasedAt: new Date().toISOString() } : row));
    const user = await getUser();
    const saved = await releaseLegalHold(target.id, user?.id);
    if (!saved) {
      setHolds(previous);
      toast.error("Couldn't release the hold.");
    } else {
      setHolds((rows) => rows.map((row) => row.id === target.id ? { ...row, ...saved, assets: row.assets } : row));
      setEventVersion((value) => value + 1);
      toast.success("Hold released. Other active holds continue to protect their assets.");
    }
    setReleaseTarget(null);
  };

  const columns = [
    { key: "hold", header: "Hold", render: (hold) => <div className="min-w-0">
      <p className="truncate text-sm font-medium text-foreground">{hold.name}</p>
      <p className="truncate text-xs text-text-tertiary">{hold.matterReference || hold.reason}</p>
    </div> },
    { key: "custodian", header: "Custodian", className: "hidden text-xs text-text-secondary md:table-cell", headClassName: "hidden md:table-cell", render: (hold) => hold.custodian || "—" },
    { key: "assets", header: "Assets", render: (hold) => <span className="font-mono text-xs text-text-secondary">{hold.assets.length}</span> },
    { key: "status", header: "Status", render: (hold) => <Badge className={hold.status === "active" ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border border-border bg-surface-card text-text-secondary"}>{hold.status === "active" ? "Active" : "Released"}</Badge> },
    { key: "created", header: "Created", className: "hidden text-xs text-text-secondary sm:table-cell", headClassName: "hidden sm:table-cell", render: (hold) => formatGovernanceDate(hold.createdAt) },
    { key: "actions", header: "", align: "right", render: (hold) => <div onClick={(event) => event.stopPropagation()}>
      <RowActions onEdit={canManage && hold.status === "active" ? () => openEdit(hold) : undefined} extra={[
        { icon: Gavel, label: "View hold", onSelect: () => setSelectedId(hold.id) },
        ...(canManage && hold.status === "active" ? [{ icon: X, label: "Release hold", onSelect: () => setReleaseTarget(hold) }] : []),
      ]} />
    </div> },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Legal Holds" description="Preserve assets for legal or regulatory review and track when a hold is released."
        actions={canManage ? <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openCreate}><Plus className="h-4 w-4" />New hold</Button> : null} />
      <StatsBar stats={stats} />
      <Notice icon={ShieldCheck}>Assets linked to an active hold cannot be moved to trash or permanently deleted. An asset may remain protected by another active hold after this one is released.</Notice>
      {canManage === false ? <Notice>Only project administrators can create or change legal holds.</Notice> : null}
      <Toolbar><FilterDropdown value={filter} onValueChange={setFilter} options={FILTERS} />
        <SearchInput value={search} onChange={setSearch} placeholder="Search holds, matters, custodians…" /></Toolbar>
      {loading ? <LoadingArea panel size={48} label="Loading legal holds" /> : (
        <DataTable columns={columns} data={filtered} getRowKey={(hold) => hold.id} onRowClick={(hold) => setSelectedId(hold.id)}
          empty={<div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={Gavel}
            title={holds.length ? "No holds match your filters" : "No legal holds yet"}
            description={holds.length ? "Try a different status or search term." : "Create a hold, then add the assets that need preservation."}
            action={!holds.length && canManage ? <Button onClick={openCreate}><Plus className="h-4 w-4" />New hold</Button> : null} /></div>} />
      )}

      <CreateDialog open={dialogOpen} onOpenChange={setDialogOpen} title={draft.id ? "Edit legal hold" : "New legal hold"}
        description="Record the matter and custodian before adding protected assets." submitLabel={draft.id ? "Save changes" : "Create hold"}
        submitDisabled={saving} onSubmit={save}>
        <TextField label="Hold name" value={draft.name} onChange={(value) => setDraft((d) => ({ ...d, name: value }))} placeholder="e.g. Contract dispute review" />
        <FieldRow>
          <TextField label="Matter reference" value={draft.matterReference} onChange={(value) => setDraft((d) => ({ ...d, matterReference: value }))} placeholder="e.g. MAT-2026-042" />
          <TextField label="Custodian" value={draft.custodian} onChange={(value) => setDraft((d) => ({ ...d, custodian: value }))} placeholder="Name or team" />
        </FieldRow>
        <TextAreaField label="Reason for preservation" value={draft.reason} onChange={(value) => setDraft((d) => ({ ...d, reason: value }))} placeholder="What matter requires these files to be preserved?" rows={3} />
      </CreateDialog>

      <DetailSheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)} title={selected?.name || "Legal hold"}
        subtitle={selected?.matterReference || "Matter record"} media={<span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-card"><Gavel className="h-5 w-5 text-text-secondary" /></span>}
        meta={selected ? <Badge className={selected.status === "active" ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border border-border bg-surface-card text-text-secondary"}>{selected.status === "active" ? "Active hold" : "Released"}</Badge> : null}
        footer={canManage && selected?.status === "active" ? <><Button variant="outline" className="border-border bg-surface-card" onClick={() => openEdit(selected)}>Edit details</Button>
          <Button variant="outline" className="border-border bg-surface-card" onClick={() => setReleaseTarget(selected)}>Release hold</Button></> : null}>
        {selected ? <>
          <DetailList items={[
            { label: "Matter", value: selected.matterReference || "—" },
            { label: "Custodian", value: selected.custodian || "—" },
            { label: "Created", value: formatGovernanceDate(selected.createdAt) },
            selected.releasedAt ? { label: "Released", value: formatGovernanceDate(selected.releasedAt) } : null,
          ]} />
          <SheetSection title="Reason"><p className="rounded-lg border border-border bg-surface-card p-3 text-sm leading-6 text-text-secondary">{selected.reason}</p></SheetSection>
          <SheetSection title={`Protected assets (${selected.assets.length})`}>
            {selected.assets.length ? <div className="divide-y divide-border rounded-lg border border-border bg-surface-card">
              {selected.assets.map((asset) => <div key={asset.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0"><p className="truncate text-sm text-foreground">{asset.name}</p><p className="text-[11px] text-text-tertiary">Added {formatGovernanceDate(asset.addedAt)}</p></div>
                {canManage && selected.status === "active" ? <Button size="icon-sm" variant="ghost" aria-label={`Remove ${asset.name} from hold`} onClick={() => setRemoveTarget(asset)}><X className="h-4 w-4" /></Button> : null}
              </div>)}
            </div> : <p className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-text-secondary">No assets are linked to this hold yet.</p>}
          </SheetSection>
          <SheetSection title="History">
            {eventResult.holdId !== selected.id ? <LoadingArea size={32} label="Loading hold history" /> : eventResult.events.length ? (
              <ol className="divide-y divide-border rounded-lg border border-border bg-surface-card">
                {eventResult.events.map((event) => <li key={event.id} className="flex items-start gap-3 px-3 py-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-text-tertiary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{EVENT_LABELS[event.type] || event.type}</p>
                    {event.assetId ? <p className="truncate text-[11px] text-text-tertiary">{selected.assets.find((asset) => asset.id === event.assetId)?.name || `Asset ${event.assetId.slice(0, 8)}`}</p> : null}
                  </div>
                  <time className="shrink-0 text-[11px] text-text-tertiary" dateTime={event.createdAt}>{formatGovernanceDateTime(event.createdAt)}</time>
                </li>)}
              </ol>
            ) : <p className="text-xs text-text-secondary">No history recorded yet.</p>}
          </SheetSection>
          {canManage && selected.status === "active" ? <SheetSection title="Add assets">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Search project assets…" aria-label="Search project assets"
                className="h-9 w-full rounded-md border border-border bg-surface-card pl-9 pr-3 text-sm text-foreground outline-none focus:border-border-strong" /></div>
            {assetsLoading ? <LoadingArea size={32} label="Searching assets" /> : assetResults.length ? <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-surface-card">
              {assetResults.map((asset) => {
                const included = selected.assets.some((item) => item.id === asset.id);
                return <div key={asset.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate text-sm text-foreground">{asset.name}</span>
                  <Button size="sm" variant="ghost" disabled={included || assetBusy === asset.id} onClick={() => addAsset(asset)}>{included ? "Added" : "Add"}</Button>
                </div>;
              })}
            </div> : <p className="text-xs text-text-secondary">No matching assets.</p>}
          </SheetSection> : selected.status === "released" ? <Notice icon={UserRound}>This hold is released. Other active holds may still protect these assets.</Notice> : null}
        </> : null}
      </DetailSheet>

      <ConfirmDeleteDialog open={!!releaseTarget} onOpenChange={(open) => !open && setReleaseTarget(null)}
        title="Release legal hold" description={`Release “${releaseTarget?.name || "this hold"}”? Assets without another active hold may then be deleted.`}
        requireText={releaseTarget?.name} confirmLabel="Release hold" tone="primary" onConfirm={release} />
      <ConfirmDeleteDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove protected asset" description={`Remove “${removeTarget?.name || "this asset"}” from the hold? It may then be deleted if no other active hold protects it.`}
        confirmLabel="Remove asset" onConfirm={removeAsset} />
    </MainScreenWrapper>
  );
}

export default LegalHoldsScreen;
