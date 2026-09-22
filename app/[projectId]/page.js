import { notFound, redirect } from "next/navigation";

import { tabToSlug, slugToTab } from "@/lib/workspace/tabs";
import { isReservedSegment } from "@/lib/workspace/reserved";

const DEFAULT_TAB = "Overview";

export default async function AssetsProjectLegacyPage({ params, searchParams }) {
  const { projectId } = await params;
  if (isReservedSegment(projectId)) notFound();
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
