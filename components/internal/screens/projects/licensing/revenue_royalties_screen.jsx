"use client";

import React, { useMemo, useState } from "react";
import {
  BadgeCheck,
  CircleDollarSign,
  FileText,
  Plus,
  Receipt,
  Scale,
  SlidersHorizontal,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
} from "recharts";
import { toast } from "sonner";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Switch } from "@geiger/ui/switch";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@geiger/ui/chart";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
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
import { ExportButton } from "./licensing_kit";
import {
  CHANNELS,
  CHART_PRIMARY,
  CHART_SEPARATOR,
  CHART_SERIES_OPACITY,
  ROYALTY_LINE_STATUS_META,
  SCOPE_KIND_OPTIONS,
  STATEMENT_STATUS_META,
  TERRITORIES,
  centsToDollarString,
  compactMoney,
  formatDate,
  formatMoney,
  formatPercent,
  labelFor,
  optionsFromMeta,
  parseDollarsToCents,
  today,
} from "./constants";
import {
  accrueForLicense,
  buildStatement,
  groupRevenue,
  revenueByMonth,
} from "./royalty_engine";
import {
  createRoyaltyLines,
  createRoyaltyRule,
  createStatement,
  deleteRoyaltyRule,
  deleteStatement,
  listRoyaltyLines,
  listRoyaltyRules,
  listStatements,
  updateRoyaltyLine,
  updateRoyaltyRule,
  updateStatement,
} from "@/lib/supabase/royalties";
import { listLicensees, listLicenseItems, listLicenses, listTemplates } from "@/lib/supabase/licensing";
import { listRightsHolders } from "@/lib/supabase/rights";
import { listAssets } from "@/lib/supabase/assets";
import { listCollections } from "@/lib/supabase/collections";

const TABS = [
  { value: "revenue", label: "Revenue", icon: CircleDollarSign },
  { value: "rules", label: "Royalty rules", icon: Scale },
  { value: "lines", label: "Accruals", icon: Receipt },
  { value: "statements", label: "Statements", icon: FileText },
];

const SCOPE_KIND_LABELS = new Map(SCOPE_KIND_OPTIONS.map((o) => [o.value, o.label]));
const LINE_STATUS_FILTERS = optionsFromMeta(ROYALTY_LINE_STATUS_META, "All statuses");
const STATEMENT_STATUS_FILTERS = optionsFromMeta(STATEMENT_STATUS_META, "All statuses");
const BREAKDOWN_OPTIONS = [
  { value: "territory", label: "By territory" },
  { value: "channel", label: "By channel" },
  { value: "usage", label: "By usage type" },
];

function RuleDialog({ open, onOpenChange, holders, templates, assets, collections, onSubmit }) {
  const [draft, setDraft] = useState({
    rightsHolderId: "",
    label: "",
    scopeKind: "global",
    scopeId: "",
    ratePercent: "15",
    flatCents: "0",
    minimumGuaranteeCents: "0",
    recoupable: false,
    priority: "0",
  });
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  React.useEffect(() => {
    if (!open) return;
    setDraft({
      rightsHolderId: "",
      label: "",
      scopeKind: "global",
      scopeId: "",
      ratePercent: "15",
      flatCents: "0",
      minimumGuaranteeCents: "0",
      recoupable: false,
      priority: "0",
    });
  }, [open]);

  const scopeOptions = useMemo(() => {
    if (draft.scopeKind === "asset") return assets.slice(0, 200).map((a) => ({ value: a.id, label: a.name || a.fileName || a.id.slice(0, 8) }));
    if (draft.scopeKind === "collection") return collections.map((c) => ({ value: c.id, label: c.name || "Untitled collection" }));
    if (draft.scopeKind === "template") return templates.map((t) => ({ value: t.id, label: t.name }));
    return [];
  }, [draft.scopeKind, assets, collections, templates]);

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New royalty rule"
      description="What a rights holder earns from licence revenue. The most specific matching rule wins per holder."
      submitLabel="Add rule"
      onSubmit={() => onSubmit(draft)}
    >
      <FormSection title="Who is owed" description="The holder this rule pays, and what to call it on a statement.">
        <FieldRow>
          <SelectField
            label="Rights holder"
            value={draft.rightsHolderId}
            onChange={set("rightsHolderId")}
            options={[{ value: "", label: "Select a holder" }, ...holders.map((h) => ({ value: h.id, label: h.name }))]}
            placeholder="Select a holder"
          />
          <TextField label="Label" value={draft.label} onChange={set("label")} placeholder="e.g. Photographer share" />
        </FieldRow>
      </FormSection>

      <FormSection title="When it applies" description="The most specific matching rule wins per holder.">
        <FieldRow>
          <SelectField label="Applies to" value={draft.scopeKind} onChange={set("scopeKind")} options={SCOPE_KIND_OPTIONS} placeholder="Scope" />
          {draft.scopeKind === "global" || draft.scopeKind === "rights_record" ? null : (
            <SelectField label="Which one" value={draft.scopeId} onChange={set("scopeId")} options={[{ value: "", label: "Select" }, ...scopeOptions]} placeholder="Select" />
          )}
        </FieldRow>
      </FormSection>

      <FormSection title="What it pays">
        <FieldRow columns={3}>
          <TextField label="Rate (%)" value={draft.ratePercent} onChange={set("ratePercent")} placeholder="15" inputMode="decimal" />
          <MoneyField label="Flat per licence" value={draft.flatCents} onChange={set("flatCents")} />
          <TextField label="Priority" value={draft.priority} onChange={set("priority")} placeholder="0" hint="Lower wins ties." inputMode="numeric" />
        </FieldRow>
        <FieldRow>
          <MoneyField label="Minimum guarantee" value={draft.minimumGuaranteeCents} onChange={set("minimumGuaranteeCents")} />
          <Field label="Recoupable" hint="Treat the guarantee as an advance to earn back.">
            <div className="flex h-10 items-center">
              <Switch checked={draft.recoupable} onCheckedChange={set("recoupable")} />
            </div>
          </Field>
        </FieldRow>
      </FormSection>
    </CreateDialog>
  );
}

function StatementDialog({ open, onOpenChange, holders, onSubmit }) {
  const [holderId, setHolderId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState(today());
  const [note, setNote] = useState("");

  React.useEffect(() => {
    if (!open) return;
    setHolderId("");
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    setPeriodStart(start.toISOString().slice(0, 10));
    setPeriodEnd(today());
    setNote("");
  }, [open]);

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Generate statement"
      description="Rolls every un-statemented accrual in the period into one statement, applying the guarantee and recoupment."
      submitLabel="Generate"
      onSubmit={() => onSubmit({ holderId, periodStart, periodEnd, note })}
    >
      <SelectField
        label="Rights holder"
        value={holderId}
        onChange={setHolderId}
        options={[{ value: "", label: "Select a holder" }, ...holders.map((h) => ({ value: h.id, label: h.name }))]}
        placeholder="Select a holder"
      />
      <FieldRow>
        <DateField label="Period start" value={periodStart} onChange={setPeriodStart} clearable={false} />
        <DateField label="Period end" value={periodEnd} onChange={setPeriodEnd} clearable={false} />
      </FieldRow>
      <TextAreaField label="Note" value={note} onChange={setNote} rows={2} placeholder="Anything the holder should see." />
    </CreateDialog>
  );
}

export function RevenueRoyaltiesScreen({ projectId }) {
  const [licenses] = useModuleRows(listLicenses, projectId);
  const [licensees] = useModuleRows(listLicensees, projectId);
  const [items] = useModuleRows(listLicenseItems, projectId);
  const [templates] = useModuleRows(listTemplates, projectId);
  const [holders] = useModuleRows(listRightsHolders, projectId);
  const [rules, setRules, loadingRules] = useModuleRows(listRoyaltyRules, projectId);
  const [lines, setLines, loadingLines] = useModuleRows(listRoyaltyLines, projectId);
  const [statements, setStatements, loadingStatements] = useModuleRows(listStatements, projectId);
  const [assets] = useModuleRows(listAssets, projectId);
  const [collections] = useModuleRows(listCollections, projectId);

  const [tab, setTab] = useState("revenue");
  const [breakdown, setBreakdown] = useState("territory");
  const [search, setSearch] = useState("");
  const [lineStatus, setLineStatus] = useState("all");
  const [statementStatus, setStatementStatus] = useState("all");
  const [holderFilter, setHolderFilter] = useState("all");
  const [showRule, setShowRule] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [accruing, setAccruing] = useState(false);

  const holderById = useMemo(() => new Map(holders.map((h) => [h.id, h])), [holders]);
  const licenseById = useMemo(() => new Map(licenses.map((l) => [l.id, l])), [licenses]);
  const licenseeById = useMemo(() => new Map(licensees.map((l) => [l.id, l])), [licensees]);
  const itemsByLicense = useMemo(() => {
    const grouped = new Map();
    for (const item of items) {
      if (!grouped.has(item.licenseId)) grouped.set(item.licenseId, []);
      grouped.get(item.licenseId).push(item);
    }
    return grouped;
  }, [items]);

  const HOLDER_FILTERS = useMemo(
    () => [{ value: "all", label: "All rights holders" }, ...holders.map((h) => ({ value: h.id, label: h.name }))],
    [holders],
  );

  const revenueSeries = useMemo(() => {
    const buckets = revenueByMonth(licenses);
    return buckets.map((b) => ({ month: b.month, value: Math.round(b.cents / 100) }));
  }, [licenses]);

  const mixData = useMemo(() => {
    const keyFn = (license) => {
      if (breakdown === "territory") return license.territories;
      if (breakdown === "channel") return license.channels;
      return [license.usageType];
    };
    const options = breakdown === "territory" ? TERRITORIES : breakdown === "channel" ? CHANNELS : [];
    const labelOf = (key) => options.find((o) => o.value === key)?.label || key.replace(/_/g, " ");
    return groupRevenue(licenses, keyFn)
      .slice(0, 5)
      .map((entry, i) => ({
        key: entry.key,
        label: labelOf(entry.key),
        value: Math.round(entry.cents / 100),
        fill: CHART_PRIMARY,
        fillOpacity: CHART_SERIES_OPACITY[i % CHART_SERIES_OPACITY.length],
      }));
  }, [licenses, breakdown]);

  const stats = useMemo(() => {
    const revenue = licenses.reduce((sum, l) => sum + (l.feeCents || 0), 0);
    const accrued = lines
      .filter((l) => l.status !== "void")
      .reduce((sum, l) => sum + (l.amountCents || 0), 0);
    const paid = lines.filter((l) => l.status === "paid").reduce((sum, l) => sum + (l.amountCents || 0), 0);
    const unrecouped = statements.reduce(
      (sum, s) => sum + Math.max(0, (s.minimumGuaranteeCents || 0) - (s.recoupedCents || 0)),
      0,
    );
    return [
      { label: "Licence revenue", value: compactMoney(revenue), footer: `${licenses.length} licences` },
      { label: "Royalties accrued", value: compactMoney(accrued), footer: `${lines.length} lines` },
      { label: "Owed to holders", value: compactMoney(accrued - paid), footer: "not yet paid" },
      { label: "Unrecouped MG", value: compactMoney(unrecouped), footer: "advances outstanding" },
    ];
  }, [licenses, lines, statements]);

  const filteredLines = useMemo(() => {
    let list = [...lines];
    if (lineStatus !== "all") list = list.filter((l) => l.status === lineStatus);
    if (holderFilter !== "all") list = list.filter((l) => l.rightsHolderId === holderFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          (holderById.get(l.rightsHolderId)?.name ?? "").toLowerCase().includes(q) ||
          (licenseById.get(l.licenseId)?.reference ?? "").toLowerCase().includes(q) ||
          l.note.toLowerCase().includes(q),
      );
    }
    return list;
  }, [lines, lineStatus, holderFilter, search, holderById, licenseById]);

  const filteredStatements = useMemo(() => {
    let list = [...statements];
    if (statementStatus !== "all") list = list.filter((s) => s.status === statementStatus);
    if (holderFilter !== "all") list = list.filter((s) => s.rightsHolderId === holderFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => (holderById.get(s.rightsHolderId)?.name ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [statements, statementStatus, holderFilter, search, holderById]);

  const filteredRules = useMemo(() => {
    let list = [...rules];
    if (holderFilter !== "all") list = list.filter((r) => r.rightsHolderId === holderFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) => r.label.toLowerCase().includes(q) || (holderById.get(r.rightsHolderId)?.name ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [rules, holderFilter, search, holderById]);

  // Accrue across every licence that has revenue but no lines yet.
  const handleAccrueAll = async () => {
    const already = new Set(lines.map((l) => l.licenseId));
    const drafts = licenses
      .filter((l) => l.feeCents > 0 && !already.has(l.id))
      .flatMap((license) =>
        accrueForLicense(license, rules, itemsByLicense.get(license.id), { projectId }),
      )
      .map((draft) => ({ ...draft, id: crypto.randomUUID() }));

    if (!drafts.length) {
      return toast.error(
        rules.length ? "Every licence with revenue is already accrued." : "Add a royalty rule first.",
      );
    }
    setAccruing(true);
    const created = await createRoyaltyLines(drafts);
    setAccruing(false);
    if (created?.length) {
      setLines((prev) => [...created, ...prev]);
      toast.success(`Accrued ${created.length} royalty line${created.length === 1 ? "" : "s"}`);
      setTab("lines");
    } else {
      toast.error("Could not accrue royalties");
    }
  };

  const handleAddRule = async (draft) => {
    if (!draft.rightsHolderId) return toast.error("Pick a rights holder");
    const id = crypto.randomUUID();
    const payload = {
      id,
      projectId,
      rightsHolderId: draft.rightsHolderId,
      label: draft.label.trim() || "Royalty",
      scopeKind: draft.scopeKind,
      scopeId: draft.scopeKind === "global" ? null : draft.scopeId || null,
      ratePercent: Number(draft.ratePercent) || 0,
      flatCents: parseDollarsToCents(draft.flatCents),
      minimumGuaranteeCents: parseDollarsToCents(draft.minimumGuaranteeCents),
      recoupable: draft.recoupable,
      priority: Number(draft.priority) || 0,
      isActive: true,
    };
    setRules((prev) => [...prev, payload]);
    setShowRule(false);
    const created = await createRoyaltyRule(payload);
    if (created) {
      setRules((prev) => prev.map((r) => (r.id === id ? created : r)));
      toast.success("Royalty rule added");
    } else {
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.error("Could not add the royalty rule");
    }
  };

  const handleToggleRule = async (rule) => {
    const previous = rules;
    setRules((list) => list.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r)));
    const saved = await updateRoyaltyRule(rule.id, { isActive: !rule.isActive });
    if (!saved) {
      setRules(previous);
      toast.error("Could not update the royalty rule");
    }
  };

  const handleDeleteRule = async (rule) => {
    const previous = rules;
    setRules((list) => list.filter((r) => r.id !== rule.id));
    const ok = await deleteRoyaltyRule(rule.id);
    if (ok) toast.success("Royalty rule removed");
    else {
      setRules(previous);
      toast.error("Could not remove the royalty rule");
    }
  };

  const handleVoidLine = async (line) => {
    const previous = lines;
    setLines((list) => list.map((l) => (l.id === line.id ? { ...l, status: "void" } : l)));
    const saved = await updateRoyaltyLine(line.id, { status: "void" });
    if (saved) toast.success("Accrual voided");
    else {
      setLines(previous);
      toast.error("Could not void the accrual");
    }
  };

  const handleGenerateStatement = async ({ holderId, periodStart, periodEnd, note }) => {
    if (!holderId) return toast.error("Pick a rights holder");
    const holder = holderById.get(holderId);
    const { draft, lineIds, lineCount } = buildStatement(holder, lines, {
      periodStart,
      periodEnd,
      rules,
      projectId,
    });
    if (!lineCount) return toast.error("No un-statemented accruals in that period");

    setShowStatement(false);
    const created = await createStatement({ ...draft, id: crypto.randomUUID(), note });
    if (!created) return toast.error("Could not generate the statement");

    setStatements((prev) => [created, ...prev]);
    await Promise.all(
      lineIds.map((id) => updateRoyaltyLine(id, { statementId: created.id, status: "statemented" })),
    );
    setLines((list) =>
      list.map((l) => (lineIds.includes(l.id) ? { ...l, statementId: created.id, status: "statemented" } : l)),
    );
    toast.success(`Statement generated from ${lineCount} accrual${lineCount === 1 ? "" : "s"}`);
    setTab("statements");
  };

  const handleStatementStatus = async (statement, status) => {
    const previous = statements;
    const stamp = new Date().toISOString();
    const patch =
      status === "issued" ? { status, issuedAt: stamp } : status === "paid" ? { status, paidAt: stamp } : { status };
    setStatements((list) => list.map((s) => (s.id === statement.id ? { ...s, ...patch } : s)));
    const saved = await updateStatement(statement.id, patch);
    if (!saved) {
      setStatements(previous);
      return toast.error("Could not update the statement");
    }
    setStatements((list) => list.map((s) => (s.id === saved.id ? saved : s)));

    // Paying a statement settles the accruals it carries.
    if (status === "paid") {
      const ids = lines.filter((l) => l.statementId === statement.id).map((l) => l.id);
      setLines((list) => list.map((l) => (ids.includes(l.id) ? { ...l, status: "paid" } : l)));
      await Promise.all(ids.map((id) => updateRoyaltyLine(id, { status: "paid" })));
    }
    toast.success(`Statement marked ${labelFor(STATEMENT_STATUS_META, status).toLowerCase()}`);
  };

  const handleDeleteStatement = async (statement) => {
    const previous = statements;
    setStatements((list) => list.filter((s) => s.id !== statement.id));
    const ok = await deleteStatement(statement.id);
    if (ok) toast.success("Statement deleted");
    else {
      setStatements(previous);
      toast.error("Could not delete the statement");
    }
  };

  const ruleColumns = [
    {
      key: "holder",
      header: "Rights holder",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {holderById.get(r.rightsHolderId)?.name || "Unassigned"}
          </p>
          <p className="truncate text-[11px] text-text-tertiary">{r.label || "Royalty"}</p>
        </div>
      ),
    },
    {
      key: "scope",
      header: "Applies to",
      className: "text-xs",
      render: (r) => SCOPE_KIND_LABELS.get(r.scopeKind) || r.scopeKind,
    },
    { key: "rate", header: "Rate", align: "right", className: "tabular-nums text-xs", render: (r) => formatPercent(r.ratePercent) },
    {
      key: "flat",
      header: "Flat",
      align: "right",
      className: "hidden tabular-nums text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (r) => (r.flatCents ? formatMoney(r.flatCents) : "—"),
    },
    {
      key: "mg",
      header: "Guarantee",
      align: "right",
      className: "hidden tabular-nums text-xs xl:table-cell",
      headClassName: "hidden xl:table-cell",
      render: (r) =>
        r.minimumGuaranteeCents ? (
          <span>
            {formatMoney(r.minimumGuaranteeCents)}
            {r.recoupable ? <span className="ml-1 text-[10px] text-text-tertiary">recoupable</span> : null}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "active",
      header: "Active",
      render: (r) => (r.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Paused</Badge>),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            onEdit={() => handleToggleRule(r)}
            editLabel={r.isActive ? "Pause rule" : "Activate rule"}
            editIcon={BadgeCheck}
            onDelete={() => handleDeleteRule(r)}
          />
        </div>
      ),
    },
  ];

  const lineColumns = [
    {
      key: "holder",
      header: "Holder",
      render: (l) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {holderById.get(l.rightsHolderId)?.name || "Unassigned"}
          </p>
          <p className="truncate font-mono text-[11px] text-text-tertiary">
            {licenseById.get(l.licenseId)?.reference || "licence removed"}
          </p>
        </div>
      ),
    },
    {
      key: "basis",
      header: "Basis",
      align: "right",
      className: "hidden tabular-nums text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (l) => formatMoney(l.basisCents, l.currency),
    },
    { key: "rate", header: "Rate", align: "right", className: "tabular-nums text-xs text-text-secondary", render: (l) => formatPercent(l.ratePercent) },
    { key: "amount", header: "Amount", align: "right", className: "tabular-nums text-xs font-medium", render: (l) => formatMoney(l.amountCents, l.currency) },
    {
      key: "period",
      header: "Period",
      className: "hidden text-xs text-text-secondary xl:table-cell",
      headClassName: "hidden xl:table-cell",
      render: (l) => (l.periodStart ? formatDate(l.periodStart) : "—"),
    },
    { key: "status", header: "Status", render: (l) => <StatusPill status={l.status} map={ROYALTY_LINE_STATUS_META} className="text-[10px]" /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (l) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions onDelete={() => handleVoidLine(l)} deleteLabel="Void accrual" />
        </div>
      ),
    },
  ];

  const statementColumns = [
    {
      key: "holder",
      header: "Statement",
      render: (s) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {holderById.get(s.rightsHolderId)?.name || "Unassigned"}
          </p>
          <p className="truncate text-[11px] text-text-tertiary">
            {s.periodStart ? formatDate(s.periodStart) : "—"} → {s.periodEnd ? formatDate(s.periodEnd) : "—"}
          </p>
        </div>
      ),
    },
    {
      key: "gross",
      header: "Gross",
      align: "right",
      className: "hidden tabular-nums text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (s) => formatMoney(s.grossCents, s.currency),
    },
    { key: "royalty", header: "Royalty", align: "right", className: "tabular-nums text-xs", render: (s) => formatMoney(s.royaltyCents, s.currency) },
    {
      key: "recouped",
      header: "Recouped",
      align: "right",
      className: "hidden tabular-nums text-xs text-text-secondary xl:table-cell",
      headClassName: "hidden xl:table-cell",
      render: (s) => (s.recoupedCents ? formatMoney(s.recoupedCents, s.currency) : "—"),
    },
    { key: "payable", header: "Payable", align: "right", className: "tabular-nums text-xs font-medium", render: (s) => formatMoney(s.payableCents, s.currency) },
    { key: "status", header: "Status", render: (s) => <StatusPill status={s.status} map={STATEMENT_STATUS_META} className="text-[10px]" /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            extra={[
              ...(s.status === "draft" ? [{ icon: FileText, label: "Mark issued", onSelect: () => handleStatementStatus(s, "issued") }] : []),
              ...(s.status !== "paid" ? [{ icon: BadgeCheck, label: "Mark paid", onSelect: () => handleStatementStatus(s, "paid") }] : []),
            ]}
            onDelete={() => handleDeleteStatement(s)}
          />
        </div>
      ),
    },
  ];

  const revenueExportColumns = [
    { key: "reference", header: "Reference" },
    { key: "title", header: "Title" },
    { key: "licensee", header: "Licensee", value: (l) => licenseeById.get(l.licenseeId)?.name || "" },
    { key: "feeCents", header: "Fee", value: (l) => centsToDollarString(l.feeCents) },
    { key: "royaltyRate", header: "Royalty rate" },
    { key: "startDate", header: "Start" },
    { key: "endDate", header: "End" },
    { key: "status", header: "Status" },
  ];

  const lineExportColumns = [
    { key: "holder", header: "Holder", value: (l) => holderById.get(l.rightsHolderId)?.name || "" },
    { key: "reference", header: "Licence", value: (l) => licenseById.get(l.licenseId)?.reference || "" },
    { key: "basisCents", header: "Basis", value: (l) => centsToDollarString(l.basisCents) },
    { key: "ratePercent", header: "Rate" },
    { key: "amountCents", header: "Amount", value: (l) => centsToDollarString(l.amountCents) },
    { key: "periodStart", header: "Period" },
    { key: "status", header: "Status" },
  ];

  const statementExportColumns = [
    { key: "holder", header: "Holder", value: (s) => holderById.get(s.rightsHolderId)?.name || "" },
    { key: "periodStart", header: "Period start" },
    { key: "periodEnd", header: "Period end" },
    { key: "grossCents", header: "Gross", value: (s) => centsToDollarString(s.grossCents) },
    { key: "royaltyCents", header: "Royalty", value: (s) => centsToDollarString(s.royaltyCents) },
    { key: "recoupedCents", header: "Recouped", value: (s) => centsToDollarString(s.recoupedCents) },
    { key: "payableCents", header: "Payable", value: (s) => centsToDollarString(s.payableCents) },
    { key: "status", header: "Status" },
  ];

  const clearFilters = () => {
    setSearch("");
    setHolderFilter("all");
    setLineStatus("all");
    setStatementStatus("all");
  };
  const hasFilters =
    Boolean(search) || holderFilter !== "all" || lineStatus !== "all" || statementStatus !== "all";

  const topLicences = useMemo(
    () => [...licenses].sort((a, b) => (b.feeCents || 0) - (a.feeCents || 0)).slice(0, 5),
    [licenses],
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Revenue & Royalties"
        description="Licence income, the rightsholder obligations it creates, and the statements that settle them."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-1.5 border-border bg-surface-card text-xs hover:bg-surface-hover"
              onClick={handleAccrueAll}
              disabled={accruing}
            >
              <Receipt className="h-4 w-4" />
              {accruing ? "Accruing…" : "Accrue royalties"}
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowStatement(true)}>
              <Plus className="h-4 w-4" />
              Generate statement
            </Button>
          </div>
        }
      />
      <StatsBar stats={stats} />
      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "revenue" ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <SectionCard title="Licence revenue" description="Fees issued over the last twelve months.">
              <ChartContainer
                config={{ value: { label: "Revenue", color: CHART_PRIMARY } }}
                className="h-[240px] w-full"
              >
                <LineChart data={revenueSeries} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <Line
                    dataKey="value"
                    type="monotone"
                    stroke={CHART_PRIMARY}
                    strokeWidth={2}
                    dot={{ fill: CHART_PRIMARY, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ChartContainer>
            </SectionCard>

            <SectionCard
              title="Revenue mix"
              description="Where the money comes from."
              action={
                <FilterDropdown value={breakdown} onValueChange={setBreakdown} options={BREAKDOWN_OPTIONS} placeholder="Breakdown" height="h-8" />
              }
            >
              {mixData.length ? (
                <div className="space-y-3">
                  <ChartContainer
                    config={Object.fromEntries(mixData.map((d) => [d.key, { label: d.label, color: d.fill }]))}
                    className="mx-auto h-[160px] w-[160px]"
                  >
                    <PieChart>
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="key" />} />
                      <Pie
                        data={mixData}
                        dataKey="value"
                        nameKey="key"
                        innerRadius={40}
                        outerRadius={72}
                        stroke={CHART_SEPARATOR}
                        strokeWidth={2}
                      />
                    </PieChart>
                  </ChartContainer>
                  <ul className="space-y-1">
                    {mixData.map((entry) => (
                      <li key={entry.key} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: entry.fill, opacity: entry.fillOpacity }}
                          />
                          <span className="truncate text-text-secondary">{entry.label}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-foreground">{formatMoney(entry.value * 100)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <EmptyState icon={CircleDollarSign} title="No revenue yet" description="Issue a licence with a fee and it shows up here." />
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Top earning licences"
            description="The biggest fees on file."
            action={<ExportButton filename="licence-revenue" rows={licenses} columns={revenueExportColumns} />}
            bodyPadding={false}
          >
            {topLicences.length ? (
              <ul className="divide-y divide-border">
                {topLicences.map((license) => (
                  <li key={license.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{license.title || license.reference}</p>
                      <p className="truncate text-[11px] text-text-tertiary">
                        {licenseeById.get(license.licenseeId)?.name || "Unassigned"} ·{" "}
                        {license.royaltyRate ? `${formatPercent(license.royaltyRate)} royalty` : "no royalty rate"}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                      {formatMoney(license.feeCents, license.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={CircleDollarSign} title="No licences yet" description="Issue a licence to start tracking revenue." />
            )}
          </SectionCard>
        </div>
      ) : null}

      {tab !== "revenue" ? (
        <Toolbar>
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown value={holderFilter} onValueChange={setHolderFilter} options={HOLDER_FILTERS} placeholder="Rights holder" icon={SlidersHorizontal} />
            {tab === "lines" ? (
              <FilterDropdown value={lineStatus} onValueChange={setLineStatus} options={LINE_STATUS_FILTERS} placeholder="Status" />
            ) : null}
            {tab === "statements" ? (
              <FilterDropdown value={statementStatus} onValueChange={setStatementStatus} options={STATEMENT_STATUS_FILTERS} placeholder="Status" />
            ) : null}
            {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
          </div>
          <div className="flex items-center gap-2">
            {tab === "rules" ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-border bg-surface-card px-2.5 text-xs hover:bg-surface-hover"
                onClick={() => setShowRule(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                New rule
              </Button>
            ) : null}
            {tab === "lines" ? <ExportButton filename="royalty-accruals" rows={filteredLines} columns={lineExportColumns} /> : null}
            {tab === "statements" ? (
              <ExportButton filename="royalty-statements" rows={filteredStatements} columns={statementExportColumns} />
            ) : null}
            <SearchInput value={search} onChange={setSearch} placeholder="Search..." className="w-full sm:w-56" />
          </div>
        </Toolbar>
      ) : null}

      {tab === "rules" ? (
        loadingRules ? (
          <LoadingArea panel className="h-64 py-0" label="Loading royalty rules" />
        ) : (
          <DataTable
            columns={ruleColumns}
            data={filteredRules}
            getRowKey={(r) => r.id}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={Scale}
                  title={hasFilters ? "No matching rules" : "No royalty rules yet"}
                  description={
                    hasFilters
                      ? "Try adjusting your filters."
                      : holders.length
                        ? "Set what each rights holder earns from licence revenue, then accrue against issued licences."
                        : "Add rights holders in Rights Inventory first — royalties are paid to them."
                  }
                  action={
                    holders.length ? (
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowRule(true)}>
                        <Plus className="h-4 w-4" />
                        New rule
                      </Button>
                    ) : null
                  }
                />
              </div>
            }
          />
        )
      ) : null}

      {tab === "lines" ? (
        loadingLines ? (
          <LoadingArea panel className="h-64 py-0" label="Loading accruals" />
        ) : (
          <DataTable
            columns={lineColumns}
            data={filteredLines}
            getRowKey={(l) => l.id}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={Receipt}
                  title={hasFilters ? "No matching accruals" : "Nothing accrued yet"}
                  description={
                    hasFilters
                      ? "Try adjusting your filters."
                      : "Accrue royalties from issued licence fees once a rule covers the rights holder."
                  }
                  action={
                    <Button
                      variant="outline"
                      className="border-border bg-surface-card"
                      onClick={handleAccrueAll}
                      disabled={accruing}
                    >
                      <Receipt className="h-4 w-4" />
                      Accrue royalties
                    </Button>
                  }
                />
              </div>
            }
          />
        )
      ) : null}

      {tab === "statements" ? (
        loadingStatements ? (
          <LoadingArea panel className="h-64 py-0" label="Loading statements" />
        ) : (
          <DataTable
            columns={statementColumns}
            data={filteredStatements}
            getRowKey={(s) => s.id}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={FileText}
                  title={hasFilters ? "No matching statements" : "No statements yet"}
                  description={
                    hasFilters
                      ? "Try adjusting your filters."
                      : "Generate a period statement to roll accruals into one payable figure per rights holder."
                  }
                  action={
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowStatement(true)}>
                      <Plus className="h-4 w-4" />
                      Generate statement
                    </Button>
                  }
                />
              </div>
            }
          />
        )
      ) : null}

      <RuleDialog
        open={showRule}
        onOpenChange={setShowRule}
        holders={holders}
        templates={templates}
        assets={assets}
        collections={collections}
        onSubmit={handleAddRule}
      />
      <StatementDialog open={showStatement} onOpenChange={setShowStatement} holders={holders} onSubmit={handleGenerateStatement} />
    </MainScreenWrapper>
  );
}

export default RevenueRoyaltiesScreen;
