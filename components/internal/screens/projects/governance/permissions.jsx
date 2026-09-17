"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Plus, ShieldCheck, Trash2, Pencil } from "lucide-react";
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
import { WORKSPACE_PERMISSIONS } from "@/lib/rbac";
import { listRoles } from "@/lib/supabase/rbac";
import {
  createPermissionOverride,
  listPermissionOverrides,
  softDeletePermissionOverride,
  updatePermissionOverride,
} from "@/lib/supabase/governance";
import {
  EFFECT_FILTER_OPTIONS,
  OVERRIDE_EFFECT_MAP,
  OVERRIDE_SCOPE_MAP,
  SCOPE_FILTER_OPTIONS,
} from "./constants";

// Permissions — control access from workspace to individual assets.
//
// The permission catalog is driven off WORKSPACE_PERMISSIONS in lib/rbac.js
// (dot-namespaced keys) and workspace roles off lib/supabase/rbac.js — this
// screen never invents a parallel list. The rows it owns are per-scope
// overrides (folder, collection, asset, portal, field-level) that refine a
// role's workspace grant.
//
// All gating here is advisory UI gating only: it hides and disables controls,
// it does not secure data.

const CATALOG_BY_KEY = new Map(WORKSPACE_PERMISSIONS.map((p) => [p.key, p]));
const CATALOG_GROUP = new Map(WORKSPACE_PERMISSIONS.map((p) => [p.key, p.group || "Other"]));

function groupedPermissions(keys) {
  const groups = new Map();
  for (const key of keys) {
    const group = CATALOG_GROUP.get(key) || "Other";
    const list = groups.get(group) || [];
    list.push({ key, label: CATALOG_BY_KEY.get(key)?.label || key });
    groups.set(group, list);
  }
  return [...groups.entries()];
}

function permissionLabel(key) {
  return CATALOG_BY_KEY.get(key)?.label || key;
}

function roleNameOf(roles, override) {
  const role = roles.find((r) => r.id === override.roleId);
  if (role) return role.name;
  if (override.roleKey) {
    const byKey = roles.find((r) => r.key === override.roleKey);
    if (byKey) return byKey.name;
    return override.roleKey;
  }
  return "—";
}

const EMPTY_DRAFT = {
  scope: "folder",
  targetId: "",
  targetLabel: "",
  fieldName: "",
  roleId: "",
  permissionKey: "",
  effect: "allow",
  note: "",
};

function OverrideDialog({ open, onOpenChange, initial, roles, onSubmit }) {
  const editing = Boolean(initial);
  const [scope, setScope] = useState(initial?.scope ?? "folder");
  const [targetId, setTargetId] = useState(initial?.targetId ?? "");
  const [targetLabel, setTargetLabel] = useState(initial?.targetLabel ?? "");
  const [fieldName, setFieldName] = useState(initial?.fieldName ?? "");
  const [roleId, setRoleId] = useState(initial?.roleId ?? "");
  const [permissionKey, setPermissionKey] = useState(initial?.permissionKey ?? "");
  const [effect, setEffect] = useState(initial?.effect ?? "allow");
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setScope(initial?.scope ?? "folder");
    setTargetId(initial?.targetId ?? "");
    setTargetLabel(initial?.targetLabel ?? "");
    setFieldName(initial?.fieldName ?? "");
    setRoleId(initial?.roleId ?? "");
    setPermissionKey(initial?.permissionKey ?? "");
    setEffect(initial?.effect ?? "allow");
    setNote(initial?.note ?? "");
    setBusy(false);
  }, [open, initial]);

  const submit = async () => {
    if (!roleId) {
      toast.error("Pick the role this override applies to.");
      return;
    }
    if (!permissionKey) {
      toast.error("Pick the permission this override changes.");
      return;
    }
    if (scope !== "workspace" && !targetId.trim() && !targetLabel.trim()) {
      toast.error("Name the folder, collection, asset, or portal this applies to.");
      return;
    }
    if (scope === "field" && !fieldName.trim()) {
      toast.error("Name the metadata field this applies to.");
      return;
    }
    setBusy(true);
    const role = roles.find((r) => r.id === roleId);
    const ok = await onSubmit({
      scope,
      targetId: targetId.trim(),
      targetLabel: targetLabel.trim() || targetId.trim(),
      fieldName: scope === "field" ? fieldName.trim() : "",
      roleId,
      roleKey: role?.key || "",
      permissionKey,
      effect,
      note: note.trim(),
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit override" : "Add override"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Refine one role&apos;s workspace grant for a narrower scope. Deny wins over allow.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Scope" htmlFor="override-scope">
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger id="override-scope" className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_FILTER_OPTIONS.filter((o) => o.value !== "all").map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Effect" htmlFor="override-effect">
              <Select value={effect} onValueChange={setEffect}>
                <SelectTrigger id="override-effect" className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">Allow</SelectItem>
                  <SelectItem value="deny">Deny</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target id" htmlFor="override-target" hint="Folder, collection, asset, or portal id.">
              <Input
                id="override-target"
                className="bg-surface-card"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="e.g. Summer 2026"
                disabled={scope === "workspace"}
              />
            </Field>
            <Field label="Display name" htmlFor="override-label" hint="Shown in the table.">
              <Input
                id="override-label"
                className="bg-surface-card"
                value={targetLabel}
                onChange={(e) => setTargetLabel(e.target.value)}
                placeholder="Optional label"
                disabled={scope === "workspace"}
              />
            </Field>
          </div>
          {scope === "field" ? (
            <Field label="Field name" htmlFor="override-field" hint="The metadata field key, e.g. usage_rights.">
              <Input
                id="override-field"
                className="bg-surface-card font-mono"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="usage_rights"
              />
            </Field>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role" htmlFor="override-role">
              <Select value={roleId || "none"} onValueChange={(v) => setRoleId(v === "none" ? "" : v)}>
                <SelectTrigger id="override-role" className="bg-surface-card">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose a role</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Permission" htmlFor="override-permission">
              <Select value={permissionKey || "none"} onValueChange={(v) => setPermissionKey(v === "none" ? "" : v)}>
                <SelectTrigger id="override-permission" className="bg-surface-card">
                  <SelectValue placeholder="Choose a permission" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose a permission</SelectItem>
                  {WORKSPACE_PERMISSIONS.map((perm) => (
                    <SelectItem key={perm.key} value={perm.key}>
                      {perm.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Note" htmlFor="override-note" hint="Why this exception exists.">
            <Textarea
              id="override-note"
              className="bg-surface-card"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Client review portal — members may view, never download."
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
            {editing ? "Save changes" : "Add override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PermissionsScreen({ projectId }) {
  const [roles, setRoles] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [effectFilter, setEffectFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listRoles(projectId), listPermissionOverrides(projectId)]).then(
      ([roleRows, overrideRows]) => {
        if (!alive) return;
        setRoles(roleRows ?? []);
        setOverrides(overrideRows ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const stats = useMemo(
    () => [
      { label: "Roles", value: String(roles.length), footer: "workspace grants" },
      {
        label: "Catalog",
        value: String(WORKSPACE_PERMISSIONS.length),
        footer: "permission keys in lib/rbac.js",
      },
      { label: "Overrides", value: String(overrides.length), footer: "scoped refinements" },
      {
        label: "Denies",
        value: String(overrides.filter((o) => o.effect === "deny").length),
        footer: "explicit refusals",
      },
    ],
    [roles, overrides],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return overrides.filter((override) => {
      if (scopeFilter !== "all" && override.scope !== scopeFilter) return false;
      if (effectFilter !== "all" && override.effect !== effectFilter) return false;
      if (
        needle &&
        !`${override.targetLabel} ${override.targetId} ${override.fieldName} ${permissionLabel(override.permissionKey)} ${override.permissionKey} ${roleNameOf(roles, override)}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [overrides, roles, search, scopeFilter, effectFilter]);

  const filtersActive =
    scopeFilter !== "all" || effectFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setScopeFilter("all");
    setEffectFilter("all");
    setSearch("");
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const submitOverride = async (draft) => {
    if (editing) {
      const previous = overrides;
      setOverrides((rows) => rows.map((o) => (o.id === editing.id ? { ...o, ...draft } : o)));
      const saved = await updatePermissionOverride(editing.id, draft);
      if (!saved) {
        setOverrides(previous);
        toast.error("Couldn't save the override.");
        return false;
      }
      setOverrides((rows) => rows.map((o) => (o.id === saved.id ? saved : o)));
      toast.success("Override saved.");
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...EMPTY_DRAFT,
      ...draft,
    };
    setOverrides((rows) => [optimistic, ...rows]);
    const created = await createPermissionOverride({ id, projectId, ...draft });
    if (!created) {
      setOverrides((rows) => rows.filter((o) => o.id !== id));
      toast.error("Couldn't add the override.");
      return false;
    }
    setOverrides((rows) => rows.map((o) => (o.id === id ? created : o)));
    toast.success("Override added.");
    return true;
  };

  const removeOverride = async (override) => {
    const previous = overrides;
    setOverrides((rows) => rows.filter((o) => o.id !== override.id));
    const ok = await softDeletePermissionOverride(override.id);
    if (!ok) {
      setOverrides(previous);
      toast.error("Couldn't delete the override.");
      return;
    }
    toast.success("Override deleted.");
  };

  const columns = [
    {
      key: "scope",
      header: "Scope",
      render: (override) => (
        <div className="flex min-w-0 flex-col gap-1">
          <StatusPill status={override.scope} map={OVERRIDE_SCOPE_MAP} />
          <span className="max-w-[240px] truncate text-xs text-text-secondary">
            {override.scope === "workspace"
              ? "Whole workspace"
              : override.targetLabel || override.targetId || "Untargeted"}
            {override.scope === "field" && override.fieldName ? ` · ${override.fieldName}` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "permission",
      header: "Permission",
      render: (override) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="max-w-[260px] truncate text-sm font-medium text-foreground">
            {permissionLabel(override.permissionKey)}
          </span>
          <span className="max-w-[260px] truncate font-mono text-[11px] text-text-tertiary">
            {override.permissionKey}
          </span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (override) => (
        <span className="text-xs text-text-secondary">{roleNameOf(roles, override)}</span>
      ),
    },
    {
      key: "effect",
      header: "Effect",
      render: (override) => <StatusPill status={override.effect} map={OVERRIDE_EFFECT_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (override) => (
        <ActionMenu
          label={`Actions for override on ${override.targetLabel || override.scope}`}
          items={[
            {
              icon: Pencil,
              label: "Edit",
              onSelect: () => {
                setEditing(override);
                setDialogOpen(true);
              },
            },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              destructive: true,
              onSelect: () => removeOverride(override),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Permissions"
        description="Control access from workspace to individual assets. Gating here is advisory UI only."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> Add override
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <SectionCard
        title="Workspace roles"
        description="Base grants from the system role catalog. Overrides below refine these per scope — a deny always wins over an allow."
      >
        {loading ? (
          <div className="flex items-center justify-center px-6 py-10">
            <LogoLoading size={40} aria-label="Loading roles" />
          </div>
        ) : roles.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No roles yet"
            description="Roles are seeded on workspace setup — nothing to refine until then."
          />
        ) : (
          <div className="grid gap-3">
            {roles.map((role) => (
              <div
                key={role.id}
                className="rounded-lg border border-border bg-surface-card px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{role.name}</span>
                  {role.isSystem ? <Badge variant="info">System</Badge> : null}
                  {role.isWildcard ? (
                    <Badge variant="purple">Full access</Badge>
                  ) : (
                    <Badge variant="neutral">
                      {role.productPermissions.length}{" "}
                      {role.productPermissions.length === 1 ? "permission" : "permissions"}
                    </Badge>
                  )}
                </div>
                {role.description ? (
                  <p className="mt-0.5 text-xs text-text-secondary">{role.description}</p>
                ) : null}
                {!role.isWildcard && role.productPermissions.length > 0 ? (
                  <div className="mt-2 grid gap-2">
                    {groupedPermissions(role.productPermissions).map(([group, perms]) => (
                      <div key={group}>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                          {group} · {perms.length}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {perms.map((perm) => (
                            <Badge key={perm.key} variant="neutral" title={perm.key}>
                              {perm.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={scopeFilter}
            onValueChange={setScopeFilter}
            options={SCOPE_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={effectFilter}
            onValueChange={setEffectFilter}
            options={EFFECT_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search targets, permissions, roles…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading permissions" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(override) => override.id}
          onRowClick={(override) => {
            setEditing(override);
            setDialogOpen(true);
          }}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              {filtersActive ? (
                <EmptyState
                  icon={KeyRound}
                  title="No overrides match these filters"
                  description="Try a different scope, effect, or search term."
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
                  icon={KeyRound}
                  title="No overrides yet"
                  description="Workspace roles apply everywhere until you carve out a folder, collection, asset, portal, or field exception."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={openCreate}
                    >
                      <Plus className="h-4 w-4" /> Add override
                    </Button>
                  }
                />
              )}
            </div>
          }
        />
      )}

      <OverrideDialog
        key={editing ? `override:${editing.id}` : "override:new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        roles={roles}
        onSubmit={submitOverride}
      />
    </MainScreenWrapper>
  );
}

export default PermissionsScreen;
