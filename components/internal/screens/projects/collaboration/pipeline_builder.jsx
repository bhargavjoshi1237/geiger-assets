"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  CheckCircle2,
  GripVertical,
  MoveDown,
  MoveUp,
  Pause,
  Play,
  Plus,
  Star,
  Trash2,
  Users,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EditorHeader } from "@/components/internal/shared/editor_shell";
import {
  EditorSectionHeader,
  Field,
  SectionCard,
  SegmentedTabs,
  SettingRow,
  SettingsList,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { Checkbox } from "@geiger/ui/checkbox";
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

import {
  PIPELINE_STATUS_MAP,
  PIPELINE_MODE_MAP,
  APPROVER_TYPE_OPTIONS,
  PIPELINE_SUBJECTS,
  groupedSubjects,
  newStage,
  subjectEntry,
} from "./constants";

const MODE_TABS = [
  { value: "sequential", label: "Sequential" },
  { value: "anytime", label: "Anytime" },
];

function Connector() {
  return (
    <div className="flex justify-center py-1" aria-hidden="true">
      <ArrowDown className="h-4 w-4 text-text-tertiary" />
    </div>
  );
}

/**
 * One stage card. A stage names its approvers (a role, or specific people),
 * how many of them must sign off, and whether it waits for the stage before it.
 */
function StageCard({
  stage,
  index,
  total,
  roles,
  members,
  pipelineMode,
  onChange,
  onMove,
  onRemove,
}) {
  const set = (key) => (value) => onChange({ ...stage, [key]: value });

  const approverSummary = useMemo(() => {
    if (stage.approverType === "member") {
      const count = stage.memberIds?.length || 0;
      if (!count) return "No one assigned yet";
      const names = (stage.memberIds || [])
        .map((id) => members.find((m) => m.userId === id)?.name)
        .filter(Boolean);
      return names.slice(0, 2).join(", ") + (count > 2 ? ` +${count - 2} more` : "");
    }
    const role = roles.find((r) => r.id === stage.roleId);
    return role ? `Anyone with “${role.name}”` : "No role selected yet";
  }, [stage, roles, members]);

  const toggleMember = (userId, checked) => {
    const next = new Set(stage.memberIds || []);
    if (checked) next.add(userId);
    else next.delete(userId);
    set("memberIds")(Array.from(next));
  };

  const effectiveAdvance = stage.advance || pipelineMode;

  return (
    <div className="rounded-xl border border-border bg-surface-subtle">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <GripVertical className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-active text-xs font-semibold tabular-nums text-text-secondary">
          {index + 1}
        </span>
        <Input
          value={stage.name}
          onChange={(e) => set("name")(e.target.value)}
          placeholder={`Stage ${index + 1}`}
          className="h-8 max-w-xs border-transparent bg-transparent px-1 font-medium hover:border-border focus:border-border"
          aria-label={`Stage ${index + 1} name`}
        />
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-secondary hover:text-foreground"
            aria-label="Move stage up"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
          >
            <MoveUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-secondary hover:text-foreground"
            aria-label="Move stage down"
            disabled={index === total - 1}
            onClick={() => onMove(index, index + 1)}
          >
            <MoveDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-400 hover:bg-red-500/10 hover:text-red-400"
            aria-label="Remove stage"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Who approves">
            <Select value={stage.approverType} onValueChange={set("approverType")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPROVER_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {stage.approverType === "role" ? (
            <Field label="Role">
              <Select value={stage.roleId || ""} onValueChange={set("roleId")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.length ? (
                    roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No roles defined yet
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field
              label="Minimum approvals"
              hint="How many of the people below must sign off."
            >
              <Input
                type="number"
                min={1}
                value={stage.minApprovals ?? 1}
                onChange={(e) =>
                  set("minApprovals")(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </Field>
          )}
        </div>

        {stage.approverType === "member" ? (
          <Field label="People" hint={approverSummary}>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-card p-2">
              {members.length ? (
                members.map((m) => (
                  <label
                    key={m.userId}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-surface-hover"
                  >
                    <Checkbox
                      checked={(stage.memberIds || []).includes(m.userId)}
                      onCheckedChange={(c) => toggleMember(m.userId, c === true)}
                    />
                    <span className="text-foreground">{m.name || m.email}</span>
                    {m.roleName ? (
                      <span className="ml-auto text-xs text-text-tertiary">{m.roleName}</span>
                    ) : null}
                  </label>
                ))
              ) : (
                <p className="px-2 py-3 text-sm text-text-secondary">
                  No members in this workspace yet — invite people on the Team screen.
                </p>
              )}
            </div>
          </Field>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Minimum approvals"
              hint="How many people holding that role must sign off."
            >
              <Input
                type="number"
                min={1}
                value={stage.minApprovals ?? 1}
                onChange={(e) =>
                  set("minApprovals")(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </Field>
            <Field label="Opens" hint={PIPELINE_MODE_MAP[effectiveAdvance]?.description}>
              <Select value={effectiveAdvance} onValueChange={set("advance")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">After the previous stage</SelectItem>
                  <SelectItem value="anytime">Immediately — any order</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}

        <SettingsList>
          <SettingRow
            title="Allow change requests"
            description="Approvers can send the work back instead of only approving or rejecting."
            checked={stage.allowChangeRequests !== false}
            onCheckedChange={set("allowChangeRequests")}
          />
        </SettingsList>
      </div>
    </div>
  );
}

export function PipelineBuilderScreen({
  pipeline,
  roles = [],
  members = [],
  onBack,
  onUpdate,
  onDelete,
  onSetDefault,
}) {
  const [form, setForm] = useState(pipeline);
  const [activeTab, setActiveTab] = useState("stages");
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Re-seed when the editor is pointed at a different pipeline.
  const [seedId, setSeedId] = useState(pipeline?.id);
  if (pipeline && pipeline.id !== seedId) {
    setSeedId(pipeline.id);
    setForm(pipeline);
    setActiveTab("stages");
  }

  if (!pipeline) return null;

  const stages = Array.isArray(form.stages) ? form.stages : [];

  const commit = (partial) => {
    const next = { ...form, ...partial };
    setForm(next);
    onUpdate(next);
  };

  const setStages = (nextStages) => commit({ stages: nextStages });

  const handleStageChange = (index, stage) => {
    setStages(stages.map((s, i) => (i === index ? stage : s)));
  };

  const handleMove = (from, to) => {
    if (to < 0 || to >= stages.length) return;
    const next = [...stages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setStages(next);
  };

  const handleRemove = (index) => {
    setStages(stages.filter((_, i) => i !== index));
  };

  const handleAdd = () => setStages([...stages, newStage(stages.length)]);

  const toggleStatus = () => {
    const next = form.status === "Active" ? "Paused" : "Active";
    if (next === "Active" && !stages.length) {
      toast.error("Add at least one stage before activating this pipeline.");
      return;
    }
    if (
      next === "Active" &&
      stages.some((s) =>
        s.approverType === "member" ? !s.memberIds?.length : !s.roleId,
      )
    ) {
      toast.error("Every stage needs an approver before the pipeline can go live.");
      return;
    }
    commit({ status: next });
    toast.success(next === "Active" ? "Pipeline activated." : "Pipeline paused.");
  };

  const subject = subjectEntry(form.subjectType);

  return (
    <MainScreenWrapper>
      <EditorHeader
        back={{ label: "All pipelines", onClick: onBack }}
        title={form.name || "Untitled pipeline"}
        status={form.status}
        statusMap={PIPELINE_STATUS_MAP}
        badges={
          <>
            <Badge variant="neutral">{subject?.label || form.subjectType}</Badge>
            <Badge variant={PIPELINE_MODE_MAP[form.mode]?.variant || "neutral"}>
              {PIPELINE_MODE_MAP[form.mode]?.label || form.mode}
            </Badge>
            {form.isDefault ? (
              <Badge variant="success">
                <Star className="h-3 w-3" /> Default
              </Badge>
            ) : null}
          </>
        }
        meta={`${stages.length} stage${stages.length === 1 ? "" : "s"} · ${form.reviewCount || 0} review${form.reviewCount === 1 ? "" : "s"} routed`}
        actions={
          <div className="flex items-center gap-2">
            {!form.isDefault ? (
              <Button
                variant="outline"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                onClick={() => onSetDefault(form)}
              >
                <Star className="h-4 w-4" /> Make default
              </Button>
            ) : null}
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={toggleStatus}
            >
              {form.status === "Active" ? (
                <>
                  <Pause className="h-4 w-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Activate
                </>
              )}
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="stages">Stages</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="stages" className="space-y-4 pt-4">
          <EditorSectionHeader
            title="Approval route"
            description={
              form.mode === "sequential"
                ? "Work moves down this list. A stage opens only once the one above it has the sign-offs it needs."
                : "Every stage is open at once — approvers can act in any order, and the review completes when all stages are satisfied."
            }
            action={
              <Button
                variant="outline"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                onClick={handleAdd}
              >
                <Plus className="h-4 w-4" /> Add stage
              </Button>
            }
          />

          {stages.length ? (
            <div>
              {stages.map((stage, index) => (
                <div key={stage.id || index}>
                  {index > 0 ? <Connector /> : null}
                  <StageCard
                    stage={stage}
                    index={index}
                    total={stages.length}
                    roles={roles}
                    members={members}
                    pipelineMode={form.mode}
                    onChange={(s) => handleStageChange(index, s)}
                    onMove={handleMove}
                    onRemove={handleRemove}
                  />
                </div>
              ))}
              <Connector />
              <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-surface-subtle px-4 py-3.5 text-sm text-text-secondary">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                Review completes — {subject?.label?.toLowerCase() || "the subject"} is marked
                approved
                {form.autoLockVersion !== false ? " and its current version is locked" : ""}.
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface-subtle px-6 py-14 text-center">
              <Users className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">No stages yet</p>
                <p className="mt-1 text-sm text-text-secondary">
                  Add the first group of approvers — who sees this before anyone else.
                </p>
              </div>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleAdd}
              >
                <Plus className="h-4 w-4" /> Add stage
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 pt-4">
          <SectionCard
            title="General"
            description="What this pipeline is called and what it routes."
          >
            <div className="grid gap-4">
              <Field label="Name" htmlFor="pipeline-name">
                <Input
                  id="pipeline-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onBlur={() => onUpdate(form)}
                />
              </Field>
              <Field label="Description" htmlFor="pipeline-description">
                <Textarea
                  id="pipeline-description"
                  value={form.description || ""}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  onBlur={() => onUpdate(form)}
                  placeholder="When should someone use this pipeline?"
                  className="h-[84px] min-h-0 resize-none"
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Applies to"
                  hint="Reviews of this subject can use this pipeline."
                >
                  <Select
                    value={form.subjectType}
                    onValueChange={(v) => commit({ subjectType: v, isDefault: false })}
                  >
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
                <Field
                  label="Stage order"
                  hint={PIPELINE_MODE_MAP[form.mode]?.description}
                >
                  <SegmentedTabs
                    fullWidth
                    tabs={MODE_TABS}
                    value={form.mode}
                    onChange={(v) => commit({ mode: v })}
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="On final approval"
            description="What happens the moment the last stage signs off."
          >
            <SettingsList>
              <SettingRow
                title="Mark the subject approved"
                description="Stamps the approved status so the library can filter and badge by it."
                checked={form.autoStampStatus !== false}
                onCheckedChange={(v) => commit({ autoStampStatus: v })}
              />
              <SettingRow
                title="Lock the approved version"
                description="The current version can't be replaced without a new review."
                checked={form.autoLockVersion !== false}
                onCheckedChange={(v) => commit({ autoLockVersion: v })}
              />
            </SettingsList>
          </SectionCard>

          <SectionCard
            title="Danger zone"
            description="Deleting a pipeline leaves reviews already in flight untouched — they carry their own copy of the stages."
          >
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" /> Delete pipeline
            </Button>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete pipeline</DialogTitle>
            <DialogDescription>
              Delete <span className="font-medium text-foreground">{form.name}</span>? New
              reviews will no longer be able to use it. This can&apos;t be undone.
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
                onDelete(form);
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

export default PipelineBuilderScreen;
