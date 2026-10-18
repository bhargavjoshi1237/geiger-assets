// Workspace-level config: workflows and their run history, plus the project
// settings row (general, limits, security and every add-on's saved state).

import { WORKFLOW_TEMPLATES } from "@/components/internal/screens/projects/workflows/constants";
import { stepsToGraph } from "@/lib/workflows/graph";
import { personId } from "../cast";
import { PROJECT_ID, base, daysAgo, sid, noise } from "./helpers";

function withIds(steps, n) {
  return steps.map((step, i) => ({
    id: `step_${n}_${i}`,
    kind: step.kind,
    type: step.type,
    config: { ...(step.config || {}) },
    position: { x: 0, y: i * 140 },
  }));
}

const STATUSES = ["Active", "Active", "Active", "Paused", "Active", "Draft"];

function workflowRows() {
  const workflows = WORKFLOW_TEMPLATES.map((template, i) => {
    const n = i + 1;
    const steps = withIds(template.steps, n);
    const status = STATUSES[i % STATUSES.length];
    const runCount = status === "Draft" ? 0 : Math.round(12 + noise(n) * 140);
    return {
      ...base("workflow", n, { created: 90 - n * 9, updated: n }),
      collection_id: n === 3 ? sid("collection", 1) : null,
      name: template.name,
      description: template.description,
      status,
      trigger: template.trigger,
      scope: n === 3 ? "collection" : "workspace",
      steps,
      graph: stepsToGraph(steps, null),
      view_mode: n % 2 === 0 ? "canvas" : "list",
      run_count: runCount,
      last_run_at: runCount ? daysAgo(0, n * 3) : null,
      created_by: personId(1 + (n % 3)),
    };
  });

  const runs = [];
  let runN = 1;
  const contexts = [
    { asset: "Spring story 9x16.jpg", folder: "/Campaigns/Spring 2026" },
    { asset: "Brand film — 15s cutdown.mp4", size: "98 MB" },
    { asset: "Product — nova chair detail.jpg", uploader: "Ravi Patel" },
    { license: "Solace Hotels — holiday OOH", expires: "in 12 days" },
  ];
  for (const workflow of workflows.filter((w) => w.run_count > 0)) {
    for (let i = 0; i < 6; i += 1) {
      const roll = noise(runN * 7);
      const status = i === 0 && workflow.status === "Active" && roll > 0.7 ? "Running" : roll > 0.88 ? "Failed" : roll > 0.8 ? "Skipped" : "Success";
      const total = workflow.steps.length;
      const completed = status === "Success" ? total : status === "Failed" ? Math.max(1, total - 1) : status === "Running" ? 1 : 1;
      const duration = Math.round(300 + noise(runN) * 4200);
      runs.push({
        id: sid("run", runN),
        workflow_id: workflow.id,
        project_id: PROJECT_ID,
        trigger: workflow.trigger,
        status,
        started_at: daysAgo(i, runN % 12),
        finished_at: status === "Running" ? null : new Date(new Date(daysAgo(i, runN % 12)).getTime() + duration).toISOString(),
        duration_ms: status === "Running" ? null : duration,
        steps_total: total,
        steps_completed: completed,
        error: status === "Failed" ? "Reviewer group “editors” has no active members." : null,
        context: contexts[runN % contexts.length],
        steps_log: workflow.steps.slice(0, Math.max(completed, status === "Failed" ? completed + 1 : completed)).map((step, s) => ({
          type: step.type,
          status: status === "Failed" && s === completed ? "Failed" : status === "Skipped" && s > 0 ? "Skipped" : "Success",
          durationMs: Math.round(duration / total),
          error: status === "Failed" && s === completed ? "Reviewer group “editors” has no active members." : null,
        })),
        created_at: daysAgo(i, runN % 12),
        updated_at: daysAgo(i, runN % 12),
        metadata: {},
      });
      runN += 1;
    }
  }
  return { workflows, runs };
}

function settingsRows() {
  return [
    {
      ...base("settings", 1, { created: 200, updated: 4 }),
      visibility: "internal",
      region: "us-east-1",
      default_page_size: 25,
      default_tab: "Overview",
      storage_quota_gb: 500,
      max_upload_mb: 2048,
      trash_retention_days: 30,
      auto_archive_days: 365,
      quota_alert_percent: 80,
      created_by: personId(1),
      metadata: {
        addons: { enabled: ["brand-kit", "watermark", "contact-sheets"], navPositions: {}, colors: {} },
        brandKit: {
          logos: [
            { id: "logo-primary", label: "Primary — dark", url: "", clearSpace: "1× cap height", minSize: "24px" },
            { id: "logo-light", label: "Primary — light", url: "", clearSpace: "1× cap height", minSize: "24px" },
          ],
          palette: [
            { id: "sw-ink", name: "Ink", hex: "#111111", role: "Primary text" },
            { id: "sw-paper", name: "Paper", hex: "#f5f3ef", role: "Backgrounds" },
            { id: "sw-meadow", name: "Meadow", hex: "#4d7c0f", role: "Spring accent" },
            { id: "sw-ember", name: "Ember", hex: "#ea580c", role: "Calls to action" },
            { id: "sw-sky", name: "Sky", hex: "#0ea5e9", role: "Links & data" },
          ],
          typography: [
            { id: "ty-display", name: "Display", usage: "Headlines, campaign lockups", size: 48 },
            { id: "ty-heading", name: "Heading", usage: "Section titles", size: 24 },
            { id: "ty-body", name: "Body", usage: "Paragraphs, UI copy", size: 16 },
          ],
          dos: ["Give the logo one cap-height of clear space.", "Use Meadow sparingly as a spring accent."],
          donts: ["Don't recolour the wordmark.", "Don't place the logo on busy photography without a scrim."],
        },
        watermarks: [
          { id: "wm-proof", name: "Client proof", kind: "text", text: "PROOF — HALCYON", imageUrl: "", position: "center", opacity: 35, scale: 120, margin: 0, blend: "overlay", isDefault: true },
          { id: "wm-corner", name: "Corner credit", kind: "text", text: "© Halcyon Studio", imageUrl: "", position: "bottom-right", opacity: 70, scale: 60, margin: 24, blend: "normal", isDefault: false },
        ],
        contactSheets: [
          { id: "cs-spring", name: "Spring selects", sourceCollection: sid("collection", 1), columns: 4, rows: 3, fields: ["name", "status"], header: "Spring 2026 — selects", footer: "Halcyon Studio · Confidential", pageSize: "A4" },
          { id: "cs-product", name: "Product packshots", sourceCollection: sid("collection", 3), columns: 3, rows: 4, fields: ["name", "format", "size"], header: "Product photography", footer: "", pageSize: "Letter" },
        ],
      },
    },
  ];
}

export function workspaceSeed() {
  const { workflows, runs } = workflowRows();
  return {
    workflows,
    workflow_runs: runs,
    project_settings: settingsRows(),
  };
}
