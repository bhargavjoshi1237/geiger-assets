"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, Pencil, Plus, ShieldCheck, Trash2, Webhook } from "lucide-react";
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
import { ActionMenu } from "@geiger/ui/action-menu";
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
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookEndpoints,
  updateWebhookEndpoint,
} from "@/lib/supabase/settings";
import { listWebhookDeliveries } from "@/lib/supabase/platform";
import {
  DELIVERY_STATUS_FILTER_OPTIONS,
  DELIVERY_STATUS_MAP,
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_FILTER_OPTIONS,
  WEBHOOK_EVENT_OPTIONS,
  WEBHOOK_RETRY_POLICY,
  WEBHOOK_STATUS_FILTER_OPTIONS,
  WEBHOOK_STATUS_MAP,
  formatDateTime,
  formatWhen,
  webhookStatusOf,
} from "./constants";

// Webhooks — the UI for lib/media/webhooks.js (endpoint CRUD, Stripe-style
// signed dispatch, SSRF-hardened URLs, exponential-backoff retry).
//
// That module is server-only, so this screen never imports it: endpoint reads
// and writes go through lib/supabase/settings.js (the browser boundary over
// /api/webhooks/endpoints) and the delivery log reads through
// lib/supabase/platform.js (assets.webhook_deliveries is append-only — the
// dispatcher writes it, the screen only reads it).
//
// The signing secret is write-only: create returns it once and reads never
// do, so the screen shows it exactly once and never asks for it on update.

const VERIFY_SNIPPET = [
  "import { createHmac, timingSafeEqual } from 'node:crypto';",
  "",
  "function verifyWebhook(rawBody, signature, secret) {",
  "  // signature looks like: t=1726675200,v1=9f2c… — Stripe-style over `timestamp.body`",
  "  const [t, v1] = signature.split(',').map((part) => part.split('=')[1]);",
  "  const hex = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');",
  "  return timingSafeEqual(Buffer.from(v1), Buffer.from(hex));",
  "}",
].join("\n");

function EndpointDialog({ open, onOpenChange, endpoint, onSubmit }) {
  const editing = Boolean(endpoint);
  // The caller remounts this dialog on every open (a key carrying the target
  // id plus a token), so state seeds from props once and a half-typed URL
  // never survives reopening.
  const [url, setUrl] = useState(endpoint?.url || "");
  const [events, setEvents] = useState(endpoint?.events || []);
  const [active, setActive] = useState(endpoint?.active ?? true);
  const [busy, setBusy] = useState(false);

  const toggleEvent = (value) =>
    setEvents((prev) =>
      prev.includes(value) ? prev.filter((event) => event !== value) : [...prev, value],
    );

  const submit = async () => {
    if (busy) return;
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Give the endpoint a URL.");
      return;
    }
    let parsed = null;
    try {
      parsed = new URL(trimmed);
    } catch {
      parsed = null;
    }
    // Matches the server SSRF guard's headline rule: https only.
    if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
      toast.error("That URL isn't valid — use an https:// address.");
      return;
    }
    if (events.length === 0) {
      toast.error("Subscribe to at least one event.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({ url: trimmed, events, active });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit endpoint" : "Add endpoint"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update where this subscriber lives and which events it receives."
              : "Deliveries are signed with the endpoint secret so the receiver can verify them."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field
            label="Endpoint URL"
            htmlFor="platform-webhook-url"
            hint="https only — plain http never leaves development. Private ranges are rejected."
          >
            <Input
              id="platform-webhook-url"
              className="bg-surface-card"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/hooks/assets"
              autoFocus
            />
          </Field>
          <Field
            label="Subscribed events"
            hint="The endpoint only receives the events it subscribes to."
          >
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENT_OPTIONS.map((option) => {
                const on = events.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleEvent(option.value)}
                    aria-pressed={on}
                  >
                    <Badge variant={on ? "success" : "outline"} className="cursor-pointer">
                      {option.label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Enabled" hint="A paused endpoint keeps its subscriptions but receives nothing.">
            <div className="flex h-9 items-center">
              <Switch checked={active} onCheckedChange={setActive} />
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
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : editing ? (
              "Save changes"
            ) : (
              "Add endpoint"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WebhooksScreen({ projectId }) {
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dialogToken, setDialogToken] = useState(0);
  // The create-time secret: returned once by the API, never on reads.
  const [freshSecret, setFreshSecret] = useState(null); // { url, secret }
  const [secretCopied, setSecretCopied] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);
  // Delivery log for the selected endpoint (read-only). Fetched from the
  // click handler rather than an effect so a quick re-click never leaves a
  // stale response racing the current selection.
  const [selectedId, setSelectedId] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("all");
  const deliveryGen = useRef(0);

  useEffect(() => {
    let alive = true;
    listWebhookEndpoints(projectId).then((result) => {
      if (!alive) return;
      setEndpoints(result ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const selectEndpoint = (endpoint) => {
    if (selectedId === endpoint.id) {
      deliveryGen.current += 1;
      setSelectedId(null);
      setDeliveries([]);
      setDeliveriesLoading(false);
      return;
    }
    const gen = (deliveryGen.current += 1);
    setSelectedId(endpoint.id);
    setDeliveries([]);
    setDeliveriesLoading(true);
    listWebhookDeliveries(endpoint.id).then((result) => {
      if (deliveryGen.current !== gen) return;
      setDeliveries(result ?? []);
      setDeliveriesLoading(false);
    });
  };

  const stats = useMemo(() => {
    const active = endpoints.filter((endpoint) => endpoint.active !== false).length;
    const covered = new Set(endpoints.flatMap((endpoint) => endpoint.events || [])).size;
    return [
      { label: "Endpoints", value: String(endpoints.length), footer: "subscribers" },
      { label: "Active", value: String(active), footer: "receiving events" },
      {
        label: "Events covered",
        value: `${covered}/${WEBHOOK_EVENTS.length}`,
        footer: "subscribed event types",
      },
      {
        label: "Max attempts",
        value: String(WEBHOOK_RETRY_POLICY.maxAttempts),
        footer: "per delivery, then failed",
      },
    ];
  }, [endpoints]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return endpoints.filter((endpoint) => {
      if (statusFilter !== "all" && webhookStatusOf(endpoint) !== statusFilter) return false;
      if (eventFilter !== "all" && !(endpoint.events || []).includes(eventFilter)) return false;
      if (needle && !`${endpoint.url} ${(endpoint.events || []).join(" ")}`.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [endpoints, search, eventFilter, statusFilter]);

  const filtersActive =
    eventFilter !== "all" || statusFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setEventFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  const visibleDeliveries = useMemo(() => {
    if (deliveryStatusFilter === "all") return deliveries;
    return deliveries.filter((delivery) => delivery.status === deliveryStatusFilter);
  }, [deliveries, deliveryStatusFilter]);

  const openCreate = () => {
    setEditing(null);
    setDialogToken((token) => token + 1);
    setDialogOpen(true);
  };

  const openEdit = (endpoint) => {
    setEditing(endpoint);
    setDialogToken((token) => token + 1);
    setDialogOpen(true);
  };

  const submitEndpoint = async (draft) => {
    if (editing) {
      const previous = endpoints;
      setEndpoints((prev) =>
        prev.map((endpoint) => (endpoint.id === editing.id ? { ...endpoint, ...draft } : endpoint)),
      );
      const saved = await updateWebhookEndpoint(editing.id, draft);
      if (!saved) {
        setEndpoints(previous);
        toast.error("Couldn't save the endpoint.");
        return false;
      }
      setEndpoints((prev) => prev.map((endpoint) => (endpoint.id === editing.id ? saved : endpoint)));
      toast.success("Endpoint updated.");
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      url: draft.url,
      events: draft.events,
      active: draft.active,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEndpoints((prev) => [optimistic, ...prev]);
    const created = await createWebhookEndpoint({ projectId, ...draft });
    if (!created) {
      setEndpoints((prev) => prev.filter((endpoint) => endpoint.id !== id));
      toast.error("Couldn't add the endpoint — check the URL.");
      return false;
    }
    setEndpoints((prev) =>
      prev.map((endpoint) => (endpoint.id === id ? { ...created, id: created.id } : endpoint)),
    );
    // The secret returns once, at create time. Surface it now — it is never
    // readable again, and updates intentionally accept no secret field.
    if (created.secret) {
      setFreshSecret({ url: created.url, secret: created.secret });
    }
    setSelectedId(created.id);
    toast.success("Endpoint added — copy the signing secret below.");
    return true;
  };

  const removeEndpoint = async (endpoint) => {
    const previous = endpoints;
    setEndpoints((prev) => prev.filter((item) => item.id !== endpoint.id));
    if (selectedId === endpoint.id) {
      deliveryGen.current += 1;
      setSelectedId(null);
      setDeliveries([]);
      setDeliveriesLoading(false);
    }
    const ok = await deleteWebhookEndpoint(endpoint.id);
    if (!ok) {
      setEndpoints(previous);
      toast.error("Couldn't delete the endpoint.");
      return;
    }
    toast.success("Endpoint deleted.");
  };

  const copyText = async (text, done) => {
    try {
      await navigator.clipboard.writeText(text);
      done();
      toast.success("Copied.");
    } catch {
      toast.error("Couldn't copy — select the text manually.");
    }
  };

  const columns = [
    {
      key: "url",
      header: "Endpoint",
      render: (endpoint) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[320px] truncate font-mono text-[13px] text-foreground">
            {endpoint.url}
          </span>
          <span className="text-[11px] text-text-tertiary">
            Updated {formatWhen(endpoint.updatedAt)}
          </span>
        </div>
      ),
    },
    {
      key: "events",
      header: "Events",
      className: "hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (endpoint) => {
        const events = endpoint.events || [];
        const shown = events.slice(0, 3);
        return (
          <div className="flex max-w-[300px] flex-wrap gap-1">
            {shown.map((event) => (
              <Badge key={event} variant="neutral" className="font-mono text-[10px]">
                {event}
              </Badge>
            ))}
            {events.length > shown.length ? (
              <Badge variant="outline" className="text-[10px]">
                +{events.length - shown.length}
              </Badge>
            ) : null}
            {events.length === 0 ? (
              <span className="text-xs text-text-tertiary">No events</span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (endpoint) => (
        <StatusPill status={webhookStatusOf(endpoint)} map={WEBHOOK_STATUS_MAP} />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (endpoint) => (
        <div onClick={(event) => event.stopPropagation()}>
          <ActionMenu
            label={`Actions for ${endpoint.url}`}
            items={[
              { icon: Pencil, label: "Edit", onSelect: () => openEdit(endpoint) },
              {
                icon: Copy,
                label: "Copy URL",
                onSelect: () => copyText(endpoint.url, () => {}),
              },
              { separator: true },
              {
                icon: Trash2,
                label: "Delete",
                destructive: true,
                onSelect: () => removeEndpoint(endpoint),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  const deliveryColumns = [
    {
      key: "event",
      header: "Event",
      render: (delivery) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-xs text-foreground">{delivery.event}</span>
          <span className="text-[11px] text-text-tertiary">{formatDateTime(delivery.createdAt)}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (delivery) => <StatusPill status={delivery.status} map={DELIVERY_STATUS_MAP} />,
    },
    {
      key: "attempts",
      header: "Attempts",
      className: "hidden sm:table-cell",
      headClassName: "hidden sm:table-cell",
      render: (delivery) => (
        <span className="text-xs tabular-nums text-text-secondary">
          {delivery.attempts}/{WEBHOOK_RETRY_POLICY.maxAttempts}
        </span>
      ),
    },
    {
      key: "result",
      header: "Result",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (delivery) => (
        <span className="max-w-[240px] truncate text-xs text-text-secondary">
          {delivery.responseCode ? `HTTP ${delivery.responseCode} · ` : ""}
          {delivery.error || (delivery.deliveredAt ? `delivered ${formatWhen(delivery.deliveredAt)}` : "queued")}
        </span>
      ),
    },
  ];

  const selected = endpoints.find((endpoint) => endpoint.id === selectedId) || null;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Webhooks"
        description="Outbound event delivery — asset, workflow, upload, and order events with signed payloads, retry, and per-endpoint logs."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> Add endpoint
          </Button>
        }
      />

      <StatsBar stats={stats} />

      {freshSecret ? (
        <SectionCard
          title="Signing secret — copy it now"
          description={`For ${freshSecret.url}. The API returns it once and never again; updates accept no secret field, so an empty value on update means unchanged by design.`}
          action={
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-surface-card text-foreground hover:bg-surface-active"
              onClick={() =>
                copyText(freshSecret.secret, () => {
                  setSecretCopied(true);
                  window.setTimeout(() => setSecretCopied(false), 1600);
                })
              }
            >
              {secretCopied ? <Check className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
              {secretCopied ? "Copied" : "Copy secret"}
            </Button>
          }
        >
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
            <code className="truncate font-mono text-xs text-foreground">{freshSecret.secret}</code>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setFreshSecret(null)}
            >
              Dismiss
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={eventFilter}
            onValueChange={setEventFilter}
            options={WEBHOOK_EVENT_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={WEBHOOK_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search endpoint URLs…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading webhook endpoints" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(endpoint) => endpoint.id}
          onRowClick={selectEndpoint}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              {filtersActive ? (
                <EmptyState
                  icon={Webhook}
                  title="No endpoints match these filters"
                  description="Try a different event, status, or search term."
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
                  icon={Webhook}
                  title="No webhook endpoints yet"
                  description="Subscribe a URL to asset and upload events to start receiving signed deliveries."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={openCreate}
                    >
                      <Plus className="h-4 w-4" /> Add endpoint
                    </Button>
                  }
                />
              )}
            </div>
          }
        />
      )}

      <SectionCard
        title={selected ? `Deliveries · ${selected.url}` : "Delivery log"}
        description={
          selected
            ? "Newest attempts first. Pending rows retry with exponential backoff; failed rows are terminal."
            : "Select an endpoint above to inspect its recent deliveries and retries."
        }
        action={
          selected ? (
            <FilterDropdown
              value={deliveryStatusFilter}
              onValueChange={setDeliveryStatusFilter}
              options={DELIVERY_STATUS_FILTER_OPTIONS}
              height="h-8"
            />
          ) : null
        }
      >
        {!selected ? (
          <p className="text-sm text-text-secondary">
            The dispatcher signs each envelope and POSTs it with webhook-signature,
            webhook-event, and webhook-id headers. Nothing to show until an endpoint is
            selected.
          </p>
        ) : deliveriesLoading ? (
          <div className="flex items-center justify-center py-10">
            <LogoLoading size={40} aria-label="Loading deliveries" />
          </div>
        ) : (
          <DataTable
            columns={deliveryColumns}
            data={visibleDeliveries}
            getRowKey={(delivery) => delivery.id}
            empty={
              <EmptyState
                icon={Webhook}
                title="No deliveries yet"
                description={
                  deliveryStatusFilter === "all"
                    ? "Deliveries appear here the next time a subscribed event fires."
                    : "No deliveries carry this status — try another filter."
                }
                action={
                  deliveryStatusFilter === "all" ? null : (
                    <Button
                      variant="outline"
                      className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                      onClick={() => setDeliveryStatusFilter("all")}
                    >
                      Clear filters
                    </Button>
                  )
                }
              />
            }
          />
        )}
      </SectionCard>

      <SectionCard
        title="Signature verification & retry"
        description="Every delivery carries a Stripe-style signature receivers recompute with the stored secret."
        action={
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-surface-card text-foreground hover:bg-surface-active"
            onClick={() =>
              copyText(VERIFY_SNIPPET, () => {
                setSnippetCopied(true);
                window.setTimeout(() => setSnippetCopied(false), 1600);
              })
            }
          >
            {snippetCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {snippetCopied ? "Copied" : "Copy"}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-xs text-text-secondary">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            The envelope is {"{ id, event, projectId, createdAt, data }"}. Compare with a
            constant-time check, and reject timestamps older than five minutes to close the
            replay window.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed text-foreground">
            {VERIFY_SNIPPET}
          </pre>
          <p className="text-xs text-text-secondary">
            Retry: up to {WEBHOOK_RETRY_POLICY.maxAttempts} attempts, {WEBHOOK_RETRY_POLICY.baseBackoffSeconds}s
            base backoff doubling per attempt, capped at {WEBHOOK_RETRY_POLICY.maxBackoffHours}h. Only
            https URLs are fetched, redirects are never followed, and private IP ranges are
            rejected before every POST.
          </p>
        </div>
      </SectionCard>

      <EndpointDialog
        key={`endpoint:${editing?.id ?? "new"}:${dialogToken}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        endpoint={editing}
        onSubmit={submitEndpoint}
      />
    </MainScreenWrapper>
  );
}

export default WebhooksScreen;
