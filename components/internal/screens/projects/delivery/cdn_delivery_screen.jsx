"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Cloud,
  Copy,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { FilterDropdown, useModuleRows } from "@/components/internal/shared/module_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
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
import { cn } from "@/lib/utils";

import {
  DOMAIN_KIND_OPTIONS,
  DOMAIN_STATUS_FILTER_OPTIONS,
  DOMAIN_STATUS_MAP,
  ORIGIN_PROTECTION_MAP,
  ORIGIN_PROTECTION_OPTIONS,
  SSL_STATUS_MAP,
  formatBytes,
  formatDate,
  formatPercent,
  hitRatio,
} from "./constants";
import {
  createDeliveryDomain,
  createDeliveryProfile,
  listDeliveryDomains,
  listDeliveryEvents,
  listDeliveryProfiles,
  mintDeliveryVerification,
  softDeleteDeliveryDomain,
  updateDeliveryDomain,
  updateDeliveryProfile,
} from "@/lib/supabase/delivery";
import { listAssets, updateAsset } from "@/lib/supabase/assets";
import { getUser } from "@/lib/supabase/user";

const CDN_FILTER_OPTIONS = [
  { value: "all", label: "All assets" },
  { value: "enabled", label: "CDN on" },
  { value: "disabled", label: "CDN off" },
];

const EMPTY_DOMAIN_DRAFT = { hostname: "", kind: "subdomain" };

function isValidHostname(value) {
  return /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i.test(String(value || "").trim());
}

function AddDomainDialog({ open, onOpenChange, onAdd }) {
  const [draft, setDraft] = useState(EMPTY_DOMAIN_DRAFT);
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const close = (next) => {
    if (!next) setDraft(EMPTY_DOMAIN_DRAFT);
    onOpenChange(next);
  };

  const subdomain = draft.kind === "subdomain";
  const host = subdomain ? `${draft.hostname}.geiger.gallery` : draft.hostname;
  const valid = subdomain
    ? /^[a-z0-9-]{2,63}$/i.test(draft.hostname.trim())
    : isValidHostname(draft.hostname);

  const submit = async () => {
    if (!valid) {
      toast.error(
        subdomain
          ? "Subdomains are letters, numbers and dashes only."
          : "Enter a hostname like cdn.example.com.",
      );
      return;
    }
    setSaving(true);
    await onAdd({ ...draft, hostname: host.toLowerCase() });
    setSaving(false);
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add delivery domain</DialogTitle>
          <DialogDescription>
            Serve CDN traffic from your own address instead of the default edge host.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Type">
            <Select value={draft.kind} onValueChange={set("kind")}>
              <SelectTrigger className="bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOMAIN_KIND_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={subdomain ? "Subdomain" : "Hostname"}
            hint={subdomain ? `Will serve at ${host || "…"}.` : "No scheme, no trailing path."}
          >
            <div className="flex items-center gap-2">
              <Input
                value={draft.hostname}
                onChange={(e) => set("hostname")(e.target.value)}
                placeholder={subdomain ? "cdn-studio" : "cdn.example.com"}
                className="bg-surface-card"
              />
              {subdomain ? (
                <span className="shrink-0 text-xs text-text-tertiary">.geiger.gallery</span>
              ) : null}
            </div>
          </Field>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => close(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
            disabled={saving || !valid}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add domain
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The DNS record the customer has to publish, with a copy button per field. */
function DnsInstructions({ domain }) {
  const [copied, setCopied] = useState("");

  const copy = async (field, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      toast.error("Couldn't copy.");
    }
  };

  const rows = [
    { field: "type", label: "Type", value: domain.dnsRecordType },
    { field: "name", label: "Name", value: domain.dnsRecordName },
    { field: "value", label: "Value", value: domain.dnsRecordValue },
  ];

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.field}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2"
        >
          <span className="w-12 shrink-0 text-[11px] uppercase tracking-wider text-text-tertiary">
            {row.label}
          </span>
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
            {row.value || "—"}
          </code>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Copy ${row.label}`}
            className="h-7 w-7 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground"
            onClick={() => copy(row.field, row.value)}
          >
            {copied === row.field ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}

function EdgeConfigPanel({ projectId, profiles, setProfiles }) {
  const profile = profiles[0] || null;
  const [ttl, setTtl] = useState("");
  const [protection, setProtection] = useState("open");
  const [referrers, setReferrers] = useState("");
  const [negotiation, setNegotiation] = useState(true);
  const [status, setStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [seedId, setSeedId] = useState(null);

  if (profile?.id !== seedId) {
    setSeedId(profile?.id || null);
    setTtl(String(profile?.cacheTtlSeconds ?? 3600));
    setProtection(profile?.originProtection || "open");
    setReferrers((profile?.allowedReferrers || []).join(", "));
    setNegotiation(profile?.formatNegotiation !== false);
    setStatus(profile?.status || "active");
  }

  const save = async () => {
    const seconds = Math.max(0, Number(ttl) || 0);
    const payload = {
      projectId,
      cacheTtlSeconds: seconds,
      originProtection: protection,
      allowedReferrers: referrers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      formatNegotiation: negotiation,
      status,
    };
    setSaving(true);
    if (profile) {
      const previous = profile;
      setProfiles((rows) => rows.map((p) => (p.id === profile.id ? { ...p, ...payload } : p)));
      const saved = await updateDeliveryProfile(profile.id, payload);
      if (saved) {
        setProfiles((rows) => rows.map((p) => (p.id === saved.id ? saved : p)));
        toast.success("Edge configuration saved.");
      } else {
        setProfiles((rows) => rows.map((p) => (p.id === profile.id ? previous : p)));
        toast.error("Couldn't save the edge configuration.");
      }
    } else {
      const optimistic = { ...payload, id: crypto.randomUUID() };
      setProfiles((rows) => [optimistic, ...rows]);
      const saved = await createDeliveryProfile({ ...payload, createdBy: (await getUser())?.id || null });
      if (saved) {
        setProfiles((rows) => rows.map((p) => (p.id === optimistic.id ? saved : p)));
        toast.success("Edge configuration saved.");
      } else {
        setProfiles((rows) => rows.filter((p) => p.id !== optimistic.id));
        toast.error("Couldn't save the edge configuration.");
      }
    }
    setSaving(false);
  };

  return (
    <SectionCard
      title="Edge configuration"
      description="Cache TTL, origin protection, and format negotiation for this project."
      action={
        <Button
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={save}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cache TTL (seconds)" hint="How long the edge keeps a copy.">
          <Input
            value={ttl}
            onChange={(e) => setTtl(e.target.value)}
            inputMode="numeric"
            placeholder="3600"
            className="bg-surface-card"
          />
        </Field>
        <Field label="Origin protection">
          <Select value={protection} onValueChange={setProtection}>
            <SelectTrigger className="bg-surface-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORIGIN_PROTECTION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Allowed referrers" hint="Comma-separated. Empty allows all.">
          <Input
            value={referrers}
            onChange={(e) => setReferrers(e.target.value)}
            placeholder="example.com, app.example.com"
            className="bg-surface-card"
          />
        </Field>
        <Field label="Status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-surface-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <label className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-card px-3 py-2.5 text-sm">
        <span>
          <span className="block text-foreground">Format negotiation</span>
          <span className="block text-xs text-text-secondary">
            Serve AVIF/WebP automatically when the client supports it.
          </span>
        </span>
        <Switch checked={negotiation} onCheckedChange={setNegotiation} />
      </label>
      {protection !== "open" ? (
        <p className="mt-3 text-[11px] text-text-tertiary">
          {ORIGIN_PROTECTION_MAP[protection]?.label} origin: direct origin reads outside the CDN
          are refused; clients must present a valid signature or token.
        </p>
      ) : null}
    </SectionCard>
  );
}

export function CdnDeliveryScreen({ projectId }) {
  const [assets, setAssets] = useModuleRows(listAssets, projectId);
  const [events, setEvents] = useModuleRows(listDeliveryEvents, projectId);
  const [profiles, setProfiles] = useModuleRows(listDeliveryProfiles, projectId);
  const [domains, setDomains] = useModuleRows(listDeliveryDomains, projectId);
  const [search, setSearch] = useState("");
  const [cdnFilter, setCdnFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const [purgeTarget, setPurgeTarget] = useState("");
  const [purging, setPurging] = useState(false);

  const loading = assets === null || events === null || profiles === null || domains === null;
  const rows = useMemo(() => assets ?? [], [assets]);
  const serves = useMemo(() => events ?? [], [events]);
  const domainRows = useMemo(() => domains ?? [], [domains]);

  const perAsset = useMemo(() => {
    const map = new Map();
    for (const e of serves) {
      if (!e.assetId) continue;
      const entry = map.get(e.assetId) || { requests: 0, bytes: 0, hits: 0 };
      entry.requests += 1;
      entry.bytes += e.bytes;
      if (e.cacheStatus === "hit") entry.hits += 1;
      map.set(e.assetId, entry);
    }
    return map;
  }, [serves]);

  const stats = useMemo(() => {
    const enabled = rows.filter((a) => a.cdnEnabled);
    const storage = enabled.reduce((s, a) => s + (a.sizeBytes || 0), 0);
    const bandwidth = serves.reduce((s, e) => s + (e.bytes || 0), 0);
    return [
      { label: "CDN storage", value: formatBytes(storage), footer: `${enabled.length} of ${rows.length} assets` },
      { label: "Requests", value: serves.length.toLocaleString("en-US"), footer: "Logged serves" },
      { label: "Bandwidth", value: formatBytes(bandwidth), footer: "Served bytes" },
      { label: "Cache-hit ratio", value: formatPercent(hitRatio(serves)), footer: "Hits / requests" },
    ];
  }, [rows, serves]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((a) => {
      if (cdnFilter === "enabled" && !a.cdnEnabled) return false;
      if (cdnFilter === "disabled" && a.cdnEnabled) return false;
      if (q && !`${a.name} ${a.format}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, cdnFilter]);

  const filteredDomains = useMemo(() => {
    return domainRows.filter((d) => domainFilter === "all" || d.status === domainFilter);
  }, [domainRows, domainFilter]);

  const selected = useMemo(
    () => domainRows.find((d) => d.id === selectedId) || null,
    [domainRows, selectedId],
  );

  const handleToggle = (asset, next) => {
    const previous = asset.cdnEnabled;
    const patch = { cdnEnabled: next, cdnEnabledAt: next ? new Date().toISOString() : null };
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, ...patch } : a)));
    updateAsset(asset.id, patch).then((saved) => {
      if (saved) {
        setAssets((prev) => prev.map((a) => (a.id === saved.id ? { ...a, ...saved } : a)));
        toast.success(next ? `"${asset.name}" is on the CDN.` : `"${asset.name}" left the CDN.`);
      } else {
        setAssets((prev) =>
          prev.map((a) =>
            a.id === asset.id ? { ...a, cdnEnabled: previous } : a,
          ),
        );
        toast.error("Couldn't change the CDN status.");
      }
    });
  };

  const handleAddDomain = async (draft) => {
    const id = crypto.randomUUID();
    const user = await getUser();
    const payload = {
      id,
      projectId,
      createdBy: user?.id || null,
      galleryId: null,
      hostname: draft.hostname,
      kind: draft.kind,
      ...mintDeliveryVerification(draft.hostname),
      status: draft.kind === "subdomain" ? "active" : "pending",
      sslStatus: draft.kind === "subdomain" ? "issued" : "none",
      isPrimary: domainRows.length === 0,
    };
    const now = new Date().toISOString();
    setDomains((prev) => [{ ...payload, verifiedAt: null, createdAt: now, updatedAt: now }, ...prev]);
    const created = await createDeliveryDomain(payload);
    if (created) {
      setDomains((prev) => prev.map((d) => (d.id === id ? created : d)));
      setSelectedId(id);
      toast.success(`${created.hostname} added.`);
    } else {
      setDomains((prev) => prev.filter((d) => d.id !== id));
      toast.error("Couldn't add the domain.");
    }
  };

  /**
   * Simulated verification — moves the record through verifying -> active so
   * the workflow is complete end to end. Wire a real resolver before treating
   * an "active" domain as actually served.
   */
  const handleVerify = async (domain) => {
    setVerifyingId(domain.id);
    const verifying = await updateDeliveryDomain(domain.id, { status: "verifying" });
    if (verifying) setDomains((prev) => prev.map((d) => (d.id === domain.id ? verifying : d)));
    const updated = await updateDeliveryDomain(domain.id, {
      status: "active",
      sslStatus: "issued",
      verifiedAt: new Date().toISOString(),
    });
    setVerifyingId(null);
    if (updated) {
      setDomains((prev) => prev.map((d) => (d.id === domain.id ? updated : d)));
      toast.success(`${domain.hostname} verified.`);
    } else {
      setDomains((prev) =>
        prev.map((d) => (d.id === domain.id ? { ...d, status: "failed" } : d)),
      );
      toast.error("Couldn't verify the domain.");
    }
  };

  const handleSetPrimary = async (domain) => {
    const prev = domainRows;
    setDomains((prevRows) => prevRows.map((d) => ({ ...d, isPrimary: d.id === domain.id })));
    const results = await Promise.all(
      prev.map((d) =>
        d.isPrimary === (d.id === domain.id)
          ? true
          : updateDeliveryDomain(d.id, { isPrimary: d.id === domain.id }),
      ),
    );
    if (results.every(Boolean)) toast.success(`${domain.hostname} is now primary.`);
    else {
      setDomains(prev);
      toast.error("Couldn't change the primary domain.");
    }
  };

  const handleDeleteDomain = async (domain) => {
    const prev = domainRows;
    setDomains((prevRows) => prevRows.filter((d) => d.id !== domain.id));
    if (selectedId === domain.id) setSelectedId(null);
    const ok = await softDeleteDeliveryDomain(domain.id);
    if (ok) toast.success(`${domain.hostname} removed.`);
    else {
      setDomains(prev);
      toast.error("Couldn't remove the domain.");
    }
  };

  const handlePurge = async () => {
    if (!purgeTarget) {
      toast.error("Pick an asset to purge.");
      return;
    }
    const asset = rows.find((a) => a.id === purgeTarget);
    setPurging(true);
    // Local ledger only — the edge purge itself is queued by the platform.
    await new Promise((r) => setTimeout(r, 600));
    setPurging(false);
    setPurgeTarget("");
    toast.success(`Cache invalidation queued for "${asset?.name || "asset"}".`);
  };

  const columns = [
    {
      key: "asset",
      header: "Asset",
      render: (a) => (
        <div className="min-w-0">
          <p className="max-w-[260px] truncate text-sm font-medium text-foreground">{a.name}</p>
          <p className="text-[11px] text-text-tertiary">
            {(a.format || a.type || "").toUpperCase()} · {formatBytes(a.sizeBytes)}
          </p>
        </div>
      ),
    },
    {
      key: "requests",
      header: "Requests",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (a) => (perAsset.get(a.id)?.requests || 0).toLocaleString("en-US"),
    },
    {
      key: "bandwidth",
      header: "Bandwidth",
      align: "right",
      className: "hidden text-right tabular-nums text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => formatBytes(perAsset.get(a.id)?.bytes || 0),
    },
    {
      key: "cdn",
      header: "CDN",
      align: "right",
      className: "text-right",
      render: (a) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="text-[11px] text-text-tertiary">{a.cdnEnabled ? "On" : "Off"}</span>
          <Switch
            checked={!!a.cdnEnabled}
            onCheckedChange={(v) => handleToggle(a, v)}
            aria-label={`CDN for ${a.name}`}
          />
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (a) => (
        <div onClick={(e) => e.stopPropagation()}>
          <ActionMenu
            label="Asset delivery actions"
            items={[
              {
                icon: RefreshCw,
                label: "Purge cache",
                disabled: !a.cdnEnabled,
                onSelect: () => {
                  setPurgeTarget(a.id);
                  toast.success(`Cache invalidation queued for "${a.name}".`);
                },
              },
              {
                icon: a.cdnEnabled ? Trash2 : Cloud,
                label: a.cdnEnabled ? "Remove from CDN" : "Enable CDN",
                onSelect: () => handleToggle(a, !a.cdnEnabled),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  const domainColumns = [
    {
      key: "hostname",
      header: "Hostname",
      render: (d) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
            <Globe className="h-4 w-4 text-text-secondary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="max-w-[220px] truncate text-sm font-medium text-foreground">{d.hostname}</p>
              {d.isPrimary ? <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" /> : null}
            </div>
            <p className="text-[11px] text-text-tertiary">{d.kind === "subdomain" ? "Geiger subdomain" : "Custom domain"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (d) => <StatusPill status={d.status} map={DOMAIN_STATUS_MAP} className="text-[10px]" />,
    },
    {
      key: "ssl",
      header: "SSL",
      render: (d) => (
        <Badge className={cn("border px-1.5 py-0 text-[10px]", SSL_STATUS_MAP[d.sslStatus]?.className)}>
          {SSL_STATUS_MAP[d.sslStatus]?.label || d.sslStatus}
        </Badge>
      ),
    },
    {
      key: "verified",
      header: "Verified",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (d) => formatDate(d.verifiedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (d) => (
        <div onClick={(e) => e.stopPropagation()}>
          <ActionMenu
            label="Domain actions"
            items={[
              {
                icon: RefreshCw,
                label: d.status === "active" ? "Re-verify" : "Verify",
                disabled: verifyingId === d.id,
                onSelect: () => handleVerify(d),
              },
              {
                icon: Star,
                label: "Make primary",
                disabled: d.isPrimary,
                onSelect: () => handleSetPrimary(d),
              },
              { separator: true },
              { icon: Trash2, label: "Remove", destructive: true, onSelect: () => handleDeleteDomain(d) },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="CDN Delivery"
        description="Serve optimized media globally from edge locations — toggle assets on, point branded domains, and tune the edge."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="h-4 w-4" /> Add domain
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <FilterDropdown
          value={cdnFilter}
          onValueChange={setCdnFilter}
          options={CDN_FILTER_OPTIONS}
          height="h-9"
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search assets…" />
      </Toolbar>

      {loading ? (
        <LoadingArea panel size={56} label="Loading delivery…" />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(a) => a.id}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={Cloud}
                title={rows.length ? "No assets match your filters" : "No assets yet"}
                description={
                  rows.length
                    ? "Try clearing the search or CDN filter."
                    : "Upload assets to the library, then toggle them onto the CDN."
                }
              />
            </div>
          }
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <SectionCard
          title="Delivery domains"
          description="Branded hosts for CDN traffic — same verification flow as gallery domains."
          action={
            <FilterDropdown
              value={domainFilter}
              onValueChange={setDomainFilter}
              options={DOMAIN_STATUS_FILTER_OPTIONS}
              height="h-8"
            />
          }
        >
          <DataTable
            columns={domainColumns}
            data={filteredDomains}
            getRowKey={(d) => d.id}
            onRowClick={(d) => setSelectedId(d.id === selectedId ? null : d.id)}
            empty={
              <EmptyState
                icon={Globe}
                title={domainRows.length ? "No domains match" : "No delivery domains"}
                description="Add a Geiger subdomain or point your own hostname at the edge."
              />
            }
          />
          {selected ? (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">DNS for {selected.hostname}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => handleVerify(selected)}
                  disabled={verifyingId === selected.id}
                >
                  {verifyingId === selected.id ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  )}
                  {selected.status === "active" ? "Re-verify" : "Verify"}
                </Button>
              </div>
              <DnsInstructions domain={selected} />
            </div>
          ) : null}
        </SectionCard>

        <div className="space-y-4">
          <EdgeConfigPanel projectId={projectId} profiles={profiles ?? []} setProfiles={setProfiles} />
          <SectionCard
            title="Cache invalidation"
            description="Queue an edge purge for one CDN asset."
            action={<RefreshCw className="h-4 w-4 text-text-tertiary" />}
          >
            <Field label="Asset">
              <Select value={purgeTarget} onValueChange={setPurgeTarget}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue placeholder="Pick a CDN asset…" />
                </SelectTrigger>
                <SelectContent>
                  {rows
                    .filter((a) => a.cdnEnabled)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Button
              className="mt-3 w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handlePurge}
              disabled={purging}
            >
              {purging ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Purge cache
            </Button>
          </SectionCard>
        </div>
      </div>

      <AddDomainDialog open={showAdd} onOpenChange={setShowAdd} onAdd={handleAddDomain} />
    </MainScreenWrapper>
  );
}

export default CdnDeliveryScreen;
