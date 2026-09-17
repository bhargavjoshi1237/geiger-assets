"use client";

import { Button, DropdownMenuItem, LogoLoading } from "@geiger/ui";
import React, { useMemo, useState } from "react";
import { ArrowUpDown, BadgeDollarSign, CreditCard, ReceiptText, RotateCcw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
import {
  ScreenHeader, StatsBar, SearchInput, StatusPill, EmptyState, DataTable, Toolbar,
  SectionCard, SettingsList, SettingRow,
} from "@/components/internal/shared/screen_kit";
import { SUB_STATUS_META } from "@/components/internal/screens/projects/creator/constants";
import { INVOICE_STATUS_META, PROVIDER_META, statusFilterOptions, formatMoney, formatDate, parseDollarsToCents } from "./constants";
import { FilterDropdown, RowActions, ClearFiltersButton, useCreatorRows as useMembershipRows, CreateDialog, TextField } from "@/components/internal/screens/projects/creator/creator_kit";
import { listInvoices, createInvoice, updateInvoice, softDeleteInvoice } from "@/lib/supabase/memberships";
import { listMembers, listSubscriptions, listTiers } from "@/lib/supabase/creator";

const STATUS_FILTERS = statusFilterOptions(INVOICE_STATUS_META, "All statuses");

const SORT_OPTIONS = [
  { value: "updated-desc", label: "Recently updated" },
  { value: "updated-asc", label: "Least recently updated" },
  { value: "due-asc", label: "Due soonest" },
  { value: "due-desc", label: "Due latest" },
  { value: "amount-desc", label: "Highest amount" },
  { value: "amount-asc", label: "Lowest amount" },
];

function InvoiceDialog({ open, onOpenChange, members, providerLabel, onSubmit }) {
  const [memberId, setMemberId] = useState("all");
  const [amount, setAmount] = useState("9.99");
  const [dueAt, setDueAt] = useState("");
  React.useEffect(() => {
    if (!open) return;
    setMemberId("all");
    setAmount("9.99");
    setDueAt("");
  }, [open]);
  return (
    <CreateDialog open={open} onOpenChange={onOpenChange} title="New invoice" description={`One-off or renewal charge — collected via ${providerLabel}.`} submitLabel="Create invoice" onSubmit={() => onSubmit({ memberId, amountCents: parseDollarsToCents(amount), dueAt })}>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground">Member</label>
        <FilterDropdown value={memberId} onValueChange={setMemberId} options={[{ value: "all", label: "Select member" }, ...members.map((m) => ({ value: m.id, label: m.fanName || m.fanEmail || m.id.slice(0, 8) }))]} placeholder="Member" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Amount (USD)" value={amount} onChange={setAmount} placeholder="9.99" />
        <TextField label="Due date" value={dueAt} onChange={setDueAt} placeholder="YYYY-MM-DD" hint="Blank means due on receipt" />
      </div>
    </CreateDialog>
  );
}

export function RecurringBillingScreen({ projectId }) {
  const [rows, setRows, loading] = useMembershipRows(listInvoices, projectId);
  const [members] = useMembershipRows(listMembers, projectId);
  const [subscriptions] = useMembershipRows(listSubscriptions, projectId);
  const [tiers] = useMembershipRows(listTiers, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortValue, setSortValue] = useState("updated-desc");
  const [showCreate, setShowCreate] = useState(false);
  const [provider, setProvider] = useState("manual");
  const [portalEnabled, setPortalEnabled] = useState(true);
  const [autoRetry, setAutoRetry] = useState(true);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);

  const memberLabel = (id) => memberById.get(id)?.fanName || memberById.get(id)?.fanEmail || "—";

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((inv) => inv.number.toLowerCase().includes(q) || memberLabel(inv.memberId).toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((inv) => inv.status === statusFilter);
    const [field, direction] = sortValue.split("-");
    r.sort((a, b) => {
      let cmp = 0;
      if (field === "updated") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
      else if (field === "due") cmp = new Date(a.dueAt || a.createdAt) - new Date(b.dueAt || b.createdAt);
      else if (field === "amount") cmp = a.amountCents - b.amountCents;
      return direction === "desc" ? -cmp : cmp;
    });
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, statusFilter, sortValue, memberById]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${statusFilter}|${sortValue}`,
  });

  const dunning = useMemo(() => rows.filter((inv) => inv.status === "failed" || inv.status === "past_due").sort((a, b) => new Date(a.dueAt || a.createdAt) - new Date(b.dueAt || b.createdAt)), [rows]);

  const renewals = useMemo(() => subscriptions.filter((s) => s.status === "active" || s.status === "trialing").sort((a, b) => new Date(a.currentPeriodEnd || a.createdAt) - new Date(b.currentPeriodEnd || b.createdAt)).slice(0, 6), [subscriptions]);

  const stats = useMemo(() => {
    const outstanding = rows.filter((inv) => inv.status === "open" || inv.status === "past_due").reduce((s, inv) => s + inv.amountCents, 0);
    const collected = rows.filter((inv) => inv.status === "paid").reduce((s, inv) => s + inv.amountCents, 0);
    return [
      { label: "Outstanding", value: formatMoney(outstanding), footer: "open + past due" },
      { label: "Past due", value: String(rows.filter((inv) => inv.status === "past_due").length), footer: "needs dunning" },
      { label: "Failed", value: String(rows.filter((inv) => inv.status === "failed").length), footer: "in dunning queue" },
      { label: "Collected", value: formatMoney(collected), footer: "paid invoices" },
    ];
  }, [rows]);

  const handleCreate = async ({ memberId, amountCents, dueAt }) => {
    if (memberId === "all") return toast.error("Pick a member");
    if (!amountCents || amountCents <= 0) return toast.error("Amount must be greater than zero");
    const id = crypto.randomUUID();
    const number = `INV-${String(Date.now()).slice(-6)}`;
    const optimistic = { id, projectId, memberId, subscriptionId: null, number, status: "open", amountCents, currency: "usd", provider, dueAt: dueAt || "", paidAt: "", attemptCount: 0, lastError: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setRows((prev) => [optimistic, ...prev]);
    setShowCreate(false);
    const created = await createInvoice({ id, projectId, memberId, number, amountCents, provider, dueAt: dueAt || null });
    if (created) {
      setRows((prev) => prev.map((inv) => (inv.id === id ? created : inv)));
      toast.success("Invoice created");
    } else {
      setRows((prev) => prev.filter((inv) => inv.id !== id));
      toast.error("Could not create invoice");
    }
  };

  const persistStatus = async (invoice, patch, successMessage) => {
    const prev = rows;
    setRows((list) => list.map((inv) => (inv.id === invoice.id ? { ...inv, ...patch } : inv)));
    const saved = await updateInvoice(invoice.id, patch);
    if (!saved) {
      setRows(prev);
      toast.error("Could not update invoice");
    } else {
      setRows((list) => list.map((inv) => (inv.id === invoice.id ? saved : inv)));
      toast.success(successMessage);
    }
  };

  const handleRetry = (invoice) => persistStatus(invoice, { status: "open", attemptCount: invoice.attemptCount + 1, lastError: "" }, `Retry queued for ${invoice.number}`);

  const handleRetryAll = async () => {
    for (const invoice of dunning) {
      await persistStatus(invoice, { status: "open", attemptCount: invoice.attemptCount + 1, lastError: "" }, `Retry queued for ${invoice.number}`);
    }
  };

  const handleDelete = async (invoice) => {
    const prev = rows;
    setRows((list) => list.filter((inv) => inv.id !== invoice.id));
    const ok = await softDeleteInvoice(invoice.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete invoice");
    } else toast.success("Invoice deleted");
  };

  const columns = [
    { key: "invoice", header: "Invoice", render: (inv) => (<div className="min-w-0"><p className="font-mono text-sm font-semibold text-foreground">{inv.number}</p><p className="truncate text-[11px] text-text-tertiary">{memberLabel(inv.memberId)}</p></div>) },
    { key: "amount", header: "Amount", className: "tabular-nums text-xs", render: (inv) => formatMoney(inv.amountCents, inv.currency) },
    { key: "status", header: "Status", render: (inv) => <StatusPill status={inv.status} map={INVOICE_STATUS_META} className="text-[10px]" /> },
    { key: "due", header: "Due", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell", render: (inv) => formatDate(inv.dueAt) },
    { key: "actions", header: "", align: "right", render: (inv) => (
      <RowActions
        onEdit={() => persistStatus(inv, { status: "paid", paidAt: new Date().toISOString() }, `${inv.number} marked paid`)}
        onDelete={() => handleDelete(inv)}
        extra={(
          <>
            <DropdownMenuItem className="cursor-pointer text-xs focus:bg-surface-hover" onClick={() => handleRetry(inv)}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> Retry payment
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-xs focus:bg-surface-hover" onClick={() => persistStatus(inv, { status: "refunded" }, `${inv.number} refunded`)}>
              <BadgeDollarSign className="mr-2 h-3.5 w-3.5" /> Refund
            </DropdownMenuItem>
          </>
        )}
      />
    ) },
  ];

  const renewalColumns = [
    { key: "member", header: "Member", render: (s) => (<div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{memberLabel(s.memberId)}</p><p className="truncate text-[11px] text-text-tertiary">{tierById.get(s.tierId)?.name || "—"}</p></div>) },
    { key: "status", header: "Status", render: (s) => <StatusPill status={s.status} map={SUB_STATUS_META} className="text-[10px]" /> },
    { key: "renews", header: "Renews", align: "right", className: "text-right text-xs text-text-secondary", render: (s) => formatDate(s.currentPeriodEnd) },
  ];

  const hasFilters = statusFilter !== "all" || Boolean(search);

  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
  };

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader title="Recurring Billing" description="Renewals, invoices, failed-payment recovery, and refunds — providers stay configuration only." actions={<Button className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><ReceiptText className="mr-1.5 h-4 w-4" />New invoice</Button>} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={sortValue} onValueChange={setSortValue} options={SORT_OPTIONS} placeholder="Sort" icon={ArrowUpDown} />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search invoices..." />
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable columns={columns} data={pager.pageItems} getRowKey={(inv) => inv.id} empty={<div className="rounded-xl border border-border bg-surface-subtle">{rows.length === 0 ? (<EmptyState icon={ReceiptText} title="No invoices yet" description="Create an invoice to charge a member outside their subscription." action={<Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}><ReceiptText className="mr-1.5 h-4 w-4" />New invoice</Button>} />) : (<EmptyState icon={ReceiptText} title="No matching invoices" description="No invoices matches the current search and filter." action={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>} />)}</div>} />
          <ListPagination {...pager} itemLabel="invoices" />
          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard
              title="Dunning queue"
              description="Failed and past-due payments awaiting retry."
              action={dunning.length ? (<Button variant="outline" size="sm" className="h-8 border-border bg-surface-card text-xs text-foreground hover:bg-surface-active" onClick={handleRetryAll}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Retry all</Button>) : null}
            >
              {dunning.length === 0 ? (
                <p className="rounded-lg border border-border bg-surface-card px-4 py-6 text-center text-sm text-text-tertiary">Queue clear — no failed or past-due payments.</p>
              ) : (
                <div className="space-y-2">
                  {dunning.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{inv.number} · {formatMoney(inv.amountCents, inv.currency)}</p>
                        <p className="truncate text-[11px] text-text-tertiary">{memberLabel(inv.memberId)}{inv.lastError ? ` · ${inv.lastError}` : ""} · attempt {inv.attemptCount + 1}</p>
                      </div>
                      <Button variant="outline" size="sm" className="h-8 shrink-0 border-border bg-surface-subtle text-xs text-foreground hover:bg-surface-active" onClick={() => handleRetry(inv)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Retry</Button>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
            <SectionCard title="Renewal schedule" description="Upcoming subscription renewals.">
              {renewals.length === 0 ? (
                <p className="rounded-lg border border-border bg-surface-card px-4 py-6 text-center text-sm text-text-tertiary">No active subscriptions renewing.</p>
              ) : (
                <DataTable columns={renewalColumns} data={renewals} getRowKey={(s) => s.id} />
              )}
            </SectionCard>
          </div>
          <SectionCard title="Billing settings" description="Provider and self-serve portal configuration.">
            <SettingsList>
              <SettingRow
                title="Payment provider"
                description="Configuration only — invoices are recorded here, never charged through this UI."
                icon={CreditCard}
                control={(
                  <FilterDropdown value={provider} onValueChange={(v) => { setProvider(v); toast.success(`Billing provider set to ${PROVIDER_META[v]?.label} (configuration only)`); }} options={Object.entries(PROVIDER_META).map(([value, m]) => ({ value, label: m.label }))} placeholder="Provider" />
                )}
              />
              <SettingRow title="Customer portal" description="Members manage payment methods and invoices themselves." checked={portalEnabled} onCheckedChange={setPortalEnabled} />
              <SettingRow title="Automatic retries" description="Retry failed subscription payments before they enter dunning." checked={autoRetry} onCheckedChange={setAutoRetry} />
            </SettingsList>
          </SectionCard>
        </div>
      )}
      <InvoiceDialog open={showCreate} onOpenChange={setShowCreate} members={members} providerLabel={PROVIDER_META[provider]?.label ?? "manual invoicing"} onSubmit={handleCreate} />
    </MainScreenWrapper>
  );
}

export default RecurringBillingScreen;
