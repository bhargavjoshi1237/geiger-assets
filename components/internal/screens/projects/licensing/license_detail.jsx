"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CircleDollarSign,
  FileStack,
  Layers,
  Plus,
  ScrollText,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@geiger/ui/tabs";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  LoadingArea,
  SectionCard,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import {
  CreateDialog,
  DateField,
  FieldRow,
  FilterDropdown,
  FormSection,
  MoneyField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/internal/shared/module_kit";
import { ChipSelect, DetailRow, FindingsBanner, TagListField } from "./licensing_kit";
import { LicenseCertificate } from "./license_certificate";
import {
  CHANNELS,
  DURATION_OPTIONS,
  EXCLUSIVITY_META,
  LICENSE_STATUS_META,
  RENEWAL_ACTION_META,
  ROYALTY_LINE_STATUS_META,
  TERRITORIES,
  USAGE_TYPE_META,
  centsToDollarString,
  daysUntil,
  formatDate,
  formatMoney,
  formatPercent,
  labelFor,
  optionsFromMeta,
  parseDollarsToCents,
} from "./constants";
import { reviewLicense } from "./conflicts";
import { describeBreakdown, quoteLicense } from "./pricing_engine";
import { accrueForLicense } from "./royalty_engine";
import { extendGrace, lapseLicense, renewInPlace, terminateLicense } from "./renewal_actions";
import {
  createLicenseItem,
  deleteLicenseItem,
  listItemsForLicense,
  updateLicense,
} from "@/lib/supabase/licensing";
import { createRoyaltyLines } from "@/lib/supabase/royalties";

const STATUS_OPTIONS = optionsFromMeta(LICENSE_STATUS_META);
const EXCLUSIVITY_OPTIONS = optionsFromMeta(EXCLUSIVITY_META);
const USAGE_OPTIONS = optionsFromMeta(USAGE_TYPE_META);

const TABS = [
  { value: "scope", label: "Scope & terms", icon: ScrollText },
  { value: "items", label: "Licensed items", icon: Layers },
  { value: "financials", label: "Financials & royalties", icon: CircleDollarSign },
  { value: "renewals", label: "Renewals & history", icon: CalendarClock },
  { value: "certificate", label: "Certificate", icon: BadgeCheck },
];

function AddItemDialog({ open, onOpenChange, assets, collections, rightsRecords, onSubmit }) {
  const [kind, setKind] = useState("asset");
  const [assetId, setAssetId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [rightsRecordId, setRightsRecordId] = useState("");
  const [externalTitle, setExternalTitle] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [versionLabel, setVersionLabel] = useState("");

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add licensed item"
      description="A licence can cover a library asset, a whole collection, or material that never entered the DAM."
      submitLabel="Add item"
      onSubmit={() =>
        onSubmit({
          assetId: kind === "asset" ? assetId : "",
          collectionId: kind === "collection" ? collectionId : "",
          rightsRecordId,
          externalTitle: kind === "external" ? externalTitle : "",
          externalRef: kind === "external" ? externalRef : "",
          versionLabel,
        })
      }
    >
      <FormSection title="What is covered">
        <SelectField
          label="Item kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: "asset", label: "Library asset" },
            { value: "collection", label: "Collection" },
            { value: "external", label: "External material" },
          ]}
          placeholder="Kind"
        />
        {kind === "asset" ? (
          <SelectField
            label="Asset"
            value={assetId}
            onChange={setAssetId}
            options={[{ value: "", label: "Select an asset" }, ...assets.map((a) => ({ value: a.id, label: a.name || a.fileName || a.id.slice(0, 8) }))]}
            placeholder="Select an asset"
          />
        ) : null}
        {kind === "collection" ? (
          <SelectField
            label="Collection"
            value={collectionId}
            onChange={setCollectionId}
            options={[{ value: "", label: "Select a collection" }, ...collections.map((c) => ({ value: c.id, label: c.name || "Untitled collection" }))]}
            placeholder="Select a collection"
          />
        ) : null}
        {kind === "external" ? (
          <FieldRow>
            <TextField label="Title" value={externalTitle} onChange={setExternalTitle} placeholder="e.g. 1998 archive negative #42" />
            <TextField label="Reference" value={externalRef} onChange={setExternalRef} placeholder="Archive or contract reference" />
          </FieldRow>
        ) : null}
      </FormSection>
      <FormSection title="Provenance">
        <FieldRow>
          <TextField label="Version pin" value={versionLabel} onChange={setVersionLabel} placeholder="e.g. v3 master" hint="Optional — pins the licence to one version." />
          <SelectField
            label="Backing right"
            value={rightsRecordId}
            onChange={setRightsRecordId}
            options={[{ value: "", label: "None" }, ...rightsRecords.map((r) => ({ value: r.id, label: r.title || "Untitled right" }))]}
            placeholder="None"
            hint="Links the grant to the inbound right it rests on."
          />
        </FieldRow>
      </FormSection>
    </CreateDialog>
  );
}

function RenewDialog({ open, onOpenChange, license, onSubmit }) {
  const [months, setMonths] = useState("12");
  const [fee, setFee] = useState(centsToDollarString(license?.feeCents ?? 0));
  const [note, setNote] = useState("");

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Renew licence"
      description="Extends the term from the current end date and records the renewal in the licence's history."
      submitLabel="Renew"
      onSubmit={() => onSubmit({ months: Number(months) || 0, feeCents: parseDollarsToCents(fee), note })}
    >
      <FieldRow>
        <SelectField label="New term" value={months} onChange={setMonths} options={DURATION_OPTIONS} placeholder="Term" />
        <MoneyField label="Renewal fee" value={fee} onChange={setFee} />
      </FieldRow>
      <TextAreaField label="Note" value={note} onChange={setNote} rows={2} placeholder="Why, and on whose authority." />
    </CreateDialog>
  );
}

export function LicenseDetailScreen({
  license: initialLicense,
  licensees,
  templates,
  assets,
  collections,
  rightsRecords,
  licenses,
  itemsByLicense,
  royaltyRules,
  royaltyLines,
  priceRules,
  renewals,
  onBack,
  onChange,
  onRoyaltyLines,
  onRenewal,
  projectId,
}) {
  const [license, setLicense] = useState(initialLicense);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [tab, setTab] = useState("scope");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [fee, setFee] = useState(centsToDollarString(initialLicense?.feeCents ?? 0));
  const [royaltyRate, setRoyaltyRate] = useState(String(initialLicense?.royaltyRate ?? 0));

  useEffect(() => {
    let alive = true;
    listItemsForLicense(initialLicense.id).then((rows) => {
      if (!alive) return;
      setItems(rows ?? []);
      setLoadingItems(false);
    });
    return () => {
      alive = false;
    };
  }, [initialLicense.id]);

  const licensee = useMemo(
    () => licensees.find((l) => l.id === license.licenseeId) || null,
    [licensees, license.licenseeId],
  );
  const template = useMemo(
    () => templates.find((t) => t.id === license.templateId) || null,
    [templates, license.templateId],
  );
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const collectionById = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);
  const holderById = useMemo(() => new Map((royaltyRules || []).map((r) => [r.rightsHolderId, r])), [royaltyRules]);

  const findings = useMemo(
    () => reviewLicense({ license, items, licenses, itemsByLicense, rightsRecords }),
    [license, items, licenses, itemsByLicense, rightsRecords],
  );

  const licenseRenewals = useMemo(
    () => (renewals || []).filter((r) => r.licenseId === license.id),
    [renewals, license.id],
  );

  const licenseLines = useMemo(
    () => (royaltyLines || []).filter((l) => l.licenseId === license.id),
    [royaltyLines, license.id],
  );

  // Re-quote from the live rate card so the operator can see drift from the
  // frozen breakdown on the licence.
  const recomputed = useMemo(
    () =>
      quoteLicense({
        template,
        rules: priceRules,
        scope: {
          territories: license.territories,
          channels: license.channels,
          durationMonths: license.isPerpetual ? 0 : monthsBetween(license.startDate, license.endDate),
          exclusivity: license.exclusivity,
        },
      }),
    [template, priceRules, license],
  );

  const save = useCallback(
    async (patch, successMessage) => {
      const previous = license;
      const next = { ...license, ...patch };
      setLicense(next);
      onChange?.(next);
      const saved = await updateLicense(license.id, patch);
      if (saved) {
        setLicense(saved);
        onChange?.(saved);
        if (successMessage) toast.success(successMessage);
        return true;
      }
      setLicense(previous);
      onChange?.(previous);
      toast.error("Could not save the licence");
      return false;
    },
    [license, onChange],
  );

  const handleAddItem = async (draft) => {
    if (!draft.assetId && !draft.collectionId && !draft.externalTitle.trim()) {
      return toast.error("Pick an asset, a collection, or name the external material");
    }
    const id = crypto.randomUUID();
    const payload = { id, projectId, licenseId: license.id, ...draft, externalTitle: draft.externalTitle.trim() };
    setItems((prev) => [...prev, payload]);
    setShowAddItem(false);
    const created = await createLicenseItem(payload);
    if (created) {
      setItems((prev) => prev.map((i) => (i.id === id ? created : i)));
      toast.success("Item added to the licence");
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.error("Could not add the item");
    }
  };

  const handleRemoveItem = async (item) => {
    const previous = items;
    setItems((list) => list.filter((i) => i.id !== item.id));
    const ok = await deleteLicenseItem(item.id);
    if (ok) toast.success("Item removed");
    else {
      setItems(previous);
      toast.error("Could not remove the item");
    }
  };

  const handleAccrue = async () => {
    const drafts = accrueForLicense(license, royaltyRules, items, { projectId });
    if (!drafts.length) {
      return toast.error("No royalty rule matches this licence — add one on Revenue & Royalties.");
    }
    const created = await createRoyaltyLines(drafts.map((d) => ({ ...d, id: crypto.randomUUID() })));
    if (created?.length) {
      onRoyaltyLines?.(created);
      toast.success(`Accrued ${created.length} royalty line${created.length === 1 ? "" : "s"}`);
    } else {
      toast.error("Could not accrue royalties");
    }
  };

  const runRenewalAction = async (action, args, message) => {
    const result = await action(license, args);
    if (result.license) {
      setLicense(result.license);
      onChange?.(result.license);
      if (result.renewal) onRenewal?.(result.renewal);
      toast.success(message);
    } else {
      toast.error("Could not update the licence");
    }
  };

  const days = daysUntil(license.endDate);

  const itemLabel = (item) => {
    if (item.assetId) return assetById.get(item.assetId)?.name || assetById.get(item.assetId)?.fileName || "Library asset";
    if (item.collectionId) return collectionById.get(item.collectionId)?.name || "Untitled collection";
    return item.externalTitle || item.externalRef || "External material";
  };

  const itemKindBadge = (item) => {
    if (item.assetId) return <Badge variant="info">Asset</Badge>;
    if (item.collectionId) return <Badge variant="purple">Collection</Badge>;
    return <Badge variant="outline">External</Badge>;
  };

  return (
    <MainScreenWrapper>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0 space-y-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 gap-1 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All licences
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-foreground">{license.title || "Untitled licence"}</h1>
            <StatusPill status={license.status} map={LICENSE_STATUS_META} />
            <Badge variant="outline" className="font-mono">{license.reference || "no reference"}</Badge>
          </div>
          <p className="text-sm text-text-secondary">
            {licensee?.name || "Unassigned licensee"} · {labelFor(USAGE_TYPE_META, license.usageType)} ·{" "}
            {license.isPerpetual
              ? "perpetual"
              : days === null
                ? "no end date"
                : days >= 0
                  ? `${days} days left`
                  : `expired ${Math.abs(days)} days ago`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={license.status}
            onValueChange={(status) => save({ status }, "Status updated")}
            options={STATUS_OPTIONS}
            placeholder="Status"
          />
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowRenew(true)}>
            <CalendarClock className="h-4 w-4" />
            Renew
          </Button>
        </div>
      </div>

      <FindingsBanner findings={findings} title="Rights review" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap bg-surface-subtle">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5 text-xs">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="scope" className="mt-4 space-y-4">
          <SectionCard title="Grant" description="What the licensee may do, where, and for how long.">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Licensee"
                  value={license.licenseeId || ""}
                  onChange={(licenseeId) => save({ licenseeId: licenseeId || null }, "Licensee updated")}
                  options={[{ value: "", label: "Unassigned" }, ...licensees.map((l) => ({ value: l.id, label: l.name }))]}
                  placeholder="Unassigned"
                />
                <SelectField
                  label="Template"
                  value={license.templateId || ""}
                  onChange={(templateId) => save({ templateId: templateId || null }, "Template updated")}
                  options={[{ value: "", label: "Bespoke" }, ...templates.map((t) => ({ value: t.id, label: `${t.name} (v${t.version})` }))]}
                  placeholder="Bespoke"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Usage type"
                  value={license.usageType}
                  onChange={(usageType) => save({ usageType }, "Usage updated")}
                  options={USAGE_OPTIONS}
                  placeholder="Usage"
                />
                <SelectField
                  label="Exclusivity"
                  value={license.exclusivity}
                  onChange={(exclusivity) => save({ exclusivity }, "Exclusivity updated")}
                  options={EXCLUSIVITY_OPTIONS}
                  placeholder="Exclusivity"
                />
              </div>
              <ChipSelect
                label="Territories"
                options={TERRITORIES}
                values={license.territories}
                onChange={(territories) => save({ territories })}
              />
              <ChipSelect
                label="Channels"
                options={CHANNELS}
                values={license.channels}
                onChange={(channels) => save({ channels })}
              />
            </div>
          </SectionCard>

          <SectionCard title="Term" description="Start, end, grace and renewal behaviour.">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DateField
                label="Start date"
                value={license.startDate}
                onChange={(startDate) => save({ startDate })}
              />
              <DateField
                label="End date"
                value={license.endDate}
                onChange={(endDate) => save({ endDate })}
                disabled={license.isPerpetual}
                hint={license.isPerpetual ? "Ignored while perpetual" : undefined}
                placeholder="No end date"
              />
              <Field label="Grace days" stepper value={license.graceDays ?? 0} onValueChange={(v) => save({ graceDays: Number(v) || 0 })} min={0}>
                <Input
                  inputMode="numeric"
                  value={String(license.graceDays ?? 0)}
                  onChange={(e) => save({ graceDays: Number(e.target.value) || 0 })}
                  className="bg-surface-card tabular-nums"
                />
              </Field>
              <div className="space-y-3">
                <Field label="Perpetual">
                  <div className="flex h-10 items-center">
                    <Switch
                      checked={license.isPerpetual}
                      onCheckedChange={(isPerpetual) => save({ isPerpetual }, isPerpetual ? "Now perpetual" : "Term restored")}
                    />
                  </div>
                </Field>
                <Field label="Auto-renew">
                  <div className="flex h-10 items-center">
                    <Switch
                      checked={license.autoRenew}
                      onCheckedChange={(autoRenew) => save({ autoRenew })}
                    />
                  </div>
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Restrictions & terms" description="What the certificate will carry.">
            <div className="space-y-4">
              <TagListField
                label="Restrictions"
                values={license.restrictions}
                onChange={(restrictions) => save({ restrictions })}
                placeholder="e.g. No resale or sublicensing"
              />
              <TextAreaField
                label="Terms body"
                hint="Tokens {{exclusivity}}, {{usage}}, {{territories}}, {{channels}} and {{duration}} render on the certificate."
                value={license.termsBody}
                onChange={(termsBody) => setLicense((l) => ({ ...l, termsBody }))}
                rows={5}
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border bg-surface-card text-xs hover:bg-surface-hover"
                  onClick={() => save({ termsBody: license.termsBody }, "Terms saved")}
                >
                  Save terms
                </Button>
              </div>
              <TextAreaField
                label="Internal notes"
                value={license.notes}
                onChange={(notes) => setLicense((l) => ({ ...l, notes }))}
                rows={3}
                placeholder="Not shown to the licensee."
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border bg-surface-card text-xs hover:bg-surface-hover"
                  onClick={() => save({ notes: license.notes }, "Notes saved")}
                >
                  Save notes
                </Button>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="items" className="mt-4 space-y-4">
          <SectionCard
            title="Licensed items"
            description="Assets, collections, or off-DAM material this grant covers."
            action={
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-border bg-surface-card text-xs hover:bg-surface-hover"
                onClick={() => setShowAddItem(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add item
              </Button>
            }
            bodyPadding={false}
          >
            {loadingItems ? (
              <LoadingArea className="h-40 py-0" label="Loading licensed items" />
            ) : items.length ? (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{itemLabel(item)}</p>
                      <p className="truncate text-[11px] text-text-tertiary">
                        {item.versionLabel ? `${item.versionLabel} · ` : ""}
                        {item.rightsRecordId
                          ? `backed by ${rightsRecords.find((r) => r.id === item.rightsRecordId)?.title || "a right"}`
                          : "no backing right"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {itemKindBadge(item)}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${itemLabel(item)}`}
                        className="h-8 w-8 text-text-tertiary hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => handleRemoveItem(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={FileStack}
                title="No items on this licence"
                description="Add the material being licensed so conflict and coverage checks can run."
                action={
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowAddItem(true)}>
                    <Plus className="h-4 w-4" />
                    Add item
                  </Button>
                }
              />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="financials" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Fee" description="What the licensee pays for this grant.">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Licence fee (USD)">
                    <Input
                      value={fee}
                      onChange={(e) => setFee(e.target.value)}
                      onBlur={() => {
                        const cents = parseDollarsToCents(fee);
                        if (cents !== license.feeCents) save({ feeCents: cents }, "Fee updated");
                      }}
                      className="bg-surface-card text-right tabular-nums"
                    />
                  </Field>
                  <Field label="Royalty rate (%)" hint="Share of this fee owed onward.">
                    <Input
                      value={royaltyRate}
                      onChange={(e) => setRoyaltyRate(e.target.value)}
                      onBlur={() => {
                        const rate = Number(royaltyRate) || 0;
                        if (rate !== license.royaltyRate) save({ royaltyRate: rate }, "Royalty rate updated");
                      }}
                      className="bg-surface-card text-right tabular-nums"
                    />
                  </Field>
                </div>
                <div className="divide-y divide-border border-t border-border pt-1">
                  <DetailRow label="Fee on file" value={formatMoney(license.feeCents, license.currency)} />
                  <DetailRow label="Rate card today" value={formatMoney(recomputed.totalCents, license.currency)} />
                  <DetailRow
                    label="Drift"
                    value={
                      <span className={recomputed.totalCents > license.feeCents ? "text-amber-400" : "text-emerald-400"}>
                        {formatMoney(recomputed.totalCents - license.feeCents, license.currency)}
                      </span>
                    }
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Price breakdown" description="The factors frozen in when this licence was issued.">
              {describeBreakdown(license.priceBreakdown).length ? (
                <div className="divide-y divide-border">
                  <DetailRow label="Base fee" value={formatMoney(license.priceBreakdown.baseCents, license.currency)} />
                  {describeBreakdown(license.priceBreakdown).map((factor, i) => (
                    <DetailRow key={`${factor.label}-${i}`} label={`${factor.kind} · ${factor.label}`} value={factor.detail || "—"} />
                  ))}
                  <DetailRow label="Total" value={formatMoney(license.priceBreakdown.totalCents, license.currency)} />
                </div>
              ) : (
                <p className="py-2 text-xs text-text-tertiary">
                  This licence was priced by hand — no rate-card breakdown was stored.
                </p>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Royalties on this licence"
            description="Accruals owed to rights holders from this fee."
            action={
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-border bg-surface-card text-xs hover:bg-surface-hover"
                onClick={handleAccrue}
              >
                <CircleDollarSign className="h-3.5 w-3.5" />
                Accrue royalties
              </Button>
            }
            bodyPadding={false}
          >
            {licenseLines.length ? (
              <ul className="divide-y divide-border">
                {licenseLines.map((line) => (
                  <li key={line.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {line.note || holderById.get(line.rightsHolderId)?.label || "Royalty"}
                      </p>
                      <p className="text-[11px] text-text-tertiary">
                        {formatPercent(line.ratePercent)} of {formatMoney(line.basisCents, line.currency)} ·{" "}
                        {line.periodStart ? formatDate(line.periodStart) : "no period"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusPill status={line.status} map={ROYALTY_LINE_STATUS_META} className="text-[10px]" />
                      <span className="text-sm font-medium tabular-nums text-foreground">
                        {formatMoney(line.amountCents, line.currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={CircleDollarSign}
                title="No royalties accrued"
                description="Accrue from the licence fee once a royalty rule covers the rights holder."
              />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="renewals" className="mt-4 space-y-4">
          <SectionCard title="Renewal actions" description="Every action writes an entry in the history below.">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-border bg-surface-card text-xs hover:bg-surface-hover"
                onClick={() => setShowRenew(true)}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                Renew term
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-border bg-surface-card text-xs hover:bg-surface-hover"
                onClick={() => runRenewalAction(extendGrace, { days: 30 }, "Grace extended by 30 days")}
              >
                Extend grace 30 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-border bg-surface-card text-xs hover:bg-surface-hover"
                onClick={() => runRenewalAction(lapseLicense, {}, "Licence lapsed")}
              >
                Mark lapsed
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-border bg-surface-card text-xs text-red-400 hover:bg-red-500/10 hover:text-red-400"
                onClick={() => runRenewalAction(terminateLicense, {}, "Licence terminated")}
              >
                Terminate
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="History" description="Renewals, lapses, terminations and grace extensions." bodyPadding={false}>
            {licenseRenewals.length ? (
              <ul className="divide-y divide-border">
                {licenseRenewals.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {labelFor(RENEWAL_ACTION_META, entry.action)}
                      </p>
                      <p className="truncate text-[11px] text-text-tertiary">
                        {entry.previousEndDate ? formatDate(entry.previousEndDate) : "—"} →{" "}
                        {entry.newEndDate ? formatDate(entry.newEndDate) : "—"}
                        {entry.note ? ` · ${entry.note}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs tabular-nums text-text-secondary">
                        {formatMoney(entry.feeCents, entry.currency)}
                      </span>
                      <span className="text-[11px] text-text-tertiary">{formatDate(entry.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="No renewal history"
                description="Renew, lapse or terminate this licence and the audit trail starts here."
              />
            )}
          </SectionCard>

          {license.renewalOf || license.renewedTo ? (
            <SectionCard title="Chain" description="How this licence relates to its neighbours.">
              <div className="divide-y divide-border">
                {license.renewalOf ? (
                  <DetailRow
                    label="Renewal of"
                    value={licenses.find((l) => l.id === license.renewalOf)?.reference || license.renewalOf}
                  />
                ) : null}
                {license.renewedTo ? (
                  <DetailRow
                    label="Renewed to"
                    value={licenses.find((l) => l.id === license.renewedTo)?.reference || license.renewedTo}
                  />
                ) : null}
              </div>
            </SectionCard>
          ) : null}
        </TabsContent>

        <TabsContent value="certificate" className="mt-4">
          <LicenseCertificate
            license={license}
            licensee={licensee}
            template={template}
            items={items}
            assetById={assetById}
            collectionById={collectionById}
          />
        </TabsContent>
      </Tabs>

      {showAddItem ? (
        <AddItemDialog
          open
          onOpenChange={setShowAddItem}
          assets={assets}
          collections={collections}
          rightsRecords={rightsRecords}
          onSubmit={handleAddItem}
        />
      ) : null}
      {showRenew ? (
        <RenewDialog
          open
          onOpenChange={setShowRenew}
          license={license}
          onSubmit={(args) => {
            setShowRenew(false);
            runRenewalAction(renewInPlace, args, "Licence renewed");
          }}
        />
      ) : null}
    </MainScreenWrapper>
  );
}

// Whole months between two dates, used to re-quote an existing term.
function monthsBetween(start, end) {
  if (!start || !end) return 0;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b - a) / (30.44 * 86400000)));
}

export default LicenseDetailScreen;
