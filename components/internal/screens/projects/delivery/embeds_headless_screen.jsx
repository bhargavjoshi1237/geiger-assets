"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Braces, Code2, Copy, KeyRound, Link as LinkIcon, Loader2, Play, Plus } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  FieldRow,
  RowActions,
  SelectField,
  TextField,
  useModuleRows,
} from "@/components/internal/shared/module_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Checkbox } from "@geiger/ui/checkbox";
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
import { cn } from "@/lib/utils";

import {
  DELIVERY_KEY_SCOPES,
  EMBED_KIND_MAP,
  EMBED_KIND_OPTIONS,
  EMBED_STATUS_MAP,
  VERSION_MODE_OPTIONS,
  embedSnippet,
  formatDate,
} from "./constants";
import {
  createDeliveryKey,
  listDeliveryEvents,
  listDeliveryKeys,
  softDeleteDeliveryKey,
  updateDeliveryKey,
} from "@/lib/supabase/delivery";
import { createEmbed, listEmbeds, softDeleteEmbed, updateEmbed } from "@/lib/supabase/embeds";
import { listDynamicLinks } from "@/lib/supabase/dynamic_links";
import { listAssets } from "@/lib/supabase/assets";
import { getUser } from "@/lib/supabase/user";

const TABS = [
  { value: "generate", label: "Generate" },
  { value: "embeds", label: "Embeds" },
  { value: "keys", label: "API keys" },
  { value: "playground", label: "Playground" },
];

const EMPTY_EMBED = { name: "", kind: "iframe", subjectKind: "asset", subjectId: "", versionMode: "latest", width: "800", height: "450" };

function mintKeySecret() {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `ga_${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

function GeneratorTab({ assets, embeds, setEmbeds, projectId }) {
  const [draft, setDraft] = useState(EMPTY_EMBED);
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const subjectOptions = (assets || []).map((a) => ({ value: a.id, label: a.name }));
  const preview = {
    id: "preview",
    name: draft.name || "Untitled embed",
    kind: draft.kind,
    params: { width: Number(draft.width) || 800, height: Number(draft.height) || 450 },
  };
  const snippet = embedSnippet(preview, { subjectUrl: draft.subjectId ? `/assets/${draft.subjectId}/file` : "" });

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error("Give the embed a name.");
      return;
    }
    if (!draft.subjectId) {
      toast.error("Pick the asset this embed serves.");
      return;
    }
    setSaving(true);
    const user = await getUser();
    const optimistic = {
      id: crypto.randomUUID(),
      projectId,
      name: draft.name.trim(),
      kind: draft.kind,
      subjectKind: draft.subjectKind,
      subjectId: draft.subjectId,
      versionMode: draft.versionMode,
      params: { width: Number(draft.width) || 800, height: Number(draft.height) || 450 },
      status: "active",
      createdBy: user?.id || null,
    };
    setEmbeds((prev) => [optimistic, ...prev]);
    const saved = await createEmbed(optimistic);
    setSaving(false);
    if (saved) {
      setEmbeds((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
      setDraft(EMPTY_EMBED);
      toast.success(`"${saved.name}" registered.`);
    } else {
      setEmbeds((prev) => prev.filter((e) => e.id !== optimistic.id));
      toast.error("Couldn't register the embed.");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Embed code generator" description="Pick a subject and a kind — the snippet is stable across versions.">
        <div className="grid gap-4">
          <TextField label="Name" value={draft.name} onChange={set("name")} placeholder="e.g. Homepage hero" />
          <SelectField label="Subject" value={draft.subjectId} onChange={set("subjectId")} options={subjectOptions} placeholder="Select an asset…" />
          <FieldRow>
            <SelectField label="Kind" value={draft.kind} onChange={set("kind")} options={EMBED_KIND_OPTIONS} />
            <SelectField label="Version" value={draft.versionMode} onChange={set("versionMode")} options={VERSION_MODE_OPTIONS} />
          </FieldRow>
          <FieldRow>
            <TextField label="Width" value={draft.width} onChange={set("width")} inputMode="numeric" />
            <TextField label="Height" value={draft.height} onChange={set("height")} inputMode="numeric" />
          </FieldRow>
          <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Register embed
          </Button>
        </div>
      </SectionCard>
      <SectionCard title="Preview" description={draft.versionMode === "pinned" ? "Pinned to the current version." : "Follows the latest version."} action={<Code2 className="h-4 w-4 text-text-tertiary" />}>
        <pre className="overflow-x-auto rounded-lg border border-border bg-black/40 p-3 font-mono text-[11px] leading-5 text-text-secondary">{snippet}</pre>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full border-border bg-transparent"
          onClick={() => {
            navigator.clipboard?.writeText(snippet);
            toast.success("Snippet copied.");
          }}
        >
          <Copy className="h-3.5 w-3.5" /> Copy snippet
        </Button>
        <p className="mt-3 text-[11px] text-text-tertiary">
          {embeds.length} registered embed{embeds.length === 1 ? "" : "s"} in this project.
        </p>
      </SectionCard>
    </div>
  );
}

function EmbedsTab({ embeds, setEmbeds, events, assets, search, setSearch }) {
  const assetName = useMemo(() => {
    const map = new Map((assets || []).map((a) => [a.id, a.name]));
    return (id) => map.get(id) || "Unknown subject";
  }, [assets]);

  const usage = useMemo(() => {
    const map = new Map();
    for (const e of events || []) {
      if (!e.embedId) continue;
      const entry = map.get(e.embedId) || { requests: 0, referrers: {} };
      entry.requests += 1;
      if (e.referrerHost) entry.referrers[e.referrerHost] = (entry.referrers[e.referrerHost] || 0) + 1;
      map.set(e.embedId, entry);
    }
    return map;
  }, [events]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return embeds.filter((e) => !term || `${e.name} ${assetName(e.subjectId)}`.toLowerCase().includes(term));
  }, [embeds, search, assetName]);

  const handleToggle = async (embed) => {
    const next = embed.status === "active" ? "paused" : "active";
    const previous = embed.status;
    setEmbeds((prev) => prev.map((e) => (e.id === embed.id ? { ...e, status: next } : e)));
    const saved = await updateEmbed(embed.id, { status: next });
    if (saved) setEmbeds((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
    else {
      setEmbeds((prev) => prev.map((e) => (e.id === embed.id ? { ...e, status: previous } : e)));
      toast.error("Couldn't change the embed status.");
    }
  };

  const handleDelete = async (embed) => {
    setEmbeds((prev) => prev.filter((e) => e.id !== embed.id));
    const ok = await softDeleteEmbed(embed.id);
    if (ok) toast.success(`Deleted "${embed.name}".`);
    else {
      setEmbeds((prev) => [embed, ...prev]);
      toast.error("Couldn't delete the embed.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Embed",
      render: (e) => (
        <div className="min-w-0">
          <p className="max-w-[220px] truncate text-sm font-medium text-foreground">{e.name}</p>
          <p className="max-w-[240px] truncate text-[11px] text-text-tertiary">
            {e.subjectKind} · {assetName(e.subjectId)} · {e.versionMode}
          </p>
        </div>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      render: (e) => (
        <Badge className="border border-border bg-surface-card px-1.5 py-0 text-[10px] text-text-secondary">
          {EMBED_KIND_MAP[e.kind]?.label || e.kind}
        </Badge>
      ),
    },
    {
      key: "requests",
      header: "Requests",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (e) => (usage.get(e.id)?.requests || 0).toLocaleString("en-US"),
    },
    {
      key: "referrer",
      header: "Top referrer",
      className: "hidden max-w-[160px] truncate text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (e) => {
        const referrers = usage.get(e.id)?.referrers || {};
        const top = Object.entries(referrers).sort((a, b) => b[1] - a[1])[0];
        return top ? top[0] : "—";
      },
    },
    {
      key: "status",
      header: "Status",
      render: (e) => <StatusPill status={e.status} map={EMBED_STATUS_MAP} className="text-[10px]" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (e) => (
        <div onClick={(ev) => ev.stopPropagation()}>
          <RowActions
            onEdit={() => handleToggle(e)}
            editLabel={e.status === "active" ? "Pause" : "Resume"}
            onDelete={() => handleDelete(e)}
            extra={[
              { icon: Copy, label: "Copy snippet", onSelect: () => {
                navigator.clipboard?.writeText(embedSnippet(e, { subjectUrl: `/assets/${e.subjectId}/file` }));
                toast.success("Snippet copied.");
              } },
              { separator: true },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Toolbar>
        <p className="text-xs text-text-tertiary">Referrer and request counts come from delivery events.</p>
        <SearchInput value={search} onChange={setSearch} placeholder="Search embeds…" />
      </Toolbar>
      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={(e) => e.id}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={LinkIcon}
              title={embeds.length ? "No embeds match" : "No registered embeds"}
              description="Generate an embed code and it lands here with live request counts."
            />
          </div>
        }
      />
    </div>
  );
}

function KeysTab({ keys, setKeys, projectId }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState(["assets:read"]);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState(null);

  const toggleScope = (value) =>
    setScopes((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Give the key a name.");
      return;
    }
    if (!scopes.length) {
      toast.error("Pick at least one scope.");
      return;
    }
    setCreating(true);
    const user = await getUser();
    const raw = mintKeySecret();
    const optimistic = {
      id: crypto.randomUUID(),
      projectId,
      name: name.trim(),
      prefix: raw.slice(3, 11),
      keyHash: raw,
      scopes,
      createdBy: user?.id || null,
    };
    setKeys((prev) => [optimistic, ...prev]);
    // Demo posture (like share-link passwords): the verifier is stored as
    // issued. Hash server-side before treating this as real protection.
    const saved = await createDeliveryKey(optimistic);
    setCreating(false);
    if (saved) {
      setKeys((prev) => prev.map((k) => (k.id === saved.id ? saved : k)));
      setSecret({ name: saved.name, raw });
      setName("");
      setScopes(["assets:read"]);
      toast.success(`"${saved.name}" created.`);
    } else {
      setKeys((prev) => prev.filter((k) => k.id !== optimistic.id));
      toast.error("Couldn't create the key.");
    }
  };

  const handleRevoke = async (key) => {
    const previous = key.revokedAt;
    const at = new Date().toISOString();
    setKeys((prev) => prev.map((k) => (k.id === key.id ? { ...k, revokedAt: at } : k)));
    const saved = await updateDeliveryKey(key.id, { revokedAt: at });
    if (saved) {
      setKeys((prev) => prev.map((k) => (k.id === saved.id ? saved : k)));
      toast.success(`"${key.name}" revoked.`);
    } else {
      setKeys((prev) => prev.map((k) => (k.id === key.id ? { ...k, revokedAt: previous } : k)));
      toast.error("Couldn't revoke the key.");
    }
  };

  const handleDelete = async (key) => {
    setKeys((prev) => prev.filter((k) => k.id !== key.id));
    const ok = await softDeleteDeliveryKey(key.id);
    if (ok) toast.success(`Deleted "${key.name}".`);
    else {
      setKeys((prev) => [key, ...prev]);
      toast.error("Couldn't delete the key.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Key",
      render: (k) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
            <KeyRound className="h-4 w-4 text-text-secondary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{k.name}</p>
            <p className="font-mono text-[11px] text-text-tertiary">…{k.prefix}</p>
          </div>
        </div>
      ),
    },
    {
      key: "scopes",
      header: "Scopes",
      render: (k) => (
        <div className="flex max-w-[240px] flex-wrap gap-1">
          {k.scopes.map((s) => (
            <Badge key={s} className="border border-border bg-surface-card px-1.5 py-0 font-mono text-[10px] text-text-secondary">{s}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: "used",
      header: "Last used",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (k) => formatDate(k.lastUsedAt),
    },
    {
      key: "status",
      header: "Status",
      render: (k) => (
        <Badge className={cn("border px-1.5 py-0 text-[10px]", k.revokedAt ? "border-red-500/30 bg-red-500/15 text-red-300" : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300")}>
          {k.revokedAt ? "Revoked" : "Live"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (k) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            onEdit={k.revokedAt ? undefined : () => handleRevoke(k)}
            editLabel="Revoke"
            onDelete={() => handleDelete(k)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,0.7fr)_minmax(0,1.3fr)]">
      <SectionCard title="New API key" description="Scoped access for headless clients.">
        <div className="grid gap-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website backend" className="bg-surface-card" />
          </Field>
          <Field label="Scopes">
            <div className="space-y-2">
              {DELIVERY_KEY_SCOPES.map((s) => (
                <label key={s.value} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm">
                  <Checkbox checked={scopes.includes(s.value)} onCheckedChange={() => toggleScope(s.value)} />
                  <span>
                    <span className="block text-foreground">{s.label}</span>
                    <span className="block font-mono text-[10px] text-text-tertiary">{s.value}</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
          <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create key
          </Button>
        </div>
      </SectionCard>
      <DataTable
        columns={columns}
        data={keys}
        getRowKey={(k) => k.id}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState icon={KeyRound} title="No API keys" description="Create a scoped key for a headless client." />
          </div>
        }
      />
      <Dialog open={!!secret} onOpenChange={(open) => !open && setSecret(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copy the secret once</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{secret?.name}</span> — it won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>
          <pre className="overflow-x-auto rounded-lg border border-border bg-black/40 p-3 font-mono text-xs text-foreground">{secret?.raw}</pre>
          <DialogFooter>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                navigator.clipboard?.writeText(secret?.raw || "");
                toast.success("Secret copied.");
                setSecret(null);
              }}
            >
              <Copy className="h-4 w-4" /> Copy and close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlaygroundTab({ assets, dynamicLinks, embeds, projectId }) {
  const [source, setSource] = useState("assets");
  const [limit, setLimit] = useState("5");
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const n = Math.max(1, Math.min(25, Number(limit) || 5));
    let rows = null;
    if (source === "assets") rows = await listAssets(projectId);
    else if (source === "dynamic_links") rows = await listDynamicLinks(projectId);
    else rows = await listEmbeds(projectId);
    setRunning(false);
    if (!rows) {
      toast.error("The headless query failed.");
      return;
    }
    setResult({ source, count: rows.length, sample: rows.slice(0, n) });
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,0.7fr)_minmax(0,1.3fr)]">
      <SectionCard title="Headless query playground" description="Read-only queries against the delivery surface.">
        <div className="grid gap-4">
          <Field label="Source">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="bg-surface-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="assets">Assets ({(assets || []).length})</SelectItem>
                <SelectItem value="dynamic_links">Dynamic links ({(dynamicLinks || []).length})</SelectItem>
                <SelectItem value="embeds">Embeds ({(embeds || []).length})</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Sample size" hint="Max 25 rows.">
            <Input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="numeric" className="bg-surface-card" />
          </Field>
          <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={run} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run query
          </Button>
        </div>
      </SectionCard>
      <SectionCard title="Result" description={result ? `${result.count} rows · showing ${result.sample.length}` : "No query yet."} action={<Braces className="h-4 w-4 text-text-tertiary" />}>
        <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-black/40 p-3 font-mono text-[11px] leading-5 text-text-secondary">
          {result ? JSON.stringify(result.sample, null, 2) : "// Pick a source and run a query."}
        </pre>
      </SectionCard>
    </div>
  );
}

export function EmbedsHeadlessScreen({ projectId }) {
  const [tab, setTab] = useState("generate");
  const [embeds, setEmbeds] = useModuleRows(listEmbeds, projectId);
  const [events] = useModuleRows(listDeliveryEvents, projectId);
  const [keys, setKeys] = useModuleRows(listDeliveryKeys, projectId);
  const [assets] = useModuleRows(listAssets, projectId);
  const [dynamicLinks] = useModuleRows(listDynamicLinks, projectId);
  const [search, setSearch] = useState("");

  const loading = embeds === null || keys === null;
  const embedRows = useMemo(() => embeds ?? [], [embeds]);
  const eventRows = useMemo(() => events ?? [], [events]);

  const stats = useMemo(() => {
    const active = embedRows.filter((e) => e.status === "active").length;
    const requests = eventRows.filter((e) => e.kind === "embed" || e.embedId).length;
    return [
      { label: "Embeds", value: String(embedRows.length), footer: `${active} active` },
      { label: "Embed requests", value: requests.toLocaleString("en-US"), footer: "From delivery events" },
      { label: "API keys", value: String((keys ?? []).length), footer: "Headless access" },
      { label: "Sources", value: String((assets ?? []).length), footer: "Queryable assets" },
    ];
  }, [embedRows, eventRows, keys, assets]);

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Embeds & Headless"
        description="Use assets in applications without coupling to the DAM UI — snippets, stable URLs, and scoped keys."
      />

      <StatsBar stats={stats} />

      <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-subtle p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === t.value ? "bg-surface-card text-foreground" : "text-text-secondary hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingArea panel size={56} label="Loading embeds…" />
      ) : tab === "generate" ? (
        <GeneratorTab assets={assets ?? []} embeds={embedRows} setEmbeds={setEmbeds} projectId={projectId} />
      ) : tab === "embeds" ? (
        <EmbedsTab embeds={embedRows} setEmbeds={setEmbeds} events={eventRows} assets={assets ?? []} search={search} setSearch={setSearch} />
      ) : tab === "keys" ? (
        <KeysTab keys={keys ?? []} setKeys={setKeys} projectId={projectId} />
      ) : (
        <PlaygroundTab assets={assets ?? []} dynamicLinks={dynamicLinks ?? []} embeds={embedRows} projectId={projectId} />
      )}
    </MainScreenWrapper>
  );
}

export default EmbedsHeadlessScreen;
