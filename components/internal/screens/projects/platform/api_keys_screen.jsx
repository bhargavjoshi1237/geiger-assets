"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, BookOpen, KeyRound, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  ClearFiltersButton,
  CreateDialog,
  DateField,
  TextField,
} from "@/components/internal/shared/module_kit";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { ConfirmDeleteDialog } from "@/components/internal/screens/projects/settings/settings_kit";
import { ActionMenu } from "@geiger/ui/action-menu";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Checkbox } from "@geiger/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import {
  ALL_SCOPES,
  API_SCOPE_RESOURCES,
  KEY_STATUS_META,
  READ_SCOPES,
  formatDate,
  formatDateTime,
  keyStatus,
  scopeLabel,
} from "./constants";
import {
  CodeBlock,
  DetailList,
  DetailSheet,
  IconTile,
  Notice,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  SheetSection,
} from "./platform_kit";
import {
  deleteApiKey,
  listApiKeys,
  mintApiKey,
  revokeApiKey,
  rotateApiKey,
} from "@/lib/supabase/platform";
import { getUser } from "@/lib/supabase/user";

const EMPTY_KEY_DRAFT = { name: "", scopes: [...READ_SCOPES], expiresAt: "" };

const KEY_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
];

const SCOPE_PRESETS = [
  { label: "Read only", scopes: READ_SCOPES },
  { label: "Full access", scopes: ALL_SCOPES },
  { label: "Clear", scopes: [] },
];

function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function scopeSummary(scopes) {
  const list = scopes || [];
  if (list.length === ALL_SCOPES.length) return "Full access";
  if (list.length && list.every((s) => s.endsWith(":read")) && list.length === READ_SCOPES.length) return "Read only";
  return `${list.length} scope${list.length === 1 ? "" : "s"}`;
}

// Resource × access grid — one row per resource, Read / Write checkboxes.
function ScopeMatrix({ value, onChange }) {
  const selected = new Set(value || []);
  const toggle = (scope, checked) => {
    const next = new Set(selected);
    if (checked) next.add(scope);
    else next.delete(scope);
    onChange(ALL_SCOPES.filter((s) => next.has(s)));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          Permissions <span className="text-text-tertiary">· {selected.size} of {ALL_SCOPES.length}</span>
        </p>
        <div className="flex gap-1">
          {SCOPE_PRESETS.map((p) => (
            <Button
              key={p.label}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
              onClick={() => onChange([...p.scopes])}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface-card">
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
          <span>Resource</span>
          <span className="text-center">Read</span>
          <span className="text-center">Write</span>
        </div>
        {API_SCOPE_RESOURCES.map((row) => (
          <div
            key={row.resource}
            className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center border-b border-border px-3 py-2 last:border-b-0"
          >
            <span className="truncate text-sm text-foreground">{row.label}</span>
            {["read", "write"].map((access) => {
              const scope = row[access];
              return (
                <span key={access} className="flex justify-center">
                  {scope ? (
                    <Checkbox
                      checked={selected.has(scope.value)}
                      onCheckedChange={(v) => toggle(scope.value, v === true)}
                      aria-label={scope.label}
                      title={scope.hint}
                    />
                  ) : (
                    <span className="text-xs text-text-tertiary">—</span>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState(EMPTY_KEY_DRAFT);
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    if (!draft.name.trim()) {
      toast.error("Give the key a name first.");
      return;
    }
    if (!(draft.scopes || []).length) {
      toast.error("Grant at least one permission.");
      return;
    }
    if (draft.expiresAt && draft.expiresAt <= todayKey()) {
      toast.error("Pick an expiry date in the future.");
      return;
    }
    setSaving(true);
    await onCreate({ ...draft, name: draft.name.trim() });
    setSaving(false);
    setDraft(EMPTY_KEY_DRAFT);
  };

  return (
    <CreateDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setDraft(EMPTY_KEY_DRAFT);
        onOpenChange(next);
      }}
      title="Create API key"
      description="Grant only what the app needs. The secret is shown once, right after you create it."
      submitLabel={saving ? "Creating…" : "Create key"}
      submitDisabled={saving}
      onSubmit={submit}
    >
      <TextField label="Key name" value={draft.name} onChange={set("name")} placeholder="e.g. Storefront server" />
      <ScopeMatrix value={draft.scopes} onChange={set("scopes")} />
      <DateField
        label="Expires"
        value={draft.expiresAt}
        onChange={set("expiresAt")}
        placeholder="Never expires"
        hint="Optional. Leave empty for a key that doesn't expire."
      />
    </CreateDialog>
  );
}

function SecretDialog({ secret, keyName, onClose }) {
  return (
    <Dialog open={!!secret} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Save your secret key</DialogTitle>
          <DialogDescription>
            {keyName ? (
              <>
                Secret for <span className="font-medium text-foreground">{keyName}</span>.{" "}
              </>
            ) : null}
            Copy it now and store it somewhere safe.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <CodeBlock value={secret || ""} label="Copy secret" />
          <Notice tone="warning">You won&apos;t be able to see this secret again. If you lose it, rotate the key.</Notice>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Use it as a bearer token</p>
            <CodeBlock value={`Authorization: Bearer ${secret || ""}`} label="Copy authorization header" />
          </div>
        </div>
        <DialogFooter>
          <Button className={PRIMARY_BUTTON} onClick={onClose}>
            I&apos;ve saved it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScopeBadges({ scopes, max = 2 }) {
  const list = scopes || [];
  if (list.length === ALL_SCOPES.length || (list.length === READ_SCOPES.length && list.every((s) => s.endsWith(":read")))) {
    return <Badge variant="neutral">{scopeSummary(list)}</Badge>;
  }
  return (
    <div className="flex max-w-64 flex-wrap gap-1">
      {list.slice(0, max).map((s) => (
        <Badge key={s} variant="neutral">
          {scopeLabel(s)}
        </Badge>
      ))}
      {list.length > max ? <Badge variant="outline">+{list.length - max}</Badge> : null}
    </div>
  );
}

function KeySheet({ apiKey, pending, onClose, onRotate, onRevoke, onDelete }) {
  const status = apiKey ? keyStatus(apiKey) : null;
  const scopes = new Set(apiKey?.scopes || []);
  return (
    <DetailSheet
      open={!!apiKey}
      onOpenChange={(open) => !open && onClose()}
      media={<IconTile icon={KeyRound} size="lg" />}
      title={apiKey?.name}
      subtitle={apiKey ? `${apiKey.prefix}…` : ""}
      meta={status ? <StatusPill status={status} map={KEY_STATUS_META} /> : null}
      footer={
        apiKey ? (
          <>
            {status === "active" ? (
              <>
                <Button className={PRIMARY_BUTTON} disabled={pending} onClick={() => onRotate(apiKey)}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Rotate secret
                </Button>
                <Button variant="outline" className={OUTLINE_BUTTON} onClick={() => onRevoke(apiKey)}>
                  <Ban className="h-4 w-4" />
                  Revoke
                </Button>
              </>
            ) : null}
            <Button
              variant="ghost"
              className="ml-auto text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
              onClick={() => onDelete(apiKey)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </>
        ) : null
      }
    >
      {apiKey ? (
        <>
          <SheetSection title="Details">
            <DetailList
              items={[
                { label: "Created", value: formatDateTime(apiKey.createdAt) },
                { label: "Last used", value: apiKey.lastUsedAt ? formatDateTime(apiKey.lastUsedAt) : "Never" },
                { label: "Expires", value: apiKey.expiresAt ? formatDate(apiKey.expiresAt) : "Never" },
                apiKey.revokedAt ? { label: "Revoked", value: formatDateTime(apiKey.revokedAt) } : null,
              ]}
            />
          </SheetSection>
          <SheetSection title={`Permissions · ${scopeSummary(apiKey.scopes)}`}>
            <div className="overflow-hidden rounded-lg border border-border bg-surface-card">
              {API_SCOPE_RESOURCES.map((row) => (
                <div
                  key={row.resource}
                  className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="text-foreground">{row.label}</span>
                  <span className="flex gap-1">
                    {["read", "write"].map((access) =>
                      row[access] ? (
                        <Badge key={access} variant={scopes.has(row[access].value) ? "success" : "outline"}>
                          {access === "read" ? "Read" : "Write"}
                        </Badge>
                      ) : null,
                    )}
                  </span>
                </div>
              ))}
            </div>
          </SheetSection>
          {status === "active" ? (
            <Notice>Rotating mints a new secret and stops the old one immediately — update your app first.</Notice>
          ) : null}
        </>
      ) : null}
    </DetailSheet>
  );
}

export function ApiKeysScreen({ projectId }) {
  const { setTab } = useWorkspaceUrl();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [secret, setSecret] = useState(null);
  const [pending, setPending] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: "revoke" | "delete", key }

  useEffect(() => {
    let alive = true;
    listApiKeys(projectId).then((rows) => {
      if (!alive) return;
      setKeys(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filteredKeys = useMemo(() => {
    const q = search.trim().toLowerCase();
    return keys
      .filter((k) => !q || k.name.toLowerCase().includes(q) || k.prefix.toLowerCase().includes(q))
      .filter((k) => statusFilter === "all" || keyStatus(k) === statusFilter);
  }, [keys, search, statusFilter]);

  const stats = useMemo(() => {
    const count = (status) => keys.filter((k) => keyStatus(k) === status).length;
    const used = keys.filter((k) => k.lastUsedAt).length;
    return [
      { label: "API keys", value: String(keys.length), footer: `${used} used at least once` },
      { label: "Active", value: String(count("active")), footer: "Can call the API" },
      { label: "Expired", value: String(count("expired")), footer: "Past their expiry date" },
      { label: "Revoked", value: String(count("revoked")), footer: "Disabled for good" },
    ];
  }, [keys]);

  const openKey = openId ? keys.find((k) => k.id === openId) : null;
  const filtersActive = search.trim() !== "" || statusFilter !== "all";

  const handleCreate = async (draft) => {
    const user = await getUser();
    const optimistic = {
      id: crypto.randomUUID(),
      projectId,
      name: draft.name,
      prefix: "gk_live_pen",
      scopes: draft.scopes,
      lastUsedAt: null,
      expiresAt: draft.expiresAt || null,
      revokedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setKeys((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const minted = await mintApiKey({
      projectId,
      name: draft.name,
      scopes: draft.scopes,
      expiresAt: draft.expiresAt || null,
      createdBy: user?.id || null,
      id: optimistic.id,
    });
    if (minted) {
      setKeys((prev) => prev.map((k) => (k.id === optimistic.id ? minted.key : k)));
      setSecret({ value: minted.secret, name: minted.key.name });
      toast.success(`Key "${minted.key.name}" created.`);
    } else {
      setKeys((prev) => prev.filter((k) => k.id !== optimistic.id));
      toast.error("Couldn't create the key.");
    }
  };

  const handleRotate = async (key) => {
    setPending(key.id);
    const rotated = await rotateApiKey(key.id);
    setPending(null);
    if (rotated) {
      setKeys((prev) => prev.map((k) => (k.id === key.id ? rotated.key : k)));
      setOpenId(null);
      setSecret({ value: rotated.secret, name: key.name });
      toast.success(`Key "${key.name}" rotated — the old secret stopped working.`);
    } else {
      toast.error("Couldn't rotate the key.");
    }
  };

  const handleRevoke = async (key) => {
    setConfirm(null);
    const prev = keys;
    setKeys((rows) => rows.map((k) => (k.id === key.id ? { ...k, revokedAt: new Date().toISOString() } : k)));
    const ok = await revokeApiKey(key.id);
    if (ok) {
      toast.success(`Key "${key.name}" revoked.`);
    } else {
      setKeys(prev);
      toast.error("Couldn't revoke the key.");
    }
  };

  const handleDelete = async (key) => {
    setConfirm(null);
    setOpenId(null);
    const prev = keys;
    setKeys((rows) => rows.filter((k) => k.id !== key.id));
    const ok = await deleteApiKey(key.id);
    if (ok) {
      toast.success(`Key "${key.name}" deleted.`);
    } else {
      setKeys(prev);
      toast.error("Couldn't delete the key.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Key",
      render: (k) => (
        <div className="flex items-center gap-3">
          <IconTile icon={KeyRound} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{k.name}</p>
            <p className="truncate font-mono text-[11px] text-text-tertiary">{k.prefix}…</p>
          </div>
        </div>
      ),
    },
    {
      key: "scopes",
      header: "Permissions",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (k) => <ScopeBadges scopes={k.scopes} />,
    },
    {
      key: "status",
      header: "Status",
      render: (k) => <StatusPill status={keyStatus(k)} map={KEY_STATUS_META} />,
    },
    {
      key: "used",
      header: "Last used",
      className: "hidden lg:table-cell text-xs text-text-secondary",
      headClassName: "hidden lg:table-cell",
      render: (k) => (k.lastUsedAt ? formatDateTime(k.lastUsedAt) : "Never"),
    },
    {
      key: "expires",
      header: "Expires",
      className: "hidden xl:table-cell text-xs text-text-secondary",
      headClassName: "hidden xl:table-cell",
      render: (k) => (k.expiresAt ? formatDate(k.expiresAt) : "Never"),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (k) => {
        const active = keyStatus(k) === "active";
        return (
          <ActionMenu
            label={`Actions for ${k.name}`}
            items={[
              active && {
                icon: pending === k.id ? Loader2 : RotateCcw,
                spin: pending === k.id,
                label: "Rotate secret",
                disabled: pending === k.id,
                onSelect: () => handleRotate(k),
              },
              active && { icon: Ban, label: "Revoke", onSelect: () => setConfirm({ kind: "revoke", key: k }) },
              { separator: true },
              { icon: Trash2, label: "Delete", destructive: true, onSelect: () => setConfirm({ kind: "delete", key: k }) },
            ]}
          />
        );
      },
    },
  ];

  const createButton = (
    <Button className={PRIMARY_BUTTON} onClick={() => setShowCreate(true)}>
      <Plus className="h-4 w-4" />
      Create key
    </Button>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="API Keys"
        description="Scoped keys your own apps use to call the public API."
        actions={
          <>
            <Button variant="outline" className={OUTLINE_BUTTON} onClick={() => setTab("API Reference")}>
              <BookOpen className="h-4 w-4" />
              API reference
            </Button>
            {createButton}
          </>
        }
      />

      {loading ? (
        <LoadingArea panel size={56} label="Loading API keys" />
      ) : (
        <>
          <StatsBar stats={stats} />
          <div className="space-y-4">
            <Toolbar>
              <div className="flex items-center gap-2">
                <FilterDropdown
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  options={KEY_STATUS_FILTER_OPTIONS}
                  placeholder="Status"
                  icon={KeyRound}
                />
                {filtersActive ? (
                  <ClearFiltersButton onClick={() => { setSearch(""); setStatusFilter("all"); }} />
                ) : null}
              </div>
              <SearchInput value={search} onChange={setSearch} placeholder="Search keys…" />
            </Toolbar>
            <DataTable
              columns={columns}
              data={filteredKeys}
              getRowKey={(k) => k.id}
              onRowClick={(k) => setOpenId(k.id)}
              empty={
                <div className="rounded-xl border border-border bg-surface-subtle">
                  <EmptyState
                    icon={KeyRound}
                    title={keys.length === 0 ? "No API keys yet" : "No matching keys"}
                    description={
                      keys.length === 0
                        ? "Create a key to call the public API from your own apps."
                        : "Try a different search or status filter."
                    }
                    action={
                      keys.length === 0 ? (
                        createButton
                      ) : (
                        <Button
                          variant="outline"
                          className={OUTLINE_BUTTON}
                          onClick={() => { setSearch(""); setStatusFilter("all"); }}
                        >
                          Clear filters
                        </Button>
                      )
                    }
                  />
                </div>
              }
            />
          </div>
        </>
      )}

      <KeyDialog open={showCreate} onOpenChange={setShowCreate} onCreate={handleCreate} />
      <SecretDialog secret={secret?.value} keyName={secret?.name} onClose={() => setSecret(null)} />
      <KeySheet
        apiKey={openKey}
        pending={pending === openKey?.id}
        onClose={() => setOpenId(null)}
        onRotate={handleRotate}
        onRevoke={(k) => setConfirm({ kind: "revoke", key: k })}
        onDelete={(k) => setConfirm({ kind: "delete", key: k })}
      />
      <ConfirmDeleteDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.kind === "revoke" ? "Revoke API key" : "Delete API key"}
        description={
          confirm?.kind === "revoke"
            ? `Apps using "${confirm?.key.name}" lose access immediately. The key stays listed as revoked.`
            : `"${confirm?.key.name}" is removed from this project and stops working immediately.`
        }
        confirmLabel={confirm?.kind === "revoke" ? "Revoke key" : "Delete key"}
        onConfirm={() =>
          confirm?.kind === "revoke" ? handleRevoke(confirm.key) : handleDelete(confirm.key)
        }
      />
    </MainScreenWrapper>
  );
}

export default ApiKeysScreen;
