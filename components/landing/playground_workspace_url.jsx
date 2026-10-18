"use client";

import React, { useCallback, useMemo, useState } from "react";

import {
  WorkspaceUrlContext,
  DEFAULT_TAB,
  DEFAULT_SECTION,
  FOLDERS_TAB,
} from "@/lib/hooks/use-workspace-url";
import { PLAYGROUND_PROJECT } from "@/lib/playground/mode";

// In-memory stand-in for the routed workspace URL, for the landing playground
// (mirrors geiger-events). It exposes exactly the useWorkspaceUrl() API, but the
// active tab, open asset and detail section live in React state, so a screen can
// open its detail view inside the embed without navigating the landing page.

const EMPTY_STATE = { tab: DEFAULT_TAB, asset: null, section: DEFAULT_SECTION, folder: null };
const STATE_KEYS = Object.keys(EMPTY_STATE);

export function PlaygroundWorkspaceUrlProvider({ children }) {
  const [state, setState] = useState(EMPTY_STATE);

  // Same patch semantics as the routed hook: `undefined` keeps the current
  // value, an explicit value (including null) replaces it.
  const apply = useCallback((next) => {
    setState((prev) => {
      const merged = { ...prev };
      for (const key of STATE_KEYS) {
        if (next[key] !== undefined) merged[key] = next[key];
      }
      return merged;
    });
  }, []);

  const value = useMemo(
    () => ({
      projectId: PLAYGROUND_PROJECT.id,
      tab: state.tab || DEFAULT_TAB,
      assetId: state.asset,
      section: state.section || DEFAULT_SECTION,
      folder: state.folder,
      // The playground has exactly one project — nothing to switch to.
      setProject: () => {},
      setTab: (tab) => apply({ tab, asset: null, section: null, folder: null }),
      openFolder: (path) =>
        apply({ tab: FOLDERS_TAB, asset: null, section: null, folder: path || null }),
      openAsset: (id) => apply({ asset: id, section: null }),
      openAssetInTab: (id, tab) => apply({ tab, asset: id, section: null, folder: null }),
      closeAsset: () => apply({ asset: null, section: null }),
      setSection: (section) => apply({ section }),
    }),
    [state, apply],
  );

  return (
    <WorkspaceUrlContext.Provider value={value}>
      {children}
    </WorkspaceUrlContext.Provider>
  );
}

export default PlaygroundWorkspaceUrlProvider;
