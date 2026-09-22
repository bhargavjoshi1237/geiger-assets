"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Mail,
  RefreshCw,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Textarea } from "@geiger/ui/textarea";
import { ActionMenu } from "@geiger/ui/action-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@geiger/ui";
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
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";

import {
  listMembers,
  listRoles,
  assignRole,
  revokeMember,
  syncTeamFromOrg,
} from "@/lib/supabase/rbac";
import {
  listInvitations,
  createInvitation,
  revokeInvitation,
  resendInvitation,
  softDeleteInvitation,
  invitationUrl,
} from "@/lib/supabase/invitations";
import { getUser } from "@/lib/supabase/user";
import { uniqueId } from "@/lib/utils";

import {
  INVITE_KIND_MAP,
  INVITE_KIND_OPTIONS,
  INVITE_STATUS_MAP,
  INVITE_STATUS_FILTER_OPTIONS,
  MEMBER_STATUS_MAP,
  formatDate,
  formatRelative,
  initials,
} from "./constants";

const EMPTY_INVITE = { emails: "", roleId: "", kind: "member", message: "" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function copyToClipboard(text, message) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    toast.error("Clipboard isn't available in this browser.");
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => toast.success(message),
    () => toast.error("Couldn't copy the link."),
  );
}

function Avatar({ name, url }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-active text-[11px] font-semibold text-text-secondary"
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function InviteDialog({ open, onOpenChange, onInvite, roles }) {
  const [draft, setDraft] = useState(EMPTY_INVITE);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const parsed = useMemo(
    () =>
      draft.emails
        .split(/[,\s\n]+/)
        .map((e) => e.trim())
        .filter(Boolean),
    [draft.emails],
  );
  const invalid = parsed.filter((e) => !EMAIL_RE.test(e));

  const submit = () => {
    if (!parsed.length) {
      toast.error("Add at least one email address.");
      return;
    }
    if (invalid.length) {
      toast.error(`Not a valid email: ${invalid[0]}`);
      return;
    }
    if (!draft.roleId) {
      toast.error("Pick the role these people should get.");
      return;
    }
    onInvite({ ...draft, emails: parsed });
    setDraft(EMPTY_INVITE);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-background">
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>
            Invitations create a link you can send. Email delivery isn&apos;t wired up yet —
            copy the link from the Invitations tab.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="grid gap-4"
        >
          <Field
            label="Email addresses"
            hint={parsed.length ? `${parsed.length} recipient${parsed.length === 1 ? "" : "s"}` : "Separate multiple addresses with commas or new lines."}
            htmlFor="invite-emails"
          >
            <Textarea
              id="invite-emails"
              value={draft.emails}
              onChange={(e) => set("emails")(e.target.value)}
              placeholder="alex@studio.com, sam@client.com"
              className="h-[72px] min-h-0 resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Access level" hint={INVITE_KIND_MAP[draft.kind]?.description}>
              <Select value={draft.kind} onValueChange={set("kind")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Role">
              <Select value={draft.roleId} onValueChange={set("roleId")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.length ? (
                    roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No roles defined yet
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Message" hint="Optional — shown on the invitation page.">
            <Textarea
              value={draft.message}
              onChange={(e) => set("message")(e.target.value)}
              placeholder="Joining us to review the autumn campaign."
              className="h-[60px] min-h-0 resize-none"
            />
          </Field>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            <Send className="h-4 w-4" /> Send invitations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TeamScreen({ projectId }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("members");
  const [search, setSearch] = useState("");
  const [inviteStatus, setInviteStatus] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listMembers(projectId), listInvitations(projectId)]).then(
      ([m, i]) => {
        if (!alive) return;
        setMembers(m ?? []);
        setInvitations(i ?? []);
        setLoading(false);
      },
    );
    listRoles(projectId).then((rows) => alive && setRoles(rows ?? []));
    getUser().then((u) => alive && setUser(u));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const roleName = useMemo(() => {
    const map = new Map(roles.map((r) => [r.id, r.name]));
    return (id) => map.get(id) || "—";
  }, [roles]);

  // Guests and external reviewers arrive through invitations, so the Guests tab
  // reads the accepted non-member invites rather than the member directory.
  const guests = useMemo(
    () => invitations.filter((i) => i.kind !== "member"),
    [invitations],
  );

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter((m) =>
      `${m.name} ${m.email} ${m.roleName}`.toLowerCase().includes(term),
    );
  }, [members, search]);

  const filteredInvitations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invitations.filter((i) => {
      if (inviteStatus !== "all" && i.status !== inviteStatus) return false;
      if (term && !`${i.email} ${i.name}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [invitations, search, inviteStatus]);

  const filteredGuests = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return guests;
    return guests.filter((g) => `${g.email} ${g.name}`.toLowerCase().includes(term));
  }, [guests, search]);

  const stats = useMemo(() => {
    const pending = invitations.filter((i) => i.status === "pending").length;
    return [
      { label: "Members", value: String(members.length), footer: "With workspace access" },
      { label: "Guests & reviewers", value: String(guests.length), footer: "Scoped access" },
      { label: "Pending invites", value: String(pending), footer: "Awaiting acceptance" },
      { label: "Roles", value: String(roles.length), footer: "Defined in this workspace" },
    ];
  }, [members, guests, invitations, roles]);

  const handleSync = () => {
    setSyncing(true);
    syncTeamFromOrg(projectId).then((count) => {
      setSyncing(false);
      if (count === null) {
        toast.error("Couldn't sync from the organization.");
        return;
      }
      listMembers(projectId).then((rows) => setMembers(rows ?? []));
      toast.success(
        count ? `Synced ${count} member${count === 1 ? "" : "s"} from the org.` : "Already up to date.",
      );
    });
  };

  const handleInvite = ({ emails, roleId, kind, message }) => {
    const created = emails.map((email) => ({
      id: uniqueId(),
      projectId,
      email,
      name: "",
      roleId,
      kind,
      message,
      status: "pending",
      invitedBy: user?.id || null,
      actorName: user?.name || "",
    }));
    setInvitations((prev) => [...created, ...prev]);
    Promise.all(created.map((invite) => createInvitation(invite))).then((saved) => {
      const ok = saved.filter(Boolean);
      setInvitations((prev) =>
        prev.map((i) => saved.find((s) => s && s.id === i.id) || i),
      );
      const failed = created.length - ok.length;
      if (failed) {
        const failedIds = new Set(
          created.filter((c) => !saved.find((s) => s && s.id === c.id)).map((c) => c.id),
        );
        setInvitations((prev) => prev.filter((i) => !failedIds.has(i.id)));
        toast.error(`${failed} invitation${failed === 1 ? "" : "s"} couldn't be created.`);
      }
      if (ok.length) {
        toast.success(`${ok.length} invitation${ok.length === 1 ? "" : "s"} created.`);
        setTab("invitations");
      }
    });
  };

  const handleRoleChange = (member, roleId) => {
    const previous = member.roleId;
    setMembers((prev) =>
      prev.map((m) =>
        m.userId === member.userId ? { ...m, roleId, roleName: roleName(roleId) } : m,
      ),
    );
    assignRole(projectId, member.userId, roleId, user?.id || null).then((ok) => {
      if (!ok) {
        setMembers((prev) =>
          prev.map((m) =>
            m.userId === member.userId
              ? { ...m, roleId: previous, roleName: roleName(previous) }
              : m,
          ),
        );
        toast.error("Couldn't change that role.");
        return;
      }
      toast.success(`${member.name || member.email} is now ${roleName(roleId)}.`);
    });
  };

  const handleRemove = (member) => {
    setRemoveTarget(null);
    setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
    revokeMember(projectId, member.userId).then((ok) => {
      if (!ok) {
        setMembers((prev) => [member, ...prev]);
        toast.error("Couldn't remove that member.");
        return;
      }
      toast.success(`${member.name || member.email} removed from the workspace.`);
    });
  };

  const patchInvite = (id, updater, action, successMessage) => {
    const previous = invitations.find((i) => i.id === id);
    setInvitations((prev) => prev.map((i) => (i.id === id ? updater(i) : i)));
    action(id).then((saved) => {
      if (!saved) {
        if (previous) {
          setInvitations((prev) => prev.map((i) => (i.id === id ? previous : i)));
        }
        toast.error("Couldn't update the invitation.");
        return;
      }
      setInvitations((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
      toast.success(successMessage);
    });
  };

  const handleDeleteInvite = (invite) => {
    setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
    softDeleteInvitation(invite.id).then((ok) => {
      if (!ok) {
        setInvitations((prev) => [invite, ...prev]);
        toast.error("Couldn't delete the invitation.");
      }
    });
  };

  const memberColumns = [
    {
      key: "person",
      header: "Member",
      render: (m) => (
        <div className="flex items-center gap-3">
          <Avatar name={m.name || m.email} url={m.avatarUrl} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{m.name || "Unnamed"}</p>
            <p className="truncate text-xs text-text-secondary">{m.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (m) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Select
            value={m.roleId || ""}
            onValueChange={(v) => handleRoleChange(m, v)}
          >
            <SelectTrigger className="h-8 w-40">
              <SelectValue placeholder="No role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (m) => <StatusPill status={m.status} map={MEMBER_STATUS_MAP} />,
    },
    {
      key: "granted",
      header: "Joined",
      className: "text-text-secondary",
      render: (m) => formatDate(m.grantedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (m) => (
        <ActionMenu
          label="Member actions"
          items={[
            {
              icon: Copy,
              label: "Copy email",
              onSelect: () => copyToClipboard(m.email, "Email copied."),
            },
            { separator: true },
            {
              icon: UserMinus,
              label: "Remove from workspace",
              variant: "destructive",
              onSelect: () => setRemoveTarget(m),
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
        <div className="flex items-center gap-3">
          <Avatar name={i.name || i.email} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{i.email}</p>
            <p className="truncate text-xs text-text-secondary">
              {roleName(i.roleId)}
              {i.message ? ` · ${i.message}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "kind",
      header: "Access",
      render: (i) => (
        <Badge variant={INVITE_KIND_MAP[i.kind]?.variant || "neutral"}>
          {INVITE_KIND_MAP[i.kind]?.label || i.kind}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (i) => <StatusPill status={i.status} map={INVITE_STATUS_MAP} />,
    },
    {
      key: "sent",
      header: "Sent",
      className: "text-text-secondary",
      render: (i) => formatDate(i.createdAt),
    },
    {
      key: "expires",
      header: "Expires",
      className: "text-text-secondary",
      render: (i) => (i.expiresAt ? formatRelative(i.expiresAt) : "—"),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (i) => (
        <ActionMenu
          label="Invitation actions"
          items={[
            {
              icon: Copy,
              label: "Copy invite link",
              onSelect: () => copyToClipboard(invitationUrl(i.token), "Invite link copied."),
            },
            ...(i.status === "accepted"
              ? []
              : [
                  {
                    icon: RefreshCw,
                    label: "Resend",
                    onSelect: () =>
                      patchInvite(
                        i.id,
                        (x) => ({ ...x, status: "pending" }),
                        resendInvitation,
                        `Invitation to ${i.email} re-issued.`,
                      ),
                  },
                ]),
            ...(i.status === "pending"
              ? [
                  {
                    icon: UserMinus,
                    label: "Revoke",
                    onSelect: () =>
                      patchInvite(
                        i.id,
                        (x) => ({ ...x, status: "revoked" }),
                        revokeInvitation,
                        `Invitation to ${i.email} revoked.`,
                      ),
                  },
                ]
              : []),
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              variant: "destructive",
              onSelect: () => handleDeleteInvite(i),
            },
          ]}
        />
      ),
    },
  ];

  const guestColumns = inviteColumns.filter((c) => c.key !== "kind");

  const emptyPanel = (icon, title, description, action) => (
    <div className="rounded-xl border border-border bg-surface-subtle">
      <EmptyState icon={icon} title={title} description={description} action={action} />
    </div>
  );

  const inviteButton = (
    <Button
      className="bg-primary text-primary-foreground hover:bg-primary/90"
      onClick={() => setInviteOpen(true)}
    >
      <UserPlus className="h-4 w-4" /> Invite people
    </Button>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Team"
        description="Who can reach this workspace and what they're allowed to do — members on the org, guests with scoped access, and external reviewers who only see what they're asked to approve."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              disabled={syncing}
              onClick={handleSync}
            >
              <RefreshCw className={syncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Sync from org
            </Button>
            {inviteButton}
          </div>
        }
      />

      <StatsBar stats={stats} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="invitations">Invitations ({invitations.length})</TabsTrigger>
          <TabsTrigger value="guests">Guests & reviewers ({guests.length})</TabsTrigger>
        </TabsList>

        <div className="pt-4">
          <Toolbar>
            <div className="flex items-center gap-2">
              {tab === "invitations" ? (
                <FilterDropdown
                  value={inviteStatus}
                  onValueChange={setInviteStatus}
                  options={INVITE_STATUS_FILTER_OPTIONS}
                  height="h-9"
                />
              ) : null}
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={tab === "members" ? "Search members…" : "Search by email…"}
            />
          </Toolbar>
        </div>

        {loading ? (
          <LoadingArea panel size={48} label="Loading team…" />
        ) : (
          <>
            <TabsContent value="members" className="pt-4">
              <DataTable
                columns={memberColumns}
                data={filteredMembers}
                getRowKey={(m) => m.userId}
                empty={emptyPanel(
                  Users,
                  members.length ? "No members match your search" : "No members yet",
                  members.length
                    ? "Try a different search term."
                    : "Sync from your organization, or invite people directly.",
                  inviteButton,
                )}
              />
            </TabsContent>

            <TabsContent value="invitations" className="pt-4">
              <DataTable
                columns={inviteColumns}
                data={filteredInvitations}
                getRowKey={(i) => i.id}
                empty={emptyPanel(
                  Mail,
                  invitations.length ? "No invitations match your filters" : "No invitations yet",
                  invitations.length
                    ? "Try clearing the search or status filter."
                    : "Invite teammates, clients, or external reviewers to this workspace.",
                  inviteButton,
                )}
              />
            </TabsContent>

            <TabsContent value="guests" className="pt-4">
              <DataTable
                columns={guestColumns}
                data={filteredGuests}
                getRowKey={(g) => g.id}
                empty={emptyPanel(
                  UserPlus,
                  guests.length ? "No guests match your search" : "No guests or reviewers yet",
                  guests.length
                    ? "Try a different search term."
                    : "Invite someone as a guest or external reviewer and they'll appear here with their scoped access.",
                  inviteButton,
                )}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={handleInvite}
        roles={roles}
      />

      <Dialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              Remove{" "}
              <span className="font-medium text-foreground">
                {removeTarget?.name || removeTarget?.email}
              </span>{" "}
              from this workspace? They lose access immediately. Anything they created stays.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => handleRemove(removeTarget)}
            >
              <UserMinus className="h-4 w-4" /> Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default TeamScreen;
