import { Stamp } from "lucide-react";
import { WatermarkScreen } from "./screens/watermark_screen";

export const watermarkAddon = {
  id: "watermark",
  name: "Watermarks",
  description:
    "Text and image watermark presets with placement, opacity and blend control.",
  version: "1.0.0",
  category: "Protection",
  icon: Stamp,
  color: "#06b6d4",
  features: [
    "Text or image marks with a 9-cell placement grid",
    "Opacity, scale, margin and blend controls",
    "Live preview over a sample asset",
    "Duplicate presets and a default for share links",
  ],
  navItem: {
    title: "Watermarks",
    icon: Stamp,
    insertAfter: "Media",
  },
  screens: [
    {
      id: "Watermarks",
      component: WatermarkScreen,
    },
  ],
};
