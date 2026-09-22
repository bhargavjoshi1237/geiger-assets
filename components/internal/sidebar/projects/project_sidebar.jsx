"use client";

import React, { useState } from "react";
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
} from "@geiger/ui/sidebar";
import { PanelLeft } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { SidebarOption } from "../sidebar_option";
import { settingsNav } from "./sidebar_data";
import { useVisibleProjectNav } from "@/lib/hooks/use-visible-project-nav";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

function SidebarLogo() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className="h-2 w-2 rounded-full bg-foreground" />;
  }

  return (
    <img
      src={`${basePath}/logo1.svg`}
      alt=""
      className="geiger-logo h-5 w-5"
      onError={() => setFailed(true)}
    />
  );
}

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
            <SidebarLogo />
          </div>
          <span className="text-sm font-semibold text-foreground">Assets</span>
        </div>
      </div>
    </SidebarHeader>
  );
}

function resolveSubItems(item) {
  if (item.subItems) return item.subItems;
  if (item.hasSubmenu) return settingsNav;
  return null;
}

export function ProjectSidebar({ activeTab = "Overview", onTabChange = () => {} }) {
  const { toggleSidebar } = useSidebar();
  const [expandedItems, setExpandedItems] = useState({});
  const projectNav = useVisibleProjectNav();

  const toggleExpand = (title) => {
    setExpandedItems((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <MobileSidebarHeader />
      <SidebarContent className="relative flex-1 space-y-2 overflow-hidden bg-sidebar">
        <div className="h-full overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {projectNav.map((item) => {
                  const itemSubItems = resolveSubItems(item);
                  const containsActiveTab = itemSubItems?.some(
                    (subItem) => subItem.title === activeTab,
                  );

                  return (
                    <SidebarOption
                      key={item.title}
                      title={item.title}
                      icon={item.icon}
                      isActive={activeTab === item.title}
                      subItems={itemSubItems}
                      isExpanded={
                        expandedItems[item.title] !== undefined
                          ? expandedItems[item.title]
                          : Boolean(containsActiveTab)
                      }
                      onToggle={() => toggleExpand(item.title)}
                      activeSubTab={activeTab}
                      onClick={(tabTitle) => {
                        if (tabTitle && typeof tabTitle === "string") {
                          onTabChange(tabTitle);
                        } else if (itemSubItems) {
                          toggleExpand(item.title);
                        } else {
                          setExpandedItems({});
                          onTabChange(item.title);
                        }
                      }}
                      badge={
                        itemSubItems?.length ? String(itemSubItems.length) : item.badge
                      }
                    />
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </SidebarContent>
      <SidebarFooter className="z-10 mt-auto border-t border-sidebar-border bg-sidebar p-2">
        <Button
          type="button"
          variant="ghost"
          onClick={toggleSidebar}
          className="flex w-full items-center gap-3 rounded-lg p-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-5 w-5 shrink-0" />
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export default ProjectSidebar;
