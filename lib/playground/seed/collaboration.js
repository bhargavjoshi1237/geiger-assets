// Collaboration domain: the team directory, roles and grants, invitations,
// share links, approval pipelines/reviews, comments and the activity feed.

import { SYSTEM_ROLE_SEED } from "@/lib/rbac";
import { PEOPLE, person, personId } from "../cast";
import { PROJECT_ID, base, daysAgo, daysFromNow, sid } from "./helpers";

// Halcyon Studio people without a role on this project yet: the "add from your
// organization" candidates on the Team screen.
const UNGRANTED = [8, 11];

const ORG_ROLES = { owner: "admin", admin: "admin", manager: "manager" };

export const personName = (n) => person(n).name;

function userRows() {
  return PEOPLE.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    avatar_url: p.avatar_url,
    org_role: ORG_ROLES[p.role] ?? "member",
  }));
}

function roleRows() {
  return SYSTEM_ROLE_SEED.map((role, i) => ({
    ...base("role", i + 1, { created: 200 }),
    key: role.key,
    name: role.name,
    description: role.description ?? "",
    color: role.color ?? "slate",
    permissions: role.permissions ?? [],
    is_system: true,
    sort: role.sort ?? i,
  }));
}

function grantRows(roles) {
  return PEOPLE.filter((p) => !UNGRANTED.includes(p.n)).map((p) => ({
    ...base("grant", p.n, { created: 180 - p.n * 10 }),
    user_id: p.id,
    role_id: roles.find((r) => r.key === p.role)?.id ?? roles[roles.length - 1].id,
    scope: {},
    status: "active",
    granted_by: personId(1),
  }));
}

function invitationRows(roles) {
  const roleId = (key) => roles.find((r) => r.key === key)?.id ?? null;
  return [
    [1, "lena@ortiz.studio", "Lena Ortiz", "reviewer", "pending", "member", 5, "Would love your eyes on the spring selects."],
    [2, "studio@brightline.agency", "Brightline Agency", "guest", "pending", "member", 12, "Access to the campaign folders for delivery."],
    [3, "kenji@halcyon.studio", "Kenji Watanabe", "member", "accepted", "member", -3, ""],
    [4, "old.partner@example.com", "Former partner", "guest", "revoked", "member", -20, ""],
    [5, "freelance@pixelgrain.co", "Pixel & Grain", "reviewer", "expired", "member", -2, "Review holiday cutdowns."],
  ].map(([n, email, name, kind, status, roleKey, days, message]) => ({
    ...base("invite", n, { created: Math.abs(days) + 7, updated: Math.abs(days) }),
    email,
    name,
    role_id: roleId(roleKey),
    kind,
    status,
    token: `inv_playground_${n}`,
    message,
    scope: {},
    expires_at: days > 0 ? daysFromNow(days) : daysAgo(-days),
    accepted_at: status === "accepted" ? daysAgo(3) : null,
    accepted_by: status === "accepted" ? personId(7) : null,
    invited_by: personId(1 + (n % 3)),
  }));
}

function shareRows() {
  return [
    [1, "Spring launch — agency review", "collection", sid("collection", 1), "private", "active", true, true, true, 184, 42, 1, 21],
    [2, "Brand essentials for partners", "collection", sid("collection", 2), "public", "active", true, false, false, 1290, 511, 0, null],
    [3, "Press kit 2026", "collection", sid("collection", 5), "public", "active", true, false, false, 866, 204, 0, 60],
    [4, "Brand film — client preview", "asset", sid("asset", 18), "private", "active", false, true, true, 37, 0, 2, 7],
    [5, "Aurora lamp packshot", "asset", sid("asset", 11), "public", "paused", true, false, false, 142, 58, 4, null],
    [6, "Holiday lookbook (retired)", "asset", sid("asset", 37), "public", "expired", true, false, false, 402, 97, 40, -10],
    [7, "Old agency link", "folder", sid("folder", 6), "private", "revoked", false, false, true, 12, 1, 90, null],
  ].map(([n, name, subjectType, subjectId, visibility, status, download, comments, email, views, downloads, lastViewed, expires]) => ({
    ...base("share", n, { created: 40 + n * 3, updated: lastViewed }),
    name,
    token: `playground-share-${n}`,
    subject_type: subjectType,
    subject_id: subjectId,
    visibility,
    password_hash: n === 4 ? "playground" : null,
    expires_at: expires == null ? null : expires > 0 ? daysFromNow(expires) : daysAgo(-expires),
    allow_download: download,
    allow_comments: comments,
    require_email: email,
    status,
    view_count: views,
    download_count: downloads,
    last_viewed_at: daysAgo(lastViewed, 3),
    created_by: personId(1 + (n % 4)),
  }));
}

const stage = (id, name, extra = {}) => ({
  id,
  name,
  approverType: "role",
  roleId: "",
  memberIds: [],
  minApprovals: 1,
  advance: "sequential",
  allowChangeRequests: true,
  slaHours: 48,
  ...extra,
});

function pipelineRows(roles) {
  const roleId = (key) => roles.find((r) => r.key === key)?.id ?? "";
  return [
    [1, "Brand review", "Creative lead signs off, then brand approves.", "asset", "Active", "sequential", true, [
      stage("stage_creative", "Creative review", { roleId: roleId("manager") }),
      stage("stage_brand", "Brand approval", { roleId: roleId("admin") }),
    ], 4],
    [2, "Client delivery", "Internal QA, then account management, then the client.", "collection", "Active", "sequential", true, [
      stage("stage_qa", "Internal QA", { roleId: roleId("member") }),
      stage("stage_account", "Account review", { roleId: roleId("manager") }),
      stage("stage_client", "Client sign-off", { approverType: "member", memberIds: [personId(2)], slaHours: 72 }),
    ], 2],
    [3, "External access", "Two approvers must agree before a link is exposed publicly.", "share_link", "Active", "anytime", true, [
      stage("stage_security", "Security review", { minApprovals: 2, advance: "anytime", roleId: roleId("admin") }),
    ], 1],
    [4, "Finance sign-off", "Finance and a director both approve before money moves.", "payout", "Draft", "sequential", false, [
      stage("stage_finance", "Finance check"),
      stage("stage_director", "Director approval", { approverType: "member", memberIds: [personId(1)] }),
    ], 0],
  ].map(([n, name, description, subject, status, mode, isDefault, stages, count]) => ({
    ...base("pipeline", n, { created: 70 - n * 5, updated: n * 2 }),
    name,
    description,
    subject_type: subject,
    status,
    mode,
    is_default: isDefault,
    stages,
    auto_lock_version: true,
    auto_stamp_status: true,
    review_count: count,
    created_by: personId(1),
  }));
}

function reviewRows(pipelines) {
  const pipe = (n) => pipelines[n - 1];
  const reviews = [
    [1, 1, "Spring hero — city", "Final grade on the city hero before it goes to print.", "asset", sid("asset", 5), "In Review", "High", 1, 2, [5]],
    [2, 1, "Nova chair packshots", "Studio packshots for the retail launch.", "asset", sid("asset", 13), "Pending", "Normal", 0, 5, [13, 14]],
    [3, 2, "Spring launch collection", "Everything in the spring kit, ready for the agency.", "collection", sid("collection", 1), "Changes Requested", "Urgent", 1, 1, [4, 6, 7, 8]],
    [4, 1, "Brand film — 15s cutdown", "Cutdown for paid social.", "asset", sid("asset", 19), "In Review", "Normal", 0, 3, [19]],
    [5, 1, "Holiday key visual", "Signed off last season.", "asset", sid("asset", 9), "Approved", "Normal", 1, -30, [9]],
    [6, 3, "Brand essentials public link", "Opening the partner link to the public.", "share_link", sid("share", 2), "Approved", "Low", 0, -12, []],
    [7, 1, "Packaging dieline", "Print vendor needs this by Friday.", "asset", sid("asset", 29), "Rejected", "High", 0, -2, [29]],
  ];
  const items = [];
  const decisions = [];
  let itemN = 1;
  let decisionN = 1;

  const rows = reviews.map(([n, pipelineN, name, description, subjectType, subjectId, status, priority, currentStage, due, assetNs]) => {
    const pipeline = pipe(pipelineN);
    const done = ["Approved", "Rejected", "Cancelled"].includes(status);
    const itemDecision =
      status === "Approved" ? "approved" : status === "Rejected" ? "rejected" : status === "Changes Requested" ? "changes" : "pending";
    assetNs.forEach((an, position) => {
      items.push({
        id: sid("review_item", itemN++),
        review_id: sid("review", n),
        asset_id: sid("asset", an),
        subject_type: "asset",
        subject_id: sid("asset", an),
        label: "",
        decision: position === 0 || done ? itemDecision : "pending",
        note: itemDecision === "changes" && position === 0 ? "Crop is too tight on the left edge." : "",
        decided_by: itemDecision !== "pending" ? personId(3) : null,
        decided_at: itemDecision !== "pending" ? daysAgo(1) : null,
        position,
        metadata: {},
      });
    });
    for (let s = 0; s <= Math.min(currentStage, pipeline.stages.length - 1); s += 1) {
      const passed = s < currentStage || status === "Approved";
      const verdict = passed
        ? "approved"
        : status === "Rejected"
          ? "rejected"
          : status === "Changes Requested"
            ? "changes"
            : null;
      if (!verdict) continue;
      const actor = 2 + ((n + s) % 3);
      decisions.push({
        id: sid("decision", decisionN++),
        review_id: sid("review", n),
        stage_index: s,
        stage_name: pipeline.stages[s].name,
        decision: verdict,
        note: verdict === "changes" ? "Crop is too tight on the left edge — please re-export." : verdict === "rejected" ? "Bleed is missing on the back panel." : "Looks great.",
        actor_id: personId(actor),
        actor_name: personName(actor),
        created_at: daysAgo(3 - s),
        metadata: {},
      });
    }
    return {
      ...base("review", n, { created: 8 + n, updated: Math.max(0, 3 - n) }),
      pipeline_id: pipeline.id,
      name,
      description,
      subject_type: subjectType,
      subject_id: subjectId,
      status,
      priority,
      current_stage: currentStage,
      stage_snapshot: pipeline.stages,
      due_at: due > 0 ? daysFromNow(due) : daysAgo(-due),
      completed_at: done ? daysAgo(Math.max(1, -due)) : null,
      requested_by: personId(1 + (n % 5)),
    };
  });
  return { rows, items, decisions };
}

function commentRows() {
  const rows = [];
  const threads = [
    [1, 4, "Can we warm up the grass a touch? It reads a bit cold next to the logo.", 2, "open", [
      [3, "Agreed — I'll push the greens 5% warmer in the next pass."],
      [2, "Perfect, thanks!"],
    ], { x: 0.42, y: 0.66 }],
    [2, 5, "The skyline horizon isn't level — about 1° off.", 3, "resolved", [
      [4, "Fixed in v3, uploaded just now."],
    ], { x: 0.5, y: 0.31 }],
    [3, 18, "Music swell at 0:42 feels early — can it land on the product reveal?", 4, "open", [
      [5, "Moving it to 0:45 — will re-export tonight."],
    ], { time: 42 }],
    [4, 11, "Is this the final colourway for retail?", 5, "open", [], null],
    [5, 25, "Page 14 still shows the old secondary palette.", 6, "resolved", [
      [2, "Updated in the 2026 refresh."],
    ], { page: 14 }],
    [6, 13, "Shadow under the legs looks clipped.", 3, "open", [], { x: 0.55, y: 0.88 }],
  ];
  let n = 1;
  for (const [t, assetN, body, author, status, replies, anchor] of threads) {
    const rootId = sid("comment", n);
    rows.push({
      ...base("comment", n++, { created: 10 - t, updated: 10 - t }),
      parent_id: null,
      subject_type: "asset",
      subject_id: sid("asset", assetN),
      asset_id: sid("asset", assetN),
      review_id: null,
      body,
      anchor,
      mentions: [],
      status,
      author_id: personId(author),
      author_name: personName(author),
      resolved_by: status === "resolved" ? personId(2) : null,
      resolved_at: status === "resolved" ? daysAgo(2) : null,
    });
    replies.forEach(([replyAuthor, replyBody], i) => {
      rows.push({
        ...base("comment", n++, { created: 10 - t, updated: 10 - t }),
        created_at: daysAgo(Math.max(0, 9 - t), 12 - i * 3),
        parent_id: rootId,
        subject_type: "asset",
        subject_id: sid("asset", assetN),
        asset_id: sid("asset", assetN),
        review_id: null,
        body: replyBody,
        anchor: null,
        mentions: [],
        status: "open",
        author_id: personId(replyAuthor),
        author_name: personName(replyAuthor),
      });
    });
  }
  return rows;
}

function activityRows() {
  return [
    ["asset.uploaded", "uploaded Spring story 9x16.jpg", "asset", sid("asset", 8), "Spring story 9x16.jpg", 4, 0.1],
    ["review.changes", "requested changes on Spring launch collection", "review", sid("review", 3), "Spring launch collection", 3, 0.3],
    ["comment.posted", "commented on Spring hero — meadow.jpg", "asset", sid("asset", 4), "Spring hero — meadow.jpg", 2, 0.5],
    ["share.created", "shared Brand film — client preview", "share_link", sid("share", 4), "Brand film — client preview", 1, 0.9],
    ["review.advanced", "advanced Spring hero — city to Brand approval", "review", sid("review", 1), "Spring hero — city", 3, 1.2],
    ["asset.updated", "updated Product — nova chair side.jpg", "asset", sid("asset", 13), "Product — nova chair side.jpg", 5, 1.6],
    ["member.joined", "joined as Member", "member", personId(7), "Kenji Watanabe", 7, 3],
    ["comment.resolved", "resolved a thread on Spring hero — city.jpg", "asset", sid("asset", 5), "Spring hero — city.jpg", 4, 3.4],
    ["collection.created", "created the collection Press kit", "collection", sid("collection", 5), "Press kit", 2, 5],
    ["review.rejected", "rejected Packaging dieline", "review", sid("review", 7), "Packaging dieline", 2, 2],
    ["asset.archived", "archived Holiday gift guide banner.png", "asset", sid("asset", 10), "Holiday gift guide banner.png", 6, 6],
    ["member.invited", "invited Lena Ortiz", "member", sid("invite", 1), "Lena Ortiz", 1, 5],
    ["review.approved", "approved Brand essentials public link", "review", sid("review", 6), "Brand essentials public link", 2, 12],
    ["share.viewed", "viewed the shared Press kit 2026", "share_link", sid("share", 3), "Press kit 2026", 6, 0.2],
    ["asset.uploaded", "uploaded Brand film — 15s cutdown.mp4", "asset", sid("asset", 19), "Brand film — 15s cutdown.mp4", 3, 7],
    ["role.changed", "changed the role of Sofia Rossi", "member", personId(4), "Sofia Rossi", 1, 9],
  ].map(([verb, summary, subjectType, subjectId, label, actor, days], i) => ({
    id: sid("activity", i + 1),
    project_id: PROJECT_ID,
    verb,
    summary,
    subject_type: subjectType,
    subject_id: subjectId,
    subject_label: label,
    actor_id: personId(actor),
    actor_name: personName(actor),
    created_at: daysAgo(Math.floor(days), Math.round((days % 1) * 24)),
    metadata: {},
  }));
}

export function collaborationSeed() {
  const roles = roleRows();
  const pipelines = pipelineRows(roles);
  const reviews = reviewRows(pipelines);
  return {
    users: userRows(),
    roles,
    role_grants: grantRows(roles),
    team_invitations: invitationRows(roles),
    share_links: shareRows(),
    approval_pipelines: pipelines,
    approval_reviews: reviews.rows,
    approval_review_items: reviews.items,
    approval_decisions: reviews.decisions,
    comments: commentRows(),
    activity_events: activityRows(),
  };
}
