"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Persistent workspace navigation, mirrored to the URL so a refresh (or a shared
// link) lands the user on the exact same place — the active sidebar tab, the
// open asset, and the editor section. Matches the suite pattern (Geiger Events /
// Flow): the URL is the source of truth, navigation uses `router.push(...,
// { scroll: false })`, and a default value drops its param for a clean URL.
//
// Schema:  /<projectId>?tab=Asset%20Library&asset=ast_123&section=relationships
//   - tab     → workspace tab (sidebar). Default "Overview" ⇒ omitted.
//   - asset   → id of the open asset in the Library. None ⇒ omitted.
//   - section → editor section inside an asset. Default "overview" ⇒ omitted.
//
// Components reading this hook must sit under a <Suspense> boundary (required by
// `useSearchParams`); AssetsPlayground provides one.
export const DEFAULT_TAB = "Overview";
export const DEFAULT_SECTION = "overview";

export function useWorkspaceUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = searchParams.get("tab") || DEFAULT_TAB;
  const assetId = searchParams.get("asset") || null;
  const section = searchParams.get("section") || DEFAULT_SECTION;

  // Patch the query string immutably. For each key: `undefined` leaves it
  // untouched, while a value equal to its default (or null/empty) deletes it so
  // the URL stays clean.
  const apply = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams.toString());
      const put = (key, value, fallback) => {
        if (value === undefined) return;
        if (value === null || value === "" || value === fallback)
          params.delete(key);
        else params.set(key, value);
      };
      put("tab", next.tab, DEFAULT_TAB);
      put("asset", next.asset, null);
      put("section", next.section, DEFAULT_SECTION);

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
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
