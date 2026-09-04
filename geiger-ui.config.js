import { defineNavConfig } from "@geiger/ui";

export default defineNavConfig({
  product: "assets",

  locked: ["Overview", "Asset Library", "Settings", "Navigation"],

  hiddenByDefault: [],

  dependencies: [
    {
      screen: "Asset Requests",
      requires: ["Asset Library"],
      reason: "Requests are fulfilled from the Asset Library.",
    },
    {
      screen: "Duplicate Review",
      requires: ["Asset Library"],
      reason: "Duplicate groups are computed over library assets.",
    },
    {
      screen: "Archive & Trash",
      requires: ["Asset Library"],
      reason: "Archived rows are filtered views of library assets.",
    },
    {
      screen: "Collections",
      requires: ["Asset Library"],
      reason: "Collections curate assets without moving them.",
    },
    {
      screen: "Folders & Storage",
      requires: ["Asset Library"],
      reason: "Folders structure where library source files live.",
    },
    {
      screen: "External Uploads",
      requires: ["Upload Center"],
      reason: "Guest submissions land as upload jobs.",
    },
    {
      screen: "Members",
      requires: ["Membership Tiers"],
      reason: "Members hold subscriptions against a tier.",
    },
    {
      screen: "Recurring Billing",
      requires: ["Membership Tiers"],
      reason: "Billing runs against tier prices and intervals.",
    },
    {
      screen: "Pay-Per-View",
      requires: ["Membership Tiers"],
      reason: "PPV upsells subscribers of free and paid tiers.",
    },
    {
      screen: "Paid Messages",
      requires: ["Pay-Per-View"],
      reason: "Paid DMs deliver locked PPV attachments.",
    },
    {
      screen: "Tips",
      requires: ["Members"],
      reason: "Tips are attributed to members on posts and messages.",
    },
    {
      screen: "Payouts",
      requires: ["Recurring Billing"],
      reason: "Payouts settle collected subscription and PPV revenue.",
    },
  ],
});
