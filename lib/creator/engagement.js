if (typeof window !== "undefined") {
  throw new Error("lib/creator/engagement is server-only.");
}

// Fan engagement on a creator page: likes, bookmarks, comments and fan -> creator
// messages. Every action re-checks access with the same rules as the feed, so a
// fan can't comment on (or read comments of) a post they can't see.

import { queueWorkflowEvent } from "@/lib/workflows/server";
import { ensureMember, lockReason } from "./server";

const MAX_COMMENT = 1000;
const MAX_MESSAGE = 2000;

async function loadPost(db, creator, postId) {
  if (!postId) return null;
  const { data } = await db
    .from("ppv_posts")
    .select("*")
    .eq("id", postId)
    .eq("project_id", creator.profile.projectId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

async function recount(db, table, column, postId) {
  let q = db.from(table).select("id", { count: "exact", head: true }).eq("post_id", postId);
  if (table === "post_comments") q = q.is("deleted_at", null).eq("is_hidden", false);
  const { count } = await q;
  await db.from("ppv_posts").update({ [column]: count || 0 }).eq("id", postId);
  return count || 0;
}

async function toggle(db, creator, viewer, postId, table, column) {
  const post = await loadPost(db, creator, postId);
  if (!post) return { error: "Post not found." };
  const fanId = viewer.fan.id;
  const { data: existing } = await db.from(table).select("id").eq("post_id", postId).eq("fan_account_id", fanId).maybeSingle();
  if (existing) await db.from(table).delete().eq("id", existing.id);
  else await db.from(table).insert({ project_id: creator.profile.projectId, post_id: postId, fan_account_id: fanId });
  const count = column ? await recount(db, table, column, postId) : undefined;
  return { ok: true, on: !existing, count };
}

export const toggleLike = (db, creator, viewer, postId) => toggle(db, creator, viewer, postId, "post_likes", "like_count");
export const toggleBookmark = (db, creator, viewer, postId) => toggle(db, creator, viewer, postId, "post_bookmarks", null);

function shapeComment(row, fanId) {
  return {
    id: row.id,
    authorName: row.author_name || "Member",
    isCreator: Boolean(row.is_creator),
    body: row.body ?? "",
    createdAt: row.created_at,
    mine: Boolean(fanId && row.fan_account_id === fanId),
  };
}

export async function listComments(db, creator, viewer, postId) {
  const post = await loadPost(db, creator, postId);
  if (!post) return { error: "Post not found." };
  if (lockReason(post, viewer, creator.tiers)) return { error: "Unlock this post to see comments." };
  const { data, error } = await db
    .from("post_comments")
    .select("*")
    .eq("post_id", postId)
    .eq("is_hidden", false)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return { error: "Couldn't load comments." };
  return { comments: (data || []).map((row) => shapeComment(row, viewer.fan?.id)) };
}

export async function addComment(db, creator, viewer, postId, body) {
  const text = String(body || "").trim().slice(0, MAX_COMMENT);
  if (!text) return { error: "Write something first." };
  if (viewer.blocked) return { error: "This account can't comment here." };
  const post = await loadPost(db, creator, postId);
  if (!post) return { error: "Post not found." };
  if (lockReason(post, viewer, creator.tiers)) return { error: "Unlock this post to comment." };
  const member = await ensureMember(db, creator.profile, viewer.fan);
  const { data, error } = await db
    .from("post_comments")
    .insert({
      project_id: creator.profile.projectId,
      post_id: postId,
      fan_account_id: viewer.fan.id,
      member_id: member?.id ?? null,
      author_name: viewer.fan.displayName,
      body: text,
    })
    .select("*")
    .single();
  if (error) return { error: "Couldn't post your comment." };
  const count = await recount(db, "post_comments", "comment_count", postId);
  return { comment: shapeComment(data, viewer.fan.id), count };
}

export async function deleteComment(db, creator, viewer, commentId) {
  const { data: row } = await db
    .from("post_comments")
    .select("*")
    .eq("id", commentId)
    .eq("project_id", creator.profile.projectId)
    .maybeSingle();
  if (!row || row.fan_account_id !== viewer.fan.id) return { error: "Comment not found." };
  await db.from("post_comments").update({ deleted_at: new Date().toISOString() }).eq("id", commentId);
  const count = await recount(db, "post_comments", "comment_count", row.post_id);
  return { ok: true, count };
}

/** A fan's reply in their thread with the creator. Members only. */
export async function sendFanMessage(db, creator, viewer, body) {
  const text = String(body || "").trim().slice(0, MAX_MESSAGE);
  if (!text) return { error: "Write a message first." };
  if (!creator.profile.messagesEnabled) return { error: "Messaging is turned off." };
  if (!viewer.member) return { error: "Join to message this creator." };
  if (viewer.blocked) return { error: "This account can't send messages here." };
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("paid_messages")
    .insert({
      project_id: creator.profile.projectId,
      member_id: viewer.member.id,
      body: text,
      direction: "inbound",
      status: "unlocked",
      price_cents: 0,
      sent_at: now,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[creator.sendFanMessage]", error.message);
    return { error: "Couldn't send your message." };
  }
  await db.from("members").update({ last_seen_at: now }).eq("id", viewer.member.id);
  queueWorkflowEvent(
    { type: "membership.messaged", projectId: creator.profile.projectId, context: { memberId: viewer.member.id, memberName: viewer.fan.displayName, memberEmail: viewer.fan.email, body: text } },
    db,
  );
  return { ok: true, message: { id: data.id, body: text, sentAt: now, fromFan: true, priceCents: 0, locked: false, media: null } };
}

/** The fan opened their inbox: the creator's messages to them are now read. */
export async function markThreadRead(db, creator, viewer) {
  if (!viewer.member) return;
  await db
    .from("paid_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("member_id", viewer.member.id)
    .eq("direction", "outbound")
    .is("read_at", null);
}
