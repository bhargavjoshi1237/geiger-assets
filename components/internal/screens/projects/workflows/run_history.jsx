"use client";

import React, { useEffect, useMemo, useState } from "react";
import { History, CheckCircle2, XCircle, Clock, MinusCircle, Loader2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Badge } from "@geiger/ui/badge";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@geiger/ui/sheet";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";

import { listWorkflowRuns } from "@/lib/supabase/workflow_runs";
import { listWorkflows } from "@/lib/supabase/workflows";

import {
  RUN_STATUS_MAP,
  RUN_STATUS_FILTER_OPTIONS,
  catalogEntry,
  formatDateTime,
  formatDuration,
} from "./constants";

const STEP_STATUS_ICON = {
  Success: CheckCircle2,
  Failed: XCircle,
  Running: Clock,
  Skipped: MinusCircle,
};

function RunDetailSheet({ run, workflowName, onClose }) {
  const open = !!run;
  const trigger = run ? catalogEntry(run.trigger) : null;
  const steps = run?.stepsLog || [];
  const contextEntries = run
    ? Object.entries(run.context || {}).filter(([, v]) => v != null && v !== "")
    : [];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{workflowName || "Workflow run"}</SheetTitle>
          <SheetDescription>
            When {trigger?.label || run?.trigger || "—"} · {formatDateTime(run?.startedAt)}
          </SheetDescription>
        </SheetHeader>

        {run ? (
          <div className="space-y-6 px-4 pb-8 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={run.status} map={RUN_STATUS_MAP} />
              <Badge variant="neutral">{formatDuration(run.durationMs)}</Badge>
              <Badge variant="neutral">
                {run.stepsCompleted}/{run.stepsTotal} steps
              </Badge>
            </div>

            {run.status === "Failed" && run.error ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
                {run.error}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-text-tertiary">Started</p>
                <p className="text-foreground">{formatDateTime(run.startedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Finished</p>
                <p className="text-foreground">{formatDateTime(run.finishedAt)}</p>
              </div>
            </div>

            {contextEntries.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Context
                </p>
                <div className="divide-y divide-border rounded-lg border border-border bg-surface-subtle">
                  {contextEntries.map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span className="text-text-secondary">{k}</span>
                      <span className="truncate text-foreground">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Steps
              </p>
              {steps.length ? (
                <div className="space-y-2">
                  {steps.map((s, i) => {
                    const entry = catalogEntry(s.type);
                    const Glyph = STEP_STATUS_ICON[s.status] || CheckCircle2;
                    const meta = RUN_STATUS_MAP[s.status];
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-lg border border-border bg-surface-subtle p-3"
                      >
                        <Glyph
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            meta?.iconClass || "text-text-secondary",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {s.label || entry?.label || s.type}
                          </p>
                          {s.error ? (
                            <p className="mt-0.5 text-xs text-red-300">{s.error}</p>
                          ) : (
                            <p className="mt-0.5 text-xs text-text-secondary">
                              {formatDuration(s.durationMs)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">
                  No step-level detail was recorded for this run.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function RunHistoryScreen({ projectId }) {
  const [runs, setRuns] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;
    listWorkflowRuns(projectId).then((rows) => {
      if (!alive) return;
      setRuns(rows ?? []);
      setLoading(false);
    });
    listWorkflows(projectId).then((rows) => alive && setWorkflows(rows ?? []));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const workflowName = useMemo(() => {
    const map = new Map((workflows || []).map((w) => [w.id, w.name]));
    return (id) => map.get(id) || "Deleted workflow";
  }, [workflows]);

  const workflowOptions = useMemo(
    () => [
      { value: "all", label: "All workflows" },
      ...(workflows || []).map((w) => ({ value: w.id, label: w.name })),
    ],
    [workflows],
  );

  const filtered = useMemo(() => {
    return runs.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (workflowFilter !== "all" && r.workflowId !== workflowFilter) return false;
      if (search) {
        const name = workflowName(r.workflowId);
        const trigger = catalogEntry(r.trigger)?.label || "";
        if (!`${name} ${trigger}`.toLowerCase().includes(search.toLowerCase()))
          return false;
      }
      return true;
    });
  }, [runs, status, workflowFilter, search, workflowName]);

  const stats = useMemo(() => {
    const total = runs.length;
    const success = runs.filter((r) => r.status === "Success").length;
    const failed = runs.filter((r) => r.status === "Failed").length;
    const rate = total ? Math.round((success / total) * 100) : 0;
    const durations = runs.filter((r) => r.durationMs > 0);
    const avg = durations.length
      ? durations.reduce((s, r) => s + r.durationMs, 0) / durations.length
      : 0;
    return [
      { label: "Total runs", value: total.toLocaleString("en-US"), footer: "All time" },
      { label: "Success rate", value: `${rate}%`, footer: `${success} succeeded` },
      { label: "Failed", value: String(failed), footer: "Needs attention" },
      { label: "Avg duration", value: formatDuration(avg), footer: "Per run" },
    ];
  }, [runs]);

  const columns = [
    {
      key: "workflow",
      header: "Workflow",
      render: (r) => {
        const trigger = catalogEntry(r.trigger);
        return (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">
              {workflowName(r.workflowId)}
            </span>
            <span className="text-xs text-text-secondary">
              When {trigger?.label || r.trigger || "—"}
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} map={RUN_STATUS_MAP} />,
    },
    {
      key: "started",
      header: "Started",
      className: "text-text-secondary",
      render: (r) => formatDateTime(r.startedAt),
    },
    {
      key: "duration",
      header: "Duration",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (r) => formatDuration(r.durationMs),
    },
    {
      key: "steps",
      header: "Steps",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (r) => `${r.stepsCompleted}/${r.stepsTotal}`,
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Run History"
        description="Every time a workflow fires, its outcome lands here — the trigger, timing, and a per-step log so you can see exactly what happened."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={status}
            onValueChange={setStatus}
            options={RUN_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={workflowFilter}
            onValueChange={setWorkflowFilter}
            options={workflowOptions}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search runs…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading runs…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(r) => r.id}
          onRowClick={(r) => setSelected(r)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={History}
                title={runs.length ? "No runs match your filters" : "No runs yet"}
                description={
                  runs.length
                    ? "Try clearing the search or filters."
                    : "Once your active workflows start firing, each execution will show up here with its full step-by-step outcome."
                }
              />
            </div>
          }
        />
      )}

      <RunDetailSheet
        run={selected}
        workflowName={selected ? workflowName(selected.workflowId) : ""}
        onClose={() => setSelected(null)}
      />
    </MainScreenWrapper>
  );
}

export default RunHistoryScreen;
