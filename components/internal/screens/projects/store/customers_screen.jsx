"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, Contact, Plus, SlidersHorizontal, UserCheck } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
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
  ClearFiltersButton,
  CreateDialog,
  FieldRow,
  FilterDropdown,
  RowActions,
  TextField,
  useModuleRows,
} from "@/components/internal/shared/module_kit";
import { ExportButton } from "../licensing/licensing_kit";
import { CustomerDetailScreen } from "./customer_detail";
import {
  CUSTOMER_STATUS_META,
  centsToDollarString,
  compactMoney,
  formatDate,
  formatMoney,
  optionsFromMeta,
  plural,
} from "./constants";
import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  listEntitlements,
  listOrders,
  updateCustomer,
} from "@/lib/supabase/store";
import { listGalleries } from "@/lib/supabase/galleries";
import { listLicenses } from "@/lib/supabase/licensing";
import { listAssets } from "@/lib/supabase/assets";
import { getUser } from "@/lib/supabase/user";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

const STATUS_FILTERS = optionsFromMeta(CUSTOMER_STATUS_META, "All statuses");
const SEGMENT_FILTERS = [
  { value: "all", label: "All customers" },
  { value: "repeat", label: "Repeat buyers" },
  { value: "licensees", label: "Licence holders" },
  { value: "optin", label: "Marketing opt-in" },
  { value: "none", label: "No purchases yet" },
];

const EMPTY = { name: "", email: "", company: "", phone: "", country: "" };

export function CustomersScreen({ projectId }) {
  const [customers, setCustomers, loading] = useModuleRows(listCustomers, projectId);
  const [orders] = useModuleRows(listOrders, projectId);
  const [entitlements, setEntitlements] = useModuleRows(listEntitlements, projectId);
  const [licenses] = useModuleRows(listLicenses, projectId);
  const [galleries] = useModuleRows(listGalleries, projectId);
  const [assets] = useModuleRows(listAssets, projectId);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [segment, setSegment] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const { setSection } = useWorkspaceUrl();

  const galleryById = useMemo(() => new Map(galleries.map((g) => [g.id, g])), [galleries]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const tagFilters = useMemo(() => {
    const tags = [...new Set(customers.flatMap((c) => c.tags))].sort();
    return [{ value: "all", label: "All tags" }, ...tags.map((t) => ({ value: t, label: t }))];
  }, [customers]);

  const filtered = useMemo(() => {
    let list = customers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => [c.name, c.email, c.company].some((v) => String(v || "").toLowerCase().includes(q)));
    }
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    if (tagFilter !== "all") list = list.filter((c) => c.tags.includes(tagFilter));
    if (segment === "repeat") list = list.filter((c) => c.ordersCount >= 2);
    if (segment === "licensees") list = list.filter((c) => c.licenseeId);
    if (segment === "optin") list = list.filter((c) => c.marketingOptIn);
    if (segment === "none") list = list.filter((c) => c.ordersCount === 0);
    return [...list].sort((a, b) => b.totalSpentCents - a.totalSpentCents);
  }, [customers, search, statusFilter, tagFilter, segment]);

  const stats = useMemo(() => {
    const buyers = customers.filter((c) => c.ordersCount > 0);
    const repeat = buyers.filter((c) => c.ordersCount >= 2).length;
    const total = buyers.reduce((s, c) => s + c.totalSpentCents, 0);
    return [
      { label: "Customers", value: String(customers.length), footer: `${buyers.length} have bought` },
      { label: "Repeat rate", value: buyers.length ? `${Math.round((repeat / buyers.length) * 100)}%` : "0%", footer: `${repeat} came back` },
      { label: "Average lifetime value", value: formatMoney(buyers.length ? Math.round(total / buyers.length) : 0), footer: `${compactMoney(total)} in total` },
      { label: "Marketing opt-ins", value: String(customers.filter((c) => c.marketingOptIn).length), footer: "consented at checkout" },
    ];
  }, [customers]);

  const replace = (next) => setCustomers((list) => list.map((c) => (c.id === next.id ? next : c)));

  const create = async () => {
    const email = draft.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast.error("Enter a valid email");
    if (customers.some((c) => c.email.toLowerCase() === email)) return toast.error("A customer with that email already exists");
    const user = await getUser();
    const payload = { id: crypto.randomUUID(), projectId, ...draft, email, createdBy: user?.id || null };
    setShowCreate(false);
    setDraft(EMPTY);
    setCustomers((list) => [{ ...payload, tags: [], ordersCount: 0, totalSpentCents: 0, status: "active" }, ...list]);
    const created = await createCustomer(payload);
    if (created) {
      replace(created);
      toast.success("Customer added");
    } else {
      setCustomers((list) => list.filter((c) => c.id !== payload.id));
      toast.error("Couldn't add the customer");
    }
  };

  const toggleBlock = async (customer) => {
    const status = customer.status === "blocked" ? "active" : "blocked";
    replace({ ...customer, status });
    const saved = await updateCustomer(customer.id, { status });
    if (saved) toast.success(status === "blocked" ? "Customer blocked" : "Customer unblocked");
    else {
      replace(customer);
      toast.error("Couldn't update the customer");
    }
  };

  const remove = async (customer) => {
    if (customer.ordersCount > 0) return toast.error("Customers with orders are kept for your records — block them instead");
    const previous = customers;
    setCustomers((list) => list.filter((c) => c.id !== customer.id));
    const ok = await deleteCustomer(customer.id);
    if (ok) toast.success("Customer deleted");
    else {
      setCustomers(previous);
      toast.error("Couldn't delete the customer");
    }
  };

  const open = openId ? customers.find((c) => c.id === openId) : null;
  if (open) {
    const own = orders.filter((o) => o.customerId === open.id);
    return (
      <CustomerDetailScreen
        key={open.id}
        customer={open}
        orders={own}
        entitlements={entitlements.filter((e) => e.customerId === open.id)}
        licenses={open.licenseeId ? licenses.filter((l) => l.licenseeId === open.licenseeId) : []}
        galleryById={galleryById}
        assetById={assetById}
        assets={assets}
        onBack={() => {
          setSection(null);
          setOpenId(null);
        }}
        onChange={replace}
        onEntitlements={(rows) => setEntitlements((list) => [...rows, ...list])}
      />
    );
  }

  const columns = [
    {
      key: "name",
      header: "Customer",
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{c.name || c.email}</p>
          <p className="truncate text-[11px] text-text-tertiary">
            {c.name ? c.email : ""}
            {c.company ? `${c.name ? " · " : ""}${c.company}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "tags",
      header: "Tags",
      className: "hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (c) =>
        c.tags.length ? (
          <div className="flex flex-wrap gap-1">
            {c.tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                {t}
              </Badge>
            ))}
            {c.tags.length > 3 ? <span className="text-[10px] text-text-tertiary">+{c.tags.length - 3}</span> : null}
          </div>
        ) : (
          <span className="text-xs text-text-tertiary">—</span>
        ),
    },
    {
      key: "orders",
      header: "Orders",
      className: "text-xs text-text-secondary",
      render: (c) => c.ordersCount,
    },
    {
      key: "last",
      header: "Last order",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (c) => (c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"),
    },
    {
      key: "spent",
      header: "Spent",
      align: "right",
      className: "tabular-nums text-xs font-medium",
      render: (c) => formatMoney(c.totalSpentCents),
    },
    {
      key: "status",
      header: "Status",
      render: (c) => <StatusPill status={c.status} map={CUSTOMER_STATUS_META} className="text-[10px]" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            extra={[
              c.status === "blocked"
                ? { icon: UserCheck, label: "Unblock", onSelect: () => toggleBlock(c) }
                : { icon: Ban, label: "Block", onSelect: () => toggleBlock(c) },
            ]}
            onEdit={() => setOpenId(c.id)}
            editLabel="Open customer"
            onDelete={() => remove(c)}
          />
        </div>
      ),
    },
  ];

  const exportColumns = [
    { key: "name", header: "Name" },
    { key: "email", header: "Email" },
    { key: "company", header: "Company" },
    { key: "phone", header: "Phone" },
    { key: "country", header: "Country" },
    { key: "ordersCount", header: "Orders" },
    { key: "spent", header: "Spent", value: (c) => centsToDollarString(c.totalSpentCents) },
    { key: "tags", header: "Tags", value: (c) => c.tags.join("; ") },
    { key: "marketingOptIn", header: "Marketing opt-in", value: (c) => (c.marketingOptIn ? "yes" : "no") },
    { key: "firstOrderAt", header: "First order", value: (c) => (c.firstOrderAt ? formatDate(c.firstOrderAt) : "") },
    { key: "lastOrderAt", header: "Last order", value: (c) => (c.lastOrderAt ? formatDate(c.lastOrderAt) : "") },
    { key: "status", header: "Status" },
  ];

  const hasFilters = statusFilter !== "all" || segment !== "all" || tagFilter !== "all" || Boolean(search);
  const clearFilters = () => {
    setStatusFilter("all");
    setSegment("all");
    setTagFilter("all");
    setSearch("");
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Customers"
        description="Everyone who has bought from a gallery — their orders, downloads, licences and notes."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Add customer
          </Button>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={segment} onValueChange={setSegment} options={SEGMENT_FILTERS} placeholder="Segment" icon={SlidersHorizontal} />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" />
          {tagFilters.length > 1 ? <FilterDropdown value={tagFilter} onValueChange={setTagFilter} options={tagFilters} placeholder="Tag" /> : null}
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <div className="flex items-center gap-2">
          <ExportButton filename="customers" rows={filtered} columns={exportColumns} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search customers..." className="w-full sm:w-56" />
        </div>
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" label="Loading customers" />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(c) => c.id}
          onRowClick={(c) => setOpenId(c.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={hasFilters ? SlidersHorizontal : Contact}
                title={hasFilters ? "No matching customers" : "No customers yet"}
                description={hasFilters ? "Try adjusting your filters." : "Buyers are added automatically at checkout — or add one by hand."}
                action={
                  hasFilters ? (
                    <Button variant="outline" className="border-border bg-surface-card" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}>
                      <Plus className="h-4 w-4" />
                      Add customer
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
          Showing {plural(filtered.length, "customer")} of {customers.length}
        </div>
      ) : null}

      <CreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        title="Add customer"
        description="For a buyer who paid outside the store — you can then grant them downloads."
        submitLabel="Add customer"
        onSubmit={create}
      >
        <FieldRow>
          <TextField label="Name" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
          <TextField label="Email" type="email" value={draft.email} onChange={(v) => setDraft((d) => ({ ...d, email: v }))} />
        </FieldRow>
        <FieldRow columns={3}>
          <TextField label="Company" value={draft.company} onChange={(v) => setDraft((d) => ({ ...d, company: v }))} />
          <TextField label="Phone" value={draft.phone} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} />
          <TextField label="Country" value={draft.country} onChange={(v) => setDraft((d) => ({ ...d, country: v }))} />
        </FieldRow>
      </CreateDialog>
    </MainScreenWrapper>
  );
}

export default CustomersScreen;
