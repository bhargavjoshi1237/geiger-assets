"use client";

import React, { useMemo, useState } from "react";
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
import { ChevronLeft, PanelLeft, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarOption } from "../sidebar_option";
import { projectNav, settingsNav } from "./sidebar_data";

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

export function ProjectSidebar({
  activeTab = "Overview",
  onTabChange = () => {},
  subMenuMode = "dropdown",
}) {
  const { toggleSidebar } = useSidebar();
  const [activeMenu, setActiveMenu] = useState("main");
  const [expandedItems, setExpandedItems] = useState({});
  const [query, setQuery] = useState("");

  const toggleExpand = (title) => {
    setExpandedItems((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const resolveSubItems = (item) => {
    if (item.subItems) {
      return item.subItems;
    }

    if (item.hasSubmenu) {
      return settingsNav;
    }

    return null;
  };

  const filteredNav = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return projectNav;
    }

    return projectNav
      .map((item) => {
        const itemSubItems = resolveSubItems(item);
        const titleMatches = item.title.toLowerCase().includes(normalizedQuery);
        const matchingSubItems = itemSubItems?.filter((subItem) => {
          const searchText = [
            subItem.title,
            subItem.description,
            ...(subItem.capabilities || []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchText.includes(normalizedQuery);
        });

        if (titleMatches) {
          return item;
        }

        if (matchingSubItems?.length) {
          return {
            ...item,
            subItems: matchingSubItems,
          };
        }

        return null;
      })
      .filter(Boolean);
  }, [query]);

  return (
    <Sidebar
      collapsible="icon"
      className="bg-sidebar border-r border-sidebar-border text-sidebar-foreground"
    >
      <MobileSidebarHeader />
      <SidebarContent className="space-y-2 relative flex-1 overflow-hidden bg-sidebar">
        <div
          className={`absolute inset-0 w-full h-full bg-sidebar transition-transform duration-300 ease-in-out ${
            activeMenu === "main" ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="h-full overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredNav.map((item) => {
                    const itemSubItems = resolveSubItems(item);
                    const containsActiveTab = itemSubItems?.some(
                      (subItem) => subItem.title === activeTab,
                    );

                    return (
                      <SidebarOption
                        key={item.title}
                        title={item.title}
                        icon={item.icon}
                        isActive={
                          activeTab === item.title && activeMenu === "main"
                        }
                        subItems={
                          item.subItems ||
                          (subMenuMode === "dropdown" ? itemSubItems : null)
                        }
                        isExpanded={
                          query
                            ? Boolean(itemSubItems)
                            : expandedItems[item.title] !== undefined
                            ? expandedItems[item.title]
                            : Boolean(containsActiveTab)
                        }
                        onToggle={() => toggleExpand(item.title)}
                        activeSubTab={activeTab}
                        onClick={(tabTitle) => {
                          if (tabTitle && typeof tabTitle === "string") {
                            onTabChange(tabTitle);
                          } else if (
                            subMenuMode === "slide" &&
                            item.hasSubmenu
                          ) {
                            setExpandedItems({});
                            setActiveMenu(item.title.toLowerCase());
                            if (item.title === "Settings") {
                              onTabChange("General");
                            }
                          } else if (itemSubItems) {
                            toggleExpand(item.title);
                          } else {
                            setExpandedItems({});
                            onTabChange(item.title);
                          }
                        }}
                        badge={
                          itemSubItems?.length
                            ? String(itemSubItems.length)
                            : item.badge
                        }
                      />
                    );
                  })}
                  {filteredNav.length === 0 ? (
                    <li className="px-2 py-6 text-center text-xs text-text-tertiary">
                      No matching features
                    </li>
                  ) : null}
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setActiveMenu("main");
                  onTabChange("Overview");
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground group-data-[collapsible=icon]:hidden"
              >
                <ChevronLeft className="w-4 h-4" />
                Settings
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setActiveMenu("main");
                  onTabChange("Overview");
                }}
                className="hidden w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground group-data-[collapsible=icon]:flex"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden bg-sidebar px-1 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
