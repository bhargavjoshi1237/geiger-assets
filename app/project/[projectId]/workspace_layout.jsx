"use client";

import React, { Suspense } from "react";

import "@/addons";
import { AddonRegistryProvider } from "@/addons/registry";
import { WorkspaceShell } from "@/components/internal/workspace/workspace_shell";
import { ProjectProvider } from "@/context/project-context";

export default function ProjectWorkspaceLayout({ children }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] w-full items-center justify-center bg-background" />
      }
    >
      <ProjectProvider>
        <AddonRegistryProvider>
          <div className="h-[100dvh] w-full overflow-hidden bg-background">
            <WorkspaceShell>{children}</WorkspaceShell>
          </div>
        </AddonRegistryProvider>
      </ProjectProvider>
    </Suspense>
  );
}
