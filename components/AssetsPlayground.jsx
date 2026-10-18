"use client";

import React, { Suspense } from "react";

import "@/addons";
import { AddonRegistryProvider } from "@/addons/registry";
import { WorkspaceShell } from "@/components/internal/workspace/workspace_shell";
import { WorkspaceScreen } from "@/components/internal/workspace/workspace_screen";
import { PlaygroundWorkspaceUrlProvider } from "@/components/landing/playground_workspace_url";
import { ScreenErrorBoundary } from "@/components/landing/screen_error_boundary";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { usePlaygroundMode } from "@/lib/playground/use_playground_mode";
import { playgroundHandlers, playgroundRoutes } from "@/lib/playground/handlers";
import { ProjectProvider, PREVIEW_PROJECT } from "@/context/project-context";

const PLAYGROUND_ADDONS = ["brand-kit", "watermark", "contact-sheets"];
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const MODE_OPTIONS = { routes: playgroundRoutes, basePath: BASE_PATH };

function PreviewWorkspace() {
  const { tab, setTab } = useWorkspaceUrl();

  return (
    <WorkspaceShell>
      <ScreenErrorBoundary key={tab} title={tab}>
        <WorkspaceScreen tab={tab} projectId={PREVIEW_PROJECT.id} onNavigate={setTab} />
      </ScreenErrorBoundary>
    </WorkspaceShell>
  );
}

// Live, embeddable copy of the Assets workspace for the landing page: the real
// shell, sidebar and every real screen, served by an in-memory seeded database
// (lib/playground) instead of Supabase and storage. Navigation stays in React
// state (PlaygroundWorkspaceUrlProvider), so browsing never touches the landing
// page's URL. Edits persist for the session and reset on reload — no save, no load.
export function AssetsPlayground() {
  usePlaygroundMode(playgroundHandlers, MODE_OPTIONS);

  return (
    <Suspense fallback={null}>
      <PlaygroundWorkspaceUrlProvider>
        <ProjectProvider preview>
          <AddonRegistryProvider initialEnabledAddons={PLAYGROUND_ADDONS}>
            <PreviewWorkspace />
          </AddonRegistryProvider>
        </ProjectProvider>
      </PlaygroundWorkspaceUrlProvider>
    </Suspense>
  );
}

export default AssetsPlayground;
