import { NextResponse } from "next/server";

import { requireProjectAccess } from "@/lib/storage/auth";
import {
  cancelOrder,
  commerceDb,
  completeOrder,
  refulfillOrder,
  refundOrder,
} from "@/lib/commerce/server";
import { loadOrderBundle } from "@/lib/commerce/fulfillment";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (value, max) => (value ? String(value).slice(0, max) : "");

/**
 * Staff actions that move money or fulfil an order, run server-side so they
 * share the checkout core with the webhook: mark_paid (manual / invoice
 * payment), refund, cancel, fulfill (re-run fulfilment, optionally marking
 * prints shipped). Requires edit access to the order's project.
 */
export async function POST(request, { params }) {
  const { id } = await params;
  if (!UUID_RE.test(String(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const db = await commerceDb();
  const bundle = await loadOrderBundle(db, id);
  if (!bundle) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const access = await requireProjectAccess({ projectId: bundle.order.projectId, action: "write" });
  if (access.response) return access.response;
  const actor = text(body.actor, 120) || "Staff";

  let result;
  switch (body.action) {
    case "mark_paid": {
      const reference = text(body.reference, 120);
      const done = await completeOrder(db, id, {
        provider: bundle.order.provider === "stripe" ? "stripe" : "manual",
        providerRef: reference || undefined,
        actor,
        note: reference ? `Marked paid — ref ${reference}` : "Marked paid by staff",
      });
      result = done ? { bundle: done } : { error: "failed" };
      break;
    }
    case "refund":
      result = await refundOrder(db, id, {
        amountCents: body.amountCents,
        reason: text(body.reason, 300),
        revokeAccess: body.revokeAccess !== false,
        terminateLicenses: Boolean(body.terminateLicenses),
        actor,
      });
      break;
    case "cancel":
      result = await cancelOrder(db, id, { actor, reason: text(body.reason, 300) });
      break;
    case "fulfill": {
      const done = await refulfillOrder(db, id, { actor, markPrintsShipped: Boolean(body.markPrintsShipped) });
      result = done ? { bundle: done } : { error: "failed" };
      break;
    }
    default:
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  if (result.error) return NextResponse.json({ error: result.error }, { status: 409 });
  const { data: order } = await db.from("store_orders").select("*").eq("id", id).maybeSingle();
  return NextResponse.json({ order });
}
