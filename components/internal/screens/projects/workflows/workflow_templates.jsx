"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, LayoutTemplate, Loader2, Zap } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  ScreenHeader,
  SearchInput,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";

import { createWorkflow } from "@/lib/supabase/workflows";
import { getUser } from "@/lib/supabase/user";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { useProject } from "@/context/project-context";

import {
  WORKFLOW_TEMPLATES,
  WORKFLOW_TEMPLATE_CATEGORY_MAP,
  WORKFLOW_TEMPLATE_CATEGORY_OPTIONS,
  catalogEntry,
} from "./constants";

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `wf_${Math.random().toString(36).slice(2)}`;

const stepId = () => `step_${newId()}`;

function instantiateSteps(templateSteps) {
  return (templateSteps || []).map((s, i) => ({
    id: stepId(),
    kind: s.kind,
    type: s.type,
    config: { ...(s.config || {}) },
    position: { x: 0, y: i * 140 },
  }));
}

export function WorkflowTemplatesScreen({ projectId: projectIdProp }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [usingId, setUsingId] = useState(null);

  const { openWorkflowInTab } = useWorkspaceUrl();
  const { project } = useProject();
  const projectId = projectIdProp || project?.id || null;

  const filtered = useMemo(() => {
    return WORKFLOW_TEMPLATES.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (search) {
        const trigger = catalogEntry(t.trigger)?.label || "";
        if (!`${t.name} ${t.description} ${trigger}`
          .toLowerCase()
          .includes(search.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [search, category]);

  const handleUse = async (template) => {
    if (usingId) return;
    setUsingId(template.id);
    const id = newId();
    const user = await getUser();
    const workflow = {
      id,
      name: template.name,
      description: template.description,
      status: "Draft",
      trigger: template.trigger,
      scope: "workspace",
      collectionId: null,
      steps: instantiateSteps(template.steps),
      graph: {},
      viewMode: "canvas",
      runCount: 0,
      lastRunAt: null,
      createdBy: user?.id || null,
      projectId,
    };

    const saved = await createWorkflow(workflow);
    setUsingId(null);
    if (!saved) {
      toast.error("Couldn't create a workflow from this template.");
      return;
    }
    toast.success(`Created "${template.name}" from a template.`);
    openWorkflowInTab(saved.id, "All Workflows");
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Workflow Templates"
        description="Start from a proven automation. Pick a template to spin up a ready-made workflow, then tweak its conditions and actions in the builder."
      />

      <Toolbar>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-44 bg-surface-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_TEMPLATE_CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search templates…"
        />
      </Toolbar>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={LayoutTemplate}
            title="No templates match your filters"
            description="Try clearing the search or picking a different category."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const trigger = catalogEntry(t.trigger);
            const Icon = trigger?.icon || Zap;
            const cat = WORKFLOW_TEMPLATE_CATEGORY_MAP[t.category];
            const stepCount = Math.max(0, (t.steps?.length || 1) - 1);
            const busy = usingId === t.id;
            return (
              <div
                key={t.id}
                className="group flex flex-col rounded-xl border border-border bg-surface-subtle p-5 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant={cat?.variant || "neutral"}>
                    {cat?.label || t.category}
                  </Badge>
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {t.name}
                </h3>
                <p className="mt-1 flex-1 text-sm text-text-secondary">
                  {t.description}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-text-tertiary">
                    When {trigger?.label || "—"} · {stepCount} step
                    {stepCount === 1 ? "" : "s"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => handleUse(t)}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…
                      </>
                    ) : (
                      <>
                        Use template <ArrowUpRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default WorkflowTemplatesScreen;
