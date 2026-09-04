import { redirect } from "next/navigation";

import { tabToSlug, slugToTab } from "@/lib/workspace/tabs";

const DEFAULT_TAB = "Overview";

// Legacy route — redirects to the canonical suite URL (/project/<id>/<tab-slug>)
// so /assets/<id>?tab=… bookmarks keep working. Query-only state (open asset,
// editor section) is preserved.
export default async function AssetsProjectLegacyPage({ params, searchParams }) {
  const { projectId } = await params;
  const query = await searchParams;

  const rawTab = Array.isArray(query?.tab) ? query.tab[0] : query?.tab;
  const tab = slugToTab(rawTab) || rawTab || DEFAULT_TAB;
  const slug = tab && tab !== DEFAULT_TAB ? tabToSlug(tab) : "";

  const qp = new URLSearchParams();
  if (query?.asset) qp.set("asset", Array.isArray(query.asset) ? query.asset[0] : query.asset);
  if (query?.section) qp.set("section", Array.isArray(query.section) ? query.section[0] : query.section);
  const qs = qp.toString();

  redirect(`/project/${projectId}${slug ? `/${slug}` : ""}${qs ? `?${qs}` : ""}`);
}
