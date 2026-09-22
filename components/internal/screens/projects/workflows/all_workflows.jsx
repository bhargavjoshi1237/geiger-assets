"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Workflow as WorkflowIcon, Copy, Pause, Pencil, Play, Plus, Trash2, Loader2 } from "lucide-react";

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
  listWorkflows,
  createWorkflow,
  updateWorkflow,
  softDeleteWorkflow,
} from "@/lib/supabase/workflows";
import { listCollections } from "@/lib/supabase/collections";
import { getUser } from "@/lib/supabase/user";

import {
  WORKFLOW_STATUS_MAP,
  SCOPE_MAP,
  STATUS_FILTER_OPTIONS,
  TRIGGER_FILTER_OPTIONS,
  TRIGGER_CATALOG,
  catalogEntry,
  formatRelativeDate,
} from "./constants";
import { WorkflowBuilderScreen } from "./workflow_builder";
import { uniqueId } from "@/lib/utils";

const EMPTY_DRAFT = {
  name: "",
  trigger: "asset.uploaded",
  scope: "workspace",
  collectionId: "",
};

function CreateWorkflowDialog({ open, onOpenChange, onCreate, collections }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give your workflow a name first.");
      return;
    }
    if (draft.scope === "collection" && !draft.collectionId) {
      toast.error("Pick a collection for a collection-scoped workflow.");
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
          <DialogTitle>Create workflow</DialogTitle>
          <DialogDescription>
            Pick a trigger to start — you can add conditions and actions in the
            builder.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="grid gap-4"
        >
          <Field label="Workflow name" htmlFor="wf-name">
            <Input
              id="wf-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Review on upload"
            />
          </Field>

          <Field label="Trigger" hint="The asset action that starts this workflow.">
            <Select value={draft.trigger} onValueChange={set("trigger")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_CATALOG.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Scope">
              <Select value={draft.scope} onValueChange={set("scope")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workspace">All collections (workspace)</SelectItem>
                  <SelectItem value="collection">A specific collection</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {draft.scope === "collection" ? (
              <Field label="Collection">
                <Select value={draft.collectionId} onValueChange={set("collectionId")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select collection" />
                  </SelectTrigger>
                  <SelectContent>
                    {(collections || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>
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
            Create workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AllWorkflowsScreen({ projectId }) {
  const [workflows, setWorkflows] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [trigger, setTrigger] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openWorkflowId, setOpenWorkflowId] = useState(null);
  const [userId, setUserId] = useState(null);

  const collectionName = useMemo(() => {
    const map = new Map((collections || []).map((c) => [c.id, c.name]));
    return (id) => map.get(id) || "";
  }, [collections]);

  const selected = useMemo(
    () => (openWorkflowId ? workflows.find((w) => w.id === openWorkflowId) || null : null),
    [openWorkflowId, workflows],
  );

  useEffect(() => {
    let alive = true;
    listWorkflows(projectId).then((rows) => {
      if (!alive) return;
      setWorkflows(rows ?? []);
      setLoading(false);
    });
    listCollections(projectId).then((rows) => alive && setCollections(rows ?? []));
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    return workflows.filter((w) => {
      if (status !== "all" && w.status !== status) return false;
      if (trigger !== "all" && w.trigger !== trigger) return false;
      if (search) {
        const t = catalogEntry(w.trigger)?.label || "";
        if (!`${w.name} ${t}`.toLowerCase().includes(search.toLowerCase()))
          return false;
      }
      return true;
    });
  }, [workflows, search, status, trigger]);

  const stats = useMemo(() => {
    const active = workflows.filter((w) => w.status === "Active").length;
    const drafts = workflows.filter((w) => w.status === "Draft").length;
    const runs = workflows.reduce((s, w) => s + (w.runCount || 0), 0);
    return [
      { label: "Total workflows", value: String(workflows.length), footer: `${active} active` },
      { label: "Active", value: String(active), footer: "Listening for triggers" },
      { label: "Total runs", value: runs.toLocaleString("en-US"), footer: "Across all workflows" },
      { label: "Drafts", value: String(drafts), footer: "Not yet activated" },
    ];
  }, [workflows]);

  const persistCreate = (workflow) => {
    createWorkflow(workflow).then((saved) => {
      if (saved) {
        setWorkflows((prev) => prev.map((w) => (w.id === saved.id ? saved : w)));
        toast.success(`"${workflow.name}" created as a draft.`);
      } else {
        setWorkflows((prev) => prev.filter((w) => w.id !== workflow.id));
        toast.error("Couldn't save the workflow to the server.");
      }
    });
  };

  const handleCreate = (draft) => {
    const name = draft.name.trim();
    const triggerStep = {
      id: `step_${uniqueId()}`,
      kind: "trigger",
      type: draft.trigger,
      config: {},
      position: { x: 0, y: 0 },
    };
    const workflow = {
      id: uniqueId(),
      name,
      description: "",
      status: "Draft",
      trigger: draft.trigger,
      scope: draft.scope,
      collectionId: draft.scope === "collection" ? draft.collectionId : null,
      steps: [triggerStep],
      graph: {},
      viewMode: "canvas",
      runCount: 0,
      lastRunAt: null,
      createdBy: userId,
      projectId,
    };
    setWorkflows((prev) => [workflow, ...prev]);
    persistCreate(workflow);
  };

  const handleUpdate = (updated) => {
    const previous = workflows.find((w) => w.id === updated.id);
    setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    updateWorkflow(updated.id, updated).then((saved) => {
      if (saved) return;
      if (previous) {
        setWorkflows((prev) => prev.map((w) => (w.id === previous.id ? previous : w)));
      }
      toast.error("Couldn't save your changes to the server.");
    });
  };

  const handleToggleStatus = (workflow) => {
    const next = workflow.status === "Active" ? "Paused" : "Active";
    setWorkflows((prev) =>
      prev.map((w) => (w.id === workflow.id ? { ...w, status: next } : w)),
    );
    updateWorkflow(workflow.id, { status: next }).then((saved) => {
      if (!saved) {
        setWorkflows((prev) =>
          prev.map((w) => (w.id === workflow.id ? { ...w, status: workflow.status } : w)),
        );
        toast.error("Couldn't update the workflow status.");
        return;
      }
      toast.success(
        next === "Active" ? `"${workflow.name}" activated.` : `"${workflow.name}" paused.`,
      );
    });
  };

  const handleDelete = (workflow) => {
    setDeleteTarget(null);
    if (openWorkflowId === workflow.id) setOpenWorkflowId(null);
    setWorkflows((prev) => prev.filter((w) => w.id !== workflow.id));
    softDeleteWorkflow(workflow.id).then((ok) => {
      if (!ok) {
        setWorkflows((prev) => [workflow, ...prev]);
        toast.error("Couldn't delete the workflow on the server.");
        return;
      }
      toast.success(`Deleted "${workflow.name}".`);
    });
  };

  const handleDuplicate = (workflow) => {
    const copy = {
      ...workflow,
      id: uniqueId(),
      name: `${workflow.name} (copy)`,
      status: "Draft",
      runCount: 0,
      lastRunAt: null,
      createdBy: userId,
      projectId,
    };
    setWorkflows((prev) => [copy, ...prev]);
    toast.success(`Duplicated "${workflow.name}".`);
    persistCreate(copy);
  };

  const columns = [
    {
      key: "name",
      header: "Workflow",
      render: (w) => {
        const t = catalogEntry(w.trigger);
        const stepCount = Math.max(0, (w.steps?.length || 1) - 1);
        return (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{w.name}</span>
            <span className="text-xs text-text-secondary">
              When {t?.label || "—"} · {stepCount} step{stepCount === 1 ? "" : "s"}
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (w) => <StatusPill status={w.status} map={WORKFLOW_STATUS_MAP} />,
    },
    {
      key: "scope",
      header: "Scope",
      render: (w) => (
        <Badge variant={SCOPE_MAP[w.scope]?.variant || "neutral"}>
          {w.scope === "collection"
            ? collectionName(w.collectionId) || "Collection"
            : SCOPE_MAP[w.scope]?.label || "Workspace"}
        </Badge>
      ),
    },
    {
      key: "runs",
      header: "Runs",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (w) => (w.runCount || 0).toLocaleString("en-US"),
    },
    {
      key: "lastRun",
      header: "Last run",
      className: "text-text-secondary",
      render: (w) => formatRelativeDate(w.lastRunAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (w) => (
        <ActionMenu
          label="Workflow actions"
          items={[
            { icon: Pencil, label: "Edit", onSelect: () => setOpenWorkflowId(w.id) },
            {
              icon: w.status === "Active" ? Pause : Play,
              label: w.status === "Active" ? "Pause" : "Activate",
              onSelect: () => handleToggleStatus(w),
            },
            { icon: Copy, label: "Duplicate", onSelect: () => handleDuplicate(w) },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              variant: "destructive",
              onSelect: () => setDeleteTarget(w),
            },
          ]}
        />
      ),
    },
  ];

  if (selected) {
    return (
      <WorkflowBuilderScreen
        workflow={selected}
        collections={collections}
        onBack={() => setOpenWorkflowId(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Workflows"
        description="Automate what happens when something happens — when an asset is uploaded, approved, or a license nears expiry. Build flows of conditions and actions."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> Create workflow
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={status}
            onValueChange={setStatus}
            options={STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={trigger}
            onValueChange={setTrigger}
            options={TRIGGER_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search workflows…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workflows…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(w) => w.id}
          onRowClick={(w) => setOpenWorkflowId(w.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={WorkflowIcon}
                title={
                  workflows.length
                    ? "No workflows match your filters"
                    : "No workflows yet"
                }
                description={
                  workflows.length
                    ? "Try clearing the search or filters, or create a new workflow."
                    : "Create your first automation — e.g. route every upload to a reviewer the moment it lands."
                }
                action={
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4" /> Create workflow
                  </Button>
                }
              />
            </div>
          }
        />
      )}

      <CreateWorkflowDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
        collections={collections}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete workflow</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? This action can&apos;t be undone.
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

export default AllWorkflowsScreen;
