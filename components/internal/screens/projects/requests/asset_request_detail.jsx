"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Save,
  Inbox,
  Package,
  Clock,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
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

const NONE_VALUE = "__none__";

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
      <MainScreenWrapper className="dark">
        <div className="flex h-64 items-center justify-center text-text-tertiary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </MainScreenWrapper>
    );
  }

  if (!request || !draft) {
    return (
      <MainScreenWrapper className="dark">
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
      </MainScreenWrapper>
    );
  }

  const priorityMeta = PRIORITY_META[draft.priority] || PRIORITY_META.medium;

  return (
    <MainScreenWrapper className="dark">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to requests"
            className="h-8 w-8 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {draft.title || "Untitled request"}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusPill status={draft.status} map={STATUS_META} className="text-[10px]" />
              <Badge className={cn("border px-1.5 py-0 text-[10px]", priorityMeta.className)}>
                {priorityMeta.label}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
        </div>
      </div>

      <Tabs defaultValue="details" className="gap-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Details ------------------------------------------------------- */}
        <TabsContent value="details">
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
        </TabsContent>

        {/* Deliverables ------------------------------------------------- */}
        <TabsContent value="deliverables">
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
        </TabsContent>

        {/* Activity ----------------------------------------------------- */}
        <TabsContent value="activity">
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
        </TabsContent>
      </Tabs>
    </MainScreenWrapper>
  );
}

export default AssetRequestDetailScreen;
