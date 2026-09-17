"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
  Gavel,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Unlock,
  UserPlus,
} from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { ActionMenu } from "@geiger/ui/action-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Textarea } from "@geiger/ui/textarea";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import {
  addLegalHoldAsset,
  createLegalHold,
  listLegalHoldAssets,
  listLegalHoldEvents,
  listLegalHolds,
  logLegalHoldEvent,
  removeLegalHoldAsset,
  softDeleteLegalHold,
  updateLegalHold,
} from "@/lib/supabase/governance";
import {
  HOLD_EVENT_LABELS,
  HOLD_STATUS_FILTER_OPTIONS,
  HOLD_STATUS_MAP,
  formatDate,
} from "./constants";

// Legal Holds — hold creation, asset preservation, custodian records, hold
// notifications, release from hold, and hold audit history.
//
// An ACTIVE hold visibly overrides retention: held assets are excluded from
// the auto-archive and auto-delete steps the Retention Policies screen
// configures, until the hold is released. That relationship is rendered as a
// banner wherever holds are active, and as an "Overrides retention" badge on
// every active hold. Releasing a hold only resumes the normal schedule — it
// never deletes anything itself.

function HoldDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [matter, setMatter] = useState(initial?.matter ?? "");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [custodians, setCustodians] = useState((initial?.custodians ?? []).join(", "));
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setMatter(initial?.matter ?? "");
    setReason(initial?.reason ?? "");
    setCustodians((initial?.custodians ?? []).join(", "));
    setBusy(false);
  }, [open, initial]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Give the hold a name.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Record why this hold exists — the audit trail needs it.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      name: name.trim(),
      matter: matter.trim(),
      reason: reason.trim(),
      custodians: custodians
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit hold" : "Create legal hold"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Preservation starts the moment the hold is created. Retention resumes only
            on release.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Hold name" htmlFor="hold-name">
            <Input
              id="hold-name"
              className="bg-surface-card"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Meridian dispute — Q3 assets"
              autoFocus
            />
          </Field>
          <Field label="Matter" htmlFor="hold-matter" hint="The case or request this hold answers.">
            <Input
              id="hold-matter"
              className="bg-surface-card"
              value={matter}
              onChange={(e) => setMatter(e.target.value)}
              placeholder="e.g. Meridian v. Acme, discovery request 4"
            />
          </Field>
          <Field label="Reason" htmlFor="hold-reason">
            <Textarea
              id="hold-reason"
              className="bg-surface-card"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What must be preserved, and why."
            />
          </Field>
          <Field
            label="Custodians"
            htmlFor="hold-custodians"
            hint="Comma-separated names or emails responsible for preservation."
          >
            <Input
              id="hold-custodians"
              className="bg-surface-card"
              value={custodians}
              onChange={(e) => setCustodians(e.target.value)}
              placeholder="dana@acme.com, marcus@acme.com"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
            disabled={busy}
          >
            {editing ? "Save changes" : "Create hold"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LegalHoldsScreen({ projectId }) {
  const [holds, setHolds] = useState([]);
  const [holdAssets, setHoldAssets] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [releasing, setReleasing] = useState(null);
  const [assetIdDraft, setAssetIdDraft] = useState("");
  const [assetLabelDraft, setAssetLabelDraft] = useState("");
  const [custodianDraft, setCustodianDraft] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      listLegalHolds(projectId),
      listLegalHoldAssets(projectId),
      listLegalHoldEvents(projectId),
    ]).then(([holdRows, assetRows, eventRows]) => {
      if (!alive) return;
      setHolds(holdRows ?? []);
      setHoldAssets(assetRows ?? []);
      setEvents(eventRows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const assetsByHold = useMemo(() => {
    const map = new Map();
    for (const row of holdAssets) {
      const list = map.get(row.holdId) || [];
      list.push(row);
      map.set(row.holdId, list);
    }
    return map;
  }, [holdAssets]);

  const eventsByHold = useMemo(() => {
    const map = new Map();
    for (const event of events) {
      const list = map.get(event.holdId) || [];
      list.push(event);
      map.set(event.holdId, list);
    }
    return map;
  }, [events]);

  const activeHolds = useMemo(() => holds.filter((h) => h.status === "active"), [holds]);

  const custodianCount = useMemo(
    () => new Set(holds.flatMap((h) => h.custodians)).size,
    [holds],
  );

  const stats = useMemo(
    () => [
      { label: "Active holds", value: String(activeHolds.length), footer: "overriding retention" },
      { label: "Preserved assets", value: String(holdAssets.length), footer: "excluded from sweeps" },
      { label: "Custodians", value: String(custodianCount), footer: "named on holds" },
      {
        label: "Released",
        value: String(holds.filter((h) => h.status === "released").length),
        footer: "schedule resumed",
      },
    ],
    [activeHolds, holdAssets, custodianCount, holds],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return holds.filter((hold) => {
      if (statusFilter !== "all" && hold.status !== statusFilter) return false;
      if (needle && !`${hold.name} ${hold.matter} ${hold.reason}`.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [holds, search, statusFilter]);

  const filtersActive = statusFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
  };

  const selected = selectedId ? holds.find((h) => h.id === selectedId) ?? null : null;
  const selectedAssets = selectedId ? assetsByHold.get(selectedId) ?? [] : [];
  const selectedEvents = selectedId ? eventsByHold.get(selectedId) ?? [] : [];

  const recordEvent = async (holdId, action, detail) => {
    const created = await logLegalHoldEvent({
      holdId,
      projectId,
      action,
      actor: "workspace operator",
      detail,
    });
    if (created) {
      setEvents((rows) => [created, ...rows]);
      return true;
    }
    toast.error("Hold saved, but the audit entry couldn't be written.");
    return false;
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const submitHold = async (draft) => {
    if (editing) {
      const previous = holds;
      setHolds((rows) => rows.map((h) => (h.id === editing.id ? { ...h, ...draft } : h)));
      const saved = await updateLegalHold(editing.id, draft);
      if (!saved) {
        setHolds(previous);
        toast.error("Couldn't save the hold.");
        return false;
      }
      setHolds((rows) => rows.map((h) => (h.id === saved.id ? saved : h)));
      await recordEvent(saved.id, "updated", `Hold details updated for “${saved.name}”.`);
      toast.success("Hold saved.");
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      status: "active",
      notifyCustodians: true,
      releasedAt: null,
      releasedBy: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setHolds((rows) => [optimistic, ...rows]);
    const created = await createLegalHold({ id, projectId, ...draft });
    if (!created) {
      setHolds((rows) => rows.filter((h) => h.id !== id));
      toast.error("Couldn't create the hold.");
      return false;
    }
    setHolds((rows) => rows.map((h) => (h.id === id ? created : h)));
    await recordEvent(created.id, "created", `Hold “${created.name}” created. Preservation starts now.`);
    toast.success("Legal hold created — preservation starts now.");
    return true;
  };

  const confirmRelease = async () => {
    if (!releasing) return;
    const previous = holds;
    const stamp = new Date().toISOString();
    setHolds((rows) =>
      rows.map((h) =>
        h.id === releasing.id ? { ...h, status: "released", releasedAt: stamp } : h,
      ),
    );
    const saved = await updateLegalHold(releasing.id, {
      status: "released",
      releasedAt: stamp,
      releasedBy: "workspace operator",
    });
    if (!saved) {
      setHolds(previous);
      toast.error("Couldn't release the hold.");
      return;
    }
    setHolds((rows) => rows.map((h) => (h.id === saved.id ? saved : h)));
    await recordEvent(saved.id, "released", `Hold “${saved.name}” released. Retention schedule resumes.`);
    toast.success(`Released “${saved.name}” — retention resumes.`);
    setReleasing(null);
  };

  const removeHold = async (hold) => {
    const previous = holds;
    setHolds((rows) => rows.filter((h) => h.id !== hold.id));
    if (selectedId === hold.id) setSelectedId(null);
    const ok = await softDeleteLegalHold(hold.id);
    if (!ok) {
      setHolds(previous);
      toast.error("Couldn't delete the hold.");
      return;
    }
    toast.success("Hold deleted.");
  };

  const addAsset = async () => {
    if (!selected || selected.status !== "active") return;
    if (!assetIdDraft.trim()) {
      toast.error("Enter the asset id to preserve.");
      return;
    }
    if (selectedAssets.some((a) => a.assetId === assetIdDraft.trim())) {
      toast.error("That asset is already preserved under this hold.");
      return;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      holdId: selected.id,
      projectId,
      assetId: assetIdDraft.trim(),
      assetLabel: assetLabelDraft.trim(),
      addedBy: "workspace operator",
      addedAt: new Date().toISOString(),
    };
    setHoldAssets((rows) => [optimistic, ...rows]);
    const created = await addLegalHoldAsset({
      id,
      holdId: selected.id,
      projectId,
      assetId: assetIdDraft.trim(),
      assetLabel: assetLabelDraft.trim(),
      addedBy: "workspace operator",
    });
    if (!created) {
      setHoldAssets((rows) => rows.filter((a) => a.id !== id));
      toast.error("Couldn't preserve that asset.");
      return;
    }
    setHoldAssets((rows) => rows.map((a) => (a.id === id ? created : a)));
    setAssetIdDraft("");
    setAssetLabelDraft("");
    await recordEvent(selected.id, "assets_added", `Asset ${created.assetId} placed under hold.`);
    toast.success("Asset preserved under this hold.");
  };

  const dropAsset = async (row) => {
    const previous = holdAssets;
    setHoldAssets((rows) => rows.filter((a) => a.id !== row.id));
    const ok = await removeLegalHoldAsset(row.id);
    if (!ok) {
      setHoldAssets(previous);
      toast.error("Couldn't remove that asset.");
      return;
    }
    if (selected) {
      await recordEvent(selected.id, "assets_removed", `Asset ${row.assetId} removed from hold.`);
    }
    toast.success("Asset removed from hold.");
  };

  const addCustodian = async () => {
    if (!selected || !custodianDraft.trim()) return;
    if (selected.custodians.includes(custodianDraft.trim())) {
      toast.error("That custodian is already named on this hold.");
      return;
    }
    const next = [...selected.custodians, custodianDraft.trim()];
    const previous = holds;
    setHolds((rows) => rows.map((h) => (h.id === selected.id ? { ...h, custodians: next } : h)));
    const saved = await updateLegalHold(selected.id, { custodians: next });
    if (!saved) {
      setHolds(previous);
      toast.error("Couldn't add the custodian.");
      return;
    }
    setHolds((rows) => rows.map((h) => (h.id === saved.id ? saved : h)));
    setCustodianDraft("");
    await recordEvent(saved.id, "custodian_added", `${custodianDraft.trim()} named as custodian.`);
    toast.success("Custodian added.");
  };

  const dropCustodian = async (custodian) => {
    if (!selected) return;
    const next = selected.custodians.filter((c) => c !== custodian);
    const previous = holds;
    setHolds((rows) => rows.map((h) => (h.id === selected.id ? { ...h, custodians: next } : h)));
    const saved = await updateLegalHold(selected.id, { custodians: next });
    if (!saved) {
      setHolds(previous);
      toast.error("Couldn't remove the custodian.");
      return;
    }
    setHolds((rows) => rows.map((h) => (h.id === saved.id ? saved : h)));
    await recordEvent(saved.id, "custodian_removed", `${custodian} removed as custodian.`);
    toast.success("Custodian removed.");
  };

  const notifyCustodians = async () => {
    if (!selected) return;
    if (selected.custodians.length === 0) {
      toast.error("Name at least one custodian before sending a notice.");
      return;
    }
    const ok = await recordEvent(
      selected.id,
      "notified",
      `Hold notice sent to ${selected.custodians.length} ${selected.custodians.length === 1 ? "custodian" : "custodians"}.`,
    );
    if (ok) toast.success("Hold notice recorded.");
  };

  const holdColumns = [
    {
      key: "hold",
      header: "Hold",
      render: (hold) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="max-w-[240px] truncate font-medium text-foreground">
              {hold.name || "Untitled hold"}
            </span>
            {hold.status === "active" ? <Badge variant="warning">Overrides retention</Badge> : null}
          </span>
          <span className="max-w-[280px] truncate text-xs text-text-secondary">
            {hold.matter || "No matter recorded"}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (hold) => (
        <div className="flex flex-col gap-1">
          <StatusPill status={hold.status} map={HOLD_STATUS_MAP} />
          <span className="text-[11px] text-text-tertiary">
            {hold.status === "active"
              ? `${assetsByHold.get(hold.id)?.length ?? 0} preserved`
              : `released ${formatDate(hold.releasedAt)}`}
          </span>
        </div>
      ),
    },
    {
      key: "custodians",
      header: "Custodians",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (hold) =>
        hold.custodians.length === 0 ? "—" : `${hold.custodians.length} named`,
    },
    {
      key: "updated",
      header: "Updated",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (hold) => formatDate(hold.updatedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (hold) => (
        <ActionMenu
          label={`Actions for ${hold.name}`}
          items={[
            {
              icon: Pencil,
              label: "Edit",
              onSelect: () => {
                setEditing(hold);
                setDialogOpen(true);
              },
            },
            hold.status === "active"
              ? {
                  icon: Unlock,
                  label: "Release hold",
                  onSelect: () => setReleasing(hold),
                }
              : null,
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              destructive: true,
              onSelect: () => removeHold(hold),
            },
          ]}
        />
      ),
    },
  ];

  const preservedColumns = [
    {
      key: "asset",
      header: "Asset",
      render: (row) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="max-w-[280px] truncate font-mono text-xs text-foreground">
            {row.assetId}
          </span>
          {row.assetLabel ? (
            <span className="max-w-[280px] truncate text-[11px] text-text-tertiary">
              {row.assetLabel}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "added",
      header: "Preserved",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (row) => `${formatDate(row.addedAt)}${row.addedBy ? ` · ${row.addedBy}` : ""}`,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (row) => (
        <ActionMenu
          label={`Actions for preserved asset ${row.assetId}`}
          items={[
            {
              icon: Trash2,
              label: selected?.status === "active" ? "Remove from hold" : "Remove record",
              destructive: true,
              onSelect: () => dropAsset(row),
            },
          ]}
        />
      ),
    },
  ];

  const auditColumns = [
    {
      key: "event",
      header: "Event",
      render: (event) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            {HOLD_EVENT_LABELS[event.action] || event.action}
          </span>
          {event.detail ? (
            <span className="max-w-[420px] truncate text-xs text-text-secondary">
              {event.detail}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (event) => event.actor || "—",
    },
    {
      key: "when",
      header: "When",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (event) => formatDate(event.createdAt),
    },
  ];

  if (selected) {
    const isActive = selected.status === "active";
    return (
      <MainScreenWrapper>
        <ScreenHeader
          title={selected.name || "Untitled hold"}
          description={selected.matter || "Hold detail — preservation, custodians, notices, and audit history."}
          actions={
            <Button
              variant="outline"
              className="border-border bg-surface-card text-foreground hover:bg-surface-active"
              onClick={() => setSelectedId(null)}
            >
              <ArrowLeft className="h-4 w-4" /> All holds
            </Button>
          }
        />

        {isActive ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-sm text-foreground">
              This hold overrides retention — the {selectedAssets.length} preserved{" "}
              {selectedAssets.length === 1 ? "asset" : "assets"} below{" "}
              {selectedAssets.length === 1 ? "is" : "are"} excluded from auto-archive and
              auto-delete until the hold is released.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3">
            <Unlock className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
            <p className="text-sm text-text-secondary">
              Released {formatDate(selected.releasedAt)} — the normal retention schedule
              applies again. The records below stay as the audit trail.
            </p>
          </div>
        )}

        <SectionCard
          title="Preserved assets"
          description={isActive ? "These ids are excluded from retention sweeps." : "Assets that were preserved while the hold was active."}
        >
          {isActive ? (
            <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                className="bg-surface-card font-mono"
                value={assetIdDraft}
                onChange={(e) => setAssetIdDraft(e.target.value)}
                placeholder="Asset id"
                aria-label="Asset id to preserve"
              />
              <Input
                className="bg-surface-card"
                value={assetLabelDraft}
                onChange={(e) => setAssetLabelDraft(e.target.value)}
                placeholder="Label (optional)"
                aria-label="Asset label"
              />
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={addAsset}
              >
                <Plus className="h-4 w-4" /> Preserve
              </Button>
            </div>
          ) : null}
          <DataTable
            columns={preservedColumns}
            data={selectedAssets}
            getRowKey={(row) => row.id}
            empty={
              <EmptyState
                icon={Lock}
                title="No preserved assets"
                description={isActive ? "Add the first asset id to place it under this hold." : "Nothing was preserved under this hold."}
              />
            }
          />
        </SectionCard>

        <SectionCard
          title="Custodians"
          description="People responsible for preserving the held material."
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            {selected.custodians.length === 0 ? (
              <p className="text-sm text-text-tertiary">No custodians named yet.</p>
            ) : (
              selected.custodians.map((custodian) => (
                <Badge key={custodian} variant="neutral">
                  {custodian}
                  {isActive ? (
                    <button
                      type="button"
                      aria-label={`Remove ${custodian}`}
                      className="ml-1.5 text-text-tertiary hover:text-foreground"
                      onClick={() => dropCustodian(custodian)}
                    >
                      ×
                    </button>
                  ) : null}
                </Badge>
              ))
            )}
          </div>
          {isActive ? (
            <div className="flex gap-2">
              <Input
                className="bg-surface-card"
                value={custodianDraft}
                onChange={(e) => setCustodianDraft(e.target.value)}
                placeholder="Name or email"
                aria-label="Custodian to add"
              />
              <Button
                variant="outline"
                className="shrink-0 border-border bg-surface-card text-foreground hover:bg-surface-active"
                onClick={addCustodian}
              >
                <UserPlus className="h-4 w-4" /> Add
              </Button>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Hold notifications"
          description="Every notice sent to custodians is written to the audit history below."
          action={
            isActive ? (
              <Button
                variant="outline"
                className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                onClick={notifyCustodians}
              >
                <Bell className="h-4 w-4" /> Notify custodians
              </Button>
            ) : null
          }
        >
          <p className="text-sm text-text-secondary">
            {selectedEvents.filter((e) => e.action === "notified").length}{" "}
            {selectedEvents.filter((e) => e.action === "notified").length === 1 ? "notice" : "notices"} sent
            {selected.notifyCustodians ? " · custodians are notified on creation and release." : " · automatic notices are off for this hold."}
          </p>
        </SectionCard>

        <SectionCard
          title="Audit history"
          description="Append-only record of everything that happened to this hold."
        >
          <DataTable
            columns={auditColumns}
            data={selectedEvents}
            getRowKey={(event) => event.id}
            empty={
              <EmptyState
                icon={Gavel}
                title="No audit entries"
                description="Hold events will appear here as they happen."
              />
            }
          />
        </SectionCard>
      </MainScreenWrapper>
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Legal Holds"
        description="Preserve assets for a matter. Active holds override retention until released."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> Create hold
          </Button>
        }
      />

      <StatsBar stats={stats} />

      {activeHolds.length > 0 && !loading ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-sm text-foreground">
            {activeHolds.length} active {activeHolds.length === 1 ? "hold overrides" : "holds override"} retention —{" "}
            {holdAssets.length} preserved {holdAssets.length === 1 ? "asset is" : "assets are"} excluded
            from auto-archive and auto-delete until released.
          </p>
        </div>
      ) : null}

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={HOLD_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search holds, matters…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading legal holds" />
        </div>
      ) : (
        <DataTable
          columns={holdColumns}
          data={filtered}
          getRowKey={(hold) => hold.id}
          onRowClick={(hold) => setSelectedId(hold.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              {filtersActive ? (
                <EmptyState
                  icon={Gavel}
                  title="No holds match these filters"
                  description="Try a different status or search term."
                  action={
                    <Button
                      variant="outline"
                      className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Gavel}
                  title="No legal holds"
                  description="Retention runs normally until a hold suspends it for preserved assets."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={openCreate}
                    >
                      <Plus className="h-4 w-4" /> Create hold
                    </Button>
                  }
                />
              )}
            </div>
          }
        />
      )}

      <HoldDialog
        key={editing ? `hold:${editing.id}` : "hold:new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={submitHold}
      />

      <Dialog open={Boolean(releasing)} onOpenChange={(v) => !v && setReleasing(null)}>
        <DialogContent className="max-w-md border-border bg-surface-subtle text-foreground">
          <DialogHeader>
            <DialogTitle>Release {releasing?.name}?</DialogTitle>
            <DialogDescription className="text-sm text-text-secondary">
              The normal retention schedule resumes for its preserved assets. The hold
              and its audit history are kept — nothing is deleted by releasing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setReleasing(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={confirmRelease}
            >
              <Unlock className="h-4 w-4" /> Release hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default LegalHoldsScreen;
