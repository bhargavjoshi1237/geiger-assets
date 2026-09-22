import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStorageConfigured } from "@/lib/storage/service";
import { backendForRef, refFromAssetRow, writeBackend } from "@/lib/storage/backends/index.js";
import { Readable } from "node:stream";
import {
  canonicalFor,
  checkReferrer,
  derivativeKeyFor,
  mergeSteps,
  normalizePolicy,
  parseTransformPath,
  queryToCanonical,
  resolveFormat,
  resolveQuality,
  runTransform,
  splitRest,
  validatePlan,
} from "@/lib/image/transform";
import { verifyDeliverySignature } from "@/lib/delivery/signing";

export const runtime = "nodejs";

const IMMUTABLE = "public, max-age=31536000, immutable";
// Originals change with new versions, so they are deliberately not immutable.
// This also has to stay well under S3_SIGNED_URL_TTL so a cached redirect can
// never outlive the signed URL it points at.
const ORIGINAL_CACHE = "public, max-age=300";

async function streamToBuffer(body) {
  if (!body) return null;
  if (typeof body.arrayBuffer === "function") return Buffer.from(await body.arrayBuffer());
  if (typeof body.getReader === "function") {
    const reader = body.getReader();
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }
  if (typeof body[Symbol.asyncIterator] === "function") {
    const chunks = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  return null;
}

async function loadAsset(id) {
  try {
    const sb = await createServerSupabase();
    const { data, error } = await sb
      .schema("assets")
      .from("assets")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[delivery.asset]", error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.error("[delivery.asset]", e?.message || e);
    return null;
  }
}

async function loadPolicy(projectId) {
  try {
    const sb = await createServerSupabase();
    const { data, error } = await sb
      .schema("assets")
      .from("delivery_settings")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) {
      console.error("[delivery.policy]", error.message);
      return null;
    }
    return normalizePolicy(data);
  } catch (e) {
    console.error("[delivery.policy]", e?.message || e);
    return null;
  }
}

async function monthTransforms(projectId) {
  try {
    const sb = await createServerSupabase();
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const { data, error } = await sb
      .schema("assets")
      .from("api_usage")
      .select("transforms")
      .eq("project_id", projectId)
      .gte("created_at", start.toISOString());
    if (error) return 0;
    return (data || []).reduce((n, r) => n + (Number(r.transforms) || 0), 0);
  } catch {
    return 0;
  }
}

async function recordDelivery({ projectId, assetId, transforms, route }) {
  try {
    const sb = await createServerSupabase();
    await sb.schema("assets").from("api_usage").insert({
      project_id: projectId,
      asset_id: assetId,
      route: String(route || "").slice(0, 200),
      method: "GET",
      status: 200,
      kind: "delivery",
      transforms: Number(transforms) || 0,
    });
  } catch (e) {
    console.error("[delivery.usage]", e?.message || e);
  }
}

export async function GET(request, { params }) {
  const { projectId, assetId, rest } = await params;
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }

  const { segments, filename } = splitRest(rest);
  const url = new URL(request.url);

  // Query form is accepted and 308-redirects to the canonical path form.
  if (!segments.length) {
    const canonical = queryToCanonical(url.searchParams);
    if (canonical) {
      const sig = url.searchParams.get("sig");
      const dest = `/d/${projectId}/${assetId}/${canonical}/${filename}${sig ? `?sig=${encodeURIComponent(sig)}` : ""}`;
      return NextResponse.redirect(new URL(dest, request.url), { status: 308 });
    }
  }

  const asset = await loadAsset(assetId);
  // A disabled (or missing, or foreign-project) asset 404s.
  if (!asset || asset.project_id !== projectId || !asset.delivery_enabled || !asset.storage_key) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const policy = (await loadPolicy(projectId)) || normalizePolicy(null);

  const referrerError = checkReferrer(request, policy);
  if (referrerError) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const canonical = canonicalFor(assetId, segments);
  const sig = url.searchParams.get("sig");
  if (policy.requireSignedUrls) {
    let secret = null;
    try {
      const sb = await createServerSupabase();
      const { data } = await sb
        .schema("assets")
        .from("delivery_settings")
        .select("signing_secret")
        .eq("project_id", projectId)
        .maybeSingle();
      secret = data?.signing_secret || null;
    } catch {
      secret = null;
    }
    if (!verifyDeliverySignature({ projectId, assetId, canonical, filename, secret, signature: sig })) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  // No transforms: hand the bytes off to the backend the same way a transform
  // cache hit does. The redirect costs no egress here, and for the pool it
  // points at the gateway, which keeps the link stable when an object moves
  // between providers. Proxying is only the fallback for a backend that can't
  // produce a read URL — it pulls the whole object through this function.
  if (!segments.length) {
    const ref = refFromAssetRow(asset) || { backend: "s3", key: asset.storage_key };
    const backend = backendForRef(ref);
    const signed = await backend.signRead(ref);
    if (signed) {
      return NextResponse.redirect(signed, {
        status: 307,
        headers: { "Cache-Control": ORIGINAL_CACHE },
      });
    }
    const range = request.headers.get("range") || null;
    if (range) {
      const ranged = await backend.getStream(ref, { range });
      if (ranged?.stream && ranged.status === 206) {
        let body = ranged.stream;
        if (typeof body.getReader !== "function") {
          try {
            body = Readable.toWeb(body);
          } catch {
            body = null;
          }
        }
        if (body) {
          return new Response(body, {
            status: 206,
            headers: {
              "Content-Type": ranged.contentType || asset.mime_type || "application/octet-stream",
              ...(ranged.size != null ? { "Content-Length": String(ranged.size) } : {}),
              ...(ranged.contentRange ? { "Content-Range": ranged.contentRange } : {}),
              "Accept-Ranges": "bytes",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      }
    }
    const got = await backend.getStream(ref);
    const bytes = await streamToBuffer(got?.stream);
    if (!bytes) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return new Response(bytes, {
      headers: {
        "Content-Type": got.contentType || asset.mime_type || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  let steps;
  try {
    steps = parseTransformPath(segments);
  } catch (e) {
    return NextResponse.json({ error: "bad_transform" }, { status: 400 });
  }
  const plan = mergeSteps(steps);
  const policyError = validatePlan(plan, policy);
  if (policyError) return NextResponse.json({ error: "transform_rejected" }, { status: 400 });

  if (policy.monthlyTransformBudget > 0) {
    const used = await monthTransforms(projectId);
    if (used >= policy.monthlyTransformBudget) {
      return NextResponse.json({ error: "transform_budget_exceeded" }, { status: 429 });
    }
  }

  const format = resolveFormat(plan, request.headers.get("accept"));
  const quality = resolveQuality(plan);
  const cacheInput = `${canonical}::f_${format}::q_${quality}`;
  const key = derivativeKeyFor(assetId, cacheInput, format);

  // Cache hit: redirect to the stored derivative, like the storage file route.
  // Derivatives are cache objects without asset rows: they are checked and
  // written on the write backend, never resolved from the original's row.
  const writeBe = writeBackend();
  const derivRef = { backend: writeBe.id, key };
  const hit = await writeBe.head(derivRef);
  if (hit) {
    const signed = await writeBe.signRead({ ...derivRef, ...(hit.fileId ? { fileId: hit.fileId } : {}) });
    if (signed) {
      return NextResponse.redirect(signed, {
        status: 307,
        headers: { "Cache-Control": IMMUTABLE },
      });
    }
  }

  const originalRef = refFromAssetRow(asset) || { backend: "s3", key: asset.storage_key };
  const original = await backendForRef(originalRef).getStream(originalRef);
  const source = await streamToBuffer(original?.stream);
  if (!source) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let result;
  try {
    result = await runTransform(source, plan, {
      accept: request.headers.get("accept"),
      loadOverlay: async (overlayId) => {
        const overlay = await loadAsset(overlayId);
        if (!overlay?.storage_key || overlay.project_id !== projectId) return null;
        const overlayRef = refFromAssetRow(overlay) || { backend: "s3", key: overlay.storage_key };
        const gotOverlay = await backendForRef(overlayRef).getStream(overlayRef);
        return streamToBuffer(gotOverlay?.stream);
      },
    });
  } catch (e) {
    console.error("[delivery.transform]", e?.message || e);
    return NextResponse.json({ error: "transform_failed" }, { status: 500 });
  }

  await writeBe.put({ key, body: result.bytes, contentType: result.contentType });
  recordDelivery({ projectId, assetId, transforms: result.transforms, route: `/d/${canonical}` }).catch(() => {});

  return new Response(result.bytes, {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": IMMUTABLE,
    },
  });
}
