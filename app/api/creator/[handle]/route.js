import { NextResponse } from "next/server";

import { currentFan } from "@/lib/creator/fan_auth";
import {
  clientViewer,
  creatorDb,
  joinTier,
  loadCreator,
  loadInbox,
  loadViewer,
  previewPromo,
  setCancelAtPeriodEnd,
  setFollow,
  startPayment,
} from "@/lib/creator/server";
import { addComment, deleteComment, listComments, markThreadRead, sendFanMessage, toggleBookmark, toggleLike } from "@/lib/creator/engagement";

export const runtime = "nodejs";

/**
 * A fan acting on a creator page. `action`:
 *   join           { tierId, cycle?, promoCode? } free tier / trial / promo, else checkout
 *   checkout       { kind, tierId?, cycle?, promoCode?, targetId?, targetType?, amountCents?, note? }
 *   promo          { code, tierId?, cycle? }      check a promo code (readable without signing in)
 *   follow|unfollow                               the free follow rung
 *   cancel         { reason?, note? }  resume     cancel-at-period-end toggle
 *   like|bookmark  { postId }                     toggles
 *   comments       { postId }                     list (readable without signing in)
 *   comment        { postId, body }  delete_comment { commentId }
 *   inbox                                         the fan's thread (marks it read)
 *   message        { body }                       fan -> creator DM
 * Responds with the action's result, { url } to send the fan to checkout, or { error }.
 */
export async function POST(request, { params }) {
  const { handle } = await params;
  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const db = await creatorDb();
  const creator = await loadCreator(db, handle);
  if (!creator) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const fan = await currentFan(db);
  const viewer = await loadViewer(db, creator.profile, fan);

  if (body.action === "comments") {
    const result = await listComments(db, creator, viewer, body.postId);
    return NextResponse.json(result, { status: result.error ? 400 : 200 });
  }
  if (body.action === "promo") {
    const result = await previewPromo(db, creator, fan, { code: body.code, tierId: body.tierId, cycle: body.cycle });
    return NextResponse.json(result, { status: result.error ? 400 : 200 });
  }
  if (!fan) return NextResponse.json({ error: "Sign in first.", signIn: true }, { status: 401 });

  const origin = new URL(request.url).origin;
  let result;
  switch (body.action) {
    case "join": {
      const cycle = body.cycle === "year" ? "year" : "month";
      result = await joinTier(db, creator, fan, body.tierId, { promoCode: body.promoCode, skipTrial: cycle === "year" });
      if (result.needsPayment) {
        result = await startPayment(db, creator, fan, { kind: "subscription", tierId: body.tierId, cycle, promoCode: body.promoCode }, origin);
      }
      break;
    }
    case "follow":
    case "unfollow":
      result = await setFollow(db, creator, fan, body.action === "follow");
      break;
    case "checkout":
      result = await startPayment(db, creator, fan, body, origin);
      break;
    case "cancel":
    case "resume":
      result = (await setCancelAtPeriodEnd(db, creator, fan, body.action === "cancel", { reason: body.reason, note: body.note }))
        ? { ok: true }
        : { error: "No active membership." };
      break;
    case "like":
      result = await toggleLike(db, creator, viewer, body.postId);
      break;
    case "bookmark":
      result = await toggleBookmark(db, creator, viewer, body.postId);
      break;
    case "comment":
      result = await addComment(db, creator, viewer, body.postId, body.body);
      break;
    case "delete_comment":
      result = await deleteComment(db, creator, viewer, body.commentId);
      break;
    case "inbox":
      if (!creator.profile.messagesEnabled) {
        result = { error: "Messages are off." };
        break;
      }
      result = { messages: await loadInbox(db, creator, viewer) };
      await markThreadRead(db, creator, viewer);
      break;
    case "message":
      result = await sendFanMessage(db, creator, viewer, body.body);
      break;
    case "viewer":
      result = { viewer: clientViewer(viewer) };
      break;
    default:
      result = { error: "Unknown action." };
  }
  return NextResponse.json(result, { status: result.error ? 400 : 200 });
}
