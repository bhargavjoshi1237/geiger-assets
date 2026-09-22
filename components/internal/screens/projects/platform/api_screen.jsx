"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RotateCcw,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SectionCard,
  SegmentedTabs,
  SettingRow,
  SettingsList,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  ClearFiltersButton,
  CreateDialog,
  RowActions,
  TextField,
} from "@/components/internal/shared/module_kit";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Checkbox } from "@geiger/ui/checkbox";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { Label } from "@geiger/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import { useCopied } from "@/lib/use-copied";
import {
  API_SCOPES,
  API_TAB_OPTIONS,
  EFFECT_OPTIONS,
  FORMAT_OPTIONS,
  KEY_STATUS_META,
  REFERENCE_ENDPOINTS,
  formatDateTime,
  keyStatus,
} from "./constants";
import {
  deleteApiKey,
  getDeliverySettings,
  listApiKeys,
  listUsage,
  mintApiKey,
  revokeApiKey,
  rotateApiKey,
  saveDeliverySettings,
} from "@/lib/supabase/platform";
import { getUser } from "@/lib/supabase/user";

function CopyButton({ value, label }) {
  const [copied, flashCopied] = useCopied(2000);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label || "Copy"}
      className="h-7 w-7 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          flashCopied();
        } catch {
          toast.error("Couldn't copy.");
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

// Keys -------------------------------------------------------------------------

const EMPTY_KEY_DRAFT = { name: "", scopes: ["assets:read"], expiresAt: "" };

function KeyDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState(EMPTY_KEY_DRAFT);
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const toggleScope = (scope, checked) => {
    setDraft((d) => {
      const next = new Set(d.scopes || []);
      if (checked) next.add(scope);
      else next.delete(scope);
      return { ...d, scopes: Array.from(next) };
    });
  };

  const submit = async () => {
    if (!draft.name.trim()) {
      toast.error("Give the key a name first.");
      return;
    }
    if (!(draft.scopes || []).length) {
      toast.error("Grant at least one scope.");
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
      description="The secret is shown once — copy it before closing."
      submitLabel="Create key"
      submitDisabled={saving}
      onSubmit={submit}
    >
      <TextField label="Key name" value={draft.name} onChange={set("name")} placeholder="e.g. Storefront server" />
      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">
          Scopes ({(draft.scopes || []).length} selected)
        </Label>
        <div className="grid gap-1 rounded-lg border border-border bg-surface-card p-3">
          {API_SCOPES.map((s) => (
            <label
              key={s.value}
              className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1 hover:bg-surface-hover"
            >
              <Checkbox
                checked={(draft.scopes || []).includes(s.value)}
                onCheckedChange={(v) => toggleScope(s.value, v === true)}
                aria-label={s.label}
              />
              <span>
                <span className="block text-sm text-foreground">{s.label}</span>
                <span className="block text-xs text-text-tertiary">{s.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <TextField
        label="Expires at"
        value={draft.expiresAt}
        onChange={set("expiresAt")}
        placeholder="Optional — YYYY-MM-DD"
        hint="Leave blank for a key that never expires."
      />
    </CreateDialog>
  );
}

function SecretDialog({ secret, onOpenChange }) {
  return (
    <Dialog open={!!secret} onOpenChange={(next) => !next && onOpenChange()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Copy your secret</DialogTitle>
          <DialogDescription>
            This is the only time the secret is shown. Store it somewhere safe.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">{secret}</code>
          <CopyButton value={secret || ""} label="Copy secret" />
        </div>
        <DialogFooter>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onOpenChange}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Delivery settings ---------------------------------------------------------------

const DEFAULT_SETTINGS_FORM = {
  maxWidth: 4000,
  maxHeight: 4000,
  maxMegapixels: 25,
  allowedFormats: ["auto", "webp", "avif", "jpg", "png"],
  allowedEffects: ["blur", "sharpen", "grayscale", "sepia", "negate", "brightness", "contrast", "saturation", "tint"],
  referrerAllowlist: [],
  monthlyTransformBudget: 100000,
  requireSignedUrls: false,
};

function fromSettings(settings) {
  if (!settings) return { ...DEFAULT_SETTINGS_FORM };
  return {
    maxWidth: settings.maxWidth,
    maxHeight: settings.maxHeight,
    maxMegapixels: settings.maxMegapixels,
    allowedFormats: settings.allowedFormats?.length ? settings.allowedFormats : [...DEFAULT_SETTINGS_FORM.allowedFormats],
    allowedEffects: settings.allowedEffects?.length ? settings.allowedEffects : [...DEFAULT_SETTINGS_FORM.allowedEffects],
    referrerAllowlist: settings.referrerAllowlist || [],
    monthlyTransformBudget: settings.monthlyTransformBudget,
    requireSignedUrls: settings.requireSignedUrls,
  };
}

// Main screen ----------------------------------------------------------------------

export function ApiScreen({ projectId }) {
  const [tab, setTab] = useState("keys");
  const [keys, setKeys] = useState([]);
  const [settings, setSettings] = useState(null);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [usageFilter, setUsageFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [secret, setSecret] = useState(null);
  const [pending, setPending] = useState(null);
  const [form, setForm] = useState({ ...DEFAULT_SETTINGS_FORM });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([listApiKeys(projectId), getDeliverySettings(projectId), listUsage(projectId)]).then(
      ([k, s, u]) => {
        if (!alive) return;
        setKeys(k ?? []);
        setSettings(s);
        setForm(fromSettings(s));
        setUsage(u ?? []);
        setLoading(false);
      },
    );
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

  const filteredUsage = useMemo(
    () => usage.filter((u) => usageFilter === "all" || u.kind === usageFilter),
    [usage, usageFilter],
  );

  const stats = useMemo(() => {
    const active = keys.filter((k) => keyStatus(k) === "active").length;
    const transforms = usage.reduce((n, u) => n + (Number(u.transforms) || 0), 0);
    return [
      { label: "API keys", value: String(keys.length), footer: `${active} active` },
      { label: "API calls", value: usage.filter((u) => u.kind === "api").length.toLocaleString("en-US"), footer: "Logged requests" },
      { label: "Transforms", value: transforms.toLocaleString("en-US"), footer: `Budget ${Number(form.monthlyTransformBudget || 0).toLocaleString("en-US")}/mo` },
      { label: "Deliveries", value: usage.filter((u) => u.kind === "delivery").length.toLocaleString("en-US"), footer: "Dynamic renders" },
    ];
  }, [keys, usage, form.monthlyTransformBudget]);

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
      setSecret(minted.secret);
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
      setSecret(rotated.secret);
      toast.success(`Key "${key.name}" rotated — the old secret stopped working.`);
    } else {
      toast.error("Couldn't rotate the key.");
    }
  };

  const handleRevoke = async (key) => {
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

  const settingsDirty = useMemo(() => {
    const base = fromSettings(settings);
    return JSON.stringify({ ...base, allowedFormats: [...base.allowedFormats].sort(), allowedEffects: [...base.allowedEffects].sort() })
      !== JSON.stringify({ ...form, allowedFormats: [...form.allowedFormats].sort(), allowedEffects: [...form.allowedEffects].sort() });
  }, [settings, form]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    const saved = await saveDeliverySettings(projectId, {
      ...form,
      maxWidth: Number(form.maxWidth) || 4000,
      maxHeight: Number(form.maxHeight) || 4000,
      maxMegapixels: Number(form.maxMegapixels) || 25,
      monthlyTransformBudget: Number(form.monthlyTransformBudget) || 0,
    });
    setSavingSettings(false);
    if (saved) {
      setSettings(saved);
      setForm(fromSettings(saved));
      toast.success("Delivery policy saved.");
    } else {
      toast.error("Couldn't save the delivery policy.");
    }
  };

  const toggleList = (listKey, value) => {
    setForm((f) => {
      const next = new Set(f[listKey] || []);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...f, [listKey]: Array.from(next) };
    });
  };

  const keyColumns = [
    {
      key: "name",
      header: "Key",
      render: (k) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
            <KeyRound className="h-4 w-4 text-text-secondary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{k.name}</p>
            <p className="truncate font-mono text-[11px] text-text-tertiary">{k.prefix}…</p>
          </div>
        </div>
      ),
    },
    {
      key: "scopes",
      header: "Scopes",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (k) => (
        <span className="text-xs text-text-secondary">
          {(k.scopes || []).length} scope{(k.scopes || []).length === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (k) => <StatusPill status={keyStatus(k)} map={KEY_STATUS_META} className="text-[10px]" />,
    },
    {
      key: "used",
      header: "Last used",
      className: "hidden lg:table-cell text-xs text-text-secondary",
      headClassName: "hidden lg:table-cell",
      render: (k) => formatDateTime(k.lastUsedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (k) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            editLabel={pending === k.id ? "Rotating…" : "Rotate secret"}
            editIcon={RotateCcw}
            onEdit={keyStatus(k) === "active" ? () => handleRotate(k) : undefined}
            onDelete={() => handleDelete(k)}
            deleteLabel="Delete"
            extra={
              keyStatus(k) === "active"
                ? [{ icon: KeyRound, label: "Revoke", onSelect: () => handleRevoke(k) }]
                : []
            }
          />
        </div>
      ),
    },
  ];

  const usageColumns = [
    {
      key: "route",
      header: "Request",
      render: (u) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-foreground">{u.route}</p>
          <p className="text-[11px] uppercase tracking-wider text-text-tertiary">{u.method} · {u.kind}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <Badge
          className={cn(
            "border px-1.5 py-0 text-[10px]",
            u.status >= 500
              ? "border-red-500/30 bg-red-500/15 text-red-300"
              : u.status >= 400
                ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
          )}
        >
          {u.status}
        </Badge>
      ),
    },
    {
      key: "at",
      header: "When",
      className: "hidden sm:table-cell text-xs text-text-secondary",
      headClassName: "hidden sm:table-cell",
      render: (u) => formatDateTime(u.createdAt),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="API"
        description="Keys, the delivery policy, usage and a copy-paste reference for the public API."
        actions={
          tab === "keys" ? (
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-4 w-4" />
              Create key
            </Button>
          ) : tab === "delivery" ? (
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSaveSettings}
              disabled={!settingsDirty || savingSettings}
            >
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {settingsDirty ? "Save policy" : "Saved"}
            </Button>
          ) : null
        }
      />

      <SegmentedTabs tabs={API_TAB_OPTIONS} value={tab} onChange={setTab} />

      {loading ? (
        <LoadingArea panel size={56} />
      ) : tab === "keys" ? (
        <>
          <StatsBar stats={stats} />
          <Toolbar>
            <FilterDropdown
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "active", label: "Active" },
                { value: "expired", label: "Expired" },
                { value: "revoked", label: "Revoked" },
              ]}
              placeholder="Status"
              icon={KeyRound}
            />
            {filtersActive ? <ClearFiltersButton onClick={() => { setSearch(""); setStatusFilter("all"); }} /> : null}
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search keys..."
              className="w-full sm:w-64"
            />
          </Toolbar>
          <DataTable
            columns={keyColumns}
            data={filteredKeys}
            getRowKey={(k) => k.id}
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
                      <Button
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => setShowCreate(true)}
                      >
                        <Plus className="h-4 w-4" />
                        Create key
                      </Button>
                    ) : null
                  }
                />
              </div>
            }
          />
        </>
      ) : tab === "delivery" ? (
        <div className="space-y-4">
          <SectionCard
            title="Transform limits"
            description="The policy is open by default — these bounds keep renders sane."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Max width (px)">
                <Input
                  value={form.maxWidth}
                  onChange={(e) => setForm((f) => ({ ...f, maxWidth: e.target.value }))}
                  inputMode="numeric"
                  className="bg-surface-card"
                />
              </Field>
              <Field label="Max height (px)">
                <Input
                  value={form.maxHeight}
                  onChange={(e) => setForm((f) => ({ ...f, maxHeight: e.target.value }))}
                  inputMode="numeric"
                  className="bg-surface-card"
                />
              </Field>
              <Field label="Max megapixels">
                <Input
                  value={form.maxMegapixels}
                  onChange={(e) => setForm((f) => ({ ...f, maxMegapixels: e.target.value }))}
                  inputMode="decimal"
                  className="bg-surface-card"
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Monthly transform budget">
                <Input
                  value={form.monthlyTransformBudget}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyTransformBudget: e.target.value }))}
                  inputMode="numeric"
                  className="bg-surface-card"
                />
              </Field>
              <Field label="Referrer allowlist" hint="One hostname per line. Empty allows every referrer.">
                <Input
                  value={(form.referrerAllowlist || []).join("\n")}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      referrerAllowlist: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                    }))
                  }
                  placeholder="example.com"
                  className="bg-surface-card"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Allowed formats" description="f_ values the engine will render.">
            <div className="flex flex-wrap gap-2">
              {FORMAT_OPTIONS.map((o) => {
                const on = (form.allowedFormats || []).includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleList("allowedFormats", o.value)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                      on
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border bg-surface-card text-text-secondary hover:bg-surface-hover",
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Allowed effects" description="e_ values the engine will apply.">
            <div className="flex flex-wrap gap-2">
              {EFFECT_OPTIONS.map((o) => {
                const on = (form.allowedEffects || []).includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleList("allowedEffects", o.value)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                      on
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border bg-surface-card text-text-secondary hover:bg-surface-hover",
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="URL signing" description="Optional extra protection for delivery URLs.">
            <SettingsList>
              <SettingRow
                title="Require signed URLs"
                description="Off by default. When on, /d/ URLs need a valid sig minted via the delivery API."
                control={
                  <Switch
                    checked={Boolean(form.requireSignedUrls)}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, requireSignedUrls: v }))}
                    aria-label="Require signed URLs"
                  />
                }
              />
            </SettingsList>
          </SectionCard>
        </div>
      ) : tab === "usage" ? (
        <>
          <StatsBar stats={stats} />
          <Toolbar>
            <FilterDropdown
              value={usageFilter}
              onValueChange={setUsageFilter}
              options={[
                { value: "all", label: "All Kinds" },
                { value: "api", label: "API" },
                { value: "delivery", label: "Delivery" },
                { value: "transform", label: "Transforms" },
              ]}
              placeholder="Kind"
              icon={KeyRound}
            />
          </Toolbar>
          <DataTable
            columns={usageColumns}
            data={filteredUsage}
            getRowKey={(u) => u.id}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={KeyRound}
                  title={usage.length === 0 ? "No usage yet" : "No matching calls"}
                  description={
                    usage.length === 0
                      ? "Calls made with an API key and every dynamic render land here."
                      : "Try a different kind filter."
                  }
                />
              </div>
            }
          />
        </>
      ) : (
        <div className="space-y-4">
          {REFERENCE_ENDPOINTS.map((e) => (
            <SectionCard
              key={`${e.method} ${e.path}`}
              title={`${e.title}`}
              description={e.description}
              action={
                <Badge className="border border-border bg-surface-card px-1.5 py-0 font-mono text-[10px] text-foreground">
                  {e.method}
                </Badge>
              }
            >
              <code className="mb-2 block truncate font-mono text-xs text-text-secondary">{e.path}</code>
              <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-card px-3 py-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-foreground">{e.curl}</code>
                <CopyButton value={e.curl} label={`Copy ${e.title} cURL`} />
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <KeyDialog open={showCreate} onOpenChange={setShowCreate} onCreate={handleCreate} />
      <SecretDialog secret={secret} onOpenChange={() => setSecret(null)} />
    </MainScreenWrapper>
  );
}

export default ApiScreen;
