"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import { BookOpen, ChevronRight, KeyRound } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  ScreenHeader,
  SearchInput,
  SectionCard,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { ClearFiltersButton } from "@/components/internal/shared/module_kit";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { appOrigin } from "@/lib/share";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import {
  API_KEY_PLACEHOLDER,
  REFERENCE_ENDPOINTS,
  REFERENCE_GROUP_TABS,
  REFERENCE_GROUPS,
  buildCurl,
} from "./constants";
import { CodeBlock, MethodBadge, OUTLINE_BUTTON, ToolbarTabs } from "./platform_kit";

const noopSubscribe = () => () => {};

function EndpointRow({ endpoint, origin, open, onToggle }) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-hover"
      >
        <MethodBadge method={endpoint.method} />
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground sm:flex-none sm:basis-72">
          {endpoint.path}
        </code>
        <span className="hidden min-w-0 flex-1 truncate text-sm text-text-secondary sm:block">
          {endpoint.title}
        </span>
        <ChevronRight
          className={cn("h-4 w-4 shrink-0 text-text-tertiary transition-transform", open && "rotate-90")}
        />
      </button>
      {open ? (
        <div className="space-y-3 px-5 pb-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm font-medium text-foreground">{endpoint.title}</p>
            <span className="rounded-md border border-border bg-surface-card px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
              {endpoint.scope}
            </span>
          </div>
          <p className="text-sm text-text-secondary">{endpoint.description}</p>
          <CodeBlock
            multiline
            value={buildCurl(endpoint, origin)}
            label={`Copy ${endpoint.title} cURL`}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ApiReferenceScreen() {
  const { setTab } = useWorkspaceUrl();
  const [group, setGroup] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());

  // appOrigin() reads window; the server snapshot is empty so SSR and
  // hydration agree, then the client fills in the real origin.
  const origin = useSyncExternalStore(noopSubscribe, appOrigin, () => "");

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return REFERENCE_GROUPS.filter((g) => group === "all" || g.value === group)
      .map((g) => ({
        ...g,
        endpoints: REFERENCE_ENDPOINTS.filter(
          (e) =>
            e.group === g.value &&
            (!term || `${e.method} ${e.path} ${e.title} ${e.description}`.toLowerCase().includes(term)),
        ),
      }))
      .filter((g) => g.endpoints.length);
  }, [group, search]);

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filtersActive = search.trim() !== "" || group !== "all";

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="API Reference"
        description="Every public endpoint, with a cURL command you can copy and run."
        actions={
          <Button variant="outline" className={OUTLINE_BUTTON} onClick={() => setTab("API Keys")}>
            <KeyRound className="h-4 w-4" />
            Manage keys
          </Button>
        }
      />

      <SectionCard title="Getting started" description="Authenticate every request with a scoped API key.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Base URL</p>
            <CodeBlock value={`${origin}/api/v1`} label="Copy base URL" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Authorization header</p>
            <CodeBlock
              value={`Authorization: Bearer ${API_KEY_PLACEHOLDER}`}
              label="Copy authorization header"
            />
          </div>
        </div>
        <p className="mt-4 text-xs text-text-tertiary">
          Each endpoint lists the scope its key needs. Requests with a missing, expired or revoked key
          are rejected.
        </p>
      </SectionCard>

      <div className="space-y-4">
        <Toolbar>
          <div className="flex min-w-0 items-center gap-2">
            <ToolbarTabs tabs={REFERENCE_GROUP_TABS} value={group} onChange={setGroup} />
            {filtersActive ? (
              <ClearFiltersButton onClick={() => { setSearch(""); setGroup("all"); }} />
            ) : null}
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search endpoints…" />
        </Toolbar>

        {groups.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={BookOpen}
              title="No endpoints match"
              description="Try a different search or resource."
            />
          </div>
        ) : (
          groups.map((g) => (
            <SectionCard
              key={g.value}
              title={g.label}
              description={g.description}
              bodyPadding={false}
              action={
                <span className="text-xs text-text-tertiary">
                  {g.endpoints.length} endpoint{g.endpoints.length === 1 ? "" : "s"}
                </span>
              }
            >
              {g.endpoints.map((e) => {
                const id = `${e.method} ${e.path}`;
                return (
                  <EndpointRow
                    key={id}
                    endpoint={e}
                    origin={origin}
                    open={expanded.has(id)}
                    onToggle={() => toggle(id)}
                  />
                );
              })}
            </SectionCard>
          ))
        )}
      </div>
    </MainScreenWrapper>
  );
}

export default ApiReferenceScreen;
