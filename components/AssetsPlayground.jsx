"use client";

import React, { Suspense } from "react";

import "@/addons";
import { AddonRegistryProvider } from "@/addons/registry";
import { WorkspaceShell } from "@/components/internal/workspace/workspace_shell";
import { WorkspaceScreen } from "@/components/internal/workspace/workspace_screen";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { ProjectProvider, PREVIEW_PROJECT } from "@/context/project-context";

function PreviewWorkspace() {
  const { tab, setTab } = useWorkspaceUrl();

  return (
    <WorkspaceShell>
      <WorkspaceScreen tab={tab} projectId={PREVIEW_PROJECT.id} onNavigate={setTab} />
    </WorkspaceShell>
  );
}

export function AssetsPlayground() {
  return (
    <Suspense fallback={null}>
      <ProjectProvider preview>
        <AddonRegistryProvider initialEnabledAddons={["brand-kit"]}>
          <PreviewWorkspace />
        </AddonRegistryProvider>
      </ProjectProvider>
    </Suspense>
  );
}

export default AssetsPlayground;
