"use client";

import React, { useMemo, useState } from "react";
import { BadgeCheck, Building2, Plus, SlidersHorizontal, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { Switch } from "@geiger/ui/switch";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  ClearFiltersButton,
  CreateDialog,
  DateField,
  FieldRow,
  FilterDropdown,
  FormSection,
  MoneyField,
  RowActions,
  SelectField,
  TextAreaField,
  TextField,
  useModuleRows,
} from "@/components/internal/shared/module_kit";
import { ChipSelect, ExportButton, FindingsBanner, ScopeChips } from "./licensing_kit";
import { LicenseDetailScreen } from "./license_detail";
import {
  CHANNELS,
  DURATION_OPTIONS,
  EXCLUSIVITY_META,
  LICENSEE_KIND_META,
  LICENSE_STATUS_META,
  TERRITORIES,
  USAGE_TYPE_META,
  addMonths,
  centsToDollarString,
  compactMoney,
  daysUntil,
  formatDate,
  formatMoney,
  formatTerm,
  labelFor,
  labelsFor,
  nextLicenseReference,
  optionsFromMeta,
  parseDollarsToCents,
  today,
} from "./constants";
import { findConflicts } from "./conflicts";
import { quoteLicense } from "./pricing_engine";
import {
  createLicense,
  createLicenseItems,
  createLicensee,
  deleteLicense,
  deleteLicensee,
  listLicenseItems,
  listLicensees,
  listLicenses,
  listPriceRules,
  listRenewals,
  listTemplates,
  updateLicense,
} from "@/lib/supabase/licensing";
import { listRightsRecords } from "@/lib/supabase/rights";
import { listRoyaltyLines, listRoyaltyRules } from "@/lib/supabase/royalties";
import { listAssets } from "@/lib/supabase/assets";
import { listCollections } from "@/lib/supabase/collections";

const STATUS_FILTERS = optionsFromMeta(LICENSE_STATUS_META, "All statuses");
const USAGE_FILTERS = optionsFromMeta(USAGE_TYPE_META, "All usage types");
const EXCLUSIVITY_FILTERS = optionsFromMeta(EXCLUSIVITY_META, "All exclusivity");
const TERRITORY_FILTERS = [{ value: "all", label: "All territories" }, ...TERRITORIES];
const USAGE_OPTIONS = optionsFromMeta(USAGE_TYPE_META);
const EXCLUSIVITY_OPTIONS = optionsFromMeta(EXCLUSIVITY_META);
const LICENSEE_KIND_OPTIONS = optionsFromMeta(LICENSEE_KIND_META);

function IssueDialog({
  open,
  onOpenChange,
  licensees,
  templates,
  assets,
  collections,
  rules,
  licenses,
  itemsByLicense,
  onSubmit,
}) {
  const [licenseeId, setLicenseeId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [usageType, setUsageType] = useState("web");
  const [territories, setTerritories] = useState(["north_america"]);
  const [channels, setChannels] = useState(["web"]);
  const [exclusivity, setExclusivity] = useState("non_exclusive");
  const [durationMonths, setDurationMonths] = useState("12");
  const [startDate, setStartDate] = useState(today());
  const [assetIds, setAssetIds] = useState([]);
  const [collectionIds, setCollectionIds] = useState([]);
  const [externalTitle, setExternalTitle] = useState("");
  const [feeOverride, setFeeOverride] = useState("");
  const [autoRenew, setAutoRenew] = useState(false);
  const [notes, setNotes] = useState("");

  const template = templates.find((t) => t.id === templateId) || null;

  React.useEffect(() => {
    if (!open) return;
    setLicenseeId("");
    setTemplateId("");
    setTitle("");
    setTerritories(["north_america"]);
    setChannels(["web"]);
    setExclusivity("non_exclusive");
    setDurationMonths("12");
    setStartDate(today());
    setAssetIds([]);
    setCollectionIds([]);
    setExternalTitle("");
    setFeeOverride("");
    setAutoRenew(false);
    setNotes("");
  }, [open]);

  // Choosing a template pulls its defaults in as the starting scope.
  React.useEffect(() => {
    if (!template) return;
    setUsageType(template.usageType || "web");
    setTerritories(template.defaultTerritories?.length ? template.defaultTerritories : ["north_america"]);
    setChannels(template.defaultChannels?.length ? template.defaultChannels : ["web"]);
    setExclusivity(template.exclusivity || "non_exclusive");
    setDurationMonths(String(template.defaultDurationMonths ?? 12));
  }, [template]);

  const months = Number(durationMonths) || 0;
  const endDate = months ? addMonths(startDate, months) : "";

  const breakdown = useMemo(
    () =>
      quoteLicense({
        template,
        rules,
        scope: { territories, channels, durationMonths: months, exclusivity },
      }),
    [template, rules, territories, channels, months, exclusivity],
  );

  const feeCents = feeOverride === "" ? breakdown.totalCents : parseDollarsToCents(feeOverride);

  // Draft conflict check runs live, before anything is written.
  const draftFindings = useMemo(() => {
    const draftItems = [
      ...assetIds.map((id) => ({ assetId: id })),
      ...collectionIds.map((id) => ({ collectionId: id })),
      ...(externalTitle.trim() ? [{ externalTitle: externalTitle.trim() }] : []),
    ];
    if (!draftItems.length) return [];
    return findConflicts(
      { id: "draft", territories, channels, exclusivity, startDate, endDate, status: "active" },
      draftItems,
      licenses,
      itemsByLicense,
    );
  }, [assetIds, collectionIds, externalTitle, territories, channels, exclusivity, startDate, endDate, licenses, itemsByLicense]);

  const assetOptions = assets.slice(0, 200).map((a) => ({
    value: a.id,
    label: a.name || a.fileName || a.id.slice(0, 8),
  }));
  const collectionOptions = collections.map((c) => ({ value: c.id, label: c.name || "Untitled collection" }));

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Issue licence"
      description="Pick the licensee and scope; the fee is calculated from the rate card and can be overridden."
      submitLabel="Issue licence"
      size="xl"
      onSubmit={() =>
        onSubmit({
          licenseeId,
          templateId,
          title,
          usageType,
          territories,
          channels,
          exclusivity,
          startDate,
          endDate,
          isPerpetual: months === 0,
          feeCents,
          priceBreakdown: breakdown,
          autoRenew,
          notes,
          assetIds,
          collectionIds,
          externalTitle: externalTitle.trim(),
          restrictions: template?.restrictions || [],
          termsBody: template?.termsBody || "",
          status: template?.requiresApproval ? "pending" : "active",
        })
      }
    >
      <FormSection title="Parties" description="Who is being licensed, and from which template.">
        <FieldRow>
          <SelectField
            label="Licensee"
            value={licenseeId}
            onChange={setLicenseeId}
            options={[{ value: "", label: "Select a licensee" }, ...licensees.map((l) => ({ value: l.id, label: l.name }))]}
            placeholder="Select a licensee"
          />
          <SelectField
            label="Template"
            value={templateId}
            onChange={setTemplateId}
            options={[{ value: "", label: "Bespoke (no template)" }, ...templates.map((t) => ({ value: t.id, label: `${t.name} (v${t.version})` }))]}
            placeholder="Bespoke"
          />
        </FieldRow>
        <TextField label="Licence title" value={title} onChange={setTitle} placeholder="e.g. Spring 2027 outdoor campaign" />
      </FormSection>

      <FormSection title="Grant" description="What they may do, where, and through which channels.">
        <FieldRow columns={3}>
          <SelectField label="Usage type" value={usageType} onChange={setUsageType} options={USAGE_OPTIONS} placeholder="Usage" />
          <SelectField label="Exclusivity" value={exclusivity} onChange={setExclusivity} options={EXCLUSIVITY_OPTIONS} placeholder="Exclusivity" />
          <SelectField label="Duration" value={durationMonths} onChange={setDurationMonths} options={DURATION_OPTIONS} placeholder="Duration" />
        </FieldRow>
        <FieldRow>
          <DateField label="Start date" value={startDate} onChange={setStartDate} clearable={false} />
          <Field label="End date" hint={months ? "Derived from the duration." : "Perpetual — no end date."}>
            <div className="flex h-10 items-center rounded-md border border-dashed border-border px-3 text-sm text-text-secondary">
              {endDate ? formatDate(endDate) : "Perpetual"}
            </div>
          </Field>
        </FieldRow>
        <ChipSelect label="Territories" options={TERRITORIES} values={territories} onChange={setTerritories} emptyHint="No territory granted yet." />
        <ChipSelect label="Channels" options={CHANNELS} values={channels} onChange={setChannels} emptyHint="No channel granted yet." />
      </FormSection>

      <FormSection
        title="Licensed material"
        description="Any combination of library assets, collections and material held outside the DAM."
      >
        <ChipSelect
          label="Library assets"
          options={assetOptions}
          values={assetIds}
          onChange={setAssetIds}
          emptyHint="No asset selected."
          searchPlaceholder="Filter assets…"
        />
        {collectionOptions.length ? (
          <ChipSelect
            label="Collections"
            options={collectionOptions}
            values={collectionIds}
            onChange={setCollectionIds}
            emptyHint="No collection selected."
            searchPlaceholder="Filter collections…"
          />
        ) : null}
        <TextField
          label="External material"
          value={externalTitle}
          onChange={setExternalTitle}
          placeholder="e.g. 1998 archive negative #42"
          hint="For material held outside the asset manager."
        />
        <FindingsBanner findings={draftFindings} title="Conflict check" />
      </FormSection>

      <FormSection title="Fee" description="Calculated from the rate card — override it if the deal says otherwise.">
        <div className="rounded-xl border border-border bg-surface-card p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-text-tertiary">Calculated fee</span>
            <span className="text-lg font-semibold tabular-nums text-foreground">{formatMoney(breakdown.totalCents)}</span>
          </div>
          {breakdown.factors.length ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-text-tertiary">
              {formatMoney(breakdown.baseCents)} base ×{breakdown.multiplier} —{" "}
              {breakdown.factors
                .filter((f) => f.multiplier !== 1 || f.flatCents)
                .map((f) => f.label)
                .join(", ") || "no scope multipliers"}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-text-tertiary">
              No rate card rules matched — set a fee by hand, or build the card on License Pricing.
            </p>
          )}
        </div>
        <FieldRow>
          <MoneyField
            label="Fee override"
            value={feeOverride}
            onChange={setFeeOverride}
            placeholder={centsToDollarString(breakdown.totalCents)}
            hint="Leave blank to use the calculated fee."
          />
          <Field label="Auto-renew" hint="Flags the licence for automatic renewal at term end.">
            <div className="flex h-10 items-center">
              <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
            </div>
          </Field>
        </FieldRow>
        <TextAreaField label="Internal notes" value={notes} onChange={setNotes} rows={2} placeholder="Not shown to the licensee." />
      </FormSection>
    </CreateDialog>
  );
}

function LicenseesDialog({ open, onOpenChange, licensees, licenses, onCreate, onDelete }) {
  const [draft, setDraft] = useState({ name: "", contactName: "", email: "", kind: "brand", territory: "" });
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const valueByLicensee = useMemo(() => {
    const totals = new Map();
    for (const license of licenses) {
      if (!license.licenseeId) continue;
      totals.set(license.licenseeId, (totals.get(license.licenseeId) || 0) + (license.feeCents || 0));
    }
    return totals;
  }, [licenses]);

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Licensees"
      description="The brands, agencies and publishers licences are issued to."
      submitLabel="Add licensee"
      wide
      onSubmit={() => {
        if (!draft.name.trim()) return toast.error("A licensee needs a name");
        onCreate(draft);
        setDraft({ name: "", contactName: "", email: "", kind: "brand", territory: "" });
      }}
    >
      <FormSection title="Add a licensee">
        <FieldRow>
          <TextField label="Name" value={draft.name} onChange={set("name")} placeholder="e.g. Northwind Retail" />
          <SelectField label="Kind" value={draft.kind} onChange={set("kind")} options={LICENSEE_KIND_OPTIONS} placeholder="Kind" />
        </FieldRow>
        <FieldRow columns={3}>
          <TextField label="Contact" value={draft.contactName} onChange={set("contactName")} placeholder="Who signs" />
          <TextField label="Email" value={draft.email} onChange={set("email")} placeholder="rights@northwind.com" type="email" />
          <TextField label="Territory" value={draft.territory} onChange={set("territory")} placeholder="Head office market" />
        </FieldRow>
      </FormSection>
      <div className="rounded-xl border border-border bg-surface-card">
        {licensees.length ? (
          <ul className="divide-y divide-border">
            {licensees.map((licensee) => (
              <li key={licensee.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{licensee.name}</p>
                  <p className="truncate text-[11px] text-text-tertiary">
                    {labelFor(LICENSEE_KIND_META, licensee.kind)} · {licensee.email || "no email"} ·{" "}
                    {formatMoney(valueByLicensee.get(licensee.id) || 0)} licensed
                  </p>
                </div>
                <RowActions onDelete={() => onDelete(licensee)} deleteLabel="Remove licensee" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-6 text-center text-xs text-text-tertiary">No licensees yet.</p>
        )}
      </div>
    </CreateDialog>
  );
}

export function IssuedLicensesScreen({ projectId }) {
  const [rows, setRows, loading] = useModuleRows(listLicenses, projectId);
  const [licensees, setLicensees] = useModuleRows(listLicensees, projectId);
  const [templates] = useModuleRows(listTemplates, projectId);
  const [priceRules] = useModuleRows(listPriceRules, projectId);
  const [allItems, setAllItems] = useModuleRows(listLicenseItems, projectId);
  const [rightsRecords] = useModuleRows(listRightsRecords, projectId);
  const [royaltyRules] = useModuleRows(listRoyaltyRules, projectId);
  const [royaltyLines, setRoyaltyLines] = useModuleRows(listRoyaltyLines, projectId);
  const [renewals, setRenewals] = useModuleRows(listRenewals, projectId);
  const [assets] = useModuleRows(listAssets, projectId);
  const [collections] = useModuleRows(listCollections, projectId);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [usageFilter, setUsageFilter] = useState("all");
  const [exclusivityFilter, setExclusivityFilter] = useState("all");
  const [territoryFilter, setTerritoryFilter] = useState("all");
  const [showIssue, setShowIssue] = useState(false);
  const [showLicensees, setShowLicensees] = useState(false);
  const [openId, setOpenId] = useState(null);

  const licenseeById = useMemo(() => new Map(licensees.map((l) => [l.id, l])), [licensees]);
  const itemsByLicense = useMemo(() => {
    const grouped = new Map();
    for (const item of allItems) {
      if (!grouped.has(item.licenseId)) grouped.set(item.licenseId, []);
      grouped.get(item.licenseId).push(item);
    }
    return grouped;
  }, [allItems]);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.reference.toLowerCase().includes(q) ||
          (licenseeById.get(l.licenseeId)?.name ?? "").toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") list = list.filter((l) => l.status === statusFilter);
    if (usageFilter !== "all") list = list.filter((l) => l.usageType === usageFilter);
    if (exclusivityFilter !== "all") list = list.filter((l) => l.exclusivity === exclusivityFilter);
    if (territoryFilter !== "all") list = list.filter((l) => l.territories.includes(territoryFilter));
    return list;
  }, [rows, search, statusFilter, usageFilter, exclusivityFilter, territoryFilter, licenseeById]);

  // A live exclusivity sweep across everything issued, surfaced above the table.
  const portfolioFindings = useMemo(() => {
    const seen = new Set();
    const findings = [];
    for (const license of rows) {
      if (license.status !== "active" && license.status !== "pending") continue;
      for (const finding of findConflicts(license, itemsByLicense.get(license.id), rows, itemsByLicense)) {
        const key = [license.id, finding.licenseId].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({ ...finding, title: `${license.reference || license.title}: ${finding.title}` });
      }
    }
    return findings.slice(0, 5);
  }, [rows, itemsByLicense]);

  const stats = useMemo(() => {
    const active = rows.filter((l) => l.status === "active");
    const revenue = rows.reduce((sum, l) => sum + (l.feeCents || 0), 0);
    const expiring = rows.filter((l) => {
      if (l.isPerpetual) return false;
      const days = daysUntil(l.endDate);
      return days !== null && days >= 0 && days <= 30;
    }).length;
    const exclusive = active.filter((l) => l.exclusivity !== "non_exclusive").length;
    return [
      { label: "Licences", value: String(rows.length), footer: `${active.length} active` },
      { label: "Licence revenue", value: compactMoney(revenue), footer: "total fees issued" },
      { label: "Expiring soon", value: String(expiring), footer: "within 30 days" },
      { label: "Exclusive grants", value: String(exclusive), footer: "live exclusivity" },
    ];
  }, [rows]);

  const handleIssue = async (draft) => {
    if (!draft.licenseeId) return toast.error("Pick a licensee");
    if (!draft.title.trim()) return toast.error("Give the licence a title");
    if (!draft.assetIds.length && !draft.collectionIds.length && !draft.externalTitle) {
      return toast.error("Add at least one licensed item");
    }

    const id = crypto.randomUUID();
    const reference = nextLicenseReference(rows);
    const payload = {
      id,
      projectId,
      reference,
      title: draft.title.trim(),
      templateId: draft.templateId || null,
      licenseeId: draft.licenseeId,
      status: draft.status,
      usageType: draft.usageType,
      territories: draft.territories,
      channels: draft.channels,
      exclusivity: draft.exclusivity,
      startDate: draft.startDate,
      endDate: draft.endDate,
      isPerpetual: draft.isPerpetual,
      autoRenew: draft.autoRenew,
      feeCents: draft.feeCents,
      priceBreakdown: draft.priceBreakdown,
      restrictions: draft.restrictions,
      termsBody: draft.termsBody,
      notes: draft.notes,
      issuedAt: new Date().toISOString(),
    };

    setRows((prev) => [payload, ...prev]);
    setShowIssue(false);

    const created = await createLicense(payload);
    if (!created) {
      setRows((prev) => prev.filter((l) => l.id !== id));
      return toast.error("Could not issue the licence");
    }
    setRows((prev) => prev.map((l) => (l.id === id ? created : l)));

    const itemDrafts = [
      ...draft.assetIds.map((assetId) => ({ id: crypto.randomUUID(), projectId, licenseId: id, assetId })),
      ...draft.collectionIds.map((collectionId) => ({ id: crypto.randomUUID(), projectId, licenseId: id, collectionId })),
      ...(draft.externalTitle
        ? [{ id: crypto.randomUUID(), projectId, licenseId: id, externalTitle: draft.externalTitle }]
        : []),
    ];
    const createdItems = await createLicenseItems(itemDrafts);
    if (createdItems?.length) setAllItems((prev) => [...prev, ...createdItems]);

    toast.success(`${reference} issued`);
    setOpenId(id);
  };

  const handleStatus = async (license, status) => {
    const previous = rows;
    setRows((list) => list.map((l) => (l.id === license.id ? { ...l, status } : l)));
    const saved = await updateLicense(license.id, status === "active" ? { status, issuedAt: license.issuedAt || new Date().toISOString() } : { status });
    if (saved) {
      setRows((list) => list.map((l) => (l.id === saved.id ? saved : l)));
      toast.success(`Licence marked ${LICENSE_STATUS_META[status]?.label.toLowerCase() ?? status}`);
    } else {
      setRows(previous);
      toast.error("Could not update the licence");
    }
  };

  const handleDelete = async (license) => {
    const previous = rows;
    setRows((list) => list.filter((l) => l.id !== license.id));
    const ok = await deleteLicense(license.id);
    if (ok) toast.success("Licence deleted");
    else {
      setRows(previous);
      toast.error("Could not delete the licence");
    }
  };

  const handleCreateLicensee = async (draft) => {
    const id = crypto.randomUUID();
    const payload = { id, projectId, ...draft, name: draft.name.trim() };
    setLicensees((prev) => [payload, ...prev]);
    const created = await createLicensee(payload);
    if (created) {
      setLicensees((prev) => prev.map((l) => (l.id === id ? created : l)));
      toast.success("Licensee added");
    } else {
      setLicensees((prev) => prev.filter((l) => l.id !== id));
      toast.error("Could not add the licensee");
    }
  };

  const handleDeleteLicensee = async (licensee) => {
    const previous = licensees;
    setLicensees((list) => list.filter((l) => l.id !== licensee.id));
    const ok = await deleteLicensee(licensee.id);
    if (ok) toast.success("Licensee removed");
    else {
      setLicensees(previous);
      toast.error("Could not remove the licensee");
    }
  };

  const columns = [
    {
      key: "reference",
      header: "Licence",
      render: (l) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{l.title || "Untitled licence"}</p>
          <p className="truncate font-mono text-[11px] text-text-tertiary">
            {l.reference || "no reference"} · {itemsByLicense.get(l.id)?.length ?? 0} item
            {(itemsByLicense.get(l.id)?.length ?? 0) === 1 ? "" : "s"}
          </p>
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
      key: "scope",
      header: "Scope",
      className: "hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (l) => <ScopeChips values={labelsFor(TERRITORIES, l.territories)} />,
    },
    {
      key: "term",
      header: "Term",
      className: "hidden text-xs text-text-secondary xl:table-cell",
      headClassName: "hidden xl:table-cell",
      render: (l) => formatTerm(l),
    },
    {
      key: "fee",
      header: "Fee",
      align: "right",
      className: "tabular-nums text-xs font-medium",
      render: (l) => formatMoney(l.feeCents, l.currency),
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
              ...(l.status !== "active"
                ? [{ icon: BadgeCheck, label: "Mark active", onSelect: () => handleStatus(l, "active") }]
                : []),
              ...(l.status === "active"
                ? [{ icon: BadgeCheck, label: "Mark expired", onSelect: () => handleStatus(l, "expired") }]
                : []),
            ]}
            onEdit={() => setOpenId(l.id)}
            editLabel="Open licence"
            onDelete={() => handleDelete(l)}
          />
        </div>
      ),
    },
  ];

  const exportColumns = [
    { key: "reference", header: "Reference" },
    { key: "title", header: "Title" },
    { key: "licensee", header: "Licensee", value: (l) => licenseeById.get(l.licenseeId)?.name || "" },
    { key: "usageType", header: "Usage" },
    { key: "territories", header: "Territories", value: (l) => labelsFor(TERRITORIES, l.territories).join("; ") },
    { key: "channels", header: "Channels", value: (l) => labelsFor(CHANNELS, l.channels).join("; ") },
    { key: "exclusivity", header: "Exclusivity" },
    { key: "startDate", header: "Start" },
    { key: "endDate", header: "End" },
    { key: "feeCents", header: "Fee", value: (l) => centsToDollarString(l.feeCents) },
    { key: "status", header: "Status" },
  ];

  const hasFilters =
    statusFilter !== "all" ||
    usageFilter !== "all" ||
    exclusivityFilter !== "all" ||
    territoryFilter !== "all" ||
    Boolean(search);
  const clearFilters = () => {
    setStatusFilter("all");
    setUsageFilter("all");
    setExclusivityFilter("all");
    setTerritoryFilter("all");
    setSearch("");
  };

  const open = openId ? rows.find((l) => l.id === openId) : null;
  if (openId && open) {
    return (
      <LicenseDetailScreen
        key={openId}
        license={open}
        licensees={licensees}
        templates={templates}
        assets={assets}
        collections={collections}
        rightsRecords={rightsRecords}
        licenses={rows}
        itemsByLicense={itemsByLicense}
        royaltyRules={royaltyRules}
        royaltyLines={royaltyLines}
        priceRules={priceRules}
        renewals={renewals}
        projectId={projectId}
        onBack={() => setOpenId(null)}
        onChange={(next) => setRows((list) => list.map((l) => (l.id === next.id ? next : l)))}
        onRoyaltyLines={(lines) => setRoyaltyLines((prev) => [...lines, ...prev])}
        onRenewal={(renewal) => setRenewals((prev) => [renewal, ...prev])}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Issued Licenses"
        description="Every grant issued to a licensee — scope, term, fee and the certificate that proves it."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-1.5 border-border bg-surface-card text-xs hover:bg-surface-hover"
              onClick={() => setShowLicensees(true)}
            >
              <Users className="h-4 w-4" />
              Licensees
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowIssue(true)}>
              <Plus className="h-4 w-4" />
              Issue licence
            </Button>
          </div>
        }
      />
      <StatsBar stats={stats} />
      <FindingsBanner findings={portfolioFindings} title="Exclusivity conflicts across the portfolio" />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={usageFilter} onValueChange={setUsageFilter} options={USAGE_FILTERS} placeholder="Usage" />
          <FilterDropdown value={exclusivityFilter} onValueChange={setExclusivityFilter} options={EXCLUSIVITY_FILTERS} placeholder="Exclusivity" />
          <FilterDropdown value={territoryFilter} onValueChange={setTerritoryFilter} options={TERRITORY_FILTERS} placeholder="Territory" />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <div className="flex items-center gap-2">
          <ExportButton filename="issued-licences" rows={filtered} columns={exportColumns} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search licences..." className="w-full sm:w-56" />
        </div>
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" label="Loading issued licences" />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(l) => l.id}
          onRowClick={(l) => setOpenId(l.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={hasFilters ? SlidersHorizontal : BadgeCheck}
                title={hasFilters ? "No matching licences" : "No licences issued yet"}
                description={
                  hasFilters
                    ? "Try adjusting your filters."
                    : licensees.length
                      ? "Issue your first licence — the fee comes from the rate card and the certificate is generated for you."
                      : "Add a licensee first, then issue the grant against it."
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" className="border-border bg-surface-card" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : licensees.length ? (
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowIssue(true)}>
                      <Plus className="h-4 w-4" />
                      Issue licence
                    </Button>
                  ) : (
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowLicensees(true)}>
                      <Building2 className="h-4 w-4" />
                      Add a licensee
                    </Button>
                  )
                }
              />
            </div>
          }
        />
      )}
      {!loading && filtered.length > 0 ? (
        <div className="text-xs text-text-secondary">
          Showing {filtered.length} of {rows.length} licences
        </div>
      ) : null}

      <IssueDialog
        open={showIssue}
        onOpenChange={setShowIssue}
        licensees={licensees}
        templates={templates}
        assets={assets}
        collections={collections}
        rules={priceRules}
        licenses={rows}
        itemsByLicense={itemsByLicense}
        onSubmit={handleIssue}
      />
      <LicenseesDialog
        open={showLicensees}
        onOpenChange={setShowLicensees}
        licensees={licensees}
        licenses={rows}
        onCreate={handleCreateLicensee}
        onDelete={handleDeleteLicensee}
      />
    </MainScreenWrapper>
  );
}

export default IssuedLicensesScreen;
