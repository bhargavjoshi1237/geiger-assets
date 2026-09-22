"use client";

import React from "react";

import { projectNav } from "@/components/internal/sidebar/projects/sidebar_data";
import {
  getAddonNavItems,
  mergeNavWithAddons,
  useAddonRegistry,
} from "@/addons/registry";

// The project nav the current user actually sees: core nav with the enabled
// add-on entries merged in. The sidebar and the command palette read this one
// source so they can never drift apart.
export function useVisibleProjectNav() {
  const { enabledAddons, navPositions, addonColors } = useAddonRegistry();

  return React.useMemo(() => {
    const addonNavItems = getAddonNavItems(
      enabledAddons,
      navPositions,
      addonColors,
    );
    return mergeNavWithAddons(projectNav, addonNavItems);
  }, [enabledAddons, navPositions, addonColors]);
}

export default useVisibleProjectNav;
