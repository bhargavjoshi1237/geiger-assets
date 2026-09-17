"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Hourglass, Pencil, Plus, Trash2 } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { ActionMenu } from "@geiger/ui/action-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
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
  createRetentionException,
  createRetentionPolicy,
  listLegalHolds,
  listRetentionExceptions,
  listRetentionPolicies,
  softDeleteRetentionException,
  softDeleteRetentionPolicy,
  updateRetentionPolicy,
} from "@/lib/supabase/governance";
import {
  DISPOSITION_FILTER_OPTIONS,
  DISPOSITION_MAP,
  POLICY_SCOPE_FILTER_OPTIONS,
  POLICY_SCOPE_MAP,
  POLICY_STATE_MAP,
  RETENTION_SWEEP_DAYS,
  formatDate,
  formatDays,
} from "./constants";

// Retention Policies — schedules, auto-archive, auto-delete, exceptions,
// disposition review, and reporting.
//
// The schedules configured here are carried out by the reconciler in
// lib/storage/reconcile.js: pass 3 sweeps soft-deleted rows past the retention
// window (RETENTION_SWEEP_DAYS, mirrored in ./constants). This screen never
// deletes bytes itself — it configures the policy rows the sweep reads and
// reports on what the sweep will do.
//
// An active legal hold always wins over a policy: held assets are excluded
// from auto-archive and auto-delete until the hold is released.

function scheduleSummary(policy) {
  const parts = [`keep ${formatDays(policy.retentionDays)}`];
  if (policy.autoArchiveDays !== null && policy.autoArchiveDays !== "") {
    parts.push(`archive after ${formatDays(policy.autoArchiveDays)}`);
  }
  if (policy.autoDeleteDays !== null && policy.autoDeleteDays !== "") {
    parts.push(`delete after ${formatDays(policy.autoDeleteDays)}`);
  }
  return parts.join(" · ");
}

function daysInput(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function parseDays(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function PolicyDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [scope, setScope] = useState(initial?.scope ?? "workspace");
  const [target, setTarget] = useState(initial?.target ?? "");
  const [retentionDays, setRetentionDays] = useState(String(initial?.retentionDays ?? 30));
  const [autoArchiveDays, setAutoArchiveDays] = useState(daysInput(initial?.autoArchiveDays));
  const [autoDeleteDays, setAutoDeleteDays] = useState(daysInput(initial?.autoDeleteDays));
  const [disposition, setDisposition] = useState(initial?.disposition ?? "retain");
  const [requiresReview, setRequiresReview] = useState(initial?.requiresReview ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setScope(initial?.scope ?? "workspace");
    setTarget(initial?.target ?? "");
    setRetentionDays(String(initial?.retentionDays ?? 30));
    setAutoArchiveDays(daysInput(initial?.autoArchiveDays));
    setAutoDeleteDays(daysInput(initial?.autoDeleteDays));
    setDisposition(initial?.disposition ?? "retain");
    setRequiresReview(initial?.requiresReview ?? false);
    setIsActive(initial?.isActive ?? true);
    setBusy(false);
  }, [open, initial]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Give the policy a name.");
      return;
    }
    const keep = Math.floor(Number(retentionDays));
    if (!Number.isFinite(keep) || keep < 1) {
      toast.error("Retention must be at least 1 day.");
      return;
    }
    const archive = parseDays(autoArchiveDays);
    const del = parseDays(autoDeleteDays);
    if (autoArchiveDays.trim() !== "" && archive === null) {
      toast.error("Auto-archive must be a whole number of days, or blank for off.");
      return;
    }
    if (autoDeleteDays.trim() !== "" && del === null) {
      toast.error("Auto-delete must be a whole number of days, or blank for off.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      name: name.trim(),
      scope,
      target: target.trim(),
      retentionDays: keep,
      autoArchiveDays: archive,
      autoDeleteDays: del,
      disposition,
      requiresReview,
      isActive,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit policy" : "Add retention policy"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            The reconciler sweep reads these rows — blank auto-archive/auto-delete means
            that step stays off.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Policy name" htmlFor="policy-name">
            <Input
              id="policy-name"
              className="bg-surface-card"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Client work — 90 days"
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Scope" htmlFor="policy-scope">
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger id="policy-scope" className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_SCOPE_FILTER_OPTIONS.filter((o) => o.value !== "all").map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Outcome" htmlFor="policy-disposition">
              <Select value={disposition} onValueChange={setDisposition}>
                <SelectTrigger id="policy-disposition" className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retain">Retain</SelectItem>
                  <SelectItem value="archive">Auto-archive</SelectItem>
                  <SelectItem value="delete">Auto-delete</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field
            label="Target"
            htmlFor="policy-target"
            hint="Folder, collection, or asset type this covers. Blank means the whole scope."
          >
            <Input
              id="policy-target"
              className="bg-surface-card"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Optional target"
              disabled={scope === "workspace"}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Keep (days)" htmlFor="policy-keep">
              <Input
                id="policy-keep"
                className="bg-surface-card"
                inputMode="numeric"
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="30"
              />
            </Field>
            <Field label="Archive after" htmlFor="policy-archive" hint="Blank = off.">
              <Input
                id="policy-archive"
                className="bg-surface-card"
                inputMode="numeric"
                value={autoArchiveDays}
                onChange={(e) => setAutoArchiveDays(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="Off"
              />
            </Field>
            <Field label="Delete after" htmlFor="policy-delete" hint="Blank = off.">
              <Input
                id="policy-delete"
                className="bg-surface-card"
                inputMode="numeric"
                value={autoDeleteDays}
                onChange={(e) => setAutoDeleteDays(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="Off"
              />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Disposition review</p>
              <p className="text-xs text-text-secondary">
                An operator signs off before this policy acts.
              </p>
            </div>
            <Switch checked={requiresReview} onCheckedChange={setRequiresReview} aria-label="Require disposition review" />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Policy active</p>
              <p className="text-xs text-text-secondary">Paused policies are skipped by the sweep.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Policy active" />
          </div>
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
            {editing ? "Save changes" : "Add policy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExceptionDialog({ open, onOpenChange, policies, onSubmit }) {
  const [policyId, setPolicyId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [targetLabel, setTargetLabel] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setPolicyId(policies[0]?.id ?? "");
    setTargetId("");
    setTargetLabel("");
    setReason("");
    setExpiresAt("");
    setApprovedBy("");
    setBusy(false);
  }, [open, policies]);

  const submit = async () => {
    if (!targetId.trim()) {
      toast.error("Name the asset or target this exception covers.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Give a reason — exceptions without one are denied at review.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      policyId: policyId || null,
      targetId: targetId.trim(),
      targetLabel: targetLabel.trim() || targetId.trim(),
      reason: reason.trim(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      approvedBy: approvedBy.trim(),
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>Add exception</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Carve one target out of a policy. An expiry hands it back to the schedule.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Policy" htmlFor="exception-policy">
            <Select value={policyId || "none"} onValueChange={(v) => setPolicyId(v === "none" ? "" : v)}>
              <SelectTrigger id="exception-policy" className="bg-surface-card">
                <SelectValue placeholder="Choose a policy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any policy</SelectItem>
                {policies.map((policy) => (
                  <SelectItem key={policy.id} value={policy.id}>
                    {policy.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target id" htmlFor="exception-target">
              <Input
                id="exception-target"
                className="bg-surface-card"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="Asset or folder id"
                autoFocus
              />
            </Field>
            <Field label="Display name" htmlFor="exception-label">
              <Input
                id="exception-label"
                className="bg-surface-card"
                value={targetLabel}
                onChange={(e) => setTargetLabel(e.target.value)}
                placeholder="Optional label"
              />
            </Field>
          </div>
          <Field label="Reason" htmlFor="exception-reason">
            <Textarea
              id="exception-reason"
              className="bg-surface-card"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this target exempt?"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Expires" htmlFor="exception-expires" hint="Blank means no expiry.">
              <Input
                id="exception-expires"
                className="bg-surface-card"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </Field>
            <Field label="Approved by" htmlFor="exception-approver">
              <Input
                id="exception-approver"
                className="bg-surface-card"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                placeholder="e.g. Dana (legal)"
              />
            </Field>
          </div>
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
            Add exception
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RetentionPoliciesScreen({ projectId }) {
  const [policies, setPolicies] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [holds, setHolds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [dispositionFilter, setDispositionFilter] = useState("all");
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listRetentionPolicies(projectId),
      listRetentionExceptions(projectId),
      listLegalHolds(projectId),
    ]).then(([policyRows, exceptionRows, holdRows]) => {
      if (!alive) return;
      setPolicies(policyRows ?? []);
      setExceptions(exceptionRows ?? []);
      setHolds(holdRows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const activeHolds = useMemo(() => holds.filter((h) => h.status === "active"), [holds]);

  const reviewQueue = useMemo(
    () => policies.filter((p) => p.requiresReview && p.isActive),
    [policies],
  );

  const stats = useMemo(
    () => [
      { label: "Policies", value: String(policies.length), footer: "schedules configured" },
      {
        label: "Active",
        value: String(policies.filter((p) => p.isActive).length),
        footer: "read by the sweep",
      },
      { label: "Exceptions", value: String(exceptions.length), footer: "targets carved out" },
      {
        label: "Pending review",
        value: String(reviewQueue.length),
        footer: "awaiting disposition sign-off",
      },
    ],
    [policies, exceptions, reviewQueue],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return policies.filter((policy) => {
      if (scopeFilter !== "all" && policy.scope !== scopeFilter) return false;
      if (dispositionFilter !== "all" && policy.disposition !== dispositionFilter) return false;
      if (needle && !`${policy.name} ${policy.target}`.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [policies, search, scopeFilter, dispositionFilter]);

  const filtersActive =
    scopeFilter !== "all" || dispositionFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setScopeFilter("all");
    setDispositionFilter("all");
    setSearch("");
  };

  const policyById = useMemo(() => {
    const map = new Map();
    for (const policy of policies) map.set(policy.id, policy);
    return map;
  }, [policies]);

  const openCreate = () => {
    setEditing(null);
    setPolicyDialogOpen(true);
  };

  const submitPolicy = async (draft) => {
    if (editing) {
      const previous = policies;
      setPolicies((rows) => rows.map((p) => (p.id === editing.id ? { ...p, ...draft } : p)));
      const saved = await updateRetentionPolicy(editing.id, draft);
      if (!saved) {
        setPolicies(previous);
        toast.error("Couldn't save the policy.");
        return false;
      }
      setPolicies((rows) => rows.map((p) => (p.id === saved.id ? saved : p)));
      toast.success("Policy saved.");
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      lastReviewedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setPolicies((rows) => [optimistic, ...rows]);
    const created = await createRetentionPolicy({ id, projectId, ...draft });
    if (!created) {
      setPolicies((rows) => rows.filter((p) => p.id !== id));
      toast.error("Couldn't add the policy.");
      return false;
    }
    setPolicies((rows) => rows.map((p) => (p.id === id ? created : p)));
    toast.success("Policy added.");
    return true;
  };

  const setPolicyActive = async (policy, isActive) => {
    const previous = policies;
    setPolicies((rows) => rows.map((p) => (p.id === policy.id ? { ...p, isActive } : p)));
    const saved = await updateRetentionPolicy(policy.id, { isActive });
    if (!saved) {
      setPolicies(previous);
      toast.error("Couldn't change that policy.");
      return;
    }
    setPolicies((rows) => rows.map((p) => (p.id === saved.id ? saved : p)));
    toast.success(`${saved.name} ${isActive ? "activated" : "paused"}.`);
  };

  const markReviewed = async (policy) => {
    const previous = policies;
    const stamp = new Date().toISOString();
    setPolicies((rows) =>
      rows.map((p) => (p.id === policy.id ? { ...p, lastReviewedAt: stamp } : p)),
    );
    const saved = await updateRetentionPolicy(policy.id, { lastReviewedAt: stamp });
    if (!saved) {
      setPolicies(previous);
      toast.error("Couldn't record the review.");
      return;
    }
    setPolicies((rows) => rows.map((p) => (p.id === saved.id ? saved : p)));
    toast.success(`Disposition reviewed for ${saved.name}.`);
  };

  const removePolicy = async (policy) => {
    const previous = policies;
    setPolicies((rows) => rows.filter((p) => p.id !== policy.id));
    const ok = await softDeleteRetentionPolicy(policy.id);
    if (!ok) {
      setPolicies(previous);
      toast.error("Couldn't delete the policy.");
      return;
    }
    toast.success("Policy deleted.");
  };

  const submitException = async (draft) => {
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setExceptions((rows) => [optimistic, ...rows]);
    const created = await createRetentionException({ id, projectId, ...draft });
    if (!created) {
      setExceptions((rows) => rows.filter((e) => e.id !== id));
      toast.error("Couldn't add the exception.");
      return false;
    }
    setExceptions((rows) => rows.map((e) => (e.id === id ? created : e)));
    toast.success("Exception added.");
    return true;
  };

  const removeException = async (exception) => {
    const previous = exceptions;
    setExceptions((rows) => rows.filter((e) => e.id !== exception.id));
    const ok = await softDeleteRetentionException(exception.id);
    if (!ok) {
      setExceptions(previous);
      toast.error("Couldn't delete the exception.");
      return;
    }
    toast.success("Exception deleted.");
  };

  const policyColumns = [
    {
      key: "policy",
      header: "Policy",
      render: (policy) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="max-w-[240px] truncate font-medium text-foreground">
              {policy.name || "Untitled policy"}
            </span>
            <StatusPill
              status={policy.isActive ? "active" : "paused"}
              map={POLICY_STATE_MAP}
            />
            {policy.requiresReview ? <Badge variant="neutral">Review</Badge> : null}
          </span>
          <span className="max-w-[300px] truncate text-xs text-text-secondary">
            {POLICY_SCOPE_MAP[policy.scope]?.label || policy.scope}
            {policy.target ? ` · ${policy.target}` : " · whole scope"}
          </span>
        </div>
      ),
    },
    {
      key: "schedule",
      header: "Schedule",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (policy) => scheduleSummary(policy),
    },
    {
      key: "disposition",
      header: "Outcome",
      render: (policy) => <StatusPill status={policy.disposition} map={DISPOSITION_MAP} />,
    },
    {
      key: "active",
      header: "Active",
      align: "right",
      className: "text-right",
      render: (policy) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={policy.isActive}
            aria-label={`Activate ${policy.name}`}
            onCheckedChange={(value) => setPolicyActive(policy, value)}
          />
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (policy) => (
        <ActionMenu
          label={`Actions for ${policy.name}`}
          items={[
            {
              icon: Pencil,
              label: "Edit",
              onSelect: () => {
                setEditing(policy);
                setPolicyDialogOpen(true);
              },
            },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              destructive: true,
              onSelect: () => removePolicy(policy),
            },
          ]}
        />
      ),
    },
  ];

  const exceptionColumns = [
    {
      key: "target",
      header: "Target",
      render: (exception) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="max-w-[240px] truncate text-sm font-medium text-foreground">
            {exception.targetLabel || exception.targetId}
          </span>
          <span className="max-w-[240px] truncate text-[11px] text-text-tertiary">
            {exception.policyId && policyById.get(exception.policyId)
              ? `Exempt from ${policyById.get(exception.policyId).name}`
              : "Exempt from any policy"}
          </span>
        </div>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      className: "hidden max-w-[280px] truncate text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (exception) => exception.reason || "—",
    },
    {
      key: "expires",
      header: "Expires",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (exception) => (exception.expiresAt ? formatDate(exception.expiresAt) : "Never"),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (exception) => (
        <ActionMenu
          label={`Actions for exception on ${exception.targetLabel}`}
          items={[
            {
              icon: Trash2,
              label: "Delete",
              destructive: true,
              onSelect: () => removeException(exception),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Retention Policies"
        description="Schedules the storage reconciler enforces. Active legal holds always override these policies."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> Add policy
          </Button>
        }
      />

      <StatsBar stats={stats} />

      {activeHolds.length > 0 && !loading ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-sm text-foreground">
            {activeHolds.length} active legal {activeHolds.length === 1 ? "hold" : "holds"}{" "}
            {activeHolds.length === 1 ? "suspends" : "suspend"} retention for{" "}
            {activeHolds.map((h) => h.name).filter(Boolean).join(", ") || "held assets"}.
            Held assets are excluded from auto-archive and auto-delete until released.
          </p>
        </div>
      ) : null}

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={scopeFilter}
            onValueChange={setScopeFilter}
            options={POLICY_SCOPE_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={dispositionFilter}
            onValueChange={setDispositionFilter}
            options={DISPOSITION_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search policies, targets…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading retention policies" />
        </div>
      ) : (
        <div className="space-y-8">
          <DataTable
            columns={policyColumns}
            data={filtered}
            getRowKey={(policy) => policy.id}
            onRowClick={(policy) => {
              setEditing(policy);
              setPolicyDialogOpen(true);
            }}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                {filtersActive ? (
                  <EmptyState
                    icon={CalendarClock}
                    title="No policies match these filters"
                    description="Try a different scope, outcome, or search term."
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
                    icon={CalendarClock}
                    title="No retention policies yet"
                    description="Without a schedule nothing auto-archives or auto-deletes — storage only grows."
                    action={
                      <Button
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={openCreate}
                      >
                        <Plus className="h-4 w-4" /> Add policy
                      </Button>
                    }
                  />
                )}
              </div>
            }
          />

          <SectionCard
            title="Disposition review"
            description="Policies that need an operator sign-off before the sweep acts on them."
            action={
              <Badge variant="neutral">
                {reviewQueue.length} pending
              </Badge>
            }
          >
            {reviewQueue.length === 0 ? (
              <p className="text-sm text-text-tertiary">
                Nothing awaiting review. Turn on “Disposition review” on a policy to hold
                its outcome for sign-off.
              </p>
            ) : (
              <div className="grid gap-2">
                {reviewQueue.map((policy) => (
                  <div
                    key={policy.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{policy.name}</p>
                      <p className="text-xs text-text-secondary">
                        {scheduleSummary(policy)}
                        {` · last reviewed ${policy.lastReviewedAt ? formatDate(policy.lastReviewedAt) : "never"}`}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="border-border bg-surface-subtle text-foreground hover:bg-surface-active"
                      onClick={() => markReviewed(policy)}
                    >
                      Mark reviewed
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Policy exceptions"
            description="Targets carved out of the schedule above. An expiry hands the target back to its policy."
            action={
              <Button
                variant="outline"
                className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                onClick={() => setExceptionDialogOpen(true)}
              >
                <Plus className="h-4 w-4" /> Add exception
              </Button>
            }
          >
            <DataTable
              columns={exceptionColumns}
              data={exceptions}
              getRowKey={(exception) => exception.id}
              empty={
                <EmptyState
                  icon={CalendarClock}
                  title="No exceptions"
                  description="Every target follows its policy until you carve one out."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => setExceptionDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" /> Add exception
                    </Button>
                  }
                />
              }
            />
          </SectionCard>

          <SectionCard
            title="Reconciler report"
            description={`What the storage sweep does with these rows. Soft-deleted assets older than ${RETENTION_SWEEP_DAYS} days are swept; the run itself lives server-side in lib/storage/reconcile.js.`}
          >
            <ul className="list-disc space-y-2 pl-5 text-sm text-text-secondary">
              <li>
                Pass 1 verifies every stored row still has its bytes, and marks rows whose
                objects are gone.
              </li>
              <li>
                Pass 2 removes orphaned staging objects older than a day that no row points
                at.
              </li>
              <li>
                Pass 3 sweeps soft-deleted rows past the {RETENTION_SWEEP_DAYS}-day window —
                honoring the auto-archive and auto-delete steps above, and skipping
                anything under an active legal hold or a live exception.
              </li>
            </ul>
          </SectionCard>
        </div>
      )}

      <PolicyDialog
        key={editing ? `policy:${editing.id}` : "policy:new"}
        open={policyDialogOpen}
        onOpenChange={setPolicyDialogOpen}
        initial={editing}
        onSubmit={submitPolicy}
      />

      <ExceptionDialog
        key={`exception:${exceptionDialogOpen ? "open" : "closed"}`}
        open={exceptionDialogOpen}
        onOpenChange={setExceptionDialogOpen}
        policies={policies.filter((p) => p.isActive)}
        onSubmit={submitException}
      />
    </MainScreenWrapper>
  );
}

export default RetentionPoliciesScreen;
