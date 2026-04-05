"use client";

import React, { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { PanelLeft, ChevronLeft } from "lucide-react";
import { SidebarOption } from "../sidebar_option";
import { projectNav, settingsNav, mediaTypesNav } from "./sidebar_data";

export function ProjectSidebar({
  activeTab = "Overview",
  onTabChange = () => {},
  subMenuMode = "dropdown",
}) {
  const { toggleSidebar } = useSidebar();
  const [activeMenu, setActiveMenu] = useState("main");
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpand = (title) => {
    setExpandedItems((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  return (
    <Sidebar
      collapsible="icon"
      className="bg-sidebar border-r border-sidebar-border text-sidebar-foreground"
    >
      <SidebarContent className="space-y-2 relative flex-1 overflow-hidden bg-sidebar">
        <div
          className={`absolute inset-0 w-full h-full bg-sidebar transition-transform duration-300 ease-in-out ${
            activeMenu === "main" ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="h-full overflow-y-auto  overflow-x-hidden">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {projectNav.map((item) => (
                    <SidebarOption
                      key={item.title}
                      title={item.title}
                      icon={item.icon}
                      isActive={
                        activeTab === item.title && activeMenu === "main"
                      }
                      subItems={
                        subMenuMode === "dropdown"
                          ? item.hasSubmenu
                            ? item.title === "Media Types"
                              ? mediaTypesNav
                              : settingsNav
                            : null
                          : null
                      }
                      isExpanded={expandedItems[item.title]}
                      onToggle={() => toggleExpand(item.title)}
                      activeSubTab={activeTab}
                      onClick={(tabTitle) => {
                        if (tabTitle && typeof tabTitle === "string") {
                          onTabChange(tabTitle);
                        } else if (subMenuMode === "slide" && item.hasSubmenu) {
                          setExpandedItems({});
                          setActiveMenu(item.title.toLowerCase());
                          if (item.title === "Settings") {
                            onTabChange("General");
                          }
                        } else if (item.hasSubmenu) {
                          setExpandedItems({
                            [item.title]: !expandedItems[item.title],
                          });
                        } else {
                          setExpandedItems({});
                          onTabChange(item.title);
                        }
                      }}
                      badge={item.badge}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        </div>

        {subMenuMode === "slide" && (
          <div
            className={`absolute inset-0 w-full h-full bg-sidebar transition-transform duration-300 ease-in-out flex flex-col ${
              activeMenu === "settings" ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="px-2 pt-3 pb-2 border-b border-sidebar-border mb-2 bg-sidebar">
              <button
                type="button"
                onClick={() => {
                  setActiveMenu("main");
                  onTabChange("Overview");
                }}
                className="flex items-center gap-2 text-sidebar-foreground hover:text-white transition-colors text-sm font-medium w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:hidden px-2 py-1 rounded-md hover:bg-sidebar-accent"
              >
                <ChevronLeft className="w-4 h-4" />
                Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMenu("main");
                  onTabChange("Overview");
                }}
                className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full text-sidebar-foreground hover:text-white rounded-md hover:bg-sidebar-accent p-1"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-1 py-1 overflow-x-hidden bg-sidebar">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {settingsNav.map((item) => (
                      <SidebarOption
                        key={item.title}
                        title={item.title}
                        isActive={activeTab === item.title}
                        onClick={() => onTabChange(item.title)}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </div>
          </div>
        )}
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-sidebar-border mt-auto z-10 bg-sidebar">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex items-center gap-3 p-2 w-full rounded-lg hover:bg-sidebar-accent transition-all text-sidebar-foreground hover:text-white group-data-[collapsible=icon]:justify-center"
        >
          <PanelLeft className="w-5 h-5 shrink-0" />
        </button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
