"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  GitBranch,
  Pause,
  Pencil,
  Play,
  Plus,
  Star,
  Trash2,
} from "lucide-react";

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
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
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
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";

import {
  listPipelines,
  createPipeline,
  updatePipeline,
  softDeletePipeline,
  setDefaultPipeline,
} from "@/lib/supabase/approvals";
import { listRoles, listMembers } from "@/lib/supabase/rbac";
import { getUser } from "@/lib/supabase/user";
import { uniqueId } from "@/lib/utils";

import {
  PIPELINE_STATUS_MAP,
  PIPELINE_STATUS_FILTER_OPTIONS,
  PIPELINE_MODE_MAP,
  PIPELINE_SUBJECTS,
  PIPELINE_TEMPLATES,
  SUBJECT_FILTER_OPTIONS,
  groupedSubjects,
  newStage,
  subjectEntry,
} from "./constants";
import { PipelineBuilderScreen } from "./pipeline_builder";

const EMPTY_DRAFT = { name: "", subjectType: "asset", template: "blank" };

function CreatePipelineDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const template = PIPELINE_TEMPLATES.find((t) => t.key === draft.template);

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the pipeline a name first.");
      return;
    }
    onCreate(draft);
    setDraft(EMPTY_DRAFT);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-background">
        <DialogHeader>
          <DialogTitle>Create approval pipeline</DialogTitle>
          <DialogDescription>
            A pipeline decides who signs off on a kind of work, and in what order.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="grid gap-4"
        >
          <Field label="Pipeline name" htmlFor="pipeline-new-name">
            <Input
              id="pipeline-new-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Client deliverable sign-off"
            />
          </Field>

          <Field
            label="Start from"
            hint={template?.description}
          >
            <Select
              value={draft.template}
              onValueChange={(v) => {
                const t = PIPELINE_TEMPLATES.find((x) => x.key === v);
                setDraft((d) => ({
                  ...d,
                  template: v,
                  subjectType: t?.subjectType || d.subjectType,
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_TEMPLATES.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Applies to"
            hint="Which kind of thing this pipeline routes for approval."
          >
            <Select value={draft.subjectType} onValueChange={set("subjectType")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groupedSubjects(PIPELINE_SUBJECTS).map(({ group, items }) => (
                  <React.Fragment key={group}>
                    <div className="px-2 py-1.5 text-xs font-medium text-text-tertiary">
                      {group}
                    </div>
                    {items.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                        {s.available ? "" : " (planned)"}
                      </SelectItem>
                    ))}
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            Create pipeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The ordered role chips shown in the Stages column. */
function StageTrail({ stages, roles }) {
  if (!stages?.length) {
    return <span className="text-xs text-text-tertiary">No stages yet</span>;
  }
  const shown = stages.slice(0, 3);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((s, i) => {
        const role = roles.find((r) => r.id === s.roleId);
        const label =
          s.approverType === "member"
            ? `${s.memberIds?.length || 0} ${(s.memberIds?.length || 0) === 1 ? "person" : "people"}`
            : role?.name || s.name || `Stage ${i + 1}`;
        return (
          <React.Fragment key={s.id || i}>
            {i > 0 ? <span className="text-text-tertiary">→</span> : null}
            <Badge variant="neutral" className="font-normal">
              {label}
            </Badge>
          </React.Fragment>
        );
      })}
      {stages.length > 3 ? (
        <span className="text-xs text-text-tertiary">+{stages.length - 3}</span>
      ) : null}
    </div>
  );
}

export function ApprovalPipelinesScreen({ projectId }) {
  const [pipelines, setPipelines] = useState([]);
  const [roles, setRoles] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [subjectType, setSubjectType] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let alive = true;
    listPipelines(projectId).then((rows) => {
      if (!alive) return;
      setPipelines(rows ?? []);
      setLoading(false);
    });
    listRoles(projectId).then((rows) => alive && setRoles(rows ?? []));
    listMembers(projectId).then((rows) => alive && setMembers(rows ?? []));
    getUser().then((u) => alive && setUser(u));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const selected = useMemo(
    () => (openId ? pipelines.find((p) => p.id === openId) || null : null),
    [openId, pipelines],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return pipelines.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (subjectType !== "all" && p.subjectType !== subjectType) return false;
      if (term) {
        const subject = subjectEntry(p.subjectType)?.label || "";
        if (!`${p.name} ${p.description} ${subject}`.toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [pipelines, search, status, subjectType]);

  const stats = useMemo(() => {
    const active = pipelines.filter((p) => p.status === "Active").length;
    const subjects = new Set(pipelines.map((p) => p.subjectType)).size;
    const totalStages = pipelines.reduce((s, p) => s + (p.stages?.length || 0), 0);
    const avg = pipelines.length ? (totalStages / pipelines.length).toFixed(1) : "0";
    const routed = pipelines.reduce((s, p) => s + (p.reviewCount || 0), 0);
    return [
      { label: "Pipelines", value: String(pipelines.length), footer: `${active} active` },
      { label: "Subjects covered", value: String(subjects), footer: "Of what can be routed" },
      { label: "Avg. stages", value: avg, footer: "Per pipeline" },
      { label: "Reviews routed", value: routed.toLocaleString("en-US"), footer: "All time" },
    ];
  }, [pipelines]);

  const persistCreate = (pipeline) => {
    createPipeline(pipeline).then((saved) => {
      if (saved) {
        setPipelines((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
        toast.success(`"${pipeline.name}" created as a draft.`);
      } else {
        setPipelines((prev) => prev.filter((p) => p.id !== pipeline.id));
        toast.error("Couldn't save the pipeline.");
      }
    });
  };

  const handleCreate = (draft) => {
    const template = PIPELINE_TEMPLATES.find((t) => t.key === draft.template);
    const stages = (template?.stages || []).map((s, i) => ({
      ...newStage(i),
      ...s,
    }));
    const pipeline = {
      id: uniqueId(),
      projectId,
      name: draft.name.trim(),
      description: template?.description || "",
      subjectType: draft.subjectType,
      status: "Draft",
      mode: template?.mode || "sequential",
      isDefault: false,
      stages: stages.length ? stages : [newStage(0)],
      autoLockVersion: true,
      autoStampStatus: true,
      reviewCount: 0,
      createdBy: user?.id || null,
    };
    setPipelines((prev) => [pipeline, ...prev]);
    persistCreate(pipeline);
    setOpenId(pipeline.id);
  };

  const handleUpdate = (updated) => {
    const previous = pipelines.find((p) => p.id === updated.id);
    setPipelines((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    updatePipeline(updated.id, updated).then((saved) => {
      if (saved) return;
      if (previous) {
        setPipelines((prev) => prev.map((p) => (p.id === previous.id ? previous : p)));
      }
      toast.error("Couldn't save your changes.");
    });
  };

  const handleToggleStatus = (pipeline) => {
    const next = pipeline.status === "Active" ? "Paused" : "Active";
    if (next === "Active" && !pipeline.stages?.length) {
      toast.error("Add at least one stage before activating this pipeline.");
      return;
    }
    setPipelines((prev) =>
      prev.map((p) => (p.id === pipeline.id ? { ...p, status: next } : p)),
    );
    updatePipeline(pipeline.id, { status: next }).then((saved) => {
      if (!saved) {
        setPipelines((prev) =>
          prev.map((p) => (p.id === pipeline.id ? { ...p, status: pipeline.status } : p)),
        );
        toast.error("Couldn't update the pipeline.");
        return;
      }
      toast.success(next === "Active" ? `"${pipeline.name}" activated.` : `"${pipeline.name}" paused.`);
    });
  };

  const handleSetDefault = (pipeline) => {
    setPipelines((prev) =>
      prev.map((p) =>
        p.subjectType === pipeline.subjectType
          ? { ...p, isDefault: p.id === pipeline.id }
          : p,
      ),
    );
    setDefaultPipeline(pipeline.id, projectId, pipeline.subjectType).then((saved) => {
      if (!saved) {
        toast.error("Couldn't set the default pipeline.");
        listPipelines(projectId).then((rows) => setPipelines(rows ?? []));
        return;
      }
      toast.success(
        `"${pipeline.name}" is now the default for ${subjectEntry(pipeline.subjectType)?.label?.toLowerCase() || "this subject"}.`,
      );
    });
  };

  const handleDuplicate = (pipeline) => {
    const copy = {
      ...pipeline,
      id: uniqueId(),
      name: `${pipeline.name} (copy)`,
      status: "Draft",
      isDefault: false,
      reviewCount: 0,
      createdBy: user?.id || null,
      projectId,
    };
    setPipelines((prev) => [copy, ...prev]);
    toast.success(`Duplicated "${pipeline.name}".`);
    persistCreate(copy);
  };

  const handleDelete = (pipeline) => {
    setDeleteTarget(null);
    if (openId === pipeline.id) setOpenId(null);
    setPipelines((prev) => prev.filter((p) => p.id !== pipeline.id));
    softDeletePipeline(pipeline.id).then((ok) => {
      if (!ok) {
        setPipelines((prev) => [pipeline, ...prev]);
        toast.error("Couldn't delete the pipeline.");
        return;
      }
      toast.success(`Deleted "${pipeline.name}".`);
    });
  };

  const columns = [
    {
      key: "name",
      header: "Pipeline",
      render: (p) => (
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            {p.name}
            {p.isDefault ? (
              <Star
                className="h-3 w-3 fill-emerald-400 text-emerald-400"
                aria-label="Default pipeline"
              />
            ) : null}
          </span>
          <span className="text-xs text-text-secondary">
            {p.stages?.length || 0} stage{(p.stages?.length || 0) === 1 ? "" : "s"}
            {p.description ? ` · ${p.description}` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "subject",
      header: "Applies to",
      render: (p) => (
        <Badge variant="neutral">{subjectEntry(p.subjectType)?.label || p.subjectType}</Badge>
      ),
    },
    {
      key: "stages",
      header: "Route",
      render: (p) => <StageTrail stages={p.stages} roles={roles} />,
    },
    {
      key: "mode",
      header: "Order",
      render: (p) => (
        <Badge variant={PIPELINE_MODE_MAP[p.mode]?.variant || "neutral"}>
          {PIPELINE_MODE_MAP[p.mode]?.label || p.mode}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusPill status={p.status} map={PIPELINE_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (p) => (
        <ActionMenu
          label="Pipeline actions"
          items={[
            { icon: Pencil, label: "Edit", onSelect: () => setOpenId(p.id) },
            {
              icon: p.status === "Active" ? Pause : Play,
              label: p.status === "Active" ? "Pause" : "Activate",
              onSelect: () => handleToggleStatus(p),
            },
            ...(p.isDefault
              ? []
              : [{ icon: Star, label: "Make default", onSelect: () => handleSetDefault(p) }]),
            { icon: Copy, label: "Duplicate", onSelect: () => handleDuplicate(p) },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              variant: "destructive",
              onSelect: () => setDeleteTarget(p),
            },
          ]}
        />
      ),
    },
  ];

  if (selected) {
    return (
      <PipelineBuilderScreen
        pipeline={selected}
        roles={roles}
        members={members}
        onBack={() => setOpenId(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onSetDefault={handleSetDefault}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Approval Pipelines"
        description="Define who signs off on what, and in what order. Bind a pipeline to a kind of work — assets, shared links, role grants, payouts — and every review of that kind follows the same route."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> Create pipeline
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={status}
            onValueChange={setStatus}
            options={PIPELINE_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={subjectType}
            onValueChange={setSubjectType}
            options={SUBJECT_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search pipelines…" />
      </Toolbar>

      {loading ? (
        <LoadingArea panel size={48} label="Loading pipelines…" />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(p) => p.id}
          onRowClick={(p) => setOpenId(p.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={GitBranch}
                title={
                  pipelines.length
                    ? "No pipelines match your filters"
                    : "No approval pipelines yet"
                }
                description={
                  pipelines.length
                    ? "Try clearing the search or filters, or create a new pipeline."
                    : "Build the route work takes to get approved — who reviews first, who it passes to, and who signs it off at the end."
                }
                action={
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4" /> Create pipeline
                  </Button>
                }
              />
            </div>
          }
        />
      )}

      <CreatePipelineDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete pipeline</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
              Reviews already in flight keep their own copy of the stages and are unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => handleDelete(deleteTarget)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default ApprovalPipelinesScreen;
