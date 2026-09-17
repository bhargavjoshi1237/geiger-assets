"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Cloud,
  Copy,
  Globe,
  Pencil,
  Plus,
  RotateCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Switch } from "@geiger/ui/switch";
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
  backendErrorMessage,
  listStorageBackends,
  testStorageBackend,
} from "@/lib/storage/backends_client";
import {
  createDeliveryDomain,
  listDeliveryDomains,
  softDeleteDeliveryDomain,
  updateDeliveryDomain,
} from "@/lib/supabase/delivery";
import {
  DOMAIN_FILTER_OPTIONS,
  DOMAIN_STATUS_MAP,
  EDGE_FILTER_OPTIONS,
  domainStatusOf,
  formatWhen,
} from "./constants";

// CDN Delivery — which backends serve through an edge origin, and which custom
// domains front them.
//
// Edge status is read off the backend record itself: a backend whose config
// names a CDN origin (`cdnBaseUrl`, defaulting to `publicBaseUrl` on REST)
// answers `publicUrl()` and delivery routes redirect there instead of proxying
// through Node. That is the `publicReads` capability from
// lib/storage/backends/contract.js — opt-in per backend, never inferred.
//
// Two things a CDN hop gives up (lib/storage/cdn.js) shape this screen: a
// viewer holding a CDN URL is not re-checked against project permissions, and
// CDN-served bytes never reach project_usage metering. Both are restated in
// the origin-protection card below so they are not discovered by surprise.

const EDGE_STATUS_MAP = {
  live: { label: "Edge", variant: "success", dotClass: "bg-emerald-400" },
  direct: { label: "Direct", variant: "neutral", dotClass: "bg-zinc-400" },
};

function edgeOriginOf(backend) {
  const config = backend?.config || {};
  const origin = config.cdnBaseUrl || config.publicBaseUrl || "";
  return typeof origin === "string" ? origin.trim() : "";
}

function endpointOf(backend) {
  const config = backend?.config || {};
  return config.endpoint || config.baseUrl || "";
}

const EMPTY_DOMAIN_DRAFT = {
  domain: "",
  backendId: "",
  isPrimary: false,
  edgeTtlSeconds: 3600,
  originProtection: true,
};

function DomainDialog({ open, onOpenChange, initial, backends, onSubmit }) {
  const editing = Boolean(initial);
  const [domain, setDomain] = useState(initial?.domain ?? "");
  const [backendId, setBackendId] = useState(initial?.backendId ?? "");
  const [isPrimary, setIsPrimary] = useState(initial?.isPrimary ?? false);
  const [ttl, setTtl] = useState(String(initial?.edgeTtlSeconds ?? 3600));
  const [originProtection, setOriginProtection] = useState(
    initial?.originProtection ?? true,
  );
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDomain(initial?.domain ?? "");
    setBackendId(initial?.backendId ?? "");
    setIsPrimary(initial?.isPrimary ?? false);
    setTtl(String(initial?.edgeTtlSeconds ?? 3600));
    setOriginProtection(initial?.originProtection ?? true);
    setBusy(false);
  }, [open, initial]);

  const submit = async () => {
    const name = domain.trim().toLowerCase();
    if (!name) {
      toast.error("Give the domain a hostname.");
      return;
    }
    if (name.includes(" ") || name.includes("/")) {
      toast.error("Use a bare hostname, without a path.");
      return;
    }
    const ttlSeconds = Math.floor(Number(ttl) || 0);
    if (ttlSeconds < 0) {
      toast.error("Edge TTL must be zero or more seconds.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      domain: name,
      backendId: backendId || null,
      isPrimary,
      edgeTtlSeconds: ttlSeconds,
      originProtection,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit delivery domain" : "Add delivery domain"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Point this hostname at the edge origin, then verify it once DNS has propagated.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Hostname" htmlFor="domain-name">
            <Input
              id="domain-name"
              className="bg-surface-card"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="cdn.example.com"
              autoFocus
            />
          </Field>
          <Field label="Fronts backend" htmlFor="domain-backend" hint="The origin this domain serves.">
            <Select value={backendId || "none"} onValueChange={(v) => setBackendId(v === "none" ? "" : v)}>
              <SelectTrigger id="domain-backend" className="bg-surface-card">
                <SelectValue placeholder="Choose a backend" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No backend yet</SelectItem>
                {backends.map((backend) => (
                  <SelectItem key={backend.id} value={backend.id}>
                    {backend.label || "Untitled backend"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Edge TTL (seconds)" htmlFor="domain-ttl" hint="How long the edge may cache one object.">
              <Input
                id="domain-ttl"
                className="bg-surface-card"
                inputMode="numeric"
                value={ttl}
                onChange={(e) => setTtl(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="3600"
              />
            </Field>
            <Field label="Primary domain" hint="The canonical hostname embeds use.">
              <div className="flex h-9 items-center">
                <Switch checked={isPrimary} onCheckedChange={setIsPrimary} aria-label="Primary domain" />
              </div>
            </Field>
          </div>
          <Field label="Origin protection" hint="Keep permission checks on the origin even when the edge is public.">
            <div className="flex h-9 items-center">
              <Switch checked={originProtection} onCheckedChange={setOriginProtection} aria-label="Origin protection" />
            </div>
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
            {editing ? "Save changes" : "Add domain"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CdnDeliveryScreen({ projectId }) {
  const [backends, setBackends] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [edgeFilter, setEdgeFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [purging, setPurging] = useState(null);
  const [testingId, setTestingId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listStorageBackends(projectId), listDeliveryDomains(projectId)]).then(
      ([backendRows, domainRows]) => {
        if (!alive) return;
        setBackends(backendRows ?? []);
        setDomains(domainRows ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const backendById = useMemo(() => {
    const map = new Map();
    for (const backend of backends) map.set(backend.id, backend);
    return map;
  }, [backends]);

  const stats = useMemo(() => {
    const edge = backends.filter((b) => edgeOriginOf(b) !== "").length;
    return [
      { label: "Backends", value: String(backends.length), footer: "providers configured" },
      { label: "Edge-enabled", value: String(edge), footer: "naming a CDN origin" },
      { label: "Custom domains", value: String(domains.length), footer: "hostnames fronting origins" },
      {
        label: "Verified",
        value: String(domains.filter((d) => d.verified).length),
        footer: "DNS confirmed by an operator",
      },
    ];
  }, [backends, domains]);

  const filteredBackends = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return backends.filter((backend) => {
      const edge = edgeOriginOf(backend) !== "";
      if (edgeFilter === "edge" && !edge) return false;
      if (edgeFilter === "direct" && edge) return false;
      if (
        needle &&
        !`${backend.label} ${backend.kind} ${endpointOf(backend)} ${edgeOriginOf(backend)}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [backends, search, edgeFilter]);

  const filteredDomains = useMemo(
    () =>
      domains.filter((domain) => {
        if (domainFilter !== "all" && domainStatusOf(domain) !== domainFilter) return false;
        return true;
      }),
    [domains, domainFilter],
  );

  const filtersActive = edgeFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setEdgeFilter("all");
    setSearch("");
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Copy failed — select the text manually.");
    }
  };

  const runTest = async (backend) => {
    if (backend.projectId === null) {
      toast.error("Suite-wide backends cannot be probed from here.");
      return;
    }
    setTestingId(backend.id);
    let code = null;
    const result = await testStorageBackend(backend.id, { onError: (c) => (code = c) });
    setTestingId(null);
    if (!result) {
      toast.error(backendErrorMessage(code, "Could not reach the backend."));
      return;
    }
    if (result.ok) {
      const latency = Number.isFinite(result.latencyMs) ? ` in ${Math.round(result.latencyMs)} ms` : "";
      toast.success(`${backend.label} answered${latency}.`);
    } else {
      toast.error(`${backend.label} failed: ${result.detail || "no detail"}`);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const submitDomain = async (draft) => {
    if (editing) {
      const previous = domains;
      setDomains((rows) => rows.map((d) => (d.id === editing.id ? { ...d, ...draft } : d)));
      const saved = await updateDeliveryDomain(editing.id, draft);
      if (!saved) {
        setDomains(previous);
        toast.error("Could not save the domain.");
        return false;
      }
      setDomains((rows) => rows.map((d) => (d.id === saved.id ? saved : d)));
      toast.success(`Saved ${saved.domain}.`);
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      verified: false,
      verifiedAt: null,
      lastPurgedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setDomains((rows) => [optimistic, ...rows]);
    const created = await createDeliveryDomain({ id, projectId, ...draft });
    if (!created) {
      setDomains((rows) => rows.filter((d) => d.id !== id));
      toast.error("Could not add the domain.");
      return false;
    }
    setDomains((rows) => rows.map((d) => (d.id === id ? created : d)));
    toast.success(`Added ${created.domain}.`);
    return true;
  };

  const removeDomain = async (domain) => {
    const previous = domains;
    setDomains((rows) => rows.filter((d) => d.id !== domain.id));
    const ok = await softDeleteDeliveryDomain(domain.id);
    if (!ok) {
      setDomains(previous);
      toast.error("Could not delete the domain.");
      return;
    }
    toast.success(`Deleted ${domain.domain}.`);
  };

  const confirmVerify = async () => {
    if (!verifying) return;
    const previous = domains;
    setDomains((rows) =>
      rows.map((d) =>
        d.id === verifying.id
          ? { ...d, verified: true, verifiedAt: new Date().toISOString() }
          : d,
      ),
    );
    const saved = await updateDeliveryDomain(verifying.id, {
      verified: true,
      verifiedAt: new Date().toISOString(),
    });
    if (!saved) {
      setDomains(previous);
      toast.error("Could not verify the domain.");
      return;
    }
    setDomains((rows) => rows.map((d) => (d.id === saved.id ? saved : d)));
    toast.success(`${saved.domain} verified.`);
    setVerifying(null);
  };

  const confirmPurge = async () => {
    if (!purging) return;
    const previous = domains;
    setDomains((rows) =>
      rows.map((d) =>
        d.id === purging.id ? { ...d, lastPurgedAt: new Date().toISOString() } : d,
      ),
    );
    const saved = await updateDeliveryDomain(purging.id, {
      lastPurgedAt: new Date().toISOString(),
    });
    if (!saved) {
      setDomains(previous);
      toast.error("Could not record the purge.");
      return;
    }
    setDomains((rows) => rows.map((d) => (d.id === saved.id ? saved : d)));
    toast.success(`Purge logged for ${saved.domain}.`);
    setPurging(null);
  };

  const setProtection = async (domain, originProtection) => {
    const previous = domains;
    setDomains((rows) => rows.map((d) => (d.id === domain.id ? { ...d, originProtection } : d)));
    const saved = await updateDeliveryDomain(domain.id, { originProtection });
    if (!saved) {
      setDomains(previous);
      toast.error("Could not change origin protection.");
      return;
    }
    setDomains((rows) => rows.map((d) => (d.id === saved.id ? saved : d)));
    toast.success(`Origin protection ${originProtection ? "on" : "off"} for ${saved.domain}.`);
  };

  const backendColumns = [
    {
      key: "backend",
      header: "Backend",
      render: (backend) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="max-w-[240px] truncate font-medium text-foreground">
              {backend.label || "Untitled backend"}
            </span>
            <Badge variant="neutral">{backend.kind || "unknown"}</Badge>
          </span>
          <span className="truncate text-xs text-text-secondary">
            {endpointOf(backend) || "No endpoint recorded"}
          </span>
        </div>
      ),
    },
    {
      key: "edge",
      header: "Edge",
      render: (backend) => {
        const origin = edgeOriginOf(backend);
        return (
          <div className="flex flex-col gap-1">
            <StatusPill status={origin ? "live" : "direct"} map={EDGE_STATUS_MAP} />
            <span className="max-w-[260px] truncate text-xs text-text-secondary">
              {origin || "Streams through the app"}
            </span>
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
        const origin = edgeOriginOf(backend);
        return (
          <ActionMenu
            label={`Actions for ${backend.label}`}
            items={[
              {
                icon: Cloud,
                label: testingId === backend.id ? "Probing…" : "Probe connection",
                spin: testingId === backend.id,
                disabled: backend.projectId === null || testingId === backend.id,
                onSelect: () => runTest(backend),
              },
              origin
                ? {
                    icon: Copy,
                    label: "Copy origin URL",
                    onSelect: () => copyText(origin, "Origin URL"),
                  }
                : null,
            ]}
          />
        );
      },
    },
  ];

  const domainColumns = [
    {
      key: "domain",
      header: "Domain",
      render: (domain) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="max-w-[240px] truncate font-medium text-foreground">{domain.domain}</span>
            {domain.isPrimary ? <Badge variant="info">Primary</Badge> : null}
          </span>
          <span className="truncate text-xs text-text-secondary">
            {domain.backendId ? backendById.get(domain.backendId)?.label || "Unknown backend" : "No backend assigned"}
            {` · edge TTL ${domain.edgeTtlSeconds}s`}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (domain) => (
        <div className="flex flex-col gap-1">
          <StatusPill status={domainStatusOf(domain)} map={DOMAIN_STATUS_MAP} />
          <span className="text-[11px] text-text-tertiary">
            Purged {formatWhen(domain.lastPurgedAt)}
          </span>
        </div>
      ),
    },
    {
      key: "protection",
      header: "Origin protection",
      align: "right",
      className: "text-right",
      render: (domain) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={domain.originProtection}
            aria-label={`Origin protection for ${domain.domain}`}
            onCheckedChange={(value) => setProtection(domain, value)}
          />
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (domain) => (
        <ActionMenu
          label={`Actions for ${domain.domain}`}
          items={[
            domain.verified
              ? null
              : {
                  icon: ShieldCheck,
                  label: "Verify DNS",
                  onSelect: () => setVerifying(domain),
                },
            {
              icon: RotateCw,
              label: "Log edge purge",
              onSelect: () => setPurging(domain),
            },
            {
              icon: Pencil,
              label: "Edit",
              onSelect: () => {
                setEditing(domain);
                setDialogOpen(true);
              },
            },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              destructive: true,
              onSelect: () => removeDomain(domain),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <MainScreenWrapper>
        <ScreenHeader
          title="CDN Delivery"
          description="Serve optimized media globally from edge locations."
          actions={
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" /> Add domain
            </Button>
          }
        />

        <StatsBar stats={stats} />

        <Toolbar>
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              value={edgeFilter}
              onValueChange={setEdgeFilter}
              options={EDGE_FILTER_OPTIONS}
              height="h-9"
            />
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search backends, endpoints, origins…"
          />
        </Toolbar>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
            <LogoLoading size={56} aria-label="Loading CDN delivery" />
          </div>
        ) : (
          <div className="space-y-8">
            <DataTable
              columns={backendColumns}
              data={filteredBackends}
              getRowKey={(backend) => backend.id}
              empty={
                <div className="rounded-xl border border-border bg-surface-subtle">
                  {filtersActive ? (
                    <EmptyState
                      icon={Cloud}
                      title="No backends match these filters"
                      description="Try a different edge state or search term."
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
                      icon={Cloud}
                      title="No storage backends yet"
                      description="Add a backend with a CDN origin to serve through the edge."
                    />
                  )}
                </div>
              }
            />

            <SectionCard
              title="Custom delivery domains"
              description="Hostnames that front an edge origin. Verification is an operator confirming the DNS record — the table records when that happened."
              action={
                <Button
                  variant="outline"
                  className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                  onClick={openCreate}
                >
                  <Plus className="h-4 w-4" /> Add domain
                </Button>
              }
            >
              <div className="flex flex-wrap items-center gap-2 pb-4">
                <FilterDropdown
                  value={domainFilter}
                  onValueChange={setDomainFilter}
                  options={DOMAIN_FILTER_OPTIONS}
                  height="h-9"
                />
              </div>
              <DataTable
                columns={domainColumns}
                data={filteredDomains}
                getRowKey={(domain) => domain.id}
                empty={
                  <EmptyState
                    icon={Globe}
                    title="No delivery domains yet"
                    description="Add the hostname your embeds and share links should serve from."
                    action={
                      <Button
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={openCreate}
                      >
                        <Plus className="h-4 w-4" /> Add domain
                      </Button>
                    }
                  />
                }
              />
            </SectionCard>

            <SectionCard
              title="Origin protection"
              description="What an edge hop gives up — restated from the CDN seam so it is a decision, not a surprise."
            >
              <ul className="list-disc space-y-2 pl-5 text-sm text-text-secondary">
                <li>
                  Naming an origin is opt-in publicity: once a viewer holds a CDN URL it is
                  fetchable by anyone it is shared with, because the edge does not re-check
                  project permissions. Keep origin protection on so the app still gates the
                  redirect.
                </li>
                <li>
                  Redirected bytes carry no body through the app, so they never reach delivery
                  metering. The CDN provider logs become the source of truth for edge volume;
                  only proxied bytes appear in Delivery Analytics.
                </li>
                <li>
                  Derivatives are content-addressed and immutable, so they never need purging.
                  Originals keep a short lifetime and revalidate instead — a purge here is
                  logged against the domain for the record.
                </li>
              </ul>
            </SectionCard>
          </div>
        )}

        <DomainDialog
          key={editing ? `domain:${editing.id}` : "domain:new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initial={editing}
          backends={backends.filter((b) => b.projectId !== null)}
          onSubmit={submitDomain}
        />

        <Dialog open={Boolean(verifying)} onOpenChange={(v) => !v && setVerifying(null)}>
          <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
            <DialogHeader>
              <DialogTitle>Verify {verifying?.domain}</DialogTitle>
              <DialogDescription className="text-sm text-text-secondary">
                Point a CNAME at the edge origin, wait for DNS to propagate, then confirm.
                Verification records your confirmation — it does not probe DNS itself.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-border bg-surface-card px-3 py-2 text-sm text-foreground">
              {verifying?.backendId && backendById.get(verifying.backendId)
                ? (edgeOriginOf(backendById.get(verifying.backendId)) || "No origin on that backend yet")
                : "Assign a backend first so there is an origin to point at."}
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setVerifying(null)}
              >
                Cancel
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={confirmVerify}
              >
                <ShieldCheck className="h-4 w-4" /> DNS is pointed
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(purging)} onOpenChange={(v) => !v && setPurging(null)}>
          <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
            <DialogHeader>
              <DialogTitle>Log edge purge for {purging?.domain}</DialogTitle>
              <DialogDescription className="text-sm text-text-secondary">
                Derivatives are immutable and need no purge; originals revalidate within the
                hour. Purge at your CDN provider, then log it here so the team can see when
                the edge was last flushed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setPurging(null)}
              >
                Cancel
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={confirmPurge}
              >
                <RotateCw className="h-4 w-4" /> Log purge
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </MainScreenWrapper>
    </TooltipProvider>
  );
}

export default CdnDeliveryScreen;
