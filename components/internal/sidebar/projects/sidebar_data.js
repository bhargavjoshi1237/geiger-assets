import {
  Gauge,
  LucidePackagePlus,
  Settings,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { featureNav, overviewNavItem } from "./feature_registry";

export const settingsNav = [
  { title: "General", icon: Settings2 },
  { title: "Add-ons", icon: LucidePackagePlus },
  { title: "Usage & Storage", icon: Gauge },
  { title: "Permissions & Security", icon: ShieldCheck },
  { title: "Advanced", icon: Settings },
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
