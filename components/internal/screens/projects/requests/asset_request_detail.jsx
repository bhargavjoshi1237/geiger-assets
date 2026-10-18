"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Inbox,
  Package,
  Clock,
  SquarePen,
  History,
} from "lucide-react";

import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { cn } from "@/lib/utils";
import { AssetThumbnail } from "@/components/internal/shared/asset_thumbnail";
import {
  EditorLoading,
  EditorNotFound,
  EditorShell,
} from "@/components/internal/shared/editor_shell";
import { EditorSaveActions, useEditorGuard } from "@/components/internal/shared/unsaved_changes";
import {
  EmptyState,
  Field,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import {
  PRIORITY_META,
  STATUS_META,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  formatDate,
} from "./constants";
import { getRequest, updateRequest } from "@/lib/supabase/requests";
import { listAssets } from "@/lib/supabase/assets";
import { FILE_TYPE_COLORS } from "../library/constants";

const NONE_VALUE = "__none__";

const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "details",
        label: "Request details",
        icon: SquarePen,
        desc: "Title, brief, people, priority, status, and due date.",
      },
    ],
  },
  {
    group: "Fulfilment",
    items: [
      {
        key: "deliverables",
        label: "Deliverables",
        icon: Package,
        desc: "The reference asset and what's been delivered.",
      },
      {
        key: "activity",
        label: "Activity",
        icon: History,
        desc: "A timeline of this request.",
      },
    ],
  },
];

export function AssetRequestDetailScreen({ id, onBack, onChange, projectId }) {
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(null);
  const [draft, setDraft] = useState(null);
  const [assets, setAssets] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getRequest(id), listAssets(projectId)]).then(([r, list]) => {
      if (!alive) return;
      setRequest(r);
      setDraft(r);
      setAssets(list ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id, projectId]);

  const dirty = useMemo(() => {
    if (!request || !draft) return false;
    return (
      request.title !== draft.title ||
      request.description !== draft.description ||
      request.requester !== draft.requester ||
      request.assignee !== draft.assignee ||
      request.priority !== draft.priority ||
      request.status !== draft.status ||
      request.dueDate !== draft.dueDate ||
      (request.referenceAssetId ?? null) !== (draft.referenceAssetId ?? null)
    );
  }, [request, draft]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const referenceAsset = useMemo(
    () => assets.find((a) => a.id === draft?.referenceAssetId) || null,
    [assets, draft?.referenceAssetId],
  );

  const save = useCallback(async () => {
    if (!dirty || saving || !draft) return false;
    if (!draft.title?.trim()) {
      toast.error("Give the request a title before saving.");
      return false;
    }
    setSaving(true);
    const updated = await updateRequest(id, {
      title: draft.title,
      description: draft.description,
      requester: draft.requester,
      assignee: draft.assignee,
      priority: draft.priority,
      status: draft.status,
      dueDate: draft.dueDate,
      referenceAssetId: draft.referenceAssetId,
    });
    setSaving(false);
    if (updated) {
      setRequest(updated);
      setDraft(updated);
      onChange?.(updated);
      toast.success("Changes saved.");
      return true;
    }
    toast.error("Couldn't save your changes to the server.");
    return false;
  }, [dirty, draft, id, onChange, saving]);

  const guard = useEditorGuard({
    dirty,
    saving,
    save,
    discard: () => setDraft(request),
    onBack,
    name: draft?.title || "this request",
  });
  const back = { label: "Requests", onClick: guard.back };

  if (loading) {
    return <EditorLoading back={back} title="Loading request…" nav={NAV_GROUPS} />;
  }

  if (!request || !draft) {
    return (
      <EditorNotFound
        back={back}
        nav={NAV_GROUPS}
        icon={Inbox}
        title="Request not found"
        description="This request may have been deleted or isn't available."
      />
    );
  }

  const priorityMeta = PRIORITY_META[draft.priority] || PRIORITY_META.medium;

  return (
    <>
      <EditorShell
        back={back}
        title={draft.title || "Untitled request"}
        status={draft.status}
        statusMap={STATUS_META}
        badges={
          <Badge className={cn("border px-1.5 py-0 text-[10px]", priorityMeta.className)}>
            {priorityMeta.label}
          </Badge>
        }
        meta={
          [
            draft.requester ? `Requested by ${draft.requester}` : null,
            draft.dueDate ? `Due ${formatDate(draft.dueDate)}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "No requester or due date set"
        }
        actions={
          <EditorSaveActions
            dirty={dirty}
            saving={saving}
            onSave={save}
            onDiscard={() => setDraft(request)}
          />
        }
        nav={NAV_GROUPS}
        subject={draft}
        active={guard.active}
        onActiveChange={guard.selectSection}
      >
        {({ active }) => (
          <>
            {active === "details" ? (
              <>
                <SectionCard title="Request Details">
                  <div className="grid gap-4">
                    <Field label="Title" htmlFor="req-title">
                      <Input
                        id="req-title"
                        value={draft.title}
                        onChange={(e) => set("title")(e.target.value)}
                        className="border-border bg-surface-card text-foreground"
                      />
                    </Field>
                    <Field label="Description" htmlFor="req-desc">
                      <Textarea
                        id="req-desc"
                        value={draft.description}
                        onChange={(e) => set("description")(e.target.value)}
                        placeholder="Describe what's needed…"
                        className="min-h-24 border-border bg-surface-card text-foreground"
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Requester" htmlFor="req-requester">
                        <Input
                          id="req-requester"
                          value={draft.requester}
                          onChange={(e) => set("requester")(e.target.value)}
                          className="border-border bg-surface-card text-foreground"
                        />
                      </Field>
                      <Field label="Assignee" htmlFor="req-assignee">
                        <Input
                          id="req-assignee"
                          value={draft.assignee}
                          onChange={(e) => set("assignee")(e.target.value)}
                          className="border-border bg-surface-card text-foreground"
                        />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Priority">
                        <Select value={draft.priority} onValueChange={set("priority")}>
                          <SelectTrigger className="border-border bg-surface-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-surface-subtle text-foreground">
                            {PRIORITY_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Status">
                        <Select value={draft.status} onValueChange={set("status")}>
                          <SelectTrigger className="border-border bg-surface-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-surface-subtle text-foreground">
                            {STATUS_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Due date" htmlFor="req-due">
                        <Input
                          id="req-due"
                          type="date"
                          value={draft.dueDate ? draft.dueDate.slice(0, 10) : ""}
                          onChange={(e) => set("dueDate")(e.target.value)}
                          className="border-border bg-surface-card text-foreground"
                        />
                      </Field>
                      <Field label="Reference asset">
                        <Select
                          value={draft.referenceAssetId || NONE_VALUE}
                          onValueChange={(v) =>
                            set("referenceAssetId")(v === NONE_VALUE ? null : v)
                          }
                        >
                          <SelectTrigger className="border-border bg-surface-card">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-surface-subtle text-foreground">
                            <SelectItem value={NONE_VALUE} className="text-xs">
                              None
                            </SelectItem>
                            {assets.map((a) => (
                              <SelectItem key={a.id} value={a.id} className="text-xs">
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>
                </SectionCard>
              </>
            ) : null}

            {active === "deliverables" ? (
              <>
                <SectionCard
                  title="Deliverables"
                  description="Assets linked to this request."
                  bodyPadding={false}
                >
                  {referenceAsset ? (
                    <div className="p-4">
                      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-card p-3">
                        <AssetThumbnail asset={referenceAsset} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {referenceAsset.name}
                          </p>
                          <Badge
                            className={cn(
                              "mt-0.5 border px-1.5 py-0 text-[10px]",
                              FILE_TYPE_COLORS[referenceAsset.type],
                            )}
                          >
                            {referenceAsset.format || referenceAsset.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      icon={Package}
                      title="No deliverables linked yet"
                      description="Link a reference asset from the Details tab to track delivery."
                      className="py-12"
                    />
                  )}
                </SectionCard>
              </>
            ) : null}

            {active === "activity" ? (
              <>
                <SectionCard title="Activity" bodyPadding={false}>
                  <div className="divide-y divide-border">
                    <div className="flex items-center gap-3 px-5 py-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
                        <Inbox className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Request created</p>
                        <p className="text-[11px] text-text-tertiary">{formatDate(request.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-5 py-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Last updated</p>
                        <p className="text-[11px] text-text-tertiary">{formatDate(request.updatedAt)}</p>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </>
            ) : null}
          </>
        )}
      </EditorShell>

      {guard.dialog}
    </>
  );
}

export default AssetRequestDetailScreen;
