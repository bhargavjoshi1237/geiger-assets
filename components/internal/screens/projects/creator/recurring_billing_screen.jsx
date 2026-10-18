"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Ban, CheckCircle2, CircleX, FilePlus2, Layers, ReceiptText, RefreshCcw, RotateCcw, SlidersHorizontal, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import {
  DataTable,
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  INVOICE_STATUS_META,
  addInterval,
  centsToDollars,
  formatDate,
  formatMoney,
  parseDollarsToCents,
  renewalTerms,
  statusFilterOptions,
  subscriptionMonthlyCents,
} from "./constants";
import {
  ClearFiltersButton,
  CreateDialog,
  DateField,
  FieldRow,
  FilterDropdown,
  MoneyField,
  RowActions,
  SelectField,
  useCreatorRows,
} from "./creator_kit";
import {
  listInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  listSubscriptions,
  updateSubscription,
  mergeSubscriptionMeta,
  listMembers,
  listTiers,
} from "@/lib/supabase/creator";
import { getUser } from "@/lib/supabase/user";

const STATUS_FILTERS = statusFilterOptions(INVOICE_STATUS_META, "All statuses");
const LIVE = new Set(["active", "trialing", "past_due"]);
const UNSETTLED = new Set(["open", "failed"]);
const DAY = 86400000;
const RETRY_DAYS = 3;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nextNumber(invoices) {
  const max = invoices.reduce((m, i) => Math.max(m, Number(String(i.number).replace(/\D/g, "")) || 0), 1000);
  return (offset = 1) => `INV-${max + offset}`;
}

function InvoiceDialog({ open, onOpenChange, subscriptions, memberById, tierById, onSubmit }) {
  const [subscriptionId, setSubscriptionId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueAt, setDueAt] = useState(today());
  React.useEffect(() => {
    if (!open) return;
    setSubscriptionId("");
    setAmount("");
    setDueAt(today());
  }, [open]);

  const options = subscriptions
    .filter((s) => LIVE.has(s.status))
    .map((s) => {
      const m = memberById.get(s.memberId);
      return { value: s.id, label: `${m?.fanName || m?.fanEmail || "Member"} — ${tierById.get(s.tierId)?.name || "tier"}` };
    });

  const pick = (id) => {
    setSubscriptionId(id);
    const sub = subscriptions.find((s) => s.id === id);
    setAmount(centsToDollars(tierById.get(sub?.tierId)?.priceCents));
  };

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New invoice"
      description="Bill a subscription outside its normal renewal — a missed cycle or a manual charge."
      submitLabel="Create invoice"
      onSubmit={() => onSubmit({ subscriptionId, amountCents: parseDollarsToCents(amount), dueAt })}
    >
      <SelectField label="Subscription" value={subscriptionId} onChange={pick} options={options} placeholder={options.length ? "Select subscription" : "No live subscriptions"} disabled={!options.length} />
      <FieldRow>
        <MoneyField label="Amount (USD)" value={amount} onChange={setAmount} hint="Defaults to the tier price." />
        <DateField label="Due" value={dueAt} onChange={setDueAt} clearable={false} />
      </FieldRow>
    </CreateDialog>
  );
}

export function RecurringBillingScreen({ projectId }) {
  const [rows, setRows, loading] = useCreatorRows(listInvoices, projectId);
  const [subscriptions, setSubscriptions] = useCreatorRows(listSubscriptions, projectId);
  const [members] = useCreatorRows(listMembers, projectId);
  const [tiers] = useCreatorRows(listTiers, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [running, setRunning] = useState(false);
  const [now] = useState(() => Date.now());

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const subById = useMemo(() => new Map(subscriptions.map((s) => [s.id, s])), [subscriptions]);
  const tierFilters = useMemo(() => [{ value: "all", label: "All tiers" }, ...tiers.map((t) => ({ value: t.id, label: t.name }))], [tiers]);

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((i) => {
        const m = memberById.get(i.memberId);
        return [i.number, m?.fanName, m?.fanEmail].some((v) => String(v || "").toLowerCase().includes(q));
      });
    }
    if (statusFilter !== "all") r = r.filter((i) => i.status === statusFilter);
    if (tierFilter !== "all") r = r.filter((i) => i.tierId === tierFilter);
    return r;
  }, [rows, search, statusFilter, tierFilter, memberById]);

  const pager = usePagination(filtered, { resetKey: `${search}|${statusFilter}|${tierFilter}` });

  // Live paid subscriptions whose period has ended (or ends today) and that have
  // no unsettled invoice yet — what "Run renewals" will bill.
  const dueRenewals = useMemo(() => {
    const cutoff = now + DAY;
    const unsettled = new Set(rows.filter((i) => UNSETTLED.has(i.status)).map((i) => i.subscriptionId));
    return subscriptions.filter((s) => {
      const tier = tierById.get(s.tierId);
      if (!LIVE.has(s.status) || s.cancelAtPeriodEnd || !tier || tier.isFree || !tier.priceCents) return false;
      const end = new Date(s.currentPeriodEnd).getTime();
      return Number.isFinite(end) && end <= cutoff && !unsettled.has(s.id);
    });
  }, [subscriptions, rows, tierById, now]);

  const endingCancellations = useMemo(
    () => subscriptions.filter((s) => LIVE.has(s.status) && s.cancelAtPeriodEnd && new Date(s.currentPeriodEnd).getTime() <= now),
    [subscriptions, now],
  );

  const stats = useMemo(() => {
    const mrr = subscriptions.filter((s) => s.status === "active").reduce((sum, s) => sum + subscriptionMonthlyCents(s, tierById.get(s.tierId)), 0);
    const since = now - 30 * DAY;
    const collected = rows.filter((i) => i.status === "paid" && new Date(i.paidAt).getTime() >= since).reduce((s, i) => s + i.amountCents, 0);
    const failed = rows.filter((i) => i.status === "failed");
    const upcoming = subscriptions.filter((s) => {
      const end = new Date(s.currentPeriodEnd).getTime();
      return LIVE.has(s.status) && !s.cancelAtPeriodEnd && end > now && end <= now + 7 * DAY;
    }).length;
    return [
      { label: "MRR", value: formatMoney(mrr), footer: `${formatMoney(mrr * 12)} annualised` },
      { label: "Collected (30d)", value: formatMoney(collected), footer: `${rows.filter((i) => i.status === "refunded").length} refunded all-time` },
      { label: "Dunning", value: String(failed.length), footer: `${formatMoney(failed.reduce((s, i) => s + i.amountCents, 0))} at risk` },
      { label: "Renewing in 7 days", value: String(upcoming), footer: `${dueRenewals.length} due to bill now` },
    ];
  }, [rows, subscriptions, tierById, dueRenewals.length, now]);

  const replace = (next) => setRows((list) => list.map((i) => (i.id === next.id ? next : i)));
  const replaceSub = (next) => setSubscriptions((list) => list.map((s) => (s.id === next.id ? next : s)));

  const saveSubscription = async (sub, patch) => {
    if (!sub) return;
    replaceSub({ ...sub, ...patch });
    const saved = await updateSubscription(sub.id, patch);
    if (saved) replaceSub(saved);
    else replaceSub(sub);
  };

  const draftInvoice = (sub, amountCents, dueAt, number, createdBy) => {
    const tier = tierById.get(sub.tierId);
    const start = sub.currentPeriodEnd || new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      projectId,
      number,
      memberId: sub.memberId,
      subscriptionId: sub.id,
      tierId: sub.tierId,
      amountCents,
      currency: tier?.currency || "usd",
      status: "open",
      periodStart: start,
      periodEnd: addInterval(start, sub.cycle || tier?.interval),
      dueAt: dueAt || new Date().toISOString(),
      attemptCount: 0,
      createdBy,
    };
  };

  const insert = async (drafts) => {
    const now = new Date().toISOString();
    setRows((prev) => [...drafts.map((d) => ({ ...d, paidAt: "", nextRetryAt: "", createdAt: now, updatedAt: now })), ...prev]);
    const created = await Promise.all(drafts.map((d) => createInvoice(d)));
    const failed = drafts.filter((_, i) => !created[i]).map((d) => d.id);
    setRows((prev) => prev.filter((i) => !failed.includes(i.id)).map((i) => created.find((c) => c?.id === i.id) || i));
    return drafts.length - failed.length;
  };

  const handleCreate = async ({ subscriptionId, amountCents, dueAt }) => {
    const sub = subById.get(subscriptionId);
    if (!sub) return toast.error("Pick a subscription");
    if (!amountCents) return toast.error("Enter an amount");
    setShowCreate(false);
    const user = await getUser();
    const ok = await insert([draftInvoice(sub, amountCents, dueAt ? new Date(dueAt).toISOString() : null, nextNumber(rows)(), user?.id || null)]);
    if (ok) toast.success("Invoice created");
    else toast.error("Could not create the invoice");
  };

  const runRenewals = async () => {
    if (!dueRenewals.length && !endingCancellations.length) return toast.success("Nothing is due — every subscription is billed");
    setRunning(true);
    const user = await getUser();
    const number = nextNumber(rows);
    const drafts = dueRenewals.map((s, i) => draftInvoice(s, renewalTerms(s, tierById.get(s.tierId)).amountCents, s.currentPeriodEnd, number(i + 1), user?.id || null));
    const billed = drafts.length ? await insert(drafts) : 0;
    // Each discounted renewal uses up one of the promo's remaining periods.
    await Promise.all(
      dueRenewals
        .filter((s) => renewalTerms(s, tierById.get(s.tierId)).discounted)
        .map(async (s) => {
          const saved = await mergeSubscriptionMeta(s.id, { discount: { ...s.discount, remaining: Math.max(0, Number(s.discount.remaining) - 1) } });
          if (saved) replaceSub(saved);
        }),
    );
    await Promise.all(endingCancellations.map((s) => saveSubscription(s, { status: "cancelled", cancelAtPeriodEnd: false })));
    setRunning(false);
    const parts = [];
    if (billed) parts.push(`${billed} renewal invoice${billed === 1 ? "" : "s"} issued`);
    if (endingCancellations.length) parts.push(`${endingCancellations.length} cancellation${endingCancellations.length === 1 ? "" : "s"} closed`);
    if (billed < drafts.length) toast.error(`${drafts.length - billed} invoice${drafts.length - billed === 1 ? "" : "s"} failed to save`);
    if (parts.length) toast.success(parts.join(" · "));
  };

  const patchInvoice = async (invoice, patch, message) => {
    const prev = rows;
    replace({ ...invoice, ...patch });
    const saved = await updateInvoice(invoice.id, patch);
    if (!saved) {
      setRows(prev);
      toast.error("Could not update the invoice");
      return false;
    }
    replace(saved);
    toast.success(message);
    return true;
  };

  // Paying an invoice settles its period: the subscription becomes active and
  // rolls forward to the invoice's period end.
  const markPaid = async (invoice) => {
    const ok = await patchInvoice(invoice, { status: "paid", paidAt: new Date().toISOString(), attemptCount: invoice.attemptCount + 1, nextRetryAt: null }, "Invoice paid");
    const sub = subById.get(invoice.subscriptionId);
    if (ok && sub && LIVE.has(sub.status)) {
      await saveSubscription(sub, { status: "active", currentPeriodStart: invoice.periodStart || sub.currentPeriodEnd, currentPeriodEnd: invoice.periodEnd || addInterval(sub.currentPeriodEnd, sub.cycle || tierById.get(sub.tierId)?.interval) });
    }
  };

  // A failed charge schedules a retry and moves the subscription into dunning.
  const markFailed = async (invoice) => {
    const retry = new Date(Date.now() + RETRY_DAYS * DAY).toISOString();
    const ok = await patchInvoice(invoice, { status: "failed", attemptCount: invoice.attemptCount + 1, nextRetryAt: retry }, `Payment failed — retry ${formatDate(retry)}`);
    const sub = subById.get(invoice.subscriptionId);
    if (ok && sub && LIVE.has(sub.status)) await saveSubscription(sub, { status: "past_due" });
  };

  const handleDelete = async (invoice) => {
    if (invoice.status === "paid" || invoice.status === "refunded") return toast.error("Settled invoices are kept for your records — void or refund instead");
    const prev = rows;
    setRows((list) => list.filter((i) => i.id !== invoice.id));
    const ok = await deleteInvoice(invoice.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete the invoice");
    } else toast.success("Invoice deleted");
  };

  const actionsFor = (i) => {
    if (i.status === "open" || i.status === "failed") {
      return [
        { icon: CheckCircle2, label: "Mark paid", onSelect: () => markPaid(i) },
        { icon: i.status === "failed" ? RotateCcw : CircleX, label: i.status === "failed" ? "Record another failed retry" : "Mark payment failed", onSelect: () => markFailed(i) },
        { icon: Ban, label: "Void", onSelect: () => patchInvoice(i, { status: "void", nextRetryAt: null }, "Invoice voided") },
      ];
    }
    if (i.status === "paid") return [{ icon: Undo2, label: "Refund", onSelect: () => patchInvoice(i, { status: "refunded" }, "Invoice refunded") }];
    return [];
  };

  const columns = [
    {
      key: "invoice",
      header: "Invoice",
      render: (i) => {
        const m = memberById.get(i.memberId);
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{m?.fanName || m?.fanEmail || "Unknown member"}</p>
            <p className="truncate font-mono text-[11px] text-text-tertiary">{i.number || i.id.slice(0, 8)}</p>
          </div>
        );
      },
    },
    {
      key: "tier",
      header: "Tier",
      className: "hidden text-xs sm:table-cell",
      headClassName: "hidden sm:table-cell",
      render: (i) => tierById.get(i.tierId)?.name || "—",
    },
    { key: "amount", header: "Amount", className: "whitespace-nowrap tabular-nums text-xs", render: (i) => formatMoney(i.amountCents, i.currency) },
    { key: "status", header: "Status", render: (i) => <StatusPill status={i.status} map={INVOICE_STATUS_META} className="text-[10px]" /> },
    {
      key: "due",
      header: "Due",
      className: "hidden whitespace-nowrap text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (i) => {
        if (i.status === "paid") return `Paid ${formatDate(i.paidAt)}`;
        if (i.status === "failed") return <span className="text-red-700 dark:text-red-300">Retry {formatDate(i.nextRetryAt)} · attempt {i.attemptCount}</span>;
        return formatDate(i.dueAt);
      },
    },
    {
      key: "period",
      header: "Period",
      className: "hidden whitespace-nowrap text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (i) => `${formatDate(i.periodStart)} – ${formatDate(i.periodEnd)}`,
    },
    { key: "actions", header: "", align: "right", render: (i) => <RowActions extra={actionsFor(i)} onDelete={() => handleDelete(i)} /> },
  ];

  const hasFilters = statusFilter !== "all" || tierFilter !== "all" || Boolean(search);
  const clear = () => {
    setStatusFilter("all");
    setTierFilter("all");
    setSearch("");
  };
  const newInvoice = (
    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}>
      <FilePlus2 className="h-4 w-4" />
      New invoice
    </Button>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Recurring Billing"
        description="Renewal invoices, failed-payment retries and refunds — paying an invoice rolls its subscription forward."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={runRenewals}
              disabled={running || loading}
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Run renewals{dueRenewals.length ? ` (${dueRenewals.length})` : ""}
            </Button>
            {newInvoice}
          </div>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={tierFilter} onValueChange={setTierFilter} options={tierFilters} placeholder="Tier" icon={Layers} />
          {hasFilters ? <ClearFiltersButton onClick={clear} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search invoices..." className="w-full sm:w-64" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" />
      ) : (
        <DataTable
          columns={columns}
          data={pager.pageItems}
          getRowKey={(i) => i.id}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={ReceiptText}
                title={hasFilters ? "No invoices match" : "No invoices yet"}
                description={hasFilters ? "Try adjusting your filters." : "Run renewals to bill subscriptions whose period has ended."}
                action={hasFilters ? <ClearFiltersButton onClick={clear} /> : newInvoice}
              />
            </div>
          }
        />
      )}
      {!loading ? <ListPagination {...pager} itemLabel="invoices" /> : null}
      <InvoiceDialog open={showCreate} onOpenChange={setShowCreate} subscriptions={subscriptions} memberById={memberById} tierById={tierById} onSubmit={handleCreate} />
    </MainScreenWrapper>
  );
}

export default RecurringBillingScreen;
