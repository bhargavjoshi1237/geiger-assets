"use client";

import {
  Badge,
  Button,
  Input,
  LogoLoading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Save,
  Inbox,
  Package,
  Clock,
  FileText,
} from "lucide-react";

import { EditorShell } from "@/components/internal/shared/editor_shell";
import {
  SectionCard,
  StatusPill,
  Field,
  EmptyState,
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
import { TYPE_ICONS, FILE_TYPE_COLORS } from "../library/constants";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

const NONE_VALUE = "__none__";

const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "details",
        label: "Details",
        icon: FileText,
        desc: "Title, people, priority, status, due date, and reference asset.",
      },
    ],
  },
  {
    group: "Tracking",
    items: [
      {
        key: "deliverables",
        label: "Deliverables",
        icon: Package,
        desc: "Assets linked to this request.",
      },
      {
        key: "activity",
        label: "Activity",
        icon: Clock,
        desc: "Creation and update history for this request.",
      },
    ],
  },
];

export function DetailsSection({ draft, assets, onField }) {
  if (!draft) return null;
  const set = onField || (() => () => {});
  return (
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
  );
}

export function DeliverablesSection({ referenceAsset }) {
  return (
    <SectionCard
      title="Deliverables"
      description="Assets linked to this request."
      bodyPadding={false}
    >
      {referenceAsset ? (
        <div className="p-4">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-card p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
              style={{
                background: `${referenceAsset.color}15`,
                borderColor: `${referenceAsset.color}25`,
              }}
            >
              {(() => {
                const Icon = TYPE_ICONS[referenceAsset.type] || FileText;
                return (
                  <Icon
                    className="h-4 w-4"
                    style={{ color: referenceAsset.color || "#737373" }}
                  />
                );
              })()}
            </div>
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
  );
}

export function ActivitySection({ request }) {
  if (!request) return null;
  return (
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
  );
}

export const SECTIONS = {
  details: DetailsSection,
  deliverables: DeliverablesSection,
  activity: ActivitySection,
};

export function AssetRequestDetailScreen({ id, onBack, onChange, projectId }) {
  const { section: active, setSection: setActive } = useWorkspaceUrl();
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
  }, [id]);

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

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    const patch = {
      title: draft.title,
      description: draft.description,
      requester: draft.requester,
      assignee: draft.assignee,
      priority: draft.priority,
      status: draft.status,
      dueDate: draft.dueDate,
      referenceAssetId: draft.referenceAssetId,
    };
    const updated = await updateRequest(id, patch);
    setSaving(false);
    if (updated) {
      setRequest(updated);
      setDraft(updated);
      onChange?.(updated);
    } else {
      setDraft(request);
    }
  };

  if (loading) {
    return (
      <EditorShell
        back={{ label: "Requests", onClick: onBack }}
        title="Loading request…"
        nav={NAV_GROUPS}
        subject={null}
        active={active}
        onActiveChange={setActive}
      >
        <div className="flex h-64 items-center justify-center text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      </EditorShell>
    );
  }

  if (!request || !draft) {
    return (
      <EditorShell
        back={{ label: "Requests", onClick: onBack }}
        title="Request not found"
        nav={NAV_GROUPS}
        subject={null}
        active={active}
        onActiveChange={setActive}
      >
        <EmptyState
          icon={Inbox}
          title="Request not found"
          description="This request may have been deleted or isn't available."
          action={
            <Button
              variant="outline"
              className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
              onClick={onBack}
            >
              Back to Requests
            </Button>
          }
        />
      </EditorShell>
    );
  }

  const priorityMeta = PRIORITY_META[draft.priority] || PRIORITY_META.medium;

  const metaParts = [];
  if (draft.requester) metaParts.push(`Requested by ${draft.requester}`);
  if (draft.assignee) metaParts.push(`Assigned to ${draft.assignee}`);
  if (draft.dueDate) metaParts.push(`Due ${formatDate(draft.dueDate)}`);

  return (
    <EditorShell
      searchable
      back={{ label: "Requests", onClick: onBack }}
      title={draft.title || "Untitled request"}
      status={draft.status}
      statusMap={STATUS_META}
      badges={
        <Badge className={cn("border px-1.5 py-0 text-[10px]", priorityMeta.className)}>
          {priorityMeta.label}
        </Badge>
      }
      meta={metaParts.length ? metaParts.join(" · ") : "No details set yet"}
      actions={
        <Button
          className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          {dirty ? "Save changes" : "Saved"}
        </Button>
      }
      nav={NAV_GROUPS}
      subject={draft}
      active={active}
      onActiveChange={setActive}
    >
      {({ active: key }) => {
        const ActiveSection = SECTIONS[key] || SECTIONS.details;
        return (
          <ActiveSection
            draft={draft}
            request={request}
            assets={assets}
            referenceAsset={referenceAsset}
            onField={set}
            headerItem={NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === key)}
          />
        );
      }}
    </EditorShell>
  );
}

export default AssetRequestDetailScreen;
