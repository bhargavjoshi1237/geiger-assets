"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  MonitorUp,
  Pause,
  Pencil,
  Play,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
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
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import {
  createChannelExport,
  createDestination,
  listChannelExports,
  listDestinations,
  softDeleteChannelExport,
  softDeleteDestination,
  updateChannelExport,
  updateDestination,
} from "@/lib/supabase/delivery";
import {
  DESTINATION_KIND_FILTER_OPTIONS,
  DESTINATION_KIND_MAP,
  DESTINATION_STATUS_FILTER_OPTIONS,
  DESTINATION_STATUS_MAP,
  EXPORT_NEXT_STATUS,
  EXPORT_STATUS_FILTER_OPTIONS,
  EXPORT_STATUS_MAP,
  formatDateTime,
  formatWhen,
} from "./constants";

// Channel Publishing — connected business systems plus the publish jobs aimed
// at them.
//
// Destinations are connection records (which system, where it lives, whether
// it is accepting publishes). Exports are the jobs: a name, a target, an
// optional schedule, and a forward-only status lifecycle. Per-channel status
// is derived from the latest export row, never stored separately.

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function DestinationDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "cms");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setKind(initial?.kind ?? "cms");
    setBaseUrl(initial?.baseUrl ?? "");
    setBusy(false);
  }, [open, initial]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Give the destination a name.");
      return;
    }
    const url = baseUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error("Use a full http(s) URL for the endpoint.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({ name: name.trim(), kind, baseUrl: url });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit destination" : "Connect destination"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            {DESTINATION_KIND_MAP[kind]?.hint || "Where publishes go."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="dest-name">
            <Input
              id="dest-name"
              className="bg-surface-card"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing site"
              autoFocus
            />
          </Field>
          <Field label="Channel" htmlFor="dest-kind">
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger id="dest-kind" className="bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DESTINATION_KIND_MAP).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Endpoint" htmlFor="dest-url" hint="The system base URL. Blank means unconfigured.">
            <Input
              id="dest-url"
              className="bg-surface-card"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://cms.example.com"
            />
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
            {editing ? "Save changes" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExportDialog({ open, onOpenChange, destinations, onSubmit }) {
  const [name, setName] = useState("");
  const [destinationId, setDestinationId] = useState(destinations[0]?.id ?? "");
  const [scheduledAt, setScheduledAt] = useState("");
  const [assetCount, setAssetCount] = useState("");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setDestinationId(destinations[0]?.id ?? "");
    setScheduledAt("");
    setAssetCount("");
    setBusy(false);
  }, [open, destinations]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Give the export a name.");
      return;
    }
    if (!destinationId) {
      toast.error("Choose a destination first.");
      return;
    }
    const count = assetCount === "" ? 0 : Math.floor(Number(assetCount) || 0);
    if (count < 0) {
      toast.error("Asset count must be zero or more.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      name: name.trim(),
      destinationId,
      scheduledAt: fromLocalInput(scheduledAt),
      assetCount: count,
      status: scheduledAt ? "scheduled" : "draft",
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>New publish</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            A dated export leaves as draft; a scheduled one joins the queue.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="export-name">
            <Input
              id="export-name"
              className="bg-surface-card"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring launch set"
              autoFocus
            />
          </Field>
          <Field label="Destination" htmlFor="export-dest">
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger id="export-dest" className="bg-surface-card">
                <SelectValue placeholder="Choose a destination" />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((destination) => (
                  <SelectItem key={destination.id} value={destination.id}>
                    {destination.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Scheduled for" htmlFor="export-when" hint="Blank means draft.">
              <Input
                id="export-when"
                type="datetime-local"
                className="bg-surface-card"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </Field>
            <Field label="Assets" htmlFor="export-count" hint="Planned item count.">
              <Input
                id="export-count"
                className="bg-surface-card"
                inputMode="numeric"
                value={assetCount}
                onChange={(e) => setAssetCount(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
              />
            </Field>
          </div>
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
            Create publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChannelPublishingScreen({ projectId }) {
  const [destinations, setDestinations] = useState([]);
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [exportFilter, setExportFilter] = useState("all");
  const [destDialogOpen, setDestDialogOpen] = useState(false);
  const [editingDest, setEditingDest] = useState(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([listDestinations(projectId), listChannelExports(projectId)]).then(
      ([destRows, exportRows]) => {
        if (!alive) return;
        setDestinations(destRows ?? []);
        setExports(exportRows ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const destinationById = useMemo(() => {
    const map = new Map();
    for (const destination of destinations) map.set(destination.id, destination);
    return map;
  }, [destinations]);

  const latestExportByDest = useMemo(() => {
    const map = new Map();
    const sorted = [...exports].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    for (const row of sorted) {
      if (row.destinationId && !map.has(row.destinationId)) map.set(row.destinationId, row);
    }
    return map;
  }, [exports]);

  const stats = useMemo(
    () => [
      { label: "Destinations", value: String(destinations.length), footer: "connected systems" },
      {
        label: "Connected",
        value: String(destinations.filter((d) => d.status === "connected").length),
        footer: "accepting publishes",
      },
      {
        label: "Queued",
        value: String(exports.filter((e) => e.status === "scheduled" || e.status === "publishing").length),
        footer: "scheduled or publishing",
      },
      {
        label: "Published",
        value: String(exports.filter((e) => e.status === "published").length),
        footer: "completed publishes",
      },
    ],
    [destinations, exports],
  );

  const filteredDests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return destinations.filter((destination) => {
      if (kindFilter !== "all" && destination.kind !== kindFilter) return false;
      if (statusFilter !== "all" && destination.status !== statusFilter) return false;
      if (
        needle &&
        !`${destination.name} ${destination.baseUrl}`.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [destinations, search, kindFilter, statusFilter]);

  const filteredExports = useMemo(
    () =>
      exports.filter((row) => {
        if (exportFilter !== "all" && row.status !== exportFilter) return false;
        return true;
      }),
    [exports, exportFilter],
  );

  const filtersActive =
    kindFilter !== "all" || statusFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setKindFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  const openCreateDest = () => {
    setEditingDest(null);
    setDestDialogOpen(true);
  };

  const submitDestination = async (draft) => {
    if (editingDest) {
      const previous = destinations;
      setDestinations((rows) => rows.map((d) => (d.id === editingDest.id ? { ...d, ...draft } : d)));
      const saved = await updateDestination(editingDest.id, draft);
      if (!saved) {
        setDestinations(previous);
        toast.error("Could not save the destination.");
        return false;
      }
      setDestinations((rows) => rows.map((d) => (d.id === saved.id ? saved : d)));
      toast.success(`Saved ${saved.name}.`);
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      status: "connected",
      lastSyncAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setDestinations((rows) => [optimistic, ...rows]);
    const created = await createDestination({ id, projectId, ...draft });
    if (!created) {
      setDestinations((rows) => rows.filter((d) => d.id !== id));
      toast.error("Could not connect the destination.");
      return false;
    }
    setDestinations((rows) => rows.map((d) => (d.id === id ? created : d)));
    toast.success(`Connected ${created.name}.`);
    return true;
  };

  const setDestStatus = async (destination, status) => {
    const previous = destinations;
    setDestinations((rows) => rows.map((d) => (d.id === destination.id ? { ...d, status } : d)));
    const saved = await updateDestination(destination.id, { status });
    if (!saved) {
      setDestinations(previous);
      toast.error("Could not change the destination.");
      return;
    }
    setDestinations((rows) => rows.map((d) => (d.id === saved.id ? saved : d)));
    toast.success(`${saved.name} ${status === "paused" ? "paused" : "resumed"}.`);
  };

  const removeDestination = async (destination) => {
    const previous = destinations;
    setDestinations((rows) => rows.filter((d) => d.id !== destination.id));
    const ok = await softDeleteDestination(destination.id);
    if (!ok) {
      setDestinations(previous);
      toast.error("Could not remove the destination.");
      return;
    }
    toast.success(`Removed ${destination.name}.`);
  };

  const submitExport = async (draft) => {
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setExports((rows) => [optimistic, ...rows]);
    const created = await createChannelExport({ id, projectId, ...draft });
    if (!created) {
      setExports((rows) => rows.filter((e) => e.id !== id));
      toast.error("Could not create the publish.");
      return false;
    }
    setExports((rows) => rows.map((e) => (e.id === id ? created : e)));
    toast.success(`Created ${created.name}.`);
    return true;
  };

  const advanceExport = async (row) => {
    const next = EXPORT_NEXT_STATUS[row.status];
    if (!next) return;
    const previous = exports;
    setExports((rows) => rows.map((e) => (e.id === row.id ? { ...e, status: next } : e)));
    const saved = await updateChannelExport(row.id, { status: next });
    if (!saved) {
      setExports(previous);
      toast.error("Could not move the publish.");
      return;
    }
    setExports((rows) => rows.map((e) => (e.id === saved.id ? saved : e)));
    toast.success(`${saved.name} is now ${EXPORT_STATUS_MAP[next].label.toLowerCase()}.`);
  };

  const removeExport = async (row) => {
    const previous = exports;
    setExports((rows) => rows.filter((e) => e.id !== row.id));
    const ok = await softDeleteChannelExport(row.id);
    if (!ok) {
      setExports(previous);
      toast.error("Could not delete the publish.");
      return;
    }
    toast.success(`Deleted ${row.name}.`);
  };

  const destColumns = [
    {
      key: "destination",
      header: "Destination",
      render: (destination) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="max-w-[220px] truncate font-medium text-foreground">
              {destination.name || "Untitled destination"}
            </span>
            <Badge variant="neutral">{DESTINATION_KIND_MAP[destination.kind]?.label || destination.kind}</Badge>
          </span>
          <span className="truncate text-xs text-text-secondary">
            {destination.baseUrl || "No endpoint configured"}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (destination) => (
        <div className="flex flex-col gap-1">
          <StatusPill status={destination.status} map={DESTINATION_STATUS_MAP} />
          <span className="text-[11px] text-text-tertiary">
            Synced {formatWhen(destination.lastSyncAt)}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (destination) => (
        <ActionMenu
          label={`Actions for ${destination.name}`}
          items={[
            {
              icon: Pencil,
              label: "Edit",
              onSelect: () => {
                setEditingDest(destination);
                setDestDialogOpen(true);
              },
            },
            destination.status === "paused"
              ? {
                  icon: Play,
                  label: "Resume",
                  onSelect: () => setDestStatus(destination, "connected"),
                }
              : {
                  icon: Pause,
                  label: "Pause",
                  onSelect: () => setDestStatus(destination, "paused"),
                },
            { separator: true },
            {
              icon: Trash2,
              label: "Remove",
              destructive: true,
              onSelect: () => removeDestination(destination),
            },
          ]}
        />
      ),
    },
  ];

  const exportColumns = [
    {
      key: "export",
      header: "Publish",
      render: (row) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="max-w-[220px] truncate font-medium text-foreground">
              {row.name || "Untitled publish"}
            </span>
            {row.scheduledAt && row.status === "scheduled" && new Date(row.scheduledAt).getTime() <= Date.now() ? (
              <Badge variant="warning">Due now</Badge>
            ) : null}
          </span>
          <span className="truncate text-xs text-text-secondary">
            {destinationById.get(row.destinationId)?.name || "Removed destination"}
            {` · ${row.assetCount} asset${row.assetCount === 1 ? "" : "s"}`}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div className="flex flex-col gap-1">
          <StatusPill status={row.status} map={EXPORT_STATUS_MAP} />
          <span className="text-[11px] text-text-tertiary">
            {row.scheduledAt ? `Runs ${formatDateTime(row.scheduledAt)}` : "No schedule"}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (row) => {
        const next = EXPORT_NEXT_STATUS[row.status];
        return (
          <ActionMenu
            label={`Actions for ${row.name}`}
            items={[
              next
                ? {
                    icon: ArrowRight,
                    label: `Move to ${EXPORT_STATUS_MAP[next].label.toLowerCase()}`,
                    onSelect: () => advanceExport(row),
                  }
                : null,
              { separator: true },
              {
                icon: Trash2,
                label: "Delete",
                destructive: true,
                onSelect: () => removeExport(row),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Channel Publishing"
        description="Send assets into connected business systems."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-border bg-surface-card text-foreground hover:bg-surface-active"
              onClick={openCreateDest}
            >
              <Plus className="h-4 w-4" /> Connect
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setExportDialogOpen(true)}
              disabled={destinations.length === 0}
            >
              <Send className="h-4 w-4" /> New publish
            </Button>
          </div>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={kindFilter}
            onValueChange={setKindFilter}
            options={DESTINATION_KIND_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={DESTINATION_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search destinations…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading channel publishing" />
        </div>
      ) : (
        <div className="space-y-8">
          <DataTable
            columns={destColumns}
            data={filteredDests}
            getRowKey={(destination) => destination.id}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                {filtersActive ? (
                  <EmptyState
                    icon={MonitorUp}
                    title="No destinations match these filters"
                    description="Try a different channel, status, or search term."
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
                    icon={MonitorUp}
                    title="No destinations connected"
                    description="Connect a CMS, PIM, ecommerce, social, or automation endpoint to publish into it."
                    action={
                      <Button
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={openCreateDest}
                      >
                        <Plus className="h-4 w-4" /> Connect destination
                      </Button>
                    }
                  />
                )}
              </div>
            }
          />

          <SectionCard
            title="Per-channel status"
            description="Derived from each destination latest publish — never stored separately."
          >
            {destinations.length === 0 ? (
              <p className="text-sm text-text-secondary">
                Connect a destination to see its publish state here.
              </p>
            ) : (
              <div className="space-y-2">
                {destinations.map((destination) => {
                  const latest = latestExportByDest.get(destination.id);
                  return (
                    <div
                      key={destination.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {destination.name}
                        </span>
                        <span className="block truncate text-[11px] text-text-tertiary">
                          {latest
                            ? `Latest: ${latest.name || "Untitled publish"}`
                            : "No publishes yet"}
                        </span>
                      </span>
                      {latest ? (
                        <StatusPill status={latest.status} map={EXPORT_STATUS_MAP} />
                      ) : (
                        <Badge variant="neutral">Idle</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Scheduled exports"
            description="Publish jobs and where they sit in the lifecycle."
            action={
              <div className="flex items-center gap-2">
                <FilterDropdown
                  value={exportFilter}
                  onValueChange={setExportFilter}
                  options={EXPORT_STATUS_FILTER_OPTIONS}
                  height="h-9"
                />
                <Button
                  variant="outline"
                  className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                  onClick={() => setExportDialogOpen(true)}
                  disabled={destinations.length === 0}
                >
                  <Plus className="h-4 w-4" /> New publish
                </Button>
              </div>
            }
          >
            <DataTable
              columns={exportColumns}
              data={filteredExports}
              getRowKey={(row) => row.id}
              empty={
                <EmptyState
                  icon={Send}
                  title="No publishes yet"
                  description="Queue a publish against a destination to track it through draft, schedule, and delivery."
                />
              }
            />
          </SectionCard>
        </div>
      )}

      <DestinationDialog
        key={editingDest ? `dest:${editingDest.id}` : "dest:new"}
        open={destDialogOpen}
        onOpenChange={setDestDialogOpen}
        initial={editingDest}
        onSubmit={submitDestination}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        destinations={destinations.filter((d) => d.status === "connected")}
        onSubmit={submitExport}
      />
    </MainScreenWrapper>
  );
}

export default ChannelPublishingScreen;
