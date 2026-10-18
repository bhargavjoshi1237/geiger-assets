import { projectNav, settingsNav } from "@/components/internal/sidebar/projects/sidebar_data";

export function tabToSlug(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function collectTitles() {
  const titles = [];
  const walk = (items) => {
    for (const item of items || []) {
      titles.push(item.title);
      walk(item.subItems);
    }
  };
  walk(projectNav);
  walk(settingsNav);
  return titles;
}

const SLUG_TO_TAB = (() => {
  const map = new Map();
  for (const title of collectTitles()) {
    if (!title) continue;
    const slug = tabToSlug(title);
    if (!map.has(slug)) map.set(slug, title);
  }
  return map;
})();

export function slugToTab(slug) {
  if (!slug) return null;
  return SLUG_TO_TAB.get(String(slug).toLowerCase()) || null;
}
