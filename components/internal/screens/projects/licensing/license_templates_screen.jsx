"use client";

import React, { useMemo, useState } from "react";
import { Archive, Copy, Plus, ScrollText, SlidersHorizontal, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { Switch } from "@geiger/ui/switch";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
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
  FormSection,
  RowActions,
  SelectField,
  TextAreaField,
  TextField,
  useModuleRows,
} from "@/components/internal/shared/module_kit";
import { ChipSelect, ExportButton, ScopeChips, TagListField } from "./licensing_kit";
import {
  CHANNELS,
  DURATION_OPTIONS,
  EXCLUSIVITY_META,
  TEMPLATE_STATUS_META,
  TERRITORIES,
  USAGE_TYPE_META,
  formatDate,
  labelFor,
  labelsFor,
  optionsFromMeta,
} from "./constants";
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
} from "@/lib/supabase/licensing";

const STATUS_FILTERS = optionsFromMeta(TEMPLATE_STATUS_META, "All statuses");
const USAGE_FILTERS = optionsFromMeta(USAGE_TYPE_META, "All usage types");
const USAGE_OPTIONS = optionsFromMeta(USAGE_TYPE_META);
const EXCLUSIVITY_OPTIONS = optionsFromMeta(EXCLUSIVITY_META);
const STATUS_OPTIONS = optionsFromMeta(TEMPLATE_STATUS_META);

const DEFAULT_TERMS = `The Licensor grants the Licensee a {{exclusivity}} licence to use the Licensed Material for {{usage}} purposes in {{territories}} via {{channels}} for {{duration}}, subject to the restrictions set out below. All other rights are reserved by the Licensor.`;

const EMPTY_TEMPLATE = {
  name: "",
  description: "",
  usageType: "web",
  defaultTerritories: ["north_america"],
  defaultChannels: ["web"],
  defaultDurationMonths: "12",
  exclusivity: "non_exclusive",
  restrictions: [],
  termsBody: DEFAULT_TERMS,
  requiresApproval: false,
  status: "draft",
};

function TemplateDialog({ open, onOpenChange, initial, onSubmit, title, submitLabel }) {
  const [draft, setDraft] = useState(EMPTY_TEMPLATE);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  React.useEffect(() => {
    if (!open) return;
    setDraft(
      initial
        ? { ...EMPTY_TEMPLATE, ...initial, defaultDurationMonths: String(initial.defaultDurationMonths ?? 12) }
        : EMPTY_TEMPLATE,
    );
  }, [initial, open]);

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="A reusable outbound grant — scope defaults, restrictions and the terms body a licence inherits."
      submitLabel={submitLabel}
      wide
      onSubmit={() => onSubmit(draft)}
    >
      <FormSection title="Identity" description="How the template reads in the picker when a licence is issued.">
        <TextField label="Template name" value={draft.name} onChange={set("name")} placeholder="e.g. Standard web campaign" />
        <TextAreaField
          label="Description"
          value={draft.description}
          onChange={set("description")}
          rows={2}
          placeholder="When should someone reach for this template?"
        />
      </FormSection>

      <FormSection title="Default grant" description="The scope a new licence inherits — still editable per licence.">
        <FieldRow columns={3}>
          <SelectField label="Usage type" value={draft.usageType} onChange={set("usageType")} options={USAGE_OPTIONS} placeholder="Usage" />
          <SelectField label="Default duration" value={draft.defaultDurationMonths} onChange={set("defaultDurationMonths")} options={DURATION_OPTIONS} placeholder="Duration" />
          <SelectField label="Exclusivity" value={draft.exclusivity} onChange={set("exclusivity")} options={EXCLUSIVITY_OPTIONS} placeholder="Exclusivity" />
        </FieldRow>
        <ChipSelect label="Default territories" options={TERRITORIES} values={draft.defaultTerritories} onChange={set("defaultTerritories")} emptyHint="No default territory." />
        <ChipSelect label="Default channels" options={CHANNELS} values={draft.defaultChannels} onChange={set("defaultChannels")} emptyHint="No default channel." />
      </FormSection>

      <FormSection title="Terms" description="What the licensee is bound by.">
        <TagListField
          label="Restrictions"
          hint="Carried onto every licence issued from this template."
          values={draft.restrictions}
          onChange={set("restrictions")}
          placeholder="e.g. No use in political advertising"
        />
        <TextAreaField
          label="Terms body"
          hint="Tokens {{exclusivity}}, {{usage}}, {{territories}}, {{channels}} and {{duration}} are filled in on the certificate."
          value={draft.termsBody}
          onChange={set("termsBody")}
          rows={5}
        />
      </FormSection>

      <FormSection title="Availability">
        <FieldRow>
          <SelectField label="Status" value={draft.status} onChange={set("status")} options={STATUS_OPTIONS} placeholder="Status" />
          <Field label="Requires approval" hint="Licences from this template start as pending.">
            <div className="flex h-10 items-center">
              <Switch checked={draft.requiresApproval} onCheckedChange={set("requiresApproval")} />
            </div>
          </Field>
        </FieldRow>
      </FormSection>
    </CreateDialog>
  );
}

export function LicenseTemplatesScreen({ projectId }) {
  const [rows, setRows, loading] = useModuleRows(listTemplates, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [usageFilter, setUsageFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    if (usageFilter !== "all") list = list.filter((t) => t.usageType === usageFilter);
    return list;
  }, [rows, search, statusFilter, usageFilter]);

  const stats = useMemo(() => {
    const active = rows.filter((t) => t.status === "active").length;
    const exclusive = rows.filter((t) => t.exclusivity !== "non_exclusive").length;
    const gated = rows.filter((t) => t.requiresApproval).length;
    const avgDuration = rows.length
      ? Math.round(rows.reduce((sum, t) => sum + (t.defaultDurationMonths || 0), 0) / rows.length)
      : 0;
    return [
      { label: "Templates", value: String(rows.length), footer: `${active} active` },
      { label: "Exclusive grants", value: String(exclusive), footer: "premium pricing" },
      { label: "Approval gated", value: String(gated), footer: gated ? "issue as pending" : "none gated" },
      { label: "Avg term", value: `${avgDuration} mo`, footer: "default duration" },
    ];
  }, [rows]);

  const toPayload = (draft) => ({
    ...draft,
    name: draft.name.trim(),
    defaultDurationMonths: Number(draft.defaultDurationMonths) || 0,
  });

  const handleCreate = async (draft) => {
    if (!draft.name.trim()) return toast.error("A template needs a name");
    const id = crypto.randomUUID();
    const payload = { id, projectId, ...toPayload(draft), version: 1, position: rows.length };
    setRows((prev) => [{ ...payload, updatedAt: new Date().toISOString() }, ...prev]);
    setShowCreate(false);
    const created = await createTemplate(payload);
    if (created) {
      setRows((prev) => prev.map((t) => (t.id === id ? created : t)));
      toast.success("Template created");
    } else {
      setRows((prev) => prev.filter((t) => t.id !== id));
      toast.error("Could not create the template");
    }
  };

  const handleSave = async (draft) => {
    if (!editing) return;
    const previous = rows;
    const patch = toPayload(draft);
    setRows((list) => list.map((t) => (t.id === editing.id ? { ...t, ...patch } : t)));
    setEditing(null);
    const saved = await updateTemplate(editing.id, patch);
    if (saved) {
      setRows((list) => list.map((t) => (t.id === saved.id ? saved : t)));
      toast.success("Template updated");
    } else {
      setRows(previous);
      toast.error("Could not save the template");
    }
  };

  // Duplicating bumps the version so the original stays citable on issued licences.
  const handleDuplicate = async (template) => {
    const id = crypto.randomUUID();
    const payload = {
      ...template,
      id,
      projectId,
      name: `${template.name} (v${(template.version || 1) + 1})`,
      version: (template.version || 1) + 1,
      status: "draft",
      position: rows.length,
    };
    delete payload.createdAt;
    delete payload.updatedAt;
    setRows((prev) => [payload, ...prev]);
    const created = await createTemplate(payload);
    if (created) {
      setRows((prev) => prev.map((t) => (t.id === id ? created : t)));
      toast.success("Template duplicated");
    } else {
      setRows((prev) => prev.filter((t) => t.id !== id));
      toast.error("Could not duplicate the template");
    }
  };

  const handleToggleStatus = async (template) => {
    const nextStatus = template.status === "active" ? "archived" : "active";
    const previous = rows;
    setRows((list) => list.map((t) => (t.id === template.id ? { ...t, status: nextStatus } : t)));
    const saved = await updateTemplate(template.id, { status: nextStatus });
    if (saved) toast.success(nextStatus === "active" ? "Template activated" : "Template archived");
    else {
      setRows(previous);
      toast.error("Could not update the template");
    }
  };

  const handleDelete = async (template) => {
    const previous = rows;
    setRows((list) => list.filter((t) => t.id !== template.id));
    const ok = await deleteTemplate(template.id);
    if (ok) toast.success("Template deleted");
    else {
      setRows(previous);
      toast.error("Could not delete the template");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Template",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {t.name || "Untitled template"}
            <span className="ml-1.5 text-[11px] font-normal text-text-tertiary">v{t.version}</span>
          </p>
          <p className="truncate text-[11px] text-text-tertiary">{t.description || labelFor(USAGE_TYPE_META, t.usageType)}</p>
        </div>
      ),
    },
    { key: "usage", header: "Usage", className: "text-xs", render: (t) => labelFor(USAGE_TYPE_META, t.usageType) },
    {
      key: "scope",
      header: "Default scope",
      className: "hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (t) => <ScopeChips values={labelsFor(TERRITORIES, t.defaultTerritories)} />,
    },
    {
      key: "term",
      header: "Term",
      className: "text-xs text-text-secondary",
      render: (t) => (t.defaultDurationMonths ? `${t.defaultDurationMonths} mo` : "Perpetual"),
    },
    {
      key: "exclusivity",
      header: "Exclusivity",
      className: "hidden xl:table-cell",
      headClassName: "hidden xl:table-cell",
      render: (t) => <StatusPill status={t.exclusivity} map={EXCLUSIVITY_META} className="text-[10px]" />,
    },
    {
      key: "status",
      header: "Status",
      render: (t) => <StatusPill status={t.status} map={TEMPLATE_STATUS_META} className="text-[10px]" />,
    },
    {
      key: "updated",
      header: "Updated",
      className: "hidden text-xs text-text-secondary xl:table-cell",
      headClassName: "hidden xl:table-cell",
      render: (t) => formatDate(t.updatedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (t) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            extra={[
              {
                icon: t.status === "active" ? Archive : Upload,
                label: t.status === "active" ? "Archive" : "Activate",
                onSelect: () => handleToggleStatus(t),
              },
              { icon: Copy, label: "Duplicate & bump version", onSelect: () => handleDuplicate(t) },
            ]}
            onEdit={() => setEditing(t)}
            onDelete={() => handleDelete(t)}
          />
        </div>
      ),
    },
  ];

  const exportColumns = [
    { key: "name", header: "Template" },
    { key: "version", header: "Version" },
    { key: "usageType", header: "Usage" },
    { key: "defaultTerritories", header: "Territories", value: (t) => labelsFor(TERRITORIES, t.defaultTerritories).join("; ") },
    { key: "defaultChannels", header: "Channels", value: (t) => labelsFor(CHANNELS, t.defaultChannels).join("; ") },
    { key: "defaultDurationMonths", header: "Duration (months)" },
    { key: "exclusivity", header: "Exclusivity" },
    { key: "restrictions", header: "Restrictions", value: (t) => (t.restrictions || []).join("; ") },
    { key: "status", header: "Status" },
  ];

  const hasFilters = statusFilter !== "all" || usageFilter !== "all" || Boolean(search);
  const clearFilters = () => {
    setStatusFilter("all");
    setUsageFilter("all");
    setSearch("");
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="License Templates"
        description="Reusable outbound grants — usage, territories, channels, duration and restrictions in one place."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New template
          </Button>
        }
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={usageFilter} onValueChange={setUsageFilter} options={USAGE_FILTERS} placeholder="Usage" />
          {hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
        </div>
        <div className="flex items-center gap-2">
          <ExportButton filename="license-templates" rows={filtered} columns={exportColumns} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search templates..." className="w-full sm:w-56" />
        </div>
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" label="Loading licence templates" />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(t) => t.id}
          onRowClick={setEditing}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={hasFilters ? SlidersHorizontal : ScrollText}
                title={hasFilters ? "No matching templates" : "No templates yet"}
                description={
                  hasFilters
                    ? "Try adjusting your filters."
                    : "Define the grants you issue repeatedly, so a licence is a few clicks rather than a re-drafted contract."
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" className="border-border bg-surface-card" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}>
                      <Plus className="h-4 w-4" />
                      New template
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
          Showing {filtered.length} of {rows.length} templates
        </div>
      ) : null}
      <TemplateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        title="New licence template"
        submitLabel="Create template"
        onSubmit={handleCreate}
      />
      {editing ? (
        <TemplateDialog
          open={Boolean(editing)}
          onOpenChange={(v) => !v && setEditing(null)}
          initial={editing}
          title={editing.name || "Edit template"}
          submitLabel="Save changes"
          onSubmit={handleSave}
        />
      ) : null}
    </MainScreenWrapper>
  );
}

export default LicenseTemplatesScreen;
