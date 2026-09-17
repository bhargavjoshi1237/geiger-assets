"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { HardDrive, Loader2, Pencil, Plug, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Switch } from "@geiger/ui/switch";
import { ActionMenu } from "@geiger/ui/action-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@geiger/ui/tooltip";
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
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import {
  backendErrorMessage,
  createStorageBackend,
  deleteStorageBackend,
  listStorageBackends,
  listStoragePools,
  testStorageBackend,
  updateStorageBackend,
} from "@/lib/storage/backends_client";
import { BackendDialog } from "./backend_dialog";
import { BackendImpactDialog } from "./backend_impact_dialog";
import { PoolEditor } from "./pool_editor";
import {
  BACKEND_HEALTH_MAP,
  BACKEND_KIND_MAP,
  CAPABILITY_LABELS,
  HEALTH_FILTER_OPTIONS,
  KIND_FILTER_OPTIONS,
  SCOPE_FILTER_OPTIONS,
  SUITE_WIDE_HINT,
  backendHealthState,
  formatBytes,
  formatWhen,
} from "./constants";

// Storage backends — the settings surface for the pluggable storage layer.
//
// Two scopes share this screen. Project backends are ours to edit; suite-wide
// backends (project_id null) are shared by every Geiger product and seeded in
// SQL, so they are listed for context and shown read-only. The API forbids
// writes on them by design, so the screen never offers an action that would
// always fail — testing a connection is a read and stays available.
//
// A `null` storage_backend on an asset means "the env-configured default", not
// any row here; that is why deleting a backend never strands the rest of the
// library.

const KIND_ENDPOINT_KEYS = ["endpoint", "baseUrl"];

function endpointOf(backend) {
  for (const key of KIND_ENDPOINT_KEYS) {
    if (backend.config?.[key]) return String(backend.config[key]);
  }
  return "";
}

function capabilityList(capabilities) {
  return Object.entries(capabilities || {})
    .filter(([, on]) => on)
    .map(([name]) => CAPABILITY_LABELS[name] || name);
}

export function StorageBackendsScreen({ projectId }) {
  const [backends, setBackends] = useState([]);
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [impact, setImpact] = useState(null); // { backend, mode, token }
  // Bumped on every dialog open so the dialog remounts and seeds fresh state —
  // a half-typed credential must never survive into the next edit.
  const [dialogToken, setDialogToken] = useState(0);
  const [testingId, setTestingId] = useState(null);
  // Probe results for this session: latency and capabilities are returned by the
  // health route but not stored on the row, so they live here.
  const [probes, setProbes] = useState({});

  useEffect(() => {
    let alive = true;
    Promise.all([listStorageBackends(projectId), listStoragePools(projectId)]).then(
      ([backendRows, poolRows]) => {
        if (!alive) return;
        setBackends(backendRows ?? []);
        setPools(poolRows ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const fail = (code, fallback) => toast.error(backendErrorMessage(code, fallback));

  const stats = useMemo(
    () => [
      {
        label: "Backends",
        value: String(backends.length),
        footer: "providers configured",
      },
      {
        label: "Healthy",
        value: String(backends.filter((b) => b.healthOk === true).length),
        footer: "passed their last probe",
      },
      {
        label: "Enabled",
        value: String(backends.filter((b) => b.enabled).length),
        footer: "eligible for placement",
      },
      {
        label: "Pools",
        value: String(pools.length),
        footer: pools.length ? "configured" : "implicit failover",
      },
    ],
    [backends, pools],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return backends.filter((backend) => {
      if (kindFilter !== "all" && backend.kind !== kindFilter) return false;
      if (healthFilter !== "all" && backendHealthState(backend) !== healthFilter) return false;
      if (scopeFilter === "project" && backend.projectId === null) return false;
      if (scopeFilter === "suite" && backend.projectId !== null) return false;
      if (
        needle &&
        !`${backend.label} ${backend.kind} ${endpointOf(backend)}`.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [backends, search, kindFilter, healthFilter, scopeFilter]);

  const filtersActive =
    kindFilter !== "all" || healthFilter !== "all" || scopeFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setKindFilter("all");
    setHealthFilter("all");
    setScopeFilter("all");
    setSearch("");
  };

  const openCreate = () => {
    setEditing(null);
    setDialogToken((t) => t + 1);
    setDialogOpen(true);
  };

  const openEdit = (backend) => {
    if (backend.projectId === null) {
      toast.info(SUITE_WIDE_HINT);
      return;
    }
    setEditing(backend);
    setDialogToken((t) => t + 1);
    setDialogOpen(true);
  };

  const submitBackend = async (draft) => {
    if (editing) {
      let code = null;
      const saved = await updateStorageBackend(editing.id, draft, { onError: (c) => (code = c) });
      if (!saved) {
        fail(code, "Couldn't save the backend.");
        return false;
      }
      setBackends((rows) => rows.map((b) => (b.id === saved.id ? saved : b)));
      toast.success(`Saved “${saved.label}”.`);
      return true;
    }

    let code = null;
    const created = await createStorageBackend(
      { projectId, ...draft },
      { onError: (c) => (code = c) },
    );
    if (!created) {
      fail(code, "Couldn't add the backend.");
      return false;
    }
    setBackends((rows) => [...rows, created]);
    toast.success(`Added “${created.label}”.`);
    return true;
  };

  const runTest = async (backend) => {
    setTestingId(backend.id);
    let code = null;
    const result = await testStorageBackend(backend.id, { onError: (c) => (code = c) });
    setTestingId(null);
    if (!result) {
      fail(code, "Couldn't reach the backend.");
      return;
    }
    setProbes((prev) => ({ ...prev, [backend.id]: result }));
    // The route records the probe on the row, so mirror it locally instead of
    // re-fetching the whole list for one changed field.
    setBackends((rows) =>
      rows.map((b) =>
        b.id === backend.id
          ? {
              ...b,
              healthOk: Boolean(result.ok),
              healthDetail: result.detail ?? null,
              healthCheckedAt: new Date().toISOString(),
            }
          : b,
      ),
    );
    if (result.ok) {
      const latency = Number.isFinite(result.latencyMs) ? ` in ${Math.round(result.latencyMs)} ms` : "";
      toast.success(`${backend.label} answered${latency}.`);
    } else {
      toast.error(`${backend.label} failed: ${result.detail || "no detail"}`);
    }
  };

  const setEnabled = async (backend, enabled) => {
    const previous = backend.enabled;
    setBackends((rows) => rows.map((b) => (b.id === backend.id ? { ...b, enabled } : b)));
    let code = null;
    const saved = await updateStorageBackend(backend.id, { enabled }, { onError: (c) => (code = c) });
    if (saved) {
      setBackends((rows) => rows.map((b) => (b.id === saved.id ? saved : b)));
      toast.success(`${saved.label} ${enabled ? "enabled" : "disabled"}.`);
      return true;
    }
    setBackends((rows) =>
      rows.map((b) => (b.id === backend.id ? { ...b, enabled: previous } : b)),
    );
    fail(code, "Couldn't change that backend.");
    return false;
  };

  const removeBackend = async (backend) => {
    const previous = backends;
    setBackends((rows) => rows.filter((b) => b.id !== backend.id));
    let code = null;
    const ok = await deleteStorageBackend(backend.id, { onError: (c) => (code = c) });
    if (ok) {
      toast.success(`Deleted “${backend.label}”.`);
      return true;
    }
    setBackends(previous);
    fail(code, "Couldn't delete the backend.");
    return false;
  };

  // The token keys the dialog, so reopening it on the same backend still starts
  // from an unresolved count rather than a stale one.
  const askImpact = (backend, mode) =>
    setImpact({ backend, mode, token: Date.now() });

  const confirmImpact = async () => {
    if (!impact) return;
    const { backend, mode } = impact;
    const done = mode === "delete" ? await removeBackend(backend) : await setEnabled(backend, false);
    if (done) setImpact(null);
  };

  const columns = [
    {
      key: "label",
      header: "Backend",
      render: (backend) => {
        const probe = probes[backend.id];
        const capabilities = capabilityList(probe?.capabilities);
        const endpoint = endpointOf(backend);
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex items-center gap-2">
              <span className="max-w-[260px] truncate font-medium text-foreground">
                {backend.label || "Untitled backend"}
              </span>
              {backend.projectId === null ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="info">Suite-wide</Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{SUITE_WIDE_HINT}</TooltipContent>
                </Tooltip>
              ) : null}
            </span>
            <span className="truncate text-xs text-text-secondary">
              {endpoint || BACKEND_KIND_MAP[backend.kind]?.description}
              {backend.maxUploadBytes ? ` · max ${formatBytes(backend.maxUploadBytes)}` : ""}
            </span>
            {capabilities.length ? (
              <span className="text-[11px] text-text-tertiary">
                Supports {capabilities.join(", ").toLowerCase()}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "kind",
      header: "Kind",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (backend) => (
        <Badge variant="neutral">{BACKEND_KIND_MAP[backend.kind]?.label || backend.kind}</Badge>
      ),
    },
    {
      key: "health",
      header: "Health",
      render: (backend) => {
        const state = backendHealthState(backend);
        const probe = probes[backend.id];
        const pill = <StatusPill status={state} map={BACKEND_HEALTH_MAP} />;
        return (
          <div className="flex flex-col gap-1">
            {backend.healthDetail ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-fit">{pill}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{backend.healthDetail}</TooltipContent>
              </Tooltip>
            ) : (
              pill
            )}
            <span className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
              {testingId === backend.id ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-label="Testing connection" />
              ) : null}
              {formatWhen(backend.healthCheckedAt)}
              {probe && Number.isFinite(probe.latencyMs) ? ` · ${Math.round(probe.latencyMs)} ms` : ""}
            </span>
          </div>
        );
      },
    },
    {
      key: "enabled",
      header: "Enabled",
      align: "right",
      className: "text-right",
      render: (backend) => {
        const readOnly = backend.projectId === null;
        const control = (
          <Switch
            checked={backend.enabled}
            disabled={readOnly}
            aria-label={`Enable ${backend.label}`}
            onCheckedChange={(value) =>
              value ? setEnabled(backend, true) : askImpact(backend, "disable")
            }
          />
        );
        return (
          // The row itself is clickable; the toggle must not open the editor.
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            {readOnly ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>{control}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{SUITE_WIDE_HINT}</TooltipContent>
              </Tooltip>
            ) : (
              control
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (backend) => {
        const readOnly = backend.projectId === null;
        return (
          <ActionMenu
            label={`Actions for ${backend.label}`}
            items={[
              {
                icon: Plug,
                label: testingId === backend.id ? "Testing…" : "Test connection",
                spin: testingId === backend.id,
                // A probe records its result on the row, so it is a write and
                // the API refuses it for suite-wide backends.
                disabled: readOnly || testingId === backend.id,
                onSelect: () => runTest(backend),
              },
              {
                icon: Pencil,
                label: readOnly ? "Edit (read-only)" : "Edit",
                disabled: readOnly,
                onSelect: () => openEdit(backend),
              },
              {
                icon: backend.enabled ? PowerOff : Power,
                label: backend.enabled ? "Disable" : "Enable",
                disabled: readOnly,
                onSelect: () =>
                  backend.enabled
                    ? askImpact(backend, "disable")
                    : setEnabled(backend, true),
              },
              { separator: true },
              {
                icon: Trash2,
                label: "Delete",
                destructive: true,
                disabled: readOnly,
                onSelect: () => askImpact(backend, "delete"),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    // The workspace shell already provides one, but the screen must not depend
    // on an ancestor it doesn't own for its tooltips to render.
    <TooltipProvider delayDuration={200}>
      <MainScreenWrapper>
        <ScreenHeader
          title="Storage Backends"
          description="Providers this project can write to, and the pools that choose between them. Assets with no backend recorded resolve to the env-configured default."
          actions={
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" /> Add backend
            </Button>
          }
        />

        <StatsBar stats={stats} />

        <Toolbar>
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown value={kindFilter} onValueChange={setKindFilter} options={KIND_FILTER_OPTIONS} height="h-9" />
            <FilterDropdown value={healthFilter} onValueChange={setHealthFilter} options={HEALTH_FILTER_OPTIONS} height="h-9" />
            <FilterDropdown value={scopeFilter} onValueChange={setScopeFilter} options={SCOPE_FILTER_OPTIONS} height="h-9" />
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search backends, endpoints…"
          />
        </Toolbar>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
            <LogoLoading size={56} aria-label="Loading storage backends" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(backend) => backend.id}
            onRowClick={openEdit}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                {filtersActive ? (
                  <EmptyState
                    icon={HardDrive}
                    title="No backends match these filters"
                    description="Try a different kind, scope, or search term."
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
                    icon={HardDrive}
                    title="No storage backends yet"
                    description="Uploads go to the env-configured default bucket until you add one."
                    action={
                      <Button
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={openCreate}
                      >
                        <Plus className="h-4 w-4" /> Add backend
                      </Button>
                    }
                  />
                )}
              </div>
            }
          />
        )}

        <PoolEditor
          projectId={projectId}
          pools={pools}
          setPools={setPools}
          backends={backends}
          loading={loading}
        />

        <BackendDialog
          key={`backend:${editing?.id ?? "new"}:${dialogToken}`}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          backend={editing}
          onSubmit={submitBackend}
        />

        <BackendImpactDialog
          key={`impact:${impact?.backend?.id ?? "none"}:${impact?.token ?? 0}`}
          open={Boolean(impact)}
          backend={impact?.backend}
          mode={impact?.mode}
          pools={pools}
          onCancel={() => setImpact(null)}
          onConfirm={confirmImpact}
        />
      </MainScreenWrapper>
    </TooltipProvider>
  );
}

export default StorageBackendsScreen;
