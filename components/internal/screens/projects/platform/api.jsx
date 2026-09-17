"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Check, Copy } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import {
  API_ENDPOINTS,
  API_GROUPS,
  API_GROUP_FILTER_OPTIONS,
  API_METHOD_FILTER_OPTIONS,
  API_METHOD_MAP,
} from "./constants";

// API — an explorer over the routes that actually exist in app/api/**.
// Each entry documents method, path, and an example request; selecting a row
// shows the full example with a copy action. Nothing here invents a route.

export function ApiScreen() {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return API_ENDPOINTS.filter((endpoint) => {
      if (groupFilter !== "all" && endpoint.group !== groupFilter) return false;
      if (methodFilter !== "all" && endpoint.method !== methodFilter) return false;
      if (
        needle &&
        !`${endpoint.method} ${endpoint.path} ${endpoint.summary}`.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [search, groupFilter, methodFilter]);

  const filtersActive =
    groupFilter !== "all" || methodFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setGroupFilter("all");
    setMethodFilter("all");
    setSearch("");
  };

  const stats = useMemo(() => {
    const methods = new Set(API_ENDPOINTS.map((endpoint) => endpoint.method));
    return [
      { label: "Endpoints", value: String(API_ENDPOINTS.length), footer: "routes in app/api" },
      { label: "Groups", value: String(API_GROUPS.length), footer: "storage to webhooks" },
      { label: "Methods", value: String(methods.size), footer: [...methods].sort().join(" · ") },
      {
        label: "Reads",
        value: String(API_ENDPOINTS.filter((endpoint) => endpoint.method === "GET").length),
        footer: "GET routes",
      },
    ];
  }, []);

  const copyExample = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Example copied.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy — select the text manually.");
    }
  };

  const columns = [
    {
      key: "method",
      header: "Method",
      render: (endpoint) => <StatusPill status={endpoint.method} map={API_METHOD_MAP} />,
    },
    {
      key: "path",
      header: "Route",
      render: (endpoint) => (
        <div className="flex min-w-0 flex-col gap-1">
          <code className="truncate font-mono text-[13px] text-foreground">{endpoint.path}</code>
          <span className="max-w-[520px] truncate text-xs text-text-secondary">
            {endpoint.summary}
          </span>
        </div>
      ),
    },
    {
      key: "group",
      header: "Group",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (endpoint) => (
        <span className="whitespace-nowrap text-xs text-text-secondary">{endpoint.group}</span>
      ),
    },
  ];

  const detail = selected && filtered.includes(selected) ? selected : null;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="API"
        description="The REST surface that exists in this repo — storage, uploads, media delivery, webhooks, and operations. Pick a route for an example request."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={groupFilter}
            onValueChange={setGroupFilter}
            options={API_GROUP_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={methodFilter}
            onValueChange={setMethodFilter}
            options={API_METHOD_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search method, path, description…"
        />
      </Toolbar>

      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={(endpoint) => `${endpoint.method} ${endpoint.path}`}
        onRowClick={setSelected}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={BookOpen}
              title="No routes match these filters"
              description="Try a different group, method, or search term."
              action={
                filtersActive ? (
                  <Button
                    variant="outline"
                    className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                ) : null
              }
            />
          </div>
        }
      />

      <SectionCard
        title={detail ? `${detail.method} ${detail.path}` : "Example request"}
        description={
          detail
            ? detail.summary
            : "Select a route above to see a runnable example request."
        }
        action={
          detail ? (
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-surface-card text-foreground hover:bg-surface-active"
              onClick={() => copyExample(detail.example)}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          ) : null
        }
      >
        {detail ? (
          <pre className="overflow-x-auto rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed text-foreground">
            {detail.example}
          </pre>
        ) : (
          <p className="text-sm text-text-secondary">
            {filtered.length} route{filtered.length === 1 ? "" : "s"} listed
            {filtersActive ? " for the current filters" : " in total"}. Auth follows the
            workspace session; the cron route instead takes a CRON_SECRET bearer.
          </p>
        )}
      </SectionCard>
    </MainScreenWrapper>
  );
}

export default ApiScreen;
