"use client";

import { Button, LogoLoading, Switch } from "@geiger/ui";
import React, { useMemo, useState } from "react";
import { Calculator, FileText, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader, StatsBar, SearchInput, StatusPill, EmptyState, DataTable, Toolbar,
  SectionCard, Field,
} from "@/components/internal/shared/screen_kit";
import {
  USAGE_TYPE_MAP, QUOTE_STATUS_MAP, EXCLUSIVITY_MAP, USAGE_TYPE_FILTER_OPTIONS,
  QUOTE_STATUS_FILTER_OPTIONS, TERRITORY_OPTIONS, CHANNEL_OPTIONS, EXCLUSIVITY_OPTIONS,
  computeLicensePrice, formatMoney,
} from "./constants";
import {
  FilterDropdown, RowActions, ClearFiltersButton, useLicensingRows, CreateDialog,
  TextField, AreaField, SelectField,
} from "./licensing_kit";
import {
  listPriceRules, createPriceRule, updatePriceRule, softDeletePriceRule,
  listQuoteRequests, createQuoteRequest, updateQuoteRequest, softDeleteQuoteRequest,
} from "@/lib/supabase/licensing";

const EMPTY_RULE = { name: "", usageType: "commercial", basePrice: "49.00", notes: "", isActive: true };

function RuleDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const seed = (row) => ({
    name: row?.name ?? "",
    usageType: row?.usageType ?? "commercial",
    basePrice: row ? (Number(row.basePriceCents ?? 0) / 100).toFixed(2) : "49.00",
    notes: row?.notes ?? "",
    isActive: row ? row.isActive !== false : true,
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
      title={editing ? "Edit price rule" : "New price rule"}
      description="A base price per usage type — the calculator multiplies it by the scope ladders."
      submitLabel={editing ? "Save changes" : "Create rule"}
      onSubmit={() => onSubmit(draft)}
    >
      <TextField label="Rule name" value={draft.name} onChange={set("name")} placeholder="e.g. Commercial base" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Usage type" value={draft.usageType} onChange={set("usageType")} options={Object.entries(USAGE_TYPE_MAP).map(([value, m]) => ({ value, label: m.label }))} />
        <TextField label="Base price (USD)" value={draft.basePrice} onChange={set("basePrice")} placeholder="49.00" />
      </div>
      <AreaField label="Notes" value={draft.notes} onChange={set("notes")} placeholder="When does this base apply?" />
      <Field label="Active">
        <div className="flex h-9 items-center">
          <Switch checked={draft.isActive} onCheckedChange={set("isActive")} aria-label="Rule active" />
        </div>
      </Field>
    </CreateDialog>
  );
}

const EMPTY_QUOTE = {
  requesterName: "", requesterEmail: "", usageType: "commercial",
  territories: "", channels: "", durationDays: "30", exclusivity: "non_exclusive",
  estimated: "", status: "pending",
};

function QuoteDialog({ open, onOpenChange, initial, prefill, onSubmit }) {
  const seed = (row, pre) => ({
    requesterName: row?.requesterName ?? "",
    requesterEmail: row?.requesterEmail ?? "",
    usageType: row?.usageType ?? pre?.usageType ?? "commercial",
    territories: row?.territories ?? pre?.territories ?? "",
    channels: row?.channels ?? pre?.channels ?? "",
    durationDays: row ? String(row.durationDays ?? 30) : String(pre?.durationDays ?? 30),
    exclusivity: row?.exclusivity ?? pre?.exclusivity ?? "non_exclusive",
    estimated: row ? (Number(row.estimatedCents ?? 0) / 100).toFixed(2) : (pre?.estimated ?? ""),
    status: row?.status ?? "pending",
  });
  const [draft, setDraft] = useState(() => seed(initial, prefill));
  React.useEffect(() => {
    if (open) setDraft(seed(initial, prefill));
  }, [open, initial, prefill]);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const editing = Boolean(initial);
  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit quote request" : "New quote request"}
      description="A custom quote for usage the ladders don’t cover — record the scope and the estimate."
      submitLabel={editing ? "Save changes" : "Create request"}
      onSubmit={() => onSubmit(draft)}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Requester" value={draft.requesterName} onChange={set("requesterName")} placeholder="e.g. Acme Media" />
        <TextField label="Requester email" value={draft.requesterEmail} onChange={set("requesterEmail")} placeholder="licensing@acme.co" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Usage type" value={draft.usageType} onChange={set("usageType")} options={Object.entries(USAGE_TYPE_MAP).map(([value, m]) => ({ value, label: m.label }))} />
        <SelectField label="Exclusivity" value={draft.exclusivity} onChange={set("exclusivity")} options={EXCLUSIVITY_OPTIONS} />
        <SelectField label="Status" value={draft.status} onChange={set("status")} options={Object.entries(QUOTE_STATUS_MAP).map(([value, m]) => ({ value, label: m.label }))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Territories" value={draft.territories} onChange={set("territories")} placeholder="e.g. Worldwide" />
        <TextField label="Channels" value={draft.channels} onChange={set("channels")} placeholder="e.g. broadcast + digital" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Duration (days)" value={draft.durationDays} onChange={set("durationDays")} placeholder="30" />
        <TextField label="Estimate (USD)" value={draft.estimated} onChange={set("estimated")} placeholder="0.00" />
      </div>
    </CreateDialog>
  );
}

export function LicensePricingScreen({ projectId }) {
  const [rules, setRules, rulesLoading] = useLicensingRows(listPriceRules, projectId);
  const [quotes, setQuotes, quotesLoading] = useLicensingRows(listQuoteRequests, projectId);
  const [search, setSearch] = useState("");
  const [ruleUsage, setRuleUsage] = useState("all");
  const [quoteStatus, setQuoteStatus] = useState("all");
  const [showRule, setShowRule] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [showQuote, setShowQuote] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [quotePrefill, setQuotePrefill] = useState(null);

  // Calculator scope — every change recomputes the price live.
  const [calcRuleId, setCalcRuleId] = useState("");
  const [calcBase, setCalcBase] = useState("49.00");
  const [calcTerritory, setCalcTerritory] = useState("local");
  const [calcDuration, setCalcDuration] = useState("30");
  const [calcChannel, setCalcChannel] = useState("digital");
  const [calcExclusivity, setCalcExclusivity] = useState("non_exclusive");

  const loading = rulesLoading || quotesLoading;

  const activeRules = useMemo(() => rules.filter((r) => r.isActive !== false), [rules]);
  const calcRule = useMemo(
    () => activeRules.find((r) => r.id === calcRuleId) || null,
    [activeRules, calcRuleId],
  );
  const calcBaseCents = useMemo(() => {
    if (calcRule) return calcRule.basePriceCents;
    return Math.max(0, Math.round(Number(String(calcBase).replace(/[^0-9.]/g, "")) * 100) || 0);
  }, [calcRule, calcBase]);
  const calcScope = useMemo(() => ({
    territory: calcTerritory,
    durationDays: Math.max(0, Math.floor(Number(calcDuration) || 0)),
    channel: calcChannel,
    exclusivity: calcExclusivity,
  }), [calcTerritory, calcDuration, calcChannel, calcExclusivity]);
  const quote = useMemo(() => computeLicensePrice(calcBaseCents, calcScope), [calcBaseCents, calcScope]);

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      if (ruleUsage !== "all" && r.usageType !== ruleUsage) return false;
      if (q && !`${r.name} ${r.notes}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rules, search, ruleUsage]);

  const filteredQuotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter((t) => {
      if (quoteStatus !== "all" && t.status !== quoteStatus) return false;
      if (q && !`${t.requesterName} ${t.requesterEmail} ${t.territories}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [quotes, search, quoteStatus]);

  const stats = useMemo(() => {
    const priced = activeRules.filter((r) => (r.basePriceCents ?? 0) > 0);
    const avg = priced.length
      ? Math.round(priced.reduce((s, r) => s + r.basePriceCents, 0) / priced.length)
      : 0;
    const pending = quotes.filter((t) => t.status === "pending");
    const pipeline = quotes
      .filter((t) => t.status === "pending" || t.status === "quoted")
      .reduce((s, t) => s + (t.estimatedCents ?? 0), 0);
    return [
      { label: "Price rules", value: String(activeRules.length), footer: "active base prices" },
      { label: "Avg base", value: formatMoney(avg), footer: "per active rule" },
      { label: "Pending quotes", value: String(pending.length), footer: "awaiting decision" },
      { label: "Pipeline", value: formatMoney(pipeline), footer: "pending + quoted" },
    ];
  }, [activeRules, quotes]);

  const hasFilters = ruleUsage !== "all" || quoteStatus !== "all" || search.trim() !== "";
  const clearFilters = () => {
    setRuleUsage("all");
    setQuoteStatus("all");
    setSearch("");
  };

  const parseDollars = (v) => Math.max(0, Math.round(Number(String(v).replace(/[^0-9.]/g, "")) * 100) || 0);

  const handleCreateRule = async (draft) => {
    if (!draft.name.trim()) return toast.error("Rule name is required");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const payload = {
      name: draft.name.trim(), usageType: draft.usageType,
      basePriceCents: parseDollars(draft.basePrice), notes: draft.notes.trim(),
      isActive: Boolean(draft.isActive),
    };
    const optimistic = { id, projectId, currency: "usd", ...payload, createdAt: now, updatedAt: now };
    setRules((prev) => [optimistic, ...prev]);
    setShowRule(false);
    const created = await createPriceRule({ id, projectId, ...payload });
    if (created) {
      setRules((prev) => prev.map((r) => (r.id === id ? created : r)));
      toast.success("Price rule created");
    } else {
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.error("Could not create rule");
    }
  };

  const handleSaveRule = async (draft) => {
    if (!editingRule) return;
    if (!draft.name.trim()) return toast.error("Rule name is required");
    const prev = rules;
    const patch = {
      name: draft.name.trim(), usageType: draft.usageType,
      basePriceCents: parseDollars(draft.basePrice), notes: draft.notes.trim(),
      isActive: Boolean(draft.isActive),
    };
    setRules((list) => list.map((r) => (r.id === editingRule.id ? { ...r, ...patch } : r)));
    setEditingRule(null);
    const saved = await updatePriceRule(editingRule.id, patch);
    if (!saved) {
      setRules(prev);
      toast.error("Could not save rule");
    } else {
      setRules((list) => list.map((r) => (r.id === editingRule.id ? saved : r)));
      toast.success("Price rule updated");
    }
  };

  const handleDeleteRule = async (rule) => {
    const prev = rules;
    setRules((list) => list.filter((r) => r.id !== rule.id));
    const ok = await softDeletePriceRule(rule.id);
    if (!ok) {
      setRules(prev);
      toast.error("Could not delete rule");
    } else toast.success("Price rule deleted");
  };

  const toQuotePayload = (draft) => ({
    requesterName: draft.requesterName.trim(),
    requesterEmail: draft.requesterEmail.trim(),
    usageType: draft.usageType,
    territories: draft.territories.trim(),
    channels: draft.channels.trim(),
    durationDays: Math.max(0, Math.floor(Number(draft.durationDays) || 0)),
    exclusivity: draft.exclusivity,
    estimatedCents: parseDollars(draft.estimated),
    status: draft.status,
    decidedAt: draft.status === "pending" ? null : new Date().toISOString(),
  });

  const handleCreateQuote = async (draft) => {
    if (!draft.requesterName.trim()) return toast.error("Requester is required");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic = { id, projectId, ...toQuotePayload(draft), createdAt: now, updatedAt: now };
    setQuotes((prev) => [optimistic, ...prev]);
    setShowQuote(false);
    setQuotePrefill(null);
    const created = await createQuoteRequest({ id, projectId, ...toQuotePayload(draft) });
    if (created) {
      setQuotes((prev) => prev.map((t) => (t.id === id ? created : t)));
      toast.success("Quote request created");
    } else {
      setQuotes((prev) => prev.filter((t) => t.id !== id));
      toast.error("Could not create quote request");
    }
  };

  const handleSaveQuote = async (draft) => {
    if (!editingQuote) return;
    if (!draft.requesterName.trim()) return toast.error("Requester is required");
    const prev = quotes;
    const patch = toQuotePayload(draft);
    setQuotes((list) => list.map((t) => (t.id === editingQuote.id ? { ...t, ...patch } : t)));
    setEditingQuote(null);
    const saved = await updateQuoteRequest(editingQuote.id, patch);
    if (!saved) {
      setQuotes(prev);
      toast.error("Could not save quote request");
    } else {
      setQuotes((list) => list.map((t) => (t.id === editingQuote.id ? saved : t)));
      toast.success("Quote request updated");
    }
  };

  const handleDeleteQuote = async (row) => {
    const prev = quotes;
    setQuotes((list) => list.filter((t) => t.id !== row.id));
    const ok = await softDeleteQuoteRequest(row.id);
    if (!ok) {
      setQuotes(prev);
      toast.error("Could not delete quote request");
    } else toast.success("Quote request deleted");
  };

  const openQuoteFromCalculator = () => {
    setEditingQuote(null);
    setQuotePrefill({
      usageType: calcRule?.usageType ?? "commercial",
      territories: "",
      channels: "",
      durationDays: calcScope.durationDays,
      exclusivity: calcScope.exclusivity,
      estimated: (quote.totalCents / 100).toFixed(2),
    });
    setShowQuote(true);
  };

  const ruleColumns = [
    {
      key: "name", header: "Rule",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
          <p className="truncate text-[11px] text-text-tertiary">{r.notes || "—"}</p>
        </div>
      ),
    },
    {
      key: "usage", header: "Usage",
      render: (r) => <StatusPill status={r.usageType} map={USAGE_TYPE_MAP} className="text-[10px]" />,
    },
    {
      key: "base", header: "Base price", align: "right", className: "tabular-nums text-xs",
      render: (r) => formatMoney(r.basePriceCents, r.currency),
    },
    {
      key: "status", header: "Status",
      render: (r) => (
        <StatusPill
          status={r.isActive === false ? "archived" : "active"}
          map={{ active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" }, archived: { label: "Archived", variant: "neutral", dotClass: "bg-zinc-400" } }}
          className="text-[10px]"
        />
      ),
    },
    {
      key: "actions", header: "", align: "right",
      render: (r) => <RowActions onEdit={() => setEditingRule(r)} onDelete={() => handleDeleteRule(r)} />,
    },
  ];

  const quoteColumns = [
    {
      key: "requester", header: "Requester",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{t.requesterName || "—"}</p>
          <p className="truncate text-[11px] text-text-tertiary">{t.requesterEmail || "No email"}</p>
        </div>
      ),
    },
    {
      key: "scope", header: "Scope", className: "hidden text-xs text-text-secondary xl:table-cell", headClassName: "hidden xl:table-cell",
      render: (t) => {
        const bits = [
          t.usageType, t.territories, t.durationDays ? `${t.durationDays}d` : "",
          t.exclusivity === "exclusive" ? "exclusive" : "",
        ].filter(Boolean);
        return bits.join(" · ") || "—";
      },
    },
    {
      key: "estimate", header: "Estimate", align: "right", className: "tabular-nums text-xs",
      render: (t) => formatMoney(t.estimatedCents),
    },
    {
      key: "status", header: "Status",
      render: (t) => <StatusPill status={t.status} map={QUOTE_STATUS_MAP} className="text-[10px]" />,
    },
    {
      key: "actions", header: "", align: "right",
      render: (t) => <RowActions onEdit={() => setEditingQuote(t)} onDelete={() => handleDeleteQuote(t)} />,
    },
  ];

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="License Pricing"
        description="Base prices, scope multipliers, a live calculator, and custom quote requests."
        actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowRule(true)}><Calculator className="mr-1.5 h-4 w-4" />New price rule</Button>}
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex items-center gap-2">
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search rules and quotes…" />
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      ) : (
        <div className="space-y-8">
          <SectionCard
            title="Price calculator"
            description="Pick a base rule and a scope — the total recomputes from the multiplier ladders on every change."
            action={<Button variant="outline" className="border-border bg-surface-card text-foreground hover:bg-surface-active" onClick={openQuoteFromCalculator}><FileText className="mr-1.5 h-4 w-4" />Quote this scope</Button>}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                label="Base rule"
                value={calcRuleId || "custom"}
                onChange={(v) => setCalcRuleId(v === "custom" ? "" : v)}
                options={[{ value: "custom", label: "Custom base…" }, ...activeRules.map((r) => ({ value: r.id, label: `${r.name} · ${formatMoney(r.basePriceCents, r.currency)}` }))]}
              />
              {calcRule ? (
                <Field label="Base price (USD)" hint={calcRule.name}>
                  <div className="flex h-9 items-center rounded-md border border-border bg-surface-card px-3 text-sm tabular-nums text-foreground">
                    {(calcRule.basePriceCents / 100).toFixed(2)}
                  </div>
                </Field>
              ) : (
                <TextField label="Custom base (USD)" value={calcBase} onChange={setCalcBase} placeholder="49.00" />
              )}
              <SelectField label="Territory" value={calcTerritory} onChange={setCalcTerritory} options={TERRITORY_OPTIONS} />
              <TextField label="Duration (days)" value={calcDuration} onChange={setCalcDuration} placeholder="30" />
              <SelectField label="Channel" value={calcChannel} onChange={setCalcChannel} options={CHANNEL_OPTIONS} />
              <SelectField label="Exclusivity" value={calcExclusivity} onChange={setCalcExclusivity} options={EXCLUSIVITY_OPTIONS} />
            </div>
            <div className="mt-4 rounded-lg border border-border bg-surface-card p-4">
              <div className="space-y-1.5">
                {quote.lines.map((line) => (
                  <div key={line.label} className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">{line.label}</span>
                    <span className="text-text-tertiary">{line.detail}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-medium text-foreground">Computed price</span>
                <span className="text-2xl font-bold tabular-nums text-foreground">{formatMoney(quote.totalCents)}</span>
              </div>
              <p className="mt-1 text-[11px] text-text-tertiary">
                {formatMoney(quote.baseCents)} base{quote.durationLabel ? ` · ${quote.durationLabel.toLowerCase()}` : ""} · {EXCLUSIVITY_MAP[calcExclusivity]?.label ?? ""}
              </p>
            </div>
          </SectionCard>

          <SectionCard
            title="Base prices"
            description="One base per usage type. The calculator multiplies these by the scope ladders."
            action={<Button variant="outline" className="border-border bg-surface-card text-foreground hover:bg-surface-active" onClick={() => setShowRule(true)}><Calculator className="mr-1.5 h-4 w-4" />New rule</Button>}
          >
            <div className="flex flex-wrap items-center gap-2 pb-4">
              <FilterDropdown value={ruleUsage} onValueChange={setRuleUsage} options={USAGE_TYPE_FILTER_OPTIONS} placeholder="Usage" icon={SlidersHorizontal} />
            </div>
            <DataTable
              columns={ruleColumns}
              data={filteredRules}
              getRowKey={(r) => r.id}
              onRowClick={setEditingRule}
              empty={(
                <EmptyState
                  icon={Calculator}
                  title="No price rules yet"
                  description="Add a base price so the calculator has something to multiply."
                  action={<Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowRule(true)}><Calculator className="mr-1.5 h-4 w-4" />New rule</Button>}
                />
              )}
            />
          </SectionCard>

          <SectionCard
            title="Custom quote requests"
            description="Out-of-ladder usage — record the scope, estimate, and decision."
            action={<Button variant="outline" className="border-border bg-surface-card text-foreground hover:bg-surface-active" onClick={() => { setEditingQuote(null); setQuotePrefill(null); setShowQuote(true); }}><FileText className="mr-1.5 h-4 w-4" />New request</Button>}
          >
            <div className="flex flex-wrap items-center gap-2 pb-4">
              <FilterDropdown value={quoteStatus} onValueChange={setQuoteStatus} options={QUOTE_STATUS_FILTER_OPTIONS} placeholder="Status" icon={SlidersHorizontal} />
            </div>
            <DataTable
              columns={quoteColumns}
              data={filteredQuotes}
              getRowKey={(t) => t.id}
              onRowClick={setEditingQuote}
              empty={(
                <EmptyState
                  icon={FileText}
                  title="No quote requests"
                  description="Custom scopes land here — or send the calculator’s scope straight in."
                  action={<Button variant="outline" className="border-border bg-surface-card text-foreground hover:bg-surface-active" onClick={openQuoteFromCalculator}><FileText className="mr-1.5 h-4 w-4" />Quote calculator scope</Button>}
                />
              )}
            />
          </SectionCard>
        </div>
      )}
      <RuleDialog open={showRule} onOpenChange={setShowRule} onSubmit={handleCreateRule} />
      {editingRule ? (
        <RuleDialog open={Boolean(editingRule)} onOpenChange={(v) => !v && setEditingRule(null)} initial={editingRule} onSubmit={handleSaveRule} />
      ) : null}
      <QuoteDialog
        open={showQuote}
        onOpenChange={(v) => { if (!v) setQuotePrefill(null); setShowQuote(v); }}
        prefill={quotePrefill}
        onSubmit={handleCreateQuote}
      />
      {editingQuote ? (
        <QuoteDialog open={Boolean(editingQuote)} onOpenChange={(v) => !v && setEditingQuote(null)} initial={editingQuote} onSubmit={handleSaveQuote} />
      ) : null}
    </MainScreenWrapper>
  );
}

export default LicensePricingScreen;
