"use client";

import { Button, DropdownMenuItem, LogoLoading } from "@geiger/ui";
import React, { useMemo, useState } from "react";
import { Ban, BellRing, CalendarClock, RefreshCw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
import {
  ScreenHeader, StatsBar, SearchInput, StatusPill, EmptyState, DataTable, Toolbar,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import {
  LICENSE_STATUS_MAP, RENEWAL_VIEW_OPTIONS, EXPIRY_BUCKET_MAP,
  EXPIRING_SOON_DAYS, GRACE_PERIOD_DAYS,
  daysUntil, expiryBucket, describeWindow, formatDate,
} from "./constants";
import {
  FilterDropdown, RowActions, ClearFiltersButton, useLicensingRows, CreateDialog,
  SelectField,
} from "./licensing_kit";
import {
  listIssuedLicenses, updateIssuedLicense, softDeleteIssuedLicense,
} from "@/lib/supabase/licensing";

const RENEW_MONTH_OPTIONS = [
  { value: "1", label: "1 month" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
  { value: "24", label: "24 months" },
];

function RenewDialog({ open, onOpenChange, license, onSubmit }) {
  const [months, setMonths] = useState("12");
  React.useEffect(() => {
    if (open) setMonths("12");
  }, [open]);
  if (!license && open) return null;
  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={license ? `Renew ${license.licenseeName}` : "Renew license"}
      description={license ? `Current term ends ${formatDate(license.endDate)} — the extension runs from the later of today and the current end.` : ""}
      submitLabel="Renew license"
      onSubmit={() => onSubmit(months)}
    >
      <SelectField label="Extend by" value={months} onChange={setMonths} options={RENEW_MONTH_OPTIONS} />
    </CreateDialog>
  );
}

export function ExpirationsRenewalsScreen({ projectId }) {
  const [rows, setRows, loading] = useLicensingRows(listIssuedLicenses, projectId);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("expiring");
  const [renewing, setRenewing] = useState(null);

  const withBuckets = useMemo(
    () => rows.map((t) => ({ ...t, bucket: expiryBucket(t.endDate), days: daysUntil(t.endDate) })),
    [rows],
  );

  const filtered = useMemo(() => {
    let r = [...withBuckets];
    if (view !== "all") r = r.filter((t) => t.bucket === view);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((t) => `${t.licenseeName} ${t.assetName}`.toLowerCase().includes(q));
    }
    r.sort((a, b) => (a.days ?? 999999) - (b.days ?? 999999));
    return r;
  }, [withBuckets, view, search]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${view}`,
  });

  const stats = useMemo(() => {
    const buckets = rows.map((t) => expiryBucket(t.endDate));
    const count = (b) => buckets.filter((x) => x === b).length;
    return [
      { label: "Expiring soon", value: String(count("expiring")), footer: `within ${EXPIRING_SOON_DAYS} days` },
      { label: "In grace", value: String(count("grace")), footer: `ended ≤ ${GRACE_PERIOD_DAYS}d ago` },
      { label: "Expired", value: String(count("expired")), footer: "past grace" },
      { label: "Renewed", value: String(rows.filter((t) => Number(t.renewalCount) > 0 || t.renewedAt).length), footer: "extended at least once" },
    ];
  }, [rows]);

  const hasFilters = view !== "all" || Boolean(search);
  const clearFilters = () => {
    setView("all");
    setSearch("");
  };

  const handleRenew = async (months) => {
    if (!renewing) return;
    const base = Math.max(new Date(renewing.endDate || 0).getTime(), Date.now());
    const endDate = new Date(base + Number(months) * 30 * 86400000).toISOString();
    const prev = rows;
    const renewalCount = Number(renewing.renewalCount) || 0;
    setRows((list) => list.map((t) => (t.id === renewing.id ? { ...t, endDate, status: "active" } : t)));
    setRenewing(null);
    const saved = await updateIssuedLicense(renewing.id, {
      endDate,
      status: "active",
      metadata: { renewedAt: new Date().toISOString(), renewalCount: renewalCount + 1 },
    });
    if (!saved) {
      setRows(prev);
      toast.error("Could not renew license");
    } else {
      setRows((list) => list.map((t) => (t.id === renewing.id ? saved : t)));
      toast.success(`Renewed for ${months} month${months === "1" ? "" : "s"}`);
    }
  };

  const handleRemind = async (license) => {
    const prev = rows;
    const remindedAt = new Date().toISOString();
    setRows((list) => list.map((t) => (t.id === license.id ? { ...t, lastReminderAt: remindedAt } : t)));
    const saved = await updateIssuedLicense(license.id, {
      metadata: {
        ...(Number(license.renewalCount) > 0 || license.renewedAt
          ? { renewedAt: license.renewedAt, renewalCount: Number(license.renewalCount) || 0 }
          : {}),
        lastReminderAt: remindedAt,
      },
    });
    if (!saved) {
      setRows(prev);
      toast.error("Could not log reminder");
    } else {
      setRows((list) => list.map((t) => (t.id === license.id ? saved : t)));
      toast.success(`Renewal reminder logged for ${license.licenseeName}`);
    }
  };

  const handleTerminate = async (license) => {
    const prev = rows;
    setRows((list) => list.map((t) => (t.id === license.id ? { ...t, status: "revoked" } : t)));
    const saved = await updateIssuedLicense(license.id, {
      status: "revoked",
      metadata: { terminatedAt: new Date().toISOString() },
    });
    if (!saved) {
      setRows(prev);
      toast.error("Could not terminate license");
    } else {
      setRows((list) => list.map((t) => (t.id === license.id ? saved : t)));
      toast.success("License terminated");
    }
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
      key: "window", header: "Window",
      render: (t) => (
        <div className="flex flex-col gap-1">
          <StatusPill status={t.bucket} map={EXPIRY_BUCKET_MAP} className="text-[10px]" />
          <span className="text-[11px] text-text-tertiary">{describeWindow(t.days)}</span>
        </div>
      ),
    },
    {
      key: "end", header: "Ends", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell",
      render: (t) => formatDate(t.endDate),
    },
    {
      key: "reminder", header: "Reminder", className: "hidden text-xs text-text-secondary xl:table-cell", headClassName: "hidden xl:table-cell",
      render: (t) => (t.lastReminderAt ? formatDate(t.lastReminderAt) : "—"),
    },
    {
      key: "status", header: "Status",
      render: (t) => <StatusPill status={t.status} map={LICENSE_STATUS_MAP} className="text-[10px]" />,
    },
    {
      key: "actions", header: "", align: "right",
      render: (t) => (
        <RowActions
          onEdit={() => setRenewing(t)}
          onDelete={() => handleDelete(t)}
          editLabel="Renew"
          extra={(
            <>
              <DropdownMenuItem className="cursor-pointer text-xs focus:bg-surface-hover" onClick={() => handleRemind(t)}>
                <BellRing className="mr-2 h-3.5 w-3.5" /> Log reminder
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-xs focus:bg-surface-hover" onClick={() => setRenewing(t)}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Renew…
              </DropdownMenuItem>
              {t.status !== "revoked" ? (
                <DropdownMenuItem
                  className="cursor-pointer text-xs text-red-400 focus:bg-red-500/10 focus:text-red-400"
                  onClick={() => handleTerminate(t)}
                >
                  <Ban className="mr-2 h-3.5 w-3.5" /> Terminate
                </DropdownMenuItem>
              ) : null}
            </>
          )}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="Expirations & Renewals"
        description="What ends when, who was reminded, grace periods, renewals, and termination."
        actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setView("expiring")}><CalendarClock className="mr-1.5 h-4 w-4" />Expiring soon</Button>}
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={view} onValueChange={setView} options={RENEWAL_VIEW_OPTIONS} placeholder="View" icon={SlidersHorizontal} />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search licensees, assets…" />
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-5">
            <DataTable
              columns={columns}
              data={pager.pageItems}
              getRowKey={(t) => t.id}
              onRowClick={setRenewing}
              empty={(
                <div className="rounded-xl border border-border bg-surface-subtle">
                  {rows.length === 0 ? (
                    <EmptyState icon={CalendarClock} title="No licenses to track" description="Issue a license with an end date and it will appear here." />
                  ) : (
                    <EmptyState icon={CalendarClock} title="Nothing in this view" description="No licenses match this expiry view and search." action={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>} />
                  )}
                </div>
              )}
            />
            <ListPagination {...pager} itemLabel="licenses" />
          </div>
          <SectionCard
            title="How expiry works"
            description="Buckets are derived from each license’s end date — nothing here is stored."
          >
            <ul className="list-disc space-y-2 pl-5 text-sm text-text-secondary">
              <li>Expiring soon — ends within {EXPIRING_SOON_DAYS} days. Log a reminder, then renew.</li>
              <li>Grace period — ended up to {GRACE_PERIOD_DAYS} days ago. The licensee is out of term but still recoverable: renew to reinstate.</li>
              <li>Expired — past grace. Renew starts a fresh term from today; terminate closes it out.</li>
            </ul>
          </SectionCard>
        </div>
      )}
      {renewing ? (
        <RenewDialog
          open={Boolean(renewing)}
          onOpenChange={(v) => !v && setRenewing(null)}
          license={renewing}
          onSubmit={handleRenew}
        />
      ) : null}
    </MainScreenWrapper>
  );
}

export default ExpirationsRenewalsScreen;
