"use client";

import React from "react";
import { Bell } from "lucide-react";
import { Button, SidebarTrigger, Topbar as SuiteTopbar } from "@geiger/ui";

import { NotificationsDropdown } from "./dialogue/notifications_dropdown";
import { ProfileDropdown } from "./dialogue/profile_dropdown";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import {
  projectNav,
  settingsNav,
} from "@/components/internal/sidebar/projects/sidebar_data";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// /project/ workspace topbar — thin wrapper over the shared suite Topbar
// (@geiger/ui), mirroring geiger-events. Product-specific pieces stay local:
// nav tree for ⌘K search, notification/profile dropdowns, and the sidebar
// trigger bound to this app's local SidebarProvider.
export function Topbar() {
  const { setTab } = useWorkspaceUrl();

  const searchNav = React.useMemo(
    () =>
      projectNav.map((item) =>
        item.hasSubmenu && !item.subItems
          ? { ...item, subItems: settingsNav }
          : item,
      ),
    [],
  );

  return (
    <SuiteTopbar
      label="Assets"
      logoSrc={`${basePath}/logo1.svg`}
      homeHref={basePath || "/"}
      searchPlaceholder="Search Assets..."
      searchNav={searchNav}
      searchRecentsKey="geiger:assets:search-recents"
      onSearchSelect={(item) => setTab(item.title)}
      sidebarTrigger={
        <SidebarTrigger className="-ml-2 text-foreground md:hidden" />
      }
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
  );
}
