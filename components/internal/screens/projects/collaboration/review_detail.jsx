"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  CircleDot,
  Clock,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Undo2,
  X,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EditorHeader } from "@/components/internal/shared/editor_shell";
import {
  EmptyState,
  LoadingArea,
  SectionCard,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Textarea } from "@geiger/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@geiger/ui";
import { cn } from "@/lib/utils";

import {
  listReviewItems,
  listDecisions,
  setItemDecision,
  submitStageDecision,
  reopenReview,
} from "@/lib/supabase/approvals";
import {
  listThreadsForReview,
  createComment,
  resolveThread,
} from "@/lib/supabase/comments";
import { uniqueId } from "@/lib/utils";

import {
  REVIEW_STATUS_MAP,
  DECISION_MAP,
  PRIORITY_MAP,
  COMMENT_STATUS_MAP,
  formatDateTime,
  formatRelative,
  initials,
  subjectEntry,
} from "./constants";

const TERMINAL = new Set(["Approved", "Rejected", "Cancelled"]);

function Avatar({ name, className }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-active text-[10px] font-semibold text-text-secondary",
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/** A thumbnail, or a coloured initial tile when the asset has no preview. */
function ItemThumb({ item }) {
  if (item.thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.thumbnailUrl}
        alt=""
        className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover"
      />
    );
  }
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-xs font-semibold text-text-secondary"
      style={item.assetColor ? { backgroundColor: `${item.assetColor}20` } : undefined}
      aria-hidden="true"
    >
      {initials(item.label || item.assetName)}
    </span>
  );
}

function ItemRow({ item, disabled, onDecide }) {
  const decision = DECISION_MAP[item.decision] || DECISION_MAP.pending;
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
      <ItemThumb item={item} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">
          {item.label || item.assetName || "Untitled"}
        </p>
        <p className="text-xs text-text-secondary">
          {item.assetType || "Item"}
          {item.decidedAt ? ` · decided ${formatRelative(item.decidedAt)}` : ""}
          {item.note ? ` · ${item.note}` : ""}
        </p>
      </div>
      <Badge variant={decision.variant}>{decision.label}</Badge>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-400"
          aria-label={`Approve ${item.label || item.assetName}`}
          disabled={disabled}
          onClick={() => onDecide(item, "approved")}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-amber-400 hover:bg-amber-500/10 hover:text-amber-400"
          aria-label={`Request changes on ${item.label || item.assetName}`}
          disabled={disabled}
          onClick={() => onDecide(item, "changes")}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-400 hover:bg-red-500/10 hover:text-red-400"
          aria-label={`Reject ${item.label || item.assetName}`}
          disabled={disabled}
          onClick={() => onDecide(item, "rejected")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/** The pipeline route, with the stage the review is sitting on highlighted. */
function StageTimeline({ review, decisions, roles }) {
  const stages = review.stages || [];
  if (!stages.length) {
    return (
      <p className="px-4 py-6 text-sm text-text-secondary">
        This review has no pipeline stages — it was created without a pipeline, so a single
        decision closes it.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-border">
      {stages.map((stage, index) => {
        const stageDecisions = decisions.filter((d) => d.stageIndex === index);
        const approvals = stageDecisions.filter((d) => d.decision === "approved").length;
        const required = Math.max(1, Number(stage.minApprovals) || 1);
        const isCurrent = index === review.currentStage && !TERMINAL.has(review.status);
        const isDone = index < review.currentStage || review.status === "Approved";
        const role = roles.find((r) => r.id === stage.roleId);

        return (
          <li key={stage.id || index} className="flex gap-3 px-4 py-4">
            <span
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                isDone
                  ? "bg-emerald-500/15 text-emerald-400"
                  : isCurrent
                    ? "bg-sky-500/15 text-sky-400"
                    : "bg-surface-active text-text-tertiary",
              )}
              aria-hidden="true"
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">
                  {stage.name || `Stage ${index + 1}`}
                </p>
                {isCurrent ? (
                  <Badge variant="info">
                    <CircleDot className="h-3 w-3" /> Waiting here
                  </Badge>
                ) : null}
                {isDone ? <Badge variant="success">Cleared</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                {stage.approverType === "member"
                  ? `${stage.memberIds?.length || 0} named approver${(stage.memberIds?.length || 0) === 1 ? "" : "s"}`
                  : role
                    ? `Anyone with “${role.name}”`
                    : "No approver assigned"}{" "}
                · {approvals} of {required} approval{required === 1 ? "" : "s"}
              </p>
              {stageDecisions.length ? (
                <ul className="mt-2 space-y-1">
                  {stageDecisions.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-2 text-xs text-text-tertiary"
                    >
                      <Avatar name={d.actorName} className="h-5 w-5 text-[9px]" />
                      <span className="text-text-secondary">
                        {d.actorName || "Someone"}
                      </span>
                      <Badge variant={DECISION_MAP[d.decision]?.variant || "neutral"}>
                        {DECISION_MAP[d.decision]?.label || d.decision}
                      </Badge>
                      <span>{formatRelative(d.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function CommentThread({ thread, onReply, onResolve, user }) {
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border px-4 py-4 last:border-0">
      <div className="flex items-start gap-3">
        <Avatar name={thread.authorName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {thread.authorName || "Someone"}
            </span>
            <span className="text-xs text-text-tertiary">
              {formatRelative(thread.createdAt)}
            </span>
            <StatusPill status={thread.status} map={COMMENT_STATUS_MAP} />
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">
            {thread.body}
          </p>

          {thread.replies?.length ? (
            <ul className="mt-3 space-y-3 border-l border-border pl-3">
              {thread.replies.map((r) => (
                <li key={r.id} className="flex items-start gap-2.5">
                  <Avatar name={r.authorName} className="h-6 w-6 text-[9px]" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {r.authorName || "Someone"}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        {formatRelative(r.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-text-secondary">
                      {r.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-7 px-2 text-xs text-text-secondary hover:text-foreground"
              onClick={() => setOpen((o) => !o)}
            >
              Reply
            </Button>
            <Button
              variant="ghost"
              className="h-7 px-2 text-xs text-text-secondary hover:text-foreground"
              onClick={() => onResolve(thread, thread.status !== "resolved")}
            >
              {thread.status === "resolved" ? "Reopen" : "Resolve"}
            </Button>
          </div>

          {open ? (
            <div className="mt-2 flex items-start gap-2">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={`Reply as ${user?.name || "you"}…`}
                className="h-[60px] min-h-0 resize-none"
              />
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                size="icon"
                aria-label="Send reply"
                disabled={!reply.trim()}
                onClick={() => {
                  onReply(thread, reply.trim());
                  setReply("");
                  setOpen(false);
                }}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ReviewDetailScreen({
  review,
  pipeline,
  roles = [],
  user,
  onBack,
  onReviewChange,
}) {
  const [items, setItems] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [newComment, setNewComment] = useState("");
  const [activeTab, setActiveTab] = useState("items");

  // Reset during render rather than in the effect — setState inside an effect
  // body cascades a second render pass.
  const [seedId, setSeedId] = useState(review?.id);
  if (review?.id !== seedId) {
    setSeedId(review?.id);
    setLoading(true);
    setItems([]);
    setDecisions([]);
    setThreads([]);
    setActiveTab("items");
  }

  useEffect(() => {
    if (!review?.id) return undefined;
    let alive = true;
    Promise.all([
      listReviewItems(review.id),
      listDecisions(review.id),
      listThreadsForReview(review.id),
    ]).then(([i, d, t]) => {
      if (!alive) return;
      setItems(i ?? []);
      setDecisions(d ?? []);
      setThreads(t ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [review?.id]);

  const locked = TERMINAL.has(review?.status);

  const itemSummary = useMemo(() => {
    const counts = { pending: 0, approved: 0, rejected: 0, changes: 0 };
    for (const i of items) counts[i.decision] = (counts[i.decision] || 0) + 1;
    return counts;
  }, [items]);

  const handleItemDecision = (item, decision) => {
    const previous = item.decision;
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, decision, decidedAt: new Date().toISOString(), decidedBy: user?.id || null }
          : i,
      ),
    );
    setItemDecision(item.id, decision, { actorId: user?.id || null }).then((saved) => {
      if (saved) {
        setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, decision: previous } : i)),
      );
      toast.error("Couldn't record that decision.");
    });
  };

  const handleStageDecision = (decision) => {
    if (submitting) return;
    if (decision === "approved" && itemSummary.pending === items.length && items.length) {
      toast.error("Decide on at least one item before approving this stage.");
      return;
    }
    setSubmitting(true);
    submitStageDecision(review, decision, {
      note: note.trim(),
      actor: user || {},
      pipeline,
    }).then((result) => {
      setSubmitting(false);
      if (!result) {
        toast.error("Couldn't submit your decision.");
        return;
      }
      setNote("");
      setDecisions((prev) => [result.decision, ...prev]);
      onReviewChange(result.review);
      if (result.finalized) {
        toast.success(`"${review.name}" is fully approved.`);
      } else if (decision === "rejected") {
        toast.success("Review rejected.");
      } else if (decision === "changes") {
        toast.success("Changes requested — the requester has been notified in the feed.");
      } else {
        toast.success("Approved — moved to the next stage.");
      }
    });
  };

  const handleReopen = () => {
    reopenReview(review, { actor: user || {} }).then((saved) => {
      if (!saved) {
        toast.error("Couldn't reopen the review.");
        return;
      }
      onReviewChange(saved);
      listDecisions(review.id).then((d) => setDecisions(d ?? []));
      toast.success("Review reopened.");
    });
  };

  const postComment = (body, parentId = null) => {
    const optimistic = {
      id: uniqueId(),
      projectId: review.projectId,
      parentId,
      reviewId: review.id,
      subjectType: review.subjectType,
      subjectId: review.subjectId,
      body,
      status: "open",
      authorId: user?.id || null,
      authorName: user?.name || "You",
      createdAt: new Date().toISOString(),
      replies: [],
    };
    if (parentId) {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === parentId ? { ...t, replies: [...t.replies, optimistic] } : t,
        ),
      );
    } else {
      setThreads((prev) => [optimistic, ...prev]);
    }
    createComment(optimistic).then((saved) => {
      if (saved) return;
      if (parentId) {
        setThreads((prev) =>
          prev.map((t) =>
            t.id === parentId
              ? { ...t, replies: t.replies.filter((r) => r.id !== optimistic.id) }
              : t,
          ),
        );
      } else {
        setThreads((prev) => prev.filter((t) => t.id !== optimistic.id));
      }
      toast.error("Couldn't post that comment.");
    });
  };

  const handleResolve = (thread, resolved) => {
    setThreads((prev) =>
      prev.map((t) => (t.id === thread.id ? { ...t, status: resolved ? "resolved" : "open" } : t)),
    );
    resolveThread(thread.id, {
      actorId: user?.id || null,
      actorName: user?.name || "",
      resolved,
    }).then((saved) => {
      if (saved) return;
      setThreads((prev) =>
        prev.map((t) => (t.id === thread.id ? { ...t, status: thread.status } : t)),
      );
      toast.error("Couldn't update the thread.");
    });
  };

  if (!review) return null;

  const stage = review.stages?.[review.currentStage];
  const subject = subjectEntry(review.subjectType);

  return (
    <MainScreenWrapper>
      <EditorHeader
        back={{ label: "All approvals", onClick: onBack }}
        title={review.name}
        status={review.status}
        statusMap={REVIEW_STATUS_MAP}
        badges={
          <>
            <Badge variant="neutral">{subject?.label || review.subjectType}</Badge>
            <Badge variant={PRIORITY_MAP[review.priority]?.variant || "neutral"}>
              {review.priority}
            </Badge>
            {review.dueAt ? (
              <Badge variant={new Date(review.dueAt) < new Date() ? "danger" : "neutral"}>
                <Clock className="h-3 w-3" /> Due {formatRelative(review.dueAt)}
              </Badge>
            ) : null}
          </>
        }
        meta={
          locked
            ? `Closed ${formatRelative(review.completedAt)}`
            : stage
              ? `Waiting on “${stage.name || `Stage ${review.currentStage + 1}`}” · stage ${review.currentStage + 1} of ${review.stages.length}`
              : "No pipeline stages"
        }
        actions={
          locked ? (
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={handleReopen}
            >
              <Undo2 className="h-4 w-4" /> Reopen
            </Button>
          ) : null
        }
      />

      {loading ? (
        <LoadingArea panel size={48} label="Loading review…" />
      ) : (
        <>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="items">Items ({items.length})</TabsTrigger>
              <TabsTrigger value="stages">Stages</TabsTrigger>
              <TabsTrigger value="history">History ({decisions.length})</TabsTrigger>
              <TabsTrigger value="comments">Comments ({threads.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="pt-4">
              <SectionCard
                title="Under review"
                description={`${itemSummary.approved} approved · ${itemSummary.changes} need changes · ${itemSummary.rejected} rejected · ${itemSummary.pending} undecided`}
                bodyPadding={false}
              >
                {items.length ? (
                  items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      disabled={locked}
                      onDecide={handleItemDecision}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={CircleDot}
                    title="Nothing attached"
                    description="This review was created without any items."
                  />
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="stages" className="pt-4">
              <SectionCard
                title="Approval route"
                description="The stages this review was created against — a later pipeline edit doesn't change them."
                bodyPadding={false}
              >
                <StageTimeline review={review} decisions={decisions} roles={roles} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="history" className="pt-4">
              <SectionCard
                title="Decision history"
                description="Every sign-off, rejection, and change request on this review."
                bodyPadding={false}
              >
                {decisions.length ? (
                  <ul className="divide-y divide-border">
                    {decisions.map((d) => (
                      <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                        <Avatar name={d.actorName} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">
                            <span className="font-medium">{d.actorName || "Someone"}</span>{" "}
                            <span className="text-text-secondary">
                              {d.decision === "approved"
                                ? "approved"
                                : d.decision === "rejected"
                                  ? "rejected"
                                  : d.decision === "changes"
                                    ? "requested changes at"
                                    : d.decision}
                            </span>{" "}
                            {d.stageName}
                          </p>
                          {d.note ? (
                            <p className="mt-0.5 text-xs text-text-secondary">{d.note}</p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-xs text-text-tertiary">
                          {formatDateTime(d.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={Clock}
                    title="No decisions yet"
                    description="Nobody has acted on this review."
                  />
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="comments" className="pt-4">
              <SectionCard
                title="Discussion"
                description="Feedback attached to this review."
                bodyPadding={false}
              >
                <div className="flex items-start gap-2 border-b border-border p-4">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Leave a comment…"
                    className="h-[60px] min-h-0 resize-none"
                  />
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    size="icon"
                    aria-label="Post comment"
                    disabled={!newComment.trim()}
                    onClick={() => {
                      postComment(newComment.trim());
                      setNewComment("");
                    }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                {threads.length ? (
                  threads.map((t) => (
                    <CommentThread
                      key={t.id}
                      thread={t}
                      user={user}
                      onReply={(thread, body) => postComment(body, thread.id)}
                      onResolve={handleResolve}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={MessageSquare}
                    title="No comments yet"
                    description="Start the conversation — reviewers will see it here."
                  />
                )}
              </SectionCard>
            </TabsContent>
          </Tabs>

          {!locked ? (
            <SectionCard
              title={`Your decision on “${stage?.name || "this review"}”`}
              description="Approving counts toward this stage's required sign-offs. Rejecting closes the review."
            >
              <div className="grid gap-3">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note for the record (optional)…"
                  className="h-[72px] min-h-0 resize-none"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={submitting}
                    onClick={() => handleStageDecision("approved")}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Approve stage
                  </Button>
                  {stage?.allowChangeRequests !== false ? (
                    <Button
                      variant="outline"
                      className="border-border bg-transparent text-amber-400 hover:bg-amber-500/10 hover:text-amber-400"
                      disabled={submitting}
                      onClick={() => handleStageDecision("changes")}
                    >
                      <RotateCcw className="h-4 w-4" /> Request changes
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    className="border-border bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-400"
                    disabled={submitting}
                    onClick={() => handleStageDecision("rejected")}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </>
      )}
    </MainScreenWrapper>
  );
}

export default ReviewDetailScreen;
