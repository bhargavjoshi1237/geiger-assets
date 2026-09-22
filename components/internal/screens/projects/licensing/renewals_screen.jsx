"use client";

import React, { useMemo, useState } from "react";
import {
  Ban,
  CalendarClock,
  CalendarPlus,
  CircleSlash,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SectionCard,
  SegmentedTabs,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  ClearFiltersButton,
  CreateDialog,
  FieldRow,
  FilterDropdown,
  FormSection,
  MoneyField,
  RowActions,
  SelectField,
  TextAreaField,
  useModuleRows,
} from "@/components/internal/shared/module_kit";
import { ExportButton } from "./licensing_kit";
import {
  DURATION_OPTIONS,
  LICENSE_STATUS_META,
  RENEWAL_ACTION_META,
  centsToDollarString,
  compactMoney,
  daysUntil,
  formatDate,
  formatMoney,
  formatTerm,
  optionsFromMeta,
  parseDollarsToCents,
} from "./constants";
import {
  extendGrace,
  lapseLicense,
  renewAsSuccessor,
  renewInPlace,
  terminateLicense,
} from "./renewal_actions";
import { listLicensees, listLicenses, listRenewals } from "@/lib/supabase/licensing";

const BUCKET_TABS = [
  { value: "expiring", label: "Expiring" },
  { value: "grace", label: "In grace" },
  { value: "expired", label: "Expired" },
  { value: "auto", label: "Auto-renewing" },
  { value: "history", label: "History" },
];

const WINDOW_OPTIONS = [
  { value: "30", label: "Next 30 days" },
  { value: "60", label: "Next 60 days" },
  { value: "90", label: "Next 90 days" },
  { value: "365", label: "Next 12 months" },
];

const ACTION_FILTERS = optionsFromMeta(RENEWAL_ACTION_META, "All actions");

// Which pipeline bucket a licence sits in, given the review window.
function bucketFor(license, windowDays) {
  if (license.status === "terminated" || license.status === "renewed") return null;
  if (license.isPerpetual) return license.autoRenew ? "auto" : null;
  const days = daysUntil(license.endDate);
  if (days === null) return null;
  if (days < 0) {
    return Math.abs(days) <= (license.graceDays || 0) ? "grace" : "expired";
  }
  if (days <= windowDays) return "expiring";
  return license.autoRenew ? "auto" : null;
}

function RenewDialog({ open, onOpenChange, license, onSubmit }) {
  const [months, setMonths] = useState("12");
  const [fee, setFee] = useState("0.00");
  const [mode, setMode] = useState("in_place");
  const [note, setNote] = useState("");

  React.useEffect(() => {
    if (!open) return;
    setMonths(String(license?.isPerpetual ? 0 : 12));
    setFee(centsToDollarString(license?.feeCents ?? 0));
    setMode("in_place");
    setNote("");
  }, [open, license]);

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Renew ${license?.reference || "licence"}`}
      description="Extend the existing licence, or issue a successor licence that carries the same scope forward."
      submitLabel="Renew"
      onSubmit={() => onSubmit({ mode, months: Number(months) || 0, feeCents: parseDollarsToCents(fee), note })}
    >
      <FormSection title="How to renew">
        <SelectField
          label="Renewal style"
          value={mode}
          onChange={setMode}
          options={[
            { value: "in_place", label: "Extend this licence" },
            { value: "successor", label: "Issue a successor licence" },
          ]}
          placeholder="Style"
          hint="A successor keeps the original on file and links the two."
        />
      </FormSection>
      <FormSection title="New term">
        <FieldRow>
          <SelectField label="New term" value={months} onChange={setMonths} options={DURATION_OPTIONS} placeholder="Term" />
          <MoneyField label="Renewal fee" value={fee} onChange={setFee} />
        </FieldRow>
        <TextAreaField label="Note" value={note} onChange={setNote} rows={2} placeholder="Why, and on whose authority." />
      </FormSection>
    </CreateDialog>
  );
}

export function RenewalsScreen({ projectId }) {
  const [rows, setRows, loading] = useModuleRows(listLicenses, projectId);
  const [licensees] = useModuleRows(listLicensees, projectId);
  const [renewals, setRenewals, loadingRenewals] = useModuleRows(listRenewals, projectId);
  const [tab, setTab] = useState("expiring");
  const [windowDays, setWindowDays] = useState("30");
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [renewing, setRenewing] = useState(null);

  const licenseeById = useMemo(() => new Map(licensees.map((l) => [l.id, l])), [licensees]);
  const licenseById = useMemo(() => new Map(rows.map((l) => [l.id, l])), [rows]);
  const days = Number(windowDays) || 30;

  const buckets = useMemo(() => {
    const grouped = { expiring: [], grace: [], expired: [], auto: [] };
    for (const license of rows) {
      const bucket = bucketFor(license, days);
      if (bucket) grouped[bucket].push(license);
    }
    const byEnd = (a, b) => new Date(a.endDate || 0) - new Date(b.endDate || 0);
    grouped.expiring.sort(byEnd);
    grouped.grace.sort(byEnd);
    grouped.expired.sort(byEnd);
    return grouped;
  }, [rows, days]);

  const stats = useMemo(() => {
    const atRisk = buckets.expiring.reduce((sum, l) => sum + (l.feeCents || 0), 0);
    const renewedCount = renewals.filter((r) => r.action === "renewed").length;
    const decided = renewals.filter((r) => ["renewed", "lapsed", "terminated"].includes(r.action)).length;
    const renewalRate = decided ? Math.round((renewedCount / decided) * 100) : 0;
    return [
      { label: `Expiring ≤ ${days}d`, value: String(buckets.expiring.length), footer: "needs a decision" },
      { label: "Revenue at risk", value: compactMoney(atRisk), footer: "fees up for renewal" },
      { label: "In grace / expired", value: String(buckets.grace.length + buckets.expired.length), footer: `${buckets.grace.length} in grace` },
      { label: "Renewal rate", value: `${renewalRate}%`, footer: `${renewedCount} of ${decided} decided` },
    ];
  }, [buckets, renewals, days]);

  const visible = useMemo(() => {
    const list = tab === "history" ? [] : buckets[tab] || [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.reference.toLowerCase().includes(q) ||
        (licenseeById.get(l.licenseeId)?.name ?? "").toLowerCase().includes(q),
    );
  }, [tab, buckets, search, licenseeById]);

  const historyRows = useMemo(() => {
    let list = [...renewals];
    if (actionFilter !== "all") list = list.filter((r) => r.action === actionFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => {
        const license = licenseById.get(r.licenseId);
        return (
          (license?.reference ?? "").toLowerCase().includes(q) ||
          (license?.title ?? "").toLowerCase().includes(q) ||
          r.note.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [renewals, actionFilter, search, licenseById]);

  const applyResult = (result, message) => {
    if (result.license) {
      setRows((list) => {
        const next = list.map((l) => (l.id === result.license.id ? result.license : l));
        return result.successor ? [result.successor, ...next] : next;
      });
      if (result.renewal) setRenewals((prev) => [result.renewal, ...prev]);
      toast.success(message);
    } else {
      toast.error("Could not update the licence");
    }
  };

  const handleRenew = async ({ mode, months, feeCents, note }) => {
    if (!renewing) return;
    const license = renewing;
    setRenewing(null);
    const result =
      mode === "successor"
        ? await renewAsSuccessor(license, { months, feeCents, note })
        : await renewInPlace(license, { months, feeCents, note });
    applyResult(result, mode === "successor" ? "Successor licence issued" : "Licence renewed");
  };

  const handleLapse = async (license) => applyResult(await lapseLicense(license), "Licence lapsed");
  const handleTerminate = async (license) => applyResult(await terminateLicense(license), "Licence terminated");
  const handleExtend = async (license) =>
    applyResult(await extendGrace(license, { days: 30 }), "Grace extended by 30 days");

  const licenseColumns = [
    {
      key: "reference",
      header: "Licence",
      render: (l) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{l.title || "Untitled licence"}</p>
          <p className="truncate font-mono text-[11px] text-text-tertiary">{l.reference || "no reference"}</p>
        </div>
      ),
    },
    {
      key: "licensee",
      header: "Licensee",
      className: "text-xs",
      render: (l) => licenseeById.get(l.licenseeId)?.name || <span className="text-text-tertiary">Unassigned</span>,
    },
    {
      key: "term",
      header: "Term",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (l) => formatTerm(l),
    },
    {
      key: "countdown",
      header: "Ends",
      render: (l) => {
        const left = daysUntil(l.endDate);
        if (l.isPerpetual) return <Badge variant="neutral">Perpetual</Badge>;
        if (left === null) return <span className="text-xs text-text-tertiary">—</span>;
        if (left < 0) {
          const overdue = Math.abs(left);
          const inGrace = overdue <= (l.graceDays || 0);
          return (
            <Badge variant={inGrace ? "warning" : "danger"}>
              {inGrace ? `${(l.graceDays || 0) - overdue}d grace left` : `${overdue}d overdue`}
            </Badge>
          );
        }
        return <Badge variant={left <= 30 ? "warning" : "info"}>{left}d left</Badge>;
      },
    },
    {
      key: "fee",
      header: "Fee",
      align: "right",
      className: "tabular-nums text-xs",
      render: (l) => formatMoney(l.feeCents, l.currency),
    },
    {
      key: "auto",
      header: "Auto",
      className: "hidden xl:table-cell",
      headClassName: "hidden xl:table-cell",
      render: (l) => (l.autoRenew ? <Badge variant="success">Auto-renew</Badge> : <span className="text-xs text-text-tertiary">Manual</span>),
    },
    {
      key: "status",
      header: "Status",
      render: (l) => <StatusPill status={l.status} map={LICENSE_STATUS_META} className="text-[10px]" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (l) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            extra={[
              { icon: RefreshCw, label: "Renew…", onSelect: () => setRenewing(l) },
              { icon: CalendarPlus, label: "Extend grace 30 days", onSelect: () => handleExtend(l) },
              { icon: CircleSlash, label: "Mark lapsed", onSelect: () => handleLapse(l) },
            ]}
            onEdit={() => handleTerminate(l)}
            editLabel="Terminate"
            editIcon={Ban}
          />
        </div>
      ),
    },
  ];

  const historyColumns = [
    {
      key: "license",
      header: "Licence",
      render: (r) => {
        const license = licenseById.get(r.licenseId);
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{license?.title || "Deleted licence"}</p>
            <p className="truncate font-mono text-[11px] text-text-tertiary">{license?.reference || r.licenseId?.slice(0, 8)}</p>
          </div>
        );
      },
    },
    { key: "action", header: "Action", render: (r) => <StatusPill status={r.action} map={RENEWAL_ACTION_META} className="text-[10px]" /> },
    {
      key: "dates",
      header: "Term change",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (r) => `${r.previousEndDate ? formatDate(r.previousEndDate) : "—"} → ${r.newEndDate ? formatDate(r.newEndDate) : "—"}`,
    },
    { key: "fee", header: "Fee", align: "right", className: "tabular-nums text-xs", render: (r) => formatMoney(r.feeCents, r.currency) },
    {
      key: "note",
      header: "Note",
      className: "hidden max-w-[16rem] truncate text-xs text-text-secondary xl:table-cell",
      headClassName: "hidden xl:table-cell",
      render: (r) => r.note || "—",
    },
    { key: "when", header: "Logged", className: "text-xs text-text-secondary", render: (r) => formatDate(r.createdAt) },
  ];

  const licenseExportColumns = [
    { key: "reference", header: "Reference" },
    { key: "title", header: "Title" },
    { key: "licensee", header: "Licensee", value: (l) => licenseeById.get(l.licenseeId)?.name || "" },
    { key: "endDate", header: "Ends" },
    { key: "daysLeft", header: "Days left", value: (l) => String(daysUntil(l.endDate) ?? "") },
    { key: "graceDays", header: "Grace days" },
    { key: "feeCents", header: "Fee", value: (l) => centsToDollarString(l.feeCents) },
    { key: "autoRenew", header: "Auto-renew", value: (l) => (l.autoRenew ? "yes" : "no") },
    { key: "status", header: "Status" },
  ];

  const historyExportColumns = [
    { key: "reference", header: "Reference", value: (r) => licenseById.get(r.licenseId)?.reference || "" },
    { key: "action", header: "Action" },
    { key: "previousEndDate", header: "Previous end" },
    { key: "newEndDate", header: "New end" },
    { key: "feeCents", header: "Fee", value: (r) => centsToDollarString(r.feeCents) },
    { key: "note", header: "Note" },
    { key: "createdAt", header: "Logged" },
  ];

  const bucketTabs = BUCKET_TABS.map((t) => ({
    ...t,
    label:
      t.value === "history"
        ? `History (${renewals.length})`
        : `${t.label} (${(buckets[t.value] || []).length})`,
  }));

  const isHistory = tab === "history";
  const hasFilters = Boolean(search) || (isHistory && actionFilter !== "all");

  const emptyCopy = {
    expiring: {
      title: "Nothing expiring in this window",
      description: "Widen the review window, or enjoy the quiet.",
    },
    grace: { title: "No licences in grace", description: "Expired licences with grace days left show up here." },
    expired: { title: "No expired licences", description: "Licences past their term and grace period land here." },
    auto: { title: "No auto-renewing licences", description: "Turn on auto-renew on a licence to track it here." },
    history: { title: "No renewal history yet", description: "Renew, lapse or terminate a licence and the trail starts here." },
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Expirations & Renewals"
        description="Customer-specific licence windows — what is closing, what is in grace, and what has been decided."
        actions={
          <FilterDropdown
            value={windowDays}
            onValueChange={setWindowDays}
            options={WINDOW_OPTIONS}
            placeholder="Review window"
            icon={CalendarClock}
          />
        }
      />
      <StatsBar stats={stats} />

      {buckets.grace.length ? (
        <SectionCard
          title="In grace right now"
          description="Past term but inside the grace period — decide before access outlives the paperwork."
          bodyPadding={false}
        >
          <ul className="divide-y divide-border">
            {buckets.grace.slice(0, 4).map((license) => {
              const overdue = Math.abs(daysUntil(license.endDate) ?? 0);
              return (
                <li key={license.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{license.title || license.reference}</p>
                    <p className="truncate text-[11px] text-text-tertiary">
                      {licenseeById.get(license.licenseeId)?.name || "Unassigned"} · ended {formatDate(license.endDate)} ·{" "}
                      {(license.graceDays || 0) - overdue} of {license.graceDays || 0} grace days left
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                      onClick={() => setRenewing(license)}
                    >
                      Renew
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-border bg-surface-card text-xs hover:bg-surface-hover"
                      onClick={() => handleLapse(license)}
                    >
                      Lapse
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ) : null}

      <SegmentedTabs tabs={bucketTabs} value={tab} onChange={setTab} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          {isHistory ? (
            <FilterDropdown value={actionFilter} onValueChange={setActionFilter} options={ACTION_FILTERS} placeholder="Action" icon={SlidersHorizontal} />
          ) : (
            <span className="text-xs text-text-tertiary">
              {visible.length} licence{visible.length === 1 ? "" : "s"} in this bucket
            </span>
          )}
          {hasFilters ? (
            <ClearFiltersButton
              onClick={() => {
                setSearch("");
                setActionFilter("all");
              }}
            />
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {isHistory ? (
            <ExportButton filename="renewal-history" rows={historyRows} columns={historyExportColumns} />
          ) : (
            <ExportButton filename={`licences-${tab}`} rows={visible} columns={licenseExportColumns} />
          )}
          <SearchInput value={search} onChange={setSearch} placeholder="Search licences..." className="w-full sm:w-56" />
        </div>
      </Toolbar>

      {(isHistory ? loadingRenewals : loading) ? (
        <LoadingArea panel className="h-64 py-0" label="Loading renewals" />
      ) : (
        <DataTable
          columns={isHistory ? historyColumns : licenseColumns}
          data={isHistory ? historyRows : visible}
          getRowKey={(row) => row.id}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={CalendarClock}
                title={emptyCopy[tab]?.title ?? "Nothing here"}
                description={hasFilters ? "Try adjusting your filters." : emptyCopy[tab]?.description}
              />
            </div>
          }
        />
      )}

      <RenewDialog
        open={Boolean(renewing)}
        onOpenChange={(v) => !v && setRenewing(null)}
        license={renewing}
        onSubmit={handleRenew}
      />
    </MainScreenWrapper>
  );
}

export default RenewalsScreen;
