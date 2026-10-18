// Workflow engine — executes assets.workflows against asset lifecycle events.
//
// An event `{ type, projectId, assetId?, assetIds?, orderId?, collectionId?, context? }`
// is matched against every Active workflow in the project whose `trigger`
// equals `type` and whose scope covers the event (workspace-wide, or the one
// collection it is attached to). Each match walks its `steps` in order:
// conditions gate the run, actions write straight to the assets schema, and
// every run lands in assets.workflow_runs with a per-step log. Step types the
// engine doesn't know are resolved through ./abilities (commerce today).
//
// Isomorphic on purpose: the caller hands in a schema-scoped client
// (`sb.schema("assets")`), so the same code runs on the server (dispatch
// route, upload commit, tick) and against the in-memory playground DB.
// Actions write directly rather than through lib/supabase/*, so a workflow's
// own writes never re-emit events and can't loop.

import { isUuid } from "@/supabase/components/assets-client";
import {
  AbilitySkip,
  abilityAction,
  abilityCondition,
  abilityContext,
  abilityPayload,
  loadAbilitySubjects,
} from "./abilities";

const WORKFLOWS = "workflows";
const RUNS = "workflow_runs";

const MB = 1024 * 1024;
const WAIT_UNIT_MS = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 };
const WEBHOOK_TIMEOUT_MS = 10_000;

const ASSET_STATUSES = new Set(["draft", "review", "approved", "archived", "processing"]);

// Condition "Asset type" labels → assets.type values.
const TYPE_GROUPS = {
  Image: ["image"],
  Video: ["video"],
  Audio: ["audio"],
  Document: ["document", "pdf"],
  "3D model": ["3d"],
  "Design source": ["raw"],
};

// Columns field.update may write directly; anything else goes to metadata,
// except keys that would shadow a first-class field once normalizeAsset
// spreads the bag.
const FIELD_COLUMNS = new Set(["name", "description", "folder", "color"]);
const RESERVED_FIELDS = new Set([
  "id", "projectId", "project_id", "type", "format", "sizeBytes", "size_bytes",
  "status", "tags", "storageKey", "storage_key", "createdBy", "created_by",
  "createdAt", "created_at", "updatedAt", "updated_at", "deletedAt", "deleted_at",
]);

class StepSkip extends Error {}

function mbOf(bytes) {
  const n = Number(bytes) || 0;
  return n >= MB ? `${(n / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

function assetContext(asset) {
  if (!asset) return {};
  return {
    asset: asset.name || "",
    type: asset.type || "",
    size: asset.size_bytes ? mbOf(asset.size_bytes) : "",
    folder: asset.folder && asset.folder !== "root" ? asset.folder : "",
  };
}

async function loadAsset(db, id) {
  if (!id || !isUuid(id)) return null;
  const { data, error } = await db
    .from("assets")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[workflows.engine.asset]", error.message);
    return null;
  }
  return data || null;
}

async function patchAsset(db, asset, patch) {
  const { data, error } = await db
    .from("assets")
    .update(patch)
    .eq("id", asset.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

function requireAsset(asset) {
  if (!asset) throw new StepSkip("No asset in this event");
  return asset;
}

// Conditions -------------------------------------------------------------------

function evaluateCondition(step, run) {
  // Domain abilities (orders, customers…) test their own subjects.
  const ability = abilityCondition(step.type);
  if (ability) return ability(step, run);

  const asset = run.asset;
  const config = step.config || {};
  if (!asset) return { pass: false, note: "No asset in this event to test" };
  const tags = Array.isArray(asset.tags) ? asset.tags : [];

  switch (step.type) {
    case "if.asset_type": {
      const types = TYPE_GROUPS[config.assetType] || [String(config.assetType || "").toLowerCase()];
      const pass = types.includes(asset.type);
      return { pass, note: pass ? "" : `Asset is ${asset.type}, not ${config.assetType}` };
    }
    case "if.file_size": {
      const limit = Number(config.sizeMb);
      if (!Number.isFinite(limit)) return { pass: false, note: "Size isn't a number" };
      const size = (Number(asset.size_bytes) || 0) / MB;
      const op = config.operator || "greater than";
      const pass =
        op === "less than" ? size < limit : op === "equal to" ? Math.round(size) === Math.round(limit) : size > limit;
      return { pass, note: pass ? "" : `Asset is ${size.toFixed(1)} MB` };
    }
    case "if.has_tag": {
      const want = String(config.tag || "").trim().toLowerCase();
      if (!want) return { pass: false, note: "No tag configured" };
      const pass = tags.some((t) => String(t).toLowerCase() === want);
      return { pass, note: pass ? "" : `Asset isn't tagged "${config.tag}"` };
    }
    case "if.status": {
      const pass = asset.status === config.status;
      return { pass, note: pass ? "" : `Asset status is ${asset.status}` };
    }
    default:
      return { pass: false, note: `Unknown condition "${step.type}"` };
  }
}

// Actions ----------------------------------------------------------------------

async function resolveFolder(db, projectId, value) {
  const wanted = String(value || "").trim();
  if (!wanted || wanted.toLowerCase() === "root") return "root";
  const { data } = await db
    .from("folders")
    .select("name, path")
    .eq("project_id", projectId)
    .is("deleted_at", null);
  const needle = wanted.replace(/^\/+/, "").toLowerCase();
  const match = (data || []).find(
    (f) =>
      String(f.path || "").replace(/^\/+/, "").toLowerCase() === needle ||
      String(f.name || "").toLowerCase() === needle,
  );
  if (match) return match.path || `/${match.name}`;
  return wanted.startsWith("/") ? wanted : `/${wanted}`;
}

async function logFeed(db, run, verb, summary, extra = {}) {
  const order = run.order?.order;
  const { error } = await db.from("activity_events").insert({
    project_id: run.projectId,
    verb,
    summary,
    subject_type: run.asset ? "asset" : order ? "order" : "workflow",
    subject_id: run.asset?.id || order?.id || run.workflow.id,
    subject_label: run.asset?.name || (order ? `Order ${order.number}` : run.workflow.name),
    actor_id: null,
    actor_name: `Workflow · ${run.workflow.name}`,
    metadata: { workflowId: run.workflow.id, ...extra },
  });
  if (error) throw new Error(error.message);
}

async function requestReview(db, run, config) {
  const asset = requireAsset(run.asset);
  const { data: pipeline } = await db
    .from("approval_pipelines")
    .select("id, stages")
    .eq("project_id", run.projectId)
    .eq("subject_type", "asset")
    .eq("is_default", true)
    .is("deleted_at", null)
    .maybeSingle();

  const { data: review, error } = await db
    .from("approval_reviews")
    .insert({
      project_id: run.projectId,
      pipeline_id: pipeline?.id || null,
      name: `Review: ${asset.name}`,
      subject_type: "asset",
      subject_id: asset.id,
      status: "Pending",
      stage_snapshot: Array.isArray(pipeline?.stages) ? pipeline.stages : [],
      requested_by: run.workflow.created_by || null,
      metadata: { assignee: config.assignee || "", workflowId: run.workflow.id },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: itemError } = await db.from("approval_review_items").insert({
    review_id: review.id,
    asset_id: asset.id,
    subject_type: "asset",
    subject_id: asset.id,
    label: asset.name || "",
    position: 0,
  });
  if (itemError) throw new Error(itemError.message);

  if (asset.status !== "review") run.asset = await patchAsset(db, asset, { status: "review" });
  return config.assignee ? `Review opened for ${config.assignee}` : "Review opened";
}

async function callWebhook(run, config, options) {
  if (!options.allowNetwork) throw new StepSkip("Webhooks don't fire in the playground");
  let url;
  try {
    url = new URL(String(config.url || ""));
  } catch {
    throw new Error("Webhook URL is missing or invalid");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Webhook URL must be http(s)");
  }
  const method = ["GET", "PUT", "POST"].includes(config.method) ? config.method : "POST";
  const payload = {
    event: run.event.type,
    firedAt: new Date().toISOString(),
    workflow: { id: run.workflow.id, name: run.workflow.name },
    projectId: run.projectId,
    asset: run.asset
      ? {
          id: run.asset.id,
          name: run.asset.name,
          type: run.asset.type,
          status: run.asset.status,
          folder: run.asset.folder,
          tags: run.asset.tags || [],
          sizeBytes: Number(run.asset.size_bytes) || 0,
        }
      : null,
    context: run.event.context || {},
    ...abilityPayload(run),
  };
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json", "user-agent": "Geiger-Assets-Workflows/1" },
    body: method === "GET" ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
  return `${method} ${url.host} → ${res.status}`;
}

/** Runs one action step. Returns a note string, or throws StepSkip / Error. */
async function runAction(db, step, run, options) {
  const config = step.config || {};

  switch (step.type) {
    case "asset.move": {
      const asset = requireAsset(run.asset);
      const folder = await resolveFolder(db, run.projectId, config.folder);
      run.asset = await patchAsset(db, asset, { folder });
      return `Moved to ${folder}`;
    }
    case "asset.set_status": {
      const asset = requireAsset(run.asset);
      if (!ASSET_STATUSES.has(config.status)) throw new Error(`Unknown status "${config.status}"`);
      run.asset = await patchAsset(db, asset, { status: config.status });
      return `Status set to ${config.status}`;
    }
    case "tag.add":
    case "tag.remove": {
      const asset = requireAsset(run.asset);
      const tag = String(config.tag || "").trim();
      if (!tag) throw new Error("No tag configured");
      const tags = Array.isArray(asset.tags) ? asset.tags : [];
      const has = tags.some((t) => String(t).toLowerCase() === tag.toLowerCase());
      if (step.type === "tag.add") {
        if (has) return `Already tagged "${tag}"`;
        run.asset = await patchAsset(db, asset, { tags: [...tags, tag] });
        return `Tagged "${tag}"`;
      }
      if (!has) return `Wasn't tagged "${tag}"`;
      run.asset = await patchAsset(db, asset, {
        tags: tags.filter((t) => String(t).toLowerCase() !== tag.toLowerCase()),
      });
      return `Removed "${tag}"`;
    }
    case "field.update": {
      const asset = requireAsset(run.asset);
      const field = String(config.field || "").trim();
      if (!field) throw new Error("No field configured");
      if (FIELD_COLUMNS.has(field)) {
        run.asset = await patchAsset(db, asset, { [field]: String(config.value ?? "") });
      } else if (RESERVED_FIELDS.has(field)) {
        throw new Error(`"${field}" can't be set by a workflow`);
      } else {
        const metadata = asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {};
        run.asset = await patchAsset(db, asset, { metadata: { ...metadata, [field]: config.value ?? "" } });
      }
      return `${field} = ${config.value ?? ""}`;
    }
    case "review.request":
      return requestReview(db, run, config);
    case "asset.publish": {
      const asset = requireAsset(run.asset);
      if (config.channel && config.channel !== "CDN") {
        throw new StepSkip(`No ${config.channel} channel is connected`);
      }
      run.asset = await patchAsset(db, asset, {
        delivery_enabled: true,
        cdn_enabled: true,
        cdn_enabled_at: asset.cdn_enabled_at || new Date().toISOString(),
      });
      return "Published to the CDN";
    }
    case "rendition.generate":
      requireAsset(run.asset);
      throw new StepSkip(`${config.preset || "Preset"} renders on demand from the delivery URL`);
    case "staff.notify": {
      const message = String(config.message || "").trim() || `${run.workflow.name} ran`;
      await logFeed(db, run, "workflow.notify", message, { channel: config.channel || "" });
      return `Posted to ${config.channel || "the activity feed"}`;
    }
    case "task.create": {
      const title = String(config.title || "").trim() || `Follow up: ${run.asset?.name || run.workflow.name}`;
      await logFeed(db, run, "workflow.task", title, { assignee: config.assignee || "" });
      return config.assignee ? `Task for ${config.assignee}` : "Task logged to the activity feed";
    }
    case "send.email":
      throw new StepSkip("Email delivery isn't configured for this workspace");
    case "http.webhook":
      return callWebhook(run, config, options);
    default: {
      const ability = abilityAction(step.type);
      if (!ability) throw new Error(`Unknown action "${step.type}"`);
      return ability(db, step, run, options);
    }
  }
}

// Runs -------------------------------------------------------------------------

function waitMs(config) {
  const amount = Math.max(0, Number(config?.amount) || 0);
  return amount * (WAIT_UNIT_MS[config?.unit] || WAIT_UNIT_MS.hours);
}

/**
 * Walks `steps` from `startIndex`, appending to `log`. Returns the run outcome:
 * `{ status, error, completed, resumeAt? }`.
 */
async function walk(db, run, steps, startIndex, log, options) {
  let completed = log.filter((s) => s.status === "Success").length;

  for (let i = startIndex; i < steps.length; i += 1) {
    const step = steps[i];
    const started = Date.now();
    const entry = { id: step.id, kind: step.kind, type: step.type };

    if (step.kind === "condition") {
      const { pass, note } = evaluateCondition(step, run);
      log.push({ ...entry, status: pass ? "Success" : "Skipped", note, durationMs: Date.now() - started });
      if (!pass) return { status: "Skipped", error: "", completed };
      completed += 1;
      continue;
    }

    if (step.type === "flow.wait") {
      const ms = waitMs(step.config);
      log.push({ ...entry, status: "Success", note: `Wait ${step.config?.amount || 0} ${step.config?.unit || "hours"}`, durationMs: 0 });
      completed += 1;
      if (ms > 0) {
        return { status: "Running", error: "", completed, resumeAt: new Date(Date.now() + ms).toISOString(), resumeStep: i + 1 };
      }
      continue;
    }

    try {
      const note = await runAction(db, step, run, options);
      log.push({ ...entry, status: "Success", note: note || "", durationMs: Date.now() - started });
      completed += 1;
    } catch (e) {
      if (e instanceof StepSkip || e instanceof AbilitySkip) {
        log.push({ ...entry, status: "Skipped", note: e.message, durationMs: Date.now() - started });
        continue;
      }
      const message = e?.message || "Step failed";
      log.push({ ...entry, status: "Failed", error: message, durationMs: Date.now() - started });
      return { status: "Failed", error: message, completed };
    }
  }

  return { status: "Success", error: "", completed };
}

async function persistOutcome(db, runId, startedAt, outcome, log, event) {
  const finished = outcome.status !== "Running";
  const patch = {
    status: outcome.status,
    steps_completed: outcome.completed,
    steps_log: log,
    error: outcome.error || null,
    finished_at: finished ? new Date().toISOString() : null,
    duration_ms: finished ? Math.max(0, Date.now() - new Date(startedAt).getTime()) : 0,
    metadata: {
      ...(event.dedupeKey ? { dedupeKey: event.dedupeKey } : {}),
      ...(finished ? {} : { resumeAt: outcome.resumeAt, resumeStep: outcome.resumeStep, event }),
    },
  };
  const { error } = await db.from(RUNS).update(patch).eq("id", runId);
  if (error) console.error("[workflows.engine.persist]", error.message);
}

async function execute(db, workflow, event, asset, subjects, options) {
  const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
  const startedAt = new Date().toISOString();
  const run = { workflow, event, asset, projectId: workflow.project_id, ...subjects };

  const { data: row, error } = await db
    .from(RUNS)
    .insert({
      workflow_id: workflow.id,
      project_id: workflow.project_id,
      trigger: event.type,
      status: "Running",
      started_at: startedAt,
      steps_total: steps.length,
      steps_completed: 0,
      context: { ...assetContext(asset), ...abilityContext(run), ...(event.context || {}) },
      steps_log: [],
      metadata: event.dedupeKey ? { dedupeKey: event.dedupeKey } : {},
    })
    .select("id")
    .single();
  if (error) {
    console.error("[workflows.engine.run]", error.message);
    return null;
  }

  const trigger = steps[0];
  const log = trigger
    ? [{ id: trigger.id, kind: "trigger", type: trigger.type || event.type, status: "Success", durationMs: 0 }]
    : [];
  const outcome = await walk(db, run, steps, trigger ? 1 : 0, log, options);
  await persistOutcome(db, row.id, startedAt, outcome, log, event);
  return { runId: row.id, workflowId: workflow.id, status: outcome.status };
}

async function bumpRunCount(db, workflow, runs) {
  if (!runs) return;
  const { error } = await db
    .from(WORKFLOWS)
    .update({
      run_count: (Number(workflow.run_count) || 0) + runs,
      last_run_at: new Date().toISOString(),
    })
    .eq("id", workflow.id);
  if (error) console.error("[workflows.engine.count]", error.message);
}

async function collectionsOf(db, assetId, cache) {
  if (!assetId) return new Set();
  if (!cache.has(assetId)) {
    const { data } = await db.from("collection_assets").select("collection_id").eq("asset_id", assetId);
    cache.set(assetId, new Set((data || []).map((r) => r.collection_id)));
  }
  return cache.get(assetId);
}

async function inScope(db, workflow, event, assetId, cache) {
  if (workflow.scope !== "collection") return !event.collectionOnly;
  if (!workflow.collection_id) return false;
  if (event.collectionId === workflow.collection_id) return true;
  if (event.collectionOnly) return false;
  return (await collectionsOf(db, assetId, cache)).has(workflow.collection_id);
}

/**
 * Fire every matching Active workflow for one event. Best-effort: returns the
 * runs it recorded (possibly empty) and never throws.
 *
 * `event.collectionOnly` limits the match to workflows attached to
 * `event.collectionId` — used when an existing asset is added to a collection,
 * which "lands" it there without re-firing workspace-wide workflows.
 */
export async function runWorkflowEvent(db, event, options = {}) {
  const opts = { allowNetwork: true, ...options };
  if (!db || !event?.type || !isUuid(event.projectId)) return [];
  try {
    const { data: workflows, error } = await db
      .from(WORKFLOWS)
      .select("*")
      .eq("project_id", event.projectId)
      .eq("trigger", event.type)
      .eq("status", "Active")
      .is("deleted_at", null);
    if (error) {
      console.error("[workflows.engine.match]", error.message);
      return [];
    }
    if (!workflows?.length) return [];

    const assetIds = [...new Set([event.assetId, ...(event.assetIds || [])].filter(isUuid))];
    const subjects = assetIds.length ? assetIds : [null];
    const membership = new Map();
    const results = [];
    // Order / customer subjects are loaded once and shared by every match.
    const extra = await loadAbilitySubjects(db, event);

    for (const workflow of workflows) {
      let fired = 0;
      for (const assetId of subjects) {
        if (!(await inScope(db, workflow, event, assetId, membership))) continue;
        const asset = assetId ? await loadAsset(db, assetId) : null;
        if (assetId && !asset) continue;
        const result = await execute(db, workflow, { ...event, assetId, assetIds: undefined }, asset, extra, opts);
        if (result) {
          results.push(result);
          fired += 1;
        }
      }
      await bumpRunCount(db, workflow, fired);
    }
    return results;
  } catch (e) {
    console.error("[workflows.engine]", e);
    return [];
  }
}

/** Continue runs parked on a "Wait / delay" step whose time has come. */
export async function resumeDueRuns(db, { projectId, limit = 25, ...options } = {}) {
  const opts = { allowNetwork: true, ...options };
  if (!db) return [];
  try {
    let q = db.from(RUNS).select("*").eq("status", "Running");
    if (projectId && isUuid(projectId)) q = q.eq("project_id", projectId);
    const { data, error } = await q.order("started_at", { ascending: true }).limit(200);
    if (error) {
      console.error("[workflows.engine.due]", error.message);
      return [];
    }
    const now = Date.now();
    const due = (data || [])
      .filter((r) => r.metadata?.resumeAt && new Date(r.metadata.resumeAt).getTime() <= now)
      .slice(0, limit);

    const results = [];
    for (const row of due) {
      // Claim the run first so an overlapping tick can't resume it twice.
      const { data: claimed } = await db
        .from(RUNS)
        .update({ metadata: { ...row.metadata, resumeAt: null, resumingAt: new Date().toISOString() } })
        .eq("id", row.id)
        .eq("status", "Running")
        .select("id");
      if (!claimed?.length) continue;

      const { data: workflow } = await db.from(WORKFLOWS).select("*").eq("id", row.workflow_id).maybeSingle();
      const event = row.metadata.event || { type: row.trigger, projectId: row.project_id };
      const log = Array.isArray(row.steps_log) ? row.steps_log : [];
      let outcome;
      if (!workflow || workflow.deleted_at || workflow.status !== "Active") {
        outcome = {
          status: "Skipped",
          error: "",
          completed: Number(row.steps_completed) || 0,
        };
        log.push({ kind: "action", type: "flow.wait", status: "Skipped", note: "Workflow was paused or deleted while waiting", durationMs: 0 });
      } else {
        const asset = event.assetId ? await loadAsset(db, event.assetId) : null;
        const extra = await loadAbilitySubjects(db, event);
        const run = { workflow, event, asset, projectId: workflow.project_id, ...extra };
        outcome = await walk(db, run, workflow.steps || [], Number(row.metadata.resumeStep) || 0, log, opts);
      }
      await persistOutcome(db, row.id, row.started_at, outcome, log, event);
      results.push({ runId: row.id, workflowId: row.workflow_id, status: outcome.status });
    }
    return results;
  } catch (e) {
    console.error("[workflows.engine.resume]", e);
    return [];
  }
}

/**
 * Fire `license.expiring` for licences ending within `withinDays`. Each
 * licence fires once per end date — the key is kept on the run's metadata so a
 * later tick skips it.
 */
export async function scanExpiringLicenses(db, { projectId, withinDays = 30, ...options } = {}) {
  if (!db) return [];
  try {
    const today = new Date();
    const horizon = new Date(today.getTime() + withinDays * 86_400_000).toISOString().slice(0, 10);
    let q = db
      .from("licenses")
      .select("id, project_id, title, reference, end_date")
      .in("status", ["active", "expiring"])
      .eq("is_perpetual", false)
      .lte("end_date", horizon)
      .gte("end_date", today.toISOString().slice(0, 10))
      .is("deleted_at", null);
    if (projectId && isUuid(projectId)) q = q.eq("project_id", projectId);
    const { data: licenses, error } = await q;
    if (error) {
      console.error("[workflows.engine.licenses]", error.message);
      return [];
    }

    const results = [];
    for (const license of licenses || []) {
      const key = `${license.id}:${license.end_date}`;
      const { data: seen } = await db
        .from(RUNS)
        .select("id")
        .eq("trigger", "license.expiring")
        .eq("metadata->>dedupeKey", key)
        .limit(1);
      if (seen?.length) continue;

      const { data: items } = await db.from("license_items").select("asset_id").eq("license_id", license.id);
      const assetIds = (items || []).map((i) => i.asset_id).filter(Boolean);
      const days = Math.max(0, Math.ceil((new Date(license.end_date).getTime() - today.getTime()) / 86_400_000));
      results.push(
        ...(await runWorkflowEvent(
          db,
          {
            type: "license.expiring",
            projectId: license.project_id,
            assetIds,
            context: {
              license: license.title || license.reference,
              expires: days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`,
            },
            dedupeKey: key,
          },
          options,
        )),
      );
    }
    return results;
  } catch (e) {
    console.error("[workflows.engine.licenses]", e);
    return [];
  }
}

/**
 * Fire `storage.quota` when an upload of `addedBytes` pushes the project's
 * stored total across its quota-alert threshold (Settings → Usage).
 */
export async function checkStorageThreshold(db, { projectId, addedBytes, assetId, ...options } = {}) {
  if (!db || !isUuid(projectId) || !(Number(addedBytes) > 0)) return [];
  try {
    const { data: settings } = await db
      .from("project_settings")
      .select("storage_quota_gb, quota_alert_percent")
      .eq("project_id", projectId)
      .maybeSingle();
    const quotaGb = Number(settings?.storage_quota_gb ?? 500);
    const percent = Number(settings?.quota_alert_percent ?? 80);
    if (!(quotaGb > 0) || !(percent > 0)) return [];

    const { data: rows, error } = await db
      .from("assets")
      .select("size_bytes")
      .eq("project_id", projectId)
      .is("deleted_at", null);
    if (error) return [];
    const total = (rows || []).reduce((s, r) => s + (Number(r.size_bytes) || 0), 0);
    const threshold = quotaGb * 1024 * MB * (percent / 100);
    if (!(total >= threshold && total - Number(addedBytes) < threshold)) return [];

    return runWorkflowEvent(
      db,
      {
        type: "storage.quota",
        projectId,
        assetId,
        context: { usage: `${(total / (1024 * MB)).toFixed(1)} GB of ${quotaGb} GB`, threshold: `${percent}%` },
      },
      options,
    );
  } catch (e) {
    console.error("[workflows.engine.quota]", e);
    return [];
  }
}
