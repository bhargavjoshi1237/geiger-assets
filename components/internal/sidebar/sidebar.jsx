"use client";

import React from "react";
import Image from "next/image";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
            <Image
              src={`${basePath}/logo1.svg`}
              alt=""
              width={20}
              height={20}
              className="geiger-logo h-5 w-5"
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
        <Button
          type="button"
          variant="ghost"
          onClick={toggleSidebar}
          className="flex w-full items-center gap-3 rounded-lg p-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="w-5 h-5 shrink-0" />
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
