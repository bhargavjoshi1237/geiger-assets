"use client";

import React from "react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { ChevronDown, Search, MoreVertical, PanelLeft } from "lucide-react";
import { SidebarOption } from "./sidebar_option";
import { workspaceNav } from "./sidebar_nav";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

function MobileSidebarHeader() {
  const { isMobile } = useSidebar();

  if (!isMobile) {
    return null;
  }

  return (
    <SidebarHeader className="border-b border-sidebar-border p-0">
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded">
            <img
              src={`${basePath}/logo1.svg`}
              alt=""
              className="h-5 w-5"
              onError={(event) => {
                event.currentTarget.style.display = "none";
                event.currentTarget.parentElement.innerHTML =
                  '<div class="h-2 w-2 rounded-full bg-foreground"></div>';
              }}
            />
          </div>
          <span className="text-sm font-semibold text-foreground">Assets</span>
        </div>
      </div>
    </SidebarHeader>
  );
}

export function AppSidebar({ activeTab = "Overview", onTabChange = () => {} }) {
  const { toggleSidebar } = useSidebar();

  return (
    <Sidebar
      collapsible="icon"
      className="bg-sidebar border-r border-sidebar-border text-sidebar-foreground"
    >
      <MobileSidebarHeader />
      <SidebarContent className="px-1 py-1 space-y-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceNav.map((item) => (
                <SidebarOption
                  key={item.title}
                  title={item.title}
                  icon={item.icon}
                  isActive={activeTab === item.title}
                  onClick={() => onTabChange(item.title)}
                  badge={item.badge}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-sidebar-border mt-auto">
        <button
          type="button"
          onClick={toggleSidebar}

        >
          <PanelLeft className="w-5 h-5 shrink-0" />
        </button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
