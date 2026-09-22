import { LayoutGrid } from "lucide-react";
import { ContactSheetsScreen } from "./screens/contact_sheets_screen";

export const contactSheetsAddon = {
  id: "contact-sheets",
  name: "Contact Sheets",
  description:
    "Printable contact-sheet layouts with grid, captions and page controls.",
  version: "1.0.0",
  category: "Print",
  icon: LayoutGrid,
  color: "#f59e0b",
  features: [
    "Saved layouts bound to a source collection",
    "Grid columns and rows with caption field selection",
    "Header, footer and page-size controls",
    "Preview grid and printable HTML export",
  ],
  navItem: {
    title: "Contact Sheets",
    icon: LayoutGrid,
    insertAfter: "Collections",
  },
  screens: [
    {
      id: "Contact Sheets",
      component: ContactSheetsScreen,
    },
  ],
};
