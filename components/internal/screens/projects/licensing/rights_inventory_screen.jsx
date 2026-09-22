"use client";

import React, { useMemo, useState } from "react";
import { Plus, Scale, SlidersHorizontal, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
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
  DateField,
  FieldRow,
  FilterDropdown,
  FormSection,
  RowActions,
  SelectField,
  TextAreaField,
  TextField,
  useModuleRows,
} from "@/components/internal/shared/module_kit";
import { ChipSelect, ExportButton, ScopeChips } from "./licensing_kit";
import {
  ACQUISITION_META,
  CHANNELS,
  EXCLUSIVITY_META,
  HOLDER_KIND_META,
  RIGHTS_STATUS_META,
  TERRITORIES,
  daysUntil,
  formatDate,
  formatPercent,
  labelFor,
  labelsFor,
  optionsFromMeta,
  today,
} from "./constants";
import {
  createRightsHolder,
  createRightsRecord,
  deleteRightsHolder,
  deleteRightsRecord,
  listRightsHolders,
  listRightsRecords,
  updateRightsHolder,
  updateRightsRecord,
} from "@/lib/supabase/rights";
import { listAssets } from "@/lib/supabase/assets";

const STATUS_FILTERS = optionsFromMeta(RIGHTS_STATUS_META, "All statuses");
const ACQUISITION_FILTERS = optionsFromMeta(ACQUISITION_META, "All acquisitions");
const EXCLUSIVITY_FILTERS = optionsFromMeta(EXCLUSIVITY_META, "All exclusivity");
const ACQUISITION_OPTIONS = optionsFromMeta(ACQUISITION_META);
const EXCLUSIVITY_OPTIONS = optionsFromMeta(EXCLUSIVITY_META);
const STATUS_OPTIONS = optionsFromMeta(RIGHTS_STATUS_META);
const HOLDER_KIND_OPTIONS = optionsFromMeta(HOLDER_KIND_META);

const EMPTY_RECORD = {
  title: "",
  rightsHolderId: "",
  assetId: "",
  externalRef: "",
  acquisitionType: "licensed_in",
  ownershipShare: "100",
  territories: ["worldwide"],
  channels: ["web"],
  windowStart: today(),
  windowEnd: "",
  exclusivity: "non_exclusive",
  status: "active",
  documentUrl: "",
  notes: "",
};

function RecordDialog({ open, onOpenChange, initial, holders, assets, onSubmit, title, submitLabel }) {
  const [draft, setDraft] = useState(EMPTY_RECORD);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  React.useEffect(() => {
    if (!open) return;
    setDraft(
      initial
        ? {
            ...EMPTY_RECORD,
            ...initial,
            ownershipShare: String(initial.ownershipShare ?? 100),
            rightsHolderId: initial.rightsHolderId || "",
            assetId: initial.assetId || "",
          }
        : EMPTY_RECORD,
    );
  }, [initial, open]);

  const holderOptions = [
    { value: "", label: "Unassigned" },
    ...holders.map((h) => ({ value: h.id, label: h.name || "Untitled holder" })),
  ];
  const assetOptions = [
    { value: "", label: "Not in the library" },
    ...assets.map((a) => ({ value: a.id, label: a.name || a.fileName || a.id.slice(0, 8) })),
  ];

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Record a right the organisation owns or has licensed in, and the window it covers."
      submitLabel={submitLabel}
      wide
      onSubmit={() => onSubmit(draft)}
    >
      <FormSection title="The right" description="What is held, and who it came from.">
        <TextField label="Title" value={draft.title} onChange={set("title")} placeholder="e.g. Autumn campaign photography" />
        <FieldRow>
          <SelectField label="Rights holder" value={draft.rightsHolderId} onChange={set("rightsHolderId")} options={holderOptions} placeholder="Unassigned" />
          <SelectField label="Acquisition" value={draft.acquisitionType} onChange={set("acquisitionType")} options={ACQUISITION_OPTIONS} placeholder="Acquisition" />
        </FieldRow>
      </FormSection>

      <FormSection title="Subject" description="Point at the library, or name material held outside the DAM.">
        <FieldRow>
          <SelectField label="Library asset" value={draft.assetId} onChange={set("assetId")} options={assetOptions} placeholder="Not in the library" />
          <TextField label="External reference" value={draft.externalRef} onChange={set("externalRef")} placeholder="Contract no., archive ref…" />
        </FieldRow>
      </FormSection>

      <FormSection title="Coverage" description="Where and how this right may be exercised.">
        <ChipSelect label="Territories held" options={TERRITORIES} values={draft.territories} onChange={set("territories")} emptyHint="No territory held yet." />
        <ChipSelect label="Channels held" options={CHANNELS} values={draft.channels} onChange={set("channels")} emptyHint="No channel held yet." />
        <FieldRow columns={3}>
          <TextField label="Ownership share (%)" value={draft.ownershipShare} onChange={set("ownershipShare")} placeholder="100" inputMode="decimal" />
          <SelectField label="Exclusivity" value={draft.exclusivity} onChange={set("exclusivity")} options={EXCLUSIVITY_OPTIONS} placeholder="Exclusivity" />
          <SelectField label="Status" value={draft.status} onChange={set("status")} options={STATUS_OPTIONS} placeholder="Status" />
        </FieldRow>
      </FormSection>

      <FormSection title="Window" description="Leave the end date blank for a right with no expiry.">
        <FieldRow>
          <DateField label="Window start" value={draft.windowStart} onChange={set("windowStart")} />
          <DateField label="Window end" value={draft.windowEnd} onChange={set("windowEnd")} hint="Blank = no end date" placeholder="No end date" />
        </FieldRow>
      </FormSection>

      <FormSection title="Paperwork">
        <TextField label="Document URL" value={draft.documentUrl} onChange={set("documentUrl")} placeholder="Link to the signed agreement" />
        <TextAreaField label="Notes" value={draft.notes} onChange={set("notes")} rows={3} placeholder="Anything a future reader needs to know." />
      </FormSection>
    </CreateDialog>
  );
}

function HoldersDialog({ open, onOpenChange, holders, onCreate, onUpdate, onDelete }) {
  const [draft, setDraft] = useState({ name: "", kind: "creator", email: "", defaultRoyaltyRate: "0", paymentTerms: "" });
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.name.trim()) return toast.error("A rights holder needs a name");
    onCreate(draft);
    setDraft({ name: "", kind: "creator", email: "", defaultRoyaltyRate: "0", paymentTerms: "" });
  };

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Rights holders"
      description="The people and organisations royalties are paid to."
      submitLabel="Add holder"
      wide
      onSubmit={submit}
    >
      <FormSection title="Add a holder">
        <FieldRow>
          <TextField label="Name" value={draft.name} onChange={set("name")} placeholder="e.g. Ada Okoye" />
          <SelectField label="Kind" value={draft.kind} onChange={set("kind")} options={HOLDER_KIND_OPTIONS} placeholder="Kind" />
        </FieldRow>
        <FieldRow columns={3}>
          <TextField label="Email" value={draft.email} onChange={set("email")} placeholder="name@studio.com" type="email" />
          <TextField label="Default royalty (%)" value={draft.defaultRoyaltyRate} onChange={set("defaultRoyaltyRate")} placeholder="15" inputMode="decimal" />
          <TextField label="Payment terms" value={draft.paymentTerms} onChange={set("paymentTerms")} placeholder="Net 30" />
        </FieldRow>
      </FormSection>
      <div className="rounded-xl border border-border bg-surface-card">
        {holders.length ? (
          <ul className="divide-y divide-border">
            {holders.map((holder) => (
              <li key={holder.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{holder.name}</p>
                  <p className="truncate text-[11px] text-text-tertiary">
                    {labelFor(HOLDER_KIND_META, holder.kind)} · {holder.email || "no email"} ·{" "}
                    {formatPercent(holder.defaultRoyaltyRate)} default
                  </p>
                </div>
                <RowActions
                  onEdit={() => onUpdate(holder)}
                  editLabel="Toggle internal"
                  onDelete={() => onDelete(holder)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-6 text-center text-xs text-text-tertiary">No rights holders yet.</p>
        )}
      </div>
    </CreateDialog>
  );
}

export function RightsInventoryScreen({ projectId }) {
  const [rows, setRows, loading] = useModuleRows(listRightsRecords, projectId);
  const [holders, setHolders] = useModuleRows(listRightsHolders, projectId);
  const [assets] = useModuleRows(listAssets, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [acquisitionFilter, setAcquisitionFilter] = useState("all");
  const [exclusivityFilter, setExclusivityFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showHolders, setShowHolders] = useState(false);
  const [editing, setEditing] = useState(null);

  const holderById = useMemo(() => new Map(holders.map((h) => [h.id, h])), [holders]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.externalRef.toLowerCase().includes(q) ||
          (holderById.get(r.rightsHolderId)?.name ?? "").toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (acquisitionFilter !== "all") list = list.filter((r) => r.acquisitionType === acquisitionFilter);
    if (exclusivityFilter !== "all") list = list.filter((r) => r.exclusivity === exclusivityFilter);
    return list;
  }, [rows, search, statusFilter, acquisitionFilter, exclusivityFilter, holderById]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === "active").length;
    const expiringSoon = rows.filter((r) => {
      const days = daysUntil(r.windowEnd);
      return days !== null && days >= 0 && days <= 90;
    }).length;
    const disputed = rows.filter((r) => r.status === "disputed").length;
    return [
      { label: "Rights records", value: String(rows.length), footer: `${active} active` },
      { label: "Windows closing", value: String(expiringSoon), footer: "within 90 days" },
      { label: "Rights holders", value: String(holders.length), footer: "payees on file" },
      { label: "Disputed", value: String(disputed), footer: disputed ? "needs resolution" : "all clear" },
    ];
  }, [rows, holders]);

  const subjectLabel = (record) => {
    if (record.assetId) {
      const asset = assetById.get(record.assetId);
      return asset?.name || asset?.fileName || "Library asset";
    }
    if (record.collectionId) return "Collection";
    return record.externalRef || "External material";
  };

  const handleCreate = async (draft) => {
    if (!draft.title.trim()) return toast.error("A rights record needs a title");
    const id = crypto.randomUUID();
    const payload = {
      id,
      projectId,
      ...draft,
      title: draft.title.trim(),
      ownershipShare: Number(draft.ownershipShare) || 0,
      rightsHolderId: draft.rightsHolderId || null,
      assetId: draft.assetId || null,
    };
    setRows((prev) => [{ ...payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...prev]);
    setShowCreate(false);
    const created = await createRightsRecord(payload);
    if (created) {
      setRows((prev) => prev.map((r) => (r.id === id ? created : r)));
      toast.success("Rights record added");
    } else {
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.error("Could not save the rights record");
    }
  };

  const handleSave = async (draft) => {
    if (!editing) return;
    const previous = rows;
    const patch = {
      ...draft,
      ownershipShare: Number(draft.ownershipShare) || 0,
      rightsHolderId: draft.rightsHolderId || null,
      assetId: draft.assetId || null,
    };
    setRows((list) => list.map((r) => (r.id === editing.id ? { ...r, ...patch } : r)));
    setEditing(null);
    const saved = await updateRightsRecord(editing.id, patch);
    if (saved) {
      setRows((list) => list.map((r) => (r.id === saved.id ? saved : r)));
      toast.success("Rights record updated");
    } else {
      setRows(previous);
      toast.error("Could not save the rights record");
    }
  };

  const handleDelete = async (record) => {
    const previous = rows;
    setRows((list) => list.filter((r) => r.id !== record.id));
    const ok = await deleteRightsRecord(record.id);
    if (ok) toast.success("Rights record deleted");
    else {
      setRows(previous);
      toast.error("Could not delete the rights record");
    }
  };

  const handleCreateHolder = async (draft) => {
    const id = crypto.randomUUID();
    const payload = {
      id,
      projectId,
      ...draft,
      name: draft.name.trim(),
      defaultRoyaltyRate: Number(draft.defaultRoyaltyRate) || 0,
    };
    setHolders((prev) => [payload, ...prev]);
    const created = await createRightsHolder(payload);
    if (created) {
      setHolders((prev) => prev.map((h) => (h.id === id ? created : h)));
      toast.success("Rights holder added");
    } else {
      setHolders((prev) => prev.filter((h) => h.id !== id));
      toast.error("Could not add the rights holder");
    }
  };

  const handleToggleHolderKind = async (holder) => {
    const nextKind = holder.kind === "internal" ? "creator" : "internal";
    const previous = holders;
    setHolders((list) => list.map((h) => (h.id === holder.id ? { ...h, kind: nextKind } : h)));
    const saved = await updateRightsHolder(holder.id, { kind: nextKind });
    if (!saved) {
      setHolders(previous);
      toast.error("Could not update the rights holder");
    }
  };

  const handleDeleteHolder = async (holder) => {
    const previous = holders;
    setHolders((list) => list.filter((h) => h.id !== holder.id));
    const ok = await deleteRightsHolder(holder.id);
    if (ok) toast.success("Rights holder removed");
    else {
      setHolders(previous);
      toast.error("Could not remove the rights holder");
    }
  };

  const columns = [
    {
      key: "title",
      header: "Right",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{r.title || "Untitled right"}</p>
          <p className="truncate text-[11px] text-text-tertiary">{subjectLabel(r)}</p>
        </div>
      ),
    },
    {
      key: "holder",
      header: "Holder",
      className: "text-xs",
      render: (r) => holderById.get(r.rightsHolderId)?.name || <span className="text-text-tertiary">Unassigned</span>,
    },
    {
      key: "acquisition",
      header: "Acquisition",
      render: (r) => <StatusPill status={r.acquisitionType} map={ACQUISITION_META} className="text-[10px]" />,
    },
    {
      key: "coverage",
      header: "Coverage",
      className: "hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (r) => <ScopeChips values={labelsFor(TERRITORIES, r.territories)} />,
    },
    {
      key: "window",
      header: "Window",
      className: "hidden text-xs text-text-secondary xl:table-cell",
      headClassName: "hidden xl:table-cell",
      render: (r) => `${r.windowStart ? formatDate(r.windowStart) : "—"} → ${r.windowEnd ? formatDate(r.windowEnd) : "open"}`,
    },
    {
      key: "share",
      header: "Share",
      align: "right",
      className: "tabular-nums text-xs",
      render: (r) => formatPercent(r.ownershipShare),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} map={RIGHTS_STATUS_META} className="text-[10px]" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions onEdit={() => setEditing(r)} onDelete={() => handleDelete(r)} />
        </div>
      ),
    },
  ];

  const exportColumns = [
    { key: "title", header: "Right" },
    { key: "holder", header: "Holder", value: (r) => holderById.get(r.rightsHolderId)?.name || "" },
    { key: "acquisitionType", header: "Acquisition" },
    { key: "territories", header: "Territories", value: (r) => labelsFor(TERRITORIES, r.territories).join("; ") },
    { key: "channels", header: "Channels", value: (r) => labelsFor(CHANNELS, r.channels).join("; ") },
    { key: "windowStart", header: "Window start" },
    { key: "windowEnd", header: "Window end" },
    { key: "exclusivity", header: "Exclusivity" },
    { key: "ownershipShare", header: "Ownership %" },
    { key: "status", header: "Status" },
  ];

  const hasFilters =
    statusFilter !== "all" || acquisitionFilter !== "all" || exclusivityFilter !== "all" || Boolean(search);
  const clearFilters = () => {
    setStatusFilter("all");
    setAcquisitionFilter("all");
    setExclusivityFilter("all");
    setSearch("");
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Rights Inventory"
        description="Record the rights the organisation owns or controls — holders, shares, territories and windows."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-1.5 border-border bg-surface-card text-xs hover:bg-surface-hover"
              onClick={() => setShowHolders(true)}
            >
              <Users className="h-4 w-4" />
              Rights holders
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              New right
            </Button>
          </div>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={acquisitionFilter} onValueChange={setAcquisitionFilter} options={ACQUISITION_FILTERS} placeholder="Acquisition" />
          <FilterDropdown value={exclusivityFilter} onValueChange={setExclusivityFilter} options={EXCLUSIVITY_FILTERS} placeholder="Exclusivity" />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <div className="flex items-center gap-2">
          <ExportButton filename="rights-inventory" rows={filtered} columns={exportColumns} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search rights..." className="w-full sm:w-56" />
        </div>
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" label="Loading rights inventory" />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(r) => r.id}
          onRowClick={setEditing}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={hasFilters ? SlidersHorizontal : Scale}
                title={hasFilters ? "No matching rights" : "No rights recorded yet"}
                description={
                  hasFilters
                    ? "Try adjusting your filters."
                    : "Record what the organisation owns or has licensed in, so every outbound grant can be checked against it."
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" className="border-border bg-surface-card" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}>
                      <Plus className="h-4 w-4" />
                      New right
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
          Showing {filtered.length} of {rows.length} rights records
        </div>
      ) : null}
      <RecordDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        holders={holders}
        assets={assets}
        title="New rights record"
        submitLabel="Add right"
        onSubmit={handleCreate}
      />
      {editing ? (
        <RecordDialog
          open={Boolean(editing)}
          onOpenChange={(v) => !v && setEditing(null)}
          initial={editing}
          holders={holders}
          assets={assets}
          title={editing.title || "Edit rights record"}
          submitLabel="Save changes"
          onSubmit={handleSave}
        />
      ) : null}
      <HoldersDialog
        open={showHolders}
        onOpenChange={setShowHolders}
        holders={holders}
        onCreate={handleCreateHolder}
        onUpdate={handleToggleHolderKind}
        onDelete={handleDeleteHolder}
      />
    </MainScreenWrapper>
  );
}

export default RightsInventoryScreen;
