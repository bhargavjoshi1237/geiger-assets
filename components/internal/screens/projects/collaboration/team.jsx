"use client";

import {
  ActionMenu,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
  LogoLoading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import {
  Ban,
  ChevronDown,
  Copy,
  Mail,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  SectionCard,
  SettingRow,
  SettingsList,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  INVITE_STATUS_MAP,
  INVITE_TYPE_FILTER_OPTIONS,
  INVITE_TYPE_MAP,
  INVITE_TYPE_OPTIONS,
  SHARE_EXPIRY_OPTIONS,
  TEAM_MEMBER_STATUS_MAP,
  expiryTtlToIso,
  formatDate,
  inviteStatus,
} from "./constants";
import {
  createInvite,
  listInvites,
  softDeleteInvite,
  updateInvite,
} from "@/lib/supabase/collaboration";
import {
  assignRole,
  listMembers,
  listRoles,
  revokeMember,
  syncTeamFromOrg,
} from "@/lib/supabase/rbac";
import { SYSTEM_ROLE_SEED, getRoleById } from "@/lib/rbac";

function FilterDropdown({ value, onValueChange, options, placeholder, icon: Icon }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-8 gap-1.5 rounded-md border-border bg-surface-card px-3 text-xs font-medium text-foreground hover:bg-surface-subtle"
        >
          {Icon ? <Icon className="h-3.5 w-3.5 text-text-secondary" /> : null}
          {options.find((o) => o.value === value)?.label || placeholder}
          <ChevronDown className="h-3 w-3 text-text-secondary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="border-border bg-surface-subtle text-foreground" align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="cursor-pointer text-xs focus:bg-surface-hover focus:text-foreground"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const EMPTY_DRAFT = {
  email: "",
  name: "",
  roleValue: "",
  inviteType: "member",
  message: "",
  expiryTtl: "604800",
};

function InviteDialog({ open, onOpenChange, onInvite, roleOptions }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [error, setError] = useState("");
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.email.trim() || !/.+@.+\..+/.test(draft.email.trim())) {
      setError("A valid email address is required.");
      return;
    }
    onInvite({ ...draft, email: draft.email.trim(), name: draft.name.trim() });
    setDraft(EMPTY_DRAFT);
    setError("");
    onOpenChange(false);
  };

  const close = (next) => {
    if (!next) {
      setDraft(EMPTY_DRAFT);
      setError("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Invite collaborator</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Invite a member, a guest, or an external reviewer to this workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="invite-email">
              <Input
                id="invite-email"
                value={draft.email}
                onChange={(e) => set("email")(e.target.value)}
                placeholder="teammate@studio.com"
                className="border-border bg-surface-card text-foreground"
              />
            </Field>
            <Field label="Name" htmlFor="invite-name">
              <Input
                id="invite-name"
                value={draft.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="Optional display name"
                className="border-border bg-surface-card text-foreground"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role">
              <Select value={draft.roleValue} onValueChange={set("roleValue")}>
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle text-foreground">
                  {roleOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Type">
              <Select value={draft.inviteType} onValueChange={set("inviteType")}>
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle text-foreground">
                  {INVITE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Message" htmlFor="invite-message">
            <Textarea
              id="invite-message"
              value={draft.message}
              onChange={(e) => set("message")(e.target.value)}
              placeholder="Why are they being invited?"
              className="min-h-20 border-border bg-surface-card text-foreground"
            />
          </Field>
          <Field label="Invite expires">
            <Select value={draft.expiryTtl} onValueChange={set("expiryTtl")}>
              <SelectTrigger className="border-border bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-surface-subtle text-foreground">
                {SHARE_EXPIRY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
            onClick={() => close(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function inviteUrl(id) {
  if (typeof window === "undefined") return `/invite/${id}`;
  return new URL(`/invite/${id}`, window.location.origin).toString();
}

export function TeamScreen({ projectId }) {
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [inviteTypeFilter, setInviteTypeFilter] = useState("all");
  const [showInvite, setShowInvite] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([listMembers(projectId), listRoles(projectId), listInvites(projectId)]).then(
      ([memberRows, roleRows, inviteRows]) => {
        if (!alive) return;
        setMembers(memberRows ?? []);
        setRoles(roleRows ?? []);
        setInvites(inviteRows ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Role assignment is driven off the live catalog, falling back to the seed
  // catalog in lib/rbac.js — role names are never hardcoded here.
  const catalog = roles.length ? roles : SYSTEM_ROLE_SEED;
  const roleOptions = useMemo(
    () =>
      catalog.map((r) => ({
        value: r.id ?? r.key,
        label: r.name ?? r.key,
      })),
    [catalog],
  );
  const roleFilterOptions = useMemo(
    () => [{ value: "all", label: "All roles" }, ...roleOptions],
    [roleOptions],
  );

  const roleOf = (member) =>
    getRoleById(catalog, member.roleId) ||
    catalog.find((r) => r.key === member.roleKey) ||
    null;

  const filteredMembers = useMemo(() => {
    let result = [...members];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          (m.name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q),
      );
    }
    if (roleFilter !== "all") {
      result = result.filter((m) => m.roleId === roleFilter || m.roleKey === roleFilter);
    }
    return result;
  }, [members, search, roleFilter]);

  const filteredInvites = useMemo(() => {
    let result = [...invites];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          (i.email || "").toLowerCase().includes(q) || (i.name || "").toLowerCase().includes(q),
      );
    }
    if (inviteTypeFilter !== "all") result = result.filter((i) => i.inviteType === inviteTypeFilter);
    return result;
  }, [invites, search, inviteTypeFilter]);

  const stats = useMemo(
    () => [
      { label: "Members", value: String(members.length), footer: "workspace collaborators" },
      {
        label: "Pending invites",
        value: String(invites.filter((i) => inviteStatus(i) === "pending").length),
        footer: "awaiting a response",
      },
      {
        label: "External reviewers",
        value: String(
          invites.filter((i) => i.inviteType === "reviewer" && inviteStatus(i) === "pending").length,
        ),
        footer: "outside the workspace",
      },
      { label: "Roles", value: String(catalog.length), footer: "in the catalog" },
    ],
    [members, invites, catalog],
  );

  const hasActiveFilters = roleFilter !== "all" || Boolean(search);

  const clearFilters = () => {
    setRoleFilter("all");
    setSearch("");
  };

  const handleAssign = async (member, roleId) => {
    if (!roleId || member.roleId === roleId) return;
    const role = getRoleById(catalog, roleId);
    const prev = members;
    setMembers((rows) =>
      rows.map((m) =>
        m.userId === member.userId
          ? { ...m, roleId, roleKey: role?.key ?? m.roleKey, roleName: role?.name ?? m.roleName }
          : m,
      ),
    );
    const ok = await assignRole(projectId, member.userId, roleId);
    if (ok) toast.success(`Updated ${member.name || member.email}'s role`);
    else {
      setMembers(prev);
      toast.error("Couldn't assign that role.");
    }
  };

  const handleRevoke = async (member) => {
    const prev = members;
    setMembers((rows) => rows.filter((m) => m.userId !== member.userId));
    const ok = await revokeMember(projectId, member.userId);
    if (ok) toast.success(`Removed ${member.name || member.email}`);
    else {
      setMembers(prev);
      toast.error("Couldn't remove that member.");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    const count = await syncTeamFromOrg(projectId);
    setSyncing(false);
    if (count === null) {
      toast.error("Couldn't sync from the organization.");
      return;
    }
    const rows = await listMembers(projectId);
    setMembers(rows ?? []);
    toast.success(count === 0 ? "Already in sync" : `Synced ${count} member${count === 1 ? "" : "s"}`);
  };

  const handleInvite = async (draft) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const selected = roleOptions.find((o) => o.value === draft.roleValue);
    const roleRow = selected ? getRoleById(catalog, selected.value) : null;
    const optimistic = {
      id,
      projectId: projectId ?? null,
      email: draft.email,
      name: draft.name,
      roleId: roleRow?.id ?? null,
      roleKey: roleRow?.key ?? (selected ? String(selected.value) : ""),
      roleName: roleRow?.name ?? selected?.label ?? "",
      inviteType: draft.inviteType,
      status: "pending",
      message: draft.message,
      expiresAt: expiryTtlToIso(draft.expiryTtl),
      acceptedAt: "",
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    };
    setInvites((rows) => [optimistic, ...rows]);
    const created = await createInvite({
      id,
      email: draft.email,
      name: draft.name,
      roleId: optimistic.roleId,
      roleKey: optimistic.roleKey,
      roleName: optimistic.roleName,
      inviteType: draft.inviteType,
      message: draft.message,
      expiresAt: optimistic.expiresAt,
    });
    if (created) {
      setInvites((rows) => rows.map((i) => (i.id === id ? created : i)));
      toast.success(`Invited ${draft.email}`);
    } else {
      setInvites((rows) => rows.filter((i) => i.id !== id));
      toast.error("Couldn't send the invite.");
    }
  };

  const handleCopyInvite = async (invite) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(invite.id));
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy the invite link.");
    }
  };

  const handleRevokeInvite = async (invite) => {
    const prev = invites;
    setInvites((rows) =>
      rows.map((i) => (i.id === invite.id ? { ...i, status: "revoked" } : i)),
    );
    const saved = await updateInvite(invite.id, { status: "revoked" });
    if (saved) {
      setInvites((rows) => rows.map((i) => (i.id === saved.id ? saved : i)));
      toast.success("Invite revoked");
    } else {
      setInvites(prev);
      toast.error("Couldn't revoke the invite.");
    }
  };

  const handleDeleteInvite = async (invite) => {
    const prev = invites;
    setInvites((rows) => rows.filter((i) => i.id !== invite.id));
    const ok = await softDeleteInvite(invite.id);
    if (ok) toast.success("Invite deleted");
    else {
      setInvites(prev);
      toast.error("Couldn't delete the invite.");
    }
  };

  const memberColumns = [
    {
      key: "member",
      header: "Member",
      render: (m) => (
        <div className="min-w-0">
          <p className="max-w-[240px] truncate text-sm font-medium text-foreground">
            {m.name || m.email || "Unnamed member"}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-text-tertiary">{m.email || "—"}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (m) => {
        const role = roleOf(m);
        if (!roles.length) return <span className="text-xs text-text-secondary">{m.roleName || m.roleKey || "—"}</span>;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Select value={m.roleId || ""} onValueChange={(v) => handleAssign(m, v)}>
              <SelectTrigger
                aria-label={`Role for ${m.email}`}
                className="h-8 w-[160px] border-border bg-surface-card text-xs"
              >
                <SelectValue placeholder={m.roleName || "Select role"} />
              </SelectTrigger>
              <SelectContent className="border-border bg-surface-subtle text-foreground">
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      },
    },
    {
      key: "access",
      header: "Access",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (m) => {
        const role = roleOf(m);
        if (!role) return "—";
        const perms = role.productPermissions ?? role.permissions ?? [];
        if (perms.includes("*")) return "Full access";
        return `${perms.length} permission${perms.length === 1 ? "" : "s"}`;
      },
    },
    {
      key: "status",
      header: "Status",
      render: (m) => (
        <StatusPill status={m.status} map={TEAM_MEMBER_STATUS_MAP} className="text-[10px]" />
      ),
    },
    {
      key: "since",
      header: "Member since",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (m) => formatDate(m.grantedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (m) => (
        <ActionMenu
          label={`Actions for ${m.email}`}
          items={[
            {
              icon: Ban,
              label: "Remove",
              onSelect: () => handleRevoke(m),
            },
          ]}
        />
      ),
    },
  ];

  const inviteColumns = [
    {
      key: "email",
      header: "Invitee",
      render: (i) => (
        <div className="min-w-0">
          <p className="max-w-[240px] truncate text-sm font-medium text-foreground">{i.email}</p>
          <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
            {i.name || "No name yet"}
            {i.roleName ? ` · ${i.roleName}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (i) => (
        <StatusPill status={i.inviteType} map={INVITE_TYPE_MAP} className="text-[10px]" />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (i) => (
        <StatusPill status={inviteStatus(i)} map={INVITE_STATUS_MAP} className="text-[10px]" />
      ),
    },
    {
      key: "expires",
      header: "Expires",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (i) => (i.expiresAt ? formatDate(i.expiresAt) : "No expiry"),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (i) => {
        const status = inviteStatus(i);
        return (
          <ActionMenu
            label={`Actions for ${i.email}`}
            items={[
              {
                icon: Copy,
                label: "Copy invite link",
                onSelect: () => handleCopyInvite(i),
              },
              status === "pending"
                ? {
                    icon: Ban,
                    label: "Revoke",
                    onSelect: () => handleRevokeInvite(i),
                  }
                : null,
              { separator: true },
              {
                icon: Trash2,
                label: "Delete",
                destructive: true,
                onSelect: () => handleDeleteInvite(i),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="Team"
        description="Manage workspace members and collaborators."
        actions={
          <>
            <Button
              variant="outline"
              disabled={syncing}
              className="h-9 border-border bg-surface-card text-xs text-foreground hover:bg-surface-active"
              onClick={handleSync}
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync from organization"}
            </Button>
            <Button
              className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
              onClick={() => setShowInvite(true)}
            >
              <UserPlus className="mr-1.5 h-4 w-4" />
              Invite
            </Button>
          </>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={roleFilter}
            onValueChange={setRoleFilter}
            options={roleFilterOptions}
            placeholder="Role"
            icon={SlidersHorizontal}
          />
          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
              onClick={clearFilters}
            >
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          ) : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search people..." />
      </Toolbar>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      ) : (
        <div className="space-y-6">
          <SectionCard
            title="Members & collaborators"
            description="Contributor access is set per member through their role."
          >
            <DataTable
              columns={memberColumns}
              data={filteredMembers}
              getRowKey={(m) => m.userId ?? m.email}
              empty={
                members.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No members yet"
                    description="Invite your first collaborator to get started."
                    action={
                      <Button
                        className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                        onClick={() => setShowInvite(true)}
                      >
                        <UserPlus className="mr-1.5 h-4 w-4" />
                        Invite
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={Users}
                    title="No matching members"
                    description="No members match the current search and filter."
                    action={
                      <Button variant="ghost" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    }
                  />
                )
              }
            />
          </SectionCard>

          <SectionCard
            title="Teams & groups"
            description="Roles from the workspace catalog and how many members hold each."
          >
            {catalog.length === 0 ? (
              <p className="text-sm text-text-tertiary">No roles in the catalog yet.</p>
            ) : (
              <SettingsList>
                {catalog.map((role) => {
                  const count = members.filter(
                    (m) => m.roleId === (role.id ?? role.key) || m.roleKey === role.key,
                  ).length;
                  const perms = role.productPermissions ?? role.permissions ?? [];
                  return (
                    <SettingRow
                      key={role.id ?? role.key}
                      icon={ShieldCheck}
                      title={role.name ?? role.key}
                      description={
                        role.description ||
                        (perms.includes("*")
                          ? "Full access to everything."
                          : `${perms.length} workspace permission${perms.length === 1 ? "" : "s"}.`)
                      }
                      control={
                        <Badge variant="neutral" className="text-[11px]">
                          {count} member{count === 1 ? "" : "s"}
                        </Badge>
                      }
                    />
                  );
                })}
              </SettingsList>
            )}
          </SectionCard>

          <SectionCard
            title="Invitations"
            description="Pending invites for members, guests and external reviewers."
            action={
              <FilterDropdown
                value={inviteTypeFilter}
                onValueChange={setInviteTypeFilter}
                options={INVITE_TYPE_FILTER_OPTIONS}
                placeholder="Type"
              />
            }
          >
            <DataTable
              columns={inviteColumns}
              data={filteredInvites}
              getRowKey={(i) => i.id}
              empty={
                invites.length === 0 ? (
                  <EmptyState
                    icon={Mail}
                    title="No invitations yet"
                    description="Invite members, guests or external reviewers."
                    action={
                      <Button
                        className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                        onClick={() => setShowInvite(true)}
                      >
                        <UserPlus className="mr-1.5 h-4 w-4" />
                        Invite
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={Mail}
                    title="No matching invites"
                    description="No invites match the current search and filter."
                    action={
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setInviteTypeFilter("all");
                          setSearch("");
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                  />
                )
              }
            />
          </SectionCard>
        </div>
      )}

      <InviteDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        onInvite={handleInvite}
        roleOptions={roleOptions}
      />
    </MainScreenWrapper>
  );
}

export default TeamScreen;
