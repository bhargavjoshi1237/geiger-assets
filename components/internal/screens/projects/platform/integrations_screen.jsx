"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Download,
  KeyRound,
  Loader2,
  Plug,
  ShieldCheck,
  Unplug,
} from "lucide-react";

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
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import {
  DRIVE_ERROR_MESSAGES,
  connectDrive,
  disconnectDrive,
  getDriveStatus,
} from "@/lib/integrations/google_drive";

import {
  INTEGRATION_CATALOG,
  INTEGRATION_CATEGORY_MAP,
  INTEGRATION_CATEGORY_TABS,
  INTEGRATION_GROUP_ORDER,
  INTEGRATION_STATUS_MAP,
} from "./constants";
import {
  DetailSheet,
  Notice,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  SheetSection,
  ToolbarTabs,
} from "./platform_kit";

// Where the Drive import picker lives today.
const DRIVE_IMPORT_TAB = "External Uploads";

function BrandTile({ provider, size = "md", muted = false }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center font-bold tracking-tight text-white shadow-sm transition-opacity",
        size === "lg" ? "h-11 w-11 rounded-xl text-sm" : "h-10 w-10 rounded-lg text-xs",
        muted && "opacity-60 group-hover:opacity-100",
      )}
      style={{ background: provider.color }}
    >
      {provider.letter}
    </span>
  );
}

function statusOf(provider, drive) {
  if (provider.kind === "builtin") return "built_in";
  if (provider.kind !== "oauth") return "coming_soon";
  if (drive.loading) return null;
  if (!drive.configured) return "not_configured";
  return drive.connected ? "connected" : "available";
}

function IntegrationCard({ provider, status, onOpen }) {
  const planned = provider.kind === "planned";
  return (
    <button
      type="button"
      onClick={() => onOpen(provider)}
      className={cn(
        "group flex min-h-44 flex-col rounded-xl border bg-surface-subtle p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        status === "connected" ? "border-emerald-500/30" : "border-border",
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <BrandTile provider={provider} muted={planned} />
        {status ? (
          <StatusPill status={status} map={INTEGRATION_STATUS_MAP} className="text-[10px]" />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-3 text-sm font-semibold",
          planned ? "text-text-secondary group-hover:text-foreground" : "text-foreground",
        )}
      >
        {provider.name}
      </p>
      <p className="text-[11px] text-text-tertiary">{INTEGRATION_CATEGORY_MAP[provider.category]}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-text-secondary">{provider.tagline}</p>
      <span
        className={cn(
          "mt-auto flex items-center gap-1 pt-3 text-xs font-medium transition-colors",
          planned ? "text-text-tertiary group-hover:text-text-secondary" : "text-foreground",
        )}
      >
        {planned ? "See what's planned" : status === "connected" ? "Manage" : "Set up"}
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

/** One live connection: brand tile, who it's linked to, and its actions. */
function ConnectionRow({ provider, status, detail, children }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <BrandTile provider={provider} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{provider.name}</p>
            {status ? (
              <StatusPill status={status} map={INTEGRATION_STATUS_MAP} className="text-[10px]" />
            ) : null}
          </div>
          <p className="truncate text-xs text-text-secondary">{detail}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function IntegrationsScreen() {
  const { setTab } = useWorkspaceUrl();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [openKey, setOpenKey] = useState(null);
  const [drive, setDrive] = useState({ loading: true, configured: false, connected: false, email: "" });
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    getDriveStatus().then((status) => {
      setDrive({
        loading: false,
        configured: Boolean(status?.configured),
        connected: Boolean(status?.connected),
        email: status?.email || "",
      });
    });
  }, []);

  // The OAuth callback lands back here with ?drive=<outcome>; surface it once
  // and strip the param so a refresh doesn't repeat the toast.
  useEffect(() => {
    const url = new URL(window.location.href);
    const outcome = url.searchParams.get("drive");
    if (!outcome) return;
    if (outcome === "connected") toast.success(DRIVE_ERROR_MESSAGES.connected);
    else toast.error(DRIVE_ERROR_MESSAGES[outcome] || DRIVE_ERROR_MESSAGES.failed);
    url.searchParams.delete("drive");
    window.history.replaceState(window.history.state, "", url);
  }, []);

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

  const stats = useMemo(() => {
    const count = (kind) => INTEGRATION_CATALOG.filter((p) => p.kind === kind).length;
    const connected = drive.connected ? 1 : 0;
    return [
      { label: "Connected", value: String(connected), footer: connected ? "Linked accounts" : "Nothing linked yet" },
      { label: "Connectable", value: String(count("oauth")), footer: "Link an account today" },
      { label: "Built in", value: String(count("builtin")), footer: "Native to this workspace" },
      { label: "On the roadmap", value: String(count("planned")), footer: "Scoped, not live yet" },
    ];
  }, [drive.connected]);

  const liveProviders = INTEGRATION_CATALOG.filter((p) => p.kind !== "planned");
  const open = openKey ? INTEGRATION_CATALOG.find((p) => p.key === openKey) : null;
  const openStatus = open ? statusOf(open, drive) : null;

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
  };

  const handleConnectDrive = () => {
    if (!drive.configured) {
      toast.error(DRIVE_ERROR_MESSAGES.not_configured);
      return;
    }
    connectDrive();
  };

  const handleDisconnectDrive = async () => {
    if (disconnecting) return;
    setDisconnecting(true);
    const ok = await disconnectDrive();
    setDisconnecting(false);
    if (ok) {
      setDrive((d) => ({ ...d, connected: false, email: "" }));
      toast.success("Google Drive disconnected.");
    } else {
      toast.error("Couldn't disconnect Google Drive.");
    }
  };

  const openTab = (tab) => {
    setOpenKey(null);
    setTab(tab);
  };

  const driveDetail = drive.loading
    ? "Checking the link…"
    : !drive.configured
      ? "Add the GOOGLE_* env vars on the server to enable it."
      : drive.connected
        ? `Linked as ${drive.email || "your Google account"}`
        : "Not linked — connect to import from Drive.";

  const driveActions = (compact) =>
    drive.loading ? (
      <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
    ) : drive.connected ? (
      <>
        <Button
          size={compact ? "sm" : "default"}
          className={PRIMARY_BUTTON}
          onClick={() => openTab(DRIVE_IMPORT_TAB)}
        >
          <Download className="h-4 w-4" />
          Import files
        </Button>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          disabled={disconnecting}
          className="border-border bg-transparent text-muted-foreground hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          onClick={handleDisconnectDrive}
        >
          {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
          Disconnect
        </Button>
      </>
    ) : (
      <Button
        size={compact ? "sm" : "default"}
        disabled={!drive.configured}
        className={PRIMARY_BUTTON}
        onClick={handleConnectDrive}
      >
        <Plug className="h-4 w-4" />
        Connect
      </Button>
    );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Integrations"
        description="Connect the tools your team already works in — pull files in from storage and wire the library into the rest of your stack."
        actions={
          <Button
            variant="outline"
            className={OUTLINE_BUTTON}
            onClick={() => setTab("API Keys")}
          >
            <KeyRound className="h-4 w-4" />
            API keys
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <SectionCard
        title="Your connections"
        description="Live today — link an account or open a built-in surface."
        contentClassName="py-0"
      >
        {liveProviders.map((provider) =>
          provider.kind === "oauth" ? (
            <ConnectionRow
              key={provider.key}
              provider={provider}
              status={statusOf(provider, drive)}
              detail={driveDetail}
            >
              {driveActions(true)}
            </ConnectionRow>
          ) : (
            <ConnectionRow
              key={provider.key}
              provider={provider}
              status="built_in"
              detail={provider.tagline}
            >
              <Button
                variant="outline"
                size="sm"
                className={OUTLINE_BUTTON}
                onClick={() => openTab(provider.tab)}
              >
                Open {provider.name}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </ConnectionRow>
          ),
        )}
      </SectionCard>

      <Toolbar>
        <div className="min-w-0">
          <ToolbarTabs tabs={INTEGRATION_CATEGORY_TABS} value={category} onChange={setCategory} />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search integrations…" />
      </Toolbar>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Plug}
            title="No integrations match your filters"
            description="Try a different search or category."
            action={
              <Button variant="outline" className={OUTLINE_BUTTON} onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.category}>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
                <span className="text-xs text-text-tertiary">
                  {group.items.length} integration{group.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.items.map((provider) => (
                  <IntegrationCard
                    key={provider.key}
                    provider={provider}
                    status={statusOf(provider, drive)}
                    onOpen={(p) => setOpenKey(p.key)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <DetailSheet
        open={!!open}
        onOpenChange={(isOpen) => !isOpen && setOpenKey(null)}
        media={open ? <BrandTile provider={open} size="lg" /> : null}
        title={open?.name}
        subtitle={open ? INTEGRATION_CATEGORY_MAP[open.category] : ""}
        meta={openStatus ? <StatusPill status={openStatus} map={INTEGRATION_STATUS_MAP} /> : null}
        footer={
          open ? (
            open.kind === "oauth" ? (
              driveActions(false)
            ) : open.kind === "builtin" ? (
              <Button className={PRIMARY_BUTTON} onClick={() => openTab(open.tab)}>
                Open {open.name}
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button disabled className={PRIMARY_BUTTON}>
                Coming soon
              </Button>
            )
          ) : null
        }
      >
        {open ? (
          <>
            <p className="text-sm leading-6 text-text-secondary">{open.tagline}</p>

            <SheetSection title={open.kind === "planned" ? "What it will do" : "What you can do"}>
              <ul className="space-y-2.5">
                {open.capabilities.map((cap) => (
                  <li key={cap} className="flex items-start gap-2.5 text-sm text-foreground">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    </span>
                    {cap}
                  </li>
                ))}
              </ul>
            </SheetSection>

            {open.kind === "oauth" ? (
              <SheetSection title="Connection">
                <div className="rounded-lg border border-border bg-surface-card p-4">
                  <p className="text-sm text-foreground">{driveDetail}</p>
                  {open.access ? (
                    <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-text-secondary">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      {open.access}
                    </p>
                  ) : null}
                </div>
              </SheetSection>
            ) : null}

            {open.kind === "planned" ? (
              <Notice>This one is scoped but not built yet, so it can&apos;t be connected today.</Notice>
            ) : null}
          </>
        ) : null}
      </DetailSheet>
    </MainScreenWrapper>
  );
}

export default IntegrationsScreen;
