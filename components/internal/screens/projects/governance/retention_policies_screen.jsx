"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Archive, DatabaseBackup, Eye, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable, EmptyState, LoadingArea, ScreenHeader, SearchInput, StatsBar, Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  CreateDialog, FieldRow, RowActions, SelectField, TextAreaField, TextField, useModuleRows,
} from "@/components/internal/shared/module_kit";
import { ConfirmDeleteDialog } from "@/components/internal/screens/projects/settings/settings_kit";
import { DetailList, DetailSheet, Notice, SheetSection } from "@/components/internal/screens/projects/platform/platform_kit";
import {
  applyRetentionPolicy, createRetentionPolicy, deleteRetentionPolicy, listEligibleAssets,
  listRetentionPolicies, updateRetentionPolicy,
} from "@/lib/supabase/governance";
import { getUser } from "@/lib/supabase/user";
import { ASSET_TYPE_OPTIONS, formatGovernanceDate, RETENTION_ACTION_OPTIONS } from "./constants";
import { useGovernanceManage } from "./use_governance_manage";

const EMPTY_DRAFT = { name: "", description: "", assetType: "all", ageDays: "365", action: "archive" };

export function RetentionPoliciesScreen({ projectId }) {
  const [policies, setPolicies, loading] = useModuleRows(listRetentionPolicies, projectId);
  const canManage = useGovernanceManage(projectId);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [applying, setApplying] = useState(false);
  const previewKey = selected ? `${selected.id}:${selected.ageDays}:${selected.assetType}:${selected.action}` : null;
  const previewLoading = Boolean(selected && preview?.key !== previewKey);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? policies.filter((policy) =>
      [policy.name, policy.description, policy.assetType, policy.action].some((value) =>
        String(value).toLowerCase().includes(q))) : policies;
  }, [policies, search]);

  const stats = useMemo(() => [
    { label: "Policies", value: policies.length },
    { label: "Archive rules", value: policies.filter((p) => p.action === "archive").length },
    { label: "Trash rules", value: policies.filter((p) => p.action === "trash").length },
  ], [policies]);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    listEligibleAssets(projectId, selected).then((result) => {
      if (!alive) return;
      setPreview(result ? { ...result, key: `${selected.id}:${selected.ageDays}:${selected.assetType}:${selected.action}` } : { rows: [], count: 0, key: `${selected.id}:${selected.ageDays}:${selected.assetType}:${selected.action}` });
    });
    return () => { alive = false; };
  }, [projectId, selected]);

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setDialogOpen(true);
  };

  const openEdit = (policy) => {
    setDraft({ ...policy, ageDays: String(policy.ageDays) });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!canManage) return;
    const name = draft.name.trim();
    const ageDays = Number(draft.ageDays);
    if (!name) return toast.error("Give the policy a name.");
    if (!Number.isInteger(ageDays) || ageDays < 1) return toast.error("Enter an age of at least one day.");
    setSaving(true);
    const input = { ...draft, name, ageDays };
    if (draft.id) {
      const previous = policies;
      setPolicies((rows) => rows.map((row) => row.id === draft.id ? { ...row, ...input } : row));
      const saved = await updateRetentionPolicy(draft.id, input);
      setSaving(false);
      if (!saved) {
        setPolicies(previous);
        return toast.error("Couldn't save the policy.");
      }
      setPolicies((rows) => rows.map((row) => row.id === saved.id ? saved : row));
      setSelected((current) => current?.id === saved.id ? saved : current);
      toast.success("Policy saved.");
    } else {
      const optimistic = { ...input, id: crypto.randomUUID(), projectId, createdAt: new Date().toISOString() };
      setPolicies((rows) => [optimistic, ...rows]);
      const user = await getUser();
      const saved = await createRetentionPolicy(projectId, { ...optimistic, createdBy: user?.id });
      setSaving(false);
      if (!saved) {
        setPolicies((rows) => rows.filter((row) => row.id !== optimistic.id));
        return toast.error("Couldn't create the policy.");
      }
      setPolicies((rows) => rows.map((row) => row.id === saved.id ? saved : row));
      toast.success("Policy created.");
    }
    setDialogOpen(false);
  };

  const remove = async () => {
    if (!deleteTarget || !canManage) return;
    const previous = policies;
    setPolicies((rows) => rows.filter((row) => row.id !== deleteTarget.id));
    const ok = await deleteRetentionPolicy(deleteTarget.id);
    if (!ok) {
      setPolicies(previous);
      toast.error("Couldn't delete the policy.");
    } else {
      setSelected((current) => current?.id === deleteTarget.id ? null : current);
      toast.success("Policy deleted.");
    }
    setDeleteTarget(null);
  };

  const apply = async () => {
    if (!canManage || !selected || !preview?.rows?.length) return;
    setApplying(true);
    const result = await applyRetentionPolicy(projectId, selected);
    const { succeeded = 0, failed = 0 } = result ?? {};
    const refreshed = await listEligibleAssets(projectId, selected);
    setPreview(refreshed ? { ...refreshed, key: previewKey } : { rows: [], count: 0, key: previewKey });
    setApplying(false);
    if (!result) return toast.error("Couldn't apply the policy. Check your access and try again.");
    if (succeeded) toast.success(`${succeeded} asset${succeeded === 1 ? "" : "s"} moved to ${selected.action === "archive" ? "archive" : "trash"}.`);
    if (failed) toast.error(`${failed} asset${failed === 1 ? "" : "s"} could not be moved. Check legal holds and access.`);
  };

  const columns = [
    { key: "name", header: "Policy", render: (policy) => (
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{policy.name}</p>
        <p className="truncate text-xs text-text-tertiary">{policy.description || "No description"}</p>
      </div>
    ) },
    { key: "scope", header: "Scope", render: (policy) => <span className="text-xs text-text-secondary">{ASSET_TYPE_OPTIONS.find((o) => o.value === policy.assetType)?.label}</span> },
    { key: "age", header: "Age", render: (policy) => <span className="font-mono text-xs text-text-secondary">{policy.ageDays} days</span> },
    { key: "action", header: "Action", render: (policy) => (
      <Badge className="border border-border bg-surface-card text-xs text-foreground">{policy.action === "archive" ? "Archive" : "Trash"}</Badge>
    ) },
    { key: "actions", header: "", align: "right", render: (policy) => (
      <div onClick={(event) => event.stopPropagation()}>
        <RowActions onEdit={canManage ? () => openEdit(policy) : undefined} onDelete={canManage ? () => setDeleteTarget(policy) : undefined} extra={[
          { icon: Eye, label: "Review matches", onSelect: () => setSelected(policy) },
        ]} />
      </div>
    ) },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Retention Policies" description="Define when assets qualify for archiving or trash, then review matches before applying a rule."
        actions={canManage ? <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openCreate}><Plus className="h-4 w-4" />New policy</Button> : null} />
      <StatsBar stats={stats} />
      <Notice>Policies run when you review and apply them here. Scheduled execution is not configured.</Notice>
      {canManage === false ? <Notice>Only project administrators can change or apply retention policies.</Notice> : null}
      <Toolbar><span className="text-xs text-text-secondary">{filtered.length} of {policies.length} policies</span>
        <SearchInput value={search} onChange={setSearch} placeholder="Search policies…" /></Toolbar>
      {loading ? <LoadingArea panel size={48} label="Loading retention policies" /> : (
        <DataTable columns={columns} data={filtered} getRowKey={(policy) => policy.id} onRowClick={setSelected}
          empty={<div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={DatabaseBackup}
            title={policies.length ? "No policies match" : "No retention policies yet"}
            description={policies.length ? "Try another search term." : "Create a rule to review which assets are due for archiving or trash."}
            action={!policies.length && canManage ? <Button onClick={openCreate}><Plus className="h-4 w-4" />New policy</Button> : null} /></div>} />
      )}

      <CreateDialog open={dialogOpen} onOpenChange={setDialogOpen} title={draft.id ? "Edit retention policy" : "New retention policy"}
        description="A rule identifies eligible assets. Applying it always requires review." submitLabel={draft.id ? "Save changes" : "Create policy"}
        submitDisabled={saving} onSubmit={save}>
        <TextField label="Policy name" value={draft.name} onChange={(value) => setDraft((d) => ({ ...d, name: value }))} placeholder="e.g. Archive campaign files after a year" />
        <TextAreaField label="Description" value={draft.description} onChange={(value) => setDraft((d) => ({ ...d, description: value }))} rows={2} />
        <FieldRow>
          <SelectField label="Asset type" value={draft.assetType} onChange={(value) => setDraft((d) => ({ ...d, assetType: value }))} options={ASSET_TYPE_OPTIONS} />
          <TextField label="Age in days" type="number" inputMode="numeric" value={draft.ageDays} onChange={(value) => setDraft((d) => ({ ...d, ageDays: value }))} hint="Based on the asset creation date." />
        </FieldRow>
        <SelectField label="Action" value={draft.action} onChange={(value) => setDraft((d) => ({ ...d, action: value }))} options={RETENTION_ACTION_OPTIONS} />
      </CreateDialog>

      <DetailSheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)} title={selected?.name || "Policy"}
        subtitle={selected?.description || "Retention rule"} media={<span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-card"><DatabaseBackup className="h-5 w-5 text-text-secondary" /></span>}
        footer={selected && canManage ? <><Button variant="outline" className="border-border bg-surface-card" onClick={() => openEdit(selected)}>Edit rule</Button>
          <Button disabled={applying || previewLoading || !preview?.rows?.length} className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={apply}>
            {selected.action === "archive" ? <Archive className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            {applying ? "Applying…" : `Apply to ${Math.min(preview?.rows?.length ?? 0, 100)} ${preview?.rows?.length === 1 ? "asset" : "assets"}`}
          </Button></> : null}>
        {selected ? <>
          <DetailList items={[
            { label: "Applies to", value: ASSET_TYPE_OPTIONS.find((o) => o.value === selected.assetType)?.label },
            { label: "Older than", value: `${selected.ageDays} days` },
            { label: "Action", value: selected.action === "archive" ? "Move to archive" : "Move to trash" },
            { label: "Created", value: formatGovernanceDate(selected.createdAt) },
          ]} />
          <Notice>{selected.action === "trash" ? "Assets on an active legal hold cannot be trashed." : "Archived assets stay available for restoration."} Review the matches before applying.</Notice>
          <SheetSection title={`Eligible assets${preview ? ` (${preview.count})` : ""}`}>
            {previewLoading ? <LoadingArea size={36} label="Checking assets" /> : preview?.rows?.length ? (
              <div className="divide-y divide-border rounded-lg border border-border bg-surface-card">
                {preview.rows.map((asset) => <div key={asset.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0 truncate text-sm text-foreground">{asset.name}</span>
                  <span className="shrink-0 text-xs text-text-tertiary">{formatGovernanceDate(asset.created_at)}</span>
                </div>)}
              </div>
            ) : <p className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-text-secondary">No assets currently match this rule.</p>}
            {preview?.count > 100 ? <p className="text-xs text-text-tertiary">Showing the oldest 100. Apply again to review the next batch.</p> : null}
          </SheetSection>
        </> : null}
      </DetailSheet>

      <ConfirmDeleteDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete retention policy" description={`Delete “${deleteTarget?.name || "this policy"}”? Existing assets won't be changed.`}
        onConfirm={remove} />
    </MainScreenWrapper>
  );
}

export default RetentionPoliciesScreen;
