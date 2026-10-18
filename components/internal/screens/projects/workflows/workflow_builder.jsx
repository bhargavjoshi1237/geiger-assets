"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  LayoutList,
  Loader2,
  Network,
  Pause,
  Play,
  SquarePen,
  Trash2,
  Zap,
} from "lucide-react";

import { EditorShell } from "@/components/internal/shared/editor_shell";
import { useEditorGuard } from "@/components/internal/shared/unsaved_changes";
import { Field, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";

import { WORKFLOW_STATUS_MAP, catalogEntry } from "./constants";
import { TriggerOptions } from "./trigger_options";
import { WorkflowStepList } from "./step_list";
import { WorkflowCanvas } from "./canvas/workflow_canvas";

const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "builder",
        label: "Builder",
        icon: Network,
        desc: "The steps this workflow runs, as a list or on a canvas.",
      },
    ],
  },
  {
    group: "Settings",
    items: [
      {
        key: "general",
        label: "General",
        icon: SquarePen,
        desc: "Workflow name and description.",
      },
      {
        key: "trigger",
        label: "Trigger & Scope",
        icon: Zap,
        desc: "When this workflow runs and which collections it applies to.",
      },
    ],
  },
  {
    group: "Danger zone",
    items: [
      {
        key: "danger",
        label: "Delete",
        icon: Trash2,
        desc: "Permanently remove this workflow and all its steps.",
      },
    ],
  },
];

const VIEW_TABS = [
  { value: "list", label: "List", icon: LayoutList },
  { value: "canvas", label: "Canvas", icon: Network },
];

function ViewToggle({ view, onChange }) {
  return <SegmentedTabs tabs={VIEW_TABS} value={view} onChange={onChange} />;
}

export function WorkflowBuilderScreen({
  workflow,
  collections,
  onBack,
  onUpdate,
  onDelete,
}) {
  const [form, setForm] = useState(workflow);
  const [view, setView] = useState("canvas");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [seedId, setSeedId] = useState(workflow?.id);  if (workflow && workflow.id !== seedId) {
    setSeedId(workflow.id);
    setForm(workflow);
    setView("canvas");
  }

  const guard = useEditorGuard({ onBack });

  if (!workflow) return null;

  const patch = (partial) => setForm((f) => ({ ...f, ...partial }));

  const handleStepsChange = (steps) => {
    patch({ steps, trigger: steps[0]?.type || form.trigger });
  };

  const handleCanvasChange = ({ steps, graph }) => {
    patch({ steps, graph, trigger: steps[0]?.type || form.trigger });
  };

  const setTriggerType = (type) => {
    const steps = [...(form.steps || [])];
    if (steps[0]) steps[0] = { ...steps[0], type };
    patch({ steps, trigger: type });
  };

  const save = () => {
    const next = {
      ...form,
      viewMode: view,
      trigger: form.steps?.[0]?.type || form.trigger,
    };
    setForm(next);
    setSaving(true);
    Promise.resolve(onUpdate?.(next))
      .catch(() => {})
      .finally(() => setSaving(false));
    toast.success("Workflow saved.");
  };

  const toggleStatus = () => {
    const status = form.status === "Active" ? "Paused" : "Active";
    const next = { ...form, status };
    setForm(next);
    onUpdate?.(next);
    toast.success(status === "Active" ? "Workflow activated." : "Workflow paused.");
  };

  const isActive = form.status === "Active";

  // Anything that isn't a settings key falls back to the builder.
  const onBuilder = !["general", "trigger", "danger"].includes(guard.active);

  return (
    <>
      <EditorShell
        back={{ label: "All workflows", onClick: guard.back }}
        title={form.name}
        status={form.status}
        statusMap={WORKFLOW_STATUS_MAP}
        meta={`When ${catalogEntry(form.trigger)?.label || "—"} · ${Math.max(
          0,
          (form.steps?.length || 1) - 1,
        )} step${Math.max(0, (form.steps?.length || 1) - 1) === 1 ? "" : "s"}`}
        actions={
          <>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={toggleStatus}
            >
              {isActive ? (
                <>
                  <Pause className="h-4 w-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Activate
                </>
              )}
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={save}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
        nav={NAV_GROUPS}
        subject={form}
        active={guard.active}
        onActiveChange={guard.selectSection}
        sectionAction={onBuilder ? <ViewToggle view={view} onChange={setView} /> : null}
      >
        {({ active }) => (
          <>
            {active === "builder" ? (
              view === "list" ? (
                <WorkflowStepList steps={form.steps} onChange={handleStepsChange} />
              ) : (
                <WorkflowCanvas
                  key={form.id}
                  steps={form.steps}
                  graph={form.graph}
                  active={isActive}
                  onChange={handleCanvasChange}
                />
              )
            ) : null}

            {active === "general" ? (
              <div className="grid gap-4">
                <Field label="Workflow name" htmlFor="wf-name">
                  <Input
                    id="wf-name"
                    value={form.name}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </Field>
                <Field label="Description" htmlFor="wf-desc">
                  <Textarea
                    id="wf-desc"
                    value={form.description || ""}
                    onChange={(e) => patch({ description: e.target.value })}
                    placeholder="What does this workflow do?"
                    rows={3}
                  />
                </Field>
              </div>
            ) : null}

            {active === "trigger" ? (
              <div className="grid gap-4">
                <Field label="Trigger">
                  <Select value={form.trigger || ""} onValueChange={setTriggerType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a trigger" />
                    </SelectTrigger>
                    <SelectContent>
                      <TriggerOptions />
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Scope">
                  <Select
                    value={form.scope}
                    onValueChange={(scope) =>
                      patch({ scope, collectionId: scope === "collection" ? form.collectionId : null })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="workspace">All collections (workspace)</SelectItem>
                      <SelectItem value="collection">A specific collection</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {form.scope === "collection" && (
                  <Field label="Collection">
                    <Select
                      value={form.collectionId || ""}
                      onValueChange={(collectionId) => patch({ collectionId })}
                    >
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
                )}
              </div>
            ) : null}

            {active === "danger" ? (
              <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 p-5">
                <div>
                  <p className="text-sm font-medium text-foreground">Delete this workflow</p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    This action is permanent and cannot be undone.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0 border-red-500/30 bg-transparent text-red-700 dark:text-red-300 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            ) : null}
          </>
        )}
      </EditorShell>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete workflow</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">{form.name}</span>?
              This action can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                setDeleteOpen(false);
                onDelete?.(form);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WorkflowBuilderScreen;
