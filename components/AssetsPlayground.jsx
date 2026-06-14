"use client";

import React, { useEffect, useState } from "react";
import { ProjectSidebar } from "@/components/internal/sidebar/projects/project_sidebar";
import { Topbar } from "@/components/internal/topbar/topbar";
import { HomeScreen } from "@/components/internal/screens/projects/home/home_screen";
import { LibraryScreen } from "@/components/internal/screens/projects/library/library_screen";
import { FeatureScreen } from "@/components/internal/screens/projects/features/feature_screen";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ProjectProvider, useProject } from "@/context/project-context";
import { settingsNav } from "@/components/internal/sidebar/projects/sidebar_data";
import { featureItemsByTitle } from "@/components/internal/sidebar/projects/feature_registry";

function AssetsPlaygroundContent({ projectId }) {
  const [currentTab, setCurrentTab] = useState("Overview");
  const { fetchProjectInfo } = useProject();

  useEffect(() => {
    fetchProjectInfo(projectId);
  }, [fetchProjectInfo, projectId]);

  const renderScreen = () => {
    const isSettingsTab = settingsNav.some((item) => item.title === currentTab);
    const isFeatureTab = featureItemsByTitle.has(currentTab);

    if (isSettingsTab) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
          Settings: {currentTab}
        </div>
      );
    }

    switch (currentTab) {
      case "Overview":
        return <HomeScreen />;
      case "Asset Library":
        return <LibraryScreen id={projectId} />;
      default:
        if (isFeatureTab) {
          return (
            <FeatureScreen
              title={currentTab}
              onNavigate={setCurrentTab}
            />
          );
        }

        return (
          <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
            Screen: {currentTab}
          </div>
        );
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-foreground selection:bg-surface-strong">
      <SidebarProvider
        className="!flex h-full min-w-0 flex-col"
        style={{ flexDirection: "column" }}
      >
        <Topbar />
        <div className="relative flex flex-1 overflow-hidden">
          <ProjectSidebar activeTab={currentTab} onTabChange={setCurrentTab} />
          <SidebarInset className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden border-none bg-transparent">
            <div className="pointer-events-none absolute right-0 top-0 h-[300px] w-[500px] rounded-full bg-white/[0.02] blur-[120px]" />
            <main className="relative z-10 w-full min-w-0 flex-1 overflow-y-auto px-2 py-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-3 sm:py-4 md:p-8 [&::-webkit-scrollbar]:hidden">
              {renderScreen()}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

export function AssetsPlayground({ projectId = "assets-project" }) {
  return (
    <ProjectProvider>
      <AssetsPlaygroundContent projectId={projectId} />
    </ProjectProvider>
  );
}
