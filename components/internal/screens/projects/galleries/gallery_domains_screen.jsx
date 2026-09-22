"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Globe,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { ActionMenu } from "@geiger/ui/action-menu";
import { Input } from "@geiger/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
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
import {
  DOMAIN_KIND_OPTIONS,
  DOMAIN_STATUS_META,
  SSL_STATUS_META,
  formatDate,
} from "./constants";
import {
  createGalleryDomain,
  deleteGalleryDomain,
  listGalleryDomains,
  listGalleries,
  mintVerification,
  updateGalleryDomain,
} from "@/lib/supabase/galleries";
import { getUser } from "@/lib/supabase/user";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "verifying", label: "Verifying" },
  { value: "active", label: "Active" },
  { value: "failed", label: "Failed" },
];

const EMPTY_DRAFT = { hostname: "", kind: "subdomain", galleryId: "" };

/** `example.com`, `gallery.example.com` — no scheme, no path, no spaces. */
function isValidHostname(value) {
  return /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i.test(String(value || "").trim());
}

function AddDomainDialog({ open, onOpenChange, onAdd, galleries }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const close = (next) => {
    if (!next) setDraft(EMPTY_DRAFT);
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
          : "Enter a hostname like gallery.example.com.",
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
          <DialogTitle>Add domain</DialogTitle>
          <DialogDescription>
            Host galleries on your own address instead of the default /g/ path.
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
            hint={subdomain ? `Will be served at ${host || "…"}.` : "No scheme, no trailing path."}
          >
            <div className="flex items-center gap-2">
              <Input
                value={draft.hostname}
                onChange={(e) => set("hostname")(e.target.value)}
                placeholder={subdomain ? "studio-nine" : "gallery.example.com"}
                className="bg-surface-card"
              />
              {subdomain ? (
                <span className="shrink-0 text-xs text-text-tertiary">.geiger.gallery</span>
              ) : null}
            </div>
          </Field>

          <Field
            label="Bind to gallery"
            hint="Leave unset to make it available to every gallery in this project."
          >
            <Select value={draft.galleryId} onValueChange={set("galleryId")}>
              <SelectTrigger className="bg-surface-card">
                <SelectValue placeholder="Project-wide" />
              </SelectTrigger>
              <SelectContent>
                {galleries.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No galleries yet
                  </SelectItem>
                ) : (
                  galleries.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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

export function GalleryDomainsScreen({ projectId }) {
  const [domains, setDomains] = useState([]);
  const [galleries, setGalleries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listGalleryDomains(projectId), listGalleries(projectId)]).then(
      ([d, g]) => {
        if (!alive) return;
        setDomains(d ?? []);
        setGalleries(g ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const galleryName = useMemo(() => {
    const map = new Map(galleries.map((g) => [g.id, g.name]));
    return (id) => (id ? map.get(id) || "Unknown gallery" : "Project-wide");
  }, [galleries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return domains
      .filter((d) => !q || d.hostname.toLowerCase().includes(q))
      .filter((d) => statusFilter === "all" || d.status === statusFilter);
  }, [domains, search, statusFilter]);

  const selected = useMemo(
    () => domains.find((d) => d.id === selectedId) || null,
    [domains, selectedId],
  );

  const stats = useMemo(() => {
    const active = domains.filter((d) => d.status === "active").length;
    const pending = domains.filter((d) => d.status === "pending" || d.status === "verifying").length;
    const secured = domains.filter((d) => d.sslStatus === "issued").length;
    return [
      { label: "Domains", value: String(domains.length), footer: "in this project" },
      { label: "Active", value: String(active), footer: "serving galleries" },
      { label: "Awaiting DNS", value: String(pending), footer: "not verified yet" },
      { label: "Secured", value: String(secured), footer: "certificate issued" },
    ];
  }, [domains]);

  const handleAdd = async (draft) => {
    const id = crypto.randomUUID();
    const user = await getUser();
    const payload = {
      id,
      projectId,
      createdBy: user?.id || null,
      galleryId: draft.galleryId || null,
      hostname: draft.hostname,
      kind: draft.kind,
      ...mintVerification(draft.hostname),
      // A Geiger subdomain needs no customer DNS, so it lands active with a
      // certificate; a custom domain starts unverified.
      status: draft.kind === "subdomain" ? "active" : "pending",
      sslStatus: draft.kind === "subdomain" ? "issued" : "none",
      isPrimary: domains.length === 0,
    };
    const now = new Date().toISOString();
    setDomains((rows) => [{ ...payload, verifiedAt: null, createdAt: now, updatedAt: now }, ...rows]);
    const created = await createGalleryDomain(payload);
    if (created) {
      setDomains((rows) => rows.map((d) => (d.id === id ? created : d)));
      setSelectedId(id);
      toast.success(`${created.hostname} added.`);
    } else {
      setDomains((rows) => rows.filter((d) => d.id !== id));
      toast.error("Couldn't add the domain.");
    }
  };

  /**
   * Simulated verification. This does NOT perform a DNS lookup or issue a
   * certificate — it moves the record through verifying -> active so the
   * workflow is complete end to end. Wire a real resolver (and the platform's
   * domains API for SSL) before treating an "active" domain as actually served.
   */
  const handleVerify = async (domain) => {
    setVerifyingId(domain.id);
    const verifying = await updateGalleryDomain(domain.id, { status: "verifying" });
    if (verifying) setDomains((rows) => rows.map((d) => (d.id === domain.id ? verifying : d)));

    const patch = {
      status: "active",
      sslStatus: "issued",
      verifiedAt: new Date().toISOString(),
    };
    const updated = await updateGalleryDomain(domain.id, patch);
    setVerifyingId(null);
    if (updated) {
      setDomains((rows) => rows.map((d) => (d.id === domain.id ? updated : d)));
      toast.success(`${domain.hostname} verified.`);
    } else {
      setDomains((rows) =>
        rows.map((d) => (d.id === domain.id ? { ...d, status: "failed" } : d)),
      );
      toast.error("Couldn't verify the domain.");
    }
  };

  const handleSetPrimary = async (domain) => {
    const prev = domains;
    setDomains((rows) => rows.map((d) => ({ ...d, isPrimary: d.id === domain.id })));
    const results = await Promise.all(
      prev.map((d) =>
        d.isPrimary === (d.id === domain.id)
          ? true
          : updateGalleryDomain(d.id, { isPrimary: d.id === domain.id }),
      ),
    );
    if (results.every(Boolean)) toast.success(`${domain.hostname} is now primary.`);
    else {
      setDomains(prev);
      toast.error("Couldn't change the primary domain.");
    }
  };

  const handleDelete = async (domain) => {
    const prev = domains;
    setDomains((rows) => rows.filter((d) => d.id !== domain.id));
    if (selectedId === domain.id) setSelectedId(null);
    const ok = await deleteGalleryDomain(domain.id);
    if (ok) toast.success(`${domain.hostname} removed.`);
    else {
      setDomains(prev);
      toast.error("Couldn't remove the domain.");
    }
  };

  const columns = [
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
              <p className="max-w-[220px] truncate text-sm font-medium text-foreground">
                {d.hostname}
              </p>
              {d.isPrimary ? (
                <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
              ) : null}
            </div>
            <p className="max-w-[240px] truncate text-[11px] text-text-tertiary">
              {galleryName(d.galleryId)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (d) => (
        <StatusPill status={d.status} map={DOMAIN_STATUS_META} className="text-[10px]" />
      ),
    },
    {
      key: "ssl",
      header: "SSL",
      render: (d) => (
        <Badge className={cn("border px-1.5 py-0 text-[10px]", SSL_STATUS_META[d.sslStatus]?.className)}>
          <Lock className="mr-1 h-2.5 w-2.5" />
          {SSL_STATUS_META[d.sslStatus]?.label || d.sslStatus}
        </Badge>
      ),
    },
    {
      key: "verified",
      header: "Verified",
      className: "text-xs text-text-secondary hidden lg:table-cell",
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
              {
                icon: Trash2,
                label: "Remove",
                destructive: true,
                onSelect: () => handleDelete(d),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Gallery Domains"
        description="Serve galleries from your own branded address."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="h-4 w-4" />
            Add Domain
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <FilterDropdown
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={STATUS_FILTER_OPTIONS}
          placeholder="Status"
          icon={Globe}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search domains..."
          className="w-full sm:w-64"
        />
      </Toolbar>

      {loading ? (
        <LoadingArea panel size={56} />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(d) => d.id}
          onRowClick={(d) => setSelectedId(d.id === selectedId ? null : d.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={Globe}
                title={domains.length === 0 ? "No domains yet" : "No matching domains"}
                description={
                  domains.length === 0
                    ? "Add a Geiger subdomain, or point your own hostname at your galleries."
                    : "Try a different search or status filter."
                }
                action={
                  domains.length === 0 ? (
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => setShowAdd(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Add Domain
                    </Button>
                  ) : null
                }
              />
            </div>
          }
        />
      )}

      {selected ? (
        <SectionCard
          title={`DNS for ${selected.hostname}`}
          description={
            selected.kind === "subdomain"
              ? "Geiger subdomains need no DNS changes — this record is kept for reference."
              : "Publish this record with your DNS provider, then verify."
          }
          action={
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
          }
        >
          <DnsInstructions domain={selected} />
          <p className="mt-3 text-[11px] text-text-tertiary">
            Verification is simulated in this build — it records the result without performing a
            DNS lookup or issuing a certificate.
          </p>
        </SectionCard>
      ) : null}

      <AddDomainDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        onAdd={handleAdd}
        galleries={galleries}
      />
    </MainScreenWrapper>
  );
}

export default GalleryDomainsScreen;
