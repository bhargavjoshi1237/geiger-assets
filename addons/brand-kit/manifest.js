import { Palette } from "lucide-react";
import { BrandKitScreen } from "./screens/brand_kit_screen";

export const brandKitAddon = {
  id: "brand-kit",
  name: "Brand Kit",
  description:
    "Logo lockups, colour palette, type scale and usage notes that keep every asset on brand.",
  version: "1.0.0",
  category: "Design",
  icon: Palette,
  color: "#8b5cf6",
  features: [
    "Logo lockups with clear-space and minimum-size notes",
    "Colour palette swatches with hex values and roles",
    "Typography scale with usage guidance",
    "Do and avoid usage notes",
  ],
  navItem: {
    title: "Brand Kit",
    icon: Palette,
    insertAfter: "Galleries",
  },
  screens: [
    {
      id: "Brand Kit",
      component: BrandKitScreen,
    },
  ],
};
