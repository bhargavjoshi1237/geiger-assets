"use client";

import React, { useMemo, useState } from "react";
import { ArrowRight, BellOff, Plug } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { ClearFiltersButton } from "@/components/internal/shared/module_kit";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@geiger/ui/sheet";

import {
  INTEGRATION_CATALOG,
  INTEGRATION_CATEGORY_FILTER_OPTIONS,
  INTEGRATION_CATEGORY_MAP,
  INTEGRATION_GROUP_ORDER,
  INTEGRATION_STATUS_MAP,
} from "./constants";

function ProviderCard({ provider, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(provider)}
      className="group flex min-h-32 flex-col items-start gap-2 rounded-xl border border-border bg-surface-card p-4 text-left transition-colors hover:bg-surface-hover"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <Badge variant="outline" className="border-border bg-background text-[11px] text-text-secondary">
          {INTEGRATION_CATEGORY_MAP[provider.category] || provider.category}
        </Badge>
        <StatusPill status={provider.status} map={INTEGRATION_STATUS_MAP} />
      </div>
      <span className="text-sm font-semibold text-foreground">{provider.name}</span>
      <span className="line-clamp-2 text-xs leading-5 text-text-secondary">{provider.tagline}</span>
      <span className="mt-auto flex items-center gap-1 text-xs font-medium text-text-tertiary transition-colors group-hover:text-foreground">
        What it would do <ArrowRight className="h-3 w-3" />
      </span>
    </button>
  );
}

export function IntegrationsScreen() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [openKey, setOpenKey] = useState(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return INTEGRATION_CATALOG.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (term && !`${p.name} ${p.tagline}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [search, category]);

  const groups = useMemo(() => {
    const byCategory = new Map();
    for (const p of filtered) {
      if (!byCategory.has(p.category)) byCategory.set(p.category, []);
      byCategory.get(p.category).push(p);
    }
    return INTEGRATION_GROUP_ORDER.filter((c) => byCategory.has(c)).map((c) => ({
      category: c,
      label: INTEGRATION_CATEGORY_MAP[c],
      items: byCategory.get(c),
    }));
  }, [filtered]);

  const stats = useMemo(
    () => [
      { label: "Cataloged", value: String(INTEGRATION_CATALOG.length), footer: `${INTEGRATION_GROUP_ORDER.length} categories` },
      { label: "Connected", value: "0", footer: "OAuth hasn't landed" },
      { label: "Coming soon", value: String(INTEGRATION_CATALOG.length), footer: "Everything below" },
    ],
    [],
  );

  const open = openKey ? INTEGRATION_CATALOG.find((p) => p.key === openKey) : null;
  const hasFilters = search.trim() !== "" || category !== "all";

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Integrations"
        description="Connect creative, storage, and business tools to the DAM. The catalog is scoped — connecting any of them needs OAuth, which hasn't landed yet."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={category} onValueChange={setCategory} options={INTEGRATION_CATEGORY_FILTER_OPTIONS} height="h-9" />
          {hasFilters ? <ClearFiltersButton onClick={() => { setSearch(""); setCategory("all"); }} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search integrations…" />
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No integrations match your filters"
          description="Try clearing the search or picking a different category."
          action={
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => {
                setSearch("");
                setCategory("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        groups.map((group) => (
          <SectionCard
            key={group.category}
            title={group.label}
            description={`${group.items.length} provider${group.items.length === 1 ? "" : "s"} in scope.`}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((provider) => (
                <ProviderCard key={provider.key} provider={provider} onOpen={(p) => setOpenKey(p.key)} />
              ))}
            </div>
          </SectionCard>
        ))
      )}

      <Sheet open={!!open} onOpenChange={(isOpen) => !isOpen && setOpenKey(null)}>
        <SheetContent className="border-border bg-background sm:max-w-md">
          {open ? (
            <div className="grid gap-5">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-border bg-surface-card text-[11px] text-text-secondary">
                    {INTEGRATION_CATEGORY_MAP[open.category]}
                  </Badge>
                  <StatusPill status={open.status} map={INTEGRATION_STATUS_MAP} />
                </div>
                <SheetTitle className="text-left">{open.name}</SheetTitle>
                <SheetDescription className="text-left">{open.tagline}</SheetDescription>
              </SheetHeader>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  What this integration would do
                </p>
                <ul className="grid gap-2">
                  {open.capabilities.map((cap) => (
                    <li
                      key={cap}
                      className="rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground"
                    >
                      {cap}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-sm">
                <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <p className="text-amber-200">
                  Connecting needs OAuth and per-provider sync workers — neither exists yet. Nothing here can be
                  turned on.
                </p>
              </div>
              <Button disabled aria-disabled title="Coming soon — OAuth hasn't landed yet.">
                Connect — coming soon
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </MainScreenWrapper>
  );
}

export default IntegrationsScreen;
