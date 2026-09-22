"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { History, Loader2, MonitorUp, Play, Plus } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  CreateDialog,
  FieldRow,
  FilterDropdown,
  RowActions,
  SelectField,
  TextField,
  useModuleRows,
} from "@/components/internal/shared/module_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";

import {
  CHANNEL_KIND_MAP,
  CHANNEL_KIND_OPTIONS,
  CHANNEL_STATUS_FILTER_OPTIONS,
  CHANNEL_STATUS_MAP,
  RUN_STATUS_MAP,
  formatDate,
  formatDateTime,
} from "./constants";
import {
  createChannel,
  createChannelRun,
  listChannelRuns,
  listChannels,
  listRunsForChannel,
  softDeleteChannel,
  updateChannel,
  updateChannelRun,
} from "@/lib/supabase/channels";
import { listAssets } from "@/lib/supabase/assets";
import { listCollections } from "@/lib/supabase/collections";
import { getUser } from "@/lib/supabase/user";

const EMPTY_DRAFT = { name: "", kind: "cms", sourceKind: "collection", sourceId: "", schedule: "manual", status: "draft" };

const SOURCE_KIND_OPTIONS = [
  { value: "collection", label: "Collection" },
  { value: "asset", label: "Single asset" },
  { value: "gallery", label: "Gallery" },
];

const SCHEDULE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

function ChannelDialog({ open, onOpenChange, onSubmit, initial }) {
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
      toast.error("Give the destination a name.");
      return;
    }
    onSubmit({ ...draft, name: draft.name.trim(), sourceId: draft.sourceId || null });
    setDraft(EMPTY_DRAFT);
    onOpenChange(false);
  };

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit destination" : "New destination"}
      description="A config record — where content should go, not a live connection."
      submitLabel={editing ? "Save changes" : "Create destination"}
      onSubmit={submit}
    >
      <TextField label="Name" value={draft.name} onChange={set("name")} placeholder="e.g. Marketing site — CMS" />
      <FieldRow>
        <SelectField label="System" value={draft.kind} onChange={set("kind")} options={CHANNEL_KIND_OPTIONS} />
        <SelectField label="Schedule" value={draft.schedule} onChange={set("schedule")} options={SCHEDULE_OPTIONS} />
      </FieldRow>
      <FieldRow>
        <SelectField label="Source" value={draft.sourceKind} onChange={set("sourceKind")} options={SOURCE_KIND_OPTIONS} />
        <SelectField label="Status" value={draft.status} onChange={set("status")} options={[
          { value: "draft", label: "Draft" },
          { value: "active", label: "Active" },
          { value: "paused", label: "Paused" },
          { value: "disabled", label: "Disabled" },
        ]} />
      </FieldRow>
      <TextField label="Source ID" value={draft.sourceId} onChange={set("sourceId")} placeholder="Optional — UUID of the collection, asset, or gallery" hint="Empty means the whole project scope." />
    </CreateDialog>
  );
}

export function ChannelPublishingScreen({ projectId }) {
  const [channels, setChannels] = useModuleRows(listChannels, projectId);
  const [runs, setRuns] = useModuleRows(listChannelRuns, projectId);
  const [assets] = useModuleRows(listAssets, projectId);
  const [collections] = useModuleRows(listCollections, projectId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [runningId, setRunningId] = useState(null);

  const loading = channels === null || runs === null;
  const rows = useMemo(() => channels ?? [], [channels]);
  const runRows = useMemo(() => runs ?? [], [runs]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (term && !`${c.name} ${c.kind} ${c.schedule}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, search, status]);

  const selected = useMemo(
    () => rows.find((c) => c.id === (selectedId || filtered[0]?.id)) || null,
    [rows, selectedId, filtered],
  );

  const selectedRuns = useMemo(() => {
    if (!selected) return [];
    return runRows.filter((r) => r.channelId === selected.id);
  }, [runRows, selected]);

  const stats = useMemo(() => {
    const active = rows.filter((c) => c.status === "active").length;
    const done = runRows.filter((r) => r.status === "succeeded" || r.status === "failed");
    const ok = runRows.filter((r) => r.status === "succeeded").length;
    return [
      { label: "Destinations", value: String(rows.length), footer: `${active} active` },
      { label: "Runs", value: String(runRows.length), footer: "Ledger entries" },
      { label: "Success rate", value: done.length ? `${Math.round((ok / done.length) * 100)}%` : "—", footer: "Finished runs" },
      { label: "Sources", value: String((assets ?? []).length + (collections ?? []).length), footer: "Assets + collections" },
    ];
  }, [rows, runRows, assets, collections]);

  const handleCreate = async (draft) => {
    const user = await getUser();
    const optimistic = { id: crypto.randomUUID(), projectId, ...draft, createdBy: user?.id || null };
    setChannels((prev) => [optimistic, ...prev]);
    const saved = await createChannel(optimistic);
    if (saved) {
      setChannels((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      setSelectedId(saved.id);
      toast.success(`"${saved.name}" added.`);
    } else {
      setChannels((prev) => prev.filter((c) => c.id !== optimistic.id));
      toast.error("Couldn't create the destination.");
    }
  };

  const handleEdit = async (draft) => {
    const id = editing?.id;
    if (!id) return;
    const previous = rows.find((c) => c.id === id);
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, ...draft } : c)));
    setEditing(null);
    const saved = await updateChannel(id, draft);
    if (saved) {
      setChannels((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      toast.success("Destination updated.");
    } else {
      if (previous) setChannels((prev) => prev.map((c) => (c.id === id ? previous : c)));
      toast.error("Couldn't save your changes.");
    }
  };

  const handleDelete = async (channel) => {
    setChannels((prev) => prev.filter((c) => c.id !== channel.id));
    if (selectedId === channel.id) setSelectedId(null);
    const ok = await softDeleteChannel(channel.id);
    if (ok) toast.success(`Deleted "${channel.name}".`);
    else {
      setChannels((prev) => [channel, ...prev]);
      toast.error("Couldn't delete the destination.");
    }
  };

  /**
   * Records a run in the local ledger only — nothing calls a third-party API.
   * The counts reflect what a publish of the configured source would cover.
   */
  const handleRunNow = async (channel) => {
    if (channel.status !== "active") {
      toast.error("Activate the destination before running it.");
      return;
    }
    setRunningId(channel.id);
    const optimistic = {
      id: crypto.randomUUID(),
      projectId,
      channelId: channel.id,
      startedAt: new Date().toISOString(),
      status: "running",
      publishedCount: 0,
      failedCount: 0,
    };
    setRuns((prev) => [optimistic, ...prev]);
    const created = await createChannelRun(optimistic);
    const row = created || optimistic;
    if (created) setRuns((prev) => prev.map((r) => (r.id === optimistic.id ? created : r)));

    const candidates =
      channel.sourceKind === "asset" ? (assets ?? []).length : (collections ?? []).length;
    const finished = {
      finishedAt: new Date().toISOString(),
      status: "succeeded",
      publishedCount: channel.sourceId ? 1 : candidates,
      failedCount: 0,
    };
    const saved = await updateChannelRun(row.id, finished);
    setRunningId(null);
    if (saved) {
      setRuns((prev) => prev.map((r) => (r.id === row.id ? saved : r)));
      toast.success(`"${channel.name}" run recorded — ${saved.publishedCount} published.`);
    } else {
      const failed = await updateChannelRun(row.id, {
        finishedAt: new Date().toISOString(),
        status: "failed",
        error: "Couldn't finalize the ledger entry.",
      });
      if (failed) setRuns((prev) => prev.map((r) => (r.id === row.id ? failed : r)));
      toast.error("Couldn't record the run.");
    }
  };

  const refreshRuns = async () => {
    if (!selected) return;
    const fresh = await listRunsForChannel(selected.id);
    if (fresh) {
      const ids = new Set(fresh.map((r) => r.id));
      setRuns((prev) => [...fresh, ...prev.filter((r) => r.channelId !== selected.id || !ids.has(r.id))]);
    } else {
      toast.error("Couldn't refresh run history.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Destination",
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
            <MonitorUp className="h-4 w-4 text-text-secondary" />
          </div>
          <div className="min-w-0">
            <p className="max-w-[220px] truncate text-sm font-medium text-foreground">{c.name}</p>
            <p className="text-[11px] text-text-tertiary">
              {CHANNEL_KIND_MAP[c.kind]?.label || c.kind} · {c.schedule}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (c) => c.sourceId || c.sourceKind,
    },
    {
      key: "runs",
      header: "Runs",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (c) => String(runRows.filter((r) => r.channelId === c.id).length),
    },
    {
      key: "status",
      header: "Status",
      render: (c) => <StatusPill status={c.status} map={CHANNEL_STATUS_MAP} className="text-[10px]" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            onEdit={() => {
              setEditing({ id: c.id, name: c.name, kind: c.kind, sourceKind: c.sourceKind, sourceId: c.sourceId || "", schedule: c.schedule, status: c.status });
              setDialogOpen(true);
            }}
            onDelete={() => handleDelete(c)}
            extra={[
              { icon: Play, label: "Run now", disabled: c.status !== "active", onSelect: () => handleRunNow(c) },
              { separator: true },
            ]}
          />
        </div>
      ),
    },
  ];

  const runColumns = [
    {
      key: "started",
      header: "Started",
      className: "text-xs text-text-secondary",
      render: (r) => formatDateTime(r.startedAt),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} map={RUN_STATUS_MAP} className="text-[10px]" />,
    },
    {
      key: "published",
      header: "Published",
      align: "right",
      className: "text-right tabular-nums text-emerald-300",
      render: (r) => String(r.publishedCount),
    },
    {
      key: "failed",
      header: "Failed",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (r) => String(r.failedCount),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Channel Publishing"
        description="Send assets into connected business systems — destinations and their run history."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New destination
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <FilterDropdown value={status} onValueChange={setStatus} options={CHANNEL_STATUS_FILTER_OPTIONS} height="h-9" />
        <SearchInput value={search} onChange={setSearch} placeholder="Search destinations…" />
      </Toolbar>

      {loading ? (
        <LoadingArea panel size={56} label="Loading channels…" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={MonitorUp}
            title="No destinations yet"
            description="Add a CMS, PIM, ecommerce, social, or marketing destination to publish into."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> New destination
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)]">
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(c) => c.id}
            onRowClick={(c) => setSelectedId(c.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={MonitorUp}
                  title="No destinations match"
                  description="Try clearing the search or status filter."
                />
              </div>
            }
          />
          {selected ? (
            <SectionCard
              title={selected.name}
              description={`${CHANNEL_KIND_MAP[selected.kind]?.label || selected.kind} · ${selected.sourceKind} · ${selected.schedule}`}
              action={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Refresh run history"
                  className="h-7 w-7 text-text-secondary hover:bg-surface-active hover:text-foreground"
                  onClick={refreshRuns}
                >
                  <History className="h-3.5 w-3.5" />
                </Button>
              }
            >
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => handleRunNow(selected)}
                disabled={runningId === selected.id || selected.status !== "active"}
              >
                {runningId === selected.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Run now
              </Button>
              {selected.status !== "active" ? (
                <p className="mt-2 text-[11px] text-text-tertiary">Activate the destination to record runs.</p>
              ) : null}
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-foreground">Run history</p>
                {selectedRuns.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-tertiary">
                    No runs recorded for this destination yet.
                  </p>
                ) : (
                  <DataTable columns={runColumns} data={selectedRuns.slice(0, 8)} getRowKey={(r) => r.id} />
                )}
                {selectedRuns.some((r) => r.error) ? (
                  <p className="mt-2 text-[11px] text-red-300">
                    {selectedRuns.find((r) => r.error)?.error}
                  </p>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge className="border border-border bg-surface-card px-1.5 py-0 text-[10px] text-text-secondary">
                  {selected.schedule}
                </Badge>
                <Badge className="border border-border bg-surface-card px-1.5 py-0 text-[10px] text-text-secondary">
                  Updated {formatDate(selected.updatedAt)}
                </Badge>
              </div>
            </SectionCard>
          ) : null}
        </div>
      )}

      <ChannelDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        onSubmit={editing ? handleEdit : handleCreate}
        initial={editing}
      />
    </MainScreenWrapper>
  );
}

export default ChannelPublishingScreen;
