"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Eye,
  EyeOff,
  Link2,
  Pause,
  Pencil,
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
import { ConfirmDeleteDialog } from "@/components/internal/screens/projects/settings/settings_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Checkbox } from "@geiger/ui/checkbox";
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
import { cn, uniqueId } from "@/lib/utils";

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
import {
  CodeBlock,
  DetailList,
  DetailSheet,
  IconTile,
  Notice,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  SheetSection,
  ToolbarTabs,
} from "./platform_kit";

const EMPTY_DRAFT = { name: "", url: "", description: "", events: [], status: "active" };

const VIEW_TABS = [
  { value: "endpoints", label: "Endpoints", icon: Webhook },
  { value: "deliveries", label: "Delivery log", icon: Send },
];

const NO_WORKER_NOTE =
  "Deliveries are recorded, not sent — no delivery worker is running yet, so rows stay queued.";

function isValidUrl(value) {
  try {
    const u = new URL(String(value || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Endpoint dialog — create + edit share one form
// ---------------------------------------------------------------------------

function EventPicker({ value, onChange }) {
  const selected = new Set(value || []);
  const setMany = (keys, on) => {
    const next = new Set(selected);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    onChange(WEBHOOK_EVENTS.map((e) => e.key).filter((k) => next.has(k)));
  };
  const allOn = selected.size === WEBHOOK_EVENTS.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          Events <span className="text-text-tertiary">· {selected.size} of {WEBHOOK_EVENTS.length}</span>
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
          onClick={() => setMany(WEBHOOK_EVENTS.map((e) => e.key), !allOn)}
        >
          {allOn ? "Clear all" : "Select all"}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {WEBHOOK_EVENT_GROUPS.map((group) => {
          const keys = group.items.map((e) => e.key);
          const groupOn = keys.every((k) => selected.has(k));
          return (
            <div key={group.group} className="rounded-lg border border-border bg-surface-card">
              <label className="flex cursor-pointer items-center gap-2.5 border-b border-border px-3 py-2">
                <Checkbox
                  checked={groupOn}
                  onCheckedChange={() => setMany(keys, !groupOn)}
                  aria-label={`All ${group.group} events`}
                />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                  {group.group}
                </span>
              </label>
              <div className="p-1">
                {group.items.map((event) => (
                  <label
                    key={event.key}
                    title={event.description}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-hover"
                  >
                    <Checkbox
                      checked={selected.has(event.key)}
                      onCheckedChange={(v) => setMany([event.key], v === true)}
                      aria-label={event.label}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-foreground">{event.label}</span>
                      <span className="block truncate font-mono text-[10px] text-text-tertiary">{event.key}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EndpointDialog({ open, onOpenChange, initial, onSubmit }) {
  const [draft, setDraft] = useState(initial || EMPTY_DRAFT);
  const [seed, setSeed] = useState(initial);
  if (initial !== seed) {
    setSeed(initial);
    setDraft(initial || EMPTY_DRAFT);
  }
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const editing = Boolean(initial?.id);

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
        hint="Events POST here as signed JSON. Use HTTPS in production."
      />
      <TextAreaField
        label="Description"
        value={draft.description}
        onChange={set("description")}
        placeholder="What consumes this endpoint? (optional)"
        rows={2}
      />
      <EventPicker value={draft.events} onChange={set("events")} />
    </>
  );

  return editing ? (
    <EditDialog open={open} onOpenChange={onOpenChange} onSave={submit} title="Edit endpoint" size="lg">
      {body}
    </EditDialog>
  ) : (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={submit}
      title="New webhook endpoint"
      description="Pick a URL and the events it should hear about."
      submitLabel="Create endpoint"
      footerNote="A signing secret is generated for you."
      size="lg"
    >
      {body}
    </CreateDialog>
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Send a test event</DialogTitle>
          <DialogDescription>
            Records a test delivery for <span className="font-medium text-foreground">{endpoint?.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Event">
            <Select value={event} onValueChange={setEvent}>
              <SelectTrigger className="w-full">
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
          <Field label="Payload">
            <CodeBlock multiline value={JSON.stringify(payload, null, 2)} label="Copy payload" className="max-h-56 overflow-auto" />
          </Field>
          <Notice>{NO_WORKER_NOTE}</Notice>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="text-muted-foreground hover:bg-surface-active" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className={PRIMARY_BUTTON}
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
// Detail sheets
// ---------------------------------------------------------------------------

function SigningSecret({ endpoint, onRotate }) {
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
    <div className="space-y-2">
      <CodeBlock
        value={revealed ? endpoint.signingSecret || "—" : "•".repeat(32)}
        label="Copy signing secret"
        actions={
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-text-secondary hover:bg-surface-active hover:text-foreground"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide signing secret" : "Reveal signing secret"}
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        }
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-tertiary">Verify each payload came from Geiger with this secret.</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
          onClick={rotate}
          disabled={rotating}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", rotating && "animate-spin")} />
          Rotate
        </Button>
      </div>
    </div>
  );
}

function EndpointSheet({ endpoint, deliveries, onClose, onEdit, onTest, onToggle, onRotate, onDelete, onShowLog, onOpenDelivery }) {
  const recent = endpoint ? deliveries.filter((d) => d.endpointId === endpoint.id).slice(0, 5) : [];
  const subscribed = new Set(endpoint?.events || []);

  return (
    <DetailSheet
      open={!!endpoint}
      onOpenChange={(open) => !open && onClose()}
      media={<IconTile icon={Webhook} size="lg" />}
      title={endpoint?.name}
      subtitle={endpoint ? hostOf(endpoint.url) : ""}
      meta={endpoint ? <StatusPill status={endpoint.status} map={ENDPOINT_STATUS_MAP} /> : null}
      footer={
        endpoint ? (
          <>
            <Button className={PRIMARY_BUTTON} onClick={() => onTest(endpoint)}>
              <Send className="h-4 w-4" /> Send test
            </Button>
            <Button variant="outline" className={OUTLINE_BUTTON} onClick={() => onEdit(endpoint)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button variant="outline" className={OUTLINE_BUTTON} onClick={() => onToggle(endpoint)}>
              {endpoint.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {endpoint.status === "active" ? "Pause" : "Resume"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete endpoint"
              className="ml-auto text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
              onClick={() => onDelete(endpoint)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : null
      }
    >
      {endpoint ? (
        <>
          <SheetSection title="Delivery URL">
            <CodeBlock value={endpoint.url} label="Copy delivery URL" />
            {endpoint.description ? (
              <p className="text-sm leading-6 text-text-secondary">{endpoint.description}</p>
            ) : null}
          </SheetSection>

          <SheetSection title="Signing secret">
            <SigningSecret endpoint={endpoint} onRotate={onRotate} />
          </SheetSection>

          <SheetSection title={`Events · ${subscribed.size} of ${WEBHOOK_EVENTS.length}`}>
            <div className="space-y-3">
              {WEBHOOK_EVENT_GROUPS.map((group) => {
                const items = group.items.filter((e) => subscribed.has(e.key));
                if (!items.length) return null;
                return (
                  <div key={group.group} className="space-y-1.5">
                    <p className="text-xs text-text-tertiary">{group.group}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((e) => (
                        <Badge key={e.key} variant="neutral" title={e.key}>
                          <Check className="text-emerald-600 dark:text-emerald-400" />
                          {e.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </SheetSection>

          <SheetSection
            title="Recent deliveries"
            action={
              recent.length ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
                  onClick={() => onShowLog(endpoint)}
                >
                  View all
                </Button>
              ) : null
            }
          >
            {recent.length ? (
              <div className="divide-y divide-border rounded-lg border border-border bg-surface-card">
                {recent.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onOpenDelivery(d)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-foreground">{webhookEventLabel(d.event)}</span>
                      <span className="block text-xs text-text-tertiary">{formatDateTime(d.createdAt)}</span>
                    </span>
                    <StatusPill status={d.status} map={DELIVERY_STATUS_MAP} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-tertiary">
                Nothing recorded yet — send a test event.
              </p>
            )}
          </SheetSection>
        </>
      ) : null}
    </DetailSheet>
  );
}

function DeliverySheet({ delivery, endpointName, onClose }) {
  return (
    <DetailSheet
      open={!!delivery}
      onOpenChange={(open) => !open && onClose()}
      media={<IconTile icon={Send} size="lg" />}
      title={delivery ? webhookEventLabel(delivery.event) : ""}
      subtitle={delivery?.event}
      meta={delivery ? <StatusPill status={delivery.status} map={DELIVERY_STATUS_MAP} /> : null}
      footer={
        <Button variant="outline" disabled className={OUTLINE_BUTTON} title="Replay needs a delivery worker.">
          <RotateCcw className="h-4 w-4" /> Replay
        </Button>
      }
    >
      {delivery ? (
        <>
          <SheetSection title="Attempt">
            <DetailList
              items={[
                { label: "Endpoint", value: endpointName(delivery.endpointId) },
                { label: "Recorded", value: formatDateTime(delivery.createdAt) },
                { label: "Attempts", value: String(delivery.attemptCount) },
                { label: "Response", value: delivery.responseCode == null ? "—" : String(delivery.responseCode) },
                delivery.durationMs != null ? { label: "Duration", value: `${delivery.durationMs} ms` } : null,
              ]}
            />
            {delivery.error ? <Notice tone="warning">{delivery.error}</Notice> : null}
          </SheetSection>
          <SheetSection title="Payload">
            <CodeBlock multiline value={JSON.stringify(delivery.payload, null, 2)} label="Copy payload" />
          </SheetSection>
          {delivery.status === "queued" ? <Notice>{NO_WORKER_NOTE}</Notice> : null}
        </>
      ) : null}
    </DetailSheet>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function WebhooksScreen({ projectId }) {
  const [endpoints, setEndpoints, endpointsLoading] = useModuleRows(listWebhookEndpoints, projectId);
  const [deliveries, setDeliveries, deliveriesLoading] = useModuleRows(listWebhookDeliveries, projectId);
  const loading = endpointsLoading || deliveriesLoading;

  const [view, setView] = useState("endpoints");
  const [search, setSearch] = useState("");
  const [endpointStatus, setEndpointStatus] = useState("all");
  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("all");
  const [deliveryEndpoint, setDeliveryEndpoint] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [testTarget, setTestTarget] = useState(null);
  const [openEndpointId, setOpenEndpointId] = useState(null);
  const [openDelivery, setOpenDelivery] = useState(null);

  const openEndpoint = openEndpointId ? endpoints.find((e) => e.id === openEndpointId) : null;

  const filteredEndpoints = useMemo(() => {
    const term = search.trim().toLowerCase();
    return endpoints.filter((e) => {
      if (endpointStatus !== "all" && e.status !== endpointStatus) return false;
      if (term && !`${e.name} ${e.url}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [endpoints, search, endpointStatus]);

  const filteredDeliveries = useMemo(() => {
    const term = deliverySearch.trim().toLowerCase();
    return deliveries.filter((d) => {
      if (deliveryStatus !== "all" && d.status !== deliveryStatus) return false;
      if (deliveryEndpoint !== "all" && d.endpointId !== deliveryEndpoint) return false;
      if (term && !`${d.event} ${webhookEventLabel(d.event)}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [deliveries, deliverySearch, deliveryStatus, deliveryEndpoint]);

  const endpointName = useMemo(() => {
    const map = new Map(endpoints.map((e) => [e.id, e.name]));
    return (id) => map.get(id) || "Deleted endpoint";
  }, [endpoints]);

  // Deliveries arrive newest first, so the first hit per endpoint is its latest.
  const lastDelivery = useMemo(() => {
    const map = new Map();
    for (const d of deliveries) if (!map.has(d.endpointId)) map.set(d.endpointId, d);
    return map;
  }, [deliveries]);

  const stats = useMemo(() => {
    const active = endpoints.filter((e) => e.status === "active").length;
    const queued = deliveries.filter((d) => d.status === "queued").length;
    const failed = deliveries.filter((d) => d.status === "failed").length;
    return [
      { label: "Endpoints", value: String(endpoints.length), footer: `${active} active` },
      { label: "Events covered", value: String(new Set(endpoints.flatMap((e) => e.events)).size), footer: `of ${WEBHOOK_EVENTS.length} available` },
      { label: "Queued deliveries", value: String(queued), footer: "Waiting on a worker" },
      { label: "Failed deliveries", value: String(failed), footer: "All time" },
    ];
  }, [endpoints, deliveries]);

  const hasFilters = search.trim() !== "" || endpointStatus !== "all";
  const hasDeliveryFilters = deliverySearch.trim() !== "" || deliveryStatus !== "all" || deliveryEndpoint !== "all";

  const clearEndpointFilters = () => {
    setSearch("");
    setEndpointStatus("all");
  };
  const clearDeliveryFilters = () => {
    setDeliverySearch("");
    setDeliveryStatus("all");
    setDeliveryEndpoint("all");
  };

  const startCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const startEdit = (e) => {
    setOpenEndpointId(null);
    setEditing({ id: e.id, name: e.name, url: e.url, description: e.description, events: e.events, status: e.status });
    setDialogOpen(true);
  };

  const startTest = (e) => {
    setOpenEndpointId(null);
    setTestTarget(e);
  };

  const showLogFor = (e) => {
    setOpenEndpointId(null);
    setDeliveryEndpoint(e.id);
    setDeliveryStatus("all");
    setDeliverySearch("");
    setView("deliveries");
  };

  const copyUrl = async (e) => {
    try {
      await navigator.clipboard.writeText(e.url);
      toast.success("Delivery URL copied.");
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  };

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
    setOpenEndpointId(null);
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
      toast.success("Test delivery recorded.");
    } else {
      setDeliveries((prev) => prev.filter((d) => d.id !== row.id));
      toast.error("Couldn't record the test delivery.");
    }
  };

  // -- tables ------------------------------------------------------------------

  const endpointColumns = [
    {
      key: "name",
      header: "Endpoint",
      render: (e) => (
        <div className="flex items-center gap-3">
          <IconTile icon={Webhook} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{e.name}</p>
            <p className="max-w-80 truncate font-mono text-[11px] text-text-tertiary">{e.url}</p>
          </div>
        </div>
      ),
    },
    {
      key: "events",
      header: "Events",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (e) => (
        <div className="flex max-w-64 flex-wrap gap-1">
          {e.events.slice(0, 2).map((key) => (
            <Badge key={key} variant="neutral">
              {webhookEventLabel(key)}
            </Badge>
          ))}
          {e.events.length > 2 ? <Badge variant="outline">+{e.events.length - 2}</Badge> : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => <StatusPill status={e.status} map={ENDPOINT_STATUS_MAP} />,
    },
    {
      key: "last",
      header: "Last delivery",
      className: "hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (e) => {
        const d = lastDelivery.get(e.id);
        if (!d) return <span className="text-xs text-text-tertiary">None yet</span>;
        return (
          <span className="flex items-center gap-2 text-xs text-text-secondary">
            <span className={cn("h-1.5 w-1.5 rounded-full", DELIVERY_STATUS_MAP[d.status]?.dotClass || "bg-zinc-400")} />
            {formatDateTime(d.createdAt)}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (e) => (
        <ActionMenu
          label={`Actions for ${e.name}`}
          items={[
            { icon: Send, label: "Send test event", onSelect: () => startTest(e) },
            { icon: Pencil, label: "Edit", onSelect: () => startEdit(e) },
            { icon: Link2, label: "Copy URL", onSelect: () => copyUrl(e) },
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
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{webhookEventLabel(d.event)}</p>
          <p className="truncate font-mono text-[11px] text-text-tertiary">{d.event}</p>
        </div>
      ),
    },
    {
      key: "endpoint",
      header: "Endpoint",
      className: "hidden md:table-cell text-sm text-text-secondary",
      headClassName: "hidden md:table-cell",
      render: (d) => endpointName(d.endpointId),
    },
    {
      key: "status",
      header: "Status",
      render: (d) => <StatusPill status={d.status} map={DELIVERY_STATUS_MAP} />,
    },
    {
      key: "response",
      header: "Response",
      align: "right",
      className: "hidden sm:table-cell tabular-nums text-xs text-text-secondary",
      headClassName: "hidden sm:table-cell",
      render: (d) => (
        <span>
          {d.responseCode == null ? "—" : d.responseCode}
          <span className="text-text-tertiary"> · {d.attemptCount} attempt{d.attemptCount === 1 ? "" : "s"}</span>
        </span>
      ),
    },
    {
      key: "time",
      header: "Recorded",
      align: "right",
      className: "text-xs text-text-secondary",
      render: (d) => formatDateTime(d.createdAt),
    },
  ];

  const viewTabs = (
    <ToolbarTabs tabs={VIEW_TABS} value={view} onChange={setView} />
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Webhooks"
        description="Notify your systems with signed HTTP callbacks when assets, collections, galleries and uploads change."
        actions={
          <Button className={PRIMARY_BUTTON} onClick={startCreate}>
            <Plus className="h-4 w-4" /> New endpoint
          </Button>
        }
      />

      {loading ? (
        <LoadingArea panel size={56} label="Loading webhooks" />
      ) : (
        <>
          <StatsBar stats={stats} />

          <div className="space-y-4">
            {view === "endpoints" ? (
              <>
                <Toolbar>
                  <div className="flex items-center gap-2">
                    {viewTabs}
                    <FilterDropdown value={endpointStatus} onValueChange={setEndpointStatus} options={ENDPOINT_STATUS_FILTER_OPTIONS} />
                    {hasFilters ? <ClearFiltersButton onClick={clearEndpointFilters} /> : null}
                  </div>
                  <SearchInput value={search} onChange={setSearch} placeholder="Search endpoints…" />
                </Toolbar>
                <DataTable
                  columns={endpointColumns}
                  data={filteredEndpoints}
                  getRowKey={(e) => e.id}
                  onRowClick={(e) => setOpenEndpointId(e.id)}
                  empty={
                    <div className="rounded-xl border border-border bg-surface-subtle">
                      <EmptyState
                        icon={Webhook}
                        title={endpoints.length ? "No endpoints match your filters" : "No webhook endpoints yet"}
                        description={
                          endpoints.length
                            ? "Try clearing the search or status filter."
                            : "Add a URL and choose the events it should receive."
                        }
                        action={
                          endpoints.length ? (
                            <Button variant="outline" className={OUTLINE_BUTTON} onClick={clearEndpointFilters}>
                              Clear filters
                            </Button>
                          ) : (
                            <Button className={PRIMARY_BUTTON} onClick={startCreate}>
                              <Plus className="h-4 w-4" /> New endpoint
                            </Button>
                          )
                        }
                      />
                    </div>
                  }
                />
              </>
            ) : (
              <>
                <Toolbar>
                  <div className="flex items-center gap-2">
                    {viewTabs}
                    <FilterDropdown
                      value={deliveryEndpoint}
                      onValueChange={setDeliveryEndpoint}
                      options={[
                        { value: "all", label: "All Endpoints" },
                        ...endpoints.map((e) => ({ value: e.id, label: e.name })),
                      ]}
                    />
                    <FilterDropdown value={deliveryStatus} onValueChange={setDeliveryStatus} options={DELIVERY_STATUS_FILTER_OPTIONS} />
                    {hasDeliveryFilters ? <ClearFiltersButton onClick={clearDeliveryFilters} /> : null}
                  </div>
                  <SearchInput value={deliverySearch} onChange={setDeliverySearch} placeholder="Search events…" />
                </Toolbar>
                <Notice>{NO_WORKER_NOTE}</Notice>
                <DataTable
                  columns={deliveryColumns}
                  data={filteredDeliveries}
                  getRowKey={(d) => d.id}
                  onRowClick={setOpenDelivery}
                  empty={
                    <div className="rounded-xl border border-border bg-surface-subtle">
                      <EmptyState
                        icon={Send}
                        title={deliveries.length ? "No deliveries match your filters" : "No deliveries yet"}
                        description={
                          deliveries.length
                            ? "Try clearing the filters."
                            : "Send a test event from an endpoint to record the first delivery."
                        }
                        action={
                          deliveries.length ? (
                            <Button variant="outline" className={OUTLINE_BUTTON} onClick={clearDeliveryFilters}>
                              Clear filters
                            </Button>
                          ) : null
                        }
                      />
                    </div>
                  }
                />
              </>
            )}
          </div>
        </>
      )}

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

      <EndpointSheet
        endpoint={openEndpoint}
        deliveries={deliveries}
        onClose={() => setOpenEndpointId(null)}
        onEdit={startEdit}
        onTest={startTest}
        onToggle={handleToggleStatus}
        onRotate={handleRotate}
        onDelete={setDeleteTarget}
        onShowLog={showLogFor}
        onOpenDelivery={(d) => {
          setOpenEndpointId(null);
          setOpenDelivery(d);
        }}
      />

      <DeliverySheet delivery={openDelivery} endpointName={endpointName} onClose={() => setOpenDelivery(null)} />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete endpoint"
        description={`"${deleteTarget?.name}" stops receiving events. Its past deliveries stay in the log.`}
        confirmLabel="Delete endpoint"
        onConfirm={() => handleDelete(deleteTarget)}
      />
    </MainScreenWrapper>
  );
}

export default WebhooksScreen;
