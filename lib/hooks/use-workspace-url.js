"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { tabToSlug, slugToTab } from "@/lib/workspace/tabs";

// Persistent workspace navigation, mirrored to the URL so a refresh (or a shared
// link) lands the user on the exact same place — the active sidebar tab, the
// open asset, and the editor section. Matches the suite pattern (Geiger Events):
// the URL is the source of truth and a default value drops its param/segment
// for a clean URL.
//
// Canonical schema:  /project/<projectId>/<tab-slug>?asset=ast_123&section=relationships
//   - <tab-slug> → sidebar tab, slugified ("Asset Library" → "assetlibrary").
//     Default "Overview" ⇒ segment omitted.
//   - asset   → id of the open asset in the Library. None ⇒ omitted.
//   - section → editor section inside an asset. Default "overview" ⇒ omitted.
// Legacy schema (/[projectId]?tab=…) is still read, and tab switches from it
// navigate with ?tab= so old bookmarks keep working.
//
// Components reading this hook must sit under a <Suspense> boundary (required by
// `useSearchParams`); AssetsPlayground provides one.
export const DEFAULT_TAB = "Overview";
export const DEFAULT_SECTION = "overview";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

function stripBase(pathname) {
  if (basePath && pathname.startsWith(basePath)) {
    const rest = pathname.slice(basePath.length);
    return rest || "/";
  }
  return pathname;
}

function tabSlugFromPath(pathname) {
  const parts = stripBase(pathname).split("/").filter(Boolean);
  if (parts[0] === "project" && parts.length >= 3) return parts[2];
  return null;
}

function projectIdFromPath(pathname) {
  const parts = stripBase(pathname).split("/").filter(Boolean);
  if (parts[0] === "project" && parts.length >= 2) return parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

export function useWorkspaceUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();

  const projectId = params?.projectId || projectIdFromPath(pathname);
  const onProjectRoute = stripBase(pathname).split("/").filter(Boolean)[0] === "project";

  const pathTab = slugToTab(tabSlugFromPath(pathname));
  const tab = pathTab || searchParams.get("tab") || DEFAULT_TAB;
  const assetId = searchParams.get("asset") || null;
  const section = searchParams.get("section") || DEFAULT_SECTION;

  const buildUrl = useCallback(
    (next) => {
      const pid = next.project !== undefined ? next.project : projectId;
      const nextTab = next.tab !== undefined ? next.tab : tab;
      const asset = next.asset !== undefined ? next.asset : assetId;
      const sec = next.section !== undefined ? next.section : section;

      const qp = new URLSearchParams();
      if (asset) qp.set("asset", asset);
      if (sec && sec !== DEFAULT_SECTION) qp.set("section", sec);
      const qs = qp.toString();
      const suffix = qs ? `?${qs}` : "";

      if (onProjectRoute) {
        const slug = nextTab && nextTab !== DEFAULT_TAB ? tabToSlug(nextTab) : "";
        return slug ? `/project/${pid}/${slug}${suffix}` : `/project/${pid}${suffix}`;
      }

      const qpLegacy = new URLSearchParams(qs);
      if (nextTab && nextTab !== DEFAULT_TAB) qpLegacy.set("tab", nextTab);
      const legacyQs = qpLegacy.toString();
      return legacyQs ? `${pathname}${legacyQs ? `?${legacyQs}` : ""}` : pathname;
    },
    [projectId, tab, assetId, section, pathname, onProjectRoute],
  );

  const apply = useCallback(
    (next) => {
      router.push(buildUrl(next), { scroll: false });
    },
    [router, buildUrl],
  );

  // Switching workspace tabs exits any open asset/section.
  const setTab = useCallback(
    (next) => apply({ tab: next, asset: null, section: null }),
    [apply],
  );
  // Opening an asset keeps the tab but resets to its default section.
  const openAsset = useCallback(
    (id) => apply({ asset: id, section: null }),
    [apply],
  );
  // Switch to another tab and open an asset there in one navigation.
  const openAssetInTab = useCallback(
    (id, nextTab) => apply({ tab: nextTab, asset: id, section: null }),
    [apply],
  );
  const closeAsset = useCallback(
    () => apply({ asset: null, section: null }),
    [apply],
  );
  const setSection = useCallback((next) => apply({ section: next }), [apply]);

  return {
    projectId,
    tab,
    assetId,
    section,
    setTab,
    openAsset,
    openAssetInTab,
    closeAsset,
    setSection,
  };
}
