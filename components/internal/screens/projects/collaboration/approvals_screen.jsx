"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, ListChecks, Plus, Trash2, XCircle } from "lucide-react";

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
import { Checkbox } from "@geiger/ui/checkbox";
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
  listReviews,
  createReview,
  updateReview,
  softDeleteReview,
  listPipelines,
} from "@/lib/supabase/approvals";
import { listAssets } from "@/lib/supabase/assets";
import { listRoles } from "@/lib/supabase/rbac";
import { getUser } from "@/lib/supabase/user";
import { uniqueId } from "@/lib/utils";

import {
  REVIEW_STATUS_MAP,
  REVIEW_STATUS_FILTER_OPTIONS,
  PRIORITY_MAP,
  PRIORITY_OPTIONS,
  SUBJECT_FILTER_OPTIONS,
  AVAILABLE_SUBJECTS,
  formatRelative,
  subjectEntry,
} from "./constants";
import { ReviewDetailScreen } from "./review_detail";

const EMPTY_DRAFT = {
  name: "",
  subjectType: "asset",
  pipelineId: "",
  priority: "Normal",
  dueDays: "7",
  itemIds: [],
};

const DUE_OPTIONS = [
  { value: "0", label: "No due date" },
  { value: "3", label: "In 3 days" },
  { value: "7", label: "In a week" },
  { value: "14", label: "In two weeks" },
];

function CreateReviewDialog({ open, onOpenChange, onCreate, pipelines, assets }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const eligible = useMemo(
    () => pipelines.filter((p) => p.subjectType === draft.subjectType && p.status === "Active"),
    [pipelines, draft.subjectType],
  );

  // Default to the subject's default pipeline whenever the subject changes.
  const [seenSubject, setSeenSubject] = useState(draft.subjectType);
  if (seenSubject !== draft.subjectType) {
    setSeenSubject(draft.subjectType);
    const fallback = eligible.find((p) => p.isDefault) || eligible[0];
    setDraft((d) => ({ ...d, pipelineId: fallback?.id || "" }));
  }

  const toggleItem = (id, checked) => {
    setDraft((d) => {
      const next = new Set(d.itemIds);
      if (checked) next.add(id);
      else next.delete(id);
      return { ...d, itemIds: Array.from(next) };
    });
  };

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the review a name first.");
      return;
    }
    if (!draft.pipelineId) {
      toast.error("Pick an active pipeline to route this review through.");
      return;
    }
    if (draft.subjectType === "asset" && !draft.itemIds.length) {
      toast.error("Select at least one asset to review.");
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
          <DialogTitle>Request review</DialogTitle>
          <DialogDescription>
            The pipeline you pick decides who sees this first and where it goes next.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="grid gap-4"
        >
          <Field label="Review name" htmlFor="review-name">
            <Input
              id="review-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Autumn campaign — final hero shots"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Reviewing">
              <Select value={draft.subjectType} onValueChange={set("subjectType")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_SUBJECTS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Pipeline"
              hint={
                eligible.length
                  ? undefined
                  : "No active pipeline for this subject — create one first."
              }
            >
              <Select value={draft.pipelineId} onValueChange={set("pipelineId")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {eligible.length ? (
                    eligible.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.isDefault ? " (default)" : ""}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No active pipelines
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Priority">
              <Select value={draft.priority} onValueChange={set("priority")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Due">
              <Select value={draft.dueDays} onValueChange={set("dueDays")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DUE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {draft.subjectType === "asset" ? (
            <Field
              label="Assets"
              hint={`${draft.itemIds.length} selected`}
            >
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-card p-2">
                {assets.length ? (
                  assets.map((a) => (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-surface-hover"
                    >
                      <Checkbox
                        checked={draft.itemIds.includes(a.id)}
                        onCheckedChange={(c) => toggleItem(a.id, c === true)}
                      />
                      <span className="truncate text-foreground">{a.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-text-tertiary">
                        {a.type}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="px-2 py-3 text-sm text-text-secondary">
                    No assets in this project yet.
                  </p>
                )}
              </div>
            </Field>
          ) : null}
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
            Request review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApprovalsScreen({ projectId }) {
  const [reviews, setReviews] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [assets, setAssets] = useState([]);
  const [roles, setRoles] = useState([]);
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
    listReviews(projectId).then((rows) => {
      if (!alive) return;
      setReviews(rows ?? []);
      setLoading(false);
    });
    listPipelines(projectId).then((rows) => alive && setPipelines(rows ?? []));
    listAssets(projectId).then((rows) => alive && setAssets(rows ?? []));
    listRoles(projectId).then((rows) => alive && setRoles(rows ?? []));
    getUser().then((u) => alive && setUser(u));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const selected = useMemo(
    () => (openId ? reviews.find((r) => r.id === openId) || null : null),
    [openId, reviews],
  );

  const pipelineName = useMemo(() => {
    const map = new Map(pipelines.map((p) => [p.id, p.name]));
    return (id) => map.get(id) || "—";
  }, [pipelines]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reviews.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (subjectType !== "all" && r.subjectType !== subjectType) return false;
      if (term) {
        const haystack = `${r.name} ${r.description} ${pipelineName(r.pipelineId)}`;
        if (!haystack.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [reviews, search, status, subjectType, pipelineName]);

  const stats = useMemo(() => {
    const open = reviews.filter((r) => r.status === "In Review" || r.status === "Pending").length;
    const changes = reviews.filter((r) => r.status === "Changes Requested").length;
    const approved = reviews.filter((r) => r.status === "Approved").length;
    const overdue = reviews.filter(
      (r) =>
        r.dueAt &&
        new Date(r.dueAt) < new Date() &&
        !["Approved", "Rejected", "Cancelled"].includes(r.status),
    ).length;
    return [
      { label: "In flight", value: String(open), footer: `${reviews.length} total` },
      { label: "Need changes", value: String(changes), footer: "Sent back to the requester" },
      { label: "Approved", value: String(approved), footer: "Closed successfully" },
      { label: "Overdue", value: String(overdue), footer: "Past their due date" },
    ];
  }, [reviews]);

  const handleCreate = (draft) => {
    const pipeline = pipelines.find((p) => p.id === draft.pipelineId);
    const days = Number(draft.dueDays) || 0;
    const items =
      draft.subjectType === "asset"
        ? draft.itemIds.map((id) => ({
            assetId: id,
            label: assets.find((a) => a.id === id)?.name || "",
          }))
        : [];
    const review = {
      id: uniqueId(),
      projectId,
      pipelineId: draft.pipelineId,
      name: draft.name.trim(),
      description: "",
      subjectType: draft.subjectType,
      subjectId: null,
      status: "In Review",
      priority: draft.priority,
      currentStage: 0,
      // Snapshot the pipeline's stages so a later edit can't move the goalposts.
      stages: pipeline?.stages || [],
      dueAt: days ? new Date(Date.now() + days * 86400000).toISOString() : null,
      requestedBy: user?.id || null,
      actorName: user?.name || "",
    };
    setReviews((prev) => [{ ...review, itemCount: items.length }, ...prev]);
    createReview(review, items).then((saved) => {
      if (saved) {
        setReviews((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
        toast.success(`"${review.name}" sent for review.`);
      } else {
        setReviews((prev) => prev.filter((r) => r.id !== review.id));
        toast.error("Couldn't create the review.");
      }
    });
  };

  const handleReviewChange = (updated) => {
    setReviews((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  };

  const handleCancel = (review) => {
    const previous = review.status;
    setReviews((prev) =>
      prev.map((r) => (r.id === review.id ? { ...r, status: "Cancelled" } : r)),
    );
    updateReview(review.id, {
      status: "Cancelled",
      completedAt: new Date().toISOString(),
    }).then((saved) => {
      if (!saved) {
        setReviews((prev) =>
          prev.map((r) => (r.id === review.id ? { ...r, status: previous } : r)),
        );
        toast.error("Couldn't cancel the review.");
        return;
      }
      toast.success(`"${review.name}" cancelled.`);
    });
  };

  const handleDelete = (review) => {
    setDeleteTarget(null);
    if (openId === review.id) setOpenId(null);
    setReviews((prev) => prev.filter((r) => r.id !== review.id));
    softDeleteReview(review.id).then((ok) => {
      if (!ok) {
        setReviews((prev) => [review, ...prev]);
        toast.error("Couldn't delete the review.");
        return;
      }
      toast.success(`Deleted "${review.name}".`);
    });
  };

  const columns = [
    {
      key: "name",
      header: "Review",
      render: (r) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{r.name}</span>
          <span className="text-xs text-text-secondary">
            {subjectEntry(r.subjectType)?.label || r.subjectType} ·{" "}
            {r.itemCount || 0} item{r.itemCount === 1 ? "" : "s"}
          </span>
        </div>
      ),
    },
    {
      key: "pipeline",
      header: "Pipeline",
      className: "text-text-secondary",
      render: (r) => pipelineName(r.pipelineId),
    },
    {
      key: "stage",
      header: "Stage",
      render: (r) => {
        const total = r.stages?.length || 0;
        if (!total) return <span className="text-text-tertiary">—</span>;
        const name = r.stages[Math.min(r.currentStage, total - 1)]?.name || "";
        const done = ["Approved", "Rejected", "Cancelled"].includes(r.status);
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-foreground">{done ? "Complete" : name}</span>
            <span className="text-xs text-text-tertiary tabular-nums">
              {done ? `${total} of ${total}` : `${Math.min(r.currentStage + 1, total)} of ${total}`}
            </span>
          </div>
        );
      },
    },
    {
      key: "priority",
      header: "Priority",
      render: (r) => (
        <Badge variant={PRIORITY_MAP[r.priority]?.variant || "neutral"}>{r.priority}</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} map={REVIEW_STATUS_MAP} />,
    },
    {
      key: "due",
      header: "Due",
      className: "text-text-secondary",
      render: (r) => {
        if (!r.dueAt) return "—";
        const overdue =
          new Date(r.dueAt) < new Date() &&
          !["Approved", "Rejected", "Cancelled"].includes(r.status);
        return (
          <span className={overdue ? "text-red-400" : undefined}>
            {formatRelative(r.dueAt)}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (r) => (
        <ActionMenu
          label="Review actions"
          items={[
            { icon: ListChecks, label: "Open", onSelect: () => setOpenId(r.id) },
            ...(["Approved", "Rejected", "Cancelled"].includes(r.status)
              ? []
              : [{ icon: XCircle, label: "Cancel", onSelect: () => handleCancel(r) }]),
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              variant: "destructive",
              onSelect: () => setDeleteTarget(r),
            },
          ]}
        />
      ),
    },
  ];

  if (selected) {
    return (
      <ReviewDetailScreen
        review={selected}
        pipeline={pipelines.find((p) => p.id === selected.pipelineId) || null}
        roles={roles}
        user={user}
        onBack={() => setOpenId(null)}
        onReviewChange={handleReviewChange}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Approvals"
        description="Every review in flight, the stage it's waiting on, and the decision trail behind it. Work moves through the pipeline bound to its subject."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> Request review
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={status}
            onValueChange={setStatus}
            options={REVIEW_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={subjectType}
            onValueChange={setSubjectType}
            options={SUBJECT_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search reviews…" />
      </Toolbar>

      {loading ? (
        <LoadingArea panel size={48} label="Loading approvals…" />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(r) => r.id}
          onRowClick={(r) => setOpenId(r.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={reviews.length ? Clock : ListChecks}
                title={reviews.length ? "No reviews match your filters" : "Nothing awaiting approval"}
                description={
                  reviews.length
                    ? "Try clearing the search or filters, or request a new review."
                    : pipelines.some((p) => p.status === "Active")
                      ? "Send work for sign-off and it'll appear here with the stage it's waiting on."
                      : "Create an active approval pipeline first — a review needs a route to follow."
                }
                action={
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4" /> Request review
                  </Button>
                }
              />
            </div>
          }
        />
      )}

      <CreateReviewDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
        pipelines={pipelines}
        assets={assets}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete review</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>? Its
              decision history goes with it. Cancel the review instead if you want to keep
              the record.
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

export default ApprovalsScreen;
