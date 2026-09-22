"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Eye,
  EyeOff,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  Webhook,
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
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  ClearFiltersButton,
  CreateDialog,
  EditDialog,
  FieldRow,
  SelectField,
  TextAreaField,
  TextField,
  useModuleRows,
} from "@/components/internal/shared/module_kit";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Checkbox } from "@geiger/ui/checkbox";
import { Label } from "@geiger/ui/label";
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

import {
  listWebhookEndpoints,
  createWebhookEndpoint,
  updateWebhookEndpoint,
  softDeleteWebhookEndpoint,
  rotateWebhookSecret,
  listWebhookDeliveries,
  createWebhookDelivery,
} from "@/lib/supabase/platform";
import { getUser } from "@/lib/supabase/user";
import { uniqueId } from "@/lib/utils";

import {
  DELIVERY_STATUS_FILTER_OPTIONS,
  DELIVERY_STATUS_MAP,
  ENDPOINT_STATUS_FILTER_OPTIONS,
  ENDPOINT_STATUS_MAP,
  WEBHOOK_EVENT_GROUPS,
  WEBHOOK_EVENTS,
  formatDateTime,
  samplePayload,
  webhookEventLabel,
} from "./constants";

const EMPTY_DRAFT = { name: "", url: "", description: "", events: [], status: "active" };

function isValidUrl(value) {
  try {
    const u = new URL(String(value || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function copyText(text, message) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    toast.error("Clipboard isn't available in this browser.");
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => toast.success(message),
    () => toast.error("Couldn't copy to the clipboard."),
  );
}

// ---------------------------------------------------------------------------
// Endpoint dialog — create + edit share one form
// ---------------------------------------------------------------------------

function EndpointDialog({ open, onOpenChange, initial, onSubmit }) {
  const [draft, setDraft] = useState(initial || EMPTY_DRAFT);
  const [seed, setSeed] = useState(initial);
  if (initial !== seed) {
    setSeed(initial);
    setDraft(initial || EMPTY_DRAFT);
  }
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const editing = Boolean(initial?.id);

  const toggleEvent = (key, checked) => {
    setDraft((d) => {
      const next = new Set(d.events || []);
      if (checked) next.add(key);
      else next.delete(key);
      return { ...d, events: Array.from(next) };
    });
  };

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the endpoint a name first.");
      return;
    }
    if (!isValidUrl(draft.url)) {
      toast.error("Enter a valid http(s) delivery URL.");
      return;
    }
    if (!(draft.events || []).length) {
      toast.error("Subscribe to at least one event.");
      return;
    }
    onSubmit({ ...draft, name: draft.name.trim(), url: draft.url.trim() });
    setDraft(EMPTY_DRAFT);
    onOpenChange(false);
  };

  const dialog = { open, onOpenChange, onSubmit: submit };
  const body = (
    <>
      <FieldRow>
        <TextField label="Endpoint name" value={draft.name} onChange={set("name")} placeholder="e.g. Order sync worker" />
        <SelectField
          label="Status"
          value={draft.status}
          onChange={set("status")}
          options={[
            { value: "active", label: "Active" },
            { value: "paused", label: "Paused" },
          ]}
        />
      </FieldRow>
      <TextField
        label="Delivery URL"
        value={draft.url}
        onChange={set("url")}
        placeholder="https://example.com/hooks/geiger"
        hint="HTTPS only in production. Events POST here as signed JSON."
      />
      <TextAreaField
        label="Description"
        value={draft.description}
        onChange={set("description")}
        placeholder="What consumes this endpoint?"
        rows={2}
      />
      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">
          Subscribed events ({(draft.events || []).length} selected)
        </Label>
        <div className="max-h-56 space-y-4 overflow-y-auto rounded-lg border border-border bg-surface-card p-3">
          {WEBHOOK_EVENT_GROUPS.map((group) => (
            <div key={group.group} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                {group.group}
              </p>
              {group.items.map((event) => {
                const checked = (draft.events || []).includes(event.key);
                return (
                  <label
                    key={event.key}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1 hover:bg-surface-hover"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleEvent(event.key, v === true)}
                      className="mt-0.5"
                      aria-label={event.label}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-foreground">{event.label}</span>
                      <span className="block truncate text-xs text-text-tertiary">
                        {event.key} · {event.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return editing ? (
    <EditDialog {...dialog} title="Edit endpoint">
      {body}
    </EditDialog>
  ) : (
    <CreateDialog
      {...dialog}
      title="New webhook endpoint"
      description="Events POST here as signed JSON. Nothing is delivered until a worker exists — sends are recorded, not sent."
      submitLabel="Create endpoint"
      size="lg"
    >
      {body}
    </CreateDialog>
  );
}

// ---------------------------------------------------------------------------
// Signing secret — reveal / copy / rotate
// ---------------------------------------------------------------------------

function SecretRow({ endpoint, onRotate }) {
  const [revealed, setRevealed] = useState(false);
  const [rotating, setRotating] = useState(false);

  const rotate = async () => {
    setRotating(true);
    try {
      await onRotate(endpoint);
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
        {revealed ? endpoint.signingSecret || "—" : "•".repeat(24)}
      </code>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? "Hide signing secret" : "Reveal signing secret"}
      >
        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
        onClick={() => copyText(endpoint.signingSecret || "", "Signing secret copied.")}
        aria-label="Copy signing secret"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
        onClick={rotate}
        disabled={rotating}
        aria-label="Rotate signing secret"
        title="Mint a fresh secret. The old one stops verifying immediately."
      >
        <RefreshCw className={`h-3.5 w-3.5 ${rotating ? "animate-spin" : ""}`} />
        Rotate
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test-send dialog — writes a delivery row, does not deliver
// ---------------------------------------------------------------------------

function TestSendDialog({ open, onOpenChange, endpoint, onSend }) {
  const eventOptions = endpoint?.events?.length ? endpoint.events : WEBHOOK_EVENTS.map((e) => e.key);
  const [event, setEvent] = useState(eventOptions[0] || "asset.created");
  const [seed, setSeed] = useState(endpoint?.id);
  if (endpoint?.id !== seed) {
    setSeed(endpoint?.id);
    setEvent((endpoint?.events || [])[0] || "asset.created");
  }
  const payload = useMemo(() => samplePayload(event, endpoint?.url), [event, endpoint?.url]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-background">
        <DialogHeader>
          <DialogTitle>Send a test event</DialogTitle>
          <DialogDescription>
            Writes a delivery row for <span className="font-medium text-foreground">{endpoint?.name}</span>.
            Nothing leaves the workspace — there is no sender yet, so the row stays queued.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Event">
            <Select value={event} onValueChange={setEvent}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eventOptions.map((key) => (
                  <SelectItem key={key} value={key}>
                    {webhookEventLabel(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Payload preview" hint="The JSON that would be POSTed, signed with this endpoint's secret.">
            <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-surface-card p-3 font-mono text-xs leading-5 text-text-secondary">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </Field>
        </div>
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
            onClick={() => {
              onSend(event, payload);
              onOpenChange(false);
            }}
          >
            <Send className="h-4 w-4" /> Record test delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function WebhooksScreen({ projectId }) {
  const [endpoints, setEndpoints, endpointsLoading] = useModuleRows(listWebhookEndpoints, projectId);
  const [deliveries, setDeliveries, deliveriesLoading] = useModuleRows(listWebhookDeliveries, projectId);
  const loading = endpointsLoading || deliveriesLoading;

  const [search, setSearch] = useState("");
  const [endpointStatus, setEndpointStatus] = useState("all");
  const [deliveryStatus, setDeliveryStatus] = useState("all");
  const [deliveryEndpoint, setDeliveryEndpoint] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [testTarget, setTestTarget] = useState(null);

  const filteredEndpoints = useMemo(() => {
    const term = search.trim().toLowerCase();
    return endpoints.filter((e) => {
      if (endpointStatus !== "all" && e.status !== endpointStatus) return false;
      if (term && !`${e.name} ${e.url}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [endpoints, search, endpointStatus]);

  const filteredDeliveries = useMemo(
    () =>
      deliveries.filter((d) => {
        if (deliveryStatus !== "all" && d.status !== deliveryStatus) return false;
        if (deliveryEndpoint !== "all" && d.endpointId !== deliveryEndpoint) return false;
        return true;
      }),
    [deliveries, deliveryStatus, deliveryEndpoint],
  );

  const endpointName = useMemo(() => {
    const map = new Map(endpoints.map((e) => [e.id, e.name]));
    return (id) => map.get(id) || "Deleted endpoint";
  }, [endpoints]);

  const stats = useMemo(() => {
    const active = endpoints.filter((e) => e.status === "active").length;
    const queued = deliveries.filter((d) => d.status === "queued").length;
    const failed = deliveries.filter((d) => d.status === "failed").length;
    return [
      { label: "Endpoints", value: String(endpoints.length), footer: `${active} active` },
      { label: "Subscribed events", value: String(new Set(endpoints.flatMap((e) => e.events)).size), footer: `${WEBHOOK_EVENTS.length} in catalog` },
      { label: "Queued deliveries", value: String(queued), footer: "Waiting on a worker" },
      { label: "Failed deliveries", value: String(failed), footer: "All time" },
    ];
  }, [endpoints, deliveries]);

  const hasFilters = search.trim() !== "" || endpointStatus !== "all";
  const hasDeliveryFilters = deliveryStatus !== "all" || deliveryEndpoint !== "all";

  // -- endpoint mutations (optimistic) ---------------------------------------

  const handleCreate = async (draft) => {
    const row = {
      id: uniqueId(),
      projectId,
      name: draft.name,
      url: draft.url,
      description: draft.description || "",
      events: draft.events,
      status: draft.status || "active",
      signingSecret: "",
      createdBy: (await getUser())?.id || null,
      createdAt: new Date().toISOString(),
    };
    setEndpoints((prev) => [row, ...prev]);
    const saved = await createWebhookEndpoint(row);
    if (saved) {
      setEndpoints((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
      toast.success(`"${row.name}" subscribed to ${saved.events.length} event${saved.events.length === 1 ? "" : "s"}.`);
    } else {
      setEndpoints((prev) => prev.filter((e) => e.id !== row.id));
      toast.error("Couldn't create the endpoint.");
    }
  };

  const handleEdit = async (draft) => {
    const id = editing?.id;
    if (!id) return;
    const previous = endpoints.find((e) => e.id === id);
    const patch = {
      name: draft.name,
      url: draft.url,
      description: draft.description || "",
      events: draft.events,
      status: draft.status,
    };
    setEndpoints((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setEditing(null);
    const saved = await updateWebhookEndpoint(id, patch);
    if (saved) {
      setEndpoints((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
      toast.success("Endpoint updated.");
    } else {
      if (previous) setEndpoints((prev) => prev.map((e) => (e.id === id ? previous : e)));
      toast.error("Couldn't save your changes.");
    }
  };

  const handleToggleStatus = async (endpoint) => {
    const next = endpoint.status === "active" ? "paused" : "active";
    setEndpoints((prev) => prev.map((e) => (e.id === endpoint.id ? { ...e, status: next } : e)));
    const saved = await updateWebhookEndpoint(endpoint.id, { status: next });
    if (saved) {
      setEndpoints((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
      toast.success(next === "active" ? `"${endpoint.name}" resumed.` : `"${endpoint.name}" paused.`);
    } else {
      setEndpoints((prev) => prev.map((e) => (e.id === endpoint.id ? endpoint : e)));
      toast.error("Couldn't change the endpoint status.");
    }
  };

  const handleRotate = async (endpoint) => {
    const secret = await rotateWebhookSecret(endpoint.id);
    if (secret) {
      setEndpoints((prev) => prev.map((e) => (e.id === endpoint.id ? { ...e, signingSecret: secret } : e)));
      toast.success("Signing secret rotated. Update the receiver.");
    } else {
      toast.error("Couldn't rotate the signing secret.");
    }
  };

  const handleDelete = async (endpoint) => {
    setDeleteTarget(null);
    setEndpoints((prev) => prev.filter((e) => e.id !== endpoint.id));
    const ok = await softDeleteWebhookEndpoint(endpoint.id);
    if (!ok) {
      setEndpoints((prev) => [endpoint, ...prev]);
      toast.error("Couldn't delete the endpoint.");
      return;
    }
    toast.success(`Deleted "${endpoint.name}".`);
  };

  // -- test send: writes a queued delivery row, nothing is delivered ----------

  const handleTestSend = async (event, payload) => {
    const endpoint = testTarget;
    if (!endpoint) return;
    const row = {
      id: uniqueId(),
      projectId,
      endpointId: endpoint.id,
      event,
      payload,
      status: "queued",
      attemptCount: 0,
      responseCode: null,
      createdAt: new Date().toISOString(),
    };
    setDeliveries((prev) => [row, ...prev]);
    const saved = await createWebhookDelivery(row);
    if (saved) {
      setDeliveries((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      toast.success("Test recorded — queued behind a worker that doesn't exist yet.");
    } else {
      setDeliveries((prev) => prev.filter((d) => d.id !== row.id));
      toast.error("Couldn't record the test delivery.");
    }
  };

  const handleReplay = () => {
    toast.info("Replay needs a delivery worker. Recorded deliveries stay queued until one exists.");
  };

  // -- tables ------------------------------------------------------------------

  const endpointColumns = [
    {
      key: "name",
      header: "Endpoint",
      render: (e) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{e.name}</span>
          <span className="max-w-72 truncate text-xs text-text-secondary">{e.url}</span>
        </div>
      ),
    },
    {
      key: "events",
      header: "Events",
      render: (e) => (
        <div className="flex max-w-64 flex-wrap gap-1">
          {e.events.slice(0, 3).map((key) => (
            <Badge key={key} variant="outline" className="border-border bg-surface-card text-[11px] text-text-secondary">
              {webhookEventLabel(key)}
            </Badge>
          ))}
          {e.events.length > 3 ? (
            <Badge variant="outline" className="border-border bg-surface-card text-[11px] text-text-tertiary">
              +{e.events.length - 3} more
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => <StatusPill status={e.status} map={ENDPOINT_STATUS_MAP} />,
    },
    {
      key: "secret",
      header: "Signing secret",
      render: (e) => (
        <div className="min-w-52" onClick={(ev) => ev.stopPropagation()}>
          <SecretRow endpoint={e} onRotate={handleRotate} />
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (e) => (
        <ActionMenu
          label="Endpoint actions"
          items={[
            { icon: Send, label: "Send test event", onSelect: () => setTestTarget(e) },
            { icon: e.status === "active" ? Pause : Play, label: e.status === "active" ? "Pause" : "Resume", onSelect: () => handleToggleStatus(e) },
            { separator: true },
            { icon: Trash2, label: "Delete", destructive: true, onSelect: () => setDeleteTarget(e) },
          ]}
        />
      ),
    },
  ];

  const deliveryColumns = [
    {
      key: "event",
      header: "Event",
      render: (d) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{webhookEventLabel(d.event)}</span>
          <span className="font-mono text-[11px] text-text-tertiary">{d.event}</span>
        </div>
      ),
    },
    {
      key: "endpoint",
      header: "Endpoint",
      className: "text-text-secondary",
      render: (d) => endpointName(d.endpointId),
    },
    {
      key: "status",
      header: "Status",
      render: (d) => <StatusPill status={d.status} map={DELIVERY_STATUS_MAP} />,
    },
    {
      key: "attempts",
      header: "Attempts",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (d) => String(d.attemptCount),
    },
    {
      key: "code",
      header: "Response",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (d) => (d.responseCode == null ? "—" : String(d.responseCode)),
    },
    {
      key: "time",
      header: "Timestamp",
      className: "text-text-secondary",
      render: (d) => formatDateTime(d.createdAt),
    },
    {
      key: "replay",
      header: "",
      align: "right",
      className: "text-right",
      render: () => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-text-tertiary"
          onClick={handleReplay}
          title="Replay needs a delivery worker — no job runner exists yet."
          aria-label="Replay delivery (unavailable — no delivery worker)"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Replay
        </Button>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Webhooks"
        description="Notify external systems when DAM events occur. Endpoints record deliveries — nothing is sent until a delivery worker exists."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New endpoint
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <SectionCard
        title="Endpoints"
        description="Each endpoint subscribes to events and verifies payloads with its signing secret."
        action={
          <Toolbar>
            <div className="flex items-center gap-2">
              <FilterDropdown value={endpointStatus} onValueChange={setEndpointStatus} options={ENDPOINT_STATUS_FILTER_OPTIONS} height="h-9" />
              {hasFilters ? <ClearFiltersButton onClick={() => { setSearch(""); setEndpointStatus("all"); }} /> : null}
            </div>
            <SearchInput value={search} onChange={setSearch} placeholder="Search endpoints…" />
          </Toolbar>
        }
      >
        {loading ? (
          <LoadingArea panel size={40} label="Loading webhook endpoints…" />
        ) : (
          <DataTable
            columns={endpointColumns}
            data={filteredEndpoints}
            getRowKey={(e) => e.id}
            onRowClick={(e) => {
              setEditing({
                id: e.id,
                name: e.name,
                url: e.url,
                description: e.description,
                events: e.events,
                status: e.status,
              });
              setDialogOpen(true);
            }}
            empty={
              <EmptyState
                icon={Webhook}
                title={endpoints.length ? "No endpoints match your filters" : "No webhook endpoints yet"}
                description={
                  endpoints.length
                    ? "Try clearing the search or filters."
                    : "Subscribe a URL to asset, rights, share, and workflow events — deliveries are recorded here."
                }
                action={
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => {
                      setEditing(null);
                      setDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" /> New endpoint
                  </Button>
                }
              />
            }
          />
        )}
      </SectionCard>

      <SectionCard
        title="Delivery log"
        description="Every attempt, newest first. Queued rows are recorded but not sent — no delivery worker is running, so Replay stays off."
        action={
          <Toolbar>
            <div className="flex items-center gap-2">
              <FilterDropdown
                value={deliveryEndpoint}
                onValueChange={setDeliveryEndpoint}
                options={[
                  { value: "all", label: "All Endpoints" },
                  ...endpoints.map((e) => ({ value: e.id, label: e.name })),
                ]}
                height="h-9"
              />
              <FilterDropdown value={deliveryStatus} onValueChange={setDeliveryStatus} options={DELIVERY_STATUS_FILTER_OPTIONS} height="h-9" />
              {hasDeliveryFilters ? <ClearFiltersButton onClick={() => { setDeliveryStatus("all"); setDeliveryEndpoint("all"); }} /> : null}
            </div>
          </Toolbar>
        }
      >
        {loading ? (
          <LoadingArea panel size={40} label="Loading deliveries…" />
        ) : (
          <DataTable
            columns={deliveryColumns}
            data={filteredDeliveries}
            getRowKey={(d) => d.id}
            empty={
              <EmptyState
                icon={Send}
                title={deliveries.length ? "No deliveries match your filters" : "No deliveries yet"}
                description={
                  deliveries.length
                    ? "Try clearing the filters."
                    : "Send a test event from an endpoint to record the first delivery row."
                }
              />
            }
          />
        )}
      </SectionCard>

      <EndpointDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        initial={editing}
        onSubmit={editing ? handleEdit : handleCreate}
      />

      <TestSendDialog
        open={!!testTarget}
        onOpenChange={(open) => !open && setTestTarget(null)}
        endpoint={testTarget}
        onSend={handleTestSend}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete endpoint</DialogTitle>
            <DialogDescription>
              Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>? Its
              subscriptions stop and the delivery history for it becomes harder to attribute.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => handleDelete(deleteTarget)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </MainScreenWrapper>
  );
}

export default WebhooksScreen;
