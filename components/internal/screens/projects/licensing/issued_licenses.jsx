"use client";

import { Button, DropdownMenuItem, Input, LogoLoading } from "@geiger/ui";
import React, { useMemo, useState } from "react";
import { ArrowUpDown, Award, Ban, Copy, RefreshCw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
import {
  ScreenHeader, StatsBar, SearchInput, StatusPill, EmptyState, DataTable, Toolbar, Field,
} from "@/components/internal/shared/screen_kit";
import {
  LICENSE_STATUS_MAP, USAGE_TYPE_MAP, LICENSE_STATUS_FILTER_OPTIONS,
  daysUntil, expiryBucket, describeWindow, formatDate, mintCertificateCode,
} from "./constants";
import {
  FilterDropdown, RowActions, ClearFiltersButton, useLicensingRows, CreateDialog,
  TextField, SelectField,
} from "./licensing_kit";
import {
  listIssuedLicenses, createIssuedLicense, updateIssuedLicense, softDeleteIssuedLicense,
  listLicenseTemplates,
} from "@/lib/supabase/licensing";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@geiger/ui";

const SORT_OPTIONS = [
  { value: "end-asc", label: "Ending soonest" },
  { value: "end-desc", label: "Ending latest" },
  { value: "updated-desc", label: "Recently updated" },
  { value: "name-asc", label: "Licensee A–Z" },
];

const NONE_VALUE = "__none__";

function LicenseDialog({ open, onOpenChange, initial, templates, onSubmit }) {
  const editing = Boolean(initial);
  const seed = (row) => ({
    licenseeName: row?.licenseeName ?? "",
    licenseeEmail: row?.licenseeEmail ?? "",
    assetName: row?.assetName ?? "",
    templateId: row?.templateId ?? "",
    usageType: row?.usageType ?? "commercial",
    territories: row?.territories ?? "",
    channels: row?.channels ?? "",
    issueDate: (row?.issueDate ?? "").slice(0, 10),
    startDate: (row?.startDate ?? "").slice(0, 10),
    endDate: (row?.endDate ?? "").slice(0, 10),
    status: row?.status ?? "pending",
    certificateCode: row?.certificateCode ?? "",
  });
  const [draft, setDraft] = useState(() => seed(initial));
  React.useEffect(() => {
    if (open) setDraft(seed(initial));
  }, [open, initial]);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit license" : "Issue a license"}
      description="Licensee, licensed asset, grant scope, and the issue / start / end dates."
      submitLabel={editing ? "Save changes" : "Issue license"}
      onSubmit={() => onSubmit(draft)}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Licensee" value={draft.licenseeName} onChange={set("licenseeName")} placeholder="e.g. Acme Media" />
        <TextField label="Licensee email" value={draft.licenseeEmail} onChange={set("licenseeEmail")} placeholder="licensing@acme.co" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Licensed asset" value={draft.assetName} onChange={set("assetName")} placeholder="e.g. Hero image v3" />
        <SelectField
          label="Template"
          value={draft.templateId || NONE_VALUE}
          onChange={(v) => set("templateId")(v === NONE_VALUE ? "" : v)}
          options={[{ value: NONE_VALUE, label: "No template" }, ...templates.map((t) => ({ value: t.id, label: t.name }))]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Usage type" value={draft.usageType} onChange={set("usageType")} options={Object.entries(USAGE_TYPE_MAP).map(([value, m]) => ({ value, label: m.label }))} />
        <TextField label="Territories" value={draft.territories} onChange={set("territories")} placeholder="e.g. Worldwide" />
        <TextField label="Channels" value={draft.channels} onChange={set("channels")} placeholder="e.g. digital" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Issue date">
          <Input type="date" value={draft.issueDate} onChange={(e) => set("issueDate")(e.target.value)} className="border-border bg-surface-card text-foreground" />
        </Field>
        <Field label="Start date">
          <Input type="date" value={draft.startDate} onChange={(e) => set("startDate")(e.target.value)} className="border-border bg-surface-card text-foreground" />
        </Field>
        <Field label="End date">
          <Input type="date" value={draft.endDate} onChange={(e) => set("endDate")(e.target.value)} className="border-border bg-surface-card text-foreground" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Status" value={draft.status} onChange={set("status")} options={Object.entries(LICENSE_STATUS_MAP).map(([value, m]) => ({ value, label: m.label }))} />
        <TextField label="Certificate code" value={draft.certificateCode} onChange={set("certificateCode")} placeholder="Auto-minted on issue" />
      </div>
    </CreateDialog>
  );
}

function CertificateDialog({ license, onClose }) {
  if (!license) return null;
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(license.certificateCode || "");
      toast.success("Certificate code copied.");
    } catch {
      toast.error("Copy failed — select the code manually.");
    }
  };
  return (
    <Dialog open={Boolean(license)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-text-secondary" /> License certificate
          </DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            The grant as the licensee sees it — scope, term, and certificate code.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 rounded-lg border border-border bg-surface-card p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-secondary">Licensee</span>
            <span className="font-medium text-foreground">{license.licenseeName || "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-secondary">Asset</span>
            <span className="font-medium text-foreground">{license.assetName || "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-secondary">Scope</span>
            <span className="text-right text-foreground">
              {[license.territories, license.channels].filter(Boolean).join(" · ") || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-secondary">Term</span>
            <span className="text-foreground">{formatDate(license.startDate)} → {formatDate(license.endDate)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-secondary">Status</span>
            <StatusPill status={license.status} map={LICENSE_STATUS_MAP} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="font-mono text-xs text-text-secondary">{license.certificateCode || "No code"}</span>
            <Button variant="outline" size="sm" className="h-7 border-border bg-surface-subtle text-xs text-foreground hover:bg-surface-active" onClick={copyCode}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy code
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IssuedLicensesScreen({ projectId }) {
  const [rows, setRows, loading] = useLicensingRows(listIssuedLicenses, projectId);
  const [templates] = useLicensingRows(listLicenseTemplates, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortValue, setSortValue] = useState("end-asc");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [certificate, setCertificate] = useState(null);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((t) => `${t.licenseeName} ${t.assetName} ${t.certificateCode}`.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((t) => t.status === statusFilter);
    const [field, direction] = sortValue.split("-");
    r.sort((a, b) => {
      let cmp = 0;
      if (field === "end") cmp = new Date(a.endDate || "9999-12-31") - new Date(b.endDate || "9999-12-31");
      else if (field === "updated") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
      else if (field === "name") cmp = a.licenseeName.localeCompare(b.licenseeName);
      return direction === "desc" ? -cmp : cmp;
    });
    return r;
  }, [rows, search, statusFilter, sortValue]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${statusFilter}|${sortValue}`,
  });

  const stats = useMemo(() => {
    const expiring = rows.filter((t) => expiryBucket(t.endDate) === "expiring").length;
    return [
      { label: "Licenses", value: String(rows.length), footer: `${rows.filter((t) => t.status === "active").length} active` },
      { label: "Expiring soon", value: String(expiring), footer: "within 30 days" },
      { label: "Suspended", value: String(rows.filter((t) => t.status === "suspended").length), footer: "needs review" },
      { label: "Expired", value: String(rows.filter((t) => t.status === "expired").length), footer: "past term" },
    ];
  }, [rows]);

  const toPayload = (draft) => ({
    licenseeName: draft.licenseeName.trim(),
    licenseeEmail: draft.licenseeEmail.trim(),
    assetName: draft.assetName.trim(),
    templateId: draft.templateId || null,
    usageType: draft.usageType,
    territories: draft.territories.trim(),
    channels: draft.channels.trim(),
    issueDate: draft.issueDate || null,
    startDate: draft.startDate || null,
    endDate: draft.endDate || null,
    status: draft.status,
    certificateCode: draft.certificateCode.trim() || mintCertificateCode(),
  });

  const handleCreate = async (draft) => {
    if (!draft.licenseeName.trim()) return toast.error("Licensee is required");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic = { id, projectId, ...toPayload(draft), createdAt: now, updatedAt: now };
    setRows((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const created = await createIssuedLicense({ id, projectId, ...toPayload(draft) });
    if (created) {
      setRows((prev) => prev.map((t) => (t.id === id ? created : t)));
      toast.success("License issued");
    } else {
      setRows((prev) => prev.filter((t) => t.id !== id));
      toast.error("Could not issue license");
    }
  };

  const handleSave = async (draft) => {
    if (!editing) return;
    if (!draft.licenseeName.trim()) return toast.error("Licensee is required");
    const prev = rows;
    const patch = { ...toPayload(draft), certificateCode: draft.certificateCode.trim() || editing.certificateCode };
    setRows((list) => list.map((t) => (t.id === editing.id ? { ...t, ...patch } : t)));
    setEditing(null);
    const saved = await updateIssuedLicense(editing.id, patch);
    if (!saved) {
      setRows(prev);
      toast.error("Could not save license");
    } else {
      setRows((list) => list.map((t) => (t.id === editing.id ? saved : t)));
      toast.success("License updated");
    }
  };

  const handleRenew = async (license) => {
    const base = Math.max(new Date(license.endDate || 0).getTime(), Date.now());
    const endDate = new Date(base + 365 * 86400000).toISOString();
    const prev = rows;
    const renewalCount = Number(license.renewalCount) || 0;
    setRows((list) => list.map((t) => (t.id === license.id ? { ...t, endDate, status: "active" } : t)));
    const saved = await updateIssuedLicense(license.id, {
      endDate,
      status: "active",
      metadata: { renewedAt: new Date().toISOString(), renewalCount: renewalCount + 1 },
    });
    if (!saved) {
      setRows(prev);
      toast.error("Could not renew license");
    } else {
      setRows((list) => list.map((t) => (t.id === license.id ? saved : t)));
      toast.success("License renewed for 12 months");
    }
  };

  const handleRevoke = async (license) => {
    const prev = rows;
    setRows((list) => list.map((t) => (t.id === license.id ? { ...t, status: "revoked" } : t)));
    const saved = await updateIssuedLicense(license.id, { status: "revoked" });
    if (!saved) {
      setRows(prev);
      toast.error("Could not revoke license");
    } else toast.success("License revoked");
  };

  const handleDelete = async (license) => {
    const prev = rows;
    setRows((list) => list.filter((t) => t.id !== license.id));
    const ok = await softDeleteIssuedLicense(license.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete license");
    } else toast.success("License deleted");
  };

  const columns = [
    {
      key: "licensee", header: "Licensee",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{t.licenseeName || "—"}</p>
          <p className="truncate text-[11px] text-text-tertiary">{t.assetName || "No asset"}</p>
        </div>
      ),
    },
    {
      key: "term", header: "Term", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell",
      render: (t) => describeWindow(daysUntil(t.endDate)),
    },
    {
      key: "dates", header: "Start → End", className: "hidden text-xs text-text-secondary xl:table-cell", headClassName: "hidden xl:table-cell",
      render: (t) => `${formatDate(t.startDate)} → ${formatDate(t.endDate)}`,
    },
    {
      key: "status", header: "Status",
      render: (t) => <StatusPill status={t.status} map={LICENSE_STATUS_MAP} className="text-[10px]" />,
    },
    {
      key: "actions", header: "", align: "right",
      render: (t) => (
        <RowActions
          onEdit={() => setEditing(t)}
          onDelete={() => handleDelete(t)}
          editLabel="Edit"
          extra={(
            <>
              <DropdownMenuItem className="cursor-pointer text-xs focus:bg-surface-hover" onClick={() => setCertificate(t)}>
                <Award className="mr-2 h-3.5 w-3.5" /> Certificate
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-xs focus:bg-surface-hover" onClick={() => handleRenew(t)}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Renew 12 months
              </DropdownMenuItem>
              {t.status !== "revoked" ? (
                <DropdownMenuItem
                  className="cursor-pointer text-xs text-red-400 focus:bg-red-500/10 focus:text-red-400"
                  onClick={() => handleRevoke(t)}
                >
                  <Ban className="mr-2 h-3.5 w-3.5" /> Revoke
                </DropdownMenuItem>
              ) : null}
            </>
          )}
        />
      ),
    },
  ];

  const hasFilters = statusFilter !== "all" || Boolean(search);
  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
  };

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="Issued Licenses"
        description="Outbound grants to licensees — assets, scope, dates, status, and certificates."
        actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><Award className="mr-1.5 h-4 w-4" />Issue license</Button>}
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={LICENSE_STATUS_FILTER_OPTIONS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={sortValue} onValueChange={setSortValue} options={SORT_OPTIONS} placeholder="Sort" icon={ArrowUpDown} />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search licensees, assets…" />
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(t) => t.id}
            onRowClick={(t) => setCertificate(t)}
            empty={(
              <div className="rounded-xl border border-border bg-surface-subtle">
                {rows.length === 0 ? (
                  <EmptyState icon={Award} title="No licenses issued" description="Issue the first outbound grant to a licensee." action={<Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><Award className="mr-1.5 h-4 w-4" />Issue license</Button>} />
                ) : (
                  <EmptyState icon={Award} title="No matching licenses" description="No licenses match the current search and filters." action={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>} />
                )}
              </div>
            )}
          />
          <ListPagination {...pager} itemLabel="licenses" />
        </div>
      )}
      <LicenseDialog open={showCreate} onOpenChange={setShowCreate} templates={templates} onSubmit={handleCreate} />
      {editing ? (
        <LicenseDialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)} initial={editing} templates={templates} onSubmit={handleSave} />
      ) : null}
      {certificate ? (
        <CertificateDialog license={certificate} onClose={() => setCertificate(null)} />
      ) : null}
    </MainScreenWrapper>
  );
}

export default IssuedLicensesScreen;
