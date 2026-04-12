"use client";

import React, { Suspense } from "react";
import { use, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ProjectSidebar } from "@/components/internal/sidebar/projects/project_sidebar";
import { ProjectTopbar } from "@/components/internal/topbar/projects/topbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ProjectProvider, useProject } from "@/context/project-context";
import { settingsNav } from "@/components/internal/sidebar/projects/sidebar_data";
import { useEffect } from "react";
import { HomeScreen } from "@/components/internal/screens/projects/home/home_screen";

function ProjectLayoutContent({ id }) {
  const { fetchProjectInfo, project, loading } = useProject();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (id) {
      fetchProjectInfo(id);
    }
  }, [id, fetchProjectInfo]);

  // Get all search param keys; the first non-"screen" key is the active tab
  const screenParamKeys = [];
  searchParams.forEach((_, key) => {
    screenParamKeys.push(key);
  });
  const currentTab = screenParamKeys[0] || "Overview";

  const setCurrentTab = useCallback(
    (tab) => {
      if (tab === "Overview") {
        router.push(pathname, { scroll: false });
      } else {
        router.push(`${pathname}?${encodeURIComponent(tab)}`, { scroll: false });
      }
    },
    [router, pathname]
  );

  const renderScreen = () => {
    const isSettingsTab = settingsNav.some((item) => item.title === currentTab);
    if (isSettingsTab) {
      // Placeholder for settings screen
      return (
        <div className="flex items-center justify-center h-full text-[#525252] text-sm">
          Settings: {currentTab}
        </div>
      );
    }

    switch (currentTab) {
      case "Overview":
        return <HomeScreen id={id} />;
      case "Library":
        return <LibraryScreen id={id} />;
      default:
        return <HomeScreen id={id} />;
    }
  };

  if (loading || !project) {
    return (
      <div className="flex flex-col h-[100dvh] w-full bg-[#161616] items-center justify-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-[#474747] border-t-[#e7e7e7] animate-spin" />
        <span className="text-[#525252] text-sm">Loading project...</span>
      </div>
    );
  }

  return (
    <div className="flex-col h-[100dvh] w-full bg-[#161616] text-[#ededed] font-sans overflow-hidden selection:bg-[#333333] flex">
      <SidebarProvider className="flex-col !flex h-full min-w-0" style={{flexDirection: 'column'}}>
        <ProjectTopbar />
        <div className="flex flex-1 overflow-hidden relative">
          <ProjectSidebar activeTab={currentTab} onTabChange={setCurrentTab} />
          <SidebarInset className="flex-1 flex flex-col h-full bg-transparent overflow-hidden relative border-none">
            <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-white/[0.02] blur-[120px] pointer-events-none rounded-full"></div>
            <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 w-full min-w-0">
              {renderScreen()}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

export default function ProjectPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const { projectId } = params;

  return (
    <ProjectProvider>
      <Suspense
        fallback={
          <div className="flex flex-col h-[100dvh] w-full bg-[#161616] items-center justify-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-[#474747] border-t-[#e7e7e7] animate-spin" />
            <span className="text-[#525252] text-sm">Loading...</span>
          </div>
        }
      >
        <ProjectLayoutContent id={projectId} />
      </Suspense>
    </ProjectProvider>
  );
}
