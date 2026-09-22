import {
  LayoutDashboard,
  Rocket,
  SquarePen,
  Share2,
  History,
  Wrench,
} from "lucide-react";

export const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "overview",
        label: "Overview",
        icon: LayoutDashboard,
        desc: "A snapshot of this asset — preview and key details.",
      },
    ],
  },
  {
    group: "Manage",
    items: [
      {
        key: "details",
        label: "Asset details",
        icon: SquarePen,
        desc: "Name, description, status, type, folder, and tags.",
      },
      {
        key: "relationships",
        label: "Relationships",
        icon: Share2,
        desc: "Originals, derivatives, variants, and related records.",

        ownHeader: true,
      },
      {
        key: "versions",
        label: "Versions",
        icon: History,
        desc: "An inspectable history of every revision.",
      },
      {
        key: "delivery",
        label: "Delivery",
        icon: Rocket,
        desc: "Opt into dynamic delivery and preview transforms.",
      },
      {
        key: "technical",
        label: "Technical",
        icon: Wrench,
        desc: "File, storage, and integrity details for this asset.",
      },
    ],
  },
];
