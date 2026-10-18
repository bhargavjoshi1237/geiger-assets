"use client";

import React, { useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  HandCoins,
  Heart,
  Images,
  Loader2,
  Lock,
  MessageCircle,
  Pin,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import { cn } from "@/lib/utils";
import { VISIBILITY_LABEL, accentStyle, formatMoney, postJson, timeAgo } from "./public_kit";

function ratio(media) {
  if (!media?.width || !media?.height) return "4 / 3";
  const r = media.width / media.height;
  return String(Math.min(Math.max(r, 0.6), 2.2));
}

/**
 * A post or message attachment. Open media renders the real file; locked media
 * only ever has the tiny placeholder, blurred, with `children` as the unlock CTA.
 */
export function MediaBlock({ media, locked, children, className }) {
  if (!media && !locked) return null;
  if (locked || !media?.url) {
    return (
      <div
        className={cn("relative overflow-hidden rounded-xl border border-border bg-surface-card", className)}
        style={{ aspectRatio: media ? ratio(media) : "16 / 9", ...(media?.color ? { backgroundColor: media.color } : {}) }}
      >
        {media?.miniThumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.miniThumbnailUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl" />
        ) : null}
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur">
            <Lock className="h-5 w-5" />
          </span>
          {children}
        </div>
      </div>
    );
  }

  if (media.type === "video") {
    return (
      <video
        controls
        preload="metadata"
        playsInline
        poster={media.thumbnailUrl || undefined}
        src={media.url}
        className={cn("w-full rounded-xl border border-border bg-black", className)}
        style={{ aspectRatio: ratio(media) }}
      />
    );
  }
  if (media.type === "audio") {
    return <audio controls src={media.url} className={cn("w-full", className)} />;
  }
  if (media.type === "image" && media.thumbnailUrl) {
    return (
      <a href={media.url} target="_blank" rel="noreferrer" className={cn("block overflow-hidden rounded-xl border border-border", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media.thumbnailUrl} alt="" loading="lazy" className="w-full object-cover" style={{ aspectRatio: ratio(media) }} />
      </a>
    );
  }
  return (
    <a
      href={`${media.url}&download=1`}
      className={cn("flex items-center gap-3 rounded-xl border border-border bg-surface-card p-4 text-sm text-foreground hover:bg-surface-hover", className)}
    >
      <FileText className="h-5 w-5 text-text-secondary" />
      <span className="flex-1">Attachment</span>
      <Download className="h-4 w-4 text-text-secondary" />
    </a>
  );
}

/** Several media items, one at a time, with arrows and a position counter. */
function MediaCarousel({ items }) {
  const [index, setIndex] = useState(0);
  const current = items[Math.min(index, items.length - 1)];
  if (items.length < 2) return <MediaBlock media={current} />;
  const go = (dir) => setIndex((i) => (i + dir + items.length) % items.length);
  return (
    <div className="relative">
      <MediaBlock key={index} media={current} />
      <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] tabular-nums text-white">
        {index + 1} / {items.length}
      </span>
      {[-1, 1].map((dir) => (
        <button
          key={dir}
          type="button"
          aria-label={dir < 0 ? "Previous" : "Next"}
          onClick={() => go(dir)}
          className={cn(
            "absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75",
            dir < 0 ? "left-3" : "right-3",
          )}
        >
          {dir < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
      ))}
    </div>
  );
}

function lockCopy(post, tierById) {
  if (post.locked === "ppv") return { title: `Unlock for ${formatMoney(post.priceCents, post.currency)}`, action: "Unlock" };
  if (post.locked === "tier") {
    const tier = tierById.get(post.minTierId);
    return { title: tier ? `For ${tier.name} members and above` : "For higher tiers", action: tier ? `Join ${tier.name}` : "See tiers" };
  }
  return { title: "For members only", action: "Join to unlock" };
}

function Comments({ post, handle, viewer, accent, engage, onCount }) {
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    let alive = true;
    postJson(`/api/creator/${encodeURIComponent(handle)}`, { action: "comments", postId: post.id }).then((r) => {
      if (alive) setComments(r.comments || []);
    });
    return () => {
      alive = false;
    };
  }, [handle, post.id]);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const result = await engage("comment", { postId: post.id, body: text });
    setBusy(false);
    if (result?.comment) {
      setComments((list) => [...(list || []), result.comment]);
      setText("");
      onCount(result.count);
    }
  };

  const remove = async (comment) => {
    const result = await engage("delete_comment", { commentId: comment.id });
    if (result?.ok) {
      setComments((list) => list.filter((c) => c.id !== comment.id));
      onCount(result.count);
    }
  };

  return (
    <div className="space-y-3 border-t border-border px-4 py-3">
      {comments === null ? (
        <Loader2 className="mx-auto h-4 w-4 animate-spin text-text-tertiary" />
      ) : comments.length ? (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="group flex gap-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-text-tertiary">
                  <span className={cn("font-medium", c.isCreator ? "text-foreground" : "text-text-secondary")}>{c.authorName}</span>
                  {c.isCreator ? <span className="ml-1 rounded px-1 text-[10px] font-semibold" style={accent}>Creator</span> : null}
                  <span> · {timeAgo(c.createdAt)}</span>
                </p>
                <p className="whitespace-pre-line text-foreground">{c.body}</p>
              </div>
              {c.mine ? (
                <button type="button" aria-label="Delete comment" onClick={() => remove(c)} className="self-start rounded p-1 text-text-tertiary opacity-0 hover:text-foreground group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-xs text-text-tertiary">No comments yet — be the first.</p>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={viewer.fan ? "Add a comment…" : "Sign in to comment"}
          className="min-h-10 resize-none bg-surface-card"
        />
        <Button size="icon" aria-label="Post comment" className="h-10 w-10 shrink-0 hover:opacity-90" style={accent} disabled={busy || !text.trim()} onClick={submit}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function PostCard({ post, creator, viewer, tierById, engage, onUnlock, onJoin, onTip }) {
  const { profile, avatar } = creator;
  const copy = post.locked ? lockCopy(post, tierById) : null;
  const accent = accentStyle(profile.accentColor);
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saved, setSaved] = useState(post.bookmarked);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [showComments, setShowComments] = useState(false);

  const like = async () => {
    setLiked(!liked);
    setLikeCount((n) => n + (liked ? -1 : 1));
    const result = await engage("like", { postId: post.id });
    if (result?.ok) {
      setLiked(result.on);
      setLikeCount(result.count);
    } else {
      setLiked(liked);
      setLikeCount(post.likeCount);
    }
  };

  const bookmark = async () => {
    setSaved(!saved);
    const result = await engage("bookmark", { postId: post.id });
    if (result?.ok) setSaved(result.on);
    else setSaved(saved);
  };

  const cta = post.locked ? (
    <>
      <p className="text-sm font-medium">{copy.title}</p>
      {post.mediaCount > 1 ? (
        <p className="inline-flex items-center gap-1 text-xs text-white/80">
          <Images className="h-3.5 w-3.5" />
          {post.mediaCount} items inside
        </p>
      ) : null}
      <Button
        size="sm"
        className="hover:opacity-90"
        style={accent}
        onClick={() => (post.locked === "ppv" ? onUnlock(post) : onJoin(post.locked === "tier" ? post.minTierId : null))}
      >
        {copy.action}
      </Button>
    </>
  ) : null;

  return (
    <article className="cp-card overflow-hidden">
      <header className="flex items-center gap-3 px-4 pt-4">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-surface-card">
          {avatar?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{profile.displayName}</p>
          <p className="truncate text-xs text-text-tertiary">
            @{profile.handle} · {timeAgo(post.publishedAt)}
          </p>
        </div>
        {post.isPinned ? <Pin className="h-4 w-4 text-text-tertiary" aria-label="Pinned" /> : null}
        {post.visibility !== "public" ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-text-secondary">
            {post.visibility === "tier" ? tierById.get(post.minTierId)?.name || "Tier" : VISIBILITY_LABEL[post.visibility]}
          </span>
        ) : null}
      </header>

      <div className="space-y-3 px-4 py-3">
        {post.title ? <h3 className="text-base font-semibold text-foreground">{post.title}</h3> : null}
        {post.teaser ? <p className="whitespace-pre-line text-sm text-text-secondary">{post.teaser}</p> : null}
        {!post.locked && post.body ? <p className="whitespace-pre-line text-sm text-foreground">{post.body}</p> : null}
      </div>

      {post.locked ? (
        <div className="px-4">
          <MediaBlock media={post.media[0]} locked>
            {cta}
          </MediaBlock>
        </div>
      ) : post.media.length ? (
        <div className="px-4">
          <MediaCarousel items={post.media} />
        </div>
      ) : null}

      <footer className="flex items-center gap-1 px-2 py-2 text-xs text-text-secondary">
        <Button variant="ghost" size="sm" aria-pressed={liked} className="h-8 hover:bg-surface-active hover:text-foreground" onClick={like}>
          <Heart className={cn("h-4 w-4", liked && "fill-current")} style={liked ? { color: profile.accentColor } : undefined} />
          <span className="tabular-nums">{likeCount || ""}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 hover:bg-surface-active hover:text-foreground"
          disabled={Boolean(post.locked)}
          onClick={() => setShowComments((v) => !v)}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="tabular-nums">{commentCount || ""}</span>
        </Button>
        {profile.tipsEnabled ? (
          <Button variant="ghost" size="sm" className="h-8 hover:bg-surface-active hover:text-foreground" onClick={() => onTip(post)}>
            <HandCoins className="h-4 w-4" />
            Tip
          </Button>
        ) : null}
        <span className="ml-auto pr-1 text-text-tertiary">{post.visibility === "ppv" && post.unlockCount ? `${post.unlockCount} unlocked` : ""}</span>
        <Button variant="ghost" size="icon-sm" aria-label={saved ? "Remove bookmark" : "Bookmark"} aria-pressed={saved} className="h-8 w-8 hover:bg-surface-active hover:text-foreground" onClick={bookmark}>
          <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
        </Button>
      </footer>

      {showComments && !post.locked ? (
        <Comments post={post} handle={profile.handle} viewer={viewer} accent={accent} engage={engage} onCount={setCommentCount} />
      ) : null}
    </article>
  );
}
