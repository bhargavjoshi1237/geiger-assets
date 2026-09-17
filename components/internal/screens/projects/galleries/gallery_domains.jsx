"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Globe, Pencil, Plus, ShieldCheck, Star, Trash2 } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
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
  DOMAIN_SSL_FILTER_OPTIONS,
  DOMAIN_SSL_MAP,
  DOMAIN_TYPE_MAP,
  DOMAIN_VERIFICATION_FILTER_OPTIONS,
  DOMAIN_VERIFICATION_MAP,
  formatDate,
} from "./constants";
import {
  createGalleryDomain,
  listGalleryDomains,
  softDeleteGalleryDomain,
  updateGalleryDomain,
} from "@/lib/supabase/galleries";

// Gallery Domains — custom domains, subdomains, SSL state, SEO metadata,
// social previews, domain verification with a verify action.

const EMPTY_DRAFT = {
  domain: "",
  domainType: "custom",
  seoTitle: "",
  seoDescription: "",
  isPrimary: false,
};

const TYPE_OPTIONS = Object.entries(DOMAIN_TYPE_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

function DomainDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDraft({ ...EMPTY_DRAFT, ...(initial || {}) });
    setBusy(false);
  }, [open, initial]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    const domain = draft.domain.trim().toLowerCase();
    if (!domain) {
      toast.error("Give the domain a hostname.");
      return;
    }
    if (domain.includes(" ") || domain.includes("/")) {
      toast.error("Use a bare hostname, without a path.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      domain,
      domainType: draft.domainType,
      seoTitle: draft.seoTitle.trim(),
      seoDescription: draft.seoDescription.trim(),
      isPrimary: Boolean(draft.isPrimary),
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit domain" : "Add domain"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Point the hostname at your galleries, then verify it once DNS propagates.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Hostname" htmlFor="gallery-domain">
            <Input
              id="gallery-domain"
              className="bg-surface-card"
              value={draft.domain}
              onChange={(e) => set("domain")(e.target.value)}
              placeholder="gallery.example.com"
              autoFocus
            />
          </Field>
          <Field label="Type">
            <Select value={draft.domainType} onValueChange={set("domainType")}>
              <SelectTrigger className="bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="SEO title" htmlFor="domain-seo-title" hint="Shown in search results.">
            <Input
              id="domain-seo-title"
              className="bg-surface-card"
              value={draft.seoTitle}
              onChange={(e) => set("seoTitle")(e.target.value)}
              placeholder="Studio galleries"
            />
          </Field>
          <Field label="SEO description" htmlFor="domain-seo-desc" hint="Social preview text.">
            <Textarea
              id="domain-seo-desc"
              className="min-h-20 bg-surface-card"
              value={draft.seoDescription}
              onChange={(e) => set("seoDescription")(e.target.value)}
              placeholder="Browse client galleries and order prints…"
            />
          </Field>
          <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Primary domain</p>
              <p className="text-xs text-text-secondary">The canonical gallery hostname.</p>
            </div>
            <Switch
              checked={draft.isPrimary}
              onCheckedChange={set("isPrimary")}
              aria-label="Primary domain"
            />
          </div>
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

export function GalleryDomainsScreen({ projectId }) {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [sslFilter, setSslFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);

  useEffect(() => {
    let alive = true;
    listGalleryDomains(projectId).then((rows) => {
      if (!alive) return;
      setDomains(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const stats = useMemo(
    () => [
      { label: "Domains", value: String(domains.length), footer: "hostnames for galleries" },
      {
        label: "Verified",
        value: String(domains.filter((d) => d.verificationStatus === "verified").length),
        footer: "DNS confirmed",
      },
      {
        label: "SSL active",
        value: String(domains.filter((d) => d.sslStatus === "active").length),
        footer: "serving securely",
      },
      {
        label: "Primary",
        value: String(domains.filter((d) => d.isPrimary).length),
        footer: "canonical hostname",
      },
    ],
    [domains],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return domains.filter((domain) => {
      if (verificationFilter !== "all" && domain.verificationStatus !== verificationFilter)
        return false;
      if (sslFilter !== "all" && domain.sslStatus !== sslFilter) return false;
      if (
        needle &&
        !`${domain.domain} ${domain.seoTitle} ${domain.seoDescription}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [domains, search, verificationFilter, sslFilter]);

  const filtersActive =
    verificationFilter !== "all" || sslFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setVerificationFilter("all");
    setSslFilter("all");
    setSearch("");
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (domain) => {
    setEditing(domain);
    setDialogOpen(true);
  };

  const submitDomain = async (draft) => {
    if (editing) {
      const previous = domains;
      setDomains((rows) =>
        rows.map((d) => (d.id === editing.id ? { ...d, ...draft } : d)),
      );
      const saved = await updateGalleryDomain(editing.id, draft);
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
      sslStatus: "pending",
      verificationStatus: "unverified",
      verifiedAt: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setDomains((rows) => [optimistic, ...rows]);
    const created = await createGalleryDomain({ id, projectId, ...draft });
    if (!created) {
      setDomains((rows) => rows.filter((d) => d.id !== id));
      toast.error("Could not add the domain.");
      return false;
    }
    setDomains((rows) => rows.map((d) => (d.id === id ? created : d)));
    toast.success(`Added ${created.domain}.`);
    return true;
  };

  const verifyDomain = async (domain) => {
    setVerifyingId(domain.id);
    const previous = domains;
    const patch = {
      verificationStatus: "verified",
      sslStatus: "active",
      verifiedAt: new Date().toISOString(),
    };
    setDomains((rows) => rows.map((d) => (d.id === domain.id ? { ...d, ...patch } : d)));
    const saved = await updateGalleryDomain(domain.id, patch);
    setVerifyingId(null);
    if (!saved) {
      setDomains(previous);
      toast.error("Could not verify the domain.");
      return;
    }
    setDomains((rows) => rows.map((d) => (d.id === saved.id ? saved : d)));
    toast.success(`${saved.domain} verified.`);
  };

  const setPrimary = async (domain) => {
    const previous = domains;
    setDomains((rows) =>
      rows.map((d) => ({ ...d, isPrimary: d.id === domain.id })),
    );
    const saved = await updateGalleryDomain(domain.id, { isPrimary: true });
    if (!saved) {
      setDomains(previous);
      toast.error("Could not set the primary domain.");
      return;
    }
    setDomains((rows) =>
      rows.map((d) => (d.id === saved.id ? saved : { ...d, isPrimary: false })),
    );
    toast.success(`${saved.domain} is now primary.`);
  };

  const removeDomain = async (domain) => {
    const previous = domains;
    setDomains((rows) => rows.filter((d) => d.id !== domain.id));
    const ok = await softDeleteGalleryDomain(domain.id);
    if (!ok) {
      setDomains(previous);
      toast.error("Could not delete the domain.");
      return;
    }
    toast.success(`Deleted ${domain.domain}.`);
  };

  const copyDomain = async (domain) => {
    try {
      await navigator.clipboard.writeText(`https://${domain.domain}`);
      toast.success("Domain URL copied.");
    } catch {
      toast.error("Copy failed — select the hostname manually.");
    }
  };

  const columns = [
    {
      key: "domain",
      header: "Domain",
      render: (domain) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="max-w-[240px] truncate font-medium text-foreground">
              {domain.domain}
            </span>
            {domain.isPrimary ? <Badge variant="info">Primary</Badge> : null}
          </span>
          <span className="truncate text-xs text-text-secondary">
            {DOMAIN_TYPE_MAP[domain.domainType]?.label || domain.domainType}
            {domain.seoTitle ? ` · ${domain.seoTitle}` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "verification",
      header: "Verification",
      render: (domain) => (
        <div className="flex flex-col gap-1">
          <StatusPill status={domain.verificationStatus} map={DOMAIN_VERIFICATION_MAP} />
          <span className="text-[11px] text-text-tertiary">
            {domain.verifiedAt ? `Verified ${formatDate(domain.verifiedAt)}` : "Not verified yet"}
          </span>
        </div>
      ),
    },
    {
      key: "ssl",
      header: "SSL",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (domain) => <StatusPill status={domain.sslStatus} map={DOMAIN_SSL_MAP} />,
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
            domain.verificationStatus === "verified"
              ? null
              : {
                  icon: ShieldCheck,
                  label: verifyingId === domain.id ? "Verifying…" : "Verify",
                  spin: verifyingId === domain.id,
                  disabled: verifyingId === domain.id,
                  onSelect: () => verifyDomain(domain),
                },
            domain.isPrimary
              ? null
              : { icon: Star, label: "Make primary", onSelect: () => setPrimary(domain) },
            { icon: Copy, label: "Copy URL", onSelect: () => copyDomain(domain) },
            { icon: Pencil, label: "Edit SEO", onSelect: () => openEdit(domain) },
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
    <MainScreenWrapper>
      <ScreenHeader
        title="Gallery Domains"
        description="Custom domains and subdomains — SSL state, SEO metadata, verification."
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
            value={verificationFilter}
            onValueChange={setVerificationFilter}
            options={DOMAIN_VERIFICATION_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={sslFilter}
            onValueChange={setSslFilter}
            options={DOMAIN_SSL_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search domains…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading gallery domains" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(domain) => domain.id}
          onRowClick={openEdit}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              {filtersActive ? (
                <EmptyState
                  icon={Globe}
                  title="No domains match these filters"
                  description="Try a different verification, SSL state, or search term."
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
                  icon={Globe}
                  title="No gallery domains yet"
                  description="Add a custom domain for your galleries."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={openCreate}
                    >
                      <Plus className="h-4 w-4" /> Add domain
                    </Button>
                  }
                />
              )}
            </div>
          }
        />
      )}

      <DomainDialog
        key={editing ? `domain:${editing.id}` : "domain:new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={submitDomain}
      />
    </MainScreenWrapper>
  );
}

export default GalleryDomainsScreen;
