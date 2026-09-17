import {
  Gauge,
  HardDrive,
  Link,
  LucidePackagePlus,
  MousePointer2,
  Settings,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { featureNav, overviewNavItem } from "./feature_registry";
import { tabPermissionKey } from "@/lib/rbac";

export const settingsNav = [
  { title: "General", icon: Settings2 },
  { title: "Connectivity", icon: Link },
  { title: "Add-ons", icon: LucidePackagePlus },
  { title: "Usage & Storage", icon: Gauge },
  // `permission` is read by the sidebar, which hides the entry when the caller's
  // role lacks the key. Advisory UI gating only — it does not secure the data.
  {
    title: "Storage Backends",
    icon: HardDrive,
    permission: tabPermissionKey("Storage Backends"),
  },
  { title: "Permissions & Security", icon: ShieldCheck },
  { title: "Custom Fields", icon: SlidersHorizontal },
  { title: "Advanced", icon: Settings },
  { title: "Enterprise", icon: MousePointer2 },
];

export const projectNav = [
  overviewNavItem,
  ...featureNav,
  {
    title: "Settings",
    icon: Settings,
    hasSubmenu: true,
  },
];
