"use client";

import React from "react";
import { Bell } from "lucide-react";
import { SidebarInset, SidebarProvider } from "@geiger/ui/sidebar";
import { Topbar } from "@geiger/ui/topbar";
import { Button } from "@geiger/ui/button";

import { ProjectSidebar } from "@/components/internal/sidebar/projects/project_sidebar";
import { settingsNav } from "@/components/internal/sidebar/projects/sidebar_data";
import { NotificationsDropdown } from "@/components/internal/topbar/dialogue/notifications_dropdown";
import { ProfileDropdown } from "@/components/internal/topbar/dialogue/profile_dropdown";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { useVisibleProjectNav } from "@/lib/hooks/use-visible-project-nav";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

function buildSearchNav(projectNav) {
  return projectNav.map((item) =>
    item.hasSubmenu && !item.subItems
      ? { ...item, subItems: settingsNav }
      : item,
  );
}

export function WorkspaceShell({ children }) {
  const { tab, setTab } = useWorkspaceUrl();
  const projectNav = useVisibleProjectNav();
  const searchNav = React.useMemo(
    () => buildSearchNav(projectNav),
    [projectNav],
  );

  const handleSearchSelect = React.useCallback(
    (item) => {
      if (item?.title) setTab(item.title);
    },
    [setTab],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-foreground selection:bg-surface-strong">
      <SidebarProvider
        className="!flex h-full min-w-0 flex-col"
        style={{ flexDirection: "column" }}
      >
        <Topbar
          label="Assets"
          logoSrc={`${basePath}/logo1.svg`}
          homeHref={basePath || "/"}
          searchPlaceholder="Search project..."
          searchNav={searchNav}
          onSearchSelect={handleSearchSelect}
          searchRecentsKey="geiger-assets:palette:recents"
          notifications={
            <NotificationsDropdown>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Notifications"
                className="relative hidden h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground sm:flex"
              >
                <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
              </Button>
            </NotificationsDropdown>
          }
          profile={<ProfileDropdown />}
        />
        <div className="relative flex flex-1 overflow-hidden">
          <ProjectSidebar activeTab={tab} onTabChange={setTab} />
          <SidebarInset className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden border-none bg-transparent">
            <div className="pointer-events-none absolute right-0 top-0 h-[300px] w-[500px] rounded-full bg-white/[0.02] blur-[120px]" />
            <main className="relative z-10 w-full min-w-0 flex-1 overflow-y-auto px-2 py-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-3 sm:py-4 md:p-8 [&::-webkit-scrollbar]:hidden">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

export default WorkspaceShell;
