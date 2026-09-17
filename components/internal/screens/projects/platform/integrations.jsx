"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, PlugZap, Plus, Puzzle } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
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
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import {
  createIntegration,
  listIntegrations,
  softDeleteIntegration,
  updateIntegration,
} from "@/lib/supabase/platform";
import {
  INTEGRATION_CATALOG,
  INTEGRATION_CATEGORY_FILTER_OPTIONS,
  INTEGRATION_CATEGORY_MAP,
  INTEGRATION_STATUS_FILTER_OPTIONS,
  INTEGRATION_STATUS_MAP,
  formatWhen,
  integrationStatusOf,
} from "./constants";

// Integrations — a catalog of connectable services merged over per-project
// connection rows from assets.integrations.
//
// Connecting stores local config only (an API key, a folder id, a channel).
// No real OAuth flow runs against any third party. Secret fields are
// write-only: reads never show them back, and an empty value on update means
// unchanged — the same convention lib/storage/backends/fields.js uses.

function secretConfigured(row, name) {
  const value = row?.config?.[name];
  return typeof value === "string" && value !== "";
}

function seedValues(catalog, row) {
  const seed = {};
  for (const field of catalog?.fields || []) {
    // Secrets are write-only: seed blank so an untouched field reads as
    // "unchanged" on submit rather than echoing the stored credential.
    seed[field.name] = field.secret ? "" : (row?.config?.[field.name] ?? "");
  }
  return seed;
}

function IntegrationDialog({ open, onOpenChange, catalog, row, onSubmit }) {
  const editing = Boolean(row);
  // The caller remounts this dialog on every open (a key carrying the target
  // id plus a token), so state seeds from props once and a half-typed value
  // never survives reopening.
  const [values, setValues] = useState(() => seedValues(catalog, row));
  const [busy, setBusy] = useState(false);

  if (!catalog) return null;

  const set = (name) => (event) => setValues((prev) => ({ ...prev, [name]: event.target.value }));

  const submit = async () => {
    if (busy) return;
    const missing = (catalog.fields || []).filter(
      (field) => !field.secret && field.name === "webhookUrl" && !String(values[field.name] || "").trim(),
    );
    if (missing.length > 0) {
      toast.error("That field is required.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit(values);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>{editing ? `Configure ${catalog.name}` : `Connect ${catalog.name}`}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the stored config. Leave a secret blank to keep the stored value."
              : "Stores local config for this project only — no OAuth runs against the provider."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {(catalog.fields || []).map((field) => (
            <Field
              key={field.name}
              label={field.label}
              htmlFor={`integration-${catalog.id}-${field.name}`}
              hint={
                field.secret && editing && secretConfigured(row, field.name)
                  ? "Configured — leave blank to keep the stored value."
                  : undefined
              }
            >
              <Input
                id={`integration-${catalog.id}-${field.name}`}
                className="bg-surface-card"
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                value={values[field.name] ?? ""}
                onChange={set(field.name)}
                placeholder={
                  field.secret && editing && secretConfigured(row, field.name)
                    ? "•••••• (configured)"
                    : (field.placeholder || "")
                }
              />
            </Field>
          ))}
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
              "Connect"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IntegrationsScreen({ projectId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialog, setDialog] = useState(null); // { catalog, row? }
  const [dialogToken, setDialogToken] = useState(0);

  useEffect(() => {
    let alive = true;
    listIntegrations(projectId).then((result) => {
      if (!alive) return;
      setRows(result ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const byKey = useMemo(() => {
    const map = {};
    for (const row of rows) map[row.key] = row;
    return map;
  }, [rows]);

  const merged = useMemo(
    () =>
      INTEGRATION_CATALOG.map((catalog) => {
        const row = byKey[catalog.id] || null;
        return { catalog, row, status: integrationStatusOf(row) };
      }),
    [byKey],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return merged.filter((entry) => {
      if (categoryFilter !== "all" && entry.catalog.category !== categoryFilter) return false;
      if (statusFilter !== "all" && entry.status !== statusFilter) return false;
      if (
        needle &&
        !`${entry.catalog.name} ${entry.catalog.description}`.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [merged, search, categoryFilter, statusFilter]);

  const filtersActive =
    categoryFilter !== "all" || statusFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setCategoryFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  const stats = useMemo(() => {
    const connected = merged.filter((entry) => entry.status === "connected").length;
    const attention = merged.filter((entry) => entry.status === "error").length;
    return [
      { label: "Connected", value: String(connected), footer: "services syncing" },
      {
        label: "Available",
        value: String(INTEGRATION_CATALOG.length),
        footer: `${Object.keys(INTEGRATION_CATEGORY_MAP).length} categories`,
      },
      {
        label: "Needs attention",
        value: String(attention),
        footer: attention ? "reconnect to resume" : "nothing failing",
      },
      {
        label: "Paused",
        value: String(merged.filter((entry) => entry.status === "paused").length),
        footer: "kept but silent",
      },
    ];
  }, [merged]);

  const openConnect = (catalog, row = null) => {
    setDialog({ catalog, row });
    setDialogToken((token) => token + 1);
  };

  // Merge a dialog's values over the stored config. Empty secrets mean
  // "unchanged" and are dropped so they never clobber the stored credential.
  const submitConfig = async (values) => {
    if (!dialog) return false;
    const { catalog, row } = dialog;
    const config = { ...(row?.config || {}) };
    for (const field of catalog.fields || []) {
      const value = String(values[field.name] ?? "");
      if (field.secret && value === "") continue;
      config[field.name] = value;
    }
    if (row) {
      const previous = row;
      setRows((prev) =>
        prev.map((entry) => (entry.id === row.id ? { ...entry, config } : entry)),
      );
      const saved = await updateIntegration(row.id, { config });
      if (!saved) {
        setRows((prev) => prev.map((entry) => (entry.id === row.id ? previous : entry)));
        toast.error(`Couldn't save ${catalog.name}.`);
        return false;
      }
      setRows((prev) => prev.map((entry) => (entry.id === row.id ? saved : entry)));
      toast.success(`Saved ${catalog.name}.`);
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      key: catalog.id,
      category: catalog.category,
      status: "connected",
      config,
      lastSyncAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setRows((prev) => [optimistic, ...prev]);
    const created = await createIntegration({
      id,
      projectId,
      key: catalog.id,
      category: catalog.category,
      status: "connected",
      config,
    });
    if (!created) {
      setRows((prev) => prev.filter((entry) => entry.id !== id));
      toast.error(`Couldn't connect ${catalog.name}.`);
      return false;
    }
    setRows((prev) => prev.map((entry) => (entry.id === id ? created : entry)));
    toast.success(`Connected ${catalog.name}.`);
    return true;
  };

  const setStatus = async (entry, status) => {
    if (!entry.row) return;
    const previous = rows;
    setRows((prev) =>
      prev.map((item) => (item.id === entry.row.id ? { ...item, status } : item)),
    );
    const saved = await updateIntegration(entry.row.id, { status });
    if (!saved) {
      setRows(previous);
      toast.error(`Couldn't update ${entry.catalog.name}.`);
      return;
    }
    setRows((prev) => prev.map((item) => (item.id === entry.row.id ? saved : item)));
    toast.success(
      status === "connected"
        ? `Resumed ${entry.catalog.name}.`
        : `${entry.catalog.name} ${status === "paused" ? "paused" : "disconnected"}.`,
    );
  };

  const removeIntegration = async (entry) => {
    if (!entry.row) return;
    const previous = rows;
    setRows((prev) => prev.filter((item) => item.id !== entry.row.id));
    const ok = await softDeleteIntegration(entry.row.id);
    if (!ok) {
      setRows(previous);
      toast.error(`Couldn't remove ${entry.catalog.name}.`);
      return;
    }
    toast.success(`Removed ${entry.catalog.name}.`);
  };

  const columns = [
    {
      key: "service",
      header: "Service",
      render: (entry) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[280px] truncate font-medium text-foreground">
            {entry.catalog.name}
          </span>
          <span className="max-w-[340px] truncate text-xs text-text-secondary">
            {entry.catalog.description}
          </span>
          <span className="text-[11px] text-text-tertiary">
            {entry.row ? `Synced ${formatWhen(entry.row.lastSyncAt)}` : "Never connected"}
          </span>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (entry) => (
        <Badge variant="neutral">
          {INTEGRATION_CATEGORY_MAP[entry.catalog.category]?.label || entry.catalog.category}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (entry) => <StatusPill status={entry.status} map={INTEGRATION_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (entry) => (
        <div onClick={(event) => event.stopPropagation()}>
          {entry.row ? (
            <ActionMenu
              label={`Actions for ${entry.catalog.name}`}
              items={[
                {
                  icon: PlugZap,
                  label: entry.status === "paused" ? "Resume" : "Pause",
                  onSelect: () =>
                    setStatus(entry, entry.status === "paused" ? "connected" : "paused"),
                },
                {
                  icon: Plus,
                  label: "Edit config",
                  onSelect: () => openConnect(entry.catalog, entry.row),
                },
                { separator: true },
                {
                  icon: Puzzle,
                  label: "Disconnect",
                  destructive: true,
                  onSelect: () => removeIntegration(entry),
                },
              ]}
            />
          ) : (
            <Button
              size="sm"
              className="h-8 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
              onClick={() => openConnect(entry.catalog)}
            >
              <Plus className="h-3.5 w-3.5" /> Connect
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Integrations"
        description="Creative tools, storage, productivity, project, marketing, and social services. Connecting stores local config for this project — no OAuth runs against any provider."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              const first = merged.find((entry) => !entry.row);
              if (first) openConnect(first.catalog);
              else toast.info("Every catalog service is already connected.");
            }}
          >
            <Plus className="h-4 w-4" /> Connect service
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={categoryFilter}
            onValueChange={setCategoryFilter}
            options={INTEGRATION_CATEGORY_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={INTEGRATION_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search services…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading integrations" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(entry) => entry.catalog.id}
          onRowClick={(entry) => openConnect(entry.catalog, entry.row)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              {filtersActive ? (
                <EmptyState
                  icon={Puzzle}
                  title="No services match these filters"
                  description="Try a different category, status, or search term."
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
                  icon={PlugZap}
                  title="No integrations yet"
                  description="Connect a service to start syncing assets, events, and notifications."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => openConnect(INTEGRATION_CATALOG[0])}
                    >
                      <Plus className="h-4 w-4" /> Connect {INTEGRATION_CATALOG[0].name}
                    </Button>
                  }
                />
              )}
            </div>
          }
        />
      )}

      <IntegrationDialog
        key={`integration:${dialog?.catalog?.id ?? "none"}:${dialog?.row?.id ?? "new"}:${dialogToken}`}
        open={Boolean(dialog)}
        onOpenChange={(value) => {
          if (!value) setDialog(null);
        }}
        catalog={dialog?.catalog}
        row={dialog?.row}
        onSubmit={submitConfig}
      />
    </MainScreenWrapper>
  );
}

export default IntegrationsScreen;
