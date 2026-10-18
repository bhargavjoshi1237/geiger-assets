"use client";

// Moderate one post's comments: reply as the creator, hide (keeps it on file,
// off the public page) or delete. Reports the visible count back so the post's
// counter on the public page stays right.

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import { ScrollArea } from "@geiger/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { EmptyState, LoadingArea } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { createPostComment, deletePostComment, listPostComments, setCommentHidden } from "@/lib/supabase/creator";
import { formatDate } from "./constants";

export function PostCommentsDialog({ post, creatorName, onOpenChange, onCount }) {
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    listPostComments(post.id).then((rows) => {
      if (alive) setComments(rows ?? []);
    });
    return () => {
      alive = false;
    };
  }, [post.id]);

  const sync = (list) => {
    setComments(list);
    onCount(list.filter((c) => !c.isHidden).length);
  };

  const reply = async () => {
    if (!text.trim()) return;
    setSending(true);
    const created = await createPostComment({ projectId: post.projectId, postId: post.id, authorName: creatorName, isCreator: true, body: text.trim() });
    setSending(false);
    if (!created) return toast.error("Couldn't post the reply");
    setText("");
    sync([...comments, created]);
  };

  const toggleHidden = async (comment) => {
    const saved = await setCommentHidden(comment.id, !comment.isHidden);
    if (!saved) return toast.error("Couldn't update the comment");
    sync(comments.map((c) => (c.id === comment.id ? saved : c)));
  };

  const remove = async (comment) => {
    const ok = await deletePostComment(comment.id);
    if (!ok) return toast.error("Couldn't delete the comment");
    sync(comments.filter((c) => c.id !== comment.id));
    toast.success("Comment deleted");
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100vw-2rem)] flex-col gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comments on “{post.title}”</DialogTitle>
          <DialogDescription>Hidden comments stay on file but disappear from your page.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="-mx-1 min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:max-h-[50dvh]">
          {comments === null ? (
            <LoadingArea className="h-32" />
          ) : comments.length ? (
            <ul className="divide-y divide-border px-1">
              {comments.map((c) => (
                <li key={c.id} className={cn("flex gap-3 py-3", c.isHidden && "opacity-60")}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-tertiary">
                      <span className="font-medium text-text-secondary">{c.authorName || "Member"}</span>
                      {c.isCreator ? " · you" : ""} · {formatDate(c.createdAt)}
                      {c.isHidden ? " · hidden" : ""}
                    </p>
                    <p className="whitespace-pre-line text-sm text-foreground">{c.body}</p>
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={c.isHidden ? "Show comment" : "Hide comment"} className="h-8 w-8 text-text-secondary hover:bg-surface-active hover:text-foreground" onClick={() => toggleHidden(c)}>
                      {c.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Delete comment" className="h-8 w-8 text-red-600 dark:text-red-400 hover:bg-red-500/10" onClick={() => remove(c)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={MessageCircle} title="No comments yet" description="Fans who can see this post can comment on it." className="py-8" />
          )}
        </ScrollArea>
        <div className="flex items-end gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} rows={2} placeholder="Reply as the creator…" className="resize-none bg-surface-card" />
          <Button size="icon" aria-label="Post reply" className="h-10 w-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90" disabled={sending || !text.trim()} onClick={reply}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
