"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Layers, Plus, Trash2, X } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
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
import { ActionMenu } from "@geiger/ui/action-menu";
import { EmptyState, Field, SectionCard } from "@/components/internal/shared/screen_kit";
import {
  createStoragePool,
  deleteStoragePool,
  setStoragePoolMembers,
  updateStoragePool,
  backendErrorMessage,
} from "@/lib/storage/backends_client";
import {
  POOL_STRATEGY_MAP,
  POOL_STRATEGY_OPTIONS,
  WEIGHTED_STRATEGIES,
  BACKEND_KIND_MAP,
} from "./constants";

// The pool editor.
//
// A pool is an ordered set of backends plus the strategy that chooses among
// them. Order *is* priority here: the list is rendered in priority order and the
// up/down controls rewrite priorities as (index + 1) * 10, so an operator never
// has to reason about the numbers to express "this one first".
//
// Membership is replaced wholesale by PUT /api/storage/pools/[id], so every
// commit sends the complete list — never a patch of what changed.

const EMPTY_POOL = { name: "", strategy: "failover", enabled: true };

function renumber(members) {
  return members.map((member, i) => ({ ...member, priority: (i + 1) * 10 }));
}

// Remounted per open by the caller's key, so the draft seeds from props once.
function PoolDialog({ open, onOpenChange, pool, onSubmit }) {
  const editing = Boolean(pool);
  const [draft, setDraft] = useState(() =>
    pool ? { name: pool.name, strategy: pool.strategy, enabled: pool.enabled } : EMPTY_POOL,
  );
  const [busy, setBusy] = useState(false);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    if (busy) return;
    if (!draft.name.trim()) {
      toast.error("Give the pool a name.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({ ...draft, name: draft.name.trim() });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit pool" : "New pool"}</DialogTitle>
          <DialogDescription>
            A pool joins several backends behind one placement decision. Without one, every
            enabled backend forms an implicit failover pool.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Name" htmlFor="pool-name">
            <Input
              id="pool-name"
              className="bg-surface-card"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. EU primary"
              autoFocus
            />
          </Field>
          <Field label="Strategy" htmlFor="pool-strategy" hint={POOL_STRATEGY_MAP[draft.strategy]?.hint}>
            <Select value={draft.strategy} onValueChange={set("strategy")}>
              <SelectTrigger id="pool-strategy" className="bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POOL_STRATEGY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Enabled" hint="A disabled pool is ignored by placement.">
            <div className="flex h-9 items-center">
              <Switch checked={draft.enabled} onCheckedChange={set("enabled")} />
            </div>
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
            {editing ? "Save pool" : "Create pool"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({
  member,
  index,
  total,
  backend,
  weighted,
  onMove,
  onWeight,
  onReadOnly,
  onRemove,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5">
      <span className="w-6 shrink-0 text-center text-xs font-medium tabular-nums text-text-tertiary">
        {index + 1}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {backend ? backend.label || "Untitled backend" : "Unknown backend"}
          </span>
          {backend ? (
            <Badge variant="neutral">{BACKEND_KIND_MAP[backend.kind]?.label || backend.kind}</Badge>
          ) : null}
          {backend && backend.projectId === null ? (
            <Badge variant="info">Suite-wide</Badge>
          ) : null}
        </div>
        <span className="text-[11px] text-text-tertiary">priority {member.priority}</span>
      </div>

      {weighted ? (
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          Weight
          <Input
            className="h-8 w-16 bg-surface-subtle text-center tabular-nums"
            inputMode="numeric"
            defaultValue={String(member.weight)}
            onBlur={(e) => onWeight(e.target.value)}
            aria-label={`Weight for ${backend?.label || "member"}`}
          />
        </label>
      ) : null}

      <label className="flex items-center gap-2 text-xs text-text-secondary">
        Read-only
        <Switch
          checked={Boolean(member.readOnly)}
          onCheckedChange={onReadOnly}
          aria-label={`Read-only for ${backend?.label || "member"}`}
        />
      </label>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Move up"
          disabled={index === 0}
          className="text-text-secondary hover:text-foreground"
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Move down"
          disabled={index === total - 1}
          className="text-text-secondary hover:text-foreground"
          onClick={() => onMove(1)}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Remove member"
          className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function PoolEditor({ projectId, pools, setPools, backends, loading }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPool, setEditingPool] = useState(null);
  const [dialogToken, setDialogToken] = useState(0);

  const backendById = new Map(backends.map((backend) => [backend.id, backend]));

  const fail = (code, fallback) => toast.error(backendErrorMessage(code, fallback));

  const commitMembers = async (pool, nextMembers) => {
    const members = renumber(nextMembers);
    const previous = pool.members || [];
    setPools((rows) => rows.map((p) => (p.id === pool.id ? { ...p, members } : p)));
    let code = null;
    const saved = await setStoragePoolMembers(pool.id, members, { onError: (c) => (code = c) });
    if (saved) {
      setPools((rows) => rows.map((p) => (p.id === pool.id ? saved : p)));
      return;
    }
    setPools((rows) => rows.map((p) => (p.id === pool.id ? { ...p, members: previous } : p)));
    fail(code, "Couldn't save the pool members.");
  };

  const patchPool = async (pool, patch) => {
    const previous = pool;
    setPools((rows) => rows.map((p) => (p.id === pool.id ? { ...p, ...patch } : p)));
    let code = null;
    const saved = await updateStoragePool(pool.id, patch, { onError: (c) => (code = c) });
    if (saved) {
      setPools((rows) => rows.map((p) => (p.id === pool.id ? saved : p)));
      return true;
    }
    setPools((rows) => rows.map((p) => (p.id === pool.id ? previous : p)));
    fail(code, "Couldn't update the pool.");
    return false;
  };

  const submitPool = async (draft) => {
    if (editingPool) {
      const ok = await patchPool(editingPool, draft);
      if (ok) toast.success(`Saved “${draft.name}”.`);
      return ok;
    }
    let code = null;
    const created = await createStoragePool({ projectId, ...draft }, { onError: (c) => (code = c) });
    if (!created) {
      fail(code, "Couldn't create the pool.");
      return false;
    }
    setPools((rows) => [...rows, created]);
    toast.success(`Created “${created.name}”.`);
    return true;
  };

  const removePool = async (pool) => {
    const previous = pools;
    setPools((rows) => rows.filter((p) => p.id !== pool.id));
    let code = null;
    const ok = await deleteStoragePool(pool.id, { onError: (c) => (code = c) });
    if (ok) {
      toast.success(`Deleted “${pool.name}”.`);
      return;
    }
    setPools(previous);
    fail(code, "Couldn't delete the pool.");
  };

  const addMember = (pool, backendId) => {
    if (!backendId) return;
    const members = [...(pool.members || []), { backendId, priority: 0, weight: 1, readOnly: false }];
    commitMembers(pool, members);
  };

  const openCreate = () => {
    setEditingPool(null);
    setDialogToken((t) => t + 1);
    setDialogOpen(true);
  };

  return (
    <SectionCard
      title="Storage pools"
      description="Join several backends behind one placement decision. Reads always follow the backend recorded on the asset, never the pool."
      action={
        <Button
          variant="outline"
          className="border-border bg-surface-card text-foreground hover:bg-surface-active"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" /> New pool
        </Button>
      }
      bodyPadding={false}
    >
      {loading ? (
        <div className="flex items-center justify-center px-6 py-16">
          <LogoLoading size={48} aria-label="Loading storage pools" />
        </div>
      ) : pools.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No pools yet"
          description="Without a pool, every enabled backend forms an implicit failover pool."
          action={
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" /> New pool
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-border">
          {pools.map((pool) => {
            const members = pool.members || [];
            const weighted = WEIGHTED_STRATEGIES.includes(pool.strategy);
            const available = backends.filter(
              (backend) => !members.some((member) => member.backendId === backend.id),
            );

            return (
              <div key={pool.id} className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {pool.name}
                      </span>
                      <Badge variant={pool.enabled ? "success" : "neutral"}>
                        {pool.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 max-w-xl text-xs text-text-secondary">
                      {POOL_STRATEGY_MAP[pool.strategy]?.hint}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Select
                      value={pool.strategy}
                      onValueChange={(value) => patchPool(pool, { strategy: value })}
                    >
                      <SelectTrigger
                        className="h-9 w-[150px] bg-surface-card"
                        aria-label={`Strategy for ${pool.name}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POOL_STRATEGY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Switch
                      checked={pool.enabled}
                      onCheckedChange={(value) => patchPool(pool, { enabled: value })}
                      aria-label={`Enable ${pool.name}`}
                    />
                    <ActionMenu
                      label={`Actions for ${pool.name}`}
                      items={[
                        {
                          icon: Layers,
                          label: "Rename",
                          onSelect: () => {
                            setEditingPool(pool);
                            setDialogToken((t) => t + 1);
                            setDialogOpen(true);
                          },
                        },
                        { separator: true },
                        {
                          icon: Trash2,
                          label: "Delete pool",
                          destructive: true,
                          onSelect: () => removePool(pool),
                        },
                      ]}
                    />
                  </div>
                </div>

                {members.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-text-secondary">
                    No members yet — a pool with no members places nothing.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {members.map((member, index) => (
                      <MemberRow
                        key={member.backendId}
                        member={member}
                        index={index}
                        total={members.length}
                        backend={backendById.get(member.backendId)}
                        weighted={weighted}
                        onMove={(direction) => {
                          const next = [...members];
                          const target = index + direction;
                          if (target < 0 || target >= next.length) return;
                          [next[index], next[target]] = [next[target], next[index]];
                          commitMembers(pool, next);
                        }}
                        onWeight={(raw) => {
                          const weight = Math.max(1, Math.floor(Number(raw) || 1));
                          if (weight === member.weight) return;
                          commitMembers(
                            pool,
                            members.map((m) =>
                              m.backendId === member.backendId ? { ...m, weight } : m,
                            ),
                          );
                        }}
                        onReadOnly={(value) =>
                          commitMembers(
                            pool,
                            members.map((m) =>
                              m.backendId === member.backendId ? { ...m, readOnly: value } : m,
                            ),
                          )
                        }
                        onRemove={() =>
                          commitMembers(
                            pool,
                            members.filter((m) => m.backendId !== member.backendId),
                          )
                        }
                      />
                    ))}
                  </div>
                )}

                {available.length > 0 ? (
                  <Select value="" onValueChange={(value) => addMember(pool, value)}>
                    <SelectTrigger
                      className="h-9 w-full bg-surface-card sm:w-72"
                      aria-label={`Add a backend to ${pool.name}`}
                    >
                      <SelectValue placeholder="Add a backend…" />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((backend) => (
                        <SelectItem key={backend.id} value={backend.id}>
                          {backend.label || "Untitled backend"}
                          {backend.projectId === null ? " (suite-wide)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-text-tertiary">
                    Every backend is already a member of this pool.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PoolDialog
        key={`pool:${editingPool?.id ?? "new"}:${dialogToken}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pool={editingPool}
        onSubmit={submitPool}
      />
    </SectionCard>
  );
}

export default PoolEditor;
