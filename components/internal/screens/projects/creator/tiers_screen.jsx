"use client";

import React, { useMemo, useState } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, BadgePlus, Layers, Plus, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SettingRow,
  SettingsList,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  TIER_STATUS_META,
  INTERVAL_OPTIONS,
  centsToDollars,
  statusFilterOptions,
  formatMoney,
  formatDate,
  intervalLabel,
  monthlyCents,
  parseDollarsToCents,
} from "./constants";
import {
  FilterDropdown,
  RowActions,
  ClearFiltersButton,
  useCreatorRows,
  CreateDialog,
  FieldRow,
  FormSection,
  MoneyField,
  SelectField,
  TextAreaField,
  TextField,
} from "./creator_kit";
import { listTiers, createTier, updateTier, deleteTier, listSubscriptions } from "@/lib/supabase/creator";

const STATUS_FILTERS = statusFilterOptions({ active: TIER_STATUS_META.active, archived: TIER_STATUS_META.archived }, "All statuses");

const LIVE_SUB_STATUSES = new Set(["active", "trialing", "past_due"]);

function draftOf(tier) {
  return {
    name: tier?.name ?? "",
    price: tier ? centsToDollars(tier.priceCents) : "9.99",
    annualPrice: tier?.annualPriceCents ? centsToDollars(tier.annualPriceCents) : "",
    interval: tier?.interval ?? "month",
    description: tier?.description ?? "",
    perks: tier?.perks ?? [],
    trialDays: tier?.trialDays != null ? String(tier.trialDays) : "0",
    downloadQuota: tier?.downloadQuota != null ? String(tier.downloadQuota) : "",
    gracePeriodDays: tier?.gracePeriodDays != null ? String(tier.gracePeriodDays) : "3",
    isActive: tier ? tier.isActive : true,
  };
}

function toInput(draft) {
  const priceCents = parseDollarsToCents(draft.price);
  const quota = draft.downloadQuota === "" ? null : Math.max(0, Number(draft.downloadQuota) || 0);
  // Only monthly paid tiers sell a year up front.
  const annual = draft.interval === "month" && priceCents > 0 ? parseDollarsToCents(draft.annualPrice) : 0;
  return {
    name: draft.name.trim(),
    priceCents,
    interval: draft.interval,
    description: draft.description.trim(),
    perks: draft.perks,
    isFree: priceCents === 0,
    isActive: draft.isActive,
    metadata: {
      trialDays: Math.max(0, Number(draft.trialDays) || 0),
      annualPriceCents: annual > 0 ? annual : null,
      downloadQuota: quota,
      gracePeriodDays: Math.max(0, Number(draft.gracePeriodDays) || 0),
    },
  };
}

function annualHint(draft) {
  const monthly = parseDollarsToCents(draft.price);
  const annual = parseDollarsToCents(draft.annualPrice);
  if (!annual) return "Optional — adds a Monthly / Annual switch on your page. Leave empty for monthly only.";
  const save = Math.round((1 - annual / (monthly * 12)) * 100);
  return save > 0 ? `Fans save ${save}% versus paying monthly.` : "Higher than 12 monthly payments — fans won't save.";
}

function PerksField({ perks, onChange }) {
  const [value, setValue] = useState("");
  const add = () => {
    const perk = value.trim();
    if (!perk) return;
    if (!perks.some((p) => p.toLowerCase() === perk.toLowerCase())) onChange([...perks, perk]);
    setValue("");
  };
  return (
    <Field label="Perks" hint="Listed on the tier card fans see at signup.">
      <div className="space-y-2">
        {perks.length ? (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface-card">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2 px-3 py-2 text-sm text-foreground">
                <span className="min-w-0 flex-1 truncate">{perk}</span>
                <button
                  type="button"
                  aria-label={`Remove ${perk}`}
                  className="rounded p-0.5 text-text-tertiary hover:bg-surface-active hover:text-foreground"
                  onClick={() => onChange(perks.filter((p) => p !== perk))}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="e.g. Full-res downloads"
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={add}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>
    </Field>
  );
}

function TierDialog({ open, onOpenChange, initial, onSubmit, submitLabel, title }) {
  const [draft, setDraft] = useState(() => draftOf(initial));
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  React.useEffect(() => {
    if (open) setDraft(draftOf(initial));
  }, [initial, open]);
  const free = parseDollarsToCents(draft.price) === 0;

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Recurring tier with perks, a billing interval and optional trial."
      submitLabel={submitLabel}
      size="lg"
      footerNote={free ? "A $0 tier is a free follower tier — the funnel entry." : null}
      onSubmit={() => onSubmit(toInput(draft))}
    >
      <FormSection title="Plan">
        <TextField label="Tier name" value={draft.name} onChange={set("name")} placeholder="e.g. Gold" />
        <FieldRow>
          <MoneyField label="Price (USD)" value={draft.price} onChange={set("price")} hint="Use 0 for a free tier." />
          <SelectField label="Billing interval" value={draft.interval} onChange={set("interval")} options={INTERVAL_OPTIONS} />
        </FieldRow>
        {draft.interval === "month" && parseDollarsToCents(draft.price) > 0 ? (
          <MoneyField
            label="Annual price (USD)"
            value={draft.annualPrice}
            onChange={set("annualPrice")}
            placeholder={centsToDollars(Math.round(parseDollarsToCents(draft.price) * 12 * 0.8))}
            hint={annualHint(draft)}
          />
        ) : null}
        <TextAreaField label="Description" value={draft.description} onChange={set("description")} placeholder="What do members get?" rows={3} />
      </FormSection>
      <FormSection title="Perks">
        <PerksField perks={draft.perks} onChange={set("perks")} />
      </FormSection>
      <FormSection title="Trials & limits">
        <FieldRow columns={3}>
          <TextField label="Trial days" value={draft.trialDays} onChange={(v) => set("trialDays")(v.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="0" />
          <TextField label="Downloads / cycle" value={draft.downloadQuota} onChange={(v) => set("downloadQuota")(v.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="Unlimited" />
          <TextField label="Grace period (days)" value={draft.gracePeriodDays} onChange={(v) => set("gracePeriodDays")(v.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="3" />
        </FieldRow>
        <SettingsList>
          <SettingRow
            title="Open for signups"
            description="Archived tiers keep existing members but disappear from signup."
            checked={draft.isActive}
            onCheckedChange={set("isActive")}
          />
        </SettingsList>
      </FormSection>
    </CreateDialog>
  );
}

export function TiersScreen({ projectId }) {
  const [rows, setRows, loading] = useCreatorRows(listTiers, projectId);
  const [subscriptions] = useCreatorRows(listSubscriptions, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const membersByTier = useMemo(() => {
    const counts = new Map();
    for (const s of subscriptions) {
      if (LIVE_SUB_STATUSES.has(s.status)) counts.set(s.tierId, (counts.get(s.tierId) || 0) + 1);
    }
    return counts;
  }, [subscriptions]);

  const ordered = useMemo(() => [...rows].sort((a, b) => a.position - b.position), [rows]);

  const filtered = useMemo(() => {
    let r = ordered;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((t) => (t.isActive ? "active" : "archived") === statusFilter);
    return r;
  }, [ordered, search, statusFilter]);

  const pager = usePagination(filtered, { resetKey: `${search}|${statusFilter}` });

  const stats = useMemo(() => {
    const active = rows.filter((t) => t.isActive);
    const paid = active.filter((t) => !t.isFree && t.priceCents > 0);
    const mrr = rows.reduce((s, t) => s + monthlyCents(t) * (membersByTier.get(t.id) || 0), 0);
    const members = [...membersByTier.values()].reduce((s, n) => s + n, 0);
    return [
      { label: "Tiers", value: String(rows.length), footer: `${active.length} open for signups` },
      { label: "Paid tiers", value: String(paid.length), footer: `${active.length - paid.length} free` },
      { label: "Members on tiers", value: String(members), footer: "active, trialing or past due" },
      { label: "Tier MRR", value: formatMoney(mrr), footer: "annual plans ÷ 12" },
    ];
  }, [rows, membersByTier]);

  const replace = (next) => setRows((list) => list.map((t) => (t.id === next.id ? next : t)));

  const handleCreate = async (input) => {
    if (!input.name) return toast.error("Tier name is required");
    const id = crypto.randomUUID();
    const position = rows.length ? Math.max(...rows.map((t) => t.position)) + 1 : 0;
    const now = new Date().toISOString();
    setRows((prev) => [...prev, { id, projectId, currency: "usd", position, createdAt: now, updatedAt: now, ...input, ...input.metadata }]);
    setShowCreate(false);
    const created = await createTier({ id, projectId, position, ...input });
    if (created) {
      replace(created);
      toast.success("Tier created");
    } else {
      setRows((prev) => prev.filter((t) => t.id !== id));
      toast.error("Could not create tier");
    }
  };

  const persist = async (tier, patch, successMessage) => {
    const prev = rows;
    replace({ ...tier, ...patch, ...(patch.metadata || {}) });
    const saved = await updateTier(tier.id, patch);
    if (!saved) {
      setRows(prev);
      toast.error("Could not save tier");
      return false;
    }
    replace(saved);
    if (successMessage) toast.success(successMessage);
    return true;
  };

  const handleSave = async (input) => {
    if (!editing) return;
    if (!input.name) return toast.error("Tier name is required");
    const tier = editing;
    setEditing(null);
    await persist(tier, input, "Tier updated");
  };

  const move = async (tier, dir) => {
    const index = ordered.findIndex((t) => t.id === tier.id);
    const other = ordered[index + dir];
    if (!other) return;
    const prev = rows;
    setRows((list) =>
      list.map((t) => (t.id === tier.id ? { ...t, position: other.position } : t.id === other.id ? { ...t, position: tier.position } : t)),
    );
    const [a, b] = await Promise.all([
      updateTier(tier.id, { position: other.position }),
      updateTier(other.id, { position: tier.position }),
    ]);
    if (!a || !b) {
      setRows(prev);
      toast.error("Could not reorder tiers");
    }
  };

  const handleDelete = async (tier) => {
    if (membersByTier.get(tier.id)) return toast.error("This tier has members — archive it instead");
    const prev = rows;
    setRows((list) => list.filter((t) => t.id !== tier.id));
    const ok = await deleteTier(tier.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete tier");
    } else toast.success("Tier deleted");
  };

  const columns = [
    {
      key: "name",
      header: "Tier",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
          <p className="truncate text-[11px] text-text-tertiary">
            {t.perks.length ? `${t.perks.length} perk${t.perks.length === 1 ? "" : "s"} · ` : ""}
            {t.description || "No description"}
          </p>
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      className: "whitespace-nowrap tabular-nums text-xs",
      render: (t) =>
        t.isFree || t.priceCents === 0
          ? "Free"
          : `${formatMoney(t.priceCents, t.currency)} / ${intervalLabel(t.interval)}${t.annualPriceCents ? ` · ${formatMoney(t.annualPriceCents, t.currency)} / yr` : ""}`,
    },
    {
      key: "members",
      header: "Members",
      className: "hidden tabular-nums text-xs sm:table-cell",
      headClassName: "hidden sm:table-cell",
      render: (t) => membersByTier.get(t.id) || 0,
    },
    {
      key: "trial",
      header: "Trial",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (t) => (t.trialDays ? `${t.trialDays} days` : "—"),
    },
    { key: "status", header: "Status", render: (t) => <StatusPill status={t.isActive ? "active" : "archived"} map={TIER_STATUS_META} className="text-[10px]" /> },
    {
      key: "updated",
      header: "Updated",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (t) => formatDate(t.updatedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (t) => {
        const index = ordered.findIndex((x) => x.id === t.id);
        return (
          <RowActions
            onEdit={() => setEditing(t)}
            onDelete={() => handleDelete(t)}
            extra={[
              ...(index > 0 ? [{ icon: ArrowUp, label: "Move up", onSelect: () => move(t, -1) }] : []),
              ...(index < ordered.length - 1 ? [{ icon: ArrowDown, label: "Move down", onSelect: () => move(t, 1) }] : []),
              t.isActive
                ? { icon: Archive, label: "Archive", onSelect: () => persist(t, { isActive: false }, "Tier archived") }
                : { icon: ArchiveRestore, label: "Reopen for signups", onSelect: () => persist(t, { isActive: true }, "Tier reopened") },
            ]}
          />
        );
      },
    },
  ];

  const hasFilters = statusFilter !== "all" || Boolean(search);
  const newTier = (
    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}>
      <BadgePlus className="h-4 w-4" />
      New tier
    </Button>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Membership Tiers" description="Recurring tiers — free funnel entry plus paid plans with perks, trials and download limits." actions={newTier} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          {hasFilters ? <ClearFiltersButton onClick={() => { setStatusFilter("all"); setSearch(""); }} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tiers..." className="w-full sm:w-64" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" />
      ) : (
        <DataTable
          columns={columns}
          data={pager.pageItems}
          getRowKey={(t) => t.id}
          onRowClick={setEditing}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={Layers}
                title={hasFilters ? "No tiers match" : "No tiers yet"}
                description={hasFilters ? "Try adjusting your filters." : "Create your first membership tier to start recurring revenue."}
                action={hasFilters ? <ClearFiltersButton onClick={() => { setStatusFilter("all"); setSearch(""); }} /> : newTier}
              />
            </div>
          }
        />
      )}
      {!loading ? <ListPagination {...pager} itemLabel="tiers" /> : null}
      <TierDialog open={showCreate} onOpenChange={setShowCreate} title="New tier" submitLabel="Create tier" onSubmit={handleCreate} />
      {editing ? (
        <TierDialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)} initial={editing} title={`Edit ${editing.name}`} submitLabel="Save changes" onSubmit={handleSave} />
      ) : null}
    </MainScreenWrapper>
  );
}

export default TiersScreen;
