import {
  Gauge,
  Link,
  LucidePackagePlus,
  MousePointer2,
  Settings,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { featureNav, overviewNavItem } from "./feature_registry";

export const settingsNav = [
  { title: "General", icon: Settings2 },
  { title: "Connectivity", icon: Link },
  { title: "Add-ons", icon: LucidePackagePlus },
  { title: "Usage & Storage", icon: Gauge },
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
