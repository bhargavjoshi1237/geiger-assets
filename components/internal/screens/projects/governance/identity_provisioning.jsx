"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Fingerprint, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
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
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import {
  createIdentityProvider,
  listIdentityProviders,
  softDeleteIdentityProvider,
  updateIdentityProvider,
} from "@/lib/supabase/governance";
import {
  PROTOCOL_FILTER_OPTIONS,
  PROTOCOL_MAP,
  PROVIDER_STATUS_FILTER_OPTIONS,
  PROVIDER_STATUS_MAP,
  formatDate,
} from "./constants";

// Identity and Provisioning — SSO, SAML, SCIM, MFA, domain controls, and
// automatic deprovisioning.
//
// Configuration surfaces only: this screen records how the workspace connects
// to an identity provider and which provisioning rules apply. It never
// implements an identity provider and never handles real credentials — client
// secrets, signing certificates, and SCIM bearer tokens live in the IdP (and
// the edge that validates them), never in these rows.

function ProviderDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [protocol, setProtocol] = useState(initial?.protocol ?? "saml");
  const [status, setStatus] = useState(initial?.status ?? "pending");
  const [domain, setDomain] = useState(initial?.domain ?? "");
  const [ssoUrl, setSsoUrl] = useState(initial?.ssoUrl ?? "");
  const [entityId, setEntityId] = useState(initial?.entityId ?? "");
  const [scimEnabled, setScimEnabled] = useState(initial?.scimEnabled ?? false);
  const [autoProvision, setAutoProvision] = useState(initial?.autoProvision ?? true);
  const [requireMfa, setRequireMfa] = useState(initial?.requireMfa ?? false);
  const [deprovisionOnDisable, setDeprovisionOnDisable] = useState(
    initial?.deprovisionOnDisable ?? false,
  );
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setProtocol(initial?.protocol ?? "saml");
    setStatus(initial?.status ?? "pending");
    setDomain(initial?.domain ?? "");
    setSsoUrl(initial?.ssoUrl ?? "");
    setEntityId(initial?.entityId ?? "");
    setScimEnabled(initial?.scimEnabled ?? false);
    setAutoProvision(initial?.autoProvision ?? true);
    setRequireMfa(initial?.requireMfa ?? false);
    setDeprovisionOnDisable(initial?.deprovisionOnDisable ?? false);
    setBusy(false);
  }, [open, initial]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Give the connection a name.");
      return;
    }
    if (ssoUrl.trim() && !/^https:\/\//i.test(ssoUrl.trim())) {
      toast.error("The sign-on URL must be an https:// address.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      name: name.trim(),
      protocol,
      status,
      domain: domain.trim().toLowerCase(),
      ssoUrl: ssoUrl.trim(),
      entityId: entityId.trim(),
      scimEnabled,
      autoProvision,
      requireMfa,
      deprovisionOnDisable,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit connection" : "Add identity connection"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Where members authenticate and how accounts are provisioned. Secrets stay in
            your identity provider — nothing here stores one.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Connection name" htmlFor="idp-name">
            <Input
              id="idp-name"
              className="bg-surface-card"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Okta"
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Protocol" htmlFor="idp-protocol">
              <Select value={protocol} onValueChange={setProtocol}>
                <SelectTrigger id="idp-protocol" className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="saml">SAML 2.0</SelectItem>
                  <SelectItem value="oidc">OIDC</SelectItem>
                  <SelectItem value="scim">SCIM 2.0</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status" htmlFor="idp-status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="idp-status" className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field
            label="Enforced domain"
            htmlFor="idp-domain"
            hint="Members with this email domain must use this connection."
          >
            <Input
              id="idp-domain"
              className="bg-surface-card"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="acme.com"
            />
          </Field>
          <Field
            label="Sign-on URL"
            htmlFor="idp-sso"
            hint="The IdP's public sign-on endpoint. No secrets — just the address."
          >
            <Input
              id="idp-sso"
              className="bg-surface-card"
              value={ssoUrl}
              onChange={(e) => setSsoUrl(e.target.value)}
              placeholder="https://acme.okta.com/app/…/sso/saml"
            />
          </Field>
          <Field
            label="Entity ID"
            htmlFor="idp-entity"
            hint="The audience this workspace presents to the IdP."
          >
            <Input
              id="idp-entity"
              className="bg-surface-card font-mono"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="urn:geiger:assets:acme"
            />
          </Field>
          <SettingsList>
            <SettingRow
              title="SCIM provisioning"
              description="Create and update accounts from directory changes."
              checked={scimEnabled}
              onCheckedChange={setScimEnabled}
            />
            <SettingRow
              title="Just-in-time provisioning"
              description="Create a workspace account on first successful sign-in."
              checked={autoProvision}
              onCheckedChange={setAutoProvision}
            />
            <SettingRow
              title="Require MFA"
              description="Refuse sign-ins without a second factor."
              checked={requireMfa}
              onCheckedChange={setRequireMfa}
            />
            <SettingRow
              title="Deprovision on disable"
              description="Revoke the workspace grant when the directory disables the user."
              checked={deprovisionOnDisable}
              onCheckedChange={setDeprovisionOnDisable}
            />
          </SettingsList>
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
            {editing ? "Save changes" : "Add connection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IdentityProvisioningScreen({ projectId }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [protocolFilter, setProtocolFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let alive = true;
    listIdentityProviders(projectId).then((rows) => {
      if (!alive) return;
      setProviders(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const stats = useMemo(
    () => [
      { label: "Connections", value: String(providers.length), footer: "identity providers" },
      {
        label: "Active",
        value: String(providers.filter((p) => p.status === "active").length),
        footer: "accepting sign-ins",
      },
      {
        label: "Auto-provision",
        value: String(providers.filter((p) => p.autoProvision).length),
        footer: "just-in-time accounts",
      },
      {
        label: "Auto-deprovision",
        value: String(providers.filter((p) => p.deprovisionOnDisable).length),
        footer: "revoke on disable",
      },
    ],
    [providers],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return providers.filter((provider) => {
      if (protocolFilter !== "all" && provider.protocol !== protocolFilter) return false;
      if (statusFilter !== "all" && provider.status !== statusFilter) return false;
      if (
        needle &&
        !`${provider.name} ${provider.domain} ${provider.entityId}`.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [providers, search, protocolFilter, statusFilter]);

  const filtersActive =
    protocolFilter !== "all" || statusFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setProtocolFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  const enforcedDomains = useMemo(
    () => providers.filter((p) => p.domain && p.status === "active"),
    [providers],
  );

  const deprovisionProviders = useMemo(
    () => providers.filter((p) => p.deprovisionOnDisable && p.status === "active"),
    [providers],
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const submitProvider = async (draft) => {
    if (editing) {
      const previous = providers;
      setProviders((rows) => rows.map((p) => (p.id === editing.id ? { ...p, ...draft } : p)));
      const saved = await updateIdentityProvider(editing.id, draft);
      if (!saved) {
        setProviders(previous);
        toast.error("Couldn't save the connection.");
        return false;
      }
      setProviders((rows) => rows.map((p) => (p.id === saved.id ? saved : p)));
      toast.success("Connection saved.");
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setProviders((rows) => [optimistic, ...rows]);
    const created = await createIdentityProvider({ id, projectId, ...draft });
    if (!created) {
      setProviders((rows) => rows.filter((p) => p.id !== id));
      toast.error("Couldn't add the connection.");
      return false;
    }
    setProviders((rows) => rows.map((p) => (p.id === id ? created : p)));
    toast.success("Connection added.");
    return true;
  };

  const flipFlag = async (provider, patch, successMessage) => {
    const previous = providers;
    setProviders((rows) => rows.map((p) => (p.id === provider.id ? { ...p, ...patch } : p)));
    const saved = await updateIdentityProvider(provider.id, patch);
    if (!saved) {
      setProviders(previous);
      toast.error("Couldn't change that setting.");
      return;
    }
    setProviders((rows) => rows.map((p) => (p.id === saved.id ? saved : p)));
    toast.success(successMessage);
  };

  const removeProvider = async (provider) => {
    const previous = providers;
    setProviders((rows) => rows.filter((p) => p.id !== provider.id));
    const ok = await softDeleteIdentityProvider(provider.id);
    if (!ok) {
      setProviders(previous);
      toast.error("Couldn't delete the connection.");
      return;
    }
    toast.success("Connection deleted.");
  };

  const columns = [
    {
      key: "provider",
      header: "Connection",
      render: (provider) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="max-w-[240px] truncate font-medium text-foreground">
              {provider.name || "Untitled connection"}
            </span>
            {provider.requireMfa ? <Badge variant="info">MFA</Badge> : null}
            {provider.scimEnabled ? <Badge variant="neutral">SCIM</Badge> : null}
          </span>
          <span className="max-w-[280px] truncate text-xs text-text-secondary">
            {provider.domain ? `Enforces ${provider.domain}` : "No domain enforced"}
            {` · added ${formatDate(provider.createdAt)}`}
          </span>
        </div>
      ),
    },
    {
      key: "protocol",
      header: "Protocol",
      render: (provider) => <StatusPill status={provider.protocol} map={PROTOCOL_MAP} />,
    },
    {
      key: "status",
      header: "Status",
      render: (provider) => <StatusPill status={provider.status} map={PROVIDER_STATUS_MAP} />,
    },
    {
      key: "provisioning",
      header: "Provisioning",
      align: "right",
      className: "text-right",
      render: (provider) => (
        <div
          className="flex items-center justify-end gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="hidden text-[11px] text-text-tertiary lg:inline">
            {provider.autoProvision ? "auto-create" : "manual"}
            {" · "}
            {provider.deprovisionOnDisable ? "auto-revoke" : "keep on disable"}
          </span>
          <Switch
            checked={provider.status === "active"}
            aria-label={`Enable ${provider.name}`}
            onCheckedChange={(value) =>
              flipFlag(
                provider,
                { status: value ? "active" : "disabled" },
                value ? `${provider.name} enabled.` : `${provider.name} disabled.`,
              )
            }
          />
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (provider) => (
        <ActionMenu
          label={`Actions for ${provider.name}`}
          items={[
            {
              icon: Pencil,
              label: "Edit",
              onSelect: () => {
                setEditing(provider);
                setDialogOpen(true);
              },
            },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              destructive: true,
              onSelect: () => removeProvider(provider),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Identity & Provisioning"
        description="SSO, directory sync, MFA, and domain controls. Configuration only — credentials stay in your identity provider."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> Add connection
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={protocolFilter}
            onValueChange={setProtocolFilter}
            options={PROTOCOL_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={PROVIDER_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search connections, domains…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading identity connections" />
        </div>
      ) : (
        <div className="space-y-8">
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(provider) => provider.id}
            onRowClick={(provider) => {
              setEditing(provider);
              setDialogOpen(true);
            }}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                {filtersActive ? (
                  <EmptyState
                    icon={Fingerprint}
                    title="No connections match these filters"
                    description="Try a different protocol, status, or search term."
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
                    icon={Fingerprint}
                    title="No identity connections yet"
                    description="Members sign in with workspace invites until you connect an identity provider."
                    action={
                      <Button
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={openCreate}
                      >
                        <Plus className="h-4 w-4" /> Add connection
                      </Button>
                    }
                  />
                )}
              </div>
            }
          />

          <SectionCard
            title="Domain controls"
            description="Active connections that force their domain through SSO. Anyone outside these domains keeps signing in the way they do today."
          >
            {enforcedDomains.length === 0 ? (
              <p className="text-sm text-text-tertiary">
                No enforced domains — enable a connection and give it a domain to start
                routing members through SSO.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {enforcedDomains.map((provider) => (
                  <Badge key={provider.id} variant="neutral" title={provider.name}>
                    {provider.domain} → {provider.name}
                  </Badge>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Automatic deprovisioning"
            description="When a directory disables a user, these connections revoke the workspace grant. Revocation removes access — it never deletes the person's identity record or their audit trail."
          >
            {deprovisionProviders.length === 0 ? (
              <p className="text-sm text-text-tertiary">
                Off everywhere. Turn on “Deprovision on disable” on a connection to revoke
                access automatically when someone leaves the directory.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {deprovisionProviders.map((provider) => (
                  <Badge key={provider.id} variant="neutral" title={provider.name}>
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    {provider.name}
                  </Badge>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      <ProviderDialog
        key={editing ? `provider:${editing.id}` : "provider:new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={submitProvider}
      />
    </MainScreenWrapper>
  );
}

export default IdentityProvisioningScreen;
