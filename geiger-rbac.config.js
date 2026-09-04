import { defineRbacConfig, defineRole } from "@geiger/rbac";

export function navSlug(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function navPermissionKey(title) {
  return `assets.${navSlug(title)}.view`;
}

const NAV_SECTIONS = [
  "Overview",
  "Assets",
  "Media",
  "Collaboration",
  "Workflows",
  "Delivery",
  "Galleries",
  "Memberships",
  "Licensing",
  "Governance",
  "Platform",
  "Analytics",
  "Settings",
];

const CREATOR_SECTIONS = [
  "Membership Tiers",
  "Members",
  "Recurring Billing",
  "Pay-Per-View",
  "Paid Messages",
  "Tips",
  "Payouts",
  "Promo Codes & Perks",
  "Access Control",
];

const navPermissions = [...NAV_SECTIONS, ...CREATOR_SECTIONS].map((title) => ({
  key: navPermissionKey(title),
  label: title,
  group: "Workspace views",
}));

const operationPermissions = [
  {
    key: "assets.tier.edit",
    label: "Create and edit tiers",
    group: "Memberships",
    scopeBy: "project",
  },
  {
    key: "assets.subscription.manage",
    label: "Manage subscriptions",
    group: "Memberships",
    scopeBy: "project",
  },
  {
    key: "assets.ppv.send",
    label: "Send PPV content",
    group: "Memberships",
    scopeBy: "project",
  },
  {
    key: "assets.message.charge",
    label: "Charge for messages",
    group: "Memberships",
    scopeBy: "project",
  },
  {
    key: "assets.tip.payout",
    label: "Settle tips and payouts",
    group: "Memberships",
    scopeBy: "project",
    condition: { field: "payout.status", op: "ne", value: "paid" },
  },
  {
    key: "assets.asset.edit",
    label: "Edit an asset",
    group: "Assets",
    scopeBy: "project",
  },
  {
    key: "assets.asset.delete",
    label: "Delete an asset",
    group: "Assets",
    scopeBy: "project",
  },
  {
    key: "assets.team.invite",
    label: "Invite Members",
    group: "Team Control",
  },
  {
    key: "assets.team.assign",
    label: "Assign roles",
    group: "Team Control",
  },
  {
    key: "assets.role.manage",
    label: "Create and edit roles",
    group: "Team Control",
  },
  {
    key: "assets.billing.manage",
    label: "Manage billing",
    group: "Administration",
  },
  {
    key: "assets.settings.manage",
    label: "Manage settings",
    group: "Administration",
  },
];

const permissions = [...navPermissions, ...operationPermissions];

const uniquePermissions = Array.from(
  new Map(permissions.map((p) => [p.key, p])).values(),
);

const viewKeys = uniquePermissions
  .filter((p) => p.key.endsWith(".view"))
  .map((p) => p.key);

const systemRoles = [
  defineRole({
    key: "owner",
    name: "Owner",
    description: "Full access to everything, including billing.",
    color: "violet",
    permissions: ["*"],
    sort: 0,
  }),
  defineRole({
    key: "admin",
    name: "Admin",
    description: "Manage the workspace, team and roles — no billing control.",
    color: "blue",
    permissions: [
      ...viewKeys,
      "assets.tier.edit",
      "assets.subscription.manage",
      "assets.ppv.send",
      "assets.message.charge",
      "assets.asset.edit",
      "assets.asset.delete",
      "assets.team.invite",
      "assets.team.assign",
      "assets.role.manage",
      "assets.settings.manage",
    ],
    sort: 1,
  }),
  defineRole({
    key: "manager",
    name: "Manager",
    description: "Run memberships and assets; can't edit roles or billing.",
    color: "emerald",
    permissions: [
      ...viewKeys,
      "assets.tier.edit",
      "assets.subscription.manage",
      "assets.ppv.send",
      "assets.message.charge",
      "assets.asset.edit",
      "assets.team.invite",
      "assets.team.assign",
    ],
    sort: 2,
  }),
  defineRole({
    key: "member",
    name: "Member",
    description: "Day-to-day operational access to the workspace.",
    color: "amber",
    permissions: [
      "assets.overview.view",
      "assets.assets.view",
      "assets.memberships.view",
      "assets.membership_tiers.view",
      "assets.members.view",
      "assets.pay_per_view.view",
      "assets.analytics.view",
      "assets.asset.edit",
    ],
    sort: 3,
  }),
  defineRole({
    key: "viewer",
    name: "Viewer",
    description: "Read-only access to the overview and reports.",
    color: "slate",
    permissions: ["assets.overview.view", "assets.analytics.view"],
    sort: 4,
  }),
];

export default defineRbacConfig({
  product: "assets",
  permissions: uniquePermissions,
  systemRoles,
});
