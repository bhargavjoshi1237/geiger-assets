"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, MessageSquare, Send } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@geiger/ui";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { cn } from "@/lib/utils";

import {
  listThreads,
  createComment,
  resolveThread,
} from "@/lib/supabase/comments";
import { listActivity } from "@/lib/supabase/activity";
import { getUser } from "@/lib/supabase/user";
import { uniqueId } from "@/lib/utils";

import {
  COMMENT_STATUS_MAP,
  COMMENT_STATUS_FILTER_OPTIONS,
  ACTIVITY_FILTER_OPTIONS,
  ACTIVITY_TONE_CLASS,
  DAY_BUCKET_ORDER,
  activityVerb,
  dayBucket,
  formatDateTime,
  formatRelative,
  initials,
} from "./constants";

function Avatar({ name, className }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-active text-[11px] font-semibold text-text-secondary",
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function AssetChip({ thread }) {
  if (!thread.assetName) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-card px-2 py-0.5 text-xs text-text-secondary">
      {thread.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thread.thumbnailUrl} alt="" className="h-3.5 w-3.5 rounded object-cover" />
      ) : null}
      {thread.assetName}
    </span>
  );
}

function Thread({ thread, user, onReply, onResolve }) {
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-4">
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
            <AssetChip thread={thread} />
          </div>

          <p className="mt-1.5 whitespace-pre-wrap text-sm text-text-secondary">
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
                    <p className="whitespace-pre-wrap text-sm text-text-secondary">{r.body}</p>
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

export function CommentsActivityScreen({ projectId }) {
  const [threads, setThreads] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("comments");
  const [search, setSearch] = useState("");
  const [commentStatus, setCommentStatus] = useState("all");
  const [activityGroup, setActivityGroup] = useState("all");
  const [user, setUser] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listThreads(projectId), listActivity(projectId)]).then(([t, a]) => {
      if (!alive) return;
      setThreads(t ?? []);
      setEvents(a ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUser(u));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return threads.filter((t) => {
      if (commentStatus !== "all" && t.status !== commentStatus) return false;
      if (term) {
        const haystack = `${t.body} ${t.authorName} ${t.assetName}`;
        const inReplies = (t.replies || []).some((r) =>
          r.body.toLowerCase().includes(term),
        );
        if (!haystack.toLowerCase().includes(term) && !inReplies) return false;
      }
      return true;
    });
  }, [threads, search, commentStatus]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((e) => {
      const verb = activityVerb(e.verb);
      if (activityGroup !== "all" && verb.group !== activityGroup) return false;
      if (term) {
        const haystack = `${e.actorName} ${verb.label} ${e.subjectLabel} ${e.summary}`;
        if (!haystack.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [events, search, activityGroup]);

  /** Group the timeline into Today / Yesterday / This week / … buckets. */
  const groupedEvents = useMemo(() => {
    const buckets = new Map();
    for (const e of filteredEvents) {
      const key = dayBucket(e.createdAt);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(e);
    }
    return DAY_BUCKET_ORDER.filter((k) => buckets.has(k)).map((k) => ({
      label: k,
      items: buckets.get(k),
    }));
  }, [filteredEvents]);

  const stats = useMemo(() => {
    const open = threads.filter((t) => t.status === "open").length;
    const resolved = threads.filter((t) => t.status === "resolved").length;
    const replies = threads.reduce((s, t) => s + (t.replies?.length || 0), 0);
    const today = events.filter((e) => dayBucket(e.createdAt) === "Today").length;
    return [
      { label: "Open threads", value: String(open), footer: `${threads.length} total` },
      { label: "Resolved", value: String(resolved), footer: "Closed out" },
      { label: "Replies", value: String(replies), footer: "Across all threads" },
      { label: "Events today", value: String(today), footer: "Across the project" },
    ];
  }, [threads, events]);

  const postReply = (thread, body) => {
    const optimistic = {
      id: uniqueId(),
      projectId,
      parentId: thread.id,
      subjectType: thread.subjectType,
      subjectId: thread.subjectId,
      assetId: thread.assetId,
      body,
      status: "open",
      authorId: user?.id || null,
      authorName: user?.name || "You",
      createdAt: new Date().toISOString(),
      replies: [],
    };
    setThreads((prev) =>
      prev.map((t) =>
        t.id === thread.id ? { ...t, replies: [...t.replies, optimistic] } : t,
      ),
    );
    createComment(optimistic).then((saved) => {
      if (saved) return;
      setThreads((prev) =>
        prev.map((t) =>
          t.id === thread.id
            ? { ...t, replies: t.replies.filter((r) => r.id !== optimistic.id) }
            : t,
        ),
      );
      toast.error("Couldn't post that reply.");
    });
  };

  const handleResolve = (thread, resolved) => {
    setThreads((prev) =>
      prev.map((t) =>
        t.id === thread.id ? { ...t, status: resolved ? "resolved" : "open" } : t,
      ),
    );
    resolveThread(thread.id, {
      actorId: user?.id || null,
      actorName: user?.name || "",
      resolved,
    }).then((saved) => {
      if (saved) {
        toast.success(resolved ? "Thread resolved." : "Thread reopened.");
        return;
      }
      setThreads((prev) =>
        prev.map((t) => (t.id === thread.id ? { ...t, status: thread.status } : t)),
      );
      toast.error("Couldn't update the thread.");
    });
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Comments & Activity"
        description="What people said and what the system did — every review thread across the library, and the running log of uploads, approvals, shares, and team changes."
      />

      <StatsBar stats={stats} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="comments">Comments ({threads.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({events.length})</TabsTrigger>
        </TabsList>

        <div className="pt-4">
          <Toolbar>
            <div className="flex items-center gap-2">
              {tab === "comments" ? (
                <FilterDropdown
                  value={commentStatus}
                  onValueChange={setCommentStatus}
                  options={COMMENT_STATUS_FILTER_OPTIONS}
                  height="h-9"
                />
              ) : (
                <FilterDropdown
                  value={activityGroup}
                  onValueChange={setActivityGroup}
                  options={ACTIVITY_FILTER_OPTIONS}
                  height="h-9"
                />
              )}
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={tab === "comments" ? "Search comments…" : "Search activity…"}
            />
          </Toolbar>
        </div>

        {loading ? (
          <LoadingArea panel size={48} label="Loading collaboration feed…" />
        ) : (
          <>
            <TabsContent value="comments" className="space-y-3 pt-4">
              {filteredThreads.length ? (
                filteredThreads.map((t) => (
                  <Thread
                    key={t.id}
                    thread={t}
                    user={user}
                    onReply={postReply}
                    onResolve={handleResolve}
                  />
                ))
              ) : (
                <div className="rounded-xl border border-border bg-surface-subtle">
                  <EmptyState
                    icon={MessageSquare}
                    title={
                      threads.length ? "No threads match your filters" : "No comments yet"
                    }
                    description={
                      threads.length
                        ? "Try clearing the search or status filter."
                        : "Comments left on assets and reviews collect here, so nothing gets lost in a single file's detail panel."
                    }
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-6 pt-4">
              {groupedEvents.length ? (
                groupedEvents.map((bucket) => (
                  <section key={bucket.label}>
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
                      {bucket.label}
                    </h3>
                    <ol className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
                      {bucket.items.map((e) => {
                        const verb = activityVerb(e.verb);
                        return (
                          <li
                            key={e.id}
                            className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
                          >
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                ACTIVITY_TONE_CLASS[verb.tone] || ACTIVITY_TONE_CLASS.slate,
                              )}
                              aria-hidden="true"
                            />
                            <Avatar name={e.actorName} className="h-7 w-7 text-[10px]" />
                            <p className="min-w-0 flex-1 truncate text-sm text-text-secondary">
                              <span className="font-medium text-foreground">
                                {e.actorName || "Someone"}
                              </span>{" "}
                              {verb.label}{" "}
                              <span className="text-foreground">
                                {e.subjectLabel || e.summary || "an item"}
                              </span>
                            </p>
                            <span className="shrink-0 text-xs text-text-tertiary">
                              {formatDateTime(e.createdAt)}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ))
              ) : (
                <div className="rounded-xl border border-border bg-surface-subtle">
                  <EmptyState
                    icon={Activity}
                    title={events.length ? "No activity matches your filters" : "No activity yet"}
                    description={
                      events.length
                        ? "Try a different filter or search term."
                        : "Uploads, shares, approvals, and team changes will stream in here as they happen."
                    }
                  />
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </MainScreenWrapper>
  );
}

export default CommentsActivityScreen;
