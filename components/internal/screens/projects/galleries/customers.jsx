"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, Copy, Pencil, Plus, Trash2, Users } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { ActionMenu } from "@geiger/ui/action-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import {
  CUSTOMER_STATUS_FILTER_OPTIONS,
  CUSTOMER_STATUS_MAP,
  formatDate,
  formatMoney,
} from "./constants";
import {
  createGalleryCustomer,
  listGalleryCustomers,
  softDeleteGalleryCustomer,
  updateGalleryCustomer,
} from "@/lib/supabase/galleries";

// Customers — profiles, organizations, purchase history, download history,
// license history, customer notes.

const EMPTY_DRAFT = {
  name: "",
  email: "",
  organization: "",
  notes: "",
};

const STATUS_OPTIONS = Object.entries(CUSTOMER_STATUS_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

function CustomerDialog({ open, onOpenChange, initial, onSubmit }) {
  const editing = Boolean(initial);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDraft({
      ...EMPTY_DRAFT,
      name: initial?.name ?? "",
      email: initial?.email ?? "",
      organization: initial?.organization ?? "",
      notes: initial?.notes ?? "",
    });
    setStatus(initial?.status || "active");
    setBusy(false);
  }, [open, initial]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give the customer a name.");
      return;
    }
    if (draft.email.trim() && !draft.email.includes("@")) {
      toast.error("That email does not look right.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      name,
      email: draft.email.trim(),
      organization: draft.organization.trim(),
      notes: draft.notes.trim(),
      status,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Profiles with organization, history, and private notes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="customer-name">
              <Input
                id="customer-name"
                className="bg-surface-card"
                value={draft.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="Jane Miller"
                autoFocus
              />
            </Field>
            <Field label="Email" htmlFor="customer-email">
              <Input
                id="customer-email"
                className="bg-surface-card"
                value={draft.email}
                onChange={(e) => set("email")(e.target.value)}
                placeholder="jane@example.com"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organization" htmlFor="customer-org">
              <Input
                id="customer-org"
                className="bg-surface-card"
                value={draft.organization}
                onChange={(e) => set("organization")(e.target.value)}
                placeholder="Miller Studio"
              />
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notes" htmlFor="customer-notes" hint="Private — never shown to buyers.">
            <Textarea
              id="customer-notes"
              className="min-h-20 bg-surface-card"
              value={draft.notes}
              onChange={(e) => set("notes")(e.target.value)}
              placeholder="Prefers evening delivery, licensed 3 images…"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
            disabled={busy}
          >
            {editing ? "Save changes" : "Create customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomersScreen({ projectId }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let alive = true;
    listGalleryCustomers(projectId).then((rows) => {
      if (!alive) return;
      setCustomers(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const stats = useMemo(
    () => [
      { label: "Customers", value: String(customers.length), footer: "buyer profiles" },
      {
        label: "Active",
        value: String(customers.filter((c) => c.status === "active").length),
        footer: "in good standing",
      },
      {
        label: "Revenue",
        value: formatMoney(customers.reduce((s, c) => s + c.totalSpentCents, 0)),
        footer: "lifetime spend",
      },
      {
        label: "Blocked",
        value: String(customers.filter((c) => c.status === "blocked").length),
        footer: "restricted",
      },
    ],
    [customers],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return customers.filter((customer) => {
      if (statusFilter !== "all" && customer.status !== statusFilter) return false;
      if (
        needle &&
        !`${customer.name} ${customer.email} ${customer.organization} ${customer.notes}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [customers, search, statusFilter]);

  const filtersActive = statusFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setDialogOpen(true);
  };

  const submitCustomer = async (draft) => {
    if (editing) {
      const previous = customers;
      setCustomers((rows) =>
        rows.map((c) => (c.id === editing.id ? { ...c, ...draft } : c)),
      );
      const saved = await updateGalleryCustomer(editing.id, draft);
      if (!saved) {
        setCustomers(previous);
        toast.error("Could not save the customer.");
        return false;
      }
      setCustomers((rows) => rows.map((c) => (c.id === saved.id ? saved : c)));
      toast.success(`Saved “${saved.name}”.`);
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      totalSpentCents: 0,
      orderCount: 0,
      downloadCount: 0,
      lastSeenAt: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setCustomers((rows) => [optimistic, ...rows]);
    const created = await createGalleryCustomer({ id, projectId, ...draft });
    if (!created) {
      setCustomers((rows) => rows.filter((c) => c.id !== id));
      toast.error("Could not create the customer.");
      return false;
    }
    setCustomers((rows) => rows.map((c) => (c.id === id ? created : c)));
    toast.success(`Created “${created.name}”.`);
    return true;
  };

  const toggleBlocked = async (customer) => {
    const next = customer.status === "blocked" ? "active" : "blocked";
    const previous = customers;
    setCustomers((rows) =>
      rows.map((c) => (c.id === customer.id ? { ...c, status: next } : c)),
    );
    const saved = await updateGalleryCustomer(customer.id, { status: next });
    if (!saved) {
      setCustomers(previous);
      toast.error("Could not change the customer.");
      return;
    }
    setCustomers((rows) => rows.map((c) => (c.id === saved.id ? saved : c)));
    toast.success(next === "blocked" ? `Blocked “${saved.name}”.` : `Unblocked “${saved.name}”.`);
  };

  const duplicateCustomer = async (customer) => {
    const id = crypto.randomUUID();
    const copy = `Copy of ${customer.name}`;
    const optimistic = {
      ...customer,
      id,
      name: copy,
      email: "",
      totalSpentCents: 0,
      orderCount: 0,
      downloadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCustomers((rows) => [optimistic, ...rows]);
    const created = await createGalleryCustomer({
      id,
      projectId,
      name: copy,
      email: "",
      organization: customer.organization,
      status: "active",
      notes: customer.notes,
    });
    if (!created) {
      setCustomers((rows) => rows.filter((c) => c.id !== id));
      toast.error("Could not duplicate the customer.");
      return;
    }
    setCustomers((rows) => rows.map((c) => (c.id === id ? created : c)));
    toast.success(`Duplicated as “${created.name}”.`);
  };

  const removeCustomer = async (customer) => {
    const previous = customers;
    setCustomers((rows) => rows.filter((c) => c.id !== customer.id));
    const ok = await softDeleteGalleryCustomer(customer.id);
    if (!ok) {
      setCustomers(previous);
      toast.error("Could not delete the customer.");
      return;
    }
    toast.success(`Deleted “${customer.name}”.`);
  };

  const columns = [
    {
      key: "name",
      header: "Customer",
      render: (customer) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[240px] truncate font-medium text-foreground">
            {customer.name || "Unnamed"}
          </span>
          <span className="truncate text-xs text-text-secondary">
            {customer.email || "no email"}
            {customer.organization ? ` · ${customer.organization}` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "history",
      header: "History",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (customer) => (
        <div className="flex flex-col gap-0.5 text-xs text-text-secondary">
          <span>
            {customer.orderCount} orders · {formatMoney(customer.totalSpentCents)}
          </span>
          <span className="text-[11px] text-text-tertiary">
            {customer.downloadCount} downloads
            {customer.lastSeenAt ? ` · seen ${formatDate(customer.lastSeenAt)}` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (customer) => <StatusPill status={customer.status} map={CUSTOMER_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (customer) => (
        <ActionMenu
          label={`Actions for ${customer.name}`}
          items={[
            {
              icon: Ban,
              label: customer.status === "blocked" ? "Unblock" : "Block",
              onSelect: () => toggleBlocked(customer),
            },
            { icon: Pencil, label: "Edit", onSelect: () => openEdit(customer) },
            { icon: Copy, label: "Duplicate", onSelect: () => duplicateCustomer(customer) },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              destructive: true,
              onSelect: () => removeCustomer(customer),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Customers"
        description="Profiles, organizations, purchase and download history, private notes."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> New customer
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={CUSTOMER_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search customers…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading customers" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(customer) => customer.id}
          onRowClick={openEdit}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              {filtersActive ? (
                <EmptyState
                  icon={Users}
                  title="No customers match these filters"
                  description="Try a different status or search term."
                  action={
                    <Button
                      variant="outline"
                      className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Users}
                  title="No customers yet"
                  description="Buyer profiles will appear here after checkout."
                  action={
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={openCreate}
                    >
                      <Plus className="h-4 w-4" /> New customer
                    </Button>
                  }
                />
              )}
            </div>
          }
        />
      )}

      <CustomerDialog
        key={editing ? `customer:${editing.id}` : "customer:new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={submitCustomer}
      />
    </MainScreenWrapper>
  );
}

export default CustomersScreen;
