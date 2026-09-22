import { randomBytes } from "node:crypto";
import { requireApiKey, countUsage } from "@/lib/api/auth";
import { apiError, ok, normalizeAssetRow } from "@/lib/api/respond";
import { mergeSteps, normalizePolicy, parseTransformPath, validatePlan } from "@/lib/image/transform";
import { buildDeliveryUrl } from "@/lib/delivery/signing";

export const runtime = "nodejs";

const DEFAULT_TRANSFORMS = "w_800,c_fill,f_auto,q_auto";

function filenameFor(row) {
  const fallback = row.original_filename || row.name || "image.jpg";
  return String(fallback).split("/").pop() || "image.jpg";
}

async function loadAsset(supabase, projectId, id) {
  const { data, error } = await supabase
    .schema("assets")
    .from("assets")
    .select("*")
    .eq("id", id)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[v1.delivery.asset]", error.message);
    return null;
  }
  return data;
}

async function loadPolicy(supabase, projectId) {
  const { data, error } = await supabase
    .schema("assets")
    .from("delivery_settings")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) {
    console.error("[v1.delivery.policy]", error.message);
    return normalizePolicy(null);
  }
  return normalizePolicy(data);
}

// GET — delivery status for an asset.
export async function GET(request, { params }) {
  const auth = await requireApiKey(request, "delivery:read");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;
  const { id } = await params;

  const row = await loadAsset(supabase, key.projectId, id);
  if (!row) return apiError("not_found", "Asset not found.", 404);
  const policy = await loadPolicy(supabase, key.projectId);
  const canonical = DEFAULT_TRANSFORMS;
  const filename = filenameFor(row);
  return ok({
    assetId: row.id,
    deliveryEnabled: Boolean(row.delivery_enabled),
    deliveryUrl: row.delivery_enabled ? `/d/${key.projectId}/${row.id}/${canonical}/${filename}` : null,
    signingRequired: policy.requireSignedUrls,
  });
}

// PATCH — enable or disable delivery for an asset.
export async function PATCH(request, { params }) {
  const auth = await requireApiKey(request, "delivery:write");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", "Request body must be JSON.", 400);
  }
  if (typeof body?.deliveryEnabled !== "boolean") {
    return apiError("bad_request", "deliveryEnabled (boolean) is required.", 400);
  }

  const { data, error } = await supabase
    .schema("assets")
    .from("assets")
    .update({ delivery_enabled: body.deliveryEnabled })
    .eq("id", id)
    .eq("project_id", key.projectId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[v1.delivery.patch]", error.message);
    return apiError("write_failed", "Could not update delivery.", 500);
  }
  if (!data) return apiError("not_found", "Asset not found.", 404);
  countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/delivery/[id]", method: "PATCH", status: 200, assetId: id }).catch(() => {});
  return ok(normalizeAssetRow(data));
}

// POST — mint a canonical (optionally signed) delivery URL.
export async function POST(request, { params }) {
  const auth = await requireApiKey(request, "delivery:read");
  if (auth.response) return auth.response;
  const { key, supabase } = auth;
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", "Request body must be JSON.", 400);
  }
  const transforms = String(body?.transforms || DEFAULT_TRANSFORMS);
  const segments = transforms.split("/").map((s) => s.trim()).filter(Boolean);

  let plan;
  try {
    plan = mergeSteps(parseTransformPath(segments));
  } catch {
    return apiError("bad_transform", "Transform string could not be parsed.", 400);
  }
  const policy = await loadPolicy(supabase, key.projectId);
  const policyError = validatePlan(plan, policy);
  if (policyError) return apiError("transform_rejected", policyError, 400);

  const row = await loadAsset(supabase, key.projectId, id);
  if (!row) return apiError("not_found", "Asset not found.", 404);
  if (!row.delivery_enabled) return apiError("delivery_disabled", "Delivery is not enabled for this asset.", 403);

  const canonical = segments.join("/");
  const filename = body?.filename ? String(body.filename).split("/").pop() : filenameFor(row);

  let secret = null;
  if (policy.requireSignedUrls) {
    const { data } = await supabase
      .schema("assets")
      .from("delivery_settings")
      .select("id, signing_secret")
      .eq("project_id", key.projectId)
      .maybeSingle();
    secret = data?.signing_secret || null;
    if (!secret) {
      secret = randomBytes(32).toString("hex");
      await supabase.schema("assets").from("delivery_settings").upsert(
        { id: data?.id, project_id: key.projectId, signing_secret: secret },
        { onConflict: "project_id" },
      );
    }
  }

  const url = buildDeliveryUrl({ projectId: key.projectId, assetId: id, canonical, filename, secret });
  countUsage({ supabase, projectId: key.projectId, keyId: key.id, route: "/api/v1/delivery/[id]", method: "POST", status: 201, assetId: id, transforms: 0, kind: "delivery" }).catch(() => {});
  return ok({ url, canonical, filename, signingRequired: policy.requireSignedUrls, expiresAt: null }, { status: 201 });
}
