"use client";

import React, { useMemo, useState } from "react";
import {
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  Plus,
  Sparkles,
  ThumbsDown,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Label } from "@geiger/ui/label";
import { Switch } from "@geiger/ui/switch";
import { cn } from "@/lib/utils";
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
  TextField,
  useModuleRows,
} from "@/components/internal/shared/module_kit";
import { ChipSelect, ExportButton } from "./licensing_kit";
import {
  CHANNELS,
  DURATION_OPTIONS,
  EXCLUSIVITY_META,
  PRICE_RULE_KIND_META,
  QUOTE_STATUS_META,
  TERRITORIES,
  centsToDollarString,
  formatDate,
  formatMoney,
  labelFor,
  optionsFromMeta,
  parseDollarsToCents,
} from "./constants";
import { defaultRateCard, quoteLicense } from "./pricing_engine";
import {
  createPriceRule,
  createPriceRules,
  createQuote,
  deletePriceRule,
  deleteQuote,
  listLicensees,
  listPriceRules,
  listQuotes,
  listTemplates,
  updatePriceRule,
  updateQuote,
} from "@/lib/supabase/licensing";

const RULE_KIND_OPTIONS = Object.entries(PRICE_RULE_KIND_META).map(([value, m]) => ({ value, label: m.label }));
const EXCLUSIVITY_OPTIONS = optionsFromMeta(EXCLUSIVITY_META);
const QUOTE_STATUS_FILTERS = optionsFromMeta(QUOTE_STATUS_META, "All quote statuses");
const KIND_ORDER = ["base", "territory", "duration", "channel", "exclusivity"];

const TABS = [
  { value: "card", label: "Rate card", icon: CircleDollarSign },
  { value: "calculator", label: "Quote calculator", icon: Calculator },
  { value: "quotes", label: "Quote requests", icon: Sparkles },
];

// One editable rate-card row: label, key, multiplier, flat surcharge, active.
function RuleRow({ rule, onPatch, onDelete }) {
  const [multiplier, setMultiplier] = useState(String(rule.multiplier));
  const [flat, setFlat] = useState(centsToDollarString(rule.flatCents));

  React.useEffect(() => {
    setMultiplier(String(rule.multiplier));
    setFlat(centsToDollarString(rule.flatCents));
  }, [rule.multiplier, rule.flatCents]);

  const commitMultiplier = () => {
    const next = Number(multiplier);
    if (!Number.isFinite(next) || next < 0) {
      setMultiplier(String(rule.multiplier));
      return toast.error("Multiplier must be a positive number");
    }
    if (next !== rule.multiplier) onPatch(rule, { multiplier: next });
  };

  const commitFlat = () => {
    const next = parseDollarsToCents(flat);
    if (next !== rule.flatCents) onPatch(rule, { flatCents: next });
  };

  const isBase = rule.kind === "base";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_7rem_auto_auto] py-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground">{rule.label || rule.ruleKey}</p>
        <p className="truncate text-[11px] text-text-tertiary">
          {rule.ruleKey}
          {rule.templateId ? " · template-specific" : " · global"}
        </p>
      </div>

      <div className="col-span-2 flex items-center justify-end gap-3 sm:col-span-1 sm:contents">
        <div className={cn("min-w-0", isBase && "sm:invisible sm:pointer-events-none")}>
          <Label htmlFor={`${rule.id}-multiplier`} className="sr-only">
            {rule.label || rule.ruleKey} multiplier
          </Label>
          <Input
            id={`${rule.id}-multiplier`}
            value={isBase ? "" : multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
            onBlur={commitMultiplier}
            disabled={isBase}
            inputMode="decimal"
            className="h-8 w-full bg-surface-card text-center text-xs tabular-nums"
          />
        </div>

        <div className="min-w-0">
          <Label htmlFor={`${rule.id}-amount`} className="sr-only">
            {rule.label || rule.ruleKey} {isBase ? "base fee" : "surcharge"}
          </Label>
          <div className="flex h-8 items-center gap-1 rounded-md border border-border bg-surface-card pl-2 focus-within:border-border-strong">
            <span className="text-[11px] text-text-tertiary">$</span>
            <Input
              id={`${rule.id}-amount`}
              value={flat}
              onChange={(e) => setFlat(e.target.value)}
              onBlur={commitFlat}
              inputMode="decimal"
              className="h-8 border-0 bg-transparent px-0 text-right text-xs tabular-nums focus-visible:ring-0"
            />
          </div>
        </div>

        <Switch
          checked={rule.isActive}
          onCheckedChange={(checked) => onPatch(rule, { isActive: checked })}
          aria-label={`${rule.label || rule.ruleKey} active`}
        />
        <RowActions onDelete={() => onDelete(rule)} deleteLabel="Remove rule" />
      </div>
    </div>
  );
}

function RuleDialog({ open, onOpenChange, templates, onSubmit }) {
  const [draft, setDraft] = useState({ kind: "territory", ruleKey: "", label: "", multiplier: "1", flat: "0", templateId: "" });
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  React.useEffect(() => {
    if (open) setDraft({ kind: "territory", ruleKey: "", label: "", multiplier: "1", flat: "0", templateId: "" });
  }, [open]);

  const keyOptions = useMemo(() => {
    if (draft.kind === "territory") return TERRITORIES;
    if (draft.kind === "channel") return CHANNELS;
    if (draft.kind === "duration") return DURATION_OPTIONS.map((d) => ({ value: d.value, label: d.label }));
    if (draft.kind === "exclusivity") return EXCLUSIVITY_OPTIONS;
    return [{ value: "default", label: "Default base fee" }];
  }, [draft.kind]);

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New pricing rule"
      description="Rules turn a requested scope into a fee. Territory and channel multipliers compound; duration and exclusivity apply once."
      submitLabel="Add rule"
      onSubmit={() => onSubmit(draft)}
    >
      <FormSection title="What the rule matches">
        <FieldRow>
          <SelectField label="Rule kind" value={draft.kind} onChange={set("kind")} options={RULE_KIND_OPTIONS} placeholder="Kind" hint={PRICE_RULE_KIND_META[draft.kind]?.hint} />
          <SelectField label="Applies to" value={draft.ruleKey} onChange={set("ruleKey")} options={keyOptions} placeholder="Choose a value" />
        </FieldRow>
        <TextField label="Label" value={draft.label} onChange={set("label")} placeholder="Shown on the rate card and quote breakdown" />
      </FormSection>
      <FormSection title="What it does to the price">
        <FieldRow>
          {draft.kind === "base" ? null : (
            <TextField label="Multiplier" value={draft.multiplier} onChange={set("multiplier")} placeholder="1.5" inputMode="decimal" />
          )}
          <MoneyField label={draft.kind === "base" ? "Base fee" : "Flat surcharge"} value={draft.flat} onChange={set("flat")} />
        </FieldRow>
        <SelectField
          label="Scope"
          value={draft.templateId}
          onChange={set("templateId")}
          options={[{ value: "", label: "Global rate card" }, ...templates.map((t) => ({ value: t.id, label: t.name }))]}
          placeholder="Global rate card"
          hint="A template-specific rule overrides the global one for that template."
        />
      </FormSection>
    </CreateDialog>
  );
}

function QuoteCalculator({ templates, rules, licensees, onSaveQuote }) {
  const [templateId, setTemplateId] = useState("");
  const [territories, setTerritories] = useState(["north_america"]);
  const [channels, setChannels] = useState(["web"]);
  const [durationMonths, setDurationMonths] = useState("12");
  const [exclusivity, setExclusivity] = useState("non_exclusive");
  const [baseOverride, setBaseOverride] = useState("");
  const [licenseeId, setLicenseeId] = useState("");
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");

  const template = templates.find((t) => t.id === templateId) || null;

  // Selecting a template pulls its defaults into the calculator.
  React.useEffect(() => {
    if (!template) return;
    setTerritories(template.defaultTerritories?.length ? template.defaultTerritories : ["north_america"]);
    setChannels(template.defaultChannels?.length ? template.defaultChannels : ["web"]);
    setDurationMonths(String(template.defaultDurationMonths ?? 12));
    setExclusivity(template.exclusivity || "non_exclusive");
  }, [template]);

  const breakdown = useMemo(
    () =>
      quoteLicense({
        template,
        rules,
        scope: {
          territories,
          channels,
          durationMonths: Number(durationMonths) || 0,
          exclusivity,
          baseOverrideCents: baseOverride === "" ? undefined : parseDollarsToCents(baseOverride),
        },
      }),
    [template, rules, territories, channels, durationMonths, exclusivity, baseOverride],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <SectionCard title="Requested scope" description="Pick a template and the scope being asked for.">
        <div className="space-y-4">
          <FieldRow>
            <SelectField
              label="Template"
              value={templateId}
              onChange={setTemplateId}
              options={[{ value: "", label: "No template (global card)" }, ...templates.map((t) => ({ value: t.id, label: t.name }))]}
              placeholder="No template"
            />
            <SelectField label="Duration" value={durationMonths} onChange={setDurationMonths} options={DURATION_OPTIONS} placeholder="Duration" />
          </FieldRow>
          <ChipSelect label="Territories" options={TERRITORIES} values={territories} onChange={setTerritories} />
          <ChipSelect label="Channels" options={CHANNELS} values={channels} onChange={setChannels} />
          <FieldRow>
            <SelectField label="Exclusivity" value={exclusivity} onChange={setExclusivity} options={EXCLUSIVITY_OPTIONS} placeholder="Exclusivity" />
            <MoneyField
              label="Base fee override"
              value={baseOverride}
              onChange={setBaseOverride}
              placeholder={centsToDollarString(breakdown.baseCents)}
              hint="Leave blank to use the rate card's base fee."
            />
          </FieldRow>
        </div>
      </SectionCard>

      <div className="space-y-4">
        <SectionCard title="Calculated quote" description="Every factor that moved the price.">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-text-tertiary">Base fee</span>
              <span className="text-sm font-medium tabular-nums text-foreground">{formatMoney(breakdown.baseCents)}</span>
            </div>
            <div className="divide-y divide-border border-y border-border">
              {breakdown.factors.length ? (
                breakdown.factors.map((factor, i) => (
                  <div key={`${factor.kind}-${factor.key}-${i}`} className="flex items-center justify-between py-1.5">
                    <span className="min-w-0 truncate text-[11px] text-text-secondary">
                      <span className="text-text-tertiary">{labelFor(PRICE_RULE_KIND_META, factor.kind)}</span> · {factor.label}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-foreground">
                      {factor.multiplier !== 1 ? `×${factor.multiplier}` : ""}
                      {factor.flatCents ? ` +${formatMoney(factor.flatCents)}` : ""}
                      {factor.multiplier === 1 && !factor.flatCents ? "—" : ""}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-3 text-center text-[11px] text-text-tertiary">
                  No rules matched this scope — the base fee stands alone.
                </p>
              )}
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-text-secondary">
                Combined multiplier <span className="tabular-nums text-text-tertiary">×{breakdown.multiplier}</span>
              </span>
              <span className="text-lg font-semibold tabular-nums text-foreground">{formatMoney(breakdown.totalCents)}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Log as a quote request" description="Keep the figure on file for a licensee.">
          <div className="space-y-4">
            <SelectField
              label="Licensee"
              value={licenseeId}
              onChange={setLicenseeId}
              options={[{ value: "", label: "Unassigned" }, ...licensees.map((l) => ({ value: l.id, label: l.name }))]}
              placeholder="Unassigned"
            />
            <TextField label="Subject" value={subject} onChange={setSubject} placeholder="What is being licensed?" />
            <TextAreaField label="Note" value={note} onChange={setNote} rows={2} placeholder="Anything the licensee asked for." />
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                onSaveQuote({
                  licenseeId,
                  templateId,
                  subject,
                  note,
                  computedCents: breakdown.totalCents,
                  quotedCents: breakdown.totalCents,
                  scope: {
                    territories,
                    channels,
                    durationMonths: Number(durationMonths) || 0,
                    exclusivity,
                    breakdown,
                  },
                });
                setSubject("");
                setNote("");
              }}
            >
              <Plus className="h-4 w-4" />
              Save quote request
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export function LicensePricingScreen({ projectId }) {
  const [rules, setRules, loadingRules] = useModuleRows(listPriceRules, projectId);
  const [templates] = useModuleRows(listTemplates, projectId);
  const [licensees] = useModuleRows(listLicensees, projectId);
  const [quotes, setQuotes, loadingQuotes] = useModuleRows(listQuotes, projectId);
  const [tab, setTab] = useState("card");
  const [showRule, setShowRule] = useState(false);
  const [search, setSearch] = useState("");
  const [quoteStatus, setQuoteStatus] = useState("all");
  const [seeding, setSeeding] = useState(false);

  const licenseeById = useMemo(() => new Map(licensees.map((l) => [l.id, l])), [licensees]);
  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);

  const rulesByKind = useMemo(() => {
    const grouped = new Map(KIND_ORDER.map((kind) => [kind, []]));
    for (const rule of rules) {
      if (!grouped.has(rule.kind)) grouped.set(rule.kind, []);
      grouped.get(rule.kind).push(rule);
    }
    for (const list of grouped.values()) list.sort((a, b) => a.position - b.position);
    return grouped;
  }, [rules]);

  const stats = useMemo(() => {
    const base = rules.find((r) => r.kind === "base" && r.isActive);
    const active = rules.filter((r) => r.isActive).length;
    const openQuotes = quotes.filter((q) => q.status === "requested" || q.status === "quoted");
    const pipeline = openQuotes.reduce((sum, q) => sum + (q.quotedCents || q.computedCents || 0), 0);
    return [
      { label: "Base fee", value: formatMoney(base?.flatCents ?? 0), footer: base ? "before multipliers" : "no base rule" },
      { label: "Active rules", value: String(active), footer: `${rules.length} total` },
      { label: "Open quotes", value: String(openQuotes.length), footer: "awaiting a decision" },
      { label: "Quote pipeline", value: formatMoney(pipeline), footer: "potential licence revenue" },
    ];
  }, [rules, quotes]);

  const filteredQuotes = useMemo(() => {
    let list = [...quotes];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (quote) =>
          quote.subject.toLowerCase().includes(q) ||
          (licenseeById.get(quote.licenseeId)?.name ?? "").toLowerCase().includes(q),
      );
    }
    if (quoteStatus !== "all") list = list.filter((quote) => quote.status === quoteStatus);
    return list;
  }, [quotes, search, quoteStatus, licenseeById]);

  const handleSeed = async () => {
    setSeeding(true);
    const seeded = defaultRateCard(projectId).map((rule) => ({ ...rule, id: crypto.randomUUID() }));
    setRules(seeded);
    const created = await createPriceRules(seeded);
    setSeeding(false);
    if (created?.length) {
      setRules(created);
      toast.success("Starter rate card created");
    } else {
      setRules([]);
      toast.error("Could not create the rate card");
    }
  };

  const handleAddRule = async (draft) => {
    if (!draft.ruleKey) return toast.error("Pick what the rule applies to");
    const id = crypto.randomUUID();
    const payload = {
      id,
      projectId,
      templateId: draft.templateId || null,
      kind: draft.kind,
      ruleKey: draft.ruleKey,
      label: draft.label.trim() || draft.ruleKey,
      multiplier: draft.kind === "base" ? 1 : Number(draft.multiplier) || 1,
      flatCents: parseDollarsToCents(draft.flat),
      position: rules.length,
      isActive: true,
    };
    setRules((prev) => [...prev, payload]);
    setShowRule(false);
    const created = await createPriceRule(payload);
    if (created) {
      setRules((prev) => prev.map((r) => (r.id === id ? created : r)));
      toast.success("Pricing rule added");
    } else {
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.error("Could not add the pricing rule");
    }
  };

  const handlePatchRule = async (rule, patch) => {
    const previous = rules;
    setRules((list) => list.map((r) => (r.id === rule.id ? { ...r, ...patch } : r)));
    const saved = await updatePriceRule(rule.id, patch);
    if (!saved) {
      setRules(previous);
      toast.error("Could not update the pricing rule");
    }
  };

  const handleDeleteRule = async (rule) => {
    const previous = rules;
    setRules((list) => list.filter((r) => r.id !== rule.id));
    const ok = await deletePriceRule(rule.id);
    if (ok) toast.success("Pricing rule removed");
    else {
      setRules(previous);
      toast.error("Could not remove the pricing rule");
    }
  };

  const handleSaveQuote = async (draft) => {
    if (!draft.subject.trim()) return toast.error("Give the quote a subject");
    const id = crypto.randomUUID();
    const payload = {
      id,
      projectId,
      ...draft,
      subject: draft.subject.trim(),
      licenseeId: draft.licenseeId || null,
      templateId: draft.templateId || null,
      status: "quoted",
    };
    setQuotes((prev) => [{ ...payload, createdAt: new Date().toISOString() }, ...prev]);
    const created = await createQuote(payload);
    if (created) {
      setQuotes((prev) => prev.map((q) => (q.id === id ? created : q)));
      toast.success("Quote saved");
      setTab("quotes");
    } else {
      setQuotes((prev) => prev.filter((q) => q.id !== id));
      toast.error("Could not save the quote");
    }
  };

  const handleQuoteStatus = async (quote, status) => {
    const previous = quotes;
    setQuotes((list) => list.map((q) => (q.id === quote.id ? { ...q, status } : q)));
    const saved = await updateQuote(quote.id, { status });
    if (saved) toast.success(`Quote ${QUOTE_STATUS_META[status]?.label.toLowerCase() ?? status}`);
    else {
      setQuotes(previous);
      toast.error("Could not update the quote");
    }
  };

  const handleDeleteQuote = async (quote) => {
    const previous = quotes;
    setQuotes((list) => list.filter((q) => q.id !== quote.id));
    const ok = await deleteQuote(quote.id);
    if (ok) toast.success("Quote deleted");
    else {
      setQuotes(previous);
      toast.error("Could not delete the quote");
    }
  };

  const quoteColumns = [
    {
      key: "subject",
      header: "Quote",
      render: (q) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{q.subject || "Untitled quote"}</p>
          <p className="truncate text-[11px] text-text-tertiary">
            {licenseeById.get(q.licenseeId)?.name || "Unassigned"}
            {q.templateId ? ` · ${templateById.get(q.templateId)?.name ?? "template"}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "scope",
      header: "Scope",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (q) => {
        const scope = q.scope || {};
        const months = scope.durationMonths;
        return `${(scope.territories || []).length} territories · ${(scope.channels || []).length} channels · ${months ? `${months} mo` : "perpetual"}`;
      },
    },
    { key: "computed", header: "Calculated", align: "right", className: "tabular-nums text-xs text-text-secondary", render: (q) => formatMoney(q.computedCents, q.currency) },
    { key: "quoted", header: "Quoted", align: "right", className: "tabular-nums text-xs font-medium", render: (q) => formatMoney(q.quotedCents, q.currency) },
    { key: "status", header: "Status", render: (q) => <StatusPill status={q.status} map={QUOTE_STATUS_META} className="text-[10px]" /> },
    {
      key: "created",
      header: "Raised",
      className: "hidden text-xs text-text-secondary xl:table-cell",
      headClassName: "hidden xl:table-cell",
      render: (q) => formatDate(q.createdAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (q) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            extra={[
              { icon: CheckCircle2, label: "Mark accepted", onSelect: () => handleQuoteStatus(q, "accepted") },
              { icon: ThumbsDown, label: "Mark declined", onSelect: () => handleQuoteStatus(q, "declined") },
            ]}
            onDelete={() => handleDeleteQuote(q)}
          />
        </div>
      ),
    },
  ];

  const quoteExportColumns = [
    { key: "subject", header: "Quote" },
    { key: "licensee", header: "Licensee", value: (q) => licenseeById.get(q.licenseeId)?.name || "" },
    { key: "computedCents", header: "Calculated", value: (q) => centsToDollarString(q.computedCents) },
    { key: "quotedCents", header: "Quoted", value: (q) => centsToDollarString(q.quotedCents) },
    { key: "status", header: "Status" },
    { key: "createdAt", header: "Raised" },
  ];

  const hasQuoteFilters = quoteStatus !== "all" || Boolean(search);

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="License Pricing"
        description="Price a grant from the scope being requested — base fees, scope multipliers, exclusivity premiums and custom quotes."
        actions={
          <div className="flex items-center gap-2">
            {!loadingRules && rules.length === 0 ? (
              <Button
                variant="outline"
                className="gap-1.5 border-border bg-surface-card text-xs hover:bg-surface-hover"
                onClick={handleSeed}
                disabled={seeding}
              >
                <Wand2 className="h-4 w-4" />
                {seeding ? "Creating…" : "Create starter card"}
              </Button>
            ) : null}
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowRule(true)}>
              <Plus className="h-4 w-4" />
              New rule
            </Button>
          </div>
        }
      />
      <StatsBar stats={stats} />
      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "card" ? (
        loadingRules ? (
          <LoadingArea panel className="h-64 py-0" label="Loading the rate card" />
        ) : rules.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={CircleDollarSign}
              title="No rate card yet"
              description="Create the starter card to get sensible base fees and scope multipliers, then tune them to your market."
              action={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSeed} disabled={seeding}>
                  <Wand2 className="h-4 w-4" />
                  {seeding ? "Creating…" : "Create starter card"}
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {KIND_ORDER.map((kind) => {
              const list = rulesByKind.get(kind) || [];
              return (
                <SectionCard key={kind} title={labelFor(PRICE_RULE_KIND_META, kind)} description={PRICE_RULE_KIND_META[kind]?.hint}>
                  {list.length ? (
                    <div className="divide-y divide-border">
                      <div className="hidden items-center gap-x-4 pb-2 text-[10px] font-medium uppercase tracking-wide text-text-tertiary sm:grid sm:grid-cols-[minmax(0,1fr)_5.5rem_7rem_auto_auto]">
                        <span>Rule</span>
                        <span className="text-center">{kind === "base" ? "" : "Multiplier"}</span>
                        <span className="text-right">{kind === "base" ? "Fee" : "Surcharge"}</span>
                        <span className="text-right">Active</span>
                        <span className="sr-only">Actions</span>
                      </div>
                      {list.map((rule) => (
                        <RuleRow key={rule.id} rule={rule} onPatch={handlePatchRule} onDelete={handleDeleteRule} />
                      ))}
                    </div>
                  ) : (
                    <p className="py-3 text-xs text-text-tertiary">
                      No {labelFor(PRICE_RULE_KIND_META, kind).toLowerCase()} rules — scope of this kind prices at ×1.
                    </p>
                  )}
                </SectionCard>
              );
            })}
          </div>
        )
      ) : null}

      {tab === "calculator" ? (
        <QuoteCalculator templates={templates} rules={rules} licensees={licensees} onSaveQuote={handleSaveQuote} />
      ) : null}

      {tab === "quotes" ? (
        <>
          <Toolbar>
            <div className="flex flex-wrap items-center gap-2">
              <FilterDropdown value={quoteStatus} onValueChange={setQuoteStatus} options={QUOTE_STATUS_FILTERS} placeholder="Status" />
              {hasQuoteFilters ? (
                <ClearFiltersButton
                  onClick={() => {
                    setQuoteStatus("all");
                    setSearch("");
                  }}
                />
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <ExportButton filename="license-quotes" rows={filteredQuotes} columns={quoteExportColumns} />
              <SearchInput value={search} onChange={setSearch} placeholder="Search quotes..." className="w-full sm:w-56" />
            </div>
          </Toolbar>
          {loadingQuotes ? (
            <LoadingArea panel className="h-64 py-0" label="Loading quote requests" />
          ) : (
            <DataTable
              columns={quoteColumns}
              data={filteredQuotes}
              getRowKey={(q) => q.id}
              empty={
                <div className="rounded-xl border border-border bg-surface-subtle">
                  <EmptyState
                    icon={Sparkles}
                    title={hasQuoteFilters ? "No matching quotes" : "No quote requests yet"}
                    description={
                      hasQuoteFilters
                        ? "Try adjusting your filters."
                        : "Price a bespoke request in the calculator and save it here, so the figure survives the conversation."
                    }
                    action={
                      <Button
                        variant="outline"
                        className="border-border bg-surface-card"
                        onClick={() => setTab("calculator")}
                      >
                        <Calculator className="h-4 w-4" />
                        Open the calculator
                      </Button>
                    }
                  />
                </div>
              }
            />
          )}
        </>
      ) : null}

      <RuleDialog open={showRule} onOpenChange={setShowRule} templates={templates} onSubmit={handleAddRule} />
    </MainScreenWrapper>
  );
}

export default LicensePricingScreen;
