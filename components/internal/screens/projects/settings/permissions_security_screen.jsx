"use client";

// Permissions & Security — workspace roles plus the security policy. Roles
// are new surface (Team only assigns them): create/edit/duplicate/delete
// through lib/supabase/rbac.js with optimistic updates and rollback. The
// security policy is advisory UI-gating until auth lands and persists through
// patchSection("security", …).

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CopyPlus, Lock, Plus, ShieldCheck, X } from "lucide-react";

import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SectionCard,
  SegmentedTabs,
  SettingRow,
  SettingsList,
} from "@/components/internal/shared/screen_kit";
import {
  CreateDialog,
  RowActions,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/internal/shared/module_kit";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Checkbox } from "@geiger/ui/checkbox";
import { Input } from "@geiger/ui/input";
import { Label } from "@geiger/ui/label";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { ALL_PERMISSION_KEYS, WORKSPACE_PERMISSIONS } from "@/lib/rbac";
import {
  createRole,
  listMembers,
  listRoles,
  setRoleProductPermissions,
  softDeleteRole,
  updateRole,
} from "@/lib/supabase/rbac";
import {
  ROLE_COLOR_OPTIONS,
  SESSION_TIMEOUT_OPTIONS,
  SHARE_EXPIRY_OPTIONS,
} from "./constants";
import { SelectSettingRow, useProjectSettings } from "./settings_kit";

const ROLE_TABS = [
  { value: "roles", label: "Roles" },
  { value: "security", label: "Security" },
];

const EMPTY_ROLE_DRAFT = {
  id: null,
  name: "",
  key: "",
  description: "",
  color: "slate",
  permissions: [],
};

function slugifyKey(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function RoleDialog({ open, onOpenChange, draft, onDraftChange, onSave, saving }) {
  const set = (key) => (value) => onDraftChange({ ...draft, [key]: value });
  const grouped = useMemo(() => {
    const map = new Map();
    for (const p of WORKSPACE_PERMISSIONS) {
      const group = p.group || "Other";
      if (!map.has(group)) map.set(group, []);
      map.get(group).push(p);
    }
    return [...map.entries()];
  }, []);

  const togglePermission = (key, checked) => {
    const next = new Set(draft.permissions || []);
    if (checked) next.add(key);
    else next.delete(key);
    onDraftChange({
      ...draft,
      permissions: ALL_PERMISSION_KEYS.filter((k) => next.has(k)),
    });
  };

  const toggleGroup = (permissions, checked) => {
    const next = new Set(draft.permissions || []);
    for (const p of permissions) {
      if (checked) next.add(p.key);
      else next.delete(p.key);
    }
    onDraftChange({
      ...draft,
      permissions: ALL_PERMISSION_KEYS.filter((k) => next.has(k)),
    });
  };

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={draft.id ? "Edit role" : "New role"}
      description="Roles gate navigation and controls; they don't secure data."
      submitLabel={draft.id ? "Save changes" : "Create role"}
      submitDisabled={saving}
      onSubmit={onSave}
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Name"
          value={draft.name}
          onChange={(v) => {
            const next = { ...draft, name: v };
            if (!draft.id) next.key = slugifyKey(v);
            onDraftChange(next);
          }}
          placeholder="e.g. Reviewer"
        />
        <TextField
          label="Key"
          value={draft.key}
          onChange={set("key")}
          placeholder="e.g. reviewer"
          hint={draft.id ? "Keys are immutable after create." : "Auto-slugged from the name."}
        />
      </div>
      <TextAreaField
        label="Description"
        value={draft.description}
        onChange={set("description")}
        placeholder="What can this role do?"
        rows={2}
      />
      <SelectField
        label="Colour"
        value={draft.color}
        onChange={set("color")}
        options={ROLE_COLOR_OPTIONS}
      />
      <div className="space-y-3">
        <Label className="text-xs font-medium text-foreground">
          Permissions ({(draft.permissions || []).length} granted)
        </Label>
        {grouped.map(([group, permissions]) => {
          const granted = permissions.filter((p) =>
            (draft.permissions || []).includes(p.key),
          ).length;
          const all = granted === permissions.length;
          return (
            <div
              key={group}
              className="rounded-lg border border-border bg-surface-card p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  {group}
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary hover:text-foreground">
                  <Checkbox
                    checked={all}
                    onCheckedChange={(v) =>
                      toggleGroup(permissions, v === true)
                    }
                    aria-label={`Select all ${group}`}
                  />
                  Select all
                </label>
              </div>
              <div className="grid gap-1">
                {permissions.map((p) => (
                  <label
                    key={p.key}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1 hover:bg-surface-hover"
                  >
                    <Checkbox
                      checked={(draft.permissions || []).includes(p.key)}
                      onCheckedChange={(v) => togglePermission(p.key, v === true)}
                      aria-label={p.label}
                    />
                    <span>
                      <span className="block text-sm text-foreground">
                        {p.label}
                      </span>
                      <span className="block font-mono text-[11px] text-text-tertiary">
                        {p.key}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </CreateDialog>
  );
}

function IpAllowlistEditor({ value, onSave }) {
  const [draft, setDraft] = useState("");
  const list = Array.isArray(value) ? value : [];

  const add = () => {
    const entry = draft.trim();
    if (!entry) return;
    if (list.includes(entry)) {
      toast.error("That entry is already listed.");
      return;
    }
    setDraft("");
    onSave([...list, entry]);
  };

  return (
    <div>
      {list.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {list.map((entry) => (
            <Badge
              key={entry}
              className="gap-1 border border-border bg-surface-card py-1 pl-2.5 pr-1.5 font-mono text-[11px] text-foreground"
            >
              {entry}
              <button
                type="button"
                aria-label={`Remove ${entry}`}
                onClick={() => onSave(list.filter((e) => e !== entry))}
                className="rounded p-0.5 text-text-secondary hover:bg-surface-active hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="e.g. 203.0.113.0/24"
          aria-label="IP allowlist entry"
          className="h-9 border-border bg-surface-card font-mono text-sm text-foreground"
        />
        <Button
          variant="outline"
          onClick={add}
          disabled={!draft.trim()}
          className="h-9 shrink-0 border-border bg-surface-card text-foreground hover:bg-surface-hover"
        >
          Add
        </Button>
      </div>
    </div>
  );
}

export function PermissionsSecurityScreen({ projectId }) {
  const { setTab } = useWorkspaceUrl();
  const { settings, loading: settingsLoading, patchSection } =
    useProjectSettings(projectId);
  const [tab, setLocalTab] = useState("roles");
  const [roles, setRoles] = useState([]);
  const [members, setMembers] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_ROLE_DRAFT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([listRoles(projectId), listMembers(projectId)]).then(
      ([r, m]) => {
        if (!alive) return;
        setRoles(r ?? []);
        setMembers(m ?? []);
        setRolesLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const memberCount = useMemo(() => {
    const map = new Map();
    for (const m of members) {
      if (!m.roleId) continue;
      map.set(m.roleId, (map.get(m.roleId) || 0) + 1);
    }
    return (roleId) => map.get(roleId) || 0;
  }, [members]);

  const hasSystemRoles = roles.some((r) => r.isSystem);

  const openCreate = (seed) => {
    setDraft({ ...EMPTY_ROLE_DRAFT, ...(seed || {}) });
    setDialogOpen(true);
  };

  const openEdit = (role) => {
    if (role.isSystem) return;
    setDraft({
      id: role.id,
      name: role.name,
      key: role.key,
      description: role.description,
      color: role.color,
      permissions: [...(role.permissions || [])],
    });
    setDialogOpen(true);
  };

  const openDuplicate = (role) => {
    openCreate({
      name: `Copy of ${role.name}`,
      key: `${role.key}-copy`,
      description: role.description,
      color: role.color,
      permissions: [...(role.permissions || [])],
    });
  };

  const handleSave = async () => {
    const name = draft.name.trim();
    const key = (draft.id ? draft.key : slugifyKey(draft.key || draft.name)).trim();
    if (!name) {
      toast.error("Give the role a name first.");
      return;
    }
    if (!key) {
      toast.error("Give the role a key first.");
      return;
    }
    if (
      roles.some(
        (r) => r.key === key && (!draft.id || r.id !== draft.id),
      )
    ) {
      toast.error("That key is already in use.");
      return;
    }
    setSaving(true);
    if (draft.id) {
      const prev = roles;
      setRoles((rows) =>
        rows.map((r) =>
          r.id === draft.id
            ? { ...r, name, description: draft.description, color: draft.color, permissions: draft.permissions }
            : r,
        ),
      );
      const updated = await updateRole(draft.id, {
        name,
        description: draft.description,
        color: draft.color,
      });
      const perms = updated
        ? await setRoleProductPermissions(draft.id, draft.permissions)
        : null;
      setSaving(false);
      if (updated && perms) {
        setRoles((rows) => rows.map((r) => (r.id === draft.id ? perms : r)));
        setDialogOpen(false);
        toast.success(`Role "${name}" saved.`);
      } else {
        setRoles(prev);
        toast.error("Couldn't save the role.");
      }
      return;
    }
    const optimistic = {
      id: crypto.randomUUID(),
      projectId,
      key,
      name,
      description: draft.description,
      color: draft.color,
      permissions: draft.permissions,
      productPermissions: (draft.permissions || []).filter((k) =>
        String(k).startsWith("assets."),
      ),
      isWildcard: (draft.permissions || []).includes("*"),
      isSystem: false,
      sort: roles.length,
      createdAt: new Date().toISOString(),
    };
    setRoles((rows) => [optimistic, ...rows]);
    const created = await createRole(projectId, {
      id: optimistic.id,
      key,
      name,
      description: draft.description,
      color: draft.color,
    });
    const perms = created
      ? await setRoleProductPermissions(created.id, draft.permissions)
      : null;
    setSaving(false);
    if (created && perms) {
      setRoles((rows) => rows.map((r) => (r.id === optimistic.id ? perms : r)));
      setDialogOpen(false);
      toast.success(`Role "${name}" created.`);
    } else {
      setRoles((rows) => rows.filter((r) => r.id !== optimistic.id));
      toast.error("Couldn't create the role.");
    }
  };

  const handleDelete = async (role) => {
    if (role.isSystem || memberCount(role.id) > 0) return;
    const prev = roles;
    setRoles((rows) => rows.filter((r) => r.id !== role.id));
    const ok = await softDeleteRole(role.id);
    if (ok) {
      toast.success(`Role "${role.name}" deleted.`);
    } else {
      setRoles(prev);
      toast.error("Couldn't delete the role.");
    }
  };

  const roleColumns = [
    {
      key: "role",
      header: "Role",
      render: (r) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <span className="truncate">{r.name}</span>
            {r.isSystem ? (
              <Lock
                className="h-3.5 w-3.5 shrink-0 text-text-tertiary"
                aria-label="System role"
              />
            ) : null}
          </p>
          <p className="truncate font-mono text-[11px] text-text-tertiary">
            {r.key}
          </p>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      className: "hidden max-w-[240px] truncate text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (r) => r.description || "—",
    },
    {
      key: "permissions",
      header: "Permissions",
      render: (r) => (
        <Badge className="border border-border bg-surface-card px-1.5 py-0 text-[10px] text-foreground">
          {(r.permissions || []).length}
        </Badge>
      ),
    },
    {
      key: "members",
      header: "Members",
      className: "hidden sm:table-cell text-xs text-text-secondary",
      headClassName: "hidden sm:table-cell",
      render: (r) => String(memberCount(r.id)),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            onEdit={r.isSystem ? undefined : () => openEdit(r)}
            onDelete={
              r.isSystem || memberCount(r.id) > 0
                ? undefined
                : () => handleDelete(r)
            }
            deleteLabel="Delete"
            extra={
              r.isSystem
                ? []
                : [
                    {
                      icon: CopyPlus,
                      label: "Duplicate",
                      onSelect: () => openDuplicate(r),
                    },
                  ]
            }
          />
        </div>
      ),
    },
  ];

  const loading = settingsLoading || rolesLoading;

  if (loading) {
    return (
      <SecondaryScreenWrapper>
        <ScreenHeader
          title="Permissions & Security"
          description="Roles, access policy, and the security rules this project enforces."
        />
        <LoadingArea size={56} label="Loading permissions" />
      </SecondaryScreenWrapper>
    );
  }

  const security = settings.security ?? {};

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Permissions & Security"
        description="Roles, access policy, and the security rules this project enforces."
        actions={
          tab === "roles" ? (
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => openCreate()}
            >
              <Plus className="h-4 w-4" />
              New role
            </Button>
          ) : null
        }
      />

      <SegmentedTabs tabs={ROLE_TABS} value={tab} onChange={setLocalTab} />

      {tab === "roles" ? (
        <>
          {hasSystemRoles ? (
            <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <Lock className="h-3.5 w-3.5" />
              System roles are built in — they can&apos;t be edited or deleted.
            </p>
          ) : null}
          <DataTable
            columns={roleColumns}
            data={roles}
            getRowKey={(r) => r.id}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={ShieldCheck}
                  title="No roles yet"
                  description="Create a role to control who can do what."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => openCreate()}
                    >
                      <Plus className="h-4 w-4" />
                      New role
                    </Button>
                  }
                />
              </div>
            }
          />
        </>
      ) : (
        <>
          <SectionCard
            title="Security policy"
            description="Rules this project enforces."
          >
            <SettingsList>
              <SettingRow
                title="Require signed URLs for delivery"
                description="Delivery links need a valid signature."
                checked={Boolean(security.requireSignedUrls)}
                onCheckedChange={(v) =>
                  patchSection("security", { requireSignedUrls: v === true })
                }
              />
              <SettingRow
                title="Share links require a password"
                description="New share links are password-protected by default."
                checked={Boolean(security.shareRequirePassword)}
                onCheckedChange={(v) =>
                  patchSection("security", { shareRequirePassword: v === true })
                }
              />
              <SelectSettingRow
                title="Share link default expiry"
                description="How long new share links stay valid."
                value={security.shareDefaultExpiry}
                options={SHARE_EXPIRY_OPTIONS}
                onSave={(next) =>
                  patchSection("security", { shareDefaultExpiry: next })
                }
              />
              <SettingRow
                title="Share links allow downloads"
                description="Recipients can download by default."
                checked={security.shareAllowDownloads !== false}
                onCheckedChange={(v) =>
                  patchSection("security", { shareAllowDownloads: v === true })
                }
              />
              <SettingRow
                title="Apply watermark by default"
                description="New share links watermark previews."
                checked={Boolean(security.shareApplyWatermark)}
                onCheckedChange={(v) =>
                  patchSection("security", { shareApplyWatermark: v === true })
                }
              />
              <SettingRow
                title="Allow public galleries"
                description="Galleries can be opened without signing in."
                checked={Boolean(security.allowPublicGalleries)}
                onCheckedChange={(v) =>
                  patchSection("security", { allowPublicGalleries: v === true })
                }
              />
              <SelectSettingRow
                title="Session timeout"
                description="Sign members out after this long idle."
                value={security.sessionTimeout}
                options={SESSION_TIMEOUT_OPTIONS}
                onSave={(next) =>
                  patchSection("security", { sessionTimeout: next })
                }
              />
              <SettingRow
                title="Enforce two-factor for members"
                description="Members must enable 2FA to access the project."
                checked={Boolean(security.enforceTwoFactor)}
                onCheckedChange={(v) =>
                  patchSection("security", { enforceTwoFactor: v === true })
                }
              />
              <SettingRow
                title="IP allowlist"
                description="Empty means unrestricted."
                control={
                  <div className="w-full max-w-xs">
                    <IpAllowlistEditor
                      value={security.ipAllowlist}
                      onSave={(next) =>
                        patchSection("security", { ipAllowlist: next })
                      }
                    />
                  </div>
                }
                className="max-sm:flex-col max-sm:items-stretch"
              />
              <SettingRow
                title="Virus-scan uploads"
                description="Scan files before they enter the library."
                checked={security.virusScanUploads !== false}
                onCheckedChange={(v) =>
                  patchSection("security", { virusScanUploads: v === true })
                }
              />
              <SettingRow
                title="Block re-download of expired shares"
                description="Expired links stop serving files entirely."
                checked={security.blockExpiredRedownload !== false}
                onCheckedChange={(v) =>
                  patchSection("security", {
                    blockExpiredRedownload: v === true,
                  })
                }
              />
            </SettingsList>
          </SectionCard>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-xs leading-relaxed text-text-secondary">
              These rules are advisory UI-gating until auth lands — they
              hide and disable controls but don&apos;t secure data. Manage
              who&apos;s in the workspace from the Team screen.
            </p>
            <Button
              variant="outline"
              onClick={() => setTab("Team")}
              className="shrink-0 border-border bg-surface-card text-foreground hover:bg-surface-hover"
            >
              Open Team
            </Button>
          </div>
        </>
      )}

      <RoleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={draft}
        onDraftChange={setDraft}
        onSave={handleSave}
        saving={saving}
      />
    </SecondaryScreenWrapper>
  );
}

export default PermissionsSecurityScreen;
