"use client";

import React, { Suspense, useEffect } from "react";
import { ProjectSidebar } from "@/components/internal/sidebar/projects/project_sidebar";
import { Topbar } from "@/components/internal/topbar/topbar";
import { HomeScreen } from "@/components/internal/screens/projects/home/home_screen";
import { LibraryScreen } from "@/components/internal/screens/projects/library/library_screen";
import { UploadCenterScreen } from "@/components/internal/screens/projects/uploads/upload_center_screen";
import { ExternalUploadsScreen } from "@/components/internal/screens/projects/external_uploads/external_uploads_screen";
import { CollectionsScreen } from "@/components/internal/screens/projects/collections/collections_screen";
import { FoldersScreen } from "@/components/internal/screens/projects/folders/folders_screen";
import { DuplicateReviewScreen } from "@/components/internal/screens/projects/duplicates/duplicate_review_screen";
import { ArchiveTrashScreen } from "@/components/internal/screens/projects/archive/archive_trash_screen";
import { AssetRequestsScreen } from "@/components/internal/screens/projects/requests/asset_requests_screen";
import { FeatureScreen } from "@/components/internal/screens/projects/features/feature_screen";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ProjectProvider, useProject } from "@/context/project-context";
import { settingsNav } from "@/components/internal/sidebar/projects/sidebar_data";
import { featureItemsByTitle } from "@/components/internal/sidebar/projects/feature_registry";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

function AssetsPlaygroundContent({ projectId }) {
  // The active tab lives in the URL (?tab=…) so a refresh or shared link lands
  // the user on the same screen — and, via the Library, the same asset/section.
  const { tab: currentTab, setTab: setCurrentTab } = useWorkspaceUrl();
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
        return <LibraryScreen projectId={projectId} />;
      case "Upload Center":
        return <UploadCenterScreen projectId={projectId} />;
      case "External Uploads":
        return <ExternalUploadsScreen projectId={projectId} />;
      case "Collections":
        return <CollectionsScreen projectId={projectId} />;
      case "Folders & Storage":
        return <FoldersScreen projectId={projectId} />;
      case "Duplicate Review":
        return <DuplicateReviewScreen projectId={projectId} />;
      case "Archive & Trash":
        return <ArchiveTrashScreen projectId={projectId} />;
      case "Asset Requests":
        return <AssetRequestsScreen projectId={projectId} />;
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
      {/* useWorkspaceUrl() reads useSearchParams(), which requires a Suspense
          boundary above it. */}
      <Suspense fallback={null}>
        <AssetsPlaygroundContent projectId={projectId} />
      </Suspense>
    </ProjectProvider>
  );
}
