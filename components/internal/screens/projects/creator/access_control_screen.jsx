"use client";

import React, { useMemo, useState } from "react";
import { Download, Eye, FolderOpen, GalleryHorizontalEnd, Layers, Lock, Pause, Play, ShieldPlus, SlidersHorizontal, Stamp } from "lucide-react";
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
  SettingRow,
  SettingsList,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  ACCESS_GATE_META,
  ACCESS_LEVEL_OPTIONS,
  ACCESS_TARGET_OPTIONS,
  GATE_OPTIONS,
  TIER_STATUS_META,
  formatDate,
  statusFilterOptions,
} from "./constants";
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
  useCreatorRows,
} from "./creator_kit";
import { listAccessRules, createAccessRule, updateAccessRule, deleteAccessRule, listTiers } from "@/lib/supabase/creator";
import { listCollections } from "@/lib/supabase/collections";
import { listFolders } from "@/lib/supabase/folders";
import { listGalleries } from "@/lib/supabase/galleries";
import { getUser } from "@/lib/supabase/user";

const TARGET_ICON = { gallery: GalleryHorizontalEnd, collection: Layers, folder: FolderOpen };
const TARGET_FILTERS = [{ value: "all", label: "All targets" }, ...ACCESS_TARGET_OPTIONS];
const GATE_FILTERS = statusFilterOptions(ACCESS_GATE_META, "All gates");
const LEVEL_LABEL = { preview: "Preview", standard: "Standard", full_res: "Full-res" };

const EMPTY = {
  name: "",
  targetType: "gallery",
  targetId: "",
  minTierId: "",
  gate: "login",
  accessLevel: "standard",
  allowDownload: true,
  bypassWatermark: false,
  showMetadata: true,
  welcomeMessage: "",
  isActive: true,
};

function draftOf(rule) {
  if (!rule) return EMPTY;
  return {
    name: rule.name,
    targetType: rule.targetType,
    targetId: rule.targetId ?? "",
    minTierId: rule.minTierId ?? "",
    gate: rule.gate,
    accessLevel: rule.accessLevel,
    allowDownload: rule.allowDownload,
    bypassWatermark: rule.bypassWatermark,
    showMetadata: rule.showMetadata,
    welcomeMessage: rule.welcomeMessage,
    isActive: rule.isActive,
  };
}

function RuleDialog({ open, onOpenChange, initial, targets, tiers, onSubmit, title, submitLabel }) {
  const [draft, setDraft] = useState(EMPTY);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  React.useEffect(() => {
    if (open) setDraft(draftOf(initial));
  }, [initial, open]);

  const targetOptions = targets[draft.targetType] || [];
  const preview = draft.gate === "preview";

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Gate a gallery, collection or folder behind a membership tier."
      submitLabel={submitLabel}
      size="lg"
      onSubmit={() => {
        const target = targetOptions.find((t) => t.value === draft.targetId);
        onSubmit({ ...draft, targetId: draft.targetId || null, minTierId: draft.minTierId || null, targetLabel: target?.label ?? "" });
      }}
    >
      <FormSection title="What's gated">
        <TextField label="Rule name" value={draft.name} onChange={set("name")} placeholder="e.g. Studio pass — spring gallery" />
        <FieldRow>
          <SelectField
            label="Target type"
            value={draft.targetType}
            onChange={(v) => setDraft((d) => ({ ...d, targetType: v, targetId: "" }))}
            options={ACCESS_TARGET_OPTIONS}
          />
          <SelectField
            label={ACCESS_TARGET_OPTIONS.find((o) => o.value === draft.targetType)?.label || "Target"}
            value={draft.targetId}
            onChange={set("targetId")}
            options={targetOptions}
            placeholder={targetOptions.length ? "Select…" : "Nothing to gate yet"}
            disabled={!targetOptions.length}
          />
        </FieldRow>
      </FormSection>
      <FormSection title="Who gets in">
        <FieldRow>
          <SelectField
            label="Minimum tier"
            value={draft.minTierId}
            onChange={set("minTierId")}
            options={[{ value: "", label: "Any signed-in member" }, ...tiers.map((t) => ({ value: t.id, label: t.name }))]}
            hint="Higher-positioned tiers inherit access."
          />
          <SelectField label="Gate" value={draft.gate} onChange={set("gate")} options={GATE_OPTIONS} />
        </FieldRow>
        <SelectField
          label="Member access level"
          value={draft.accessLevel}
          onChange={set("accessLevel")}
          options={ACCESS_LEVEL_OPTIONS}
          hint={preview ? "Non-members see a watermarked preview either way." : "What qualifying members see once they're in."}
        />
        <SettingsList>
          <SettingRow icon={Download} title="Allow downloads" description="Members can download at their access level." checked={draft.allowDownload} onCheckedChange={set("allowDownload")} />
          <SettingRow icon={Stamp} title="Bypass watermark" description="Members see clean files; everyone else stays watermarked." checked={draft.bypassWatermark} onCheckedChange={set("bypassWatermark")} />
          <SettingRow icon={Eye} title="Show metadata" description="Captions, credits and EXIF are visible to members." checked={draft.showMetadata} onCheckedChange={set("showMetadata")} />
        </SettingsList>
      </FormSection>
      {draft.targetType === "gallery" ? (
        <FormSection title="Gallery experience">
          <TextAreaField
            label="Member welcome banner"
            value={draft.welcomeMessage}
            onChange={set("welcomeMessage")}
            placeholder="Shown at the top of the gallery once a member signs in."
            rows={2}
          />
        </FormSection>
      ) : null}
      <SettingsList>
        <SettingRow title="Rule active" description="Paused rules leave the target open to its normal visibility." checked={draft.isActive} onCheckedChange={set("isActive")} />
      </SettingsList>
    </CreateDialog>
  );
}

export function AccessControlScreen({ projectId }) {
  const [rows, setRows, loading] = useCreatorRows(listAccessRules, projectId);
  const [tiers] = useCreatorRows(listTiers, projectId);
  const [galleries] = useCreatorRows(listGalleries, projectId);
  const [collections] = useCreatorRows(listCollections, projectId);
  const [folders] = useCreatorRows(listFolders, projectId);
  const [search, setSearch] = useState("");
  const [targetFilter, setTargetFilter] = useState("all");
  const [gateFilter, setGateFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const orderedTiers = useMemo(() => [...tiers].sort((a, b) => a.position - b.position), [tiers]);
  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const targets = useMemo(
    () => ({
      gallery: galleries.map((g) => ({ value: g.id, label: g.name || g.slug })),
      collection: collections.map((c) => ({ value: c.id, label: c.name })),
      folder: folders.map((f) => ({ value: f.id, label: f.path || f.name })),
    }),
    [galleries, collections, folders],
  );
  const targetLabel = (rule) => targets[rule.targetType]?.find((t) => t.value === rule.targetId)?.label || rule.targetLabel || "Unassigned";

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((a) => a.name.toLowerCase().includes(q) || a.targetLabel.toLowerCase().includes(q));
    }
    if (targetFilter !== "all") r = r.filter((a) => a.targetType === targetFilter);
    if (gateFilter !== "all") r = r.filter((a) => a.gate === gateFilter);
    return r;
  }, [rows, search, targetFilter, gateFilter]);

  const pager = usePagination(filtered, { resetKey: `${search}|${targetFilter}|${gateFilter}` });

  const stats = useMemo(() => {
    const active = rows.filter((a) => a.isActive);
    return [
      { label: "Access rules", value: String(rows.length), footer: `${active.length} enforced` },
      { label: "Gated galleries", value: String(new Set(active.filter((a) => a.targetType === "gallery").map((a) => a.targetId)).size), footer: `of ${galleries.length} galleries` },
      { label: "Paywalls", value: String(active.filter((a) => a.gate === "paywall").length), footer: "subscribe to view" },
      { label: "Full-res for members", value: String(active.filter((a) => a.accessLevel === "full_res").length), footer: `${active.filter((a) => a.bypassWatermark).length} bypass watermark` },
    ];
  }, [rows, galleries.length]);

  const replace = (next) => setRows((list) => list.map((a) => (a.id === next.id ? next : a)));

  const validate = (input) => {
    if (!input.name.trim()) return "Rule name is required";
    if (!input.targetId) return "Pick what this rule gates";
    return null;
  };

  const handleCreate = async (input) => {
    const error = validate(input);
    if (error) return toast.error(error);
    const user = await getUser();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const payload = { ...input, id, projectId, name: input.name.trim(), createdBy: user?.id || null };
    setRows((prev) => [{ ...payload, createdAt: now, updatedAt: now }, ...prev]);
    setShowCreate(false);
    const created = await createAccessRule(payload);
    if (created) {
      replace(created);
      toast.success("Access rule created");
    } else {
      setRows((prev) => prev.filter((a) => a.id !== id));
      toast.error("Could not create the rule");
    }
  };

  const persist = async (rule, patch, message) => {
    const prev = rows;
    replace({ ...rule, ...patch });
    const saved = await updateAccessRule(rule.id, patch);
    if (!saved) {
      setRows(prev);
      toast.error("Could not save the rule");
    } else {
      replace(saved);
      toast.success(message);
    }
  };

  const handleSave = async (input) => {
    if (!editing) return;
    const error = validate(input);
    if (error) return toast.error(error);
    const rule = editing;
    setEditing(null);
    await persist(rule, { ...input, name: input.name.trim() }, "Access rule updated");
  };

  const handleDelete = async (rule) => {
    const prev = rows;
    setRows((list) => list.filter((a) => a.id !== rule.id));
    const ok = await deleteAccessRule(rule.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete the rule");
    } else toast.success("Access rule deleted");
  };

  const columns = [
    {
      key: "rule",
      header: "Rule",
      render: (a) => {
        const Icon = TARGET_ICON[a.targetType] || Lock;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
              <p className="truncate text-[11px] text-text-tertiary">{targetLabel(a)}</p>
            </div>
          </div>
        );
      },
    },
    { key: "gate", header: "Gate", render: (a) => <StatusPill status={a.gate} map={ACCESS_GATE_META} className="text-[10px]" /> },
    {
      key: "tier",
      header: "Minimum tier",
      className: "hidden text-xs sm:table-cell",
      headClassName: "hidden sm:table-cell",
      render: (a) => tierById.get(a.minTierId)?.name || <span className="text-text-tertiary">Any member</span>,
    },
    {
      key: "access",
      header: "Members get",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) =>
        [LEVEL_LABEL[a.accessLevel], a.allowDownload ? "downloads" : "view only", a.bypassWatermark ? "no watermark" : null].filter(Boolean).join(" · "),
    },
    { key: "status", header: "Status", render: (a) => <StatusPill status={a.isActive ? "active" : "paused"} map={TIER_STATUS_META} className="text-[10px]" /> },
    {
      key: "updated",
      header: "Updated",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (a) => formatDate(a.updatedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (a) => (
        <RowActions
          onEdit={() => setEditing(a)}
          onDelete={() => handleDelete(a)}
          extra={[
            a.isActive
              ? { icon: Pause, label: "Pause rule", onSelect: () => persist(a, { isActive: false }, "Rule paused") }
              : { icon: Play, label: "Enforce rule", onSelect: () => persist(a, { isActive: true }, "Rule enforced") },
          ]}
        />
      ),
    },
  ];

  const hasFilters = targetFilter !== "all" || gateFilter !== "all" || Boolean(search);
  const clear = () => {
    setTargetFilter("all");
    setGateFilter("all");
    setSearch("");
  };
  const newRule = (
    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}>
      <ShieldPlus className="h-4 w-4" />
      New rule
    </Button>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Access Control"
        description="Gate galleries, collections and folders by tier — login gates, paywalls, full-res and watermark bypass for members."
        actions={newRule}
      />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={targetFilter} onValueChange={setTargetFilter} options={TARGET_FILTERS} placeholder="Target" icon={SlidersHorizontal} />
          <FilterDropdown value={gateFilter} onValueChange={setGateFilter} options={GATE_FILTERS} placeholder="Gate" icon={Lock} />
          {hasFilters ? <ClearFiltersButton onClick={clear} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search rules..." className="w-full sm:w-64" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" />
      ) : (
        <DataTable
          columns={columns}
          data={pager.pageItems}
          getRowKey={(a) => a.id}
          onRowClick={setEditing}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={Lock}
                title={hasFilters ? "No rules match" : "Nothing is gated yet"}
                description={hasFilters ? "Try adjusting your filters." : "Put a gallery behind a paywall or restrict a collection to paying tiers."}
                action={hasFilters ? <ClearFiltersButton onClick={clear} /> : newRule}
              />
            </div>
          }
        />
      )}
      {!loading ? <ListPagination {...pager} itemLabel="rules" /> : null}
      <RuleDialog open={showCreate} onOpenChange={setShowCreate} targets={targets} tiers={orderedTiers} title="New access rule" submitLabel="Create rule" onSubmit={handleCreate} />
      {editing ? (
        <RuleDialog
          open={Boolean(editing)}
          onOpenChange={(v) => !v && setEditing(null)}
          initial={editing}
          targets={targets}
          tiers={orderedTiers}
          title={`Edit ${editing.name}`}
          submitLabel="Save changes"
          onSubmit={handleSave}
        />
      ) : null}
    </MainScreenWrapper>
  );
}

export default AccessControlScreen;
