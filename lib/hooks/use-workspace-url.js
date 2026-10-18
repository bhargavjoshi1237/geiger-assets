"use client";

import { createContext, useCallback, useContext } from "react";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { tabToSlug, slugToTab } from "@/lib/workspace/tabs";

export const DEFAULT_TAB = "Overview";
export const DEFAULT_SECTION = "overview";
export const FOLDERS_TAB = "Folders";

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

// Lets a shell that runs outside a /project/<id> route (the landing playground)
// supply the same API from React state instead of the URL.
export const WorkspaceUrlContext = createContext(null);

export function useWorkspaceUrl() {
  const override = useContext(WorkspaceUrlContext);
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
  // Folder path the Folders screen should open on (an asset's `folder` value).
  const folder = searchParams.get("folder") || null;

  const buildUrl = useCallback(
    (next) => {
      const pid = next.project !== undefined ? next.project : projectId;
      const nextTab = next.tab !== undefined ? next.tab : tab;
      const asset = next.asset !== undefined ? next.asset : assetId;
      const sec = next.section !== undefined ? next.section : section;
      const fol = next.folder !== undefined ? next.folder : folder;

      const qp = new URLSearchParams();
      if (asset) qp.set("asset", asset);
      if (sec && sec !== DEFAULT_SECTION) qp.set("section", sec);
      if (fol) qp.set("folder", fol);
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
    [projectId, tab, assetId, section, folder, pathname, onProjectRoute],
  );

  const apply = useCallback(
    (next) => {
      router.push(buildUrl(next), { scroll: false });
    },
    [router, buildUrl],
  );

  const setProject = useCallback(
    (id) => router.push(`/project/${id}`, { scroll: false }),
    [router],
  );

  const setTab = useCallback(
    (next) => apply({ tab: next, asset: null, section: null, folder: null }),
    [apply],
  );

  const openFolder = useCallback(
    (path) => apply({ tab: FOLDERS_TAB, asset: null, section: null, folder: path || null }),
    [apply],
  );

  const openAsset = useCallback(
    (id) => apply({ asset: id, section: null }),
    [apply],
  );

  const openAssetInTab = useCallback(
    (id, nextTab) => apply({ tab: nextTab, asset: id, section: null, folder: null }),
    [apply],
  );
  const closeAsset = useCallback(
    () => apply({ asset: null, section: null }),
    [apply],
  );
  const setSection = useCallback((next) => apply({ section: next }), [apply]);

  if (override) return override;

  return {
    projectId,
    tab,
    assetId,
    section,
    folder,
    setProject,
    setTab,
    openFolder,
    openAsset,
    openAssetInTab,
    closeAsset,
    setSection,
  };
}
