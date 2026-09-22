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

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EditorHeader } from "@/components/internal/shared/editor_shell";
import {
  EditorSectionHeader,
  Field,
  SegmentedTabs,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@geiger/ui";
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
import { cn } from "@/lib/utils";

import { WORKFLOW_STATUS_MAP, TRIGGER_CATALOG, catalogEntry } from "./constants";
import { WorkflowStepList } from "./step_list";
import { WorkflowCanvas } from "./canvas/workflow_canvas";

const SETTINGS_NAV = [
  {
    group: null,
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
  const [activeTab, setActiveTab] = useState("builder");
  const [activeSetting, setActiveSetting] = useState("general");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [seedId, setSeedId] = useState(workflow?.id);  if (workflow && workflow.id !== seedId) {
    setSeedId(workflow.id);
    setForm(workflow);
    setView("canvas");
    setActiveTab("builder");
    setActiveSetting("general");
  }

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

  return (
    <MainScreenWrapper>
      <EditorHeader
        back={{ label: "All workflows", onClick: onBack }}
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
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          {activeTab === "builder" ? (
            <ViewToggle view={view} onChange={setView} />
          ) : null}
        </div>

        <TabsContent value="builder" className="mt-2">
          {view === "list" ? (
            <WorkflowStepList steps={form.steps} onChange={handleStepsChange} />
          ) : (
            <WorkflowCanvas
              key={form.id}
              steps={form.steps}
              graph={form.graph}
              active={isActive}
              onChange={handleCanvasChange}
            />
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_220px]">
            <div className="order-2 min-w-0 lg:order-1">
              <EditorSectionHeader
                className="mb-5"
                title={SETTINGS_NAV.flatMap((g) => g.items).find((i) => i.key === activeSetting)?.label}
                description={
                  SETTINGS_NAV.flatMap((g) => g.items).find((i) => i.key === activeSetting)?.desc
                }
              />

              {activeSetting === "general" && (
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
              )}

              {activeSetting === "trigger" && (
                <div className="grid gap-4">
                  <Field label="Trigger">
                    <Select value={form.trigger || ""} onValueChange={setTriggerType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a trigger" />
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
              )}

              {activeSetting === "danger" && (
                <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 p-5">
                  <div>
                    <p className="text-sm font-medium text-foreground">Delete this workflow</p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      This action is permanent and cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0 border-red-500/30 bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
              )}
            </div>

            <aside className="order-1 lg:order-2">
              <nav className="space-y-5 lg:sticky lg:top-0 lg:h-[calc(100dvh-7.5rem)] lg:overflow-y-auto lg:pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {SETTINGS_NAV.map((group, gi) => (
                  <div key={group.group || `g${gi}`}>
                    {group.group ? (
                      <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                        {group.group}
                      </p>
                    ) : null}
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isItemActive = activeSetting === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setActiveSetting(item.key)}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                              isItemActive
                                ? "bg-surface-card font-medium text-foreground"
                                : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground",
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                isItemActive ? "text-foreground" : "text-text-secondary",
                              )}
                            />
                            <span className="truncate capitalize">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </aside>
          </div>
        </TabsContent>
      </Tabs>

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
    </MainScreenWrapper>
  );
}

export default WorkflowBuilderScreen;
