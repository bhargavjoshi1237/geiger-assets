"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileDown, Loader2, Pencil, Play, Plus, Share2, Trash2 } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { ActionMenu } from "@geiger/ui/action-menu";
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
  createReportConfig,
  createReportExport,
  listReportConfigs,
  listReportExports,
  reportConfigBag,
  softDeleteReportConfig,
  updateReportConfig,
} from "@/lib/supabase/analytics";
import {
  EXPORT_FORMAT_MAP,
  EXPORT_STATUS_MAP,
  RANGE_OPTIONS,
  REPORT_KIND_MAP,
  REPORT_KIND_OPTIONS,
  REPORT_SCHEDULE_OPTIONS,
  formatCount,
  formatDateTime,
  inRange,
  rangeDays,
} from "./constants";

// Reports and Exports — saved dashboards, scheduled reports, and export runs.
//
// Report configs are real persisted rows (full optimistic CRUD below); the
// export log records each CSV/PDF run. Saved filters and sharing ride on the
// config's metadata bag and round-trip through reportConfigBag, so toggling
// one never drops the other. An empty pair of tables renders the empty state.

const EMPTY_DRAFT = { name: "", kind: "report", schedule: "manual", formats: ["csv"], filtersText: "", shared: false };

function parseList(text) {
  return String(text || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function ReportDialog({ open, onOpenChange, initial, onSubmit, submitLabel, title }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  React.useEffect(() => {
    if (!open) return;
    setDraft(
      initial
        ? {
            name: initial.name ?? "",
            kind: initial.kind ?? "report",
            schedule: initial.schedule ?? "manual",
            formats: Array.isArray(initial.formats) && initial.formats.length ? initial.formats : ["csv"],
            filtersText: (initial.filters || []).join(", "),
            shared: Boolean(initial.shared),
          }
        : EMPTY_DRAFT,
    );
  }, [initial, open]);

  const set = (key) => (value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const toggleFormat = (format) =>
    setDraft((prev) => ({
      ...prev,
      formats: prev.formats.includes(format)
        ? prev.formats.filter((f) => f !== format)
        : [...prev.formats, format],
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Saved dashboards and scheduled reports keep their metric filters here.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name">
            <Input
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Weekly delivery digest"
              className="border-border bg-surface-card text-foreground"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Kind">
              <FilterDropdown value={draft.kind} onValueChange={set("kind")} options={REPORT_KIND_OPTIONS} height="h-9" />
            </Field>
            <Field label="Schedule">
              <FilterDropdown
                value={draft.schedule}
                onValueChange={set("schedule")}
                options={REPORT_SCHEDULE_OPTIONS}
                height="h-9"
              />
            </Field>
          </div>
          <Field label="Formats" hint="Offered when this config is exported.">
            <div className="flex items-center gap-2">
              {["csv", "pdf"].map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => toggleFormat(format)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium uppercase transition-colors ${
                    draft.formats.includes(format)
                      ? "border-border-strong bg-surface-active text-foreground"
                      : "border-border bg-surface-card text-text-secondary hover:text-foreground"
                  }`}
                >
                  {format}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Saved filters" hint="Comma-separated, e.g. paid, last-30d.">
            <Input
              value={draft.filtersText}
              onChange={(e) => set("filtersText")(e.target.value)}
              placeholder="paid, last-30d"
              className="border-border bg-surface-card text-foreground"
            />
          </Field>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-card px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Shared with team</p>
              <p className="text-xs text-text-secondary">Visible to everyone on this project.</p>
            </div>
            <Switch checked={draft.shared} onCheckedChange={set("shared")} aria-label="Share with team" />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-text-secondary hover:bg-surface-active hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(draft)}
            disabled={!draft.name.trim() || draft.formats.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReportsExportsScreen({ projectId }) {
  const [configs, setConfigs] = useState([]);
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [runningId, setRunningId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listReportConfigs(projectId), listReportExports(projectId)]).then(
      ([configRows, exportRows]) => {
        if (!alive) return;
        setConfigs(configRows ?? []);
        setExports(exportRows ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const rangeExports = useMemo(
    () => exports.filter((entry) => inRange(entry.createdAt, range)),
    [exports, range],
  );

  const stats = useMemo(() => {
    const dashboards = configs.filter((config) => config.kind === "dashboard" && config.isActive).length;
    const scheduled = configs.filter(
      (config) => config.kind === "report" && config.schedule !== "manual" && config.isActive,
    ).length;
    const failed = rangeExports.filter((entry) => entry.status === "failed").length;
    return [
      { label: "Dashboards", value: formatCount(dashboards), footer: "active" },
      { label: "Scheduled", value: formatCount(scheduled), footer: "recurring reports" },
      { label: "Exports", value: formatCount(rangeExports.length), footer: `last ${rangeDays(range)} days` },
      { label: "Failed", value: formatCount(failed), footer: "exports in window" },
    ];
  }, [configs, rangeExports, range]);

  const configById = useMemo(() => {
    const map = new Map();
    for (const config of configs) map.set(config.id, config);
    return map;
  }, [configs]);

  const filteredExports = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rangeExports.filter((entry) => {
      if (!needle) return true;
      const config = entry.reportId ? configById.get(entry.reportId) : null;
      return `${config?.name || ""} ${entry.format} ${entry.status}`.toLowerCase().includes(needle);
    });
  }, [rangeExports, search, configById]);

  const filtersActive = search.trim() !== "";
  const hasAnything = configs.length > 0 || exports.length > 0;

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (config) => {
    setEditing(config);
    setDialogOpen(true);
  };

  const handleCreate = async (draft) => {
    if (!draft.name.trim()) {
      toast.error("Report name is required.");
      return;
    }
    if (draft.formats.length === 0) {
      toast.error("Pick at least one export format.");
      return;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      name: draft.name.trim(),
      kind: draft.kind,
      schedule: draft.schedule,
      isActive: true,
      lastRunAt: null,
      filters: parseList(draft.filtersText),
      formats: draft.formats,
      shared: draft.shared,
      sharedWith: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setConfigs((prev) => [optimistic, ...prev]);
    setDialogOpen(false);
    const created = await createReportConfig({ ...optimistic, projectId });
    if (created) {
      setConfigs((prev) => prev.map((config) => (config.id === id ? created : config)));
      toast.success(`Saved “${created.name}”.`);
    } else {
      setConfigs((prev) => prev.filter((config) => config.id !== id));
      toast.error("Couldn't save the report.");
    }
  };

  const handleSave = async (draft) => {
    if (!editing) return;
    if (!draft.name.trim()) {
      toast.error("Report name is required.");
      return;
    }
    const previous = configs;
    const patch = {
      name: draft.name.trim(),
      kind: draft.kind,
      schedule: draft.schedule,
      filters: parseList(draft.filtersText),
      formats: draft.formats.length ? draft.formats : ["csv"],
      shared: draft.shared,
      sharedWith: editing.sharedWith,
    };
    setConfigs((prev) => prev.map((config) => (config.id === editing.id ? { ...config, ...patch } : config)));
    setEditing(null);
    setDialogOpen(false);
    const saved = await updateReportConfig(editing.id, patch);
    if (saved) {
      setConfigs((prev) => prev.map((config) => (config.id === saved.id ? saved : config)));
      toast.success(`Saved “${saved.name}”.`);
    } else {
      setConfigs(previous);
      toast.error("Couldn't save the report.");
    }
  };

  const toggleActive = async (config, isActive) => {
    const previous = configs;
    setConfigs((prev) => prev.map((row) => (row.id === config.id ? { ...row, isActive } : row)));
    const saved = await updateReportConfig(config.id, { ...reportConfigBag(config), isActive });
    if (saved) {
      setConfigs((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
      toast.success(`“${saved.name}” ${isActive ? "activated" : "paused"}.`);
    } else {
      setConfigs(previous);
      toast.error("Couldn't change that report.");
    }
  };

  const toggleShared = async (config) => {
    const previous = configs;
    const shared = !config.shared;
    setConfigs((prev) => prev.map((row) => (row.id === config.id ? { ...row, shared } : row)));
    const saved = await updateReportConfig(config.id, { ...reportConfigBag(config), shared });
    if (saved) {
      setConfigs((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
      toast.success(shared ? `Shared “${saved.name}” with the team.` : `Unshared “${saved.name}”.`);
    } else {
      setConfigs(previous);
      toast.error("Couldn't change sharing.");
    }
  };

  const removeConfig = async (config) => {
    const previous = configs;
    setConfigs((rows) => rows.filter((row) => row.id !== config.id));
    const ok = await softDeleteReportConfig(config.id);
    if (ok) {
      toast.success(`Deleted “${config.name}”.`);
    } else {
      setConfigs(previous);
      toast.error("Couldn't delete the report.");
    }
  };

  const runExport = async (config, format) => {
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      reportId: config.id,
      format,
      status: "running",
      rowCount: 0,
      createdAt: new Date().toISOString(),
    };
    setExports((prev) => [optimistic, ...prev]);
    setRunningId(id);
    const recorded = await createReportExport({
      id,
      projectId,
      reportId: config.id,
      format,
      status: "completed",
      rowCount: 0,
    });
    setRunningId(null);
    if (recorded) {
      setExports((prev) => prev.map((entry) => (entry.id === id ? recorded : entry)));
      const touched = await updateReportConfig(config.id, {
        ...reportConfigBag(config),
        lastRunAt: new Date().toISOString(),
      });
      if (touched) {
        setConfigs((prev) => prev.map((row) => (row.id === touched.id ? touched : row)));
      }
      toast.success(`Exported “${config.name}” as ${format.toUpperCase()}.`);
    } else {
      setExports((prev) => prev.filter((entry) => entry.id !== id));
      toast.error("Couldn't record the export.");
    }
  };

  const configColumns = [
    {
      key: "name",
      header: "Report",
      render: (config) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">{config.name}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
            <StatusPill status={config.kind} map={REPORT_KIND_MAP} />
            <span className="capitalize">{config.schedule}</span>
            {config.filters.length > 0 ? (
              <span className="truncate text-text-tertiary">{config.filters.join(", ")}</span>
            ) : null}
          </span>
        </div>
      ),
    },
    {
      key: "formats",
      header: "Formats",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (config) => (
        <span className="flex gap-1">
          {(config.formats || []).map((format) => (
            <Badge key={format} variant="neutral" className="uppercase">
              {format}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: "shared",
      header: "Shared",
      render: (config) => (
        <span className={config.shared ? "text-emerald-400" : "text-text-tertiary"}>
          <Share2 className="h-4 w-4" aria-label={config.shared ? "Shared with team" : "Private"} />
        </span>
      ),
    },
    {
      key: "active",
      header: "Active",
      align: "right",
      className: "text-right",
      render: (config) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={config.isActive}
            aria-label={`${config.isActive ? "Pause" : "Activate"} ${config.name}`}
            onCheckedChange={(value) => toggleActive(config, value)}
          />
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (config) => (
        <ActionMenu
          label={`Actions for ${config.name}`}
          items={[
            ...(config.formats || ["csv"]).map((format) => ({
              icon: runningId ? Loader2 : Play,
              label: `Export ${String(format).toUpperCase()}`,
              spin: Boolean(runningId),
              disabled: Boolean(runningId),
              onSelect: () => runExport(config, format),
            })),
            { icon: Pencil, label: "Edit", onSelect: () => openEdit(config) },
            {
              icon: Share2,
              label: config.shared ? "Unshare" : "Share with team",
              onSelect: () => toggleShared(config),
            },
            { separator: true },
            { icon: Trash2, label: "Delete", destructive: true, onSelect: () => removeConfig(config) },
          ]}
        />
      ),
    },
  ];

  const exportColumns = [
    {
      key: "report",
      header: "Report",
      render: (entry) => {
        const config = entry.reportId ? configById.get(entry.reportId) : null;
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="max-w-[260px] truncate font-medium text-foreground">
              {config?.name || "Deleted report"}
            </span>
            <span className="truncate text-xs text-text-secondary">{formatDateTime(entry.createdAt)}</span>
          </div>
        );
      },
    },
    {
      key: "format",
      header: "Format",
      render: (entry) => <StatusPill status={entry.format} map={EXPORT_FORMAT_MAP} />,
    },
    {
      key: "status",
      header: "Status",
      render: (entry) => <StatusPill status={entry.status} map={EXPORT_STATUS_MAP} />,
    },
    {
      key: "rows",
      header: "Rows",
      align: "right",
      className: "text-right tabular-nums text-xs",
      render: (entry) => formatCount(entry.rowCount),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Reports and Exports"
        description="Custom dashboards, scheduled reports, and CSV/PDF export runs."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> New report
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={range} onValueChange={setRange} options={RANGE_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Filter exports…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading reports and exports" />
        </div>
      ) : !hasAnything ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={FileDown}
            title="No reports yet"
            description="Save a dashboard or schedule a report, then export it as CSV or PDF."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={openCreate}
              >
                <Plus className="h-4 w-4" /> New report
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          <SectionCard title="Saved reports" description="Dashboards and scheduled reports for this project.">
            <DataTable
              columns={configColumns}
              data={configs}
              getRowKey={(config) => config.id}
              onRowClick={openEdit}
              empty={
                <EmptyState
                  icon={FileDown}
                  title="No saved reports"
                  description="Create one to schedule exports and share it with the team."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={openCreate}
                    >
                      <Plus className="h-4 w-4" /> New report
                    </Button>
                  }
                />
              }
            />
          </SectionCard>

          <SectionCard
            title="Export runs"
            description={`CSV and PDF runs from the last ${rangeDays(range)} days.`}
          >
            <DataTable
              columns={exportColumns}
              data={filteredExports}
              getRowKey={(entry) => entry.id}
              empty={
                <EmptyState
                  icon={FileDown}
                  title={filtersActive ? "No exports match this filter" : "No exports in this window"}
                  description={
                    filtersActive
                      ? "Try a different search term."
                      : "Run an export from a saved report to record it here."
                  }
                  action={
                    filtersActive ? (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="text-xs font-medium text-foreground underline underline-offset-4"
                      >
                        Clear filters
                      </button>
                    ) : null
                  }
                />
              }
            />
          </SectionCard>
        </div>
      )}

      <ReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        title={editing ? `Edit ${editing.name}` : "New report"}
        submitLabel={editing ? "Save changes" : "Create report"}
        onSubmit={editing ? handleSave : handleCreate}
      />
    </MainScreenWrapper>
  );
}

export default ReportsExportsScreen;
