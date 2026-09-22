"use client";

import React from "react";

import { getAddonScreens, useAddonRegistry } from "@/addons/registry";
import { getScreen } from "@/components/internal/screens/registry";
import { FeatureScreen } from "@/components/internal/screens/projects/features/feature_screen";
import { featureItemsByTitle } from "@/components/internal/sidebar/projects/feature_registry";

export function WorkspaceScreen({ tab, projectId, onNavigate }) {
  const { enabledAddons } = useAddonRegistry();
  const addonScreens = React.useMemo(
    () => getAddonScreens(enabledAddons),
    [enabledAddons],
  );
  if (addonScreens[tab]) {
    return React.createElement(addonScreens[tab], { projectId });
  }

  const screen = getScreen(tab);
  if (screen) return React.createElement(screen, { projectId });

  if (featureItemsByTitle.has(tab)) {
    return <FeatureScreen title={tab} onNavigate={onNavigate} />;
  }

  return (
    <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
      Screen: {tab}
    </div>
  );
}

export default WorkspaceScreen;
